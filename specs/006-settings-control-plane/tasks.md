# Tasks: Settings / Control Plane

**Input**: Design documents from `specs/006-settings-control-plane/`

**Prerequisites**: plan.md, spec.md (clarified; A1/A2 finalized), research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included. The user requested explicit test coverage (registry, redaction, sentinel values, persistence, status, boundaries), and the spec's SC-002/SC-004/SC-005 require executable verification. Runner: `bun test --isolate` (existing).

**Organization**: One phase per user story after a small foundation. US1 is the MVP. US2 and US3 are independent of each other; both mount into the `/settings` route created in US1.

**Format**: `- [ ] T### [P?] [US?] Description with file path`, followed by indented detail lines: `Requirements` (exact spec IDs), `Depends` (task IDs only), `Security/boundary`, `Verify`. **[P]** = different files and no dependency on an incomplete task.

## Ground rules for every task

- **Local-first**: no Cloudflare, Wrangler, deployment, live experiment, remote D1/R2/Queues, or GitNexus (FR-016, SC-005).
- **Do not modify**: `serverAtlasConfig()` / `codeIntelConfig()` or any F001–F005 configuration behavior; F001/F002/F003/F004/F005/F007 files; `docs/ROADMAP.md`; `.env.example`; `sources-store.ts`, `SourcesDialog`, `SourcesMenu`, `ConnectedSourcesDialog`; the uncommitted Query-cache experiment files. The read model **reports** configuration; it does not repair it (A1).
- **Config semantics** (finalized): valid → the value actually used; unset → the actual default where one exists (otherwise "Not set"); unparseable numeric → **Invalid / unavailable**, no value, no fabricated fallback; existing defined fallback (for example unrecognized AI provider) → the value actually used plus an "unrecognized" flag.
- **Deferred (no tasks exist for these)**: US4 operator/deployment configuration editing and persistence; runtime mutation (start, pause, retry, clear/reset processing, any indexing/extraction mutation); authentication, roles, RBAC, user management; MCP; CLI.
- **No dependency** on Features 004/005 (`CODE_INTEL_RELATIONSHIP_*` and `RELATIONSHIP_EXTRACTOR_VERSION` are never displayed) and none on Feature 007.
- Reporting per `CLAUDE.md` (PROGRESS, handoff, prompt log) is handled once in T030; `docs/ROADMAP.md` stays untouched until the user authorizes it.

---

## Phase 1: Setup

- [ ] T001 Establish the baseline: run `bunx tsc --noEmit`, `bun test`, and `bun run lint` at the repository root and record which (if any) already fail before Feature 006 changes. Do not fix pre-existing failures and do not touch the uncommitted Query-cache experiment files (`src/lib/code-intel/symbols/to-intermediate-representation.ts`, its contract test, `scripts/query-cold-start-experiment.ts`).
  - Requirements: FR-016, SC-005 (local-only gates)
  - Depends: none
  - Verify: the pre-existing result of each gate is written in the task report so later regressions are attributable.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: the shared vocabulary (catalog code, preference constants, registry) that every story uses. No UI, no server function.

- [ ] T002 [P] Add the catalog code `SETTINGS_UNAVAILABLE` to `AtlasErrorCode` and `ERROR_MESSAGES` in `src/lib/atlas-errors.ts` with a fixed message that has **no placeholders** and no internal detail (for example "Settings could not be loaded. Try again."). Change nothing else in that file.
  - Requirements: FR-008, SEC-006
  - Depends: none
  - Security/boundary: the message must never interpolate `Error.message`, paths, or env values.
  - Verify: `bunx tsc --noEmit` passes (the `Record<AtlasErrorCode, string>` forces the message entry); existing tests unaffected.

- [ ] T003 Create `src/lib/control-plane/preferences.ts` (pure, isomorphic part only): `PREFERENCE_KEYS` (`autoRotate`, `showRelationships`), `PREFERENCE_DEFAULTS` (`{ autoRotate: true, showRelationships: true }`, matching the current `atlas-store.ts` initial values), `PREFERENCES_STORAGE_KEY = "repoatlas.preferences.v1"`, the `Preferences` type, and `sanitizePreferences(raw: unknown): Preferences` (each key must be a boolean else its default; unknown keys ignored; non-object/malformed input → all defaults; never throws). No `window`/storage access in this task.
  - Requirements: FR-003, FR-009, FR-007 (validation of stored data)
  - Depends: none
  - Security/boundary: category A only; nothing here reads `process.env` or any server module.
  - Verify: covered by T005; `bunx tsc --noEmit` passes.

