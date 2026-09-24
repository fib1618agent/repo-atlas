# Research: Repository Intelligence Visualization

Findings from reading the repository on 2026-09-24. Labels follow `CLAUDE.md`: FACT (read in code/docs), UNKNOWN, DECISION.

## R1. What data exists (FACT)

- **Feature 003 provider**: `getRepositories` (`src/lib/repositories.functions.ts`) returns `Repository[]` with `fullName`, `htmlUrl`, `language`, `topics`, `stars`, `forks`, `pushedAt`, `defaultBranch`, `category`, `sourceLogin`, `sourceKind` from user/org/repo URL sources (`github-url.ts`, `github-fetch.ts`, cached by `storage/atlas-store`). `useAtlasRepositories()` drives it from the sources store. A single `https://github.com/{owner}/{name}` source is a valid "repo" source (Mode 2).
- **Feature 001** (D1): `repositories(provider, owner, name)`, `snapshots(status, commit_sha, completed_at)`, `snapshot_files(path, size_bytes, content_hash)`; server functions `acquireSnapshot`, `getSnapshotStatus`, `listSnapshotFiles`, `getSnapshotFile`, `getRepositoryHistory`.
- **Feature 002** (D1): `directories(path, parent_path)`, `file_extractions(language, status, failure_reason)`, `symbols(kind ∈ module|class|interface|function|method, name, qualified_name, start/end line+column, parent_symbol_id, is_exported)`, `snapshot_extractions`; server functions `getExtractionStatus`, `listSymbols`, `getFileExtraction`, `getSymbol` (with provenance).
- **Not present**: a list-by-file symbols function; a directory-children function; language composition; any relationship data (Feature 004 tables exist in the schema file but have no writers or readers).

## R2. Runtime availability (FACT)

- F001/F002 read helpers need `CloudflareEnv.DB`. Plain `./run.sh` has no bindings → Feature 006's status shows `no_binding`. The Feature 001 quickstart's documented local path is `wrangler dev --local` (Miniflare emulation) with the schema applied.
- Consequence: through the app in plain dev, INTEL data cannot exist; the view must render an honest `unavailable` state. Real-data INTEL validation needs D3.

## R3. Existing read functions have side effects (FACT)

- `getRepositoryHistoryHandler` calls `getOrCreateRepository` (INSERT-or-select). Not read-only. DECISION: Feature 009 does not call it; it uses its own SELECT-only lookup (same pattern as Feature 006 `code-intel-status.ts`).
- `acquireSnapshotHandler` writes and enqueues. DECISION: never called (D1 in the spec).

## R4. Reusable pieces (FACT)

- Route/page shell: `src/routes/settings.tsx`, atlas classes (`atlas-page`, `atlas-header`, `atlas-nav-item`, `atlas-eyebrow`, `atlas-section-label`), `RepoAtlasLogo`, shadcn `badge`, `button`, `skeleton`, `alert`, `table`.
- Colour: `CATEGORY_TOKEN` and `LANG_COLORS` (in `RepositoryPanel.tsx`, local constant). Feature 009 needs a language colour lookup; DECISION: read the same palette by extracting it to a shared module only if a minimal, behavior-preserving edit is acceptable; otherwise duplicate a small generic palette in the new module (no edit to `RepositoryPanel`). Chosen: new module, no edit (SC-006).
- Data fetching: TanStack Query + `useServerFn` (as `use-atlas-repositories.ts`, `settings.tsx`).
- Tests: `bun test --isolate`, `tests/support/d1-sqlite-adapter.ts`, `memory-r2.ts`, `fake-github.ts`, `tar-fixture.ts`, `setTestCloudflareEnv`; UI tests via `renderToStaticMarkup`.
- Types-only reuse from Feature 004 scaffolding: `src/lib/code-intel/domain/relationship.ts` (`RelationshipType`, `EvidenceState`) exists (T004 done). Feature 009 imports **types only**; no runtime dependency on Feature 004 code (which stays blocked).

## R5. Visualization dependencies (FACT)

- Installed: `three`, `@react-three/fiber`, `@react-three/drei`. No 2D graph/chart libraries (no d3, cytoscape, sigma). `AtlasScene.tsx` (636 lines) is the existing marble scene.
- DECISION D2: SVG renderer + pure layout; no new dependency (FR-018). Bounded DOM (≤ MAX_VISIBLE_NODES elements) keeps SVG cheap; every node is a real focusable element.

## R6. Bounding strategy (DECISION)

