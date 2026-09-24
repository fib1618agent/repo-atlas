# Graphify — Source-Level Research

Reference repo: `../repotlas-references/graphify`. All findings below are [EXTRACTED]/[RESOLVED] from source unless marked [INFERRED]/[UNKNOWN]. This document summarizes, for RepoAtlas evolution purposes, an existing third-party tool — it is research, not a spec for RepoAtlas.

## 1. Structure

~30k LOC, ~50 modules under `graphify/`, 132 test files (`tests/`, ~4,909 test functions), example corpora in `worked/`, docs (`ARCHITECTURE.md`, `docs/how-it-works.md`, `BENCHMARKS.md`). Pipeline per `ARCHITECTURE.md:8`: `detect() → extract() → build() → cluster() → analyze → report.generate() → export.to_*()`.

Key modules: `extractors/` (per-language + `engine.py` 6,955 lines + `resolution.py` 3,698 lines), `exporters/` (Neo4j/FalkorDB/HTML), `skills/` (per-agent prompt packages), `always_on/` (agent rule injection files), plus standalone pipeline files: `extract.py` (8,089 lines), `build.py` (2,414 lines), `serve.py` (2,617 lines, MCP/HTTP), `watch.py` (2,374 lines), `cache.py` (1,782 lines), `affected.py` (blast radius), `cluster.py`, `analyze.py`, `resolver_registry.py`.

## 2. Language support

