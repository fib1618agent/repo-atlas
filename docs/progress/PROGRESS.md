# RepoAtlas — Progress Tracker

> Last updated: 2026-09-21 00:22 +04  
> Status legend: `[ ]` Planned · `[/]` In progress · `[x]` Done · `[-]` Skipped / deferred

---

## Phase 0 — Project Setup

- [x] Inspect existing repository structure
- [x] Read existing component files (`AtlasScene`, `RepositoryPanel`, `AtlasControls`, `RepoAtlasLogo`, `index.tsx`, `styles.css`)
- [x] Read existing lib files (`repositories.ts`, `atlas-store.ts`, `repositories.functions.ts`)
- [x] Inspect `repos.json` dataset structure
- [x] Read `package.json` (confirm Three.js / R3F / Zustand / TanStack already present)
- [x] Create `implementation_plan.md` (artifact)
- [x] Create `PROGRESS.md` (this file)
- [x] Create `run.sh` with smart port selection (prefers 4858, auto-increments)

---

## Phase 1 — Design Tokens & Global Styles (`src/styles.css`)

- [x] Add Google Fonts import (Inter · Space Grotesk · IBM Plex Mono + Manrope 800w)
- [x] Expand category CSS token palette to full 9-category system (hex values for vibrant marbles)
- [x] Add `--atlas-glow`, atmospheric radial vortex glow tokens
- [x] Adjust `atlas-canvas-wrap` left inset to 22rem for better vortex centering
- [x] Add `atlas-vortex-glow` radial CSS overlay behind canvas
- [x] Add `atlas-nav-item`, `atlas-platform-badge`, `atlas-hint` component classes
- [x] Add `atlas-ai-summary`, `atlas-ai-badge`, `atlas-lang-bar` panel component classes
- [x] Add `atlas-hover-card` redesign with hc-* subclasses
- [x] Add `@keyframes atlas-hover-in` entrance for hover card
- [x] Polish footer to three-column layout CSS
- [x] Scrollbar styling for `.atlas-panel`
- [x] Full responsive audit (tablet 1200px, mobile 767px)

---

## Phase 2 — Data Layer (`src/lib/`)

- [x] Expand `CATEGORY_ORDER` to 9 categories in `repositories.ts`
- [x] Add `Security`, `Developer Tools`, `Mobile` classification branches
- [x] Add `importance` scoring based on `log10(stars)` normalised to 0–1
- [x] Update `CATEGORY_TOKEN` map for all 9 categories
- [x] Add `language`, `topic`, `showRelationships`, `resetFilters` to `atlas-store.ts`
- [x] Create `ai-summary.functions.ts` (Gemini API + smart metadata fallback)

---

## Phase 3 — 3D Vortex Upgrade (`src/components/atlas/AtlasScene.tsx`)

- [x] Improved hurricane geometry profile (non-linear crown + waist + base-flare curve)
- [x] Per-particle vertical drift via `useFrame` time-based sine (no React state)
- [x] Per-particle turbulence layer (independent XZ sine/cosine noise)
- [x] Pre-computed seed arrays for turbulence (no allocation in animation loop)
- [x] Atmospheric dust particle count raised to 4,200
- [x] Category angular clustering in particle angular placement
- [x] Added `RelationshipEdges` component (category-derived, budgeted ≤180 idle edges)
- [x] Idle edges: opacity 0.045 white
- [x] Selected edges: nearest category peers highlighted at 0.30 opacity violet
- [x] Switched from oklch CSS var parsing → direct hex `COLOR_MAP` (reliable across environments)
- [x] Added `importance` property to marble size bonus
- [x] Language/topic filter support: dimming logic respects all three active filters
- [x] Added third point light (warm amber at bottom) for depth
- [x] Better camera default: position [0, 0.5, 17], fov 46
- [x] Tuned `fogExp2` density to 0.028

---

## Phase 4 — UI Components

### RepoAtlasLogo (`src/components/atlas/RepoAtlasLogo.tsx`)

- [ ] Upgrade `atlas-mark` to proper orbital SVG icon (three-ring style is good as-is; defer)

### AtlasControls → inline in `index.tsx`

- [x] Auto-rotate Pause/Play button
- [x] Relationship edges toggle (Links button)
- [x] Reset filters button
- [x] Full-screen button
- [x] Keyboard `⌘K` / `Escape` shortcuts

### RepositoryPanel (`src/components/atlas/RepositoryPanel.tsx`)

- [x] AI-powered summary section (`AISummarySection`) with Gemini API + loading state
- [x] Smart metadata-based fallback summary when no API key is set
- [x] GitHub platform badge
- [x] URL row with external link icon and clickable link
- [x] Language colour bar (`LanguageBar` with LANG_COLORS map)
- [x] Taxonomy tree section (`TaxonomyTree`: Category → Subgroup)
- [x] Improved topic chips with hover state
- [x] `atlas-panel-in` entrance animation
- [x] Scrollable panel with custom scrollbar

---

## Phase 5 — Landing Page Composition (`src/routes/index.tsx`)

- [x] Full navigation: Explore / Catalogue / Categories / Insights / About
- [x] `is-active` underline on current nav item
- [x] GitHub + GitLab icons in header
- [x] **"View Profile" links to `http://www.imdadareeph.com/`**
- [x] Primary CTA: `Start Exploring →` (violet→cyan gradient + glow)
- [x] Secondary CTA: `View Profile` (glass outline button)
- [x] 4-metric row: Repositories / Categories / Platforms / Possibilities (∞)
- [x] Atmospheric `atlas-vortex-glow` overlay
- [x] Language filter pills in category legend
- [x] Topic filter pills in category legend
- [x] Clear filters button
- [x] Improved hover card: category dot, name, description (2-line clamp), language + stars
- [x] Centered interaction hint (Drag · Scroll · Click)
- [x] Three-column footer: RepoAtlas | Powered by Open Source | Explore the code…
- [x] Keyboard `Escape` / `⌘K`

---

## Phase 6 — Catalogue Page (`src/routes/catalogue.tsx`)

- [x] New `/catalogue` route with TanStack file-based routing
- [x] Repo grid: 1–4 columns responsive
- [x] Search bar with clear button
- [x] Sort controls: Stars / Forks / Updated / Name
- [x] Collapsible filter panel (Category · Language · Topic)
- [x] Active filter indicator dot on Filters button
- [x] Clear all filters button
- [x] Premium repo cards: name, fullName, category badge (coloured), description, topics, stats, language dot
- [x] Hover lift animation on cards
- [x] Empty state with search icon + clear prompt
- [x] Back to Atlas link

---

## Phase 7 — Polish & Performance

- [x] Build passes zero TypeScript / lint errors (`bun run build` ✓)
- [x] No React state updates inside animation loop (all via `useRef` / direct InstancedMesh writes)
- [x] 4,200 dust particles + up to 92 marble marbles instanced
- [x] Edge budget capped at 180 idle + up to ~20 highlight edges
- [ ] Responsive audit on physical devices (tablet/mobile)
- [x] Add `GEMINI_API_KEY` env var for AI summaries (optional, fallback always works) — see `.env.example`
- [ ] Final visual comparison against reference images

---

## Feature 001 — Dynamic GitHub Sources (`specs/001-dynamic-github-sources/`)

### Phase 1–4 — MVP (sources dialog, fetch, routes, loading UX)

- [x] Setup: `.gitignore`, `atlas-config`, Toaster, `SourcesDialog` mount
- [x] Core: `github-url`, `github-fetch`, refactored `repositories.functions`, `sources-store`, `use-atlas-repositories`
- [x] UI: `SourcesDialog`, `AtlasLoading`, `AtlasSourcesChrome`; wired `/`, `/catalogue`, `/categories`, `/insights`
- [x] FR-021: `keepPreviousData`, explore overlay, dialog `Loading…`

### Phase 5–7 — Errors, export, persist

- [x] Error catalog + per-source failures + dialog row mapping
- [x] `export-repositories.ts` + Export JSON on all routes
- [x] Zustand hydration gate + 15-minute server cache for custom `sourceKey`

### Phase 8 — SQLite cache (local only)

- [x] `data/schema.sql`, `atlas-store.ts` factory, `atlas-store.sqlite.ts` (dynamic import)
- [x] Cache wired in `repositories.functions.ts`
- [x] `db:init`, `db:export`, `db:reset` scripts + `AGENTS.md` docs

### Phase 9 — Environment & AI adapter

- [x] `.env.example` with full variable table
- [x] `src/lib/ai/*` provider adapter (Gemini wired; OpenAI/Anthropic/Grok stubs)
- [x] `ai-summary.functions.ts` uses `generateText`; no `VITE_GEMINI_API_KEY`
- [x] `README.md` environment section

### Phase 10 — Polish