- One directory level per fetch (children page ≤ `listFilesMaxLimit`, default 500 from `codeIntelConfig()`), client renders at most `MAX_VISIBLE_NODES = 60`; remaining children are aggregated into "+N more" cluster nodes grouped by kind (directories, files by language) with true counts; the outline lists everything loaded (paged) so no information is hidden from keyboard/AT users.
- Symbols per file: fetch ≤ `MAX_SYMBOLS_FETCH = 200` and render them as an accessible **text list** (parent hierarchy collapsed by `symbol-tree`); when `truncated`, the true `symbolCount` is shown. The `MAX_VISIBLE_NODES = 60` cap applies to the **SVG structure map only** (directories/files), not to the symbol list. *(Amended 2026-09-24: the earlier "render ≤ 60 symbol nodes" wording did not match the implementation.)*
- Values are named constants in one module and tested. They are UI bounds, not CPU claims.

## R7. Query adequacy (UNKNOWN → checked in T009)

- `directories` has `UNIQUE(snapshot_id, path)` but no `parent_path` index; a children query filters within one snapshot's directories (bounded by directories per snapshot). `snapshot_files` has `UNIQUE(snapshot_id, path)`; files-in-directory uses a path-prefix range plus a "no further slash" filter. `symbols` has `idx_symbols_file_extraction`. Feature 009 adds no schema; T009 records `EXPLAIN QUERY PLAN` results on the sqlite adapter (local, comparative) and states any scan honestly.

## R8. Identity (DECISION)

- Route params validated by SEC-001 regexes; canonical identity = provider `full_name`; D1 lookups use the canonical owner/name exactly (Feature 001's unique key is exact-case). A URL differing only by case is normalized via replace-navigation to canonical.

## R9. Real-data acceptance (DECISION: D3 option (a) CONFIRMED 2026-09-24)

- PROVIDER results (AT-009-01/02/03 and metadata) are testable in plain dev against the real public targets.
- INTEL results (AT-009-04/05 with data) need a populated D1. Recommended proof path (a): opt-in test `REPOATLAS_REAL_DATA=1` running the existing F001 acquisition and F002 extraction pipelines against the public GitHub archive into the sqlite adapter, then calling the Feature 009 handlers; UI-with-data checks use fixtures captured from that real output and are labelled as such.
- **D3 = option (a), confirmed by the user 2026-09-24:** Feature 009 consumes intelligence produced by the existing F001/F002 pipelines. Production Feature 009 code contains no acquisition, `REPOATLAS_REAL_DATA`, sqlite, Wrangler or Cloudflare-specific acquisition logic. The opt-in test `tests/integration/repo-intel/real-data.test.ts` is validation evidence only. D1 (read-only, no acquisition, no D1 mutation, no repository creation) and D2 (existing SVG renderer + accessible outline) are also confirmed.
- Relationship data: none exists, so AT-009-06 is testable in every environment.

## R10. Risks

| Risk | Mitigation |
|---|---|
| Owner-level "graph" misread as engineering relationships | Copy and visual language distinct (catalogue chips, no edges); test that no owner→repo link is rendered as a thread |
| SVG performance on dense levels | Hard node cap, aggregation, no per-frame animation |
| Deep link without loaded source | Metadata resolved through `getRepositories({ sources: [repoUrl] })` in an isolated query, never mutating the sources store |
| Public GitHub rate limit in real-data runs | Explicit `provider_error` state; record limits in results; optional `GITHUB_TOKEN` via existing server env only |
| F001/F002 data absent in plain dev | Honest `unavailable`/`no_snapshot` states; D3 decision |

## R11. Sources-store hydration (FACT, pre-existing, OUT OF SCOPE)

- Observed 2026-09-24 in the dev environment: `useSourcesStore.persist.hasHydrated()` is `false` on every route at load, so `useAtlasRepositories` (`enabled: hasHydrated`) never fetches and `/catalogue` and Explore show "0 of 0 repositories" until `useSourcesStore.persist.rehydrate()` is called. Suspected cause (UNVERIFIED): `onRehydrateStorage` calls `useSourcesStore.setState` during store creation. Files: `src/lib/sources-store.ts`, `src/lib/use-atlas-repositories.ts` (not modified by Feature 009).
- **Decision (user, 2026-09-24): not fixed in Feature 009; tracked as a separate pre-existing issue.** Feature 009's own provider lookup (`use-repository-context.ts`) is deliberately not gated on the hydration flag, so `/repository/$owner/$name` works without it.
- **Test-environment workaround, evidence only:** AT-009-01 (catalogue lists the user's repositories) and the Explore-entry check were run after calling `useSourcesStore.persist.rehydrate()` and, for the Explore panel, selecting the repository through the atlas store from the test page. No application code was changed for this. AT-009-01 therefore PASSES only with that workaround; without it the pre-existing bug shows an empty catalogue.
