---
description: "Task list for dynamic GitHub sources (spec 001)"
---

# Tasks: Dynamic GitHub Sources

**Input**: Design documents from `/specs/001-dynamic-github-sources/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Handoff**: [docs/dynamic-sources-prompt.md](../../docs/dynamic-sources-prompt.md) (exact UI copy, error strings, env table)

**Tests**: Not requested in spec — validation via [quickstart.md](./quickstart.md) and `bunx tsc --noEmit`.

**Organization**: Tasks grouped by user story (P1 → P3) plus infrastructure phases from plan.

**Plan phase mapping** (same work, different labels):

| tasks.md | plan.md | Scope |
|----------|---------|-------|
| Phases 1–7 | Plan Phase 1 | Dialog, fetch, export, persist (no SQLite) |
| Phase 8 | Plan Phase 2 | SQLite cache + db scripts |
| Phase 9 | Plan Phase 3 | `.env.example` + AI adapter |
| Phase 10 | Polish | tsc, build, quickstart |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: US1–US5 maps to spec user stories

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repo hygiene and shared constants before feature code

- [x] T001 [P] Add `data/atlas.sqlite`, `data/atlas.sqlite-wal`, `data/atlas.sqlite-shm`, `data/atlas-export.json` to `.gitignore`
- [x] T002 Create `src/lib/atlas-config.ts` with `ATLAS_DEFAULT_OWNER`, `ATLAS_MAX_SOURCES`, `ATLAS_MAX_SPIRAL_REPOS`, `ATLAS_MAX_STORED_REPOS`, `ATLAS_CACHE_TTL_MS` from env with documented defaults
- [x] T003 [P] Confirm `<Toaster />` from sonner is mounted in `src/routes/__root.tsx` (add if missing)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Server fetch pipeline and types — **blocks all user stories**

**⚠️ CRITICAL**: No user story UI work until T004–T009 complete

- [x] T004 [P] Implement GitHub URL parser in `src/lib/github-url.ts` per `contracts/get-repositories.md` and handoff URL table
- [x] T005 Implement fetch/rank/cap/dedupe in `src/lib/github-fetch.ts` (stars DESC, pushedAt DESC; catalogue 2000; spiral slice 800; concurrency 3; max 10 pages/source; custom path excludes default owner unless explicitly in `sources` — FR-022)
- [x] T006 Extend `Repository` with `sourceLogin`, `sourceKind`, `sourceUrl` in `src/lib/repositories.ts`
- [x] T007 Refactor `getRepositories` to POST with `{ sources? }` in `src/lib/repositories.functions.ts` — default owner path + 15-min memory cache + fallback JSON only when `isDefault`
- [x] T008 Create Zustand persist store in `src/lib/sources-store.ts` (`repoatlas.sources.v1`, `setLoaded`, `resetToDefault`, ephemeral `dialogOpen`/`setDialogOpen` not persisted; write `urls`/`sourceKey`/`isDefault` only on successful Load — FR-016)
- [x] T009 Create `src/lib/use-atlas-repositories.ts` shared hook wrapping `useQuery` with `queryKey: ["repositories", sourceKey]` and `placeholderData: keepPreviousData` (data-layer half of FR-021; atlas overlay in T022)

**Checkpoint**: `getRepositories` callable with default and custom sources; types compile

---

## Phase 3: User Story 1 — Load GitHub profiles (Priority: P1) 🎯 MVP

**Goal**: Paste GitHub URLs, Load, and update spiral + all data pages (replace-only custom set)

**Independent Test**: Load `https://github.com/octocat` → all four routes show octocat public repos only; marbles interactive

### Implementation for User Story 1

- [x] T010 [P] [US1] Create `src/components/atlas/SourcesDialog.tsx` layout per `contracts/sources-dialog-ui.md` (5 rows, Add more, Load/Cancel)
- [x] T011 [US1] Wire Load handler in `src/components/atlas/SourcesDialog.tsx` calling `getRepositories` and `sources-store.setLoaded` on success; on duplicate URL parse show toast `Removed duplicate: {login}` per `contracts/sources-dialog-ui.md`
- [x] T012 [US1] Mount `SourcesDialog` once in `src/routes/__root.tsx` (single dialog instance; open/close via `sources-store.dialogOpen` so chip and header work on every route)
- [x] T013 [US1] Integrate `use-atlas-repositories` in `src/routes/index.tsx` (header **Add sources**, hero **Load GitHub users** — both call `setDialogOpen(true)`); FR-021: when `isFetching && repositories.length`, show `AtlasLoading` overlay without unmounting `AtlasScene`
- [x] T014 [P] [US1] Integrate `use-atlas-repositories` + header **Add sources** + sources chip (opens dialog) in `src/routes/catalogue.tsx`; FR-021: existing loading copy during refetch when prior data exists
- [x] T015 [P] [US1] Integrate `use-atlas-repositories` + header **Add sources** + sources chip (opens dialog) in `src/routes/categories.tsx`; FR-021: same refetch loading behavior as T014
- [x] T016 [P] [US1] Integrate `use-atlas-repositories` + header **Add sources** + sources chip (opens dialog) in `src/routes/insights.tsx`; FR-021: same refetch loading behavior as T014
- [x] T017 [US1] Verify replace-only custom load end-to-end (FR-022) per quickstart §3 after T005 pipeline lands
- [x] T018 [US1] Show truncation toasts when catalogue/spiral caps apply in `src/components/atlas/SourcesDialog.tsx` or shared toast helper

