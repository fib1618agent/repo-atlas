# Data Model: Settings / Control Plane

**Feature**: 006-settings-control-plane · **Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

Logical model only. There is **no database schema change** and no new table. The only persisted data is one browser-local record of category-A preferences (FR-009, FR-011). Field names are the design contract for the plan; TypeScript spellings are finalized at implementation.

## Setting Definition (registry entry; static, isomorphic, contains no values)

Spec entity: *Setting Definition*. One entry per visible item; the registry is the **allowlist** (R3). It holds names and rules, never live values.

| Field | Meaning | Spec basis |
|---|---|---|
| `id` | Stable identifier (for example `ATLAS_MAX_SOURCES`, `pref.autoRotate`) | FR-001 |
| `label` | Human name shown in the view | FR-005 |
| `category` | `A` \| `B` \| `C` \| `D` | FR-001, Classification |
| `display` | `value` \| `status` \| `availability` | FR-012, SEC-001, SEC-007 |
| `default` | Default (for A and B value items); absent for C/availability | FR-003 |
| `validity` | Rule (for example "finite number ≥ 1", "boolean") | FR-003, FR-013 |
| `changeMechanism` | `guest` (A) \| `deployment-config` (B, C) \| `none` (D) | FR-002, FR-003 |
| `clientVisible` | true only for variables delivered to the browser by design | SEC-008 |
| `degradesWhenMissing` | For C: which capability degrades (for example "AI summaries fall back to metadata-only") | US1 scenario 2 |

**Invariants (asserted by tests):** every entry has exactly one category (FR-001); `category = C` ⇒ `display = status` and `clientVisible = false`; sensitive non-secret entries (SEC-007) ⇒ `display = availability`; any `VITE_*` name ⇒ `clientVisible = true` and `category ≠ C`; only `A` entries have `changeMechanism = guest`; no entry other than `A` is writable by this feature (FR-002, SEC-002).

### Registry contents (initial; classification per spec inventory)

