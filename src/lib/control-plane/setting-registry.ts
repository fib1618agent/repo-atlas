import { PREFERENCE_DEFAULTS } from "./preferences";

/**
 * Allowlist of everything the Settings view may show. Names, labels and rules
 * only: it holds no values and reads no env, storage or bindings, so it is safe
 * to ship to the browser. Anything not listed here is never displayed.
 */

export type SettingCategory = "A" | "B" | "C" | "D";
export type DisplayForm = "value" | "status" | "availability";
export type ChangeMechanism = "guest" | "deployment-config" | "none";

/** Closed set of fixed reasons; never carries Error.message. */
export type ReasonCode =
  | "no_binding"
  | "disabled_by_configuration"
  | "not_supported_here"
  | "query_failed";

interface BaseDefinition {
  id: string;
  label: string;
  /** Environment variable name, when the item is backed by one. */
  envName?: string;
  /** Human-readable validity rule. */
  validity?: string;
  /** true only for variables delivered to the browser by design. */
  clientVisible: boolean;
}

/** Category A: personal, browser-local preference. */
export interface PreferenceDefinition extends BaseDefinition {
  category: "A";
  display: "value";
  changeMechanism: "guest";
  default: boolean;
  clientVisible: false;
}

/** Category B value: operator/deployment configuration, read-only here. */
export interface ValueDefinition extends BaseDefinition {
  category: "B";
  display: "value";
  changeMechanism: "deployment-config";
}

/** Category B availability: sensitive non-secret; presence only, never the value. */
export interface AvailabilityDefinition extends BaseDefinition {
  category: "B";
  display: "availability";
  changeMechanism: "deployment-config";
  clientVisible: false;
}

/** Category C: secret; configured/not configured only. Structurally has no default or value. */
export interface SecretDefinition extends BaseDefinition {
  category: "C";
  display: "status";
  changeMechanism: "deployment-config";
  clientVisible: false;
  envName: string;
  degradesWhenMissing: string;
}

export type SettingDefinition =
  | PreferenceDefinition
  | ValueDefinition
  | AvailabilityDefinition
  | SecretDefinition;

const pref = (
  id: "autoRotate" | "showRelationships",
  label: string,
): PreferenceDefinition => ({
  id: `pref.${id}`,
  label,
  category: "A",
  display: "value",
  changeMechanism: "guest",
  default: PREFERENCE_DEFAULTS[id],
  validity: "boolean",
  clientVisible: false,
});

const value = (
  envName: string,
  label: string,
  validity: string,
  clientVisible = false,
): ValueDefinition => ({
  id: envName,
  label,
  category: "B",
  display: "value",
  changeMechanism: "deployment-config",
  envName,
  validity,
  clientVisible,
});

const availability = (id: string, label: string): AvailabilityDefinition => ({
  id,
  label,
  category: "B",
  display: "availability",
  changeMechanism: "deployment-config",
  clientVisible: false,
});

const secret = (
  envName: string,
  label: string,
  degradesWhenMissing: string,
): SecretDefinition => ({
  id: envName,
  label,
  category: "C",
  display: "status",
  changeMechanism: "deployment-config",
  clientVisible: false,
  envName,
  degradesWhenMissing,
});

const NUMBER_RULE = "finite number";
const POSITIVE_RULE = "finite number ≥ 1";

export const SETTING_REGISTRY: readonly SettingDefinition[] = [
  // A — personal preferences
  pref("autoRotate", "Auto-rotate atlas"),
  pref("showRelationships", "Show relationships"),

  // B — operator/deployment configuration (value)
  value("ATLAS_DEFAULT_OWNER", "Default owner", "GitHub login"),
  value("ATLAS_MAX_SOURCES", "Max sources", POSITIVE_RULE),
  value("ATLAS_MAX_SPIRAL_REPOS", "Max spiral repositories", POSITIVE_RULE),
  value("ATLAS_MAX_STORED_REPOS", "Max stored repositories", POSITIVE_RULE),
  value("ATLAS_CACHE_TTL_MS", "Cache TTL (ms)", NUMBER_RULE),
  value(
    "ATLAS_LOAD_INITIAL_SOURCES",
    "Load initial sources",
    'boolean ("false" disables)',
  ),
  value(
    "ATLAS_INITIAL_SOURCES",
    "Initial sources",
    "JSON array of {type, owner}",
  ),
  value(
    "ATLAS_SQLITE_ENABLED",
    "SQLite cache enabled",
    'boolean ("false" disables)',
  ),
  value(
    "ATLAS_AI_PROVIDER",
    "AI provider",
    "gemini | openai | anthropic | grok",
  ),
  value("VITE_SITE_URL", "Site URL", "URL", true),
  value("CODE_INTEL_MAX_R2_CONCURRENCY", "Max R2 concurrency", POSITIVE_RULE),
  value(
    "CODE_INTEL_CHECKPOINT_FILE_COUNT",
    "Checkpoint file count",
    POSITIVE_RULE,
  ),
  value(
    "CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET",
    "Checkpoint CPU budget (ms)",
    POSITIVE_RULE,
  ),
  value("CODE_INTEL_QUEUE_BATCH_SIZE", "Queue batch size", POSITIVE_RULE),
  value("CODE_INTEL_MAX_RETRY_ATTEMPTS", "Max retry attempts", POSITIVE_RULE),
  value(
    "CODE_INTEL_LIST_FILES_DEFAULT_LIMIT",
    "List-files default limit",
    POSITIVE_RULE,
  ),
  value(
    "CODE_INTEL_LIST_FILES_MAX_LIMIT",
    "List-files max limit",
    POSITIVE_RULE,
  ),
  value(
    "CODE_INTEL_EXTRACTION_BATCH_SIZE",
    "Extraction batch size",
    POSITIVE_RULE,
  ),
  value(
    "CODE_INTEL_MAX_FILE_SIZE_BYTES",
    "Max file size (bytes)",
    POSITIVE_RULE,
  ),

  // B — sensitive non-secret: availability only, never the path/identifier
  availability("availability.sqliteLocation", "SQLite database location"),
  availability("availability.codeIntelDatabase", "Code-intelligence database"),
  availability("availability.snapshotStorage", "Snapshot storage"),
  availability("availability.snapshotQueue", "Snapshot queue"),
  availability("availability.symbolQueue", "Symbol queue"),

  // C — secrets: configured / not configured only
  secret(
    "GITHUB_TOKEN",
    "GitHub token",
    "GitHub requests use the lower unauthenticated rate limit",
  ),
  secret(
    "GEMINI_API_KEY",
    "Gemini API key",
    "AI summaries fall back to metadata-only",
  ),
  secret(
    "OPENAI_API_KEY",
    "OpenAI API key",
    "AI summaries fall back to metadata-only",
  ),
  secret(
    "ANTHROPIC_API_KEY",
    "Anthropic API key",
    "AI summaries fall back to metadata-only",
  ),
  secret(
    "XAI_API_KEY",
    "xAI API key",
    "AI summaries fall back to metadata-only",
  ),
];
