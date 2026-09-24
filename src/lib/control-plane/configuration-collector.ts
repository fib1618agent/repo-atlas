/**
 * SERVER-ONLY. Collects effective configuration by calling the existing
 * helpers, without changing them, and hands the pure read model booleans and
 * values only for allowlisted registry entries. Never import from client code.
 */
import {
  ATLAS_CACHE_TTL_MS,
  ATLAS_DEFAULT_OWNER,
  ATLAS_LOAD_INITIAL_SOURCES,
  ATLAS_MAX_SOURCES,
  ATLAS_MAX_SPIRAL_REPOS,
  ATLAS_MAX_STORED_REPOS,
  serverAtlasConfig,
} from "../atlas-config";
import { getActiveProvider } from "../ai/providers";
import {
  CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET,
  CODE_INTEL_CHECKPOINT_FILE_COUNT,
  CODE_INTEL_EXTRACTION_BATCH_SIZE,
  CODE_INTEL_LIST_FILES_DEFAULT_LIMIT,
  CODE_INTEL_LIST_FILES_MAX_LIMIT,
  CODE_INTEL_MAX_FILE_SIZE_BYTES,
  CODE_INTEL_MAX_R2_CONCURRENCY,
  CODE_INTEL_MAX_RETRY_ATTEMPTS,
  CODE_INTEL_QUEUE_BATCH_SIZE,
  codeIntelConfig,
} from "../code-intel/config";
import {
  canUseD1,
  canUseR2,
  getGitHubToken,
  getSnapshotQueue,
  getSymbolQueue,
} from "../code-intel/persistence/cloudflare-env";
import { canUseSqlite } from "../storage/atlas-store";
import {
  buildConfiguration,
  type AvailabilityInput,
  type ConfigurationInputs,
  type ConfigurationResponse,
  type ValueInput,
} from "./configuration-read-model";
import { SETTING_REGISTRY, type ReasonCode } from "./setting-registry";

const isSet = (envName: string) => process.env[envName] !== undefined;

/** Existing behavior: only the literal "false" turns the option off; any other defined value is treated as on. */
function flagInput(
  envName: string,
  effective: boolean,
  dflt: boolean,
): ValueInput {
  const raw = process.env[envName];
  return {
    configured: raw !== undefined,
    effective,
    default: dflt,
    ...(raw !== undefined && raw !== "true" && raw !== "false"
      ? { flag: "unrecognized" as const }
      : {}),
  };
}

const numberInput = (
  envName: string,
  effective: number,
  dflt: number,
): ValueInput => ({
  configured: isSet(envName),
  effective,
  default: dflt,
});

/** True when the raw value is defined but existing parsing fell back or skipped entries. */
function initialSourcesUnrecognized(
  raw: string | undefined,
  usedCount: number,
): boolean {
  if (raw === undefined) return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    return !Array.isArray(parsed) || parsed.length !== usedCount;
  } catch {
    return true;
  }
}

function queueAvailable(get: () => unknown): boolean {
  try {
    return Boolean(get());
  } catch {
    return false;
  }
}

function availability(
  available: boolean,
  reason: ReasonCode,
): AvailabilityInput {
  return available ? { available } : { available, reason };
}

