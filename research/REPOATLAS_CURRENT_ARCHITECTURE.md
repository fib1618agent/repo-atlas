# RepoAtlas — Current Architecture

Evidence tags: `[EXTRACTED]` directly observed in source/config. `[RESOLVED]` deterministically derived from multiple artifacts. `[INFERRED]` reasonable interpretation. `[UNKNOWN]` insufficient evidence.

## 1. Stack & layout

[EXTRACTED] `package.json` name `tanstack_start_ts`. React 19 + TanStack Start (SSR meta-framework, file-based routes) + TanStack Router + TanStack Query, Vite 8, Nitro targeting **Cloudflare Workers module preset** (`vite.config.ts:20`, `nitro({ defaultPreset: "cloudflare-module" })`). Bun runtime/package manager (`bunfig.toml`, `AGENTS.md`). UI: Radix + Tailwind v4 + shadcn-style `src/components/ui`. 3D: `three` + `@react-three/fiber` + `@react-three/drei`. Client state: `zustand`.

Layout: `src/{components,hooks,lib,routes,types}`, `data/` (SQLite + schema + JSON export), `scripts/` (3 Bun DB scripts), `docs/` (3 prompt/plan markdown files, no formal ADRs), `public/`. No `server/` dir — server logic lives in `*.functions.ts` files via TanStack's `createServerFn`.

## 2. Repository ingestion flow

[EXTRACTED] GitHub-only. `src/lib/github-fetch.ts` exports `fetchDefaultOwnerRepositories` / `fetchCustomRepositories`, hitting `api.github.com` REST directly (no SDK, raw `fetch()`, manual pagination up to 10 pages × 100/page, `github-fetch.ts:118-227`). Bounded concurrency via `mapWithConcurrency` (concurrency=3, `github-fetch.ts:234-253,289`). Source URL parsing in `src/lib/github-url.ts` (`parseSourceInputs`, `sourceKeyFromParsed`, `includesDefaultOwner`, `ParsedSource`).

Entry point: `repositories.functions.ts:13` calls into `github-fetch.ts` directly — no intermediate provider abstraction sits between the server function and the GitHub-specific fetch code.

Root-level Python scripts (`analyze_repos.py`, `process_repos.py`, `check_others.py`, `repos.json`) are outside `src/` — [INFERRED] legacy/one-off data-prep scripts, not part of the live app path.

## 3. Provider architecture

[RESOLVED] **No GitLab (or other) provider exists.** `grep -ri gitlab src/` returns only cosmetic UI: `src/routes/index.tsx:47` `GitLabIcon` SVG + marketing copy (lines 36, 253). `docs/dynamic-sources-prompt.md:120` states "GitLab live sync (badge may stay decorative)"; line 176 lists GitLab/Bitbucket as **explicitly unsupported**. `.env.example`/README env table list only `GITHUB_TOKEN`. There is **no `SourceProvider` interface or equivalent abstraction** — `github-fetch.ts` is GitHub-specific end to end. Any multi-provider abstraction for Code Intelligence ingestion must be designed from scratch; nothing to extend.

## 4. Persistence model

[EXTRACTED] `data/schema.sql` (35 lines), 4 tables:

- `sources` (url, login, kind, added_at)
- `repositories` (id, source_id FK, source_key, full_name, `payload_json` TEXT blob, fetched_at)
- `ai_notes` (repo_id, provider, model, content)
- `meta` (key/value)

WAL mode enabled. Repository data is stored as an **opaque JSON blob** (`payload_json`), not normalized columns. [RESOLVED] No relational or graph modeling exists today — this is a cache of API responses, not a queryable data model.

Cache architecture (`src/lib/storage/atlas-store.ts`): two-tier — `MemoryAtlasCache` (L1, TTL via `ATLAS_CACHE_TTL_MS`, default 900_000ms, `atlas-config.ts:5`) wrapping `FileSqliteAtlasCache` (L2, `atlas-store.sqlite.ts`, dynamically imported). **SQLite is force-disabled on Cloudflare Workers**: `canUseSqlite()` (`atlas-store.ts:47-54`) returns false when `NITRO_PRESET === "cloudflare-module"`, `CF_PAGES` is set, or there's no Node `process.versions.node` — i.e. **production runs memory-only cache**; SQLite is a local-dev/self-host convenience only. Singleton via module-level `atlasCacheSingleton` (`atlas-store.ts:179-192`).

## 5. Search / filtering / taxonomy

[EXTRACTED] `src/routes/catalogue.tsx:53-69` — client-side `Array.filter()`/`.sort()` over the full in-memory repo list on every keystroke (`useMemo` on `query`), substring match via `.toLowerCase().includes()` across concatenated name+description+category+language+topics (line 60). No index, no BM25, no fuzzy matching, no server-side search endpoint.

Taxonomy: `src/lib/repositories.ts:54-126` `classifyRepository()` — pure keyword-heuristic classifier (hardcoded word lists per category, `hasAny()` substring test), 9 fixed categories (`CATEGORY_ORDER`, lines 1-11), no ML/embeddings. `normalizeRepository()` (line 128) computes `importance = log10(stars+1)/5` clamped to 1 — a popularity score, not a graph-centrality score.

## 6. 3D visualization

