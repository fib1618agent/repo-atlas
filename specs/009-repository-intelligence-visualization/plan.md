# Implementation Plan: Repository Intelligence Visualization

**Spec**: [spec.md](./spec.md) | **Date**: 2026-09-24  | **Note**: Plan phase; no code yet. Requirement IDs (FR-, NFR-, SEC-, SC-, AT-) are the spec's own.

## Summary

Add a dedicated read-only `/repository/$owner/$name` view. Metadata comes from the existing Feature 003 provider; structure and symbols from Feature 001/002 D1 data through new SELECT-only server functions; the relationship layer is an explicit `unavailable` boundary. A pure, deterministic layout module feeds an SVG renderer (bounded nodes, zoom/pan, keyboard) with an accessible outline twin. Navigation state lives in the URL. No new dependency, table, queue, or write path.

## Technical Context

- **Stack (existing)**: TypeScript, React 19, TanStack Start/Router/Query, Bun, zustand (untouched), shadcn/ui, lucide-react. **No new dependency.**
- **Storage**: none new. Reads D1 tables `repositories`, `snapshots`, `snapshot_files`, `directories`, `file_extractions`, `symbols`, `snapshot_extractions` with SELECT only.
- **Testing**: `bun test --isolate`; sqlite adapter + `setTestCloudflareEnv`; `renderToStaticMarkup` UI tests; opt-in real-data test (`REPOATLAS_REAL_DATA=1`); Playwright browser acceptance; `bunx tsc --noEmit`; `bun run lint` (compare to baseline).
- **Target**: local developer instance first (Feature 006 posture); Workers-compatible code (no Node-only APIs in server modules).
- **Constraints**: FR-010 read-only; FR-012 bounded rendering; FR-016 no state reset; FR-018 no infrastructure.

## Constitution / Governance Check

| Item | Result |
|---|---|
| Data fidelity (trust in displayed data) | PASS: only provider + F001/F002 data; every state honest; no fabricated relationships (SC-002) |
| Secrets server-side | PASS: no secret handled or displayed |
| Performance caps | PASS: named UI limits, one bounded page per step; no CPU claims made |
| Cloudflare Free-plan safety | PASS: no live operation; reads only; D3 governs any local emulation |
| Feature boundaries | PASS: F001/F002/F004/F005/F007 files unmodified |

## Project Structure

```text
specs/009-repository-intelligence-visualization/   spec, plan, research, data-model, quickstart, contracts/, checklists/, tasks.md
src/lib/repo-intel/
  limits.ts                       # named bounds (MAX_VISIBLE_NODES, MAX_CHILDREN_PAGE, MAX_SYMBOLS_FETCH, MAX_COMPOSITION_BUCKETS)
  identity.ts                     # param validation, canonical identity, provider/D1 identity match (pure)
  states.ts                       # DTO + discriminated state types (data-model.md)
  composition.ts                  # pure bucket/aggregate helpers
  layout.ts                       # pure deterministic bounded layout + aggregation
  relationship-layer.ts           # RelationshipLayer port + unavailable implementation (type-only F004 imports)
  intelligence-read-model.ts      # SELECT-only D1 queries (latest completed snapshot, composition, children, file symbols)
  repository-intelligence.functions.ts   # plain handlers + createServerFn wrappers (3 functions)
  use-repository-context.ts       # provider metadata via getRepositories single-source query (no store writes)
src/components/repo-intel/
  RepositoryIntelligenceView.tsx  # composes the view, owns URL-driven state
  RepositoryHeader.tsx  CompositionBar.tsx  IntelligenceStatePanel.tsx
  StructureMap.tsx (SVG)  StructureOutline.tsx  Breadcrumb.tsx
  SymbolPanel.tsx  RelationshipLayerNotice.tsx
src/routes/repository.$owner.$name.tsx           # file route (routeTree.gen.ts regenerated, not hand-edited)
Minimal edits to existing files: RepositoryPanel.tsx, catalogue.tsx (one entry link each); routeTree.gen.ts (generated).
tests/unit/repo-intel/  tests/integration/repo-intel/
```

## Design

1. **Identity (FR-002)**: `identity.ts` validates params (SEC-001), builds `{provider:"github", owner, name}`, and compares (case-insensitively) with the provider `fullName`; canonical casing from the provider is used for D1 and displayed everywhere. Mismatch or unknown → explicit states.
2. **Provider context (FR-004)**: `use-repository-context.ts` first looks in the already-loaded `useAtlasRepositories()` result; if absent, runs an isolated query calling the existing `getRepositories({ data: { sources: [https://github.com/owner/name] } })`. It never calls `useSourcesStore` setters.
3. **Overview read model (FR-005, FR-010)**: one server function `getRepositoryIntelligence({ owner, name })` → `IntelligenceOverview`. No binding → `unavailable`. Otherwise SELECT the repository row (no insert), newest completed snapshot, extraction summary (reusing Feature 002's existing exported read helper where it is a pure SELECT; otherwise an equivalent SELECT in the new module), composition and totals.
4. **Structure (FR-006/012)**: `listStructureLevel` returns one directory's children page; aggregates computed with bounded SELECTs; cursor by id/path order.
5. **Symbols (FR-007)**: `listFileSymbols` returns ≤ 200 symbols for one file path within a snapshot; detail through existing `getSymbol`.
6. **Relationship boundary (FR-009)**: `RelationshipLayer` port + `unavailableRelationshipLayer`; UI `RelationshipLayerNotice` reads the layer state; a contract test asserts that no relationship datum flows into layout/render.
7. **Layout/renderer (FR-012–014, NFR-001/002)**: pure layout → SVG marbles (radial gradients from atlas tokens, category/language colour), roving tabindex, arrow-key focus movement, Enter drills in, Backspace/Escape goes up, zoom buttons + wheel, drag pan (pointer events), `prefers-reduced-motion` honoured; outline list mirrors nodes (all loaded children, paged) and is the primary accessible alternative.
8. **Navigation (FR-001/016)**: search params `path`, `file`, `symbol`; breadcrumb built from `path`; entry links use TanStack `<Link>`; leaving the route touches no shared store.
9. **Responsive (FR-015)**: two-column ≥ lg (map + detail panel), stacked below; SVG `width:100%` with viewBox; no fixed widths.
10. **Real-data validation (D3)**: see quickstart.md; results reported PASS / FAIL / NOT VERIFIED per acceptance test.

## Risks and Mitigations

See research.md R10. Additional: the two entry-link edits touch existing files; each is a single additive element and is reviewed in the scope audit (T031).

## Phase Outputs

Tasks: [tasks.md](./tasks.md). Contracts: [contracts/](./contracts/). Quickstart: [quickstart.md](./quickstart.md).