**Checkpoint**: Custom load works end-to-end on all atlas pages; default unchanged until Load

---

## Phase 4: User Story 2 — Control and restore default (Priority: P1)

**Goal**: Cancel/empty Load/reset preserve trust; failed custom load never swaps in default fallback

**Independent Test**: Cancel dialog → default unchanged; Reset → imdadareeph returns; failed load → prior dataset kept

### Implementation for User Story 2

- [x] T019 [US2] Implement Cancel/close without persisting draft rows in `src/components/atlas/SourcesDialog.tsx`
- [x] T020 [US2] Implement empty-row `VALIDATION_EMPTY` on Load in `src/components/atlas/SourcesDialog.tsx`
- [x] T021 [US2] Implement **Reset to default** with `AlertDialog` in `src/components/atlas/SourcesDialog.tsx` clearing store and invalidating query
- [x] T022 [US2] FR-021 acceptance: validate quickstart §5 — marbles stay mounted, `AtlasLoading` on explore refetch (T013), list-page loading copy (T014–T016), dialog `Loading…` disabled (T011); `keepPreviousData` from T009
- [x] T023 [US2] On total custom failure, preserve prior dataset and block `repositories-fallback.json` in `src/lib/repositories.functions.ts` (FR-014)

**Checkpoint**: All US2 acceptance scenarios in `spec.md` pass

---

## Phase 5: User Story 3 — Errors and recovery (Priority: P2)

**Goal**: Documented error catalog with row-level and toast feedback; partial source success

**Independent Test**: Invalid URL, 404 user, rate limit — correct message; partial 2/3 sources still loads data

### Implementation for User Story 3

- [x] T024 [P] [US3] Add structured error helper `src/lib/atlas-errors.ts` with codes from `contracts/error-catalog.md`
- [x] T025 [US3] Throw/map structured errors from `src/lib/github-fetch.ts` and `src/lib/repositories.functions.ts`
- [x] T026 [US3] Map errors to inline row + toast UI in `src/components/atlas/SourcesDialog.tsx`
- [x] T027 [US3] Implement partial failure (`PARTIAL_FAILURE`) returning successful repos + `warnings[]` in `src/lib/github-fetch.ts`
- [x] T028 [US3] Implement `DEFAULT_FALLBACK` once-per-session toast on default path in `src/routes/index.tsx` via `sessionStorage` flag `repoatlas.toast.fallback`

**Checkpoint**: quickstart.md §7 error paths pass

---

## Phase 6: User Story 4 — Export JSON (Priority: P2)

**Goal**: Download active catalogue dataset as JSON

**Independent Test**: Export after load → file matches `contracts/export-json.md` schema

### Implementation for User Story 4

- [x] T029 [P] [US4] Create `src/lib/export-repositories.ts` client download per `contracts/export-json.md`
- [x] T030 [US4] Add **Export JSON** header control on `src/routes/index.tsx` (disabled when loading or empty)
- [x] T031 [P] [US4] Add **Export JSON** to catalogue/categories/insights headers where atlas chrome exists

**Checkpoint**: Export includes full catalogue (≤2000), not spiral-only 800

---

## Phase 7: User Story 5 — Repeat visits (Priority: P3)

**Goal**: Saved custom URLs restore on refresh; 15-minute server cache policy

**Independent Test**: Load custom sources → refresh → same URLs without re-entry; within cache window metadata may match prior fetch

### Implementation for User Story 5

- [x] T032 [US5] Regression-check: `urls`/`sourceKey`/`isDefault` never persist on Cancel, draft edit, or failed Load — only `setLoaded` after success (FR-016; see T008)
- [x] T033 [US5] Regression: browser refresh restores saved `urls`/`sourceKey` and re-fetches (or cache-hits) without re-opening dialog (FR-020; hook wiring is T009 + T013–T016)
- [x] T034 [US5] Verify server cache TTL (~15 min) applies to custom `sourceKey` in `src/lib/repositories.functions.ts`

**Checkpoint**: quickstart.md §2 step 5–6 and Phase 1 refresh scenarios pass

---

## Phase 8: SQLite cache (Plan Phase 2)

**Purpose**: Optional local durable cache; memory-only on Cloudflare Workers

- [x] T035 [P] Create `data/schema.sql` and `data/.gitkeep` per `data-model.md`
- [x] T036 Create `src/lib/storage/atlas-store.ts` factory (Memory + guarded FileSqlite)
- [x] T037 Create `src/lib/storage/atlas-store.sqlite.ts` with dynamic `bun:sqlite` import (no top-level import in Worker graph)
- [x] T038 Wire cache upsert/read in `src/lib/repositories.functions.ts`
- [x] T039 [P] Create `scripts/atlas-db-init.ts`
- [x] T040 [P] Create `scripts/atlas-export.ts`
- [x] T041 [P] Create `scripts/atlas-db-reset.ts` (requires `ATLAS_DB_RESET=1`)
- [x] T042 Add `db:init`, `db:export`, `db:reset` scripts to `package.json`
- [x] T043 Update `AGENTS.md` with db commands