- [ ] T004 Create `src/lib/control-plane/setting-registry.ts` (pure, isomorphic, **no values, no env or process reads**): types `SettingCategory` (`A`|`B`|`C`|`D`), `DisplayForm` (`value`|`status`|`availability`), `SettingDefinition` (`id`, `label`, `category`, `display`, `changeMechanism` `guest`|`deployment-config`|`none`, `clientVisible`, optional `envName`, optional `validity` rule text, optional `degradesWhenMissing` for C; `default` supplied here **only for category A** from `PREFERENCE_DEFAULTS`, category-B defaults are resolved server-side in T008 from existing exported constants) and the exported `SETTING_REGISTRY` allowlist with the entries listed in data-model.md "Registry contents": A `pref.autoRotate`, `pref.showRelationships`; B values `ATLAS_DEFAULT_OWNER`, `ATLAS_MAX_SOURCES`, `ATLAS_MAX_SPIRAL_REPOS`, `ATLAS_MAX_STORED_REPOS`, `ATLAS_CACHE_TTL_MS`, `ATLAS_LOAD_INITIAL_SOURCES`, `ATLAS_INITIAL_SOURCES`, `ATLAS_SQLITE_ENABLED`, `ATLAS_AI_PROVIDER`, `VITE_SITE_URL` (`clientVisible: true`), and the F001/F002 `CODE_INTEL_*` tunables only (`CODE_INTEL_MAX_R2_CONCURRENCY`, `CODE_INTEL_CHECKPOINT_FILE_COUNT`, `CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET`, `CODE_INTEL_QUEUE_BATCH_SIZE`, `CODE_INTEL_MAX_RETRY_ATTEMPTS`, `CODE_INTEL_LIST_FILES_DEFAULT_LIMIT`, `CODE_INTEL_LIST_FILES_MAX_LIMIT`, `CODE_INTEL_EXTRACTION_BATCH_SIZE`, `CODE_INTEL_MAX_FILE_SIZE_BYTES`); B availability entries for the SQLite database location, the code-intelligence database, snapshot storage, and the snapshot/symbol queues (**display = availability only**); C status entries `GITHUB_TOKEN`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY` (**display = status only**, `clientVisible: false`, with `degradesWhenMissing` text). Exclude `CODE_INTEL_RELATIONSHIP_*`. Export a small `ReasonCode` closed union (`no_binding` | `disabled_by_configuration` | `not_supported_here` | `query_failed`) used by later tasks.
  - Requirements: FR-001, FR-002, FR-003, SEC-002, SEC-003, SEC-007, SEC-008, SC-001
  - Depends: T003
  - Security/boundary: the registry is the allowlist; nothing outside it may ever be shown. It ships to the client, so it contains only names, labels and rules, never a value.
  - Verify: covered by T006.

- [ ] T005 [P] Write `tests/unit/control-plane/preferences.test.ts` for `sanitizePreferences`: valid input kept; each non-boolean item falls back to **its own** default while valid siblings are kept; unknown keys ignored; `null`, arrays, strings, numbers and non-object JSON yield all defaults; never throws.
  - Requirements: FR-009, FR-007, SC-004 (bad stored data does not break the page)
  - Depends: T003
  - Verify: `bun test tests/unit/control-plane/preferences.test.ts` passes.

- [ ] T006 [P] Write `tests/unit/control-plane/setting-registry.test.ts` asserting the registry invariants from data-model.md: every id unique and exactly one category; `C` ⇒ `display = status` and `clientVisible = false`; every availability-type sensitive item (SQLite location, database, storage, queues) ⇒ `display = availability`; any `VITE_*` id ⇒ `clientVisible = true` and category ≠ `C`; only category `A` has `changeMechanism = guest`; no `B`/`C`/`D` entry is writable; no `CODE_INTEL_RELATIONSHIP_*` and no relationship-version entry; **drift checks against `.env.example`** (read the file): every `VITE_*` name it declares is registered as client-visible non-secret, and every declared name ending in `_API_KEY` plus `GITHUB_TOKEN` is registered as category C.
  - Requirements: FR-001, FR-002, SEC-002, SEC-003, SEC-007, SEC-008, SC-001
  - Depends: T004
  - Verify: `bun test tests/unit/control-plane/setting-registry.test.ts` passes; the test fails if a secret is marked client-visible (prove by temporarily flipping in a local scratch copy, do not commit).

**Checkpoint**: shared vocabulary in place; `bunx tsc --noEmit` and the two test files pass.

---

## Phase 3: User Story 1 — Read-only configuration view (Priority: P1) 🎯 MVP

**Goal**: the Guest/developer opens `/settings` and sees every item with category, effective value/status/availability, default marker, client-visible marking and honest invalid state, with structural secret redaction.

**Independent Test**: start the app locally with a mix of set/unset/invalid values and a configured secret; every row shows category and state; no secret or sensitive value appears in the page, its data, or network responses; broken values show Invalid / unavailable; the page loads.

- [ ] T007 [US1] Create `src/lib/control-plane/configuration-read-model.ts` (types + pure builder). Define the discriminated `ConfigurationItem` union exactly as data-model.md: `ValueItem` (states `valid` | `unset` | `invalid`; `valid`/`unset` carry `value` (for `unset`: the actual default, else absent so the UI shows "Not set") and `isDefault`; `invalid` carries **no `value` and no `isDefault`**; optional informational `default` only where a real default exists; `clientVisible`; optional `flag: "unrecognized"`), `SecretStatusItem` (`status: "configured" | "not_configured"`, `degradesWhenMissing`, **no value field**), `AvailabilityItem` (`availability`, optional `reason: ReasonCode`, **no value field**), and `ConfigurationResponse` `{ generatedAt, items }`. Implement `buildConfiguration(registry, inputs)` as a **pure function** over an injected `ConfigurationInputs` (already-computed effective values, presence booleans, availability booleans, secret-configured booleans) that emits items **only for registry entries** (allowlist), maps each display form to its DTO shape, and classifies a non-finite number as `invalid`. Category-A entries are not emitted here (the client merges them).
  - Requirements: FR-005, FR-008, FR-012, FR-013, FR-017, SEC-001, SEC-007, SEC-008
  - Depends: T004
  - Security/boundary: structural redaction: the DTO types for `C` and sensitive availability items have no value field, so a leak needs a type-breaking change. Keep server-only imports out of this file so it can be `import type`-d by client code.
  - Verify: `bunx tsc --noEmit`; behavior covered by T010/T011.

- [ ] T008 [US1] In the same module directory add the server-side input collection, `collectConfigurationInputs()` in `src/lib/control-plane/configuration-read-model.ts` (or a sibling server-only file if a client-import boundary requires it; the client must not import it), and export `getConfigurationView()` = `buildConfiguration(SETTING_REGISTRY, collectConfigurationInputs())`. Collection rules, all **without modifying** existing code: effective B values from `serverAtlasConfig()` and `codeIntelConfig()`; B defaults from the **existing exported constants** (`ATLAS_MAX_SOURCES`, `ATLAS_CACHE_TTL_MS`, `CODE_INTEL_*`, etc., no duplicated literals); "unset" detected by presence of the allowlisted env name only; `ATLAS_LOAD_INITIAL_SOURCES` and `ATLAS_SQLITE_ENABLED` shown as the boolean the existing logic applies; `ATLAS_INITIAL_SOURCES` shown as the parsed list actually used (`serverAtlasConfig().initialSources`) with `flag: "unrecognized"` when the raw value is defined but not a JSON array or some entries were skipped; `ATLAS_AI_PROVIDER` = `getActiveProvider()` from `src/lib/ai/providers.ts` with `flag: "unrecognized"` when the raw env value is defined and differs from the returned provider; `VITE_SITE_URL` read on the server as a plain value (non-secret, client-visible); availability from `canUseSqlite()`, `canUseD1()`, `canUseR2()`, and queue-binding presence from `getCloudflareEnv()`; secret status as `Boolean(...)` of the value (`getGitHubToken()` for `GITHUB_TOKEN`, the allowlisted env names for the rest) and **the secret string is never stored in a variable that outlives that expression or placed in the inputs object**; SQLite path and all binding identifiers are never read into the inputs.
  - Requirements: FR-005, FR-012, FR-013, FR-017, FR-018, SEC-001, SEC-003, SEC-007, SEC-008
  - Depends: T007
  - Security/boundary: server-only module; never enumerate `process.env`; never pass a secret, path or identifier into the DTO.
  - Verify: covered by T010/T011; `bunx tsc --noEmit`.

- [ ] T009 [US1] Create `src/lib/control-plane/control-plane.functions.ts` following the repository pattern (exported plain handler + `createServerFn` wrapper, as in `src/lib/repositories.functions.ts`): `getConfigurationHandler()` and `getConfiguration = createServerFn({ method: "POST" }).validator(() => undefined).handler(() => getConfigurationHandler())`. The handler wraps `getConfigurationView()` in `try/catch`; on failure it logs a **sanitized** server-side message (no `Error.message`, path, stack or env value) and throws the serialized catalog error `SETTINGS_UNAVAILABLE` (use the existing `AtlasError`/serialize helpers from `src/lib/atlas-errors.ts`). No input is accepted or used.
  - Requirements: FR-008, FR-012, SEC-004, SEC-005, SEC-006
  - Depends: T002, T008
  - Security/boundary: no authentication; the response must be safe for any caller. This file is the only server boundary added in the US1 phase; UI code imports only the wrapper and types.
  - Verify: covered by T011; `bunx tsc --noEmit`.

- [ ] T010 [P] [US1] Write `tests/unit/control-plane/configuration-read-model.test.ts` (env save/restore pattern from `tests/unit/atlas-config.test.ts`) covering **effective-value semantics**: valid numerics reported with `isDefault` correct; unset numerics report the actual default (`unset`); `ATLAS_MAX_SOURCES=abc` → `state: "invalid"` with **no value and no default presented as in effect**, and assert `serverAtlasConfig().maxSources` is still `NaN` (proving existing behavior was not altered); unset `VITE_SITE_URL` (no default) → "Not set"; `ATLAS_AI_PROVIDER=nope` → value `gemini` with `flag: "unrecognized"`; `ATLAS_INITIAL_SOURCES` with invalid JSON and with skipped entries → flag; `ATLAS_LOAD_INITIAL_SOURCES=false` handled; category-A entries absent from the server response; only registry ids appear (set an unlisted `SENTINEL_UNLISTED_VAR` and assert it is absent); handler never throws for broken configuration; `VITE_SITE_URL` item has `clientVisible: true`.
  - Requirements: FR-005, FR-008, FR-012, FR-013, SEC-008, SC-004
  - Depends: T008
  - Verify: `bun test tests/unit/control-plane/configuration-read-model.test.ts` passes.

- [ ] T011 [P] [US1] Write `tests/unit/control-plane/configuration-redaction.test.ts` — the **sentinel-value security tests**: set a unique sentinel string for every category-C variable (`GITHUB_TOKEN`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`), for `ATLAS_SQLITE_PATH`, and inject sentinel identifiers for database, bucket and queue bindings via `setTestCloudflareEnv`; call `getConfigurationHandler()`, `JSON.stringify` the result and assert **no sentinel appears anywhere**; assert each C item has exactly the keys of `SecretStatusItem` (no value-bearing key) and status `configured`/`not_configured` correctly; assert availability items carry no value field; force a failure path (for example a registry/input stub that throws a message containing a sentinel) and assert the thrown/serialized error equals the fixed `SETTINGS_UNAVAILABLE` text and contains no sentinel; assert the handler ignores supplied input (call with a payload containing a sentinel; result identical to no input).
  - Requirements: SEC-001, SEC-003, SEC-004, SEC-005, SEC-006, SEC-007, SC-002
  - Depends: T009
  - Verify: `bun test tests/unit/control-plane/configuration-redaction.test.ts` passes.