- [x] `bunx tsc --noEmit` passes
- [x] `bun run build` passes (Cloudflare preset; SQLite lazy-loaded, memory-only on Workers)
- [x] UI strings cross-checked against `contracts/sources-dialog-ui.md`
- [ ] Manual quickstart §9–§11 (dialog from every route, duplicate toast, SC-007 FPS)

---

## Feature 001 — Code Intelligence Foundation (`specs/001-code-intelligence-foundation/`)

Implementation: 54/54 tasks (2026-09-19 20:15). Deployment-readiness corrections (20:45). **Final spec verification (21:00): implementation-complete** — minor doc gaps: T040 CPU budget unused, T028 not single D1 transaction; live gate: D1 id, wrangler smoke, real codeload + SC-003/008/009.

- [x] Domain, D1/R2 clients, GitHub `ContentProvider`, archive pipeline, queue worker, `createServerFn` wrappers, schema, tests
- [x] `nitro.config.ts` registers `plugins/cloudflare-queue.ts` (vite.config.ts preset unchanged)
- [x] GitHub codeload `{repo}-{sha}/` path stripping + POSIX pax `path` records in tar parser
- [x] Queue redelivery no-op when `acquisition_jobs` unit already `completed`
- [x] `bun run build` — `.output/server/index.mjs` exports `queue`, bundles `cloudflare:queue` hook + `processSnapshotQueueMessage`
- [x] Generated `.output/server/wrangler.json` includes D1/R2/Queue bindings (merged from root `wrangler.toml`)
- [ ] Replace `wrangler.toml` `database_id` placeholder; provision D1/R2/Queue (deployment-time)
- [ ] Local `wrangler dev` against Nitro output: live `acquireSnapshot` → Queue → D1/R2
- [ ] One real public GitHub `codeload` tarball in CI/manual smoke (synthetic fixtures cover prefix + pax)
- [-] Feature 002 / AST / Tree-sitter / symbols / graph / retrieval / MCP / UI — out of scope

---

## Completed Summary

| Phase             | Items  | Done   |
| ----------------- | ------ | ------ |
| 0 — Setup         | 8      | 8      |
| 1 — Styles        | 11     | 11     |
| 2 — Data layer    | 6      | 6      |
| 3 — 3D vortex     | 14     | 14     |
| 4 — UI components | 15     | 14     |
| 5 — Landing page  | 16     | 16     |
| 6 — Catalogue     | 12     | 12     |
| 7 — Polish        | 7      | 5      |
| **Total**         | **89** | **86** |

---

## 2026-09-19 18:17 +04 — SDD Package Organization + Code Intelligence Recon

### File organization (non-destructive)

- [x] Organized extracted `repoatlas-phasewise-sdd-package` into `research/` and `sdd/` (no changes to `.specify/`, `specs/`, `.claude/`, `.cursor/`, `.agents/`, app source)

### Read-only architectural reconnaissance (Code Intelligence evolution research)

- [x] Recon RepoAtlas current architecture (stack, ingestion, persistence, search, viz, extension points, constraints)
- [x] Recon Graphify reference repo (AST/graph/evidence/MCP/retrieval, source-level)
- [x] Recon CodeGraph reference repo (AST/graph/hybrid retrieval/MCP/context, source-level)
- [x] License/attribution analysis for both reference repos
- [x] Comparative analysis + adoption matrix (ADOPT/ADAPT/INSPIRE/DEFER/REJECT)
- [x] Engineering lineage validation (Repository Atlas → ... → Agent/MCP Intelligence hypothesis)
- [x] RepoAtlas Evolution doc (REIG nodes/edges, evidence model, snapshot model, retrieval, process discovery, impact analysis, lazy hydration, Spec Kit phase ordering review)
- [x] Code Intelligence gap analysis (ranked, actionable)
- [-] No specs created, no implementation started — per task boundary, stopped after research artifacts

### Artifacts created under `research/`

`REPOATLAS_CURRENT_ARCHITECTURE.md`, `SOURCE_PROVIDER_ANALYSIS.md`, `GRAPHIFY_RESEARCH.md`, `CODEGRAPH_RESEARCH.md`, `COMPARATIVE_ANALYSIS.md`, `ADOPTION_MATRIX.md`, `ATTRIBUTIONS.md`, `ENGINEERING_LINEAGE.md`, `REPOATLAS_EVOLUTION.md`, `CODE_INTELLIGENCE_GAP_ANALYSIS.md`

### Key finding flagged for next planning step

- SDD phase order: `06-process-discovery` before `07-impact-analysis` may be backwards — Impact Analysis has a near-direct architectural template (Graphify `affected.py`) and doesn't need Process Discovery as a prerequisite

---

## 2026-09-19 18:22 +04 — Architecture Decision Gate

### Read-only decision synthesis (no implementation, no Spec Kit spec created)

- [x] Reviewed all 10 research docs + `.specify/memory/constitution.md` + `specs/001-dynamic-github-sources/`
- [x] Resolved 15 architectural decisions: provider abstraction (2-interface split), snapshot acquisition (hybrid archive+API, no clone in prod), Workers runtime model (async queue-driven pipeline, not a separate service), persistence (Cloudflare D1 + R2, no dedicated graph DB), AST mechanism (WASM tree-sitter, no native code), core graph node/edge boundary, evidence model (5-state, added AMBIGUOUS), retrieval v1 scope (BM25+traversal, no vector search), impact analysis before process discovery, MCP tool dependency mapping
- [x] Constitution gap assessment — proposed amendments (not applied): evidence integrity, provider independence, commit-based source truth, runtime portability, attribution/lineage
- [x] Revised phase sequence — swapped `06-process-discovery` ↔ `07-impact-analysis`
- [-] No spec.md/plan.md/tasks.md created — stopped per task boundary, waiting for human review

### Artifact created

`research/ARCHITECTURE_DECISION_GATE.md`

---

## 2026-09-19 18:28 +04 — Final Feasibility Ratification

### Resolved the two open feasibility questions from the Architecture Decision Gate

- [x] Archive decode feasibility spike — verified Cloudflare Workers natively supports `DecompressionStream('gzip')` (checked against current Cloudflare docs); tar.gz + native decompress + streaming tar parse + throttled R2 writes = **RATIFIED WITH CONSTRAINTS** (must stream, not buffer; large-repo checkpoint threshold still needs an implementation spike)
- [x] Language distribution analysis — computed directly from `repos.json` (92 repos, real data): Java 26.1%, HTML 12.0%, JS 10.9%, TS 8.7%, CSS 6.5%, rest ≤1.1% each, 30.4% null/non-code
- [x] Tier 1: Java, JavaScript+TypeScript. Tier 2: HTML, CSS, Rust. Tier 3: Liquid, MDX, NSIS, HCL + all other Graphify/CodeGraph languages not yet represented in RepoAtlas's own data
- [x] Flagged explicit limitation: `repos.json` is a single-owner sample, not representative of the general dynamic-sources population — Tier 2/3 should be revisited once real usage data exists
- [x] WASM tree-sitter + Workers + queue model — **RATIFIED**, no revision needed (128MB memory / 64MiB bundle-size limits reinforce narrow Tier-1-first grammar bundling, consistent with language-tier findings)
- [x] Snapshot strategy (hybrid archive+API) — **RATIFIED**, unchanged
- [-] No spec.md/plan.md/tasks.md created — stopped per task boundary; next step is the first Spec Kit specification

### Artifact updated (not created)

`research/ARCHITECTURE_DECISION_GATE.md` — added "Feasibility Ratification" section

---

## 2026-09-19 18:42 +04 — First Spec Kit Feature: Code Intelligence Foundation

### Created `specs/001-code-intelligence-foundation/spec.md`

- [x] 7 user stories (US1–US7): provider-independent identity, ref→SHA resolution, reproducible snapshot, file inventory, persistent storage, async/checkpointed processing, incremental-sync foundation
- [x] 40 functional requirements (FR-001–FR-040) covering identity, ref/commit resolution, snapshot lifecycle, bulk+incremental acquisition, streaming archive processing, file inventory/R2 addressing, queue idempotency/checkpointing, provenance, security, observability, existing-system protection
- [x] 10 measurable success criteria (SC-001–SC-010)
- [x] Non-goals explicit: no AST/symbol/graph/BM25/vector/impact/process-discovery/MCP/AI/UI work — all deferred to later features
- [x] 3 NEEDS CLARIFICATION flags: GitLab provider scope for this feature, acquisition trigger mechanism, snapshot retention policy
- [-] No plan.md/tasks.md created, no implementation — stopped per task boundary

### Verified before finishing

- Grounded in all 11 research docs + `.specify/memory/constitution.md` + existing `specs/001-dynamic-github-sources/`
- Does not contradict any ratified decision in `research/ARCHITECTURE_DECISION_GATE.md`
- `.specify/` untouched; existing spec/app code untouched

---

## 2026-09-19 18:46 +04 — Resolved Clarification Questions (new session)

### Updated `specs/001-code-intelligence-foundation/spec.md` — added Clarifications section, removed all `[NEEDS CLARIFICATION]` markers

