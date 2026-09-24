# RepoAtlas Architecture Decision Gate

Synthesizes all 10 prior research documents plus `.specify/memory/constitution.md` and `specs/001-dynamic-github-sources/` into resolvable architectural decisions for the Code Intelligence initiative. Read-only analysis — no code, schema, or spec changes made. Evidence tags as in prior docs: `[EXTRACTED]` `[RESOLVED]` `[INFERRED]` `[UNKNOWN]`.

## Executive Summary

Six decisions are ready to ratify with high confidence (source provider abstraction shape, evidence model, core graph node/edge set, retrieval composition, impact-analysis-before-process-discovery reordering, AST runtime approach). Two decisions are consequential and only medium-confidence pending a small technical spike (snapshot acquisition strategy: API vs clone; persistence: D1 vs alternatives). One decision (Workers execution model for AST/graph compute) is the single highest-leverage choice in the whole initiative and is recommended as an **asynchronous, queue-driven, many-short-invocations pattern**, not a separate always-on service — this keeps RepoAtlas fully within its existing all-Workers deployment story rather than introducing a second infrastructure surface. The current constitution (v1.0.0) was written for the repo-metadata atlas product and does not yet address evidence integrity, deterministic-vs-inferred knowledge, or runtime-portability of heavy compute — amendments are proposed, not applied. The `06-process-discovery` → `07-impact-analysis` phase order should be swapped.

---

## 1. Source Provider Architecture

**Decision**: Introduce a `RepositorySource` (or equivalently named) interface that separates two distinct responsibilities RepoAtlas currently conflates by not having an abstraction at all: (a) **metadata provider** — what the existing GitHub REST integration does (list repos, stars, topics, description), and (b) **source-content provider** — what Code Intelligence needs (fetch a file tree / file contents at a specific ref). These should be modeled as two capabilities a provider implementation may offer, not forced into one interface.

**Options**:

- **A. Single unified `SourceProvider` interface** covering both metadata and content.
- **B. Two separate interfaces** (`MetadataProvider`, `ContentProvider`), a given concrete provider (e.g. `GitHubSource`) implements both, but callers depend only on the interface they need.
- **C. Leave metadata fetch as-is, bolt on a separate content-fetch module with no shared abstraction.**

**Evidence**: [EXTRACTED] Current code has zero abstraction (`SOURCE_PROVIDER_ANALYSIS.md` §1) — `repositories.functions.ts:13` calls `github-fetch.ts` directly. [RESOLVED] Neither reference project models "provider" this way at all — both assume a local checkout already exists (`SOURCE_PROVIDER_ANALYSIS.md` §4), so there is no reference precedent to copy for this specific decision; it must be reasoned from RepoAtlas's own requirements. [INFERRED] `SOURCE_PROVIDER_ANALYSIS.md` §6 already flags that forcing one interface to do both jobs is likely wrong.

**Trade-offs**: Option A is simplest to introduce but risks the Code Intelligence layer depending on interface surface (e.g. star counts) it has no business depending on, weakening the "intelligence layer must not depend directly on GitHub/GitLab APIs" requirement. Option B has more upfront interface design cost but cleanly satisfies that requirement and matches the existing codebase's separation instincts (TanStack Query owns server data, Zustand owns view state — `REPOATLAS_CURRENT_ARCHITECTURE.md` §7 — the app already favors narrow, single-purpose interfaces). Option C defers the real problem.