- [ ] T012 [US1] Create `src/components/settings/ConfigurationSection.tsx`: `useQuery` + `useServerFn(getConfiguration)` (pattern from `src/lib/use-atlas-repositories.ts`), renders one row per item using existing `ui/badge`, `ui/card`/`table`, `ui/skeleton`, `ui/alert`, `ui/button`: category badge (A–D); value, or "configured"/"not configured" with the degradation note, or availability with an **"Unavailable" badge that is not styled as an error**; "default" marker; **"client-visible" badge**; **"Invalid / unavailable"** text in place of a value with the default shown as information only; "unrecognized configured value" flag; "Not set" for unset no-default items. Merge category-A rows (from the registry definitions and current `useAtlasStore` values) into the same list so every row has a category. States: loading = Skeleton; failure = Alert with the catalog message and a **Retry** button (refetch). Import from `configuration-read-model.ts` using **type-only** imports; import no server-only module and read no `process.env`. Read-only: no input or edit control for any B/C/D item.
  - Requirements: FR-001, FR-005, FR-008, FR-013, FR-017, FR-018, SEC-002, SEC-008, SC-001, NFR-004
  - Depends: T004, T007, T009
  - Security/boundary: client code only; never renders anything not present in the DTO.
  - Verify: `bunx tsc --noEmit`; manual check in T028.

