# Evidence — Working-tree hunk classification (Feature 005, task T029)

**Class**: REPO-BEHAVIOR (read-only inspection). **Date**: 2026-09-24. **Method**: `git status --short`, `git diff -- src/lib/code-intel/ scripts/ tests/ data/`, `git diff --stat`, file reads and headers, `grep`, and `shasum -a 256 -c` against the T002 baseline. Nothing was staged, stashed, reverted, edited or run other than these read-only commands. No script was executed. No Cloudflare access.

**Rule applied**: each dirty hunk or file is classified as **Feature 004 scaffolding**, **Query Cache experiment**, or **unknown or unrelated**, with the basis (what the hunk contains). A hunk or file not explicitly inspected stays **unknown**. Set A/B/C membership from T002 is not reshuffled.

## A. Tracked files with diffs

| # | File / hunk | Lines | Content (basis) | Classification |
|---|---|---|---|---|
| 1 | `src/lib/code-intel/symbols/to-intermediate-representation.ts` hunk 1 (after `SYMBOL_KINDS`) | +25 | adds `compiledQueryCache = new WeakMap<Language, Map<string, Query>>()` and `getCompiledQuery(language, querySource)`: memoizes `new Query(...)` per Language identity then query source; comment states per-isolate lifetime | **Query Cache experiment** |
| 2 | same file, hunk 2 (`collectRawEntries`) | +1 / −1 | `new Query(language, querySource)` replaced by `getCompiledQuery(language, querySource)` | **Query Cache experiment** |
| 3 | `tests/contract/symbols/to-intermediate-representation.test.ts` | +11 | new test "compiled-query cache is keyed by query source: same language, different .scm body, different results" | **Query Cache experiment** (test of the cache keying) |
| 4 | `src/lib/code-intel/config.ts` hunk 1 | +7 | `RELATIONSHIP_EXTRACTOR_VERSION = "v1"` with comment citing specs/004 | **Feature 004 scaffolding** |
| 5 | `src/lib/code-intel/config.ts` hunk 2 | +4 | `CODE_INTEL_RELATIONSHIP_CONTAINS_BATCH_SIZE = 200`, `CODE_INTEL_RELATIONSHIP_MAX_CANDIDATES = 20` (relationship constants) | **Feature 004 scaffolding** |
| 6 | `src/lib/code-intel/config.ts` hunk 3 | +10 | `relationshipContainsBatchSize`, `relationshipMaxCandidates` entries in `codeIntelConfig()` | **Feature 004 scaffolding** |
| 7 | `data/code-intel-schema.sql` | +77 | `CREATE TABLE IF NOT EXISTS relationships …` and related tables/indexes for the Engineering Relationship Graph | **Feature 004 scaffolding** |
| 8 | `tests/integration/repositories/initial-sources.test.ts` | +15 | test "FR-027: configured initial source fetch fails, falls back to bundled dataset" (initial-sources / GitHub-source behavior) | **unknown or unrelated** to both (belongs to an earlier GitHub-sources feature; not code-intel) |

Baseline expectation check: `config.ts` contains Feature 004 scaffolding (confirmed by hunks 4–6, no Query-cache content); `to-intermediate-representation.ts` is the file matching the Query-cache changes (confirmed by hunks 1–2). Expectation confirmed, not assumed.

## B. Untracked files in scope (`git diff --no-index -- /dev/null <file>` is the read-only method; content inspected by header and grep)

| # | File | Basis | Classification |
|---|---|---|---|
| 9 | `scripts/query-cold-start-experiment.ts` (Set B, T002) | LOCAL-ONLY measurement script of Feature 002 cold start (fresh `bun` processes; first/split/init/warm modes). **Contains no cache code** (grep: no `compiledQueryCache` or `getCompiledQuery`; it compiles a standalone `new Query(...)` at line 136 to measure compile cost). Its association with Query Cache is as the **evidence script for the cold-compile cost** that motivates the cache, not as an implementation of it. | **Query Cache experiment** (evidence/measurement side) — association *corrected in wording*, Set B membership unchanged |
| 10 | `specs/002-ast-symbol-intelligence/query-cold-start-results.md` | results document of item 9's script (186 lines); Set A (protected spec directory) | **Query Cache experiment** (evidence document) |
| 11 | `scripts/relationship-cpu-spike.ts`, `relationship-cpu-decomposition.ts`, `relationship-cpu-real-files.ts`, `relationship-single-pass-spike.ts`, `relationship-combined-single-pass-decomposition.ts` | headers state LOCAL-ONLY Feature 004 CPU-feasibility / single-pass measurement spikes; no cache implementation. `relationship-combined-single-pass-decomposition.ts` produces the results file whose "Post query-cache mitigation" section measures the working-tree cache (E4); **whether that section is produced inside this script was not inspected**, so that part stays **unknown**. | **Feature 004 scaffolding** (evidence scripts); cache-measurement part **unknown** |
| 12 | `src/lib/code-intel/domain/relationship.ts` | header: domain types for the Engineering Relationship Graph entities | **Feature 004 scaffolding** |
| 13 | `src/lib/code-intel/relationships/relationship-identity.ts` | header: deterministic relationship key port of `computeSymbolKey`; grep: no cache references | **Feature 004 scaffolding** |
| 14 | `src/lib/code-intel/relationships/queries/{java,javascript,tsx,typescript}.scm` | query-source files of the relationship extractor; contents **not inspected** | **unknown** (directory placement only; no code) |
| 15 | `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-{research,observability}-report.md` | documentation research reports (not code) | **unknown or unrelated** to the working-tree code hunks (documentation evidence for E7/E8) |

## C. Comparison with the T002 baseline (drift check, read-only)

- **Set B**: `shasum -a 256 -c set-B.sha256` → both files **OK** (`scripts/query-cold-start-experiment.ts`, `src/lib/code-intel/symbols/to-intermediate-representation.ts`); byte-identical to T002. The Query-cache experiment is unmodified and unadopted.
- **Set A**: `shasum -a 256 -c set-A.sha256` → every listed file **OK** (no modification of a listed file). This is a partial informational check; the addition/deletion check and the formal drift verification are task T046's.
- **Set C**: not compared here (informational, never a stop).

## D. Boundary confirmation

Read-only. No file modified except this new evidence file and the decision record §9 "Working-tree status (as found)". Feature 004 T007 remains STOPPED.
