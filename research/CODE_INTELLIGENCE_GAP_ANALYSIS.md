# Code Intelligence Gap Analysis

Condensed, actionable summary of everything RepoAtlas lacks relative to the proposed Code Intelligence capability set, cross-referenced to the detailed research docs. This is the single doc to read first before phase planning.

## Gaps, ranked by dependency order

1. **Source provider abstraction** — RepoAtlas has a single hardcoded GitHub REST integration, no interface layer. _Blocks everything downstream._ See `SOURCE_PROVIDER_ANALYSIS.md` §1.
2. **Commit-SHA-addressable snapshot model** — no snapshot/file-index tables exist; `payload_json` is an API-response cache, not source-of-truth storage. Neither reference project solves this either — genuinely novel work. See `SOURCE_PROVIDER_ANALYSIS.md` §3, `REPOATLAS_EVOLUTION.md` §3.
3. **AST extraction** — zero code-level parsing exists today. Both references validate tree-sitter as the right tool; RepoAtlas needs its own extraction layer built for its runtime. See `REPOATLAS_EVOLUTION.md` §1, `ADOPTION_MATRIX.md` items 1-2.
4. **Symbol/relationship graph persistence** — no graph storage exists, and the Workers production runtime rules out both references' actual storage choices (flat file, local SQLite). Needs an edge-compatible store (D1 or equivalent). See `COMPARATIVE_ANALYSIS.md` "Persistence" row, `SOURCE_PROVIDER_ANALYSIS.md` §5.
5. **Evidence/confidence model** — none exists; the proposed EXTRACTED/RESOLVED/INFERRED/UNKNOWN model is more granular than either reference's actual implementation and needs one open question resolved (should AMBIGUOUS be distinguished from UNKNOWN). See `REPOATLAS_EVOLUTION.md` §2.
6. **Knowledge retrieval (lexical + structural)** — RepoAtlas's search is a client-side substring filter; no exact-lookup, BM25, or graph-traversal retrieval exists. Vector search is _not_ a gap worth closing — both references explicitly reject it. See `REPOATLAS_EVOLUTION.md` §4.
7. **Impact analysis** — the single best-evidenced net-new capability (near-direct template in Graphify's `affected.py`), but has zero groundwork today since it depends on 1-6. See `REPOATLAS_EVOLUTION.md` §6.
8. **Process discovery** — the single highest-uncertainty capability; unevidenced by either reference as a first-class concept. Should be scoped as a derived/query-time traversal, not a persisted graph layer, and should not block Impact Analysis. See `REPOATLAS_EVOLUTION.md` §5, `ENGINEERING_LINEAGE.md`.
9. **MCP/agent interface** — none exists; both references provide mature, adoptable _design principles_ (sufficiency, error-shape discipline, adaptive token budgeting) even though no code is reusable. See `REPOATLAS_EVOLUTION.md` §7, `ADOPTION_MATRIX.md` items 13-14.
10. **Testing infrastructure** — RepoAtlas has zero automated tests of any kind (not just for Code Intelligence — for the entire existing app). Both references treat large regression suites, doc-drift tests, and answer-quality eval as foundational. This is a pre-existing gap that Code Intelligence work will make more costly to ignore, given the corpus of edge cases (language quirks, resolution ambiguity, confidence-rubric regressions) both references' test suites exist specifically to catch. See `COMPARATIVE_ANALYSIS.md` "Testing" row, `ADOPTION_MATRIX.md` item 23.

## Capabilities NOT worth pursuing (evidence-based rejections)

- **Vector/embedding search** — both reference projects deliberately rejected this in favor of graph-structural + lexical signal. No evidence in this research justifies introducing it. See `COMPARATIVE_ANALYSIS.md`, `ADOPTION_MATRIX.md` item 12.
- **Flat-file graph storage** — incompatible with the Workers production constraint regardless of its merits for Graphify's use case. See `ADOPTION_MATRIX.md` item 17.
- **Native Rust/WASM performance kernels** — premature; no evidence RepoAtlas's scale requires this investment yet. See `ADOPTION_MATRIX.md` item 19.

## The one constraint that reshapes every adaptation decision

[EXTRACTED, cross-referenced across all research docs] RepoAtlas's production deployment target is Cloudflare Workers (`vite.config.ts:20`, `nitro-module` preset), which already forces the existing app's cache layer to run memory-only in production (`canUseSqlite()`, `atlas-store.ts:47-54`). Neither Graphify (local Python CLI) nor CodeGraph (local Node CLI/daemon) operates under this constraint. Every ADAPT-category item in `ADOPTION_MATRIX.md` needs a specific answer to "how does this work with no persistent local filesystem and a per-request CPU-time budget" before it is buildable — this is the central open architectural question for the Foundation phase (`sdd/01-foundation`), more consequential than any single capability choice.

## Confidence in this analysis

- RepoAtlas current-state findings: high confidence — direct source inspection with file:line citations throughout (`REPOATLAS_CURRENT_ARCHITECTURE.md`, `SOURCE_PROVIDER_ANALYSIS.md`).
- Reference project findings: high confidence — direct source inspection of both repos, cross-checked against their own architecture docs and license files.
- Evolution/lineage recommendations: [INFERRED] throughout — reasonable interpretations grounded in the evidence above, but genuinely open design questions (noted explicitly in `REPOATLAS_EVOLUTION.md` and `ENGINEERING_LINEAGE.md`) remain for the Foundation phase spec to resolve, not this research pass.