- [ ] T013 [US1] Create `src/routes/settings.tsx`: `createFileRoute("/settings")`, `ssr: false`, `head` title "Settings — RepoAtlas", an atlas page shell and header modeled on `src/routes/about.tsx` (RepoAtlasLogo, primary navigation with the existing links and Settings as the active item, using the existing `atlas-page` / `atlas-header` / `atlas-nav-item` classes), mounting `ConfigurationSection`. Let the TanStack router plugin regenerate `src/routeTree.gen.ts` (by running the local dev server or `bun run build` once); **do not hand-edit `routeTree.gen.ts`**, and confirm it now contains `/settings`.
  - Requirements: FR-004, NFR-004
  - Depends: T012
  - Verify: `bunx tsc --noEmit`; the route renders locally at `/settings` and the Explore page still loads.

- [ ] T014 [US1] Add a `Settings` link (`<Link to="/settings" className="atlas-nav-item">Settings</Link>`, in the same position/pattern as the neighbouring links) to the primary navigation of the five existing headers: `src/routes/index.tsx` (near line 182), `src/routes/catalogue.tsx`, `src/routes/categories.tsx`, `src/routes/insights.tsx`, `src/routes/about.tsx`. One added line per file; change **nothing else** in those files and do not extract a shared nav component.
  - Requirements: FR-004, SC-006 (exception (a): the navigation entry)
  - Depends: T013
  - Verify: `git diff` shows exactly one added line per file; `bunx tsc --noEmit`.

**Checkpoint**: US1 complete and independently verifiable (MVP). `bun test` for T005, T006, T010, T011 passes.

---