**Recommendation**: **B**. Provider responsibilities: a `MetadataProvider` returns repository listing/stars/topics/description (today's need); a `ContentProvider` returns, for a given repository + ref, a resolved commit SHA, a file tree, and file contents on demand. Repository identity should be provider-qualified (`{provider: "github", owner, name}`, not a bare string) so a future second provider doesn't collide on name alone. Branch/ref handling: accept a ref (branch name, tag, or SHA) at the `ContentProvider` boundary and always resolve it to a concrete commit SHA before anything downstream touches it — the SHA, not the ref, is what flows into the snapshot layer (see §2). Authentication boundary: stays exactly where it is today — server-side only (`GITHUB_TOKEN` in server functions), per constitution Principle III, which already mandates this and should extend unchanged to any `ContentProvider` implementation. The Engineering Graph and everything above it must depend only on the provider-neutral domain model (`Repository`, `Snapshot`, `FileEntry`), never on GitHub/GitLab response shapes.

**Confidence**: High. This is a design-pattern decision with no exotic technical risk; the only real cost is upfront interface discipline.

---

## 2. Source Snapshot Strategy

**Decision**: How does RepoAtlas acquire file content at a specific commit SHA to feed AST analysis?

**Options**:

- **A. Git provider API** (GitHub Contents API / Git Trees API / GitLab Repository Files API) — fetch files individually or as a tree listing via REST, no git binary involved.
- **B. Git clone** (shallow or full) to ephemeral storage, then read from the filesystem.
- **C. Archive/download** (GitHub's `codeload.github.com/.../tarball/{sha}` or `.zip` endpoints) — one bulk download instead of per-file API calls.
- **D. Hybrid** — archive/download for the bulk case, falling back to per-file API fetch for languages/paths that need re-fetching (e.g. incremental re-analysis of a few changed files).

**Evidence**: [RESOLVED] Neither reference project solves this — both assume B has already happened, outside their own scope (`SOURCE_PROVIDER_ANALYSIS.md` §4, `CODE_INTELLIGENCE_GAP_ANALYSIS.md` gap #2). This is evaluated purely against RepoAtlas's own runtime, not reference precedent. [EXTRACTED] Production runtime is Cloudflare Workers with no persistent local filesystem and no `git` binary available (`REPOATLAS_CURRENT_ARCHITECTURE.md` §12) — this **eliminates Option B outright in production** (git clone requires a git binary and writable disk, neither of which Workers provides). B remains viable in local dev only (Bun/Node has both).

**Evaluation against the required dimensions**:

| Dimension              | A (API)                                                                  | B (clone)                                                             | C (archive)                                                          | D (hybrid)                                                                |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| GitHub                 | Native (Contents/Trees API), rate-limited per-file                       | Works locally only                                                    | Native (`codeload` tarball), fast for whole-repo                     | Best of both                                                              |
| GitLab                 | Similar Repository Files API exists (if GitLab support is ever restored) | Works locally only                                                    | GitLab archive endpoint exists                                       | Best of both                                                              |
| Cloudflare Workers     | Viable — plain `fetch()`, no filesystem needed                           | **Not viable** — no git binary, no persistent disk                    | Viable — `fetch()` + streaming unzip/untar in Workers-compatible JS  | Viable, combines both                                                     |
| Local development      | Viable, matches prod behavior                                            | Viable, but diverges from prod acquisition path                       | Viable                                                               | Viable                                                                    |
| Large repositories     | Slow — one HTTP round-trip per file, rate-limit-expensive                | Fast once cloned, but clone itself can be large/slow                  | Fast — one download, but must fully unpack before any file is usable | Fast bulk + targeted incremental                                          |
| Incremental updates    | Natural fit — fetch only changed paths via Trees API diff                | Natural fit — `git fetch`/`git diff`, but unavailable in Workers prod | Poor fit — full re-download needed for any change                    | Natural fit — archive for cold start, per-file API for incremental deltas |
| Reproducibility        | High — content addressed by SHA via API                                  | High — SHA is git's native identity                                   | High — tarball is SHA-addressed                                      | High                                                                      |
| Commit-level evidence  | Direct — API responses are already SHA-scoped                            | Direct — git's native model                                           | Direct — tarball URL embeds SHA                                      | Direct                                                                    |
| AST analysis readiness | Requires reassembling a file tree before parsing                         | Filesystem tree is immediately parseable                              | Requires unpacking before parsing                                    | Requires unpacking for bulk path, immediate for incremental path          |

**Trade-offs**: A is the most "Workers-native" but has the worst cost profile for large repos (hundreds/thousands of API calls, hitting GitHub rate limits fast — the existing `github-fetch.ts` already works around GitHub pagination/rate limits for repo listing, `SOURCE_PROVIDER_ANALYSIS.md` §2, and code-content fetching at file granularity would be substantially worse). C is efficient for a cold full-repo index but wasteful for touching one file after a small change. D avoids both weaknesses but has the most implementation surface.

**Recommendation**: **D (hybrid)** — archive/download (C) as the bulk acquisition path for initial/full snapshot indexing (matches Workers' `fetch()`-only capability, avoids per-file rate-limit pressure, and gives a single SHA-addressed artifact that is naturally reproducible), with the git-provider API (A) used for targeted incremental re-fetch of specific changed paths once a prior snapshot exists (informed by, not copied from, CodeGraph's git-diff-based change detection concept — `ADOPTION_MATRIX.md` item 15). Option B (clone) should be explicitly out of scope for the production path and, if used at all, confined to local-dev tooling as a developer convenience, never as the canonical acquisition mechanism the Engineering Graph depends on — the graph's provenance must not depend on a mechanism unavailable in production.

**Confidence**: Medium. The directional choice (no clone in prod, archive-based bulk + API-based incremental) is well-supported by the Workers constraint alone; the specific archive-unpacking approach inside a Worker (streaming tar/zip decode within CPU/memory budget for large repos) has execution-detail risk that should be validated with a small spike before this is finalized in a spec.

---

## 3. Runtime / Execution Architecture

**Decision**: Where does AST parsing and graph-building compute actually run?

**Options**:

- **A. Entirely inside the Worker** (one request handles fetch → parse → resolve → persist for a whole repo, synchronously).
- **B. Partially inside the Worker** (Worker orchestrates and does light steps; a bounded per-invocation slice of heavy work happens per request/cron tick).
- **C. Separate analysis worker/service** (a distinct, non-Workers-constrained compute target — e.g. a container-based service, a different cloud provider, or Cloudflare's Containers product — that the main Worker calls into over HTTP).
- **D. Asynchronous analysis pipeline** (work is decomposed into many small, independent, queued units — e.g. Cloudflare Queues — each processed by a normal Worker invocation within its CPU/time budget; results accumulate in shared storage as they complete).

**Evidence**: [EXTRACTED] Cloudflare Workers imposes per-invocation CPU-time limits (`REPOATLAS_CURRENT_ARCHITECTURE.md` §12) — the exact figure depends on plan tier, but the architectural fact that matters is: **there is a hard bound, and it is much smaller than "parse and resolve an entire large repository."** [EXTRACTED] Production already runs the `nitro-module`/`cloudflare-module` preset (`vite.config.ts:20`) with no native filesystem and no long-running background process (`canUseSqlite()` disabling local SQLite for exactly this reason, `atlas-store.ts:47-54`). [RESOLVED] Neither reference project operates under any of these constraints — both are unconstrained local processes with multiprocessing/worker-thread pools and native-code performance paths (`GRAPHIFY_RESEARCH.md` §14, `CODEGRAPH_RESEARCH.md` §17) — so neither reference informs this decision directly; it must be reasoned from Cloudflare's platform primitives. [EXTRACTED] Tree-sitter has a WASM build (`web-tree-sitter`, used by CodeGraph's own WASM extraction backend, `CODEGRAPH_RESEARCH.md` §2) and WebAssembly execution is supported inside Cloudflare Workers — this is a genuinely relevant fact: **AST parsing of a single file via WASM tree-sitter is very plausibly within a single Worker invocation's CPU budget**, even though parsing an entire large repository in one invocation is not.

**Decision matrix**:

| Option                  | Fits Workers CPU limits                                     | Fits "no filesystem"                           | Needs new infra beyond Workers                                                   | Matches existing app's all-Workers deployment story               | Handles large repos                                       |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| A (entirely in Worker)  | **No** — fails for any non-trivial repo                     | Yes (if content streamed, not written to disk) | No                                                                               | Yes                                                               | **No**                                                    |
| B (partially in Worker) | Ambiguous — depends on what "partial" bounds to             | Yes                                            | Maybe (needs an orchestration mechanism for the unbounded part)                  | Partial                                                           | Ambiguous                                                 |
| C (separate service)    | N/A — sidesteps the limit by leaving the platform           | N/A                                            | **Yes** — a second deployment target, second ops surface, second cost line       | **No** — breaks the current single-Workers-deployment model       | Yes, if the service is sized for it                       |
| D (async pipeline)      | **Yes** — each unit sized to fit the budget by construction | Yes                                            | Small — Cloudflare Queues is a native platform primitive, not new infrastructure | **Yes** — stays inside the existing Cloudflare account/deployment | Yes — scales by unit count, not by single-invocation size |

**Trade-offs**: A is disqualified outright for anything beyond a trivial repo. C solves the CPU problem completely but at the cost of a second infrastructure surface — a real ops/cost/deployment burden the constitution's Simplicity & Minimal Scope principle (Principle V) would weigh against introducing without strong justification, and it breaks the "intelligence layer must not depend on infrastructure the rest of the app doesn't already have" spirit implicit in the current all-Workers architecture. D requires decomposing the indexing pipeline into genuinely independent, queueable units (one file's AST extraction; one symbol-resolution batch) — this is real design work, but it is Cloudflare-native work (Queues + Workers is a standard, supported pattern), not new infrastructure.

**Recommendation**: **D**, as the primary model — decompose snapshot acquisition, per-file AST extraction, and symbol resolution into queued units, each executed by an ordinary Worker invocation within its existing CPU budget, with intermediate results persisted incrementally (see §4) rather than held in one request's memory. This directly mirrors how both reference projects already parallelize extraction (Graphify's `ProcessPoolExecutor`, CodeGraph's worker-thread pools, `COMPARATIVE_ANALYSIS.md` "Performance strategy" row) — the _concept_ of "many small parallel units" is well-evidenced, only the specific mechanism (process pool vs Cloudflare Queue) changes to fit the runtime. **C should be held in reserve, not adopted now**: if D proves insufficient for genuinely large repositories (where even file-level decomposition doesn't fit Workers' per-invocation limits, or where a specific language's parser has no viable WASM build), a bounded, well-justified fallback to an external analysis service for _that specific case_ is more defensible than defaulting to C for everything. This should be a phase-1 (`01-foundation`) decision, validated with a small spike indexing a real mid-size repository before being locked into a spec.

**Confidence**: Medium-high on the directional choice (D over A/C), medium on the specific unit-decomposition granularity, which needs a spike.

---

## 4. Persistence Architecture

**Decision**: What stores repository metadata, snapshots, files, symbols, relationships, evidence, and supports BM25/FTS and graph traversal, while remaining edge-runtime compatible with local-dev parity?

**Options**:

- **Cloudflare D1** — SQLite-compatible, edge-native, serverless, supports SQL including FTS5-style full-text search.
- **External PostgreSQL** — full relational feature set, requires an external managed service and network calls from the Worker.
- **SQLite-compatible architecture generically** (i.e., the existing `atlas-store.sqlite.ts` local-dev pattern, without necessarily committing to D1 specifically).
- **Object storage** (Cloudflare R2) for large blobs.
- **Graph-specific database** (Neo4j/FalkorDB-style, as Graphify optionally exports to).
- **Hybrid relational + object storage.**

**Evidence**: [EXTRACTED] The existing app already has a two-tier, environment-aware persistence pattern (`AtlasCache`, `canUseSqlite()`, `REPOATLAS_CURRENT_ARCHITECTURE.md` §4) — this is direct evidence of the _shape_ of solution the codebase already favors: an interface with a Workers-compatible implementation and a richer local-dev implementation. [RESOLVED] Both reference projects use SQLite-family storage for their primary index (Graphify: flat `graph.json`, optional Neo4j/FalkorDB _export_, not primary storage; CodeGraph: SQLite with FTS5 as primary storage, `COMPARATIVE_ANALYSIS.md` "Persistence" row) — but neither runs on an edge/serverless runtime, so "CodeGraph uses SQLite" is not itself sufficient justification (per this task's explicit instruction not to choose a DB merely because CodeGraph does). The actual justification must come from RepoAtlas's own requirements.

**Requirement-by-requirement evaluation**:

- **Repository metadata, snapshots, files, symbols, relationships, evidence** — all are naturally relational/tabular data (nodes/edges/attributes), exactly the shape SQLite/D1 and Postgres both handle well; a dedicated graph database is not required for this data shape at RepoAtlas's likely scale (see `ADOPTION_MATRIX.md` item 17's rejection of flat-file storage and the general absence of evidence that either reference's graph size required a real graph-DB for correctness, only optionally for scale/query ergonomics).
- **BM25/FTS** — [EXTRACTED] SQLite's FTS5 extension provides this natively (CodeGraph's exact approach, `CODEGRAPH_RESEARCH.md` §8) and Cloudflare D1, being SQLite-compatible, supports FTS5 virtual tables. Postgres would need its own full-text search setup (tsvector/GIN), a different but comparable capability, at the cost of an external network hop from the Worker for every query.
- **Graph traversal** — [RESOLVED] both references implement traversal as _application-level_ BFS/DFS over an adjacency structure pulled from the store (Graphify: NetworkX in-memory after loading `graph.json`; CodeGraph: `GraphTraverser` issuing repeated SQL queries against the `edges` table, `CODEGRAPH_RESEARCH.md` §10) — **neither relies on native graph-database traversal operators**. This directly undercuts the case for a dedicated graph database: the evidenced pattern is "relational/flat storage + app-level traversal," not "graph-native storage."
- **Evidence** — maps to columns/JSON metadata on edges (CodeGraph's `edges.metadata` JSON + `provenance` column is a direct, evidenced precedent, `CODEGRAPH_RESEARCH.md` §7).
- **Incremental analysis** — needs per-file content-hash + a way to cheaply diff "what changed since last snapshot" (CodeGraph's `content_hash`/`indexed_at_commit` pattern, `ADOPTION_MATRIX.md` item 15) — straightforward in any relational store.
- **Edge runtime compatibility** — D1 is purpose-built for exactly this (a Cloudflare-native serverless SQL store callable from Workers with no filesystem dependency); external Postgres requires the Worker to make an outbound network call to a separate managed database on every operation, adding latency and a second billing/ops surface, in tension with the same Simplicity principle that argues against a separate analysis service in §3.
- **Local development parity** — [EXTRACTED] the existing `atlas-store.sqlite.ts` local-SQLite-with-Workers-memory-fallback pattern is a direct, proven precedent (`REPOATLAS_CURRENT_ARCHITECTURE.md` §11) for exactly this problem; D1 additionally has an official local-emulation mode (via Wrangler/Miniflare) that runs against a real local SQLite file, giving closer prod/dev parity than the current app's memory-vs-SQLite split, since D1's local emulator and its production engine are both SQLite-family.
- **Large blobs** (raw source file content for snapshots) — a relational store is a poor fit for storing many large text blobs directly; R2 (object storage) is the evidenced-by-general-practice right tool for content-addressed blob storage, with D1 holding only metadata/pointers (path → R2 key), not the file content itself.

**Recommendation**: **Hybrid: Cloudflare D1 (nodes, edges, snapshots, evidence, FTS5 index) + Cloudflare R2 (raw source file blobs, content-addressed by hash)**. Reject a dedicated graph database for v1 — not evidenced as necessary by either reference project's actual traversal implementation, and it would introduce the same "second infrastructure surface" cost flagged as a concern in §3. Reject plain external Postgres for the same reason. This combination directly extends the existing `AtlasCache`-style pluggable-backend precedent already in the codebase (§11 of `REPOATLAS_CURRENT_ARCHITECTURE.md`) rather than introducing an unrelated pattern.

**Confidence**: High on rejecting a dedicated graph DB and rejecting external Postgres; high on D1+R2 as the directional choice; medium on exact schema shape (informed-but-not-copied from CodeGraph's `nodes`/`edges`/`unresolved_refs` design, `ADOPTION_MATRIX.md` item 15) pending the Foundation-phase spec.

---

## 5. AST / Symbol Analysis Architecture

**Decision**: How does AST/symbol extraction actually execute, and which languages does the first version support?

**Options for extraction mechanism**: Tree-sitter via WASM · native Rust (CodeGraph's kernel approach) · pure-TypeScript hand-written parsers · a separate analyzer process outside the Worker.

**Evidence**: [EXTRACTED] Native Rust binaries **cannot run inside Cloudflare Workers** — Workers execute JavaScript/WASM only, not arbitrary native code; this eliminates CodeGraph's native-kernel approach for the Workers-execution portion of the pipeline outright, regardless of its demonstrated performance benefits in CodeGraph's own (unconstrained, local) environment (`ADOPTION_MATRIX.md` item 19 already flags this as DEFER/premature — this decision gate makes it a hard elimination for the Workers path specifically, not merely a deferral). [EXTRACTED] `web-tree-sitter` (WASM) is a proven, evidenced approach — it is CodeGraph's own primary/fallback extraction backend (`CODEGRAPH_RESEARCH.md` §2) and WASM execution is a first-class Cloudflare Workers capability. Hand-written pure-TS parsers would mean reimplementing what tree-sitter grammars already solve, for every target language — not evidenced as necessary or wise by either reference (both chose tree-sitter over hand-rolled parsing).

**Recommendation for mechanism**: **WASM tree-sitter**, executed as one of the queued units in the §3 async pipeline (one file, one parse, within a single Worker invocation's budget). This is the only mechanism that is simultaneously reference-evidenced (via CodeGraph) and Workers-compatible.

**Options for initial language scope**: RepoAtlas today catalogs arbitrary public GitHub repositories with no language restriction (`repositories.ts` classifier handles any language present in GitHub API metadata, `REPOATLAS_CURRENT_ARCHITECTURE.md` §5) — so "the 25/41 languages from the references" is not the right anchor; the right anchor is **what languages actually appear, and in what volume, across the repositories RepoAtlas already catalogs**, plus the practical cost of building and testing a resolution layer per language (`ADOPTION_MATRIX.md` item 5 already flags framework-aware and per-language resolution as high-surface-area work, DEFERred).

**Evidence for scope**: [UNKNOWN] This research pass did not query the actual distribution of languages across RepoAtlas's currently-cataloged repository set — that is a concrete, answerable question (a simple aggregation over existing `repositories.payload_json` data) that should inform language prioritization before Phase 3, not be guessed at here.

**Recommendation for scope**: Start with a **small, declaratively-configured set (informed by, not copied from, Graphify's `LanguageConfig` pattern — `ADOPTION_MATRIX.md` item 2)** — most plausibly JavaScript/TypeScript and Python given they are near-universally represented in GitHub's public repository population, but this should be confirmed against RepoAtlas's actual cataloged-repository language distribution before being locked in. Build the extraction layer so adding a language is a config addition (a `LanguageConfig`-equivalent), not a structural change, so scope expansion later is cheap — this is the one place where directly emulating Graphify's declarative pattern (rather than CodeGraph's more numerous bespoke per-language TS modules) is the better-evidenced choice for a system starting from zero languages.

**Confidence**: High on mechanism (WASM tree-sitter, no native code, no hand-rolled parsers). Medium on initial language set — directionally right, but the specific first two-to-three languages should be confirmed with real data, not assumed.

---

## 6. Engineering Graph Architecture

**Decision**: What is the minimum viable node/edge model for v1, separated from a future semantic/domain graph?

**Evidence**: Full node-by-node and edge-by-edge evaluation already performed in `REPOATLAS_EVOLUTION.md` §1, cross-checked against both references' actual `NodeKind`/`file_type` and relation vocabularies. This decision gate adopts that evaluation's verdict and makes the core/future split explicit and final for phase-planning purposes.

**Core structural graph (v1 — directly evidenced, language-independent or near-universal)**:

- Nodes: `Repository`, `Snapshot`, `Directory`, `File`, `Module`, `Class`, `Interface` (present-but-empty for languages without the concept), `Function`, `Method`.
- Relationships: `CONTAINS`, `IMPORTS`, `EXPORTS`, `CALLS`, `EXTENDS`, `IMPLEMENTS`, `USES`, `REFERENCES`.

**Deferred to future semantic/domain graph (not v1 — either framework-dependent, unevidenced, or noise-risk)**:

- `Package` (language-dependent — meaningful for npm/cargo/go-modules, needs the corresponding resolver work; not blocking for a single-language-family v1).
- `Variable` (evidenced but noisy — `REPOATLAS_EVOLUTION.md` §1 flags this as a precision/noise tradeoff neither reference treats as core).
- `Component`, `Endpoint` (both require framework-specific resolvers — CodeGraph's 30+ framework resolvers, `ADOPTION_MATRIX.md` item 5 — explicitly DEFERred elsewhere in this research set; premature until that work exists).
- `Process`, `Event` (no node-level precedent in either reference at all; `Process` is better modeled as a derived query-time traversal per §10 below, not a persisted node).
- `DECORATED_BY`, `ANNOTATED_WITH` (no edge-level precedent — CodeGraph tracks decorators as a node _property_, not a relationship; reconsider these as node metadata, not new edge types, unless evidence emerges otherwise).
- `ROUTES`, `PUBLISHES`, `CONSUMES`, `READS`, `WRITES` (framework-dependent or entirely unevidenced — real candidates for a _later_ phase once entry-point/data-access resolution exists, not v1).

**Trade-offs**: A smaller v1 graph ships faster and is easier to validate for correctness (fewer edge cases, smaller resolver surface), at the cost of not yet supporting Component/Endpoint/Process-shaped questions a user might ask early. Given RepoAtlas has zero existing graph infrastructure, shipping a correct, well-tested narrow graph is lower-risk than shipping a broad, partially-speculative one — directly consistent with constitution Principle V (Simplicity & Minimal Scope: "avoid speculative abstractions... not named in an approved spec").

**Recommendation**: Adopt the core/deferred split above as the v1 scope boundary for `sdd/04-engineering-graph`. Each deferred node/edge should be reconsidered only once its specific prerequisite (a framework resolver, a data-access convention detector, real usage evidence of noise-vs-value for `Variable`) actually exists — not added speculatively.

**Confidence**: High — this is a direct application of already-thorough evidence gathered in `REPOATLAS_EVOLUTION.md` §1, not a new judgment call.

---

## 7. Evidence Model

**Decision**: Finalize the evidence-state vocabulary and the required metadata each fact/edge must carry.

**Evidence-state options**: 4-state (`EXTRACTED`/`RESOLVED`/`INFERRED`/`UNKNOWN`, as originally proposed) vs 5-state (same four, plus a distinct `AMBIGUOUS`).

**Evidence**: [RESOLVED] Graphify's evidenced, tested model is 3-state (`EXTRACTED`/`INFERRED`/`AMBIGUOUS`) with `AMBIGUOUS` explicitly meaning "resolution attempted, multiple candidates found, flagged for human review" — a materially different meaning from "not yet attempted," which is what `UNKNOWN` naturally denotes (`REPOATLAS_EVOLUTION.md` §2). CodeGraph's model is coarser still (binary `provenance` tag, no distinct ambiguous state). [INFERRED] Conflating "unattempted" and "attempted-but-ambiguous" into one `UNKNOWN` bucket loses exactly the distinction Graphify's own test suite (`test_inferred_confidence_rubric.py`, `GRAPHIFY_RESEARCH.md` §7) exists to protect — a downstream consumer (e.g. an impact-analysis report) needs to know whether an unresolved reference is "we haven't looked" versus "we looked and genuinely can't tell," because the latter is a stronger, more actionable signal (worth surfacing to a user; the former is not).

**Recommendation**: **Add `AMBIGUOUS` as a fifth, distinct state.** Definitions:

- `EXTRACTED` — directly observed in source/AST (an import statement, a call expression) with no resolution step involved.
- `RESOLVED` — deterministically derived by following symbols/imports/exports/scopes/types to a concrete target (an import resolved to a specific file via module-resolution rules).
- `INFERRED` — derived through naming convention, framework convention, or other indirect/heuristic evidence, and therefore carries a confidence score, not just a label (following Graphify's discrete-rubric precedent — `GRAPHIFY_RESEARCH.md` §7 — rather than a free-floating float, to avoid the exact regression class Graphify's own test suite was built to catch).
- `AMBIGUOUS` — resolution was attempted and produced multiple, non-disambiguable candidates; flagged for review, never silently collapsed to one guess.
- `UNKNOWN` — resolution has not been attempted, or attempted and failed to produce any candidate at all (distinct from `AMBIGUOUS`'s "too many candidates").

**Where each is allowed**: `EXTRACTED` and `RESOLVED` may appear on any edge produced by deterministic static analysis. `INFERRED` may only appear where a confidence score accompanies it. `AMBIGUOUS` and `UNKNOWN` are terminal states for a given resolution attempt at a point in time — they may be revisited on a future re-index (e.g. a new file makes a previously-ambiguous reference resolvable) but must never be silently upgraded to `RESOLVED`/`EXTRACTED` without a genuine new resolution event.

**Core rule** (restated, non-negotiable per the task framing): an `INFERRED` or `AMBIGUOUS` relationship must never be presented to a user or consumed by a downstream ranking/impact calculation as if it were `EXTRACTED`/`RESOLVED` — every surface that displays or uses a relationship must be able to show its evidence state.

**Required evidence metadata per fact/edge**: `repository` (provider-qualified identity, per §1), `commit_sha` (the snapshot this fact was extracted from, per §2), `file` (source path), `line_range` (start/end), `extraction_method` (which extractor/resolver produced it — informed by CodeGraph's `provenance` column, `CODEGRAPH_RESEARCH.md` §7), `analyzer_version` (so re-indexing after an extractor bugfix is distinguishable from a real source change — direct precedent in Graphify's versioned AST-cache schema, `GRAPHIFY_RESEARCH.md` §13), `confidence` (the state, plus a score when `INFERRED`), `relationship_type` (which edge kind this is).

**Confidence**: High. This is a direct, well-evidenced synthesis of two references' actual tested behavior, resolving the one open question (`REPOATLAS_EVOLUTION.md` §2) explicitly in favor of the richer model.

---

## 8. Retrieval Architecture

**Decision**: What retrieval modes belong in v1?

**Evidence**: [RESOLVED] Five of six proposed modes are evidenced by at least one reference; vector search is evidenced _against_ by both (`REPOATLAS_EVOLUTION.md` §4, `COMPARATIVE_ANALYSIS.md` cross-cutting observations). Exact identifier lookup, lexical/BM25 search, graph traversal, and graph-structural ranking (CodeGraph's RWR/PageRank, the more sophisticated of the two references' approaches, `CODEGRAPH_RESEARCH.md` §11) are all directly evidenced. Metadata filtering has a direct existing-codebase precedent (`catalogue.tsx`'s category/language/topic filters, extending naturally to the symbol/graph level). Evidence-weighted _ranking_ specifically (folding confidence tier into the retrieval score formula, not just labeling results with it) is the one mode `REPOATLAS_EVOLUTION.md` §4 flags as not directly evidenced by either reference's actual ranking formula.

**Recommendation**: **v1 = exact identifier search + BM25 (via D1's FTS5, per §4) + graph traversal + metadata filtering.** State this explicitly: **BM25 + graph traversal is sufficient for the first version** — this satisfies the task's explicit instruction to state so if true, and it is true here: both are independently evidenced as effective by both reference implementations, together cover lexical and structural retrieval, and require no new infrastructure beyond what §4's D1+R2 decision already provides. **Do not add vector search in v1** — no evidence in this research base justifies it, and both references arrived at the same rejection independently, which is unusually strong negative evidence for a two-sample comparison. Evidence-weighted ranking (as opposed to evidence-_labeled_ results, which is mandatory per §7) can be deferred to a later retrieval-tuning pass once the base retrieval modes are live and real query behavior can inform whether ranking-by-confidence is actually needed, or whether confidence labeling alone (shown to the user, not folded into the score) is sufficient.

**Confidence**: High on excluding vector search and on BM25+traversal sufficiency; medium on the exact BM25/traversal blend ratio, which is a tuning question for implementation, not an architecture question for this gate.

---

## 9. Impact Analysis

**Decision**: Can impact analysis be implemented before Process Discovery, and how should structurally-proven vs inferred impact be distinguished?

**Evidence**: [RESOLVED] Directly and strongly evidenced by Graphify's `affected.py` — fuzzy seed resolution, reverse BFS over a filterable, confidence-taggable relation set, depth bounding, call-site-location reporting (`REPOATLAS_EVOLUTION.md` §6, near 1:1 architectural match). [RESOLVED] Neither reference gates impact analysis behind a process-discovery layer — both compute impact directly from the raw call/reference graph (`ENGINEERING_LINEAGE.md`, "Process Intelligence → Impact Intelligence" transition verdict). Impact analysis's only real dependencies are the Engineering Graph (§6) and, for ranking/report quality, Knowledge Retrieval (§8) — not Process Discovery.

**Recommendation**: **Yes — Impact Analysis can and should be built before Process Discovery.** Pipeline: target (NL query or identifier) → seed resolution (informed by Graphify's `resolve_seed`, refusing to guess when ambiguous, matching the `AMBIGUOUS` evidence state from §7) → reverse traversal over `CALLS`/`IMPORTS`/`REFERENCES` (the v1 core edge set from §6) → depth-bounded affected-node collection → report, grouped by the entry-point-ish node each hit traces back to (a lightweight grouping, not a dependency on a full Process Discovery capability — this resolves the "Entry Bounds → Affected processes" ambiguity flagged in `REPOATLAS_EVOLUTION.md` §6). **Structurally proven impact** = every edge on the traversal path is `EXTRACTED` or `RESOLVED`. **Inferred impact** = at least one edge on the path is `INFERRED`; the report must surface this per-hit (matching Graphify's `AffectedHit.via_relation` pattern) rather than presenting a single undifferentiated "blast radius." **Unresolved impact** = traversal reaches a node whose further edges are `UNKNOWN`/`AMBIGUOUS` — the report should say so explicitly rather than silently truncating. "Blast radius" must never be reported as uniformly deterministic.

**Confidence**: High — this is the best-evidenced net-new capability in the entire research base, with a near-direct architectural template.

---

## 10. Process Discovery

**Decision**: Where does Process Discovery belong in the phase sequence, and what does it require?

**Evidence**: [RESOLVED] Confirmed absent from both references as a first-class capability (`ENGINEERING_LINEAGE.md`, `REPOATLAS_EVOLUTION.md` §5). The closest existing precedent is CodeGraph's `named-symbol-flow.ts` (path-finding among named symbols within an already-built graph, `CODEGRAPH_RESEARCH.md` §10) — a query-time derived capability, not a persisted graph layer.

**Requirements**: entry-point detection (framework-dependent — requires the framework resolvers already DEFERred in §6/`ADOPTION_MATRIX.md` item 5), call graph (available once §6's core graph exists), framework metadata (same dependency as entry-point detection), graph traversal (available once §8's retrieval/traversal exists), endpoint detection (same framework-resolver dependency), event detection (unevidenced entirely — no precedent in either reference, per `REPOATLAS_EVOLUTION.md` §1's node-model evaluation).

**Recommendation**: **After Impact Analysis**, per §9's finding that the two are not strictly ordered by evidence and Impact Analysis is lower-risk with a near-direct template. Scope Process Discovery as a **derived query-time traversal** (a labeled path through the existing `CALLS` graph, computed on demand and informed by CodeGraph's `named-symbol-flow.ts` pattern) rather than a first-class persisted `Process` node or subgraph, consistent with §6's graph-model recommendation. Full value (true entry-point/endpoint/side-effect detection) is genuinely blocked on framework-specific resolver work that is out of scope for the initial phases — so Process Discovery should ship an initial, narrower version (call-path tracing between named symbols, without automatic entry-point discovery) before framework resolvers exist, then grow in capability once they do. This makes it **partially parallel with later Impact Analysis refinement**, not a hard sequential blocker in either direction, but it should not gate the initial Impact Analysis phase.

**Confidence**: Medium — the reordering and "derived, not persisted" scoping decisions are well-evidenced; the specific initial-version feature cut (call-path tracing without entry-point detection) is a reasonable but somewhat arbitrary line that the Process Discovery phase's own spec should validate against real use cases.

---

## 11. MCP / Agent Architecture

**Decision**: Which MCP capabilities should eventually exist, and what do they depend on?

**Dependency mapping** (not implementation — capability-to-primitive dependency only):

| Tool                   | Depends on                                                                     | Available once                                                        |
| ---------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `search_symbols`       | Retrieval (§8: exact + BM25)                                                   | §4 Graph + §8 Retrieval exist                                         |
| `get_symbol`           | Graph node lookup (§6)                                                         | §4/§6 exist                                                           |
| `get_file`             | Snapshot + file index (§2)                                                     | §2 exists                                                             |
| `find_callers`         | `CALLS` edges, reverse traversal (§6)                                          | §4/§6 exist                                                           |
| `find_callees`         | `CALLS` edges, forward traversal (§6)                                          | §4/§6 exist                                                           |
| `find_importers`       | `IMPORTS` edges, reverse traversal (§6)                                        | §4/§6 exist                                                           |
| `find_dependents`      | Generalization of the above (`CALLS`+`IMPORTS`+`REFERENCES` reverse traversal) | §4/§6 exist                                                           |
| `find_entry_points`    | Framework/route detection (DEFERred, §6/§10)                                   | Blocked until framework resolvers exist                               |
| `trace_execution`      | Process Discovery (§10)                                                        | Blocked until §10's initial version exists                            |
| `analyze_blast_radius` | Impact Analysis (§9)                                                           | §9 exists                                                             |
| `get_evidence`         | Evidence model (§7)                                                            | §7 exists (evidence metadata is present on every fact from the start) |

**Evidence**: [RESOLVED] Both references' actual MCP tool sets map cleanly onto this dependency structure — CodeGraph's `codegraph_callers`/`codegraph_callees`/`codegraph_impact`/`codegraph_node` (`CODEGRAPH_RESEARCH.md` §14) and Graphify's `get_node`/`get_neighbors`/`shortest_path` (`GRAPHIFY_RESEARCH.md` §12) are all graph/retrieval-primitive-dependent tools with no process-discovery prerequisite, while neither reference has a `trace_execution`-equivalent tool at all, consistent with §10's finding that Process Discovery is unevidenced and should ship last among the capability-dependent tools.

**Recommendation**: Most of the proposed MCP surface (`search_symbols`, `get_symbol`, `get_file`, `find_callers`, `find_callees`, `find_importers`, `find_dependents`, `analyze_blast_radius`, `get_evidence`) is buildable as soon as its listed dependencies exist — i.e., substantially before the MCP phase itself, meaning `08-mcp-agent-interface` is genuinely just an _interface_ phase (exposing already-built primitives), not a phase that needs to invent new graph/retrieval capability, which matches both references' treatment of MCP as the outermost consuming layer (`ENGINEERING_LINEAGE.md`, "Impact Intelligence → Agent/MCP Intelligence" transition). `find_entry_points` and `trace_execution` should be explicitly marked as capability-blocked in the MCP phase's own spec, not silently stubbed. Every tool response should follow the "sufficiency" and adaptive-token-budget design principles adopted as guidance in `ADOPTION_MATRIX.md` items 13–14 (CodeGraph's evidenced pattern) — directly relevant given RepoAtlas's Workers response-size/CPU constraints make bounded output closer to a hard requirement than a nicety (`REPOATLAS_EVOLUTION.md` §7).

**Confidence**: High on the dependency mapping; medium on exact tool naming/shape, which is implementation detail for the MCP phase's own spec.

---

## 12. Constitution Assessment

**Current constitution** (`.specify/memory/constitution.md`, v1.0.0, ratified 2026-09-16) has 5 principles, all written for the repo-metadata 3D atlas product as it exists today.

**Principles already sufficient, no amendment needed**:

- **Principle III (Server-Side Secrets & Resilience)** already establishes the exact pattern this research recommends extending: "Production targets Cloudflare Workers (Nitro): filesystem SQLite MUST be behind a storage adapter that falls back to memory when no filesystem exists" — this is a direct, ratified precedent for §4's D1+R2 recommendation and for the general "the app already knows how to degrade gracefully across the Workers/local-dev boundary" pattern this research leans on repeatedly. No change needed; Code Intelligence persistence should simply follow this existing principle.
- **Principle V (Simplicity & Minimal Scope)** already argues against exactly the kind of speculative scope (new libraries, features not in an approved spec) this research repeatedly recommends deferring (Component/Endpoint nodes, vector search, dedicated graph DB, a separate analysis service). No change needed; Code Intelligence work should continue to be held to it.

**Principles needing amendment**:

- **Evidence integrity has no current principle.** None of the 5 existing principles address the EXTRACTED/RESOLVED/INFERRED/AMBIGUOUS/UNKNOWN distinction, or the core rule that inferred facts must never be presented as extracted ones (§7). This is a genuinely new non-negotiable the constitution should encode once Code Intelligence ships, analogous in spirit to how Principle I ("Data Fidelity") already treats repository metadata trust as non-negotiable — a new principle (or an amendment to Principle I broadening it beyond GitHub-metadata-specific language) should extend that same trust discipline to code-level facts.
- **Provider independence** is implied by this research (§1) but not yet a constitutional commitment — the constitution's Technical Constraints table currently lists "GitHub REST public API" as _the_ data source with GitLab explicitly out of scope ("Out of scope unless a ratified spec adds them: ... GitLab live sync"). If Code Intelligence is meant to be provider-neutral in its domain model even while GitLab support itself stays out of scope, that distinction (provider-neutral _architecture_ vs. GitHub-only _current implementation_) is worth stating explicitly so future contributors don't conflate "we only support GitHub today" with "the domain model is GitHub-shaped."
- **Commit-based source truth** (§2's snapshot-as-authoritative-evidence-layer principle) has no current analog — Principle I's Data Fidelity is about _repository metadata_ fidelity (stars, topics, descriptions), not source-code fidelity at a specific commit. A new clause or principle should establish that code-level facts are only ever asserted relative to a specific, recorded commit SHA, mirroring Principle I's spirit but for a different data class.
- **Runtime portability for heavy compute** (§3's async-pipeline decision) extends Principle III's existing Workers-degradation pattern but goes further — Principle III currently only requires _falling back gracefully_, not _decomposing compute to fit a hard per-invocation budget_. Worth an explicit amendment or sub-clause once the async-pipeline pattern is implemented, so future features don't reintroduce a "do it all in one request" anti-pattern.
- **Incremental indexing and bounded context hydration** (§8, §7 of `REPOATLAS_EVOLUTION.md`) are new operational disciplines with no current constitutional hook — worth a clause once Phase 3+ work exists to describe concretely (premature to word precisely before any indexing pipeline is built).
- **No regression to the existing 3D repository atlas** — Principle II (Visualization-First, Data-Driven) already exists and already says "New features MUST feed it data, not rewrite funnel geometry... unless a spec explicitly requires a visualization change." This principle is _already sufficient_ to protect the existing atlas from Code Intelligence regression, provided Code Intelligence work is disciplined about treating itself as a new data feed, not a scene rewrite — worth calling out as a **reaffirmation**, not a new principle, when the first Code Intelligence spec is written.
- **Attribution/open-source lineage** — no current principle addresses adapting architecture from third-party OSS references. Given this research's `ATTRIBUTIONS.md` establishes that no literal code is being reused (only architectural adaptation, permitted without attribution obligation under both Apache-2.0 and MIT), a lightweight governance clause ("architectural adaptation from reference implementations is permitted and should be documented in research/ADRs; literal code reuse requires a license/attribution review first") would formalize the discipline this research has already been following, rather than leaving it as an implicit practice.

**Recommendation**: Propose these as amendments for human review when the Foundation-phase spec is written — **do not modify `constitution.md` in this pass**, per the task's hard boundary. A MINOR version bump (new principles/materially expanded sections, not redefinition of existing non-negotiables) is the right classification per the constitution's own versioning policy (§"Governance").

**Confidence**: High that these gaps exist (direct comparison against the ratified document); the exact wording of any amendment is a drafting exercise for whoever owns the constitution, not this research pass.

---

## 13. Revised Phase Sequence

Starting from the on-disk `sdd/` structure (`01-foundation` through `10-integration-hardening`) and applying every finding above:

| #   | Phase                          | Change from original                                                                                                                                                                                                                                                                                      | Reason                                                                                                                                                                                                                                                                        |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Foundation                     | **Expanded scope**: must now explicitly resolve and ratify the runtime/execution model (§3: async queue-driven pipeline, no separate service), persistence architecture (§4: D1+R2), and provider abstraction shape (§1: two-interface split) as concrete architectural decisions, not just process setup | These three decisions are prerequisite to every phase after them; leaving them implicit risks each subsequent phase re-litigating them piecemeal                                                                                                                              |
| 02  | Source Snapshot                | Unchanged position; scope should specify the hybrid archive+incremental-API acquisition strategy (§2) explicitly                                                                                                                                                                                          | Correctly ordered already; this research adds the specific acquisition-strategy decision it needs                                                                                                                                                                             |
| 03  | AST & Symbols                  | Unchanged position; scope should specify WASM tree-sitter mechanism + a small, evidence-confirmed initial language set (§5), not the reference projects' 25/41-language scope                                                                                                                             | Correctly ordered; scope needs tightening per §5                                                                                                                                                                                                                              |
| 04  | Engineering Graph              | Unchanged position; scope should be explicitly bounded to the core structural node/edge set (§6), with the deferred set named and excluded, not left ambiguous                                                                                                                                            | Correctly ordered; scope needs the explicit core/future split from §6                                                                                                                                                                                                         |
| 05  | Knowledge Retrieval            | Unchanged position; scope should explicitly state BM25+graph traversal is sufficient for v1 and vector search is out of scope (§8)                                                                                                                                                                        | Correctly ordered; scope needs the explicit inclusion/exclusion list from §8                                                                                                                                                                                                  |
| 06  | **Impact Analysis** (was 07)   | **Moved up**, swapping with Process Discovery                                                                                                                                                                                                                                                             | §9: near-direct architectural template, lower risk, depends only on Engineering Graph + Knowledge Retrieval, not on Process Discovery — evidenced by both references computing impact directly from the raw graph                                                             |
| 07  | **Process Discovery** (was 06) | **Moved down**, swapping with Impact Analysis; scope narrowed to derived query-time call-path tracing for its initial version                                                                                                                                                                             | §10: unevidenced by either reference as a first-class capability, highest design risk of any phase, genuinely blocked on framework-resolver work for its full vision — better sequenced after the team has real experience with the graph from building Impact Analysis first |
| 08  | MCP / Agent Interface          | Unchanged position; scope should note that most tools are buildable as soon as their §11 dependency is met (i.e., substantially before this phase starts, if phases 04–07 land their primitives incrementally), with `find_entry_points`/`trace_execution` explicitly marked capability-blocked           | Correctly ordered as the outermost interface layer; §11 clarifies it's an exposure phase, not a new-capability phase                                                                                                                                                          |
| 09  | Code Intelligence UI           | Unchanged position                                                                                                                                                                                                                                                                                        | No reference precedent evaluates this ordering either way (`REPOATLAS_EVOLUTION.md` §8); no new evidence from this gate changes that                                                                                                                                          |
| 10  | Integration Hardening          | Unchanged position                                                                                                                                                                                                                                                                                        | No new evidence changes this; standard closing phase                                                                                                                                                                                                                          |

**Not recommended**: splitting `03-ast-symbols` into separate extraction/resolution phases now (flagged as a future candidate in `REPOATLAS_EVOLUTION.md` §8, but premature while the language scope is still small per §5 — revisit if/when the language set grows enough that extraction and resolution genuinely need independent release cadences).

---

## 14. Architectural Decisions Required Before Spec Kit

In dependency order — the Foundation-phase spec cannot be written without these resolved:

1. **Provider abstraction shape** (§1) — two-interface split (`MetadataProvider`/`ContentProvider`), provider-qualified repository identity, ref-to-SHA resolution boundary. _Ready to ratify._
2. **Runtime/execution model** (§3) — async, queue-driven, many-small-invocations pattern; no separate analysis service for v1. _Ready to ratify directionally; unit-decomposition granularity needs a spike._
3. **Snapshot acquisition strategy** (§2) — hybrid archive (bulk) + provider-API (incremental); no git-clone in production. _Ready to ratify directionally; Worker-side archive-unpacking needs a spike._
4. **Persistence architecture** (§4) — D1 (structured/FTS5) + R2 (blobs); no dedicated graph DB, no external Postgres for v1. _Ready to ratify._
5. **AST mechanism and initial language scope** (§5) — WASM tree-sitter; language set to be confirmed against actual cataloged-repository data before being locked. _Mechanism ready to ratify; scope needs one data query first._
6. **Core graph node/edge boundary** (§6) — the explicit core-vs-deferred split. _Ready to ratify._
7. **Evidence-state vocabulary** (§7) — 5-state model (adding `AMBIGUOUS`), required metadata fields. _Ready to ratify._
8. **Retrieval v1 scope** (§8) — exact + BM25 + traversal + metadata filter; no vector search. _Ready to ratify._
9. **Phase reordering** (§13) — swap Impact Analysis and Process Discovery. _Ready to ratify._
10. **Constitution amendment proposal** (§12) — for human review; not blocking Foundation-phase work to start, but should land before or alongside the first Code Intelligence spec so the spec can be checked against an up-to-date constitution per the existing Governance/Compliance process.

---

## 15. Open Questions

- [UNKNOWN] Actual language distribution across RepoAtlas's currently-cataloged repositories — a concrete, answerable data question that should be run before finalizing §5's initial language set.
- [UNKNOWN] Worker-side feasibility of streaming archive (tar/zip) decode within CPU/memory budget for large repositories — needs a small technical spike before §2 is fully locked.
- [UNKNOWN] Exact unit-decomposition granularity for the async indexing pipeline (per-file? per-batch-of-files? per-symbol-resolution-chunk?) — needs a spike alongside the above, informed by real repository size distribution.
- [UNKNOWN] Whether GitLab support is still a live product goal or was permanently descoped (`SOURCE_PROVIDER_ANALYSIS.md` §6) — affects how much the §1 provider abstraction should be validated against a second concrete implementation now vs. later.
- [UNKNOWN] Graphify's exact MIT-vs-Apache file-level boundary (`ATTRIBUTIONS.md`) — low priority, only relevant if literal code reuse is ever proposed, which it is not currently.
- [UNKNOWN] Whether any specific target language's tree-sitter grammar has WASM build gaps or known limitations that would affect §5's language prioritization — worth checking per-language before finalizing scope, not assumed universally solved.
- **Open design question, not just missing data**: whether `INFERRED` confidence scores should use Graphify's exact discrete rubric `{0.95, 0.85, 0.75, 0.65, 0.55}` or a RepoAtlas-specific rubric — §7 recommends _a_ discrete rubric (to avoid the regression class Graphify's own tests guard against) but does not mandate copying Graphify's specific numbers, which were tuned for Graphify's own extraction heuristics.
- Whether the Cloudflare Queues-based async pipeline (§3) should be paired with Durable Objects for coordinating multi-step indexing state (e.g., "has this snapshot finished all its extraction units yet") — flagged as an implementation-detail question for the Foundation-phase spec, not resolved here, since it doesn't change the higher-level architectural decision (D over A/C).

---

## Feasibility Ratification

Resolves the two open feasibility questions flagged in §15 (Worker archive-decode feasibility, initial language scope). Read-only spike: no dependencies installed, no code written, no benchmarks run against live infrastructure. Cloudflare platform facts below were verified against current Cloudflare Workers documentation (`developers.cloudflare.com/workers/runtime-apis/web-standards/`, `.../platform/limits/`); language-distribution facts were computed directly from the repository's own existing dataset (`repos.json`).

### Archive Decode

**Decision**: The proposed bulk-acquisition path (provider archive/tarball → Worker → decode → R2) is architecturally sound, provided it is implemented as a true streaming pipeline and provided large repositories are handled via the already-decided queue-fan-out model (§3), not a single unbounded invocation.

**Evidence**:

- [EXTRACTED, verified via Cloudflare docs] Cloudflare Workers natively implements the Web Streams `CompressionStream`/`DecompressionStream` API, supporting `gzip`, `deflate`, and `deflate-raw` — confirmed directly against current Cloudflare documentation. This means **gzip decompression requires no external library, no WASM, and no native binary** — it is a built-in platform primitive.
- [EXTRACTED] GitHub serves repository archives as gzip-compressed tarballs at `codeload.github.com/{owner}/{repo}/tar.gz/{ref}` (also `.zip`). GitLab's Repository Archive API serves the equivalent at `.../-/archive/{ref}/{project}-{ref}.tar.gz` (also `.zip` and other formats). Both providers support tar.gz, making it the natural common format rather than needing per-provider format branching.
- [RESOLVED] The tar format itself (POSIX ustar / GNU tar, what both providers emit) is a sequence of fixed 512-byte header blocks followed by file-content blocks — it requires no seeking, no central-directory lookup, and no compression library of its own (tar is an uncompressed container; the `.gz` wrapper is the only compression layer, already handled by `DecompressionStream`). A tar entry parser is a small, dependency-free, pure-JS/TS loop over a byte stream — well within what a Worker can execute without a native binary or additional WASM module. This is a materially simpler decode path than ZIP, which requires parsing local file headers and (for full correctness) a central directory that sits at the _end_ of the archive — a poor fit for sequential streaming. **Recommendation: standardize on tar.gz, not zip, for both providers.**
- [EXTRACTED, verified via Cloudflare docs] Relevant platform limits: **128 MB memory** per Worker isolate (JS heap + WASM combined) — this is the binding constraint on buffering; **CPU time** (not wall-clock) is metered separately, with a 30-second default and up to 5-minute cap on paid/Unbound plans (the free plan's 10ms CPU budget is not viable for this workload and a paid plan should be assumed as a deployment prerequisite for Code Intelligence, distinct from what the existing repo-metadata app requires today); **no enforced response-body size limit** at the Workers layer for a streamed fetch (plan-level CDN caps exist but don't block a streamed, non-cached pass-through); R2 allows up to 10,000 subrequests per invocation on paid plans, but only **6 simultaneous in-flight connections** awaiting response headers — write concurrency to R2 must be throttled, not issued unbounded in parallel.
- [INFERRED] Because CPU time (not wall-clock) is the metered resource, and `fetch()`/`DecompressionStream` reads and R2 `put()` writes are I/O-bound (the Worker is _awaiting_, not computing, for most of that time), a streaming fetch→decompress→R2-write pipeline's actual CPU cost is dominated by the tar-header-parsing loop and byte-copying — both cheap, linear-in-file-count operations. This makes the _architecture_ sound for small-to-medium repositories in a single invocation. It does **not** resolve what the maximum practical single-invocation repository size is — that depends on file count and total decompressed size in a way that requires an actual timed run to know precisely, not documentation alone.

**Trade-offs**: A pure streaming implementation (never buffering the full decompressed archive) is mandatory to respect the 128 MB memory ceiling — buffering an entire decompressed large monorepo before writing anything to R2 would fail for any repository whose uncompressed size approaches or exceeds that ceiling. A streaming implementation is more complex to write correctly (must handle tar entries split across stream chunk boundaries) than a buffer-then-parse implementation, but the buffer-then-parse approach is not viable at all for a meaningful fraction of real-world repositories, so this is not a discretionary trade-off — streaming is required. For very large repositories (very high file count or very large total size), even a well-written streaming pipeline may need to checkpoint partway through (e.g., after N files or N seconds of CPU time) and resume via a follow-up queued invocation rather than complete in one pass — this directly reuses, rather than conflicts with, the already-ratified async/queue-driven runtime model (§3), and is the same "many small bounded units" pattern already decided there.

**Confidence**: High on the architectural feasibility of the approach in principle (native gzip decompression + simple tar parsing + streaming R2 writes, all using only Workers-native primitives, no new dependency risk). Medium-low on the exact maximum single-invocation repository size before checkpointing is _required_ rather than optional — this specific number cannot be determined from documentation and needs an actual timed implementation spike against a real repository archive.

**Status**: **RATIFIED WITH CONSTRAINTS.** The architecture (tar.gz + native `DecompressionStream` + streaming tar parse + throttled R2 writes, decomposed via the existing queue model for large repos) is sound and should proceed into the Foundation-phase spec. The specific streaming-pipeline implementation and the exact large-repo checkpoint threshold remain **SPIKE REQUIRED** as an implementation-phase task (`sdd/02-source-snapshot`), not a blocker to ratifying the architectural direction itself.

### Language Distribution

**Decision**: Initial Code Intelligence language scope should be Java, JavaScript, and TypeScript (Tier 1), informed directly by RepoAtlas's own existing cataloged repository data — not by either reference project's 25/41-language coverage.

**Evidence**: [EXTRACTED] `repos.json` (the repository's own existing dataset, the default-owner GitHub snapshot the app was built and tested against) contains 92 repositories with a GitHub API `language` field. Computed distribution:

| Language                       | Count | % of total (92) |
| ------------------------------ | ----- | --------------- |
| _(null / no primary language)_ | 28    | 30.4%           |
| Java                           | 24    | 26.1%           |
| HTML                           | 11    | 12.0%           |
| JavaScript                     | 10    | 10.9%           |
| TypeScript                     | 8     | 8.7%            |
| CSS                            | 6     | 6.5%            |
| Liquid                         | 1     | 1.1%            |
| MDX                            | 1     | 1.1%            |
| NSIS                           | 1     | 1.1%            |
| Rust                           | 1     | 1.1%            |
| HCL                            | 1     | 1.1%            |

[RESOLVED] Java is the single largest language by repository count (26.1%). JavaScript + TypeScript combined represent 19.6% of the dataset and share a closely related tree-sitter grammar family (`tree-sitter-typescript` covers both TS and TSX, and is commonly extracted alongside `tree-sitter-javascript` as one extraction concern, matching CodeGraph's own bundling of these languages, `CODEGRAPH_RESEARCH.md` §2). The 30.4% with no detected primary language are predominantly non-code repositories (config, static assets, documentation-only) for which AST/symbol extraction has no meaningful target — they are correctly excluded from language-tier prioritization, not a gap in the analysis.

**Important limitation** [EXTRACTED, explicitly flagged]: `repos.json` is a single snapshot of one default owner's (`imdadareeph`) personal repositories — it is **not** a sample of the general population of public GitHub repositories that RepoAtlas's dynamic-sources feature (`specs/001-dynamic-github-sources`) allows any user to add. The live `data/atlas.sqlite` cache is currently empty (no repositories fetched in this environment), so no fresher or broader dataset exists to cross-check against. This is the only real repository-language data available in the project, and it is evidence, but it is **narrow, single-owner evidence**, not a representative sample. Any conclusion drawn from it about "what languages RepoAtlas users in general will need" is an **engineering assumption**, explicitly flagged as such below, not a data-proven fact.

**Tier assignment**:

**Tier 1 — required for initial RepoAtlas Code Intelligence** (grounded directly in `repos.json` data):

- **Java** — largest single language by count (26.1%) in the only available dataset.
- **JavaScript + TypeScript** (treated as one extraction concern) — second-largest combined grouping (19.6%), and [ENGINEERING ASSUMPTION, not measured in this dataset] near-universal across the broader public GitHub population that dynamic-sources users will draw from, which is independent corroborating justification beyond this narrow sample for prioritizing JS/TS this early despite Java's higher raw count here.

**Tier 2 — should be supported shortly after** (present in the data, but lower Code-Intelligence value or smaller signal):

- **HTML** (12.0% by count, third-largest) — [ENGINEERING ASSUMPTION] despite outranking TypeScript by raw repository count, HTML is largely markup with limited symbol/call-graph relationship value (no functions, classes, imports in the sense the Engineering Graph's core edge set — §6 — models); its Code Intelligence _value_ is lower than its repository-count share suggests, so it is placed in Tier 2 rather than Tier 1 on that basis, not on data volume alone.
- **CSS** (6.5%) — same reasoning as HTML: present in real repos, but low graph-relationship value for the CALLS/IMPORTS/EXTENDS/IMPLEMENTS core edge set.
- **Rust** (1.1%, a single repository in this sample) — [ENGINEERING ASSUMPTION] the sample size here is too thin (one repository) to justify Tier 1 on data alone, but both reference projects treat Rust as a mature, well-supported tree-sitter target (`GRAPHIFY_RESEARCH.md` §2, `CODEGRAPH_RESEARCH.md` §2), which lowers the marginal cost of adding it once Tier 1 infrastructure exists — placed in Tier 2 on tooling-maturity grounds, not data volume.

**Tier 3 — deferred until evidence requires them**:

- **Liquid, MDX, NSIS, HCL** (each 1.1%, one repository apiece in this sample) — signal too thin to prioritize now. [ENGINEERING ASSUMPTION, unverified in this pass] mainstream tree-sitter WASM grammar maturity for MDX and NSIS specifically was not checked against the tree-sitter grammar registry in this spike — flagged as unconfirmed, to be checked only if/when evidence (a user adding relevant repositories) makes this language pairing relevant.
- **All other languages supported by Graphify (25) or CodeGraph (41) that do not appear at all in RepoAtlas's own current dataset** — explicitly deferred. Per the task's explicit instruction, RepoAtlas is not adopting either reference project's language breadth by default; each additional language should be added only when RepoAtlas's own evidence (real cataloged repositories in that language) justifies it, consistent with `ADOPTION_MATRIX.md` item 5's existing framework-resolver deferral reasoning applied here to raw language scope.

**Is language concentration sufficient to justify an initial scope?** [RESOLVED] Yes — Java, JavaScript, and TypeScript together account for 45.7% of the 92-repository dataset (and a substantially higher share once the 30.4% non-code-language null entries are excluded from the denominator: 45.7% of 92 ≈ 65.6% of the 64 repositories that have _any_ detected language), which is a strong concentration signal from the only evidence available, sufficient to justify starting there rather than attempting broad coverage.

**Confidence**: High on the computed distribution itself (directly computed from the repository's own real data file, not estimated). Medium on the Tier 1/2/3 _boundary_ decisions, since they combine this narrow single-owner dataset with explicitly-flagged engineering assumptions about the broader population dynamic-sources users will introduce — the underlying data is solid, but its representativeness is genuinely uncertain and explicitly named as such above, not papered over.

**Status**: **RATIFIED WITH CONSTRAINTS.** Tier 1 (Java, JavaScript/TypeScript) is ready to lock into the `sdd/03-ast-symbols` phase scope. Tier 2/3 boundaries should be revisited once real dynamic-sources usage data exists (i.e., once users have actually added repositories beyond the default owner), since the current evidence base is narrower than the feature it's meant to inform.

### WASM Tree-sitter Runtime

**Decision**: The `Cloudflare Worker + WASM tree-sitter + queue-driven bounded processing` runtime model is technically viable in principle and requires no revision.

**Evidence**:

- [EXTRACTED] WebAssembly is a first-class supported module type in Cloudflare Workers (the same underlying capability CodeGraph itself relies on for its own `web-tree-sitter` WASM extraction backend, `CODEGRAPH_RESEARCH.md` §2 — the WASM binary format and execution model are host-agnostic; what CodeGraph runs under Node, Workers can run under its own WASM support). No new, unverified capability is being assumed here.
- [EXTRACTED, verified via Cloudflare docs] **128 MB memory** per isolate covers JS heap and WASM linear memory combined. A single tree-sitter language grammar WASM module is small (typically low single-digit megabytes when loaded), and a parse tree for one source file is proportionally small to that file's size — parsing **one file per invocation** (the unit size already implied by the queue-driven model in §3) sits comfortably within this budget with wide margin, even accounting for grammar-load overhead.
- [EXTRACTED] **64 MiB uncompressed bundle-size limit** applies to the Worker script itself, which constrains how many language grammars can be directly bundled into the deployed Worker. This is a concrete, evidence-based reason (not a speculative one) to keep the _directly-bundled_ grammar set narrow — directly reinforcing the Tier 1-first language scope above; additional grammars (Tier 2/3) can be lazy-loaded from R2 or fetched on demand later without requiring every grammar to ship in the base bundle, an implementation detail for the AST-phase spec, not a blocker here.
- [EXTRACTED] CPU-time limits (30s default / 5min max on paid plans) are generous relative to the cost of parsing a single file — this is a per-file-scoped operation, not a whole-repository operation, by construction of the already-decided queue model (§3), so the CPU-time constraint that mattered most for the _archive decode_ question (above) is much less binding here: individual file-parse units are inherently small.
- [RESOLVED] **Queue fan-out**: Cloudflare Queues is a native platform primitive (already assumed by §3's runtime decision) — dispatching one queue message per file (or small file batch) for parsing is a direct, well-supported pattern, not a novel one.
- [RESOLVED] **Retry/idempotency**: queued messages can be redelivered (standard at-least-once queue semantics) — each parse unit (and its resulting graph writes) must therefore be idempotent, keyed by `(snapshot commit SHA, file path, content hash)` so a retried message does not double-write nodes/edges into D1. This is a concrete implementation requirement to carry into the Foundation-phase spec (§14 of this document), not a reason to reconsider the architecture itself — both reference projects already model exactly this kind of idempotent, hash-keyed re-processing for their own incremental indexing (`ADOPTION_MATRIX.md` item 15).

**Trade-offs**: None material at the architecture level — the per-file-unit sizing that the queue model already assumed in §3 turns out to be well-matched to WASM tree-sitter's actual resource profile (small grammars, small per-file parse cost), rather than an arbitrary choice that now needs revisiting. The one real cost is the bundle-size-driven need to keep the directly-shipped grammar set narrow, which was already the direction §5's Tier 1 recommendation was heading for entirely separate (evidence-distribution) reasons — the two constraints reinforce the same conclusion rather than pulling in different directions.

**Confidence**: High. Every sub-claim here is either a direct, verified platform fact or a direct consequence of an already-ratified decision (§3's per-file queue unit), not a new speculative leap.

**Status**: **RATIFIED.**

### Snapshot Strategy Ratification

**Decision**: The architecture remains **HYBRID** — bulk acquisition via provider archive (tar.gz), incremental acquisition via provider API — exactly as proposed in `ARCHITECTURE_DECISION_GATE.md` §2. No change.

**Evidence**: The archive-decode feasibility findings above directly support, rather than undermine, the original §2 recommendation: native `DecompressionStream` support and tar's simple sequential structure make Worker-side archive decoding genuinely practical (not merely theoretically possible), and the one real constraint identified (large repositories may need checkpointing across multiple queued invocations rather than completing in one pass) is already accommodated by the async pipeline model this architecture had already committed to in §3, not a new problem the snapshot strategy introduces. Nothing in this spike surfaced evidence that would favor git-clone (still impossible in Workers production — no git binary, no persistent disk, unchanged from the original analysis) or a pure per-file-API-only approach (still inferior for bulk/cold-start acquisition due to per-file rate-limit and round-trip cost, unchanged from the original analysis) over the hybrid model.

**Trade-offs**: None new. The original trade-off analysis in §2 stands; this spike only resolved the _feasibility_ uncertainty around the archive-decode half of that hybrid, without surfacing anything that shifts the balance between the two halves.

**Confidence**: High that HYBRID remains correct. Medium-low, as stated above, on the precise large-repository checkpoint threshold within the archive-decode half — an implementation detail for `sdd/02-source-snapshot`, not a reason to reconsider the strategy.

**Status**: **RATIFIED.**

### Remaining Open Questions

- [SPIKE REQUIRED] Exact maximum practical single-invocation repository size (file count / decompressed byte threshold) before archive processing must checkpoint and resume via a follow-up queued invocation — requires an actual timed implementation run against a real repository archive, not resolvable from documentation alone.
- [SPIKE REQUIRED] The specific streaming tar-entry-parsing implementation (handling tar entries whose headers or content span multiple stream chunk boundaries) — an implementation-correctness question for `sdd/02-source-snapshot`, not an architecture question; the architectural direction is ratified regardless of this detail.
- [DEFERRED] Whether HTML/CSS (Tier 2) warrant a lighter-weight extraction mode (e.g., import/link-reference extraction only, without full symbol/AST modeling) given their markup-not-code nature — worth deciding when Tier 2 work actually begins, not now.
- [DEFERRED] Tree-sitter WASM grammar availability/maturity check for MDX and NSIS specifically (Tier 3) — only worth doing if/when evidence (real cataloged repositories in these languages) makes them relevant; not done in this spike.
- [DEFERRED] Re-running the language-distribution analysis once real dynamic-sources usage data exists (i.e., once users beyond the default owner have added repositories) — the current Tier 1/2/3 boundary rests on a narrow, single-owner dataset, explicitly flagged as a limitation above, and should be revisited against broader real usage before Tier 2/3 scope is locked into a spec.
- [UNKNOWN, unchanged from §15] Whether GitLab support is still a live product goal — still relevant to whether the archive-decode format work should be validated against GitLab's archive endpoint now or deferred alongside GitLab support generally.
