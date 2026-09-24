/** Shared atlas limits — safe on client and server (no secrets). */
export const ATLAS_DEFAULT_OWNER = "imdadareeph";
export const ATLAS_MAX_SOURCES = 5;
export const ATLAS_MAX_SPIRAL_REPOS = 800;
export const ATLAS_MAX_STORED_REPOS = 2000;
export const ATLAS_CACHE_TTL_MS = 900_000;
export const ATLAS_LOAD_INITIAL_SOURCES = true;

/**
 * Startup source configuration (data-model.md StartupSourceConfig, Feature 003
 * US5). Only "github" is parsed today — an unrecognized `type` in a
 * hand-edited `ATLAS_INITIAL_SOURCES` value is skipped, not a crash (spec
 * Edge Cases). Consumed by repositories.functions.ts's existing default-path
 * branch (T020), not by this file.
 */
export type InitialSourceEntry = { type: "github"; owner: string };

function defaultInitialSources(): InitialSourceEntry[] {
  return [{ type: "github", owner: process.env["ATLAS_DEFAULT_OWNER"] ?? ATLAS_DEFAULT_OWNER }];
}

function parseInitialSources(raw: string | undefined): InitialSourceEntry[] {
  if (!raw) return defaultInitialSources();

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return defaultInitialSources();
  }
  if (!Array.isArray(value)) return defaultInitialSources();

  const entries: InitialSourceEntry[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      (item as Record<string, unknown>)["type"] === "github" &&
      typeof (item as Record<string, unknown>)["owner"] === "string"
    ) {
      entries.push({ type: "github", owner: (item as Record<string, unknown>)["owner"] as string });
    }
    // unrecognized type or malformed entry — skipped, not a crash
  }
  return entries;
}

/**
 * Vercel env UI often leaves keys present with empty values; `Number("")` is 0 and
 * would truncate the catalogue to zero repos. Invalid non-numeric strings stay NaN
 * so Settings can still flag misconfiguration.
 */
function envPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return Number.NaN;
  if (n < 1) return fallback;
  return Math.floor(n);
}

export function serverAtlasConfig() {
  return {
    defaultOwner: process.env["ATLAS_DEFAULT_OWNER"] ?? ATLAS_DEFAULT_OWNER,
    maxSources: envPositiveInt(process.env["ATLAS_MAX_SOURCES"], ATLAS_MAX_SOURCES),
    maxSpiralRepos: envPositiveInt(
      process.env["ATLAS_MAX_SPIRAL_REPOS"],
      ATLAS_MAX_SPIRAL_REPOS,
    ),
    maxStoredRepos: envPositiveInt(
      process.env["ATLAS_MAX_STORED_REPOS"],
      ATLAS_MAX_STORED_REPOS,
    ),
    cacheTtlMs: envPositiveInt(process.env["ATLAS_CACHE_TTL_MS"], ATLAS_CACHE_TTL_MS),
    loadInitialSources: process.env["ATLAS_LOAD_INITIAL_SOURCES"] !== "false",
    initialSources: parseInitialSources(process.env["ATLAS_INITIAL_SOURCES"]),
  };
}