## Phase 4: User Story 2 — Personal preferences (Priority: P2)

**Goal**: the Guest changes `autoRotate` and `showRelationships`, sees them apply immediately, has them remembered browser-locally, and can reset to defaults; nothing else changes.

**Independent Test**: toggle each preference; reload; it is remembered; reset restores defaults and persists; the source set and Explore filters are unchanged; malformed stored data falls back per item; blocked storage keeps working for the session with a notice.

- [ ] T015 [US2] Extend `src/lib/control-plane/preferences.ts` with the guarded storage layer (no `window` access at module top level): `readStoredPreferences()` (returns defaults when there is no `window`/storage, on any storage or JSON error, or malformed data; otherwise `sanitizePreferences` of the parsed record), `writeStoredPreferences(prefs)` (writes JSON to `PREFERENCES_STORAGE_KEY` inside `try/catch`, returns `boolean`), `probePreferenceStorage()` (writes and removes a test key inside `try/catch`, returns `boolean`), and a test seam `configurePreferenceStorage(storage | undefined)` (same idea as `setTestCloudflareEnv`) so tests can inject a memory or throwing storage.
  - Requirements: FR-009, FR-010, FR-011
  - Depends: T003
  - Security/boundary: category A only, browser-local; never sends preferences to the server; no new storage technology beyond the browser storage the app already uses (`repoatlas.sources.v1` precedent).
  - Verify: covered by T017.

- [ ] T016 [US2] Modify `src/lib/atlas-store.ts` (existing store; minimal change): initialize `autoRotate` and `showRelationships` from `readStoredPreferences()`; add a `resetPreferences()` action (sets both to `PREFERENCE_DEFAULTS`) to the `AtlasState` interface and store; add a `useAtlasStore.subscribe` listener that calls `writeStoredPreferences` **only when `autoRotate` or `showRelationships` changed** (compare previous vs next state for those two fields). **Do not use zustand `persist` middleware** and do not write on hover/selection/filter changes. Leave every other field, action, `resetFilters`, and the existing consumers (`AtlasScene`, `index.tsx`, `AtlasControls`, `RepositoryPanel`) untouched. `resetPreferences()` must not touch `sources-store` or the filters.
  - Requirements: FR-006, FR-009, FR-011, FR-015, NFR-002, NFR-003, SC-006 (exception (b), scoped to these two preferences)
  - Depends: T015
  - Security/boundary: the store change must not add storage writes per hover (research R5).
  - Verify: `bunx tsc --noEmit`; behavior covered by T017.

- [ ] T017 [P] [US2] Write `tests/unit/control-plane/preferences-persistence.test.ts` using `configurePreferenceStorage` with an in-memory storage and a throwing storage: `readStoredPreferences` defaults when empty/malformed/unavailable and returns stored valid values; `writeStoredPreferences` persists and returns `false` (no throw) when storage throws; `probePreferenceStorage` true/false accordingly; **store behavior**: toggling `autoRotate` writes once; toggling `showRelationships` writes once; changing `hoveredId`, `selectedId`, `category`, `language`, `topic` writes **zero** times (write-on-change only); `resetPreferences()` restores defaults **and persists them**; `resetPreferences()` leaves the filters and `useSourcesStore` state unchanged (default owner rule intact).
  - Requirements: FR-006, FR-009, FR-010, FR-015, NFR-003, SC-003
  - Depends: T016
  - Verify: `bun test tests/unit/control-plane/preferences-persistence.test.ts` passes.

- [ ] T018 [US2] Create `src/components/settings/PreferencesSection.tsx`: two `ui/switch` controls bound to `useAtlasStore` (`autoRotate`, `showRelationships`) with immediate effect and no atlas-data refetch; a **Reset preferences** `ui/button` calling `resetPreferences()` and a `sonner` confirmation toast; an inline notice "will not be remembered" driven by `probePreferenceStorage()` on mount and after each change. Only the two switches and the reset button; **no free-form input, no secret or configuration editing control**.
  - Requirements: FR-006, FR-007, FR-010, FR-015, NFR-002, SC-003
  - Depends: T016
  - Security/boundary: client-only; category A only.
  - Verify: `bunx tsc --noEmit`; manual check in T028.

- [ ] T019 [US2] Mount `PreferencesSection` in `src/routes/settings.tsx` (below `ConfigurationSection`), so category-A rows in the configuration list and the switches reflect the same store.
  - Requirements: FR-004, FR-006
  - Depends: T013, T018
  - Verify: `bunx tsc --noEmit`; toggling on `/settings` changes the Explore page behavior without a reload of atlas data.

**Checkpoint**: US2 complete and independently verifiable.

---

## Phase 5: User Story 3 — Read-only code-intelligence status (Priority: P3)

**Goal**: the Guest sees the code-intelligence extractor version and aggregate counts by state, or a clear "not available" state, with no controls.

