export const PREFERENCE_KEYS = ["autoRotate", "showRelationships"] as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];
export type Preferences = Record<PreferenceKey, boolean>;

export const PREFERENCE_DEFAULTS: Preferences = {
  autoRotate: true,
  showRelationships: true,
};

export const PREFERENCES_STORAGE_KEY = "repoatlas.preferences.v1";

/** Keep valid booleans per key, default the rest, ignore unknown keys. Never throws. */
export function sanitizePreferences(raw: unknown): Preferences {
  const record =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out = { ...PREFERENCE_DEFAULTS };
  for (const key of PREFERENCE_KEYS) {
    const value = record[key];
    if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

/* ── Guarded browser storage (category A only, browser-local) ───────────── */

/** The slice of the Web Storage API used here. */
export type PreferenceStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

let storageOverride: PreferenceStorage | undefined;

/** Test seam (same idea as `setTestCloudflareEnv`): inject a storage, or `undefined` to use the browser's. */
export function configurePreferenceStorage(
  storage: PreferenceStorage | undefined,
): void {
  storageOverride = storage;
}

/** Resolved lazily, never at import time. Undefined when there is no usable storage (SSR, tests, blocked). */
function resolveStorage(): PreferenceStorage | undefined {
  if (storageOverride) return storageOverride;
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined; // access itself can throw (blocked site data)
  }
}

/** Stored preferences, or defaults when storage is missing, throws, or holds malformed data. Never throws. */
export function readStoredPreferences(): Preferences {
  try {
    const raw = resolveStorage()?.getItem(PREFERENCES_STORAGE_KEY);
    return sanitizePreferences(raw ? JSON.parse(raw) : undefined);
  } catch {
    return sanitizePreferences(undefined);
  }
}

/** Returns whether the write succeeded. Never throws; a failure just means "session-only". */
export function writeStoredPreferences(preferences: Preferences): boolean {
  try {
    const storage = resolveStorage();
    if (!storage) return false;
    const { autoRotate, showRelationships } = preferences;
    storage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ autoRotate, showRelationships }),
    );
    return true;
  } catch {
    return false;
  }
}

/** True when a write can succeed right now. Uses a throwaway key, never the preferences record. */
export function probePreferenceStorage(): boolean {
  try {
    const storage = resolveStorage();
    if (!storage) return false;
    const key = `${PREFERENCES_STORAGE_KEY}.probe`;
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