export function collectConfigurationInputs(): ConfigurationInputs {
  const atlas = serverAtlasConfig();
  const codeIntel = codeIntelConfig();
  const rawSources = process.env["ATLAS_INITIAL_SOURCES"];
  const rawProvider = process.env["ATLAS_AI_PROVIDER"];
  const provider = getActiveProvider();
  const sqliteEnabled = process.env["ATLAS_SQLITE_ENABLED"] !== "false";

  const values: Record<string, ValueInput> = {
    ATLAS_DEFAULT_OWNER: {
      configured: isSet("ATLAS_DEFAULT_OWNER"),
      effective: atlas.defaultOwner,
      default: ATLAS_DEFAULT_OWNER,
    },
    ATLAS_MAX_SOURCES: numberInput(
      "ATLAS_MAX_SOURCES",
      atlas.maxSources,
      ATLAS_MAX_SOURCES,
    ),
    ATLAS_MAX_SPIRAL_REPOS: numberInput(
      "ATLAS_MAX_SPIRAL_REPOS",
      atlas.maxSpiralRepos,
      ATLAS_MAX_SPIRAL_REPOS,
    ),
    ATLAS_MAX_STORED_REPOS: numberInput(
      "ATLAS_MAX_STORED_REPOS",
      atlas.maxStoredRepos,
      ATLAS_MAX_STORED_REPOS,
    ),
    ATLAS_CACHE_TTL_MS: numberInput(
      "ATLAS_CACHE_TTL_MS",
      atlas.cacheTtlMs,
      ATLAS_CACHE_TTL_MS,
    ),
    ATLAS_LOAD_INITIAL_SOURCES: flagInput(
      "ATLAS_LOAD_INITIAL_SOURCES",
      atlas.loadInitialSources,
      ATLAS_LOAD_INITIAL_SOURCES,
    ),
    ATLAS_INITIAL_SOURCES: {
      configured: rawSources !== undefined,
      effective: atlas.initialSources,
      // What existing parsing falls back to.
      default: [{ type: "github", owner: atlas.defaultOwner }],
      ...(initialSourcesUnrecognized(rawSources, atlas.initialSources.length)
        ? { flag: "unrecognized" as const }
        : {}),
    },
    // No exported default constant exists for the SQLite switch; its behavior is "on unless 'false'".
    ATLAS_SQLITE_ENABLED: flagInput(
      "ATLAS_SQLITE_ENABLED",
      sqliteEnabled,
      true,
    ),
    ATLAS_AI_PROVIDER: {
      configured: rawProvider !== undefined,
      effective: provider,
      // The default provider is not exported; when unset, the provider in use is the default.
      ...(rawProvider === undefined ? { default: provider } : {}),
      ...(rawProvider !== undefined && rawProvider !== provider
        ? { flag: "unrecognized" as const }
        : {}),
    },
    VITE_SITE_URL: {
      configured: isSet("VITE_SITE_URL"),
      effective: process.env["VITE_SITE_URL"] ?? "",
    },
    CODE_INTEL_MAX_R2_CONCURRENCY: numberInput(
      "CODE_INTEL_MAX_R2_CONCURRENCY",
      codeIntel.maxR2Concurrency,
      CODE_INTEL_MAX_R2_CONCURRENCY,
    ),
    CODE_INTEL_CHECKPOINT_FILE_COUNT: numberInput(
      "CODE_INTEL_CHECKPOINT_FILE_COUNT",
      codeIntel.checkpointFileCount,
      CODE_INTEL_CHECKPOINT_FILE_COUNT,
    ),
    CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET: numberInput(
      "CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET",
      codeIntel.checkpointCpuMsBudget,
      CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET,
    ),
    CODE_INTEL_QUEUE_BATCH_SIZE: numberInput(
      "CODE_INTEL_QUEUE_BATCH_SIZE",
      codeIntel.queueBatchSize,
      CODE_INTEL_QUEUE_BATCH_SIZE,
    ),
    CODE_INTEL_MAX_RETRY_ATTEMPTS: numberInput(
      "CODE_INTEL_MAX_RETRY_ATTEMPTS",
      codeIntel.maxRetryAttempts,
      CODE_INTEL_MAX_RETRY_ATTEMPTS,
    ),
    CODE_INTEL_LIST_FILES_DEFAULT_LIMIT: numberInput(
      "CODE_INTEL_LIST_FILES_DEFAULT_LIMIT",
      codeIntel.listFilesDefaultLimit,
      CODE_INTEL_LIST_FILES_DEFAULT_LIMIT,
    ),
    CODE_INTEL_LIST_FILES_MAX_LIMIT: numberInput(
      "CODE_INTEL_LIST_FILES_MAX_LIMIT",
      codeIntel.listFilesMaxLimit,
      CODE_INTEL_LIST_FILES_MAX_LIMIT,
    ),
    CODE_INTEL_EXTRACTION_BATCH_SIZE: numberInput(
      "CODE_INTEL_EXTRACTION_BATCH_SIZE",
      codeIntel.extractionBatchSize,
      CODE_INTEL_EXTRACTION_BATCH_SIZE,
    ),
    CODE_INTEL_MAX_FILE_SIZE_BYTES: numberInput(
      "CODE_INTEL_MAX_FILE_SIZE_BYTES",
      codeIntel.maxFileSizeBytes,
      CODE_INTEL_MAX_FILE_SIZE_BYTES,
    ),
  };

  // Presence only. The SQLite path and every binding identifier are never read into the inputs.
  const availabilityInputs: Record<string, AvailabilityInput> = {
    "availability.sqliteLocation": canUseSqlite()
      ? { available: true }
      : {
          available: false,
          reason: sqliteEnabled
            ? "not_supported_here"
            : "disabled_by_configuration",
        },
    "availability.codeIntelDatabase": availability(canUseD1(), "no_binding"),
    "availability.snapshotStorage": availability(canUseR2(), "no_binding"),
    "availability.snapshotQueue": availability(
      queueAvailable(getSnapshotQueue),
      "no_binding",
    ),
    "availability.symbolQueue": availability(
      queueAvailable(getSymbolQueue),
      "no_binding",
    ),
  };

  // Each secret is reduced to a boolean inside its own expression and never kept.
  const secrets: Record<string, boolean> = {};
  for (const def of SETTING_REGISTRY) {
    if (def.category !== "C") continue;
    secrets[def.id] =
      def.id === "GITHUB_TOKEN"
        ? Boolean(getGitHubToken())
        : Boolean(process.env[def.envName]);
  }

  return { values, availability: availabilityInputs, secrets };
}

export function getConfigurationView(now?: Date): ConfigurationResponse {
  return buildConfiguration(
    SETTING_REGISTRY,
    collectConfigurationInputs(),
    now,
  );
}