**Independent Test**: with the in-memory D1 adapter populated and empty, and with no binding, the status shows matching counts, zero counts / "No code-intelligence data", or "not available in this environment"; only `SELECT`s run; no F001/F002 row changes.

- [ ] T020 [US3] Create `src/lib/control-plane/code-intel-status.ts` (server-only): `OperationalStatus` type per data-model.md (`available`, optional `reason: ReasonCode`, `symbolExtractorVersion`, optional `snapshots` `{ total, pending, in_progress, completed, failed }`, optional `extractions` `{ total, in_progress, completed, completed_partial, failed }`) and `getCodeIntelStatusView()`: if `canUseD1()` is false → `{ available: false, reason: "no_binding", symbolExtractorVersion }`; otherwise run exactly two read-only aggregate queries via `getD1()` (`SELECT status, COUNT(*) AS n FROM snapshots GROUP BY status` and the same for `snapshot_extractions`), zero-fill missing statuses, compute totals; any query error → `{ available: false, reason: "query_failed", symbolExtractorVersion }` with **no `Error.message` forwarded**. `symbolExtractorVersion` = `SYMBOL_EXTRACTOR_VERSION` from `src/lib/code-intel/config.ts`. Counts only: no repository owner/name, commit, path or identifier. Do **not** read or display `RELATIONSHIP_EXTRACTOR_VERSION`. Modify no F001/F002 file.
  - Requirements: FR-014, FR-018, SEC-007
  - Depends: T004 (shared `ReasonCode`)
  - Security/boundary: SELECT only; no INSERT/UPDATE/DELETE, no queue send, no call to any F001/F002 mutating function.
  - Verify: covered by T022.

- [ ] T021 [US3] Add `getCodeIntelStatusHandler()` and `getCodeIntelStatus = createServerFn({ method: "POST" }).validator(() => undefined).handler(...)` to `src/lib/control-plane/control-plane.functions.ts` (same no-input handler/wrapper pattern as T009; unexpected failures return `available: false` with a fixed reason, never a thrown internal message).
  - Requirements: FR-014, FR-018, SEC-004, SEC-006
  - Depends: T009, T020
  - Verify: `bunx tsc --noEmit`; covered by T022.

- [ ] T022 [P] [US3] Write `tests/integration/control-plane/code-intel-status.test.ts` using `createSqliteD1()` from `tests/support/d1-sqlite-adapter.ts` and `setTestCloudflareEnv` (pattern from `tests/integration/symbols/*`): **empty tables → all counts 0**; **populated path**: seed `snapshots` rows across `pending`/`in_progress`/`completed`/`failed` and `snapshot_extractions` rows across `in_progress`/`completed`/`completed_partial`/`failed` (using existing F001/F002 helpers or test-only raw `INSERT`s) and assert exact matching counts and totals; **no binding → `available:false`, `reason:"no_binding"`** and the rest of the handler still works; **query failure** (stub DB whose `prepare` throws a message containing a sentinel) → `reason:"query_failed"` and the sentinel is absent from the serialized output; spy on `prepare` to assert only `SELECT` statements are issued; assert table row counts are identical before and after; assert the serialized status contains no repository owner/name sentinel (counts only); assert `symbolExtractorVersion` equals `SYMBOL_EXTRACTOR_VERSION`.
  - Requirements: FR-014, FR-018, SEC-006, SEC-007, SC-005
  - Depends: T021
  - Verify: `bun test tests/integration/control-plane/code-intel-status.test.ts` passes with no Cloudflare access.

- [ ] T023 [US3] Create `src/components/settings/CodeIntelStatusSection.tsx`: `useQuery` + `useServerFn(getCodeIntelStatus)`; shows the extractor version and counts by state, "No code-intelligence data" when all counts are 0, and "Not available in this environment" with a fixed reason text (an "Unavailable" badge, not an error) when `available` is false; loading Skeleton. **Read-only: no button, link or control that starts, pauses, retries, clears or resets anything**; no per-snapshot list.
  - Requirements: FR-014, FR-018, FR-008
  - Depends: T021
  - Security/boundary: client-only; renders only DTO fields.
  - Verify: `bunx tsc --noEmit`; manual check in T028.

- [ ] T024 [US3] Mount `CodeIntelStatusSection` in `src/routes/settings.tsx` (third section).
  - Requirements: FR-004, FR-014
  - Depends: T013, T023
  - Verify: `bunx tsc --noEmit`; under plain dev the section shows "not available", and the rest of the page is unaffected.

**Checkpoint**: US3 complete and independently verifiable.

---

## Phase 6: Cross-cutting tests and final local validation