- [x] GitLab scope → GitHub-only ships this feature; abstraction stays GitLab-ready (FR-003/FR-004 unchanged in intent, marker removed)
- [x] Acquisition trigger → internal `createServerFn`-pattern server function (matches `src/lib/repositories.functions.ts`), not auto-wired into existing GitHub ingestion
- [x] Retention policy → unbounded for v1, no auto-expiry/pruning; deferred to future feature
- [x] Status bumped Draft → Clarified
- [-] No plan.md/tasks.md, no implementation — stopped per task boundary

### Verified before finishing

- `.specify/`, `src/`, `package.json`, existing specs untouched — only `spec.md` in `specs/001-code-intelligence-foundation/` modified
- `grep -c "NEEDS CLARIFICATION"` on spec.md → 0 matches

---

## 2026-09-19 20:15 +04 — Code Intelligence Foundation: `/speckit-implement` (54/54 tasks)

### Implemented `specs/001-code-intelligence-foundation/` end to end
- [x] Phase 1–2 (Setup + Foundational): `wrangler.toml` (first Cloudflare bindings config in this repo — D1/R2/Queues), `data/code-intel-schema.sql`, domain types (`RepositoryIdentity`, branded `CommitSha`, `Snapshot`/`SnapshotFile`/`AcquisitionJob`), `ContentProvider`/`MetadataProvider` interfaces, additive `AtlasErrorCode` extension (5 new codes), thin D1/R2 client layer (`src/lib/code-intel/persistence/`)
- [x] US1 (provider-qualified identity), US2 (ref resolution + runtime SHA-shape guard), US3 (reproducible snapshot: dependency-free tar-stream parser, native `DecompressionStream` archive pipeline, attempt-scoped D1 writes, Cloudflare Queue consumer, transactional finalization, acquisition-attempt-log writer)
- [x] US5 (persistence across invocations), US4 (paginated file inventory), US6 (checkpointed multi-unit acquisition, re-fetch-and-fast-forward resume, retry/failure handling, attempt-level retry), US7 (completed-only repository history, incremental-mode `compareRefs`/`fetchPaths`)
- [x] Polish: `bunx tsc --noEmit` clean across `src/` + `tests/`; `eslint .` clean on all new/touched files (3 pre-existing errors in untouched `src/routes/*` left alone); diff-reviewed zero modification to protected files; verified no git-clone/child_process path, no GitLab implementation, no AST/graph/BM25/vector/impact-analysis/process-discovery/MCP/UI scope introduced

### Testing (first automated tests in this repository — `bun test`)
- 26 tests across 14 files, all passing: contract tests (repository identity, ref resolution, commit-SHA runtime guard, tar-stream incl. 1-byte-chunk-boundary stress, D1 idempotent-insert) + integration tests against real SQLite-backed D1 + in-memory R2/Queue + mocked GitHub network (reproducible acquisition, persistence-across-invocations, file inventory pagination, duplicate queue delivery, forced partial failure, multi-unit checkpoint/resume, attempt-level retry after failure, completed-only repository history)
- Added `tests/**/*.ts` to `tsconfig.json`'s `include` (was previously unchecked by `tsc`) and `@types/bun` as a type-only devDependency — both needed to make the typecheck gate meaningful for the new test suite

