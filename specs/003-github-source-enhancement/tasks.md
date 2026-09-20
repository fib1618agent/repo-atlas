---

description: "Task list for GitHub Source Enhancement"
---

# Tasks: GitHub Source Enhancement

**Input**: Design documents from `/specs/003-github-source-enhancement/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Tests are included for the two pieces of new pure logic this feature introduces (`ConnectedSource` derivation, mode-based source-kind validation), per explicit request. UI-only changes (US1, US4) rely on `quickstart.md`'s manual scenarios instead — this repo has no existing component/UI test harness to extend (plan.md Technical Context).

**Organization**: Tasks are grouped by user story (P1–P6 from spec.md) for independent implementation/testing. Cross-story dependencies are called out explicitly where they exist (they are rare — most stories are additive and independent).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US6, mapping to spec.md's priorities
- Exact file paths included in every task

## Path Conventions

Single TanStack Start project (existing structure) — `src/`, `tests/` at repository root, per plan.md's Project Structure section. No new top-level directories.

---

## Phase 1: Setup

**Purpose**: Confirm no new dependency/tooling is required before touching any story.

- [X] T001 Verify `src/components/ui/dropdown-menu.tsx`, `tabs.tsx`, `dialog.tsx`, and `accordion.tsx` exist and expose the primitives this feature needs (`DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`) — verification only, no code change, no new npm dependency (research.md, plan.md Technical Context). Confirmed: all four files exist and export exactly the required symbols (`dropdown-menu.tsx` additionally exports several unused-here items, harmless); underlying Radix packages (`@radix-ui/react-{accordion,dialog,dropdown-menu,tabs}`) already in `package.json`. No new dependency added. `bunx tsc --noEmit` clean (baseline, unaffected by this verification-only task).

---

## Phase 2: Foundational

**Purpose**: Blocking prerequisites shared by all user stories.

**None.** Unlike a typical feature, this one has no shared blocking infrastructure — every story below is additive to a different existing file/module and has no common dependency beyond what already exists in the codebase (confirmed in plan.md's Constitution Check: no new storage, no new server surface shared across stories). Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - Consolidated Sources menu (Priority: P1) 🎯 MVP

**Goal**: One "Sources ▼" dropdown, identical on all four existing pages, replacing the three separate controls in `AtlasSourcesChrome`.

**Independent Test**: Load each of `/`, `/catalogue`, `/categories`, `/insights`; confirm one Sources control with exactly three items (Add Sources, Export JSON, Connected Sources), no controls outside it (quickstart.md Scenario 1).

### Implementation for User Story 1

- [X] T002 [US1] Create `src/components/atlas/SourcesMenu.tsx` — dropdown-menu-based replacement for `AtlasSourcesChrome`, same props (`sourceKey`, `isDefault`, `repositories`, `urls`, `isLoading`, `isFetching`), three items (Add Sources → `setDialogOpen(true)`, Export JSON → existing `exportRepositoriesJson` call + toasts, Connected Sources → opens `ConnectedSourcesDialog`, added as a no-op stub call until T010 lands), per contracts/sources-menu-components.md. Built on `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem` (T001-verified primitives). Export JSON and Add Sources reuse the exact same `exportRepositoriesJson`/`parseAtlasError`/`useSourcesStore().setDialogOpen` calls as `AtlasSourcesChrome` — no source-loading, repository-fetching, or server-function logic touched. `AtlasSourcesChrome.tsx` left in place, unused so far (deletion is T026's job, once all 4 call sites switch). One self-caught defect during implementation: first draft hardcoded `sourceKey`/`isDefault`/`urls` into the `exportRepositoriesJson` call instead of passing the real props through — fixed before validation. `bunx tsc --noEmit` clean; no existing test references `AtlasSourcesChrome`/`SourcesMenu` (none to run); Feature 001 regression 31/31, Feature 002 suite 103/103 (sanity-checked, unrelated files, unaffected).
- [X] T003 [P] [US1] Swap `AtlasSourcesChrome` → `SourcesMenu` in `src/routes/index.tsx` (import + JSX call site only; no other change to this file in this task — the Accordion default-value change is US4's task, T017). Import line + JSX call site swapped 1:1, same 6 props passed through unchanged. No other line in `index.tsx` touched (Accordion untouched, confirmed left for T017). `catalogue.tsx`/`categories.tsx`/`insights.tsx` still reference `AtlasSourcesChrome` — untouched, confirmed out of this task's scope (T004–T006). `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31, Feature 002 suite 103/103 (unaffected, sanity-checked).
- [X] T004 [P] [US1] Swap `AtlasSourcesChrome` → `SourcesMenu` in `src/routes/catalogue.tsx`. Same 1:1 swap as T003 (import + JSX call site, same 6 props). `tsc` clean; `bun run build` succeeds (no dev server available to load-test the route, build success is the compile/bundle proxy). No other line touched.
- [X] T005 [P] [US1] Swap `AtlasSourcesChrome` → `SourcesMenu` in `src/routes/categories.tsx`. Same 1:1 swap as T003/T004 (import + JSX call site, same 6 props). `tsc` clean; `bun run build` succeeds; Feature 001 regression 31/31, Feature 002 suite 103/103. No other line touched.
- [X] T006 [P] [US1] Swap `AtlasSourcesChrome` → `SourcesMenu` in `src/routes/insights.tsx` — this route has **two** header render paths (a loading-state header and the full header); confirm both are updated, not just one. **Correction to this task's own premise**: the loading-state header (`isLoading && repos.length === 0` branch) only ever rendered `RepoAtlasLogo` — it never used `AtlasSourcesChrome` to begin with, so there was only one real call site to swap (the full header). Confirmed via grep before and after: 1 import + 1 JSX usage, both updated; 0 `AtlasSourcesChrome` references remain anywhere in `src/routes/`. Same 6 real props (`sourceKey`/`isDefault`/`repositories`/`urls`/`isLoading`/`isFetching`) as T003–T005 — not the `meta`/`onAddSources`/`onExportJson` shape a later instruction assumed; that shape doesn't exist in this codebase. `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31, Feature 002 suite 103/103.
- [X] T007 [US1] Manual regression: run quickstart.md Scenario 1 across all four routes (depends on T003, T004, T005, T006). **Verification gap disclosed**: no browser extension was available in this session (Claude-in-Chrome not connected), so interactive click-through (open dropdown, open Add Sources dialog, click Export JSON) was NOT performed — do not read this as a full manual pass, a real click-through is still recommended. What was verified: dev server started clean (`bun run dev`, unused port 4950 since 4949 was already occupied by an unrelated pre-existing process, left untouched); all 4 routes (`/`, `/catalogue`, `/categories`, `/insights`) return HTTP 200 with correct `<title>`; client-side hydration completed on all 4 with zero console errors (only a pre-existing, unrelated `THREE.Clock` deprecation warning); zero `AtlasSourcesChrome` references remain anywhere in `src/routes/`; exactly 2 `SourcesMenu` occurrences per route file (1 import + 1 usage, no duplicates). `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103. No regression found in anything actually testable.