- [ ] T025 [P] Write `tests/unit/control-plane/client-boundary.test.ts` (server/client boundary): read the source of the client-facing files (`src/components/settings/*.tsx`, `src/routes/settings.tsx`, `src/lib/control-plane/setting-registry.ts`, `src/lib/control-plane/preferences.ts`) and assert none reads `process.env`, and none imports `configuration-read-model` (except `import type`), `code-intel-status`, `persistence/cloudflare-env`, or `atlas-config`/`code-intel/config` values for server-only purposes; assert `control-plane.functions.ts` is the only module the components import for runtime server calls.
  - Requirements: FR-012, SEC-003, SEC-001
  - Depends: T009, T012, T018, T021, T023
  - Verify: `bun test tests/unit/control-plane/client-boundary.test.ts` passes.

- [ ] T026 [P] Write `tests/unit/control-plane/deferred-scope.test.ts` guarding the deferred scope: `control-plane.functions.ts` exports exactly the two server functions `getConfiguration` and `getCodeIntelStatus`, both with no-input validators; no exported write/update/reset/start/pause/retry/clear function exists in `src/lib/control-plane/`; the settings components contain no `<input`/`Input` element, no `type="password"`, and no control labelled Start/Pause/Retry(processing)/Clear/Re-run/Index; only `PreferencesSection` contains state-changing controls and only for `autoRotate`, `showRelationships` and reset (the configuration section's **Retry** is a data refetch only, allowed); no `localStorage`/`sessionStorage`/`indexedDB` use outside `preferences.ts`; no import of any file under `src/lib/code-intel/relationships/`.
  - Requirements: FR-002, FR-011, FR-014, SEC-002, SEC-004
  - Depends: T012, T018, T021, T023
  - Verify: `bun test tests/unit/control-plane/deferred-scope.test.ts` passes.

- [ ] T027 Run the final gates at the repository root: `bunx tsc --noEmit`, `bun test`, `bun run lint`. Fix failures **only inside Feature 006 files** (the files created or intentionally modified above). Compare against the T001 baseline; report any pre-existing failure separately without fixing it. No Cloudflare, Wrangler or deployment step.
  - Requirements: FR-016, SC-005, NFR-003 (typecheck/lint), all test-covered requirements
  - Depends: T005, T006, T010, T011, T014, T017, T019, T022, T024, T025, T026
  - Verify: all three gates pass, or remaining failures are demonstrably pre-existing per T001.

- [ ] T028 Execute the manual validation in `specs/006-settings-control-plane/quickstart.md` in a local browser via `./run.sh`: navigation entry from all five pages; US1 rows (category badge, value/status/availability, default marker, client-visible badge, secret shown only as configured/not configured with the key text absent from page source and network responses, an invalid numeric shown as Invalid / unavailable); configuration visible within 2 s (NFR-001); US2 toggles apply to Explore immediately without an atlas data reload (NFR-002), remembered after reload, reset restores defaults with a confirmation, corrupted `repoatlas.preferences.v1` and blocked storage behave per spec; US3 shows "not available" under plain dev; **network-reachable check** (open the page from another device on the local network or inspect the raw server-function responses: only spec-approved content, no secret/path/identifier/stack trace); confirm no control anywhere on `/settings` edits configuration or starts/pauses/retries/clears/resets processing; narrow-width layout (NFR-004). Record each result in the task report.
  - Requirements: FR-004, FR-006, FR-007, FR-008, FR-010, FR-015, NFR-001, NFR-002, NFR-004, SC-002, SC-003, SC-006, SEC-005
  - Depends: T027
  - Verify: every quickstart manual step matches its expected outcome; deviations are reported, not silently accepted.

- [ ] T029 Scope audit: inspect `git status --short` and `git diff` and confirm the change set contains only the files this task list creates or intentionally modifies (`src/lib/control-plane/*`, `src/components/settings/*`, `src/routes/settings.tsx`, the generated `src/routeTree.gen.ts`, the five one-line nav edits, `src/lib/atlas-store.ts`, `src/lib/atlas-errors.ts`, the new tests, plus documentation from T030) and that no F001–F005 or F007 file, `docs/ROADMAP.md`, `.env.example`, `sources-store.ts`, `serverAtlasConfig()`/`codeIntelConfig()`, or Query-cache experiment file changed; confirm no deployment-configuration persistence, no auth/roles, no mutation control, no MCP/CLI, and no new dependency in `package.json`.
  - Requirements: FR-002, FR-011, FR-015, FR-016, SC-006
  - Depends: T028
  - Verify: the audit result is recorded; any out-of-scope change is reverted by the task's author before completion (no destructive git operations on user work: report instead).

- [ ] T030 Persist state per `CLAUDE.md` reporting conventions: update `docs/progress/PROGRESS.md` (Current State), overwrite `docs/claude_report/reports.md`, append the prompt to `docs/prompts/claude-prompts/prompt-log.md`, and refresh `docs/session_handoffs/CURRENT.md`. **Do not modify `docs/ROADMAP.md`** unless the user separately authorizes it. Do not commit or push.
  - Requirements: (process; no spec requirement)
  - Depends: T029
  - Verify: files updated; ROADMAP unchanged.

---

## Dependencies & Execution Order

```text
T001 (baseline)
  ├─> T002 [P] catalog code ────────────────────────────┐
  └─> T003 preferences (pure) ─┬─> T004 registry ───────┤
                               ├─> T005 [P] sanitize tests
                               └─> T015 storage layer (US2)
T004 ─> T006 [P] registry tests
T004 ─> T007 read-model types/builder ─> T008 input collection ─┐
T002 + T008 ─> T009 server fn (config) ─┬─> T010 [P] (needs T008) ; T011 [P]
T004+T007+T009 ─> T012 ConfigurationSection ─> T013 route ─> T014 nav links      (US1 done)
T015 ─> T016 atlas-store ─┬─> T017 [P] tests ; T018 PreferencesSection ─> T019 mount (needs T013)   (US2 done)
T004 ─> T020 status module ─> T021 (needs T009) ─┬─> T022 [P] ; T023 ─> T024 mount (needs T013)   (US3 done)
T009,T012,T018,T021,T023 ─> T025 [P] ; T012,T018,T021,T023 ─> T026 [P]
all impl + tests ─> T027 gates ─> T028 manual ─> T029 audit ─> T030 persist
```

- **Story independence**: US2 (T015–T019) shares no file with US1 except `settings.tsx` (T019) and can be built in parallel with US1 after T003. US3 (T020–T024) needs only the shared `ReasonCode` (T004) and the server-function file (T009→T021) and `settings.tsx` (T024).
- **Same-file ordering** (not parallel): T009 → T021 (`control-plane.functions.ts`); T013 → T019 → T024 (`settings.tsx`); T003 → T015 (`preferences.ts`); T007 → T008 (`configuration-read-model.ts`).
- **Parallel opportunities**: T002 ∥ T003; T005 ∥ T004; T006, T005 ∥ US1 implementation; T010 ∥ T011; T017 ∥ T018; T022 ∥ T023; T025 ∥ T026.

## Implementation Strategy

1. **MVP = US1** (T001–T014): the read-only, structurally redacted configuration view reachable from every page. Stop and validate: `tsc`, the US1 tests, and the US1 part of T028.
2. **Add US2** (T015–T019), then **US3** (T020–T024), each independently testable; either order is valid.
3. **Finish** with the cross-cutting boundary tests, the three gates, manual quickstart validation, the scope audit, and state persistence (T025–T030).

## Requirement coverage (implementation required → tasks)

| Requirement | Tasks |
|---|---|
| FR-001 | T004, T006, T012 |
| FR-002 | T004, T006, T026, T029 |
| FR-003 | T003, T004, T007 |
| FR-004 | T013, T014, T019, T024, T028 |
| FR-005 | T007, T008, T010, T012 |
| FR-006 | T016, T017, T018, T019, T028 |
| FR-007 | T003, T005, T018, T028 |
| FR-008 | T002, T007, T009, T010, T012, T023, T028 |
| FR-009 | T003, T005, T015, T016, T017 |
| FR-010 | T015, T017, T018, T028 |
| FR-011 | T015, T016, T026, T029 |
| FR-012 | T007, T008, T009, T010, T025 |
| FR-013 | T007, T008, T010, T012 |
| FR-014 | T020, T021, T022, T023, T024, T026 |
| FR-015 | T016, T017, T018, T028, T029 |
| FR-016 | T001, T027, T029 |
| FR-017 | T007, T008, T012 |
| FR-018 | T008, T012, T020, T021, T022, T023 |
| SEC-001 | T007, T008, T011, T025 |
| SEC-002 | T004, T006, T012, T026 |
| SEC-003 | T004, T006, T008, T011, T025 |
| SEC-004 | T009, T011, T021, T026 |
| SEC-005 | T009, T011, T028 |
| SEC-006 | T002, T009, T011, T021, T022 |
| SEC-007 | T004, T006, T007, T008, T011, T020, T022 |
| SEC-008 | T004, T006, T007, T008, T010, T012 |
| NFR-001 | T028 |
| NFR-002 | T016, T018, T028 |
| NFR-003 | T016, T017, T027 |
| NFR-004 | T012, T013, T028 |
| SC-001 | T004, T006, T012 |
| SC-002 | T011, T028 |
| SC-003 | T017, T018, T028 |
| SC-004 | T005, T010 |
| SC-005 | T001, T022, T027 |
| SC-006 | T014, T016, T028, T029 |

No implementation task exists for the deferred US4 or for any runtime mutation control.

## Notes

- Task IDs are local to this file. Requirement IDs are the spec's own; none were invented.
- Existing behavior is authoritative (A1): tests assert that `serverAtlasConfig()`/`codeIntelConfig()` still yield `NaN` for an invalid numeric override; the view reports it, never repairs it.
- SC-006 (A2): the only permitted behavior change on existing pages is the navigation entry (T014) and the remembered `autoRotate`/`showRelationships` behavior with its browser-local persistence and reset (T016).