25 tree-sitter-backed languages declared in `pyproject.toml` (Python, JS, TS, Go, Rust, Java, Groovy, C, C++, Ruby, C#, Kotlin, Scala, PHP, Swift, Lua, Zig, PowerShell, Elixir, Objective-C, Julia, Verilog, Fortran, Bash, JSON) + optional extras (Pascal, DM, HCL/Terraform, OCaml, Common Lisp, SQL) + pure-Python Robot Framework parser.

Pluggability: `extractors/models.py::LanguageConfig` (dataclass, lines 13-57) — declarative per-language spec (tree-sitter module, node-type sets, accessor fields, optional callables) consumed by one generic engine (`extractors/engine.py`). Languages needing bespoke handling (SQL, Terraform, Markdown, Pascal, DM) export their own `extract_<lang>()` function instead. `ARCHITECTURE.md:75-81` documents the extension recipe.

Cross-file language-specific _resolution_ (distinct from per-file extraction) is pluggable via `resolver_registry.py`: a `LanguageResolver(name, suffixes, resolve)` dataclass registered into a list, activated only if the corpus contains a matching suffix, fail-soft on exceptions.

## 3. Parsers / AST extraction

Tree-sitter-based (not custom parsers) — `extract.py` docstring: "Deterministic structural extraction from source code using tree-sitter." Version guard `_check_tree_sitter_version()` (`extract.py:5160`). Generic walk engine (`extractors/engine.py`) walks the parse tree per `LanguageConfig`; includes a call-graph second pass for INFERRED `calls` edges. `extractors/resolution.py` holds shared cross-file resolution (JS/TS import resolution incl. tsconfig aliases, Python module resolution, workspace/monorepo resolution, Go/Java/PHP type-reference resolution).

Symbol-resolution IR: `extractors/models.py` — frozen fact dataclasses (`_SymbolDeclarationFact`, `_SymbolImportFact`, `_SymbolAliasFact`, `_SymbolExportFact` with `type_only` flag, `_StarExportFact`, `_NamespaceExportFact`, `_SymbolUseFact`) aggregated into `_SymbolResolutionFacts` — a lightweight facts layer between raw AST and graph edges used to resolve imports/exports/re-exports deterministically.

## 4. Symbol extraction

Per-file, engine walks tree-sitter nodes matched against `LanguageConfig` type sets. IDs built deterministically via `extractors/base.py::_make_id` → `graphify/ids.py::make_id`. Duplicate same-file definitions collapse via a `seen_ids` set. `_LANGUAGE_BUILTIN_GLOBALS` denylist (`extractors/base.py:13-51`, ~90 names) filters language built-ins out of call-target resolution to avoid god-node pollution (references issue #726).

## 5. Node model

`ARCHITECTURE.md:50-65`, enforced by `validate.py`:

```json
{
  "id": "unique_string",
  "label": "human name",
  "source_file": "path",
  "source_location": "L42",
  "file_type": "code|document|paper|image|rationale|concept"
}
```

`REQUIRED_NODE_FIELDS = {"id","label","file_type","source_file"}`, `VALID_FILE_TYPES = {"code","document","paper","image","rationale","concept"}` (`validate.py:4,6`).

`build.py::_mint_external_stub` (lines 80-100) mints a leaf node for out-of-corpus import targets, tagged `type: "external", external: True, file_type: "concept"` — no edge ever has a dangling endpoint.

Node IDs are globally normalized through one module (`graphify/ids.py`) used by three independent producers (AST extraction, semantic/LLM extraction, graph-builder reconciliation) to prevent ID drift/ghost-node splitting — documented at length citing several historical bugs (#811, #550, #1033, #1104, #2614).

## 6. Edge model / relationships

`ARCHITECTURE.md` + `validate.py`:

```json
{
  "source": "id_a",
  "target": "id_b",
  "relation": "calls|imports|uses|...",
  "confidence": "EXTRACTED|INFERRED|AMBIGUOUS"
}
```

`REQUIRED_EDGE_FIELDS = {"source","target","relation","confidence","source_file"}` (`validate.py:7`). `VALID_CONFIDENCES = {"EXTRACTED","INFERRED","AMBIGUOUS"}` (`validate.py:5`).

Relation vocabulary observed in source: `calls`, `indirect_call`, `imports`, `imports_from`, `dynamic_import`, `re_exports`, `inherits`, `extends`, `implements`, `mixes_in`, `references`, `references_constant`, `uses`, `uses_component`, `uses_static_prop`, `contains`, `defines`, `method`, `includes`, `instantiates`, `binds_method`, `bound_to`, `listened_by`, `module_source`, `crate_depends_on`, `depends_on`, `requires_env`, `cites`, `rationale_for`, plus semantic-only `semantically_similar_to`.

Edge collapse precedence: `_GENERIC_RELATIONS = {"references","uses","mentions"}` (`build.py:63`) denylist ensures a generic relation never overwrites a more specific one for the same node pair.

Graph is NetworkX (`nx.Graph`/`nx.DiGraph`), built via `build_from_json(extraction, *, directed=False, root=None)` (`build.py:872`). Edge direction fidelity across load/save uses a stored `_src` marker (since NetworkX undirected storage can flip arc order).

**Hyperedges**: 3+-node group relationships stored in `G.graph["hyperedges"]`, with `_coerce_hyperedge_member_refs`/`_normalize_hyperedge_members` (`build.py:187-261`).

## 7. Evidence / provenance / confidence

Three-tier `EXTRACTED`/`INFERRED`/`AMBIGUOUS` label on every edge, enforced everywhere. `EXTRACTED` = directly observed (import/call statement). `INFERRED` = a deduction, carries an additional discrete `confidence_score` from a fixed rubric `{0.95, 0.85, 0.75, 0.65, 0.55}` — enforced by `tests/test_inferred_confidence_rubric.py`, which forbids the lazy default 0.5 and arbitrary floats (cites regression #2813: 128/128 INFERRED edges on graphify's own codebase once violated the rubric). `AMBIGUOUS` = flagged for human review in `GRAPH_REPORT.md`.

Origin marker `_origin` (`"ast"` for tree-sitter extraction, `extract.py:7969,7971`) used by `build.py::_is_ast_tier` (lines 41-52) to decide extraction-tier precedence during incremental rebuild/merge.

LLM/semantic-pass hallucination guard: `graphify/llm.py` — a returned symbol name with no textual evidence in the dispatched source is flagged `verification = "unverified"` rather than trusted or silently dropped (`tests/test_evidence_binding.py`).

Edge source-location provenance points at the actual call/import/reference _site_, not just the definition line (`affected.py` `AffectedHit.via_file`/`via_location`, lines 40-44).

Comment/rationale linkage: distinct `rationale_for` relation + `file_type: "rationale"` node type lets comments/docstrings attach as evidentiary rationale nodes.

A "learning overlay" (`graphify/reflect.py`, `.graphify_learning.json` sidecar) tracks per-node usage feedback (`preferred`/`contested`/`tentative`, use/neg counts, staleness) — display-only confidence adjustment layered atop the static labels.

## 8. Entry points / flow / process discovery

No explicit entry-point discovery or runtime request/process-tracing concept. What exists:

- `graphify explain "<node>"` (`cli.py:1716-1849`) — local neighborhood inspector, not a flow tracer.
- `graphify/callflow_html.py` — generates static call-flow architecture HTML (Mermaid) from community/section aggregation, not a dynamic execution trace.
- `shortest_path` MCP tool/CLI — static graph-theoretic shortest path, not a process/request-flow concept.

[RESOLVED] Graphify has **no first-class "process" or "entry point" graph capability** — this is a gap relative to the proposed RepoAtlas Process Discovery phase, not prior art to copy.

## 9. Impact / blast-radius analysis

Dedicated module `graphify/affected.py` (318 lines):

- `DEFAULT_AFFECTED_RELATIONS` (lines 12-32): `calls, indirect_call, references, imports, imports_from, dynamic_import, re_exports, inherits, extends, implements, uses, mixes_in, embeds, requires`.
- `affected_nodes(graph, seed, *, relations=..., depth=2)` (lines 190-255): reverse BFS over _incoming_ matching edges, depth-bounded, returns `AffectedHit(node_id, depth, via_relation, via_file, via_location)`. Special-cases seeding through a class's own `method`/`contains` hop first.
- `resolve_seed(graph, query, root=None)` (lines 138-187): fuzzy-resolves a query (label, decorated callable, file path, substring) to exactly one node id; refuses to guess when ambiguous.
- `format_affected(...)` (lines 258-292): human-readable report with actual call/reference site location, not definition line.

Integrated with PR tooling: MCP tools `list_prs`, `get_pr_impact`, `triage_prs` (`serve.py:1890-1935`) report which communities a PR touches and its blast radius, backed by `graphify/prs.py` (shells to `gh` CLI).

## 10. Graph persistence

Primary store: flat `graph.json` in NetworkX node-link format under `graphify-out/`. No embedded database by default. Optional exporters (opt-in, not primary storage): `exporters/graphdb.py` — `push_to_neo4j` (MERGE-based upsert via `neo4j` driver), `push_to_falkordb` (Cypher-MERGE via `falkordb` SDK). No schema/index management beyond ID-based MERGE upserts.

Other persistence-adjacent artifacts under `graphify-out/`: `.pending_changes` (cross-process watcher lock queue), `cache/ast/v{version}-s{schema}/` (versioned AST cache), stat-index file (`{size, mtime_ns, indexed_at_ns}` per file), `.graphify_learning.json`.

## 11. Retrieval / search

**No embeddings, no vector DB** — explicit in `docs/how-it-works.md`: "the graph structure is the similarity signal." Semantic similarity is materialized as `semantically_similar_to` edges from the LLM pass, folded into the graph.

Custom lexical scorer (not a canonical BM25 library) in `serve.py`: `_compute_idf` (317), `_score_nodes`/`_score_query` (499, 510), trigram pre-filter `_get_trigram_index`/`_trigram_candidates` (407, 431), Unicode-normalizing tokenizer with optional Chinese segmentation via `jieba`. `rapidfuzz` used for fuzzy matching elsewhere.

Graph traversal: `_bfs`/`_dfs` (`serve.py:979,1010`) power the `query_graph` MCP tool's `bfs|dfs` mode, token-budgeted output (`_subgraph_to_text`, `_cut_lines_to_budget`). `_pick_seeds` combines lexical score + graph structure for seed selection — a hybrid of lexical scoring + graph traversal, **not** BM25 + vector rerank.

## 12. MCP / LSP

MCP only (`graphify/serve.py`, stdio + HTTP via `starlette`), package `mcp>=1,<3`. Console script `graphify-mcp`. **9 MCP tools**: `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, `shortest_path`, `list_prs`, `get_pr_impact`, `triage_prs`. **6 MCP resources**: `graphify://report`, `stats`, `god-nodes`, `surprises`, `audit`, `questions`.

## 13. Incremental analysis

Extensive support, not just full rebuilds:

- **AST cache** (`cache.py`, 1,782 lines): SHA256 content-hash + `(size, mtime_ns)` stat-index with a "racily clean" freshness check (git-mtime-tick-style reasoning). Namespaced by extractor version + bumpable `_AST_CACHE_SCHEMA` (currently 3).
- **Semantic cache**: separate, deliberately _not_ version-invalidated on every extractor release (avoids re-billing LLM calls for unchanged files).
- **Watcher**: `watch.py` (2,374 lines) — `watch(watch_path, debounce=3.0)`, `watchdog`-based, `--update` incremental rebuilds; cross-process safety via `.pending_changes` queue file.
- **Merge-based incremental build**: `build.py::build_merge` (line 1876), `merge_raw_extraction` (line 1732) — merge new extraction into existing on-disk graph, with stale-source pruning.

## 14. Performance

Parallel extraction via `ProcessPoolExecutor` (~1.66x on an 84-file corpus per `how-it-works.md`). SHA256 content-hash cache skipping unchanged files. Community-detection perf: prefers native Rust `graspologic_native.leiden()` directly to bypass `graspologic`'s heavy import chain (`cluster.py:22-56`), falls back to `graspologic.partition.leiden()`, then NetworkX Louvain. Query-time token budgeting on every MCP tool response (default 2,000 tokens, `_cut_lines_to_budget`) — benchmarked 71.5x token reduction on a 52-file mixed corpus (`BENCHMARKS.md`). Trigram pre-filtering ahead of lexical scoring. MinHash near-duplicate detection (`_minhash.py`, `dedup.py`).

## 15. Tests

pytest + hypothesis (property-based). 132 files, 4,909 `def test_*`, largely one file per module/bugfix, many keyed to specific issue numbers. `ARCHITECTURE.md`: "pure unit tests — no network calls, no filesystem side effects outside `tmp_path`." Self-consistency test `test_architecture_doc.py` imports every symbol named in `ARCHITECTURE.md`'s module table, guaranteeing the doc can't drift from code.

## 16. License — see `ATTRIBUTIONS.md` for the full analysis

Summary: **Apache License 2.0** governs the project (`LICENSE`, `pyproject.toml:10-11`), with a secondary `LICENSE-MIT` covering pre-relicensing portions (per `NOTICE` file, copyright Safi Shamsi). Permissive, permits derivative works and closed/proprietary use, requires notice/attribution carry-forward if code or the `NOTICE` file content is redistributed. No copyleft. No per-file copyright headers observed in sampled modules.

## What's directly relevant to RepoAtlas Code Intelligence

[INFERRED — architectural adaptation candidates, not code reuse]

- The EXTRACTED/RESOLVED-equivalent (Graphify: EXTRACTED/INFERRED/AMBIGUOUS)/confidence-rubric pattern is a strong, battle-tested model for RepoAtlas's own evidence states (see `sdd`'s proposed EXTRACTED/RESOLVED/INFERRED/UNKNOWN — note Graphify's vocabulary differs; see `CODE_INTELLIGENCE_GAP_ANALYSIS.md` for the comparison).
- `resolver_registry.py`'s "only activate if corpus contains a matching suffix, fail soft" pattern is a clean plugin-loading design for polyglot resolution.
- `affected.py`'s reverse-BFS-with-relation-filter blast-radius design is directly analogous to what SDD phase `07-impact-analysis` needs to define.
- Token-budgeted MCP responses are directly relevant to the "lazy context hydration" concept (see `REPOATLAS_EVOLUTION.md` §14).
- The single flat `graph.json` + optional Neo4j/FalkorDB export pattern is worth weighing against RepoAtlas's edge-persistence constraints (no filesystem in Workers prod) — likely **not** directly portable; RepoAtlas will need a DB-native persistence model, not a flat-file one.