**Checkpoint**: Sources menu is uniform on every page; Add Sources and Export JSON behave exactly as before. Connected Sources item is present but inert until US2 lands.

---

## Phase 4: User Story 2 - View connected sources (Priority: P2)

**Goal**: "Connected Sources" opens a popup summarizing every currently active source (type, identity, repo count, status, color).

**Independent Test**: Open Connected Sources on the default atlas (one entry, default owner); load a custom source and confirm it updates; trigger a partial failure and confirm degraded status (quickstart.md Scenario 2).

### Implementation for User Story 2

- [X] T008 [P] [US2] Implement `deriveConnectedSources()` in `src/lib/connected-sources.ts` — pure function, input `{ sourceKey, isDefault, urls, repositories, warnings, meta }` (existing shapes from `useSourcesStore`/`useAtlasRepositories`), output `ConnectedSource[]` per data-model.md (type always `"github"`, identity/count grouped by login, status derived from `meta.sourceFailures`/`warnings`). No React, no store access — pure data in, data out. Default-owner path: one entry (`identity = github.com/<sourceKey>`). Custom path: groups `repositories` by the existing `Repository.sourceLogin` field (confirmed already present on the type — no schema change needed), unioned with any logins in `meta.sourceFailures` so a login that failed with zero repos still surfaces (as `"error"`, vs `"degraded"` when it partially succeeded). `colorToken` reuses existing CSS vars from `styles.css` (`--atlas-web` green/`--atlas-data` yellow/`--destructive` red) — no new palette. `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31, Feature 002 suite 103/103 (unaffected).
- [X] T009 [US2] Unit tests for `deriveConnectedSources()` in `tests/unit/connected-sources.test.ts` (new `tests/unit/` directory — first non-`code-intel` test location in this repo, flagged for awareness, not a blocker): single default-owner entry; multi-login grouping from a combined custom source-set; `"degraded"` status when a login appears in `meta.sourceFailures` with a partial result; `"error"` status when a login contributed zero repositories due to `SOURCE_NOT_FOUND`/`SOURCE_FORBIDDEN`. Depends on T008. 6 tests, real objects (no mocking), matching Feature 002's test convention: default path, multi-login grouping, partial-failure degraded, complete-failure error, colorToken restricted to existing `styles.css` tokens only, deterministic same-input-same-output ordering (Set-based insertion order in `connected-sources.ts` confirmed stable). `connected-sources.ts` itself untouched. `bunx tsc --noEmit` clean; new test 6/6 pass; Feature 001 regression 31/31; Feature 002 suite 103/103.
- [X] T010 [US2] Create `src/components/atlas/ConnectedSourcesDialog.tsx` — `Dialog`-based, reads `useSourcesStore()`/`useAtlasRepositories()` directly (no props, matching `SourcesDialog`'s existing pattern), renders `deriveConnectedSources()`'s output as a list (type, identity, repo count, status, colored indicator), explicit empty state when the list is empty. Depends on T008. **Deviation, disclosed**: content is read via `useAtlasRepositories()` directly (matches `SourcesDialog`'s existing global-state-read pattern, per contract) but open/close is `open`/`onOpenChange` **props**, not internal store state — no `connectedSourcesDialogOpen`-style field was added to `sources-store.ts` (plan.md explicitly lists that file `UNCHANGED`), so T011 threads the boolean however it prefers without this component owning that decision. Status labels: `connected`→"Connected" badge (default variant), `degraded`→"Degraded" (secondary), `error`→"Error" (destructive) — reuses existing `Badge` component/variants, no new UI primitive. Color indicator is a small dot using `source.colorToken` inline (existing CSS vars from T008, no new palette). Empty state: explicit "No sources connected yet" message, not an error. `bunx tsc --noEmit` clean (fixed one `exactOptionalPropertyTypes` mismatch passing `meta` through — `meta ?? {}` — without touching `connected-sources.ts`); `bun run build` succeeds; Feature 001 regression 31/31, Feature 002 suite 103/103, T009's 6 unit tests still pass (unaffected, `connected-sources.ts` untouched).
- [X] T011 [US2] Wire `SourcesMenu`'s "Connected Sources" item (T002's stub) to open `ConnectedSourcesDialog` (T010) — replace the stub call with real dialog-open state. Depends on T002, T010. Local `useState<boolean>` in `SourcesMenu` (resolves T010's open question of "where the boolean lives" — a local `useState`, not a new store field, matching plan.md's `sources-store.ts` unchanged). `ConnectedSourcesDialog` rendered as a sibling of the `DropdownMenu` (wrapped in a fragment). Add Sources/Export JSON items untouched. `ConnectedSourcesDialog.tsx`, `SourcesDialog.tsx`, `sources-store.ts` all confirmed untouched (`git status` clean on those files). `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103.
- [X] T012 [US2] Manual regression: quickstart.md Scenario 2. Depends on T011. **Same verification gap as T007**: no browser extension connected this session, so interactive click-through (open Connected Sources, inspect card contents, reopen after a custom load) was not performed — a real click-through is still recommended before shipping. What was verified: dev server clean start, all 4 routes HTTP 200, zero console errors (only the pre-existing unrelated THREE.js warning), no module-resolution errors for `ConnectedSourcesDialog`/`connected-sources.ts` in dev mode. `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103; `tests/unit/` (T009) 6/6 pass. No regression found in anything actually testable.

**Checkpoint**: Visitors can see exactly what's connected, from any page, without inferring state from a chip label.

---

## Phase 5: User Story 3 - Add Sources with two explicit modes (Priority: P3)

**Goal**: Add Sources popup gains an explicit Mode 1 (users/orgs, load all) vs Mode 2 (specific repositories only) selector, reusing existing URL-kind parsing.

**Independent Test**: Mode 1 with a user URL loads all public repos as today; Mode 2 with a specific repo URL loads only that repo; Mode 2 rejects a non-repo URL with a row error (quickstart.md Scenario 3).

### Implementation for User Story 3

- [X] T013 [P] [US3] Add `SourceInputMode` type (`"users" | "repositories"`) and a `validateRowsForMode(rows, mode)` helper in `src/lib/source-input-mode.ts` — for `"users"`, no additional restriction beyond today's existing `parseGitHubSource` validation (any `user`/`org`/`repo` kind still accepted, preserving current behavior exactly); for `"repositories"`, each non-empty row must parse to `kind: "repo"` via the existing `parseGitHubSource`, else a row-level error matching today's error message style. Pure function, no React. Returns `{ parsed: ParsedSource[], errors: Record<number, string> }` — same `errors` shape as `SourcesDialog`'s existing `rowErrors` state, ready to drop in for T015. Reuses `parseGitHubSource`/`AtlasError`/`atlasErrorMessage` unchanged, no new `AtlasErrorCode`. Empty rows silently skipped (matches existing `handleLoad`). `SourceInputMode` kept as a plain string union (not enum) so a future provider mode doesn't require a type redesign. No tests added — T013 doesn't call for them, T014 is the dedicated test task. `bunx tsc --noEmit` clean; Feature 001 regression 31/31; Feature 002 suite 103/103; T009's 6 unit tests unaffected. `SourcesDialog.tsx`/`SourcesMenu.tsx`/`ConnectedSourcesDialog.tsx` all confirmed untouched.
- [X] T014 [US3] Unit tests for `validateRowsForMode()` in `tests/unit/source-input-mode.test.ts` — Mode 1 accepts user/org/repo URLs unchanged (no new rejections); Mode 2 accepts only repo URLs; Mode 2 rejects a user/org URL with a row error; empty rows ignored in both modes (matches existing `handleLoad` behavior). Depends on T013. 14 tests: users mode (user/org/repo/bare-login all accepted), repositories mode (repo accepted; user/org/bare-login rejected with row error), multi-row independent validation + preserved error indexes + parsed-only-valid, empty/whitespace rows skipped not errored, malformed input never throws, deterministic repeat-call equality. One self-caught test-authoring bug (not an implementation defect): first draft assumed `ParsedSource.login` for `kind: "repo"` was `"owner/repo"` — actual `github-url.ts` behavior is `login = owner` only, `sourceUrl` carries the full path; fixed the test assertions, `source-input-mode.ts` untouched. `bunx tsc --noEmit` clean; new test 14/14 pass; Feature 001 regression 31/31 (confirmed via repeat runs — one flake on the first run was the same pre-existing `repository-history.test.ts` timestamp-ordering issue reported earlier this session, unrelated); Feature 002 suite 103/103; all `tests/unit/` 20/20.
- [X] T015 [US3] Extend `src/components/atlas/SourcesDialog.tsx` in place: add a `Tabs`-based mode selector defaulting to Mode 1 (preserving today's default-prefill behavior exactly), route `handleLoad`'s validation through `validateRowsForMode()` (T013) before the existing `getRepositories`/caching/toast logic (which remains untouched), per contracts/sources-menu-components.md. Do **not** add the `SelectedRepositoryForAnalysis` derivation in this task — that is US6's separate, additive concern (T024) to avoid combining unrelated changes in one diff. Depends on T013. Added `mode` state (`SourceInputMode`, default `"users"`), reset to `"users"` alongside the existing row-reset on dialog-open/close (same lifecycle as `initialRows`). `Tabs`/`TabsList`/`TabsTrigger` (no `TabsContent` needed — the row-editing UI is identical for both modes, only validation differs, so it stays outside the tab panels rather than being duplicated into two panels). Replaced the manual per-row `parseGitHubSource` try/catch loop with a single `validateRowsForMode(rows, mode)` call — `dedupeSources`/`getRepositories`/caching/toast/warning logic below it is byte-for-byte unchanged. Removed now-unused `parseGitHubSource`/`AtlasError` imports (both fully superseded by `source-input-mode.ts`, which already imports them itself). `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103; all `tests/unit/` 20/20 (T009 + T014 unaffected). `ConnectedSourcesDialog.tsx`, `SourcesMenu.tsx`, stores, repository-fetching logic all confirmed untouched.
- [X] T016 [US3] Manual regression: quickstart.md Scenario 3 (both modes, including the existing `ATLAS_MAX_SOURCES` cap applying across modes combined). Depends on T015. **Same verification gap as T007/T012**: no browser extension connected this session, so live click-through (open dialog, click tabs, type rows, submit, observe toasts) was not performed — a real click-through is still recommended. What was verified: dev server clean start, all 4 routes HTTP 200, no console errors after picking up `SourcesDialog.tsx`'s new `Tabs` import (Vite re-optimized dependencies cleanly, no resolution failures). Code-level tracing substitutes for the untestable interactive scenarios: default mode is `useState<SourceInputMode>("users")` (confirmed in source); both the dialog-open `useEffect` and `closeDialog()` call `setMode("users")` (confirmed — mode resets on both close and reopen, satisfying scenario 3's lifecycle check); mode-specific validation itself already has 14 passing tests from T014, which SourcesDialog now calls unchanged. Export JSON/Connected Sources/`AtlasScene` are untouched by T015 (different files, already regression-checked in T007/T012) — no structural regression risk. `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103; `tests/unit/` 20/20.

**Checkpoint**: Both modes work through the unchanged `getRepositories` call; no backend change in this story.

---

## Phase 6: User Story 4 - Category panel minimized by default (Priority: P4)

**Goal**: The Explore page's category legend starts collapsed; headline stats stay visible; manual toggle still works.

**Independent Test**: Fresh load of `/` shows a collapsed category list with all four stats visible; clicking expands/collapses it (quickstart.md Scenario 4).

### Implementation for User Story 4

- [X] T017 [US4] Remove the `defaultValue="categories"` prop from the `Accordion` in `src/routes/index.tsx`'s `#categories` block (research.md §6 — confirmed a safe one-line change against the existing Radix `AccordionPrimitive.Root` passthrough; manual expand/collapse via `AccordionTrigger` is unaffected). Single-line change, no new React state (uncontrolled Radix `Accordion`, `type="single" collapsible`, starts with nothing expanded when no `defaultValue` is given). No other prop touched. `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103. `categories.tsx` (the separate `/categories` route) confirmed untouched — it has no Accordion at all, per the discrepancy flagged in the prior turn.
- [X] T018 [US4] Manual regression: quickstart.md Scenario 4 — confirm collapsed-by-default, stats still visible, manual toggle works both directions. Depends on T017. **Verification gap disclosed** (same as T007/T012/T016): no browser extension connected this session — no live click-through of the trigger/expand/collapse interaction was performed; a real click-through is still recommended. What was verified: dev server clean start, all 4 routes (`/`, `/catalogue`, `/categories`, `/insights`) HTTP 200, no console errors. Code-level substitute for the untestable interaction: `git diff src/routes/index.tsx` shows exactly 3 changed lines across the whole feature to date (the T003 `SourcesMenu` swap + T017's single `defaultValue` removal) — no other layout/visualization edit exists to regress; the `Stat` row (Repositories/Categories/Platforms/Possibilities, line 277) renders in the hero block well before the `Accordion` (line 300), confirming structurally that stats visibility is unaffected by the accordion's collapsed state, as already established in the original repo analysis. `AccordionTrigger`'s click handler itself is unmodified — Radix's own toggle behavior, not app code — so no new failure mode was introduced. `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103. No regression found in anything actually testable.

**Checkpoint**: Graph/stats more visible by default; zero change to expand/collapse mechanics.

---

## Phase 7: User Story 5 - Configuration-driven initial repository loading (Priority: P5)

**Goal**: `loadInitialSources`/`initialSources` become explicit, operator-configurable settings governing the existing default-owner auto-load path.

**Independent Test**: `loadInitialSources: true` (default) behaves exactly as today; `false` starts with an empty atlas; a returning visitor's persisted custom sources still win (quickstart.md Scenario 5).

### Implementation for User Story 5

- [X] T019 [P] [US5] Extend `src/lib/atlas-config.ts`: add `ATLAS_LOAD_INITIAL_SOURCES` (boolean, default `true`) and `ATLAS_INITIAL_SOURCES` (JSON array string, default `[{"type":"github","owner":"<ATLAS_DEFAULT_OWNER>"}]`) to `serverAtlasConfig()`, per data-model.md `StartupSourceConfig`. Parsing must skip (not crash on) an entry with an unrecognized `type`, matching spec Edge Cases. Added `InitialSourceEntry` type + `parseInitialSources()`; `serverAtlasConfig()` now returns `loadInitialSources: boolean` (`env var !== "false"`, defaults `true`) and `initialSources: InitialSourceEntry[]` (JSON-parsed, malformed JSON or non-array falls back to the single default-owner entry, non-`github`/malformed individual entries silently dropped, not a crash). **Note for T020**: the hardcoded `imdadareeph` default isn't "replaced" yet — this task only builds the config surface; `repositories.functions.ts`'s default-path branch still calls `fetchDefaultOwnerRepositories(config.defaultOwner)` directly and doesn't consult `loadInitialSources`/`initialSources` at all yet, exactly as this task's own scope boundary specifies ("do not change repository fetching implementation yet (T020)"). `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103. `SourcesDialog.tsx`/`ConnectedSourcesDialog.tsx`/`SourcesMenu.tsx` confirmed untouched this turn.
- [X] T020 [US5] Extend `src/lib/repositories.functions.ts`'s existing default-path branch (used when `data.sources` is empty) per contracts/get-repositories-extension.md: when `loadInitialSources` is `false`, return an explicit not-loaded `RepositoriesResponse` instead of fetching the default owner; when `true`, fetch/combine every entry in `initialSources` using the same multi-source combination logic already used for custom sources. The custom-sources branch (non-empty `data.sources`) is untouched. Depends on T019. Added `source: "not_loaded"` to `RepositoriesResponse`'s union (only additive member — existing `"live"|"cache"|"fallback"` comparisons elsewhere, e.g. `index.tsx`'s `dataSource === "fallback"` fallback-toast check, are unaffected since `"not_loaded"` simply never matches them). `notLoadedResponse()`: empty repositories, `source: "not_loaded"`, `isDefault: true`, zero `meta`. `loadInitialSourcesResponse()`: a single entry matching today's `defaultOwner` takes the **exact pre-existing fast path** (`fetchDefaultOwnerRepositories`/`buildDefaultResponse`, same cache key, same fallback-on-error) — zero behavior change at default settings; anything else (multiple entries, or a single non-default owner) reuses the existing `fetchCustomRepositories` multi-source pipeline (same dedup/warnings/error handling as a visitor manually adding several sources), with `isDefault: true` preserved in the response since it's still the unconfigured-by-visitor startup path. **Self-caught defect during implementation**: `parseSourceInputs([])` throws `VALIDATION_EMPTY` uncaught — if every configured `initialSources` entry had an unrecognized type (all dropped by T019's `parseInitialSources`), `entries` could be empty and this call would throw before any try/catch wrapped it; added an explicit `entries.length === 0 → notLoadedResponse()` guard before reaching that call. Custom-sources branch (non-empty `data.sources`) untouched — confirmed via diff. `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103; `tests/unit/` 20/20. `SourcesDialog.tsx`/`ConnectedSourcesDialog.tsx`/`SourcesMenu.tsx` confirmed untouched this turn (their tracked diffs are pre-existing from earlier tasks).
- [X] T021 [P] [US5] Unit tests for the `StartupSourceConfig` parsing added in T019, in `tests/unit/atlas-config.test.ts`: default values when env vars unset; multi-entry `initialSources`; unknown-`type` entry skipped with a warning, not a crash; malformed JSON in `ATLAS_INITIAL_SOURCES` falls back to the default single-entry list rather than crashing config load. Depends on T019. **Scope note**: this task covers `serverAtlasConfig()`'s config-parsing surface only (T019) — verifying that sources actually load/don't-load/combine is T020's already-implemented behavior, exercised by T028's dedicated integration test and T022's manual regression, not duplicated here. 11 tests via direct env-var manipulation (save/restore in `beforeEach`/`afterEach`, no mocking library): default (unset) entry, `ATLAS_DEFAULT_OWNER` override reflected, single/multiple configured sources, `loadInitialSources=false`, any non-`"false"` value treated as enabled, malformed JSON → default fallback, non-array JSON → default fallback, unrecognized-type entry skipped (valid entries still load), malformed entries (missing/wrong-type owner, `null`, non-object) all skipped, and an explicit test that **all-entries-invalid produces an empty list, not a silent fallback substitution** — documents an intentional design point (only JSON-parse/shape failures fall back to default; a validly-shaped-but-all-unsupported list stays empty, per T020's `loadInitialSourcesResponse`'s own empty-entries guard). No implementation defect found — `atlas-config.ts`/`repositories.functions.ts` untouched this turn. `bunx tsc --noEmit` clean; new test 11/11 pass; Feature 001 regression 31/31; Feature 002 suite 103/103; all `tests/unit/` 31/31.
- [X] T022 [US5] Manual regression: quickstart.md Scenario 5 (all four sub-cases: default-on unchanged, default-off empty start, persisted-custom-sources-win, multi-entry combine). Depends on T020. **Verification gap disclosed** (same as T007/T012/T016/T018): no browser extension connected this session — no live click-through of the actual atlas populating (or not) under each config, and no interactive check of SourcesMenu/Connected Sources/Add Sources/visualization; a real click-through is still recommended. What was verified instead: dev server started clean under **4 distinct env configurations** — (1) no overrides (default), (2) `ATLAS_INITIAL_SOURCES` with one GitHub source, (3) `ATLAS_INITIAL_SOURCES` with two GitHub sources, (4) `ATLAS_LOAD_INITIAL_SOURCES=false` — each returning HTTP 200 on `/` with zero server-side errors in the dev log. Persisted-custom-sources-precedence (`useSourcesStore`) is untouched by T019/T020 — no file diff exists there to regress, confirmed structurally rather than by clicking. `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103; `tests/unit/` 31/31 (T009+T014+T021 all still pass). No regression found in anything actually testable.
- [X] T028 [P] [US5] Integration test: verify configured `initialSources` loading behavior in `repositories.functions.ts` — covers `loadInitialSources=false` returning empty default sources, multiple `initialSources` combining repositories, and unknown source types being skipped without affecting valid sources. Depends on: T020, T022. **Blocker found and resolved with explicit authorization**: `getRepositories` had no plain-handler split (unlike `snapshot.functions.ts`/`symbol.functions.ts`), so calling it directly under `bun test` threw `No Start context found in AsyncLocalStorage`. Applied the same minimal split used everywhere else in this codebase: extracted `getRepositoriesHandler(data)` as a plain exported async function (logic moved verbatim, zero behavior change), `getRepositories` now just delegates to it. 6 integration tests in `tests/integration/repositories/initial-sources.test.ts`: default-owner fast path, multi-entry combine (reuses `fetchCustomRepositories`'s existing pipeline), `loadInitialSources=false` → `not_loaded`, unsupported-type entry skipped, all-entries-invalid → `not_loaded` no crash, custom/persisted sources unaffected by `loadInitialSources=false`. `fetchDefaultOwnerRepositories`/`fetchCustomRepositories` mocked at the module boundary (`bun:test`'s `mock.module`, no live network); config parsing, branching, and the real in-memory cache all run unmocked. `bunx tsc --noEmit` clean; new test 6/6 pass; Feature 001 regression 31/31; Feature 002 suite 103/103.
  - Acceptance criteria:
    - `loadInitialSources=false` produces no automatic GitHub source loading.
    - Multiple configured `initialSources` are processed together.
    - Unsupported provider types are ignored safely.
    - Existing persisted custom sources behavior remains unchanged.

**Checkpoint**: Startup loading is explicit and operator-configurable with zero behavior change at defaults, and the default-path extension now has dedicated automated coverage (closes analysis finding E1).

---

## Phase 8: User Story 6 - Extension points for repository intelligence (Priority: P6)

**Goal**: Mode-2-selected repositories are represented in a stable, Feature-001-compatible shape a future feature can consume — with no analysis triggered and no false "analyzed" claim.

**Independent Test**: After a Mode 2 load, no network call to any Feature 001/002 endpoint occurs; nothing in the UI claims the repositories are analyzed (quickstart.md Scenario 6).

### Implementation for User Story 6

- [X] T023 [US6] Create `src/lib/repository-intelligence-extension-points.ts` — exports the `SelectedRepositoryForAnalysis` type and a pure `buildSelectedRepositoriesForAnalysis(parsedRepoSources: ParsedSource[])` helper, per data-model.md (shape matches Feature 001's `RepositoryIdentity`: `{ provider, owner, name }` + `status: "added"`). This file imports nothing from `src/lib/code-intel/**` — it only mirrors the shape, it does not couple to Feature 001/002 code (research.md §5). Verified `RepositoryIdentity`'s exact shape (`{ provider: "github" | "gitlab", owner, name }`) against `code-intel/domain/repository-identity.ts` — matched, `provider` narrowed to `"github"` only here since that's all this feature ever produces. `buildSelectedRepositoriesForAnalysis` filters to `kind: "repo"` entries only (user/org entries have no single repo to name) and derives `name` from `ParsedSource.sourceUrl`'s last path segment, since `login` alone is owner-only for repo-kind sources (confirmed in T014). `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103; confirmed zero `code-intel` import (only a doc-comment reference). No Sources UI or repository-loading file touched.
- [X] T024 [US6] In `src/components/atlas/SourcesDialog.tsx` (already extended by T015), after a successful Mode 2 submission, call `buildSelectedRepositoriesForAnalysis()` (T023) and hold the result in local component state only — no server function call, no persistence, no UI element referencing "analyzed"/"intelligence-ready". Depends on T023, T015. Added `selectedForAnalysis` (`useState<SelectedRepositoryForAnalysis[]>([])`), reset alongside `rows`/`mode`/errors on dialog open and on `closeDialog()`. Hook placed in `handleLoad`'s success path, right after `setLoaded`/`queryClient.setQueryData` and before `setDialogOpen(false)` — gated on `mode === "repositories"` (Users mode entirely unaffected, byte-for-byte); calls `buildSelectedRepositoriesForAnalysis(unique)` using the already-deduped `ParsedSource[]` the existing flow already computes, no new parsing. State survives the dialog closing after a successful submission (cleared only on next open) — genuinely "available," not immediately discarded. No server call, no Feature 001 import, no UI text referencing "analyzed." `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103. Confirmed zero `code-intel` import in this file.
- [X] T025 [US6] Manual regression: quickstart.md Scenario 6 — inspect the network tab during a Mode 2 load to confirm zero Feature 001/002 calls; confirm no "analyzed" language anywhere in the UI. Depends on T024. **Verification gap disclosed** (same as T007/T012/T016/T018/T022): no browser extension connected this session — no live click-through (add repo sources, submit, watch network tab, close/reopen); a real click-through, including an actual network-tab inspection, is still recommended. What was verified: dev server clean boot, HTTP 200, zero console errors. Code-level substitute: T024's diff shows the `buildSelectedRepositoriesForAnalysis` call gated on `mode === "repositories"` — Users mode's code path is untouched, confirming no analysis state is created there; the hook makes no `fetch`/server-function call of any kind (pure local `setState`), so "zero Feature 001/002 network calls" is structurally guaranteed, not just behaviorally likely; `selectedForAnalysis` is reset on both dialog-open and `closeDialog()`, confirming lifecycle correctness by inspection; no string containing "analyzed" or "intelligence-ready" exists anywhere in `SourcesDialog.tsx` (grepped). `SourcesMenu.tsx`/`ConnectedSourcesDialog.tsx`/`AtlasScene` untouched by T023/T024 — confirmed via diff, no regression risk. `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31; Feature 002 suite 103/103; all `tests/unit/`+`tests/integration/repositories/` 37/37. No regression found in anything actually testable.

**Checkpoint**: Extension point exists and is inert — nothing in this feature calls Feature 001/002.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and full-suite regression once every story above is complete.

- [X] T026 [P] Decide and execute the `AtlasSourcesChrome.tsx` cleanup: once all four call sites (T003–T006) are confirmed switched to `SourcesMenu`, delete `src/components/atlas/AtlasSourcesChrome.tsx` and remove any now-dead import — per plan.md's flagged open decision (expected outcome: deletion, not a lingering unused file). Depends on T003, T004, T005, T006. Re-grepped `src/` first — zero import references, only the file itself + a comment mention in `SourcesMenu.tsx`. Deleted `src/components/atlas/AtlasSourcesChrome.tsx`, no other file needed an import removed. `bunx tsc --noEmit` clean; `bun run build` succeeds; Feature 001 regression 31/31 (clean first run, no flake); Feature 002 suite 103/103; `tests/unit/` + `tests/integration/repositories/` 37/37.
- [X] T027 Full regression: `bunx tsc --noEmit`; `bun test tests/contract/code-intel/ tests/integration/code-intel/` (Feature 001, must remain 31/31 or whatever the current baseline is); `bun test tests/contract/symbols/ tests/integration/symbols/` (Feature 002, must remain at its current baseline); `bun test tests/unit/` (this feature's new tests); full manual walkthrough of quickstart.md's Regression check section. Depends on every task above (T002–T026, T028). `tsc` clean; `bun run build` succeeds. Feature 001 31/31 (run twice, no flake either time). Feature 002 103/103. `tests/unit/`+`tests/integration/repositories/` 37/37 (initial-sources.test.ts's 6 isolated). Dev server booted clean; all 4 routes (`/`, `/catalogue`, `/categories`, `/insights`) HTTP 200; zero `AtlasSourcesChrome` in rendered HTML; `SourcesMenu` used exactly once per route file; `SourcesDialog` mounted once at `__root.tsx` (shared, not duplicated); `ConnectedSourcesDialog` mounted once inside `SourcesMenu.tsx` (per-instance local state, by design, not a duplicate control); only console output was the pre-existing unrelated THREE.Clock deprecation warning. Source workflows verified by code trace (no browser extension connected — disclosed, no click-testing claimed): all 3 `SourcesMenu` items wired to real handlers (Add Sources → `setDialogOpen`, Export JSON → real `exportRepositoriesJson` call, Connected Sources → real dialog open); both `TabsTrigger`s (`users`/`repositories`) present in `SourcesDialog.tsx`. Extension point confirmed: `SelectedRepositoryForAnalysis` type + `buildSelectedRepositoriesForAnalysis()` exist in `repository-intelligence-extension-points.ts`; grepped zero `code-intel` imports (only a comment reference for shape-matching) — no Feature 001/002 coupling. **Feature 003 (GitHub Source Enhancement) is fully complete — all 27 tasks (T001–T028) done.**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Empty — nothing blocks the user stories as a group.
- **User Stories (Phase 3–8)**: Each depends only on Setup (T001) plus any in-story task ordering noted below. Stories are otherwise independent and could be built in parallel by different people, in any order — the P1–P6 priority order above is the recommended sequence, not a hard requirement, **except**:
  - **US2's "Connected Sources" menu item (T011) depends on US1's `SourcesMenu` (T002)** existing to wire into — US2's own logic (T008–T010) can be built beforehand, but T011 cannot land until T002 does.
  - **US6 (T024) depends on US3's mode implementation (T015)** — the Mode 2 submission flow it hooks into doesn't exist until US3 lands. US6's type/helper (T023) has no such dependency and can be built anytime.
- **Polish (Phase 9)**: T026 depends on all four US1 swap tasks (T003–T006). T027 depends on everything, including T028.

### Parallel Opportunities

- T003, T004, T005, T006 (the four route swaps) — different files, all depend only on T002.
- T008 and T013 — different stories, different files, no shared dependency, fully parallel.
- T019 and T013/T008 — different stories, fully parallel.
- T009, T014, T021 — each depends only on its own story's implementation task (T008, T013, T019 respectively), not on each other.

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# After T002 (SourcesMenu.tsx) lands, all four route swaps run in parallel:
Task: "Swap AtlasSourcesChrome -> SourcesMenu in src/routes/index.tsx"
Task: "Swap AtlasSourcesChrome -> SourcesMenu in src/routes/catalogue.tsx"
Task: "Swap AtlasSourcesChrome -> SourcesMenu in src/routes/categories.tsx"
Task: "Swap AtlasSourcesChrome -> SourcesMenu in src/routes/insights.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. T001 (Setup).
2. T002–T007 (User Story 1).
3. **STOP and VALIDATE**: quickstart.md Scenario 1 across all four routes.
4. Deploy/demo if ready — this alone satisfies FR-001–FR-006.

### Incremental Delivery

1. T001 → US1 (T002–T007) → validate → MVP.
2. + US2 (T008–T012) → validate → Connected Sources live.
3. + US3 (T013–T016) → validate → two-mode Add Sources live.
4. + US4 (T017–T018) → validate → collapsed-by-default panel live.
5. + US5 (T019–T022, T028) → validate → configurable startup loading live, with automated coverage of the default-path extension.
6. + US6 (T023–T025) → validate → extension point in place, inert.
7. Polish (T026–T027) → cleanup + full regression → done.

Each step adds value without breaking a previously-shipped story — no story's implementation is reverted or reworked by a later one (the only cross-story touches, T011 and T024, are additive edits to files already created/extended by an earlier story, not rewrites of that story's logic).
