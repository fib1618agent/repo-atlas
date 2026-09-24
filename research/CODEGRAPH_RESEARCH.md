# CodeGraph — Source-Level Research

Reference repo: `../repotlas-references/codegraph` (`@colbymchenry/codegraph` v1.6.0, npm CLI + library + MCP server). All findings [EXTRACTED]/[RESOLVED] from source unless marked [INFERRED]/[UNKNOWN]. This is research on a third-party tool, not a RepoAtlas spec.

## 1. Structure

`src/index.ts` — public `CodeGraph` facade (init/open/close, indexAll, sync, searchNodes, getCallers/getCallees, getImpactRadius, buildContext, watch). `src/extraction/` (tree-sitter wrappers + per-language extractors + non-tree-sitter extractors for Svelte/Vue/Liquid/Delphi/MyBatis/Razor/CFML; `parse-worker.ts`/`parse-pool.ts` for off-thread parsing). `src/resolution/` (`ReferenceResolver` + `import-resolver.ts` + `name-matcher.ts` + 30+ framework resolvers + dynamic-dispatch synthesizers). `src/graph/` (`GraphTraverser`, `GraphQueryManager`, plus `named-symbol-flow.ts`, `dynamic-boundary-report.ts`, `type-hierarchy.ts`, `dead-code.ts`, `branch-guards.ts`). `src/db/` (SQLite adapter, schema, migrations, WAL). `src/search/` (FTS5 query helpers). `src/context/` (`ContextBuilder`, formatter, markers). `src/sync/` (`FileWatcher`, watch-policy, git-hooks, worktree). `src/mcp/` (server, daemon, transport, session, query pool). `src/installer/` (multi-agent installer). `src/bin/codegraph.ts` (CLI). `codegraph-kernel/` — separate Rust crate. `__tests__/` — 271 top-level `*.test.ts` files + `__tests__/evaluation/`.

## 2. AST extraction

Two parallel backends:

- **WASM tree-sitter** (`web-tree-sitter`, `tree-sitter-wasms`) — `.wasm` grammars in `src/extraction/wasm/*.wasm`, walker in `src/extraction/tree-sitter.ts` (~6,000+ lines) + per-language modules in `src/extraction/languages/*.ts`.
- **Native Rust kernel** (`codegraph-kernel/`, `Cargo.toml`, `build.rs`) — from-scratch re-implementation for performance, per-language Rust modules, bridged via `src/extraction/kernel/loader.ts` (native addon), `decode.ts`, `layout.ts` (wire-format ABI, `KERNEL_ABI_VERSION`). Routing is TS-side, per-language, gated behind byte-identical parity testing (`DEFAULT_ROUTED` set in `kernel/index.ts`). Kill switches: `CODEGRAPH_KERNEL=0`, `CODEGRAPH_KERNEL_LANGS`. Per-file safety valve: files with parse-tree ERROR nodes defer to the WASM path.

**41 declared languages** (`src/types.ts::LANGUAGES`, lines 79-121): typescript, javascript, tsx, jsx, arkts, python, go, rust, java, c, cpp, csharp, razor, php, ruby, swift, kotlin, dart, svelte, vue, astro, liquid, pascal, scala, lua, luau, objc, r, solidity, nix, yaml, twig, xml, properties, cfml, cfscript, cfquery, cobol, vbnet, erlang, terraform, unknown.

## 3. Semantic graph / node/edge model

Everything stored as one graph in SQLite (`nodes`+`edges` tables). Raw AST extraction produces nodes + structural `contains` edges + an `unresolved_refs` queue. A separate resolution pass (`ReferenceResolver`, `src/resolution/index.ts`) turns queued refs into concrete `calls`/`references`/`extends`/`implements`/`imports`/`type_of`/`instantiates`/`overrides`/`navigates` edges via import resolution, scope-aware name matching, 30+ framework-specific resolvers (Express, NestJS, Next.js, Laravel, Drupal, Rails, Spring/Play, Gin, Goframe, Vue/Nuxt, SvelteKit, Expo Router, React Router, TanStack Router, Cargo workspaces, Terraform, etc.), and dynamic-dispatch synthesizers (event/callback wiring, React re-render, native↔JS bridge events, queue/job dispatch, ORM descriptors) tagged `provenance: 'heuristic'` vs `provenance: 'tree-sitter'`. Deterministic static analysis throughout — **no LLM-based semantic understanding**.

## 4. Symbols

`Node` row (`src/types.ts:133+`): `id` (hash of file path + qualified name), `kind` (`NodeKind`: file, module, class, struct, interface, trait, protocol, function, method, property, field, variable, constant, enum, enum_member, type_alias, namespace, parameter, import, export, route, component, union), `name`, `qualifiedName`, `filePath`, `language`, position fields, `docstring`, `signature`, `visibility`, boolean flags (`isExported`/`isAsync`/`isStatic`/`isAbstract`), `decorators`/`typeParameters` (JSON arrays), `returnType`.