[EXTRACTED] `src/components/atlas/AtlasScene.tsx` (636 lines) — `@react-three/fiber` `<Canvas>` + `useFrame` loop, `@react-three/drei` `OrbitControls`. Uses `THREE.InstancedMesh` for marbles/halos/pick-targets (lines 134-137) for perf at scale. Layout via `repositoryPosition()` (line 81) — a spiral/"hurricane funnel" layout driven by `index`/`total`, **not** graph-relationship-driven. Color mapped from `Repository.category` (`getCategoryColor`, lines 36-46). Capped by `ATLAS_MAX_SPIRAL_REPOS` (800) even though up to `ATLAS_MAX_STORED_REPOS` (2000) may be cached — visualization and storage caps are explicitly decoupled.

## 7. State management

[EXTRACTED] `zustand` single store `src/lib/atlas-store.ts` (`useAtlasStore`) — client-side UI state only (hoveredId, selectedId, filters, autoRotate, showRelationships). No persistence middleware. Server-state (repo data) flows through TanStack Query (`src/lib/use-atlas-repositories.ts`) — [INFERRED] clean separation: Query owns server data, Zustand owns view state.

## 8. API / server routes

[EXTRACTED] No REST/file-based API routes. Server communication is TanStack Start's `createServerFn` RPC pattern: `src/lib/repositories.functions.ts` exports `getRepositories` (`createServerFn({ method: "POST" })`, `.validator()`, `.handler()`, lines 70-117) — the one real "endpoint," accepting `{ sources?: string[] }`, returning `{ source: "live"|"cache"|"fallback"`, ...}`. `src/lib/ai-summary.functions.ts`is a second server-fn ([UNKNOWN] exact contract, not read in full).`src/server.ts` is the framework-managed Nitro/TanStack Start entry, not custom routing.

## 9. Tests

[RESOLVED] **Zero automated tests.** No `*.test.*`/`*spec.ts*` files found outside `.specify/`. No test framework (vitest/jest/playwright) in `package.json` devDependencies. `AGENTS.md` lists `bunx tsc --noEmit` as the only verification command — typecheck only.

## 10. Docs vs. code

[EXTRACTED] `docs/dynamic-sources-prompt.md`, `docs/prompt.md`, `docs/plan.md` read as original feature-planning prompts (source of `specs/001-dynamic-github-sources`), not living architecture docs. `docs/dynamic-sources-prompt.md:176` explicitly scopes out GitLab/Bitbucket, matching code reality. [UNKNOWN] contents of root `PROGRESS.md`/`roadmap.md` not verified against code in this pass.

## 11. Extension points for Code Intelligence

[RESOLVED] Reusable seams:

- `AtlasCache` interface (`storage/atlas-store.ts:32-39`) — pluggable L1/L2 backend pattern a future graph/AST cache could follow.
- `createServerFn` RPC pattern — ready template for new endpoints (e.g. a future `getEngineeringGraph` fn).
- `sources`/`repositories` schema shape (`source_key`/`payload_json`) could extend to snapshot/commit-keyed rows without a redesign.
- `mapWithConcurrency` (`github-fetch.ts:234`) — reusable bounded-concurrency primitive for future AST-parsing fan-out.

[INFERRED] No job queue, worker-thread, or background-processing pattern exists — everything today is synchronous request/response inside a server-fn call. Any AST/graph indexing pipeline (likely long-running) has **no existing async infrastructure to build on**.

## 12. Constraints Code Intelligence must respect

[EXTRACTED] Production target is Cloudflare Workers (`vite.config.ts:20`). Workers impose per-request CPU-time limits, no native Node filesystem/SQLite at the edge (the exact reason `canUseSqlite()` disables SQLite there), and no long-running background processes. [INFERRED] Any AST parsing / graph-building workload heavy enough to need real compute cannot run inline in a Worker request — will need an external/offline indexing step, a Node-only deployment target, or a queue/durable-object-style async model not present today. Local dev (Bun/Node) gets SQLite; edge prod does not — precedent for graceful two-tier capability handling already exists in the cache layer and should be followed for any new persistence.

## 13. Existing Spec Kit state

[EXTRACTED] `.specify/`: `.gitignore`, `feature.json`, `init-options.json`, `integration.json`, dirs `integrations/`, `memory/`, `scripts/`, `templates/`, `workflows/` — standard Spec Kit scaffold, initialized.

`specs/`: one feature, `specs/001-dynamic-github-sources/` — `spec.md`, `plan.md`, `research.md`, `data-model.md`, `tasks.md`, `quickstart.md`, `checklists/requirements.md`, `contracts/{get-repositories.md, error-catalog.md, sources-dialog-ui.md, export-json.md}`. This is the only existing spec; no Code Intelligence spec exists.

## Summary of hard facts for downstream docs

- No provider abstraction (single-provider, GitHub-only, no interface layer).
- No relational/graph persistence — JSON blob cache only, and cache is memory-only in prod (Workers).
- No search index of any kind — substring filter over an in-memory array.
- No async/background job infrastructure.
- No tests.
- Production runtime is edge/Workers-constrained — this is the single most consequential constraint for any Code Intelligence design (see `SOURCE_PROVIDER_ANALYSIS.md` and `CODE_INTELLIGENCE_GAP_ANALYSIS.md`).