| Id / group | Cat | Display | Notes |
|---|---|---|---|
| `pref.autoRotate`, `pref.showRelationships` | A | value | Defaults `true`, `true`; from the atlas store (client) |
| `ATLAS_DEFAULT_OWNER` | B | value | Effective via `serverAtlasConfig()` |
| `ATLAS_MAX_SOURCES`, `ATLAS_MAX_SPIRAL_REPOS`, `ATLAS_MAX_STORED_REPOS`, `ATLAS_CACHE_TTL_MS` | B | value | Numeric; non-finite result ⇒ `state: invalid` (Invalid / unavailable), default shown as information only |
| `ATLAS_LOAD_INITIAL_SOURCES` | B | value | Boolean |
| `ATLAS_INITIAL_SOURCES` | B | value | Shown as the parsed list of `{type, owner}` entries (public GitHub logins, non-secret) |
| `ATLAS_SQLITE_ENABLED` | B | value | Boolean-ish; effective SQLite availability via `canUseSqlite()` |
| SQLite database location (`ATLAS_SQLITE_PATH`) | B | availability | **Sensitive non-secret (SEC-007)**: never the path |
| `ATLAS_AI_PROVIDER` | B | value | Value actually used by existing behavior (existing code falls back to the default provider for an unrecognized name) with `flag: unrecognized` |
| `VITE_SITE_URL` | B | value | **Client-visible**, non-secret, currently unused by code |
| `CODE_INTEL_*` (F001/F002 tunables only) | B | value | Read-only; no Cloudflare limit claim. `CODE_INTEL_RELATIONSHIP_*` are excluded (Feature 004 is not a dependency) |
| Code-intelligence database, snapshot storage, queues | B | availability | **Sensitive non-secret (SEC-007)**: presence only via `canUseD1()`, `canUseR2()`, binding presence; never database id, bucket or queue names |
| `GITHUB_TOKEN`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY` | C | status | configured / not configured only |
| Code-intelligence status | D | (separate view) | Read-only; see Operational Status |

## Effective Configuration (server-built DTO; category B and C only)

Spec entity: *Effective Configuration*. Built per request by the read model from the registry, `serverAtlasConfig()`, `codeIntelConfig()` and availability helpers. It is a discriminated union so a value cannot be attached to the wrong kind:

- **ValueItem**: one of three states.
  - valid `{ id, label, category: "B", display: "value", state: "valid", value, default?, isDefault, clientVisible, flag?: "unrecognized" }`: a configured value that is effective.
  - unset `{ id, label, category: "B", display: "value", state: "unset", value?, default?, isDefault: true, clientVisible }`: nothing is configured. `value` (and `default`) is present only where existing behavior has a real default, and is then that default; where none exists the field is absent and the UI shows "Not set".
  - invalid `{ id, label, category: "B", display: "value", state: "invalid", default?, clientVisible }` (shown as **Invalid / unavailable**: no `value` field, no `isDefault`).

  `default` is present only where an actual default exists and, for an invalid item, is informational only.
- **SecretStatusItem** (spec entity *Secret Status*): `{ id, label, category: "C", display: "status", status: "configured" | "not_configured", degradesWhenMissing }` — **no value field**
- **AvailabilityItem**: `{ id, label, category: "B", display: "availability", availability: "available" | "unavailable" | "enabled" | "disabled", reason?: ReasonCode }` — **no value field**

`ReasonCode` is a closed set of fixed strings (for example `no_binding`, `disabled_by_configuration`, `not_supported_here`); it never carries `Error.message`.

`unset` means the allowlisted variable is not present in the environment. `invalid` means the configured value cannot be parsed into a usable value (for a numeric item: the existing configuration function yields a non-finite number). The read model neither repairs it nor substitutes a fallback the existing behavior does not apply (spec FR-013). `flag: "unrecognized"` is used only where existing behavior applies its own defined fallback (for example an unrecognized AI provider), and then `value` is the value actually used.

The response envelope is `{ generatedAt, items: (ValueItem | SecretStatusItem | AvailabilityItem)[] }`. Category-A items are **not** in this envelope; the client merges them from the preference store using the same registry definitions, so every displayed row carries its category (FR-005, SC-001).

## Preference Set (browser-local; the only persisted state)

Spec entity: *Preference Set*.

| Field | Type | Default | Validity |
|---|---|---|---|
| `autoRotate` | boolean | `true` | must be boolean; otherwise the default |
| `showRelationships` | boolean | `true` | must be boolean; otherwise the default |

- **Storage**: one browser `localStorage` entry, key `repoatlas.preferences.v1`, JSON `{ "autoRotate": boolean, "showRelationships": boolean }`. Unknown keys are ignored; missing/invalid items fall back **per item** (FR-009); a malformed record falls back entirely to defaults; nothing throws.
- **Lifecycle**: read once at store creation; written only when one of the two fields changes; `resetPreferences()` writes the defaults; unavailable storage ⇒ session-only (FR-010).
- **Not persisted here**: category/language/topic filters, selection, hover (transient interaction state, explicitly not settings); the source set (`repoatlas.sources.v1`, Feature 003).
- **State transitions**: `default → changed → (reload: remembered) → reset → default`. No other states.

## Operational Status (server-built DTO; category D, read-only)

Spec entity: *Operational Status*.

```text
{
  available: boolean,
  reason?: ReasonCode,                 // present when available = false
  symbolExtractorVersion: string,      // SYMBOL_EXTRACTOR_VERSION
  snapshots?: { total, pending, in_progress, completed, failed },
  extractions?: { total, in_progress, completed, completed_partial, failed }
}
```

- Sources: `SELECT status, COUNT(*) FROM snapshots GROUP BY status` and the same for `snapshot_extractions`; counts only.
- When `available = false`, `snapshots`/`extractions` are absent. When available but both tables are empty, all counts are `0` and the UI shows "No code-intelligence data" (US3 scenario 1/2, FR-014: nothing fabricated).
- No repository owner/name, commit, path or identifier appears in this DTO.

## Relationships and ownership

- Registry (static) → drives Effective Configuration (server), the Preference Set defaults (client) and the view's category labels.
- Operational Status is independent of the registry values; it only reads F001/F002 tables that already exist.
- Nothing here writes to F001/F002 tables, the source set, or any deployment configuration.
