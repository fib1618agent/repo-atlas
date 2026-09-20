# Implementation Plan: GitHub Source Enhancement

**Branch**: `003-github-source-enhancement` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-github-source-enhancement/spec.md`

## Summary

Consolidate the three existing, duplicated-per-page navbar source controls
(Add Sources / Export JSON / source chip) into a single "Sources ▼" dropdown;
add a read-only Connected Sources popup driven entirely by existing
repository/source state; extend the existing Add Sources dialog with an
explicit two-mode selector (load-all-for-user vs. specific-repositories) over
already-existing URL-kind parsing; collapse the category legend by default
(stats already unaffected); and make the implicit "auto-load default owner
on startup" behavior explicit and configurable via a new
`loadInitialSources`/`initialSources` server-side setting. All six pieces are
additive, app-layer-only changes: one new component
(`SourcesMenu`, replacing `AtlasSourcesChrome`), one new component
(`ConnectedSourcesDialog`), an in-place extension of `SourcesDialog`, a
one-line default-value change in `index.tsx`, and a small extension of
`atlas-config.ts`/`repositories.functions.ts`'s existing default-path branch.
No Feature 001/002 code, no D1/R2/Queue/WASM surface, no graph visualization
change.

## Technical Context

**Language/Version**: TypeScript (existing project toolchain — Bun runtime, same as rest of repo)

**Primary Dependencies**: React, TanStack Start (`createServerFn`), TanStack Router, TanStack Query, Zustand (`persist`), existing shadcn/Radix UI primitives already in `src/components/ui/` (`dropdown-menu.tsx`, `dialog.tsx`, `tabs.tsx`, `accordion.tsx`) — no new npm dependency

**Storage**: N/A for this feature (no new D1/R2 tables; `StartupSourceConfig` is env-var-backed like existing `atlas-config.ts` settings; `ConnectedSource`/`SelectedRepositoryForAnalysis` are derived/transient client-side view-models, not persisted — see data-model.md)

**Testing**: `bun test` (existing project convention) for any new pure-logic units (e.g. `ConnectedSource` derivation, mode-based row validation); manual verification per `quickstart.md` for UI behavior (this repo has no existing component/UI test harness to extend)

**Target Platform**: Same as existing app — Cloudflare Workers (Nitro `cloudflare-module` preset) in production, `bun run dev`/`vite dev` locally; this feature touches no Cloudflare binding directly

**Project Type**: Single TanStack Start web application (existing structure, not a new project type)

**Performance Goals**: No new performance goals — must not regress existing atlas load/interaction performance (Constitution IV); Connected Sources popup and Sources menu are simple, infrequently-opened UI, no per-frame cost

**Constraints**: Constitution I (Data Fidelity), II (Visualization-First), III (Server-Side Secrets), IV (Performance Budgets — existing 5-source/800-marble/2000-row caps unchanged), V (Simplicity — extend existing primitives, no new libraries)

**Scale/Scope**: 2 new components, 1 extended component (in place), 1 extended server function (default-path branch only), 1 config module extension, 1 route file one-line change; ~4 call-site edits (one per existing route header)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Data Fidelity | Default owner remains active until a custom load succeeds (unchanged); empty/cancelled dialogs still don't mutate the dataset (Mode 1/2 both route through existing `handleLoad`, unchanged cancel/empty-state handling); `loadInitialSources:false` is a new *explicit* empty-start state, not an invented-data path. | PASS |
| II. Visualization-First, Data-Driven | `AtlasScene` untouched; all four routes continue sharing one React Query key derived from `sourceKey` (unchanged — `getRepositories` signature unchanged, only its internal default-path branch gains logic); `CATEGORY_ORDER`/classifier untouched. | PASS |
| III. Server-Side Secrets & Resilience | `loadInitialSources`/`initialSources` follow the existing server-only env-var pattern (`serverAtlasConfig()`), no `VITE_*` exposure; existing GitHub-fetch-in-server-function and caching behavior untouched; existing error catalog (`atlas-errors.ts`) reused for new degraded/error statuses and initial-source failures, no new ad-hoc error strings. | PASS |
| IV. Performance Budgets | `ATLAS_MAX_SOURCES` (5) enforced identically across both Add Sources modes combined (research.md §3); no new per-frame work; Sources menu/Connected Sources popup are ordinary DOM, not scene elements. | PASS |
| V. Simplicity & Minimal Scope | No new npm dependency (reuses `dropdown-menu.tsx`/`tabs.tsx`); `SourcesDialog` extended in place rather than replaced (explicit spec requirement); `SourcesMenu` is a drop-in replacement, not a broader Navbar refactor (research.md §1 — explicit decision to keep scope minimal). | PASS |

No violations — Complexity Tracking table below is empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-github-source-enhancement/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── sources-menu-components.md
│   └── get-repositories-extension.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

Existing single-project TanStack Start structure (Option 1 shape, web-app
flavor already established by the repo — no new top-level directories):

```text
src/
├── components/
│   └── atlas/
│       ├── SourcesMenu.tsx            # NEW — replaces AtlasSourcesChrome.tsx call sites
│       ├── AtlasSourcesChrome.tsx     # REMOVED (superseded by SourcesMenu.tsx) or left
│       │                              #   unused per implementation choice — see Complexity/decision note below
│       ├── ConnectedSourcesDialog.tsx # NEW
│       └── SourcesDialog.tsx          # EXTENDED in place (mode selector added)
├── lib/
│   ├── atlas-config.ts                # EXTENDED (loadInitialSources, initialSources)
│   ├── repositories.functions.ts      # EXTENDED (default-path branch only)
│   └── sources-store.ts               # UNCHANGED (existing precedence already sufficient)
├── routes/
│   ├── index.tsx                      # EDITED (SourcesMenu swap-in; Accordion defaultValue removed)
│   ├── catalogue.tsx                  # EDITED (SourcesMenu swap-in only)
│   ├── categories.tsx                 # EDITED (SourcesMenu swap-in only)
│   └── insights.tsx                   # EDITED (SourcesMenu swap-in only)
└── (code-intel/**)                    # UNTOUCHED — Feature 001/002, out of scope

tests/
└── (new pure-logic unit tests only, if any — e.g. ConnectedSource derivation,
    mode-based row validation; co-located under an existing tests/ convention
    to be confirmed at /speckit-tasks time against this repo's actual test
    layout, which currently only has tests/contract|integration/code-intel|symbols/)
```

**Structure Decision**: Single existing TanStack Start project — no new
top-level directory. This feature adds/edits files exclusively under
`src/components/atlas/`, `src/lib/`, and `src/routes/`, matching the existing
project's flat feature-by-file organization (no per-feature subdirectory
convention exists elsewhere in `src/` outside `code-intel/`, which is its own
feature and explicitly out of scope here).

**Open implementation-time decision (flagged, not resolved by planning)**:
whether `AtlasSourcesChrome.tsx` is deleted outright once `SourcesMenu.tsx`
replaces all four call sites, or left in place temporarily. Per Constitution
V ("do not rewrite published git history" is unrelated, but "smallest
correct change" applies) and this repo's stated convention of deleting
confirmed-unused code rather than leaving dead files, the expected outcome
is **deletion**, once all four call sites are confirmed switched — recorded
here so `/speckit-tasks` creates an explicit task for it rather than leaving
a stray unused file.

## Complexity Tracking

*No Constitution Check violations — table intentionally empty.*
