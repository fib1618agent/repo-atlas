# Implementation Plan: Dynamic GitHub Sources

**Branch**: `001-dynamic-github-sources` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-dynamic-github-sources/spec.md`

**Implementation handoff**: [`docs/dynamic-sources-prompt.md`](../../docs/dynamic-sources-prompt.md) (authoritative for file paths, copy, phases, env table)

## Summary

Enable visitors to paste up to five GitHub user/org/repo URLs, load public repositories into the existing 3D atlas and data pages, export JSON, and restore the default `imdadareeph` atlas on demand. Default behavior is unchanged until a successful Load. Server-side GitHub fetch with 15-minute cache, optional local SQLite, shared React Query key across four routes, and no changes to `AtlasScene` funnel math.

## Technical Context

**Language/Version**: TypeScript 5.8+, Bun (or Node 22+)

**Primary Dependencies**: TanStack Start/Router/Query, React 19, Zustand, Three.js/R3F (unchanged), Radix Dialog, sonner

**Storage**: In-memory TTL cache (15 min); browser `localStorage` (`repoatlas.sources.v1`); optional `data/atlas.sqlite` via `bun:sqlite` (local only)

**Testing**: Manual quickstart scenarios (`quickstart.md`); `bunx tsc --noEmit`; `bun run build` for Worker bundle safety

**Target Platform**: Dev — Bun/Vite local; Prod — Cloudflare Workers (Nitro `cloudflare-module`)

**Project Type**: Single TanStack Start web app (`src/`)

**Performance Goals**: Load ≤500 repos in <30s (SC-001); 800 interactive marbles ≥30 FPS on reference device in `quickstart.md` §11 (SC-007); export ≤2k repos in <5s (SC-005)

**Constraints**: Max 5 sources, 800 spiral, 2000 catalogue; secrets server-only; no `VITE_*` keys; `AtlasScene` data-only changes

**Scale/Scope**: ~15 new/modified source files; 4 route updates; 3 implementation phases + deferred Phase 4 LLM sheet

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Plan |
|-----------|------------|------|
| I. Data Fidelity | PASS | GitHub-only metadata; default until Load; no fallback mix on custom fail |
| II. Visualization-First | PASS | Feed `repositories[]` to `AtlasScene`; shared `queryKey`; no scene rewrite |
| III. Server Secrets | PASS | Server functions; `.env.example`; SQLite adapter fails open on Workers |
| IV. Performance Budgets | PASS | Caps enforced in `github-fetch`; ranking shared; `keepPreviousData` |
| V. Simplicity | PASS | Extend existing libs/components; phased delivery; conventional commits |

**Post-design re-check**: PASS — no constitution violations; optional SQLite justified by handoff Phase 2 and Workers fallback documented in `research.md` §4.

## Project Structure

### Documentation (this feature)

```text
specs/001-dynamic-github-sources/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1 validation
├── contracts/           # Phase 1 interfaces
│   ├── get-repositories.md
│   ├── export-json.md
│   ├── error-catalog.md
│   └── sources-dialog-ui.md
├── checklists/
│   └── requirements.md
└── tasks.md             # 54 tasks (T001–T054)
```

### Source Code (repository root)

```text
src/
├── components/atlas/
│   └── SourcesDialog.tsx          # NEW
├── lib/
│   ├── github-url.ts              # NEW — parse/validate
│   ├── github-fetch.ts            # NEW — paginate, rank, cap
│   ├── sources-store.ts           # NEW — Zustand + persist
│   ├── repositories.ts            # ADD sourceLogin, sourceKind, sourceUrl
│   ├── repositories.functions.ts  # REFACTOR parameterized POST
│   ├── ai-summary.functions.ts    # Phase 3 — use adapter
│   ├── ai/                        # Phase 3 — provider adapter
│   │   ├── types.ts
│   │   ├── providers.ts
│   │   ├── gemini.ts
│   │   ├── openai.ts              # stub
│   │   ├── anthropic.ts           # stub
│   │   └── grok.ts                # stub
│   └── storage/
│       ├── atlas-store.ts         # Phase 2 — factory
│       └── atlas-store.sqlite.ts  # Phase 2 — dynamic import
├── routes/
│   ├── __root.tsx                 # SourcesDialog mount (single instance)
│   ├── index.tsx                  # Add sources, export, queryKey
│   ├── catalogue.tsx
│   ├── categories.tsx
│   └── insights.tsx
data/
├── schema.sql                     # Phase 2
└── .gitkeep
scripts/
├── atlas-db-init.ts
├── atlas-export.ts
└── atlas-db-reset.ts
.env.example                       # Phase 3
```

**Structure Decision**: Single TanStack Start app; all server logic in `src/lib/*.functions.ts` and storage adapters; no new routes required.

## Implementation Phases

Aligned with `docs/dynamic-sources-prompt.md`. Branch MUST remain runnable after Phase 1, 2, and 3.

### Phase 1 — Sources dialog + fetch + export (P1/P2 spec stories)

**Goal**: Usable multi-source atlas without SQLite.

| Step | Work |
|------|------|
| 1.1 | `github-url.ts` — parse user/org/repo, reject invalid hosts |
| 1.2 | `github-fetch.ts` — paginate (10×100), concurrency 3, dedupe, rank, cap |
| 1.3 | Refactor `repositories.functions.ts` — POST body, default vs custom paths, structured errors |
| 1.4 | `sources-store.ts` — persist after successful Load only |
| 1.5 | `SourcesDialog.tsx` — UI per `contracts/sources-dialog-ui.md`; mount once in `__root.tsx` |
| 1.6 | Wire header **Add sources** / hero / chip on four routes; `queryKey: ["repositories", sourceKey]` |
| 1.7 | Toasts + error catalog mapping; `placeholderData: keepPreviousData`; `AtlasLoading` overlay on explore refetch (FR-021) |
| 1.8 | Ranking: stars DESC, pushedAt DESC; spiral = top 800 of catalogue ranking |

**Files**: See handoff §Files to add/change (Phase 1 subset).

**Validate**: `quickstart.md` Phase 1 sections; `tsc --noEmit`.

### Phase 2 — SQLite cache + scripts (P3 persistence)

**Goal**: Local durable cache; memory on Workers.

| Step | Work |
|------|------|
| 2.1 | `data/schema.sql`, `.gitignore` sqlite + `data/atlas-export.json` |
| 2.2 | `atlas-store.ts` factory — Memory + guarded FileSqlite |
| 2.3 | `atlas-store.sqlite.ts` — dynamic `bun:sqlite` import |
| 2.4 | Wire upsert/read in `getRepositories` with TTL |
| 2.5 | `package.json` scripts `db:init`, `db:export`, `db:reset` |
| 2.6 | Update `AGENTS.md` |

**Validate**: `quickstart.md` Phase 2; `bun run build` (no Worker sqlite import).

### Phase 3 — `.env.example` + AI provider adapter

**Goal**: Documented env; Gemini via adapter; stubs for other providers.

| Step | Work |
|------|------|
| 3.1 | Create `.env.example` per handoff §Environment |
| 3.2 | `src/lib/ai/*` — `generateText`, `getActiveProvider` |
| 3.3 | Migrate `ai-summary.functions.ts`; remove `VITE_GEMINI_API_KEY` |
| 3.4 | README env pointer |

**Validate**: `quickstart.md` Phase 3; summaries still work with/without key.

### Phase 4 — Deferred

LLM insight Sheet (`docs/dynamic-sources-prompt.md` §Phase 4). **Not in this plan's tasks** unless explicitly requested.

## Key Algorithms

### `sourceKey` derivation

```text
isDefault → "imdadareeph"
custom    → sorted unique logins joined by "+"
```

### Ranking (shared)

```text
sort by stars DESC, pushedAt DESC
catalogue = take 2000
spiral    = catalogue[0:800]
```

### Default vs custom fetch

```text
if sources empty → fetch ATLAS_DEFAULT_OWNER
                 → on fail use repositories-fallback.json
if sources set   → fetch each source
                 → on total fail keep prior client dataset
                 → never use fallback.json
```

## Complexity Tracking

> No constitution violations requiring justification.

| Addition | Justification |
|----------|---------------|
| Storage adapter | Workers vs local filesystem; single interface avoids duplicate cache logic |
| Zustand persist store | Spec FR-016; minimal vs React Query persist for source URLs only |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| GitHub rate limit | `GITHUB_TOKEN`; concurrency 3; 15-min cache; error catalog |
| Worker bundles sqlite | Dynamic import; factory returns Memory on CF |
| Stale cross-page data | Single `queryKey` on 4 routes |
| Scene regression | No `AtlasScene.tsx` changes except type fields |

## Next Steps

1. **`/speckit-analyze`** — complete (FR-021 loading UX + SC-007 hardware baseline applied)
2. Optional: **`/speckit-checklist`** for quality gates before implement
3. Run **`/speckit-implement`** following `tasks.md` phases 1 → 10 (MVP: phases 1–4, T001–T023)

**Suggested commit message** (after tasks/implement):

```text
feat: dynamic GitHub sources (spec 001 phases 1–3)
```