### Deviations from plan.md / tasks.md (reported per implement-command instructions, not silently absorbed)
- `mapWithConcurrency` duplicated (not imported) from `github-fetch.ts` — that function isn't exported there, and `github-fetch.ts` is explicitly required to stay unmodified; duplicating a ~10-line helper was judged lower-risk than touching the existing ingestion file
- Cloudflare binding access resolved via `globalThis.__env__` (Nitro's documented per-request binding stash) + a `plugins/cloudflare-queue.ts` Nitro hook for `cloudflare:queue` — plan.md specified bindings generically without this mechanism; implemented per Nitro's own documented API, but **not exercised against a live `wrangler dev`/deployed Queues consumer** (no Cloudflare account available in this environment) — this is the one real, disclosed verification gap
- `createServerFn`-wrapped functions require the TanStack Start `AsyncLocalStorage` request context, unavailable under `bun test`; refactored `snapshot.functions.ts` into plain exported handler functions + thin `createServerFn` wrappers around them (same external contract) so the handlers are directly testable
- **Self-caught and reverted mid-session**: ran `bun run format` (repo-wide `prettier --write .`), which reformatted 70+ files outside this feature's scope, including `.specify/`, `specs/001-dynamic-github-sources/`, and most of `src/`. Caught during the final diff review before reporting completion; reverted every unintended file via `git checkout --` and re-applied the two legitimate additive edits (`atlas-errors.ts`) by hand. Final diff is now scoped to exactly this feature's files. Lesson: never run a repo-wide formatter/lint-fix command again without a path scope.
- **Self-caught test flakiness**: `bun test`'s default scheduler shares one `globalThis` across concurrently-executing test files, so this feature's `globalThis.fetch`/Cloudflare-env test doubles (necessary to avoid a live GitHub/Cloudflare account) intermittently raced across files (~1 run in 4–10 failed, always the same assertion, always fast). Root-caused via `--isolate` (fresh `globalThis` per file) eliminating it across 25/25 repeated runs; changed the `test` script to `bun test --isolate` permanently rather than leaving a known-flaky suite in place.

### Verified before finishing
- `git diff --stat` against every explicitly protected path (`src/lib/repositories.functions.ts`, `src/lib/github-fetch.ts`, `src/lib/github-url.ts`, `src/lib/storage/atlas-store.ts`, `data/schema.sql`, `src/routes/`, `src/components/`, `specs/001-dynamic-github-sources/`, `.specify/`) → empty
- Final `git status`: only `wrangler.toml`, `data/code-intel-schema.sql`, `plugins/`, `src/lib/code-intel/`, `tests/` (new) + `package.json`, `tsconfig.json`, `src/lib/atlas-errors.ts`, `bun.lock` (minimal, intentional additive edits) + `PROGRESS.md` (this entry)

---

## 2026-09-19 20:27 +04 — Independent Feature 001 Cloudflare/Nitro wiring audit (Cursor Agent; read-only)

Continued from Claude Code's interrupted deployment-readiness audit (token/session limit while inspecting Nitro `scanDirs` / `rootDir` / `serverDir`). Did **not** modify implementation or configuration; did **not** start Feature 002. Inspected installed Nitro `3.0.260603-beta`, `vite.config.ts`, `wrangler.toml`, `plugins/cloudflare-queue.ts`, and `src/lib/code-intel/*`.

### A. Verified correct
- [x] Worker entry is Nitro `cloudflare-module` (`createHandler` exports `fetch` + `queue`); `src/server.ts` is TanStack Start's fetch-only SSR entry, not the Worker module
- [x] `vite.config.ts` `nitro({ defaultPreset: "cloudflare-module" })` is a real preset selector (`defaultPreset` resolved when `preset` / `NITRO_PRESET` unset); Nitro plugin is build-only (`command === "build"`)
- [x] `_module-handler.mjs` sets `globalThis.__env__ = env` on fetch/queue/scheduled; `cloudflare-env.ts` reads `DB` / `SNAPSHOTS` / `SNAPSHOT_QUEUE` — names match `wrangler.toml`
- [x] Nitro `writeWranglerConfig` finds root `wrangler.toml` and `defu`-merges it into `.output/server/wrangler.json` (bindings not in Nitro overrides, so they would flow through)
- [x] Application path: `acquireSnapshotHandler` → `getSnapshotQueue().send`; worker → `getD1()` / `getR2()`; tests inject via `setTestCloudflareEnv`
- [x] `createServerFn` wrappers match `repositories.functions.ts`; tests call handlers (TanStack ALS unavailable under `bun test`)
- [x] `DecompressionStream("gzip")` + sequential tar parse is Workers-native; tar tests cover 1-byte chunk splits
- [x] Checkpoint/resume logic: stop after `checkpointFileCount` new files, enqueue `unitIndex+1`, skip via `hasSnapshotFile` (re-fetch-and-fast-forward). `checkpoint_cursor` is written but not read.

### B. Unverified without Cloudflare
- [ ] Live D1 schema apply (`data/code-intel-schema.sql` exists; no `.wrangler/` state)
- [ ] Live R2 put/get; live Queue produce → consume
- [ ] Generated `.output/` — **none currently present** (Sep 16 tree from the earlier session is gone and predated this feature)
- [ ] Real GitHub `codeload` tar.gz (root-folder prefix, pax headers). T022/SC-003 used `installFakeGithub` synthetic ustar, not a public repo
- [ ] Persistence across real Worker isolates (persistence test reuses one in-memory D1/R2 in the same Bun process)

### C. Actual blockers
- [ ] **`plugins/cloudflare-queue.ts` is not discovered.** Nitro 3 defaults: `serverDir: false`, `scanDirs: []`, `plugins: []`. `scanPlugins` only scans `scanDirs` (the `[rootDir, ...scanDirs]` loop is public assets, not plugins). No `nitro.config.ts`; `nitro()` does not pass `plugins` / `scanDirs` / `serverDir`. Result: `#nitro/virtual/plugins` empty → no `cloudflare:queue` listener → Worker `queue()` succeeds and Cloudflare acks the batch → snapshot stays `in_progress`. Nitro docs (“auto-registered from `plugins/`”) do not match Nitro 3 + `nitro/vite` defaults. Smallest fix: `nitro.config.ts` with `plugins: ["./plugins/cloudflare-queue.ts"]` (avoids changing the T001-frozen `cloudflare-module` preset line) **or** pass `plugins` / `scanDirs: ["."]` into `nitro()` in `vite.config.ts`.
- [ ] `wrangler.toml` `database_id = "REPLACE_WITH_REAL_D1_DATABASE_ID"` — production D1 deploy cannot bind as written

### D. Non-blocking risks
- Default `bun run dev` (`vite dev`) never loads Nitro, so `__env__` is unset; Feature 001 is not exercisable via the app's normal dev script. No package.json wrangler script; `wrangler` is not a direct dependency
- `checkpointCpuMsBudget` unused (T040 file-count-or-CPU; only file-count stops a unit)
- Duplicate-delivery test redelivers after snapshot is already `completed` (top-of-worker no-op). Mid-acquisition redelivery can write the next N files and enqueue extra units; D1 `ON CONFLICT DO NOTHING` should keep data correct
- GitHub archive `{repo}-{sha}/` path prefix not stripped — bulk vs incremental paths would diverge
- Pax / long-name headers besides GNU `L` are skipped
- One file fully buffered; early unit return does not cancel the tar reader
- Root `wrangler.toml` has no `main` — deploy/preview must use Nitro's generated `.output/server/wrangler.json`

### E. Next validation / fix steps (do not start Feature 002)
1. Register the queue plugin (C.1)
2. `bun run build`; confirm `.output/server/index.mjs` exports `queue`, virtual plugins imports `cloudflare-queue.ts`, generated `wrangler.json` has D1/R2/Queues
3. Add wrangler as a devDependency (or document `npx wrangler`) and a script against Nitro output, not `vite dev`
4. Provision D1/R2/Queue, replace `database_id`, apply schema, `wrangler dev` on the built Worker, call `acquireSnapshot`
5. One real public GitHub tar.gz through the parser
6. Test redelivery of the same `unitIndex` while snapshot is still `in_progress`

### Correction to the interrupted Claude Code audit
Claude Code correctly found Nitro merges `wrangler.toml` and that `.output/server/index.mjs` (when present) exports `queue()`. It misread `[options.rootDir, ...options.scanDirs]` as plugin scanning; that loop is public assets. Plugin discovery is `scanDirs` only, which is empty under this project's Nitro 3 + vite defaults.

### Verified before finishing
- No implementation/config files modified — only `PROGRESS.md` (this entry + Feature 001 tracker section + last-updated stamp)

---

## 2026-09-19 20:45 +04 — Feature 001 deployment-readiness corrections (Cursor Agent)

### Changes (audit follow-up)
- [x] Added `nitro.config.ts` with `plugins: ["./plugins/cloudflare-queue.ts"]` — `vite.config.ts` / `cloudflare-module` preset untouched
- [x] `archive-path.ts` + pipeline: strip GitHub `{repo}-{commitSha}/` tarball prefix (not heuristic first-segment)
- [x] `tar-stream.ts`: POSIX pax extended headers (`x`/`g`) + GNU long name (`L`); apply `path`/`size` before reading file content
- [x] `snapshot-worker.ts` + `d1-client.ts`: skip queue message when unit job already `completed` (in-progress redelivery idempotency)
- [x] Tests: archive-path contract, pax tar contract, github-archive-root integration, duplicate-delivery while `in_progress`
- [x] `bunx tsc --noEmit`, `bun run test` (31/31), `bun run build`, eslint on touched files

### Build verification (local)
- `.output/server/index.mjs`: `queue(batch, env, context)` + `nitroApp.hooks.hook("cloudflare:queue", …)` + inlined `#nitro/virtual/plugins` calling `processSnapshotQueueMessage`
- `.output/server/wrangler.json`: `d1_databases` (`DB`), `r2_buckets` (`SNAPSHOTS`), `queues.producers`/`consumers` (`SNAPSHOT_QUEUE` / `repo-atlas-snapshot-acquisition`)

### Still requires Cloudflare account
- [ ] `database_id` placeholder in `wrangler.toml` / generated wrangler.json
- [ ] End-to-end `wrangler dev` / deploy smoke with real bindings

---

## 2026-09-19 21:00 +04 — Feature 001 final verification (read-only)

- [x] Verified against `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/` — no code changes
- [x] D1 DDL ↔ `d1-client` / R2 keys / queue produce-consume (build) — PASS
- [x] FR-001–FR-040 (FR-031 partial-by-design), immutability, no Feature 002+ scope — PASS
- [ ] Follow-ups (optional hardening, not closure blockers): T040 `checkpointCpuMsBudget`, T028 transactional finalize
- [x] Live Cloudflare: bindings, queue runtime, real GitHub tarball folder name, SC-003/008/009 — closed below

---

## 2026-09-20 02:08 +04 — Feature 001 live smoke test (deployed Worker, read-only verification)

Closes the "Live Cloudflare" gap above — first end-to-end run against real bindings (deployed Worker, not `wrangler dev` emulation). No implementation/config files modified; verification only.

- **Deployment version**: `25291b2b-a7f2-4d57-973a-360d4eb47f80` (created 2026-09-19T17:39:50Z, `https://repo-atlas.imdadareeph.workers.dev`). Confirmed matching current build — no `src/lib/code-intel/`, `wrangler.toml`, `plugins/`, or `nitro.config.ts` file is newer than the deployed `.output` build; no redeploy performed.
- **Live `acquireSnapshot`**: `{provider: "github", owner: "octocat", name: "Hello-World"}` @ `master` → `commitSha: 7fd1a60b01f91b314f59955a4e4d4e80d8edf11d`, `snapshotId: 1`, `acquisitionMode: "bulk_archive"`, `reused: false`. Called via the deployed `/_serverFn/<id>` RPC route (real seroval wire protocol, CSRF same-origin header required).
- **Queue consumer observed**: `wrangler tail` logged `Queue repo-atlas-snapshot-acquisition (1 message) - Ok` in the same second as the `acquireSnapshot` call — confirms the `cloudflare:queue` hook → `plugins/cloudflare-queue.ts` → `snapshot-worker.ts` chain actually fires in the deployed Worker. This was the one disclosed, unverified gap noted 2026-09-19 20:45 ("not exercised against a live... deployed Queues consumer") — now closed.
- **Final snapshot status**: `getSnapshotStatus` → `status: "completed"`, `unitsCompleted: 1`, `filesProcessed: 1`, `bytesProcessed: 13`.
- **D1 verification** (`wrangler d1 execute --remote`, `SELECT`-only): `snapshots` row id 1 — `status=completed`, `acquisition_mode=bulk_archive`, `commit_sha` matches. `snapshot_files` — 1 row, `path=README`, `size_bytes=13`, `content_hash=03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340`, `r2_key=snapshots/github/octocat/Hello-World/<commit_sha>/<content_hash>`.
- **R2 verification**: `wrangler r2 object get --remote` on that `r2_key` → content `Hello World!\n`.
- **Hash verification**: local SHA-256 of the downloaded R2 object = `03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340`, exact match to D1's `content_hash`.
- **Not covered by this pass (by design)**: `listSnapshotFiles`/`getSnapshotFile`/`getRepositoryHistory` have no HTTP RPC route in the current build (`Feature001ServerFnRegistration` only registers `acquireSnapshot`/`getSnapshotStatus`) — verified via direct D1/R2 inspection instead, per explicit instruction not to add those registrations.

**Result: PASS.** Full chain confirmed live: `acquireSnapshot` → `SNAPSHOT_QUEUE` → `snapshot-worker.ts` → D1 (`snapshots`, `snapshot_files`) → R2 → `completed`, byte-identical and hash-verified. All temporary smoke-test scripts and downloaded objects were created outside the repo (session scratchpad) and deleted after use; nothing added to the working tree.

---

## 2026-09-20 04:15 +04 — Feature 002 (AST + Symbol Intelligence) — spec/plan/tasks + task-by-task implementation in progress

Spec Kit artifacts (`specs/002-ast-symbol-intelligence/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `tasks.md`) produced, remediated against a `/speckit-analyze` gate (7 issues found and fixed: directory-chain population wired into T029, binding-claim contradictions corrected, re-extraction contract reconciled, FR-008 version-scoping clarified, T010/T031 wording fixed, hookable multi-listener behavior verified against the installed package — final gate: 0/0/0/0, 27/27 requirements, 66 tasks, 0 orphans/duplicates). Implementation proceeding **one authorized task at a time** (inspect → authorize → implement → verify → STOP), per explicit session convention.

**Dependency resolution (T001, feasibility spikes T012–T014)**:
- `bun add web-tree-sitter tree-sitter-wasms` initially resolved `web-tree-sitter@0.27.0`, found **binary-incompatible** with `tree-sitter-wasms@0.1.13`'s grammar files (0.27.0 requires a `dylink.0` WASM custom section; the grammars only carry the legacy `dylink` section — real parse attempt threw `need dylink section`). Root-caused via direct source inspection (`getDylinkMetadata()` in `web-tree-sitter.js`), not docs. **Re-pinned to `web-tree-sitter@0.25.10`** (last release retaining the `dylink.0`→legacy-`dylink` fallback) — verified end-to-end with real, error-free ASTs for all four Tier 1 grammars.
- Bundle size: core runtime + 4 grammars ≈ 5.76 MB (~9% of the 64 MiB Worker cap). No risk.
- Large-file CPU: real parses to 20 MB, all four languages, perfectly linear, zero crashes — **once each parsed `Tree` is explicitly `.delete()`'d per iteration** (an initial run without doing so produced a real `RuntimeError: Aborted()` at ~5 MB, a test-harness memory-leak bug, not an engine limit; now a confirmed implementation requirement for the eventual extraction pipeline, T029).
- Full evidence for both in `specs/002-ast-symbol-intelligence/research.md` §6.

**Tasks completed** (each independently verified — real parsing/hashing, not mocked — plus Feature 001 regression re-run clean after every task):
- **T001** deps installed (corrected version). **T003** ambient `*.wasm?module` TypeScript declaration (corrected from tasks.md's original, narrower `*.wasm` wording, which wouldn't have matched the real import specifier). **T012/T013/T014** spikes (above). **T015/T021** `detectLanguage` (extension-based, Tier 1 only) + its 27-test contract suite. **T016/T027** `computeSymbolKey` (SHA-256 hex of the data-model.md canonical string, via `node:crypto` — synchronous, Workers-compatible through the already-enabled `nodejs_compat` flag) + its 8-test contract suite. **T022** `grammar-provider.ts`: core WASM via Nitro's `?module` ESM import + `Parser.init({instantiateWasm})` (zero fetch/fs); grammar bytes via Cloudflare's `ASSETS` binding (`globalThis.__env__.ASSETS.fetch()` — no new binding, Nitro auto-generates `ASSETS` for this app's existing `public/` dir); 4 grammar `.wasm` files added to `public/wasm/`, SHA-256-verified byte-identical to the pinned package and confirmed carried through into `.output/public/wasm/` by a real `bun run build`; 8-test contract suite, real parsing for all 4 Tier 1 languages. **T023–T026** one `.scm` tree-sitter query file per Tier 1 language (`java`/`javascript`/`typescript`/`tsx`), each independently validated against the *actual* pinned grammar via a real `Query`/`matches()` run (not syntax-only) — found and correctly handled real per-grammar differences (Java has no free function; JS has no interface but constructors ARE `method_definition`; TS/TSX both have two distinct namespace-vs-module node types (`internal_module` vs `module`) and `type_identifier` name fields; TSX's JSX node types never accidentally match a symbol pattern, explicitly asserted).

**Real gap found and disclosed, not yet resolved**: `tasks.md`'s **T005** (`domain/symbol.ts` — `Symbol`/`SymbolKind`/etc. domain types) is still `[ ]` and the file doesn't exist, despite T008 and T027 both citing `Depends on: T005` as if satisfied — T027 happened not to need it (primitives-only signature). **T028** (IR construction) will need it. Also flagged: `qualifiedName` derivation has no specified algorithm anywhere in the current artifacts (data-model.md describes the stored *result*, not how to compute it) — left open, not invented unilaterally.

**Current tasks.md state**: T001,T003,T012–T027 `[X]` (except T005 `[ ]`, T028/T029 onward not started). 43/43 Feature 002 contract tests pass; Feature 001 regression 31/31 clean (one transient timestamp-ordering flake observed once on an unrelated Feature 001 test, confirmed non-reproducible over 3 reruns, not caused by any Feature 002 change).

**Convention going forward**: this file is updated after every authorized task, per explicit instruction.

---

## 2026-09-20 04:45 +04 — Feature 002: T005 implemented; parent-IR design deliberately deferred

**Investigation (read-only, no changes)**: confirmed two real specification gaps before touching T005 — (1) no artifact anywhere defines T028's pre-persistence parent-reference representation or how T029 resolves it to a real `symbols.id`; data-model.md only defines the *persisted* `parent_symbol_id` FK. (2) `ExtractionJobStatus` as a named type was never explicitly requested by T005's own line (only 3 of 4 needed enums were named), though its four values were already specified in data-model.md's `ExtractionJob.status` column. Confirmed T005 itself is not blocked by gap (1) — its stated scope is the persisted row shapes only; T028/T029 are the tasks actually blocked by it.

- [x] **T005**: `src/lib/code-intel/domain/symbol.ts` — `Symbol`, `Directory`, `FileExtraction`, `ExtractionJob`, `SnapshotExtraction` domain types + `SymbolKind`/`FileExtractionStatus`/`SnapshotExtractionStatus`/`ExtractionJobStatus` (the 4th, resolving gap 2) status unions. Verified field-by-field against data-model.md. Explicit doc comment states these model the *persisted* shapes only, not T028's IR. `bunx tsc --noEmit` clean; Feature 001 regression 31/31; Feature 002 suite 43/43.
- [x] **Parent-IR design decision** (gap 1, above) — resolved and approved: T028's IR carries `parentSymbolKey: string | null` (the nearest matched ancestor's `symbol_key`, IR-only, never a D1 column); T029 will resolve it via a two-pass write (insert with `parent_symbol_id = NULL` → capture `last_row_id` → build `symbolKey → id` map → `UPDATE parent_symbol_id`). Recorded in data-model.md ("Parent/child resolution (IR → D1)"), tasks.md (T028/T029), plan.md (Extraction Workflow step 5), and contracts/language-grammar-provider.md. Re-ran `/speckit-analyze` after each edit: final state 0 Critical/High/Medium/Low, 27/27 FR coverage, 66 tasks, no orphans/duplicates — planning set internally consistent.
- [x] **T028**: `src/lib/code-intel/symbols/to-intermediate-representation.ts` — runs a language's `.scm` query (T023–T026) against a parsed tree, normalizes captures into the common Symbol IR, derives `qualifiedName` and `parentSymbolKey` from the real AST ancestor chain (`Node.parent`/`Node.id`, never capture-emission order), computes `symbolKey` per symbol (T027). 8 new real tests (real grammars, no mocking) — top-level/nested/multi-level `parentSymbolKey`, 0-indexed ranges, `symbolKey` determinism + snapshot-sensitivity, sibling uniqueness, empty-file handling. Feature 002 suite 51/51; Feature 001 regression 31/31; `tsc` clean.
- [x] **T007**: `config.ts` — `SYMBOL_EXTRACTOR_VERSION` ("v1", deliberately a plain constant, not env-overridable — an operator override would desynchronize the recorded version from the deployed code, defeating FR-014) + `CODE_INTEL_EXTRACTION_BATCH_SIZE` tunable (default 50, standard two-tier pattern). No existing constant touched.
- [x] **T008a**: `cloudflare-env.ts` — `SYMBOL_QUEUE?: QueueLike` + `getSymbolQueue()`, structurally identical to `getSnapshotQueue()`. T030's dependency now satisfied. Feature 001's `SNAPSHOT_QUEUE` handling untouched.
- Both: `tsc` clean; Feature 001 regression 31/31; Feature 002 suite 86/86 (unaffected). No dedicated tests added — no existing Feature 001 precedent tests `codeIntelConfig()`/`getSnapshotQueue()` directly, so none added here either.
- [x] **T030**: `symbol-worker.ts` (path: `src/lib/code-intel/symbols/`, per explicit instruction — deviates from tasks.md's original `queue/` path, flagged then followed). Pure orchestration — zero parsing/IR/persistence logic inline, every file handed unchanged to `extraction-pipeline.ts`. `SymbolQueueMessage` extended with `fromCursor` (threads each unit's file-range start through the queue message, since data-model.md's checkpoint mechanism didn't specify how a unit learns its own boundary). Two small unexported local read-helpers added inside the worker for its own status/lifecycle control-flow (not re-opening T008's closed file — these read state, not symbol content). 7 real integration tests: completed/partial-failure/duplicate-delivery/already-terminal/resume (sentinel-marked already-processed files proven untouched)/retry (injected transient failure → retrying + rethrow, then real retry succeeds)/multi-unit enqueue. Feature 002 suite 93/93; Feature 001 regression 31/31; `tsc` clean.
- [x] **T009**: `wrangler.toml` — added `[[queues.producers]]`/`[[queues.consumers]]` for `repo-atlas-symbol-extraction`/`SYMBOL_QUEUE`, additive alongside existing SNAPSHOT_QUEUE entries (same `max_batch_size = 10`/`max_retries = 5`). Validated via `bunx wrangler deploy --dry-run` (after `bun run build` regenerated `.output/server/wrangler.json`) — bindings table shows both queues.
- [x] **T010**: `plugins/cloudflare-symbol-queue.ts` — mirrors `plugins/cloudflare-queue.ts` (`definePlugin`, `cloudflare:queue` hook, ack/retry per message), filters `batch.queue === "repo-atlas-symbol-extraction"` (both plugins share the hook). Imports `processSymbolQueueMessage` from the real `src/lib/code-intel/symbols/symbol-worker.ts` path (T030 already existed, so no placeholder body — task text's stale `queue/symbol-worker.ts` path corrected per explicit instruction). `tsc` clean; Feature 001 regression 31/31.
- [x] **T011**: `nitro.config.ts` — `plugins` array now `["./plugins/cloudflare-queue.ts", "./plugins/cloudflare-symbol-queue.ts"]`, both coexist. `bun run build` succeeded; dry-run bindings show both queues; `tsc` clean.
- [x] **T031**: `plugins/cloudflare-symbol-queue.ts` — no code change; T010 already wrote real `processSymbolQueueMessage` dispatch (no TODO placeholder existed, since T030 was already complete when T010 ran). Re-verified: `tsc` clean, `bun run build` succeeds, Feature 001 regression 31/31. US1 dispatch chain (T021/T022/T030/T031) confirmed green.
- [x] T023–T029 — status per this checkpoint: **all already `[X]`** (T023–T026 grammar queries, T027 symbol identity, T028 IR conversion, T029 extraction pipeline — see entries above). Full US1 chain (T021–T031) is complete.
- [x] **T006**: `atlas-errors.ts` — added `SNAPSHOT_NOT_EXTRACTABLE`/`SYMBOL_NOT_FOUND` (additive, 21 existing codes untouched). `tsc` clean; Feature 002 93/93; Feature 001 regression 31/31 (one single-run flake in `repository-history.test.ts`, pre-existing timestamp-ordering issue, confirmed unrelated via 3x repeat + standalone pass).
- [x] **T032**: `symbol.functions.ts` — `extractSnapshotSymbols` (`createServerFn` + plain handler, mirrors `snapshot.functions.ts`'s split). Implements all 5 contract behaviors from `extract-symbols.functions.md`. Added two small necessary `symbol-d1-client.ts` primitives: `getSnapshotExtractionRow` (read-only peek) and `restartSnapshotExtraction` (resets to fresh `in_progress` under current `SYMBOL_EXTRACTOR_VERSION`, clears stale `extraction_jobs` so a version-bump restart's unit 0 isn't skipped as already-completed — `upsertExtractionJob`'s ON CONFLICT preserves 'completed' status otherwise). One elimination-based assumption disclosed: `failed` status under the *same* version falls into the restart branch (not explicitly in the contract's 5 cases). 8 new integration tests (`tests/integration/symbols/extract-snapshot-symbols.test.ts`). Feature 002 suite 101/101; Feature 001 regression 31/31 (same pre-existing `repository-history.test.ts` timestamp flake on repeat runs, unrelated); `tsc` clean.
- [x] **T035**: `symbol.functions.ts` — `getSymbol` (`createServerFn` + plain handler), thin reshape of `getSymbolWithProvenance`'s flat row into the contract's nested `provenance` object, no SQL in the handler. Test file `tests/contract/symbols/symbol-provenance.test.ts` written (2 tests) as this task's own validation — coincides with T033's exact stated path, but **T033 itself not marked `[X]`**, not separately authorized this turn. Feature 002 suite 103/103; Feature 001 regression 31/31 (clean, no flake this run); `tsc` clean.
- [x] **T033**: confirmed satisfied by T035's test file (`tests/contract/symbols/symbol-provenance.test.ts`) — verified field-by-field against `SymbolDetail` contract shape, both scenarios covered. No code touched. Feature 002 103/103; Feature 001 31/31 (clean); `tsc` clean.
- [ ] T034, T036+ — not started.

**Dependency-gap pattern continues** (same class as T003/T005 earlier): T029's stated dependency T008 (`symbol-d1-client.ts`) was unimplemented — wrote it in full (14 functions: `getOrCreateDirectory`, `upsertFileExtraction`, `getFileExtractionRow`, `replaceSymbolsForFile` with the approved two-pass parent-resolution write, `listSymbolsPage`, `getSymbolWithProvenance`, 6 `extraction_jobs` functions mirroring Feature 001's `acquisition_jobs` functions, 3 `snapshot_extractions` functions), `tsc` clean — but then found **T008's own dependency T004** (append the 5 new tables to `data/code-intel-schema.sql`) was *also* unimplemented, so no test could run against real tables. Stopped and reported each gap before proceeding, per this session's established discipline (inspect → authorize → implement → verify → STOP, never silently backfill an unauthorized dependency).

- [x] **T004**: appended `contracts/d1-schema-additions.sql`'s 5 `CREATE TABLE` statements to `data/code-intel-schema.sql` verbatim (`diff` clean). Loaded via `bun:sqlite`: all 5 new tables present, all 7 Feature 001 tables unaltered. `tsc` clean; Feature 001 regression 31/31; Feature 002 suite 51/51.
- [x] **T008**: 27 real tests written (`tests/contract/symbols/symbol-d1-client.test.ts`, real `bun:sqlite`, no mocking) covering every function — directory idempotency, file-extraction replace semantics, `replaceSymbolsForFile`'s two-pass parent resolution (`parent_symbol_id` confirmed to be a real D1 row id, multi-level nesting, re-extraction removes stale symbols for the target file only — sibling file explicitly asserted untouched, zero-symbol clearing, same-IR-twice idempotency), `listSymbolsPage` pagination/filters, `getSymbolWithProvenance` full chain, `extraction_jobs`/`snapshot_extractions` CRUD/state-transition guards. Two defects found while writing tests, both in the test code itself (not the implementation): a helper's wrong assumption about `insertSnapshotFile`'s return type, and a SQLite ASCII-sort-order assumption — both fixed. Feature 002 suite 78/78; Feature 001 regression 31/31; `tsc` clean. One disclosed test-harness limitation: sequential `batch()` in the sqlite adapter doesn't simulate genuine transactional failure, so cross-statement atomicity-under-partial-failure wasn't exercisable (the ordering/id-capture logic itself was).
- [x] **T029**: `src/lib/code-intel/symbols/extraction-pipeline.ts` — full per-file pipeline (directory chain → language detection → R2 read → parse → IR → persist), self-contained file-scoped failure containment (never throws; every failure from R2-read onward is caught and recorded as `file_extractions.status = 'failed'`). Language detection deliberately reordered before the R2 read (cheap, path-only) so unsupported files never touch R2 — explicitly proven in tests, not just claimed. Malformed source detected via `tree.rootNode.hasError` (tree-sitter rarely throws on garbage — it's error-tolerant), treated as a full failure per spec Edge Cases. Every parsed `Tree` freed immediately (T014's finding). One small disclosed addition within T029's own necessity: `scm-modules.d.ts` ambient declaration for `*.scm?raw` text imports (query files bundled as strings, confirmed identical Bun/production behavior — no divergence, unlike the earlier `.wasm?module` case). 8 real integration tests (`tests/integration/symbols/extraction-pipeline.test.ts`, real WASM parsing, real D1, in-memory fake R2): success, unsupported-skip (R2-untouched proven), malformed-failure, empty-file-success, R2-missing-failure, end-to-end nested-parent resolution to a real D1 id, re-extraction replaces not duplicates, `extractor_version` stamping. Feature 002 suite 86/86; Feature 001 regression 31/31; `tsc` clean.

---

## 2026-09-20 14:50 +04 — Feature 003 (GitHub Source Enhancement) — spec/plan/tasks complete, `/speckit-implement` started

Spec Kit artifacts produced for `specs/003-github-source-enhancement/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md, tasks.md — 28 tasks across 6 user stories + Setup + Polish). `/speckit-analyze` run twice: first pass found one MEDIUM coverage gap (E1 — `loadInitialSources`/`initialSources` default-path extension had no automated test), remediated by adding T028; second pass clean (0 Critical/High, no dependency contradictions, Feature 001/002 isolation intact, FR coverage complete). Implementation now proceeding **one task at a time** (inspect → verify deps/architecture → implement → validate → STOP), same discipline as Feature 002.

Feature 003 is additive-only: no changes to `src/lib/code-intel/**`, Feature 001 acquisition flows, or `AtlasScene`. Key architecture decision (research.md): `SourcesMenu.tsx` is a drop-in replacement for `AtlasSourcesChrome.tsx` at all 4 existing route call sites — no shared `<Navbar>` extraction, since the four existing headers already differ slightly beyond the Sources control (out of this feature's scope).

- [x] **T001**: verified `dropdown-menu.tsx`, `tabs.tsx`, `dialog.tsx`, `accordion.tsx` (all exist, export required symbols) and their underlying `@radix-ui/*` packages (already in `package.json`) — no new dependency needed. Verification-only, no code changed. `tsc` clean (baseline).
- [x] **T002**: `src/components/atlas/SourcesMenu.tsx` — dropdown-menu replacement for `AtlasSourcesChrome`, same props, 3 items (Add Sources/Export JSON/Connected Sources-stub). Reuses `exportRepositoriesJson`/`parseAtlasError`/`setDialogOpen` unchanged — no source-loading/fetching/server-function logic touched. Self-caught defect (hardcoded export params instead of passing props through) fixed before validation. `AtlasSourcesChrome.tsx` untouched, not yet swapped in anywhere (T003–T006's job). `tsc` clean; Feature 001 31/31, Feature 002 103/103 (unaffected).
- [x] **T003**: `src/routes/index.tsx` — swapped `AtlasSourcesChrome` → `SourcesMenu` (import + JSX call site only, same 6 props). No other change to this file (Accordion default-value left for T017). Other 3 routes untouched (T004–T006). `tsc` clean; `bun run build` succeeds; Feature 001 31/31, Feature 002 103/103 (unaffected).
- [x] **T004**: `src/routes/catalogue.tsx` — same 1:1 swap as T003. `tsc` clean, `bun run build` succeeds.
- [x] **T005**: `src/routes/categories.tsx` — same 1:1 swap as T003/T004. `tsc` clean, build succeeds, Feature 001/002 unaffected.
- [x] **T006**: `src/routes/insights.tsx` — swapped the one real `AtlasSourcesChrome` call site (full header). Discrepancy found: the "loading-state header" never used `AtlasSourcesChrome` at all (logo-only), so tasks.md's "two paths to update" premise was wrong — only one existed. Confirmed via grep: 0 `AtlasSourcesChrome` refs remain in `src/routes/` — **all 4 routes now on `SourcesMenu`**. `tsc` clean, build succeeds, Feature 001/002 unaffected.
- [x] **T008**: `src/lib/connected-sources.ts` — `deriveConnectedSources()`, pure fn, groups `repositories` by existing `Repository.sourceLogin` field, statuses from `meta.sourceFailures`. `colorToken` reuses existing `styles.css` CSS vars (no new palette). `tsc` clean, build succeeds, Feature 001/002 unaffected.
- [x] **T009**: `tests/unit/connected-sources.test.ts` — 6 tests for `deriveConnectedSources()` (default path, multi-login grouping, degraded/error statuses, colorToken restricted to existing tokens, deterministic ordering). `connected-sources.ts` untouched. `tsc` clean, 6/6 pass, Feature 001/002 unaffected.
- [x] **T010**: `src/components/atlas/ConnectedSourcesDialog.tsx` — `Dialog`-based, reads `useAtlasRepositories()` for content (matches `SourcesDialog`'s existing global-state pattern), but `open`/`onOpenChange` are **props** (not new store state — `sources-store.ts` stays unchanged per plan.md), so T011 decides how to thread the boolean. Source cards: colored dot + identity + type/count + status `Badge`. Explicit empty state. `tsc` clean (one `exactOptionalPropertyTypes` fix, `connected-sources.ts` untouched); build succeeds; Feature 001/002 + T009 tests all unaffected.
- [x] **T011**: `src/components/atlas/SourcesMenu.tsx` — "Connected Sources" item now opens `ConnectedSourcesDialog` via local `useState` (resolves T010's open question; no new store field, `sources-store.ts` unchanged). Add Sources/Export JSON untouched. `tsc` clean, build succeeds, Feature 001/002 unaffected.
- [x] **T007**: manual regression, US1 complete (T002–T006). **Disclosed gap**: no browser extension connected this session — no live click-through of dropdown/dialog/export. Verified instead: `bun run dev` clean start (port 4950, unrelated pre-existing process on 4949 left alone), all 4 routes HTTP 200 + correct title, zero client console errors on hydration (only a pre-existing unrelated THREE.js warning), zero `AtlasSourcesChrome` refs left anywhere, no duplicate `SourcesMenu` usage. `tsc` clean, build succeeds, Feature 001 31/31, Feature 002 103/103. **US1 (Consolidated Sources menu) fully done.**
- [x] **T012**: manual regression, US2 complete (T008–T011). Same disclosed gap as T007 (no browser extension, no live click-through). Verified: dev server clean, all 4 routes 200, zero console errors, no dev-mode module-resolution errors for `ConnectedSourcesDialog`/`connected-sources.ts`. `tsc` clean, build succeeds, Feature 001 31/31, Feature 002 103/103, T009's tests 6/6. **US2 (Connected Sources) fully done.**
- [x] **T013**: `src/lib/source-input-mode.ts` — `SourceInputMode` (`"users" | "repositories"`) + `validateRowsForMode()`, pure fn, reuses `parseGitHubSource` unchanged. Returns `{ parsed, errors }` matching `SourcesDialog`'s existing `rowErrors` shape. No tests (T014's job). `tsc` clean, Feature 001/002 unaffected, no dialog/menu files touched.
- [x] **T014**: `tests/unit/source-input-mode.test.ts` — 14 tests for `validateRowsForMode()` (both modes, multi-row, empty/malformed, deterministic). One self-caught test bug (wrong assumption about repo-kind `login` shape — actual is owner-only, `source-input-mode.ts` untouched). `tsc` clean, 14/14 pass, Feature 001 31/31 (one flaky first-run repeat of the known pre-existing `repository-history.test.ts` issue), Feature 002 103/103, all `tests/unit/` 20/20.
- [x] **T015**: `src/components/atlas/SourcesDialog.tsx` — added `mode` state (`SourceInputMode`, defaults `"users"`, reset on open/close), `Tabs`/`TabsList`/`TabsTrigger` selector (no `TabsContent` — row UI shared, not duplicated). Replaced manual per-row `parseGitHubSource` loop with `validateRowsForMode()`; everything downstream (dedupe/fetch/cache/toasts) byte-for-byte unchanged. Removed now-superseded `parseGitHubSource`/`AtlasError` imports. `tsc` clean, build succeeds, Feature 001 31/31, Feature 002 103/103, all `tests/unit/` 20/20. `ConnectedSourcesDialog.tsx`/`SourcesMenu.tsx`/stores/fetch logic untouched.
- [x] **T016**: manual regression, US3 complete (T013–T015). Same disclosed gap as T007/T012 (no browser extension). Verified: dev server clean, all 4 routes 200, no console errors after picking up `Tabs` import. Code-tracing substitute: default mode `"users"` confirmed, mode reset on both open+close confirmed in source, validation logic already has 14 passing tests (T014). Export JSON/Connected Sources/`AtlasScene` untouched by T015 — no regression risk. `tsc` clean, build succeeds, Feature 001 31/31, Feature 002 103/103, `tests/unit/` 20/20. **US3 (Add Sources two modes) fully done.**
- [x] **T017**: `src/routes/index.tsx` — dropped `defaultValue="categories"` from the legend `Accordion` (one line, no new React state, uncontrolled Radix). `categories.tsx` confirmed untouched (has no Accordion at all — discrepancy flagged and corrected last turn). `tsc` clean, build succeeds, Feature 001/002 unaffected.
- [x] **T018**: manual regression, US4 complete (T017). Same disclosed gap as T007/T012/T016 (no browser extension, no live click-through). Verified: dev server clean, all 4 routes 200, `git diff index.tsx` shows only 3 changed lines total (T003 swap + T017's one-line change, no other layout edit exists), `Stat` row confirmed structurally outside/before the `Accordion`, `AccordionTrigger` click handler unmodified (Radix's own toggle, not app code). `tsc` clean, build succeeds, Feature 001/002 unaffected. **US4 (Category panel collapsed by default) fully done.**
- [x] **T019**: `src/lib/atlas-config.ts` — `InitialSourceEntry` type + `parseInitialSources()`; `serverAtlasConfig()` now returns `loadInitialSources`/`initialSources`. Malformed JSON/non-array falls back to default single entry; individual bad entries silently dropped. **Config surface only** — `repositories.functions.ts` doesn't consume it yet (T020's job); hardcoded default owner still active via `fetchDefaultOwnerRepositories(config.defaultOwner)`, unchanged. `tsc` clean, build succeeds, Feature 001/002 unaffected.
- [x] **T020**: `src/lib/repositories.functions.ts` — default-path branch now config-driven. `loadInitialSources:false` → `notLoadedResponse()` (new `source: "not_loaded"` union member, additive-only, doesn't affect existing `=== "fallback"` checks). Single default-owner entry keeps the exact pre-existing fast path (zero regression at defaults); multiple/non-default entries reuse `fetchCustomRepositories`'s existing multi-source pipeline, `isDefault: true` preserved. Self-caught defect: `parseSourceInputs([])` throws uncaught if all `initialSources` entries were invalid-type — added an empty-entries guard before it could crash. Custom-sources branch untouched. `tsc` clean, build succeeds, Feature 001/002 + `tests/unit/` all unaffected. **US5 implementation complete (T019–T020)** — T021 (config unit tests) and T022/T028 (regression) remain.
- [x] **T021**: `tests/unit/atlas-config.test.ts` — 11 tests for `serverAtlasConfig()`'s config-parsing surface (env-var manipulation, no mocking). Scope note: config-parsing only, not actual loading behavior (that's T020, covered by T028/T022). Notable: explicit test that all-entries-invalid → empty list, not a fallback substitution (intentional, matches T020's own empty-entries guard). No implementation defect found. `tsc` clean, 11/11 pass, Feature 001/002 unaffected, all `tests/unit/` 31/31.
- [x] **T022**: manual regression, config-driven initial sources. Same disclosed gap as T007/T012/T016/T018 (no browser extension). Verified: dev server clean boot under 4 distinct env configs (default, single override, multi override, disabled), all HTTP 200, zero server errors. `useSourcesStore` precedence confirmed structurally untouched (no diff). `tsc` clean, build succeeds, Feature 001 31/31, Feature 002 103/103, `tests/unit/` 31/31.
- [x] **T028**: blocker resolved (authorized) — `repositories.functions.ts` lacked the plain-handler split every other `.functions.ts` file has; extracted `getRepositoriesHandler()` verbatim, `getRepositories` now delegates to it, zero behavior change. `tests/integration/repositories/initial-sources.test.ts` — 6 tests (default fast path, multi-entry combine, disabled→not_loaded, unsupported-type skip, all-invalid→not_loaded, custom-sources unaffected). Network mocked at module boundary only. `tsc` clean, 6/6 pass, Feature 001/002 unaffected. **US5 (config-driven initial sources) fully done (T019–T022, T028).**
- [x] **T023**: `src/lib/repository-intelligence-extension-points.ts` — `SelectedRepositoryForAnalysis` type + `buildSelectedRepositoriesForAnalysis()`, shape matches Feature 001's `RepositoryIdentity` (verified against real source). Filters to `kind: "repo"` only, derives `name` from `sourceUrl`'s last segment. Zero `code-intel` import (comment-only reference). `tsc` clean, build succeeds, Feature 001/002 unaffected.
- [x] **T024**: `src/components/atlas/SourcesDialog.tsx` — added `selectedForAnalysis` state, populated via `buildSelectedRepositoriesForAnalysis(unique)` in `handleLoad`'s success path, gated on `mode === "repositories"` (Users mode unaffected). Reset on dialog open/close. No server call, no Feature 001 import, no "analyzed" UI text. `tsc` clean, build succeeds, Feature 001/002 unaffected.
- [x] **T025**: manual regression, US6 complete (T023–T024). Same disclosed gap as prior manual-regression tasks (no browser extension). Verified: dev server clean, HTTP 200, no console errors. Code-tracing substitute: `mode === "repositories"` gate confirms Users mode untouched; hook makes no network call at all (pure `setState`, structurally guarantees zero Feature 001/002 calls); lifecycle reset confirmed on open+close; grep confirms zero "analyzed"/"intelligence-ready" strings anywhere in `SourcesDialog.tsx`; `SourcesMenu.tsx`/`ConnectedSourcesDialog.tsx`/`AtlasScene` untouched by T023/T024. `tsc` clean, build succeeds, Feature 001 31/31, Feature 002 103/103, all `tests/unit/`+`tests/integration/repositories/` 37/37. **US6 (Repository intelligence extension points) fully done (T023–T025).**
- [x] **T026**: `AtlasSourcesChrome.tsx` cleanup. Re-grepped `src/` fresh this session — zero import references (only the file itself + a comment mention in `SourcesMenu.tsx`). Deleted `src/components/atlas/AtlasSourcesChrome.tsx`, no other file needed an import removed (all 4 route call sites were already on `SourcesMenu` since T003–T006). `tsc` clean; `bun run build` succeeds; Feature 001 regression 31/31 (clean first run, no flake); Feature 002 suite 103/103; `tests/unit/` + `tests/integration/repositories/` 37/37. **Only T027 (final full regression + manual quickstart walkthrough) remains for Feature 003.** Per session discipline, stopping here — awaiting go-ahead for T027.

---

## 2026-09-21 — Feature 003: T026 complete (new session, resumed via SESSION_HANDOFF.md)

## 2026-09-21 — Feature 003: T027 complete — feature fully done

Final full-regression validation. No code modified (no regression discovered).

**Build/type**: `tsc` clean. `bun run build` succeeds.

**Test suites**: Feature 001 31/31 (run twice back-to-back, zero flake either run). Feature 002 103/103. `tests/unit/` + `tests/integration/repositories/` 37/37 combined; `initial-sources.test.ts` also run standalone: 6/6 (default fast path, multi-entry combine, disabled→`not_loaded`, unsupported-type skip, all-invalid→`not_loaded`, custom-sources unaffected).

**Route validation**: dev server booted clean (port 4950). All 4 routes (`/`, `/catalogue`, `/categories`, `/insights`) → HTTP 200. Zero `AtlasSourcesChrome` occurrences in any rendered HTML. `grep -c "<SourcesMenu"` = 1 in each of the 4 route files (no duplicates). `SourcesDialog` mounted exactly once, at `__root.tsx` (shared modal across routes, by design — matches architecture decision, not a duplicate control). `ConnectedSourcesDialog` mounted exactly once, inside `SourcesMenu.tsx` (local `useState` per menu instance, by design). Dev log showed only the pre-existing, unrelated `THREE.Clock` deprecation warning — no new errors/warnings introduced.

**Source workflows** (code-trace only — see limitation below): `SourcesMenu.tsx`'s 3 `DropdownMenuItem`s all wired to real handlers — Add Sources → `setDialogOpen(true)`, Export JSON → real `exportRepositoriesJson()` call, Connected Sources → real `setConnectedSourcesOpen(true)`. `SourcesDialog.tsx` has both `TabsTrigger`s present (`users`, `repositories`), mode-gated validation confirmed via T014's 14 passing unit tests.

**Extension point**: `SelectedRepositoryForAnalysis` type and `buildSelectedRepositoriesForAnalysis()` both exist in `src/lib/repository-intelligence-extension-points.ts`. Grepped that file and `SourcesDialog.tsx` for `code-intel` — zero import matches (only a comment referencing Feature 001's shape for documentation, not a dependency). No Feature 001/002 coupling introduced.

**Limitation (disclosed, consistent with every prior manual-regression task this feature)**: no browser extension was connected this session. No live click-through was performed on the Sources dropdown, Connected Sources dialog, Add Sources tabs, category-panel collapse, or config-driven startup visuals. All workflow claims above are code-level (wiring/type-existence/grep), not observed-in-browser. A real interactive pass remains a good idea before shipping to end users, though nothing in this session surfaced a reason to expect one would fail.

**Regressions found**: none.

**Feature 003 (GitHub Source Enhancement) readiness**: complete. All 27 tasks (T001–T028) done. All 6 user stories functionally complete and validated to the extent possible without a browser. No outstanding tasks in `specs/003-github-source-enhancement/tasks.md`. Nothing has been committed this session — commit is a separate, explicit ask.

---

## 2026-09-21 00:22 +04 — Session Handoff Doc: Feature 003 → Code Intelligence

### Created `SESSION_HANDOFF_FEATURE003_TO_CODE_INTELLIGENCE.md`
- [x] Verified Feature 003 completion facts against real files (SourcesMenu, ConnectedSourcesDialog, deriveConnectedSources, SourceInputMode, atlas-config.ts initial-sources, repository-intelligence-extension-points.ts) before writing
- [x] Confirmed `SelectedRepositoryForAnalysis` type + `buildSelectedRepositoriesForAnalysis()` match exactly, no `code-intel/**` coupling
- [x] Documented architecture boundaries, ratified decisions (provider/trigger/retention), validation state (tsc clean, build OK, 31/31 + 103/103 + 37/37, browser-extension click-testing gap disclosed), git state, recommended commit point
- [x] **Flagged a factual discrepancy in the requested doc content**: `specs/001-code-intelligence-foundation/` already has `plan.md`+`tasks.md` (54/54 done) and `src/lib/code-intel/` is fully implemented — the requested "next action: run `/speckit-plan`" is stale. Corrected §7 to present the real options (resume Feature 002's remaining T036+ tasks, scope the next phase spec, or spec the 003→001 hand-off) instead of silently complying with a false premise
- [-] No code changes, no commits — doc-only task per instructions
