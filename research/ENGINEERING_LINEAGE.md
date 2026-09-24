# Engineering Lineage — Validating the Proposed Evolution Hypothesis

The proposed lineage (a hypothesis to validate, not a conclusion):

```
Repository Atlas → Code Universe → AST + Symbol Intelligence → Engineering Graph
  → Knowledge Retrieval → Process Intelligence → Impact Intelligence → Agent/MCP Intelligence
```

## Step-by-step validation against evidence

**Repository Atlas (current state)** — [EXTRACTED] Confirmed: this is exactly what RepoAtlas is today (`REPOATLAS_CURRENT_ARCHITECTURE.md`). Repo-level metadata, no code-level analysis.

**Repository Atlas → Code Universe** — [INFERRED] This step is not evidenced by either reference project directly, but is a coherent generalization: moving from "a catalogue of repos" to "a catalogue of repos whose _source_ is analyzable" requires exactly the snapshot/provider work identified as a gap in `SOURCE_PROVIDER_ANALYSIS.md`. Neither Graphify nor CodeGraph names this step explicitly (both start already assuming a local checkout exists), so this transition is RepoAtlas-specific groundwork, not something validated by the references. **Verdict: plausible, unevidenced by references, must be designed independently.**

**Code Universe → AST + Symbol Intelligence** — [RESOLVED] Directly evidenced by both references: this is exactly what Graphify's `extract.py`/`extractors/` and CodeGraph's `src/extraction/` do. Both treat tree-sitter-based AST + symbol extraction as the foundational layer beneath everything else in their systems. **Verdict: strongly evidenced, correct as the next step.**

**AST + Symbol Intelligence → Engineering Graph** — [RESOLVED] Directly evidenced: both references build a graph (Graphify: NetworkX; CodeGraph: SQLite nodes/edges) immediately on top of extracted symbols, with a distinct resolution pass (Graphify's facts-IR / resolver_registry; CodeGraph's `ReferenceResolver`) turning raw extraction into resolved relationships before the graph is considered complete. **Verdict: strongly evidenced, correct as the next step.**

**Engineering Graph → Knowledge Retrieval** — [RESOLVED] Directly evidenced: both references build retrieval (lexical scoring, graph traversal, hybrid ranking) as a layer that queries the already-built graph, not as part of graph construction itself. This ordering (graph first, retrieval second) is consistent across both. **Verdict: strongly evidenced, correct ordering.**

**Knowledge Retrieval → Process Intelligence** — [UNKNOWN/weakly evidenced] Neither reference has a first-class "process discovery" capability (confirmed absent in both — see `GRAPHIFY_RESEARCH.md` §8, `CODEGRAPH_RESEARCH.md` §10's absence of an entry-point-tracing concept). Graphify's `callflow_html.py` produces a static architecture visualization from graph communities, and CodeGraph models `route`/`component` as node kinds, but **neither reconstructs an end-to-end process** (entry point → handler → service → data access → external boundary) as the proposed lineage implies. **Verdict: not evidenced by either reference. This step is a genuine RepoAtlas innovation opportunity, not a validated pattern — treat with appropriately higher design uncertainty and a smaller initial scope than the phases after it, which do have precedent.**

**Process Intelligence → Impact Intelligence** — [RESOLVED, partially] Impact/blast-radius analysis is evidenced (`affected.py`, `getImpactRadius`) but **neither reference gates impact analysis behind a prior "process" layer** — both compute impact directly from the raw call/reference graph, without first reconstructing processes. This suggests the proposed lineage's strict sequential dependency (Process Intelligence _before_ Impact Intelligence) is **not required by the evidence** — impact analysis is buildable directly on the Engineering Graph + Knowledge Retrieval layers, and Process Intelligence could be developed in parallel or after, as a complementary capability rather than a hard prerequisite. **Verdict: the two phases are not strictly ordered by evidence; consider decoupling them (see `sdd` phase strategy discussion in `REPOATLAS_EVOLUTION.md` §15).**

**Impact Intelligence → Agent/MCP Intelligence** — [RESOLVED] Directly evidenced: both references expose MCP interfaces (Graphify's `serve.py`, CodeGraph's `src/mcp/`) as the outermost/last layer, consuming graph + retrieval + impact-analysis capability through tool calls. Both treat MCP as an interface over an already-capable system, not a capability that shapes the graph itself. **Verdict: strongly evidenced, correct as the final step.**

## Overall verdict on the hypothesis

[RESOLVED] Six of eight transitions are strongly evidenced by both reference projects. Two transitions are weak or unevidenced:

1. **Repository Atlas → Code Universe** — plausible but must be designed independently (no reference precedent for API-based repo ingestion feeding AST analysis).
2. **Knowledge Retrieval → Process Intelligence → Impact Intelligence** — the strict three-step ordering is not required by evidence; Process Intelligence and Impact Intelligence are better modeled as **complementary sibling capabilities** both built on Engineering Graph + Knowledge Retrieval, rather than a strict chain. Recommend evaluating whether the SDD phase order (`06-process-discovery` before `07-impact-analysis`) should instead allow parallel or reordered development — see `REPOATLAS_EVOLUTION.md` §15.

The lineage is **directionally correct and useful as a mental model**, but should not be treated as a rigid, unbreakable sequence — particularly around Process Intelligence, which is the one phase with no direct architectural precedent in either reference and therefore carries the highest design risk and should be scoped conservatively.

## Do not force the references into this architecture

[INFERRED] Neither Graphify nor CodeGraph was built with this lineage in mind — they are complete, self-contained tools with their own internal logic, not phased implementations of a shared roadmap. The correspondence found above is real (both independently converged on AST→Graph→Retrieval→Impact→MCP ordering) but should be read as **convergent evidence from two independent implementations**, which is a meaningfully strong signal — not as either reference having been designed to fit RepoAtlas's proposed lineage.