## 5. Cross-language representation

`NodeKind`/`EdgeKind`/`Language` (`src/types.ts`, `NODE_KINDS`/`EDGE_KINDS`/`LANGUAGES` const arrays) form a fixed, closed, shared vocabulary every extractor must emit into (e.g. Python `def`, Go `func`, Rust `fn` → all `kind: 'function'`). Array order is part of the Rust-kernel wire ABI (`kernel/layout.ts` — kinds cross JS↔Rust as integer indexes; must be appended, never reordered). No separate cross-language IR beyond this Node/Edge schema plus a per-node `language` tag.

## 6. Relationship resolution

Pipeline: files → `ExtractionOrchestrator` → DB (nodes/edges/files, refs queued) → `ReferenceResolver` (imports → name-matching → framework resolvers → synthesizers) → concrete edges → `GraphTraverser`/`GraphQueryManager` → `ContextBuilder`. Unresolved rows marked `'failed'` (not deleted) with a `name_tail` column so a later file change can retry them. Parallelized via `resolver-pool.ts` (kill switch `CODEGRAPH_NO_PARALLEL_RESOLVE=1`).

## 7. Persistent indexing / schema

SQLite via Node's built-in `node:sqlite` (`DatabaseSync`) — no native build step, no better-sqlite3 fallback (repo assumes Node ≥22.5 always ships `node:sqlite`). WAL mode + FTS5.