**Checkpoint**: `bun run db:init` works locally; `bun run build` still bundles for Workers

---

## Phase 9: Environment & AI adapter (Plan Phase 3)

**Purpose**: `.env.example`, provider adapter, remove client-exposed Gemini key

- [x] T044 Create `.env.example` with full variable table from `docs/dynamic-sources-prompt.md`
- [x] T045 [P] Create `src/lib/ai/types.ts` and `src/lib/ai/providers.ts`
- [x] T046 [P] Move Gemini logic to `src/lib/ai/gemini.ts`
- [x] T047 [P] Add stub providers `src/lib/ai/openai.ts`, `src/lib/ai/anthropic.ts`, `src/lib/ai/grok.ts`
- [x] T048 Refactor `src/lib/ai-summary.functions.ts` to use `generateText` adapter; remove `VITE_GEMINI_API_KEY`
- [x] T049 [P] Update environment section in `README.md` pointing to `.env.example`

**Checkpoint**: AI summaries work with/without `GEMINI_API_KEY`; no secrets in client bundle

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Docs, typecheck, build, manual validation

- [x] T050 [P] Update `PROGRESS.md` with dynamic-sources phase checkboxes
- [x] T051 Run `bunx tsc --noEmit` and fix any type errors across touched files
- [x] T052 Run `bun run build` and confirm no `bun:sqlite` in Cloudflare Worker bundle
- [x] T053 Execute full validation checklist in `specs/001-dynamic-github-sources/quickstart.md` including §9–§11 (cross-route dialog, duplicate toast, SC-007 interaction)
- [x] T054 [P] Cross-check UI strings against `contracts/sources-dialog-ui.md` and handoff §UI copy

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)
  → Phase 2 (Foundational) BLOCKS US1–US5
  → Phase 3 (US1) MVP
  → Phase 4 (US2) — depends on SourcesDialog from US1
  → Phase 5 (US3) — depends on fetch + dialog
  → Phase 6 (US4) — depends on shared query data
  → Phase 7 (US5) — depends on store + server cache
  → Phase 8 (SQLite) — optional after US1–US5 runnable
  → Phase 9 (AI/env) — optional after Phase 8 or parallel if no SQLite
  → Phase 10 (Polish)
```

### User Story Dependencies

| Story | Depends on | Notes |
|-------|------------|-------|
| US1 | Phase 2 | MVP — load + sync four routes |
| US2 | US1 dialog shell | Reset/cancel/loading UX |
| US3 | US1 fetch path | Error catalog |
| US4 | US1 data in query | Export client-side |
| US5 | US1 + store | Persist + refresh |

### Parallel Opportunities

- **Phase 1**: T001, T003 parallel
- **Phase 2**: T004 parallel with prep; T014–T016 parallel after T012
- **Phase 3**: T014–T016 parallel (different route files); T012 blocks route wiring
- **Phase 8**: T035, T039–T041 parallel
- **Phase 9**: T045–T047, T049 parallel

---

## Parallel Example: User Story 1 (after Phase 2)

```bash
# Mount dialog globally first:
T012 __root.tsx

# Wire routes in parallel (different files):
T014 catalogue.tsx
T015 categories.tsx
T016 insights.tsx

# While another dev finishes T011 Load handler in SourcesDialog.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Complete Phase 1–2 (Setup + Foundational)
2. Complete Phase 3 (US1) + Phase 4 (US2)
3. **STOP and VALIDATE** using quickstart.md Phase 1 sections
4. Demo: load octocat, reset to default

### Incremental Delivery

| Milestone | Phases | Delivers |
|-----------|--------|----------|
| MVP | 1–4 | Load, reset, default preserved |
| Beta | 5–7 | Errors, export, refresh persistence |
| Complete | 8–10 | SQLite, env/AI adapter, polish |

### Suggested commit slices

1. `feat: add github fetch pipeline for dynamic sources` (T001–T009)
2. `feat: sources dialog and multi-route query sync` (T010–T023)
3. `feat: error catalog and json export` (T024–T031)
4. `feat: persist custom sources across refresh` (T032–T034)
5. `feat: sqlite cache and db scripts` (T035–T043)
6. `chore: env example and ai provider adapter` (T044–T049)

---

## Notes

- **FR-021 (U1)**: T009 `keepPreviousData` → T011 dialog `Loading…` → T013 `AtlasLoading` overlay → T014–T016 list refetch copy → T022 quickstart §5 validation.
- Do **not** modify `src/components/atlas/AtlasScene.tsx` except trivial type ignores
- Exact user-facing strings live in `docs/dynamic-sources-prompt.md` and `contracts/`
- Phase 4 LLM insight Sheet is **out of scope** (deferred per spec)
- Each checkpoint should pass `bunx tsc --noEmit` before next phase