Tables (`src/db/schema.sql`): `schema_versions`; `nodes` (PK `id`); `edges` (PK autoincrement, `source`/`target` FK `ON DELETE CASCADE`, `kind`, `metadata` JSON, `line`/`col`, `provenance`, unique index `(source,target,kind,IFNULL(line,-1),IFNULL(col,-1))`); `files` (path PK, `content_hash`, `language`, size, timestamps, `node_count`, `errors` JSON, `generated` flag); `unresolved_refs`; `name_segment_vocab` (`(segment,name)` pairs, `WITHOUT ROWID`, lets NL words match camelCase symbols — routes around FTS5's camelCase-as-one-token tokenizer); `project_metadata` (key/value incl. `indexed_at_commit`); `nodes_fts` (FTS5 virtual table on id/name/qualified_name/docstring/signature, `content='nodes'`, synced via triggers). Data lives per-project under `.codegraph/`.

## 8. BM25

Via SQLite FTS5's built-in `bm25()` — no external library. `src/db/queries.ts:~1557`: `bm25(nodes_fts, 0, 20, 5, 1, 2)` — custom column weights (id=0, name=20, qualified_name=5, docstring=1, signature=2; name dominates). `bm25()` returns negative scores; code takes `Math.abs(row.score)` (`queries.ts:1582`). Combined additively with a `nameMatchBonus` (per comments in `types.ts:464`, `queries.ts:1336`) so short exact-name matches aren't buried.

## 9. Vector retrieval

**Not found.** No embeddings/vector-DB dependency in `package.json`. Only unrelated "vector" hits (struct-embedding comments, a graph random-walk "restart vector," explicitly commented "deterministic, no embeddings," `src/mcp/tools.ts:3210`). No semantic/embedding-based similarity search anywhere.

## 10. Graph retrieval

`src/graph/traversal.ts::GraphTraverser`: `traverseBFS(startId, options)` (depth/edgeKinds/nodeKinds/direction-bounded), `getCallers`/`getCallees` (recursive, depth-bounded), `getImpactRadius(nodeId, maxDepth)`, `findPath(...)`. `src/graph/queries.ts::GraphQueryManager` wraps these. Additional derivations: `type-hierarchy.ts`, `dead-code.ts`, `named-symbol-flow.ts` (path-finding among named symbols), `dynamic-boundary-report.ts`, `branch-guards.ts`.

## 11. Hybrid retrieval

No embeddings combined — "hybrid" = exact-name + FTS5/BM25 + CamelCase/compound substring + graph-structural relevance, fused with hand-tuned heuristics.

`ContextBuilder.findRelevantContext` (`src/context/index.ts:~462-1234`) — explicit 13-stage pipeline: extract candidate symbol names from NL query (regex on CamelCase/snake_case/SCREAMING_SNAKE/dot-notation/acronym) → exact-name lookup with co-location boosting → prefix/kind matching with stemming → per-term FTS5 search with multi-term-hit boosting → merge/dedup/max-score-across-channels → test-file deprioritization → dominant-file boost → multi-term co-occurrence re-ranking → CamelCase-boundary LIKE matching (catches substrings FTS5's tokenizer misses) → compound multi-term LIKE matching → sort/truncate/min-score filter → import/export resolution to definitions → graph BFS expansion from entry points + type-hierarchy expansion + diversity/test-file caps + edge recovery. Produces `confidence: 'high'|'low'`.

`ToolHandler.computeGraphRelevance` (`src/mcp/tools.ts:3216`) — Random-Walk-with-Restart/personalized PageRank over the call/reference graph (undirected adjacency over calls/references/extends/implements/overrides/instantiates/returns/type_of/imports/navigates), restart α=0.25 to FTS/exact-match seeds, 25 power-iteration steps, bounded to the candidate subgraph. Documented as a ranking signal text search cannot provide (structural relevance immune to tokenization traps).

No unified formula — each surface runs its own multi-signal heuristic.

## 12. Source snapshots

**No full source snapshotting/versioning system.** `project_metadata.indexed_at_commit` (`src/extraction/index.ts:1319`) stores only the git HEAD SHA the index was last fully synced to — used purely for incremental change detection, not for querying historical source at arbitrary commits. `files.content_hash` is per-current-state only; no multi-version history table. The DB reflects only current indexed state, overwritten on each sync.

## 13. Incremental indexing

- Content hashing: `hashContent()` = sha256 of file bytes; re-extraction only on hash mismatch (`extraction/index.ts:2727,3201,3356,3399`).
- Git fast path: `getGitHeadSha()`, `canTrustGitFastPath()`, `getGitChangedFiles()` (lines 1292-1375) use `git diff --name-status` between stored `indexed_at_commit` and current HEAD + `git status --porcelain`, falling back to full disk scan+hash when git history can't be trusted.
- Live watching: `src/sync/watcher.ts::FileWatcher` — Node's built-in `fs.watch` (no chokidar/native addon); macOS/Windows use single recursive watch, Linux watches each directory individually via inotify (bounded to avoid limit exhaustion). Debounced sync with retry/backoff and auto-degrade.
- Git-hook sync (`src/sync/git-hooks.ts`) as an opt-in alternative.
- Deletions/unresolved-ref retries handled via cascading FK deletes + `unresolved_refs.status='failed'` + `name_tail` retry.

## 14. MCP

Full MCP server: `MCPServer`/`ToolHandler` (`tools.ts`), `transport.ts`, `engine.ts`, `daemon.ts`/`daemon-manager.ts`/`daemon-registry.ts` (persistent background daemon per project, PPID/liveness watchdogs, writer-lock), `session.ts`, `server-instructions.ts`, `query-pool.ts`/`query-worker.ts`.

**8 tools** (`src/mcp/tools.ts`): `codegraph_search`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_node` (dual-mode: whole-file-with-dependents, or single-symbol-with-all-overloads), `codegraph_explore` (marked "PRIMARY TOOL" — main workhorse), `codegraph_status`, `codegraph_files`. CLI equivalent: `codegraph serve --mcp`.

## 15. Agent context / lazy hydration

Central differentiator, per `AGENTS.md`:

- **Adaptive output budget by repo size**: `getExploreBudget(fileCount)` / `getExploreOutputBudget(fileCount)` (`tools.ts:165,217`) — call-count and chars/files/per-file budgets scaled to repo size tier (`<500→1 ... ≥25000→5`), with a tested invariant that larger tiers never get smaller `maxCharsPerFile`.
- **`codegraph_explore` allocation** (`EXPLORE_ALLOCATION`, `allocateExploreBudget`, lines 518/679) — proportional per-file/per-symbol budget with "pinned file" guarantees for literally-named paths in the query, reservation invariants, displacement guards — extensively unit-tested.
- **"Sufficiency" design principle**: responses engineered complete enough the calling agent stops calling Read/Grep (`codegraph_node` returns full body + caller/callee trail + every overload in one call).
- **Error-shape discipline**: expected/recoverable conditions (unindexed project, symbol not found) return SUCCESS-shaped guidance text rather than `isError: true` — maintainer-observed that `isError` trains agents to abandon the tool.
- **`ContextBuilder.buildContext`** — separate from MCP explore; own tunables (`DEFAULT_BUILD_OPTIONS`: maxNodes=20, maxCodeBlocks=5, maxCodeBlockSize=1500, traversalDepth=1, minScore=0.3), per-file diversity cap (≤20%), non-production/test-file cap (≤15%), "Call paths" section (in-memory DFS, ≤3 chains), honest "low confidence" footer.
- **Security**: config-leaf nodes (secrets) never have their value read off disk in output — only key name/signature (`isConfigLeafNode`, `context/index.ts:1261`).

## 16. Persistence architecture

Single-file-per-project SQLite under `.codegraph/` (WAL + FTS5). No separate vector store, no external DB service — fully local-first. Rust kernel + WASM grammars are read-only shipped assets. A separate opt-in telemetry pipeline (Cloudflare Workers, `TELEMETRY.md`) is unrelated to the code index.

## 17. Performance

Parallel parsing (`parse-pool.ts`, worker-thread pool, per-worker WASM heap, periodic recycle, `CODEGRAPH_PARSE_WORKERS` override). Parallel resolution (`resolver-pool.ts`, ordered chunking for deterministic edge-insertion, `MIN_PARALLEL_BATCH=1000` threshold). Parallel MCP query serving (`query-pool.ts`). LRU caches (`lru-cache.ts`, `DEFAULT_CACHE_LIMIT=5000`, `memory-budget.ts` bounds total resolver memory). DB perf: WAL checkpoint management (`wal-valve.ts`), composite covering indexes, partial index for generated files. Daemon pre-warming/liveness (`daemon-manager.ts`, watchdogs) avoids re-scan on repeated MCP calls. Native Rust kernel gated behind byte-identical parity testing per language before rollout.

## 18. Tests

Vitest, two workspace projects (`engine`: Node; `ui`: jsdom+Svelte). 271 top-level test files: per-language kernel parity, framework resolution, MCP protocol/daemon behavior, CLI, installer contract tests (~47 parameterized cases per `AGENTS.md`), explore-budget/ranking regressions, DB/backend, concurrency. Separate `__tests__/evaluation/` harness (answer-quality scoring against synthetic projects, run via `npm run eval`, not part of `npm test`). Cross-platform validation (Docker/Linux, Parallels/Windows VM) documented in `AGENTS.md`, not automated in CI directly. `scripts/agent-eval/` — live-agent A/B evaluation harness.

## 19. Indexing & query lifecycles

**Indexing**: scan (respecting `.gitignore`+excludes) → parse-pool dispatch (WASM/kernel routing) → extraction emits nodes + structural edges + `unresolved_refs` + sha256 file hash → SQLite write (main thread only) → `ReferenceResolver` drains refs (import → name-match → framework → synthesizer, failures parked with retry metadata) → `indexed_at_commit` stamped → FTS5 triggers + `name_segment_vocab` populated incrementally. Subsequent runs use `sync()` (git fast-path or hash-diff).

**Query** (`codegraph_explore`): normalize query → pin literally-named files → hybrid-channel seed matching (exact/FTS5/substring) → `computeGraphRelevance` (PageRank) re-rank → `named-symbol-flow` path-finding → adaptive-budget output assembly. Simpler tools (`codegraph_node`/`callers`/`callees`/`impact`) go direct DB lookup → `GraphTraverser` walk → formatted result, no ranking heuristics. `buildContext` runs the full hybrid pipeline → BFS subgraph → code-block extraction → markdown/JSON formatting.

## 20. License — see `ATTRIBUTIONS.md` for full analysis

Summary: **MIT License** (`LICENSE`, `package.json "license": "MIT"`, copyright Colby Mchenry). Standard, unmodified, no field-of-use restriction. No per-file copyright headers observed. Fully permissive — reading/studying architecture and building an independent implementation carries no obligation; only literal code copying would trigger the notice-carry-forward requirement.

## What's directly relevant to RepoAtlas Code Intelligence

[INFERRED — architectural adaptation candidates, not code reuse]

- The dual WASM/native-kernel extraction strategy with byte-identical parity gating is a strong pattern _if_ RepoAtlas ever needs to optimize a hot extraction path — likely premature for RepoAtlas's initial phases.
- SQLite + FTS5 + `bm25()` is directly relevant: it's a zero-extra-dependency lexical search story, though RepoAtlas's Workers-only production runtime (no `node:sqlite`/native SQLite at the edge) means this pattern needs an edge-compatible substitute (e.g. D1, which does support FTS5-like querying) rather than direct reuse — see `SOURCE_PROVIDER_ANALYSIS.md` §5.
- The closed `NodeKind`/`EdgeKind` vocabulary approach (vs. Graphify's more open relation-string approach) is a concrete design choice worth deciding on explicitly for RepoAtlas's own graph model (see `CODE_INTELLIGENCE_GAP_ANALYSIS.md`).
- `ContextBuilder`'s budget/diversity/confidence-footer design is a mature reference point for RepoAtlas's proposed "lazy context hydration" (`REPOATLAS_EVOLUTION.md` §14).
- The "sufficiency" and "error-shape discipline" MCP design principles are directly reusable _guidance_, independent of any code, for RepoAtlas's own future MCP interface (SDD phase `08-mcp-agent-interface`).
- No source-snapshot/commit-history capability exists here either — reinforces that RepoAtlas's proposed snapshot model (§`SOURCE_PROVIDER_ANALYSIS.md`) is a genuinely novel piece of work, not adaptable from either reference project.
