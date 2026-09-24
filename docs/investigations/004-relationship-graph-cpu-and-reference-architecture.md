# Investigation: Feature 004 CPU Feasibility Gate (T006/T007) + Reference-Architecture Study

**Status**: Informational. T007 STOP remains in force. No Feature 001/002/004 code, spec, plan, or task changed by this investigation. Nothing pushed, deployed, or run against remote Cloudflare resources.

**Related**: `specs/004-engineering-relationship-graph/tasks.md` (T006/T007), `specs/004-engineering-relationship-graph/feasibility-results.md`, `specs/004-engineering-relationship-graph/research.md` §1, `specs/004-engineering-relationship-graph/cpu-decomposition-results.md`.

---

## 1. Background

Feature 004 (Engineering Relationship Graph) tasks T001–T007 are complete; tasks.md's CPU feasibility gate (T006 measures, T007 decides go/no-go) fired **STOP**: T006's spike found large (~2000-line) synthetic fixtures classify `likely unsafe` (p95 9.7–12.2ms) against Workers Free's 10ms CPU-per-invocation cap, across all four Tier-1 languages (Java/JavaScript/TypeScript/TSX). T007's recorded decision (`research.md` §1, dated 2026-09-21) is STOP — implementation must not proceed to T008 until the architecture is reconsidered.

Two follow-up investigations were run, both local-only, both read-only against the two areas below the T007 line:

1. A CPU decomposition sweep, to find *where* the cost comes from before picking a mitigation.
2. A read-only study of two local reference repositories (`graphify`, `codegraph`) for architectural precedent.

Neither investigation authorizes a mitigation. Both are reported here for your review.

---

## 2. CPU Decomposition Investigation

### 2.1 Method

Two new local scripts (not part of the app bundle, not touching `feasibility-results.md`):

- `scripts/relationship-cpu-decomposition.ts` — sweeps Java/JavaScript/TypeScript/TSX × {500, 750, 1000, 1250, 1500, 1750, 2000, 2500} lines, using a deliberately dense synthetic fixture (3 relationship-bearing calls per line — the same worst-case shape as T006's "large" tier), 5 warmup + 20 timed iterations per cell. Isolates parse time, combined-query time (the real single-invocation shape — all relationship families run together in one `Query.matches()` call), per-family query time (diagnostic-only, re-run in isolation, not additive into the pipeline total), resolution time (stubbed bounded lookup), and full-pipeline time.
- `scripts/relationship-cpu-real-files.ts` — calibration check: runs the same parse+query pipeline against three real local TSX files at/near this repo's own p95/p99/max line counts, to check whether real code is anywhere near the synthetic fixture's relationship density.

All numbers are **local wall-clock proxies** (`process.hrtime.bigint()`, this machine, Bun runtime) — not Cloudflare Workers CPU-ms, and do not prove Cloudflare CPU-budget compliance.

### 2.2 Findings — bottleneck attribution

At 2500 lines (median, all four languages):

| lang | parse % of total | query % of total | resolution % |
|---|---|---|---|
| java | 66.9% | 32.1% | 0.5% |
| javascript | 67.3% | 31.4% | 0.5% |
| typescript | 67.7% | 31.5% | 0.4% |
| tsx | 70.4% | 29.2% | 0.4% |

**Parsing is the dominant cost (~67–70%), not query execution (~29–32%) or resolution (<1%).** Cost scales roughly linearly with line count for all four languages within this range — no cliff, no superlinear blowup. No single relationship-query family (imports/extends/implements/calls) dominates the query-cost share; it is fairly evenly spread across families.

Representative rows (java, median ms):

| lines | parse | combined query | resolution | complete |
|---|---|---|---|---|
| 500 | 4.41 | 2.12 | 0.04 | 6.61 |
| 1000 | 8.76 | 4.06 | 0.07 | 12.89 |
| 1500 | 13.16 | 6.29 | 0.10 | 19.58 |
| 2000 | 17.76 | 8.17 | 0.13 | 26.13 |
| 2500 | 22.03 | 10.56 | 0.17 | 32.93 |

Full per-language, per-size tables: `specs/004-engineering-relationship-graph/cpu-decomposition-results.md`.

### 2.3 Finding — relationship-family splitting is counter-indicated

Because parsing (not query execution) is the dominant cost, splitting relationship extraction into per-family units (a mitigation floated in the prior round) would require re-parsing once per family — multiplying the *dominant* cost term by the family count, for a saving only on the smaller (~30%) term. This is a real red flag against that option, confirmed by measurement, not assumed.

### 2.4 Finding — real local files are far cheaper than the synthetic worst-case fixture

Actual repo-atlas TS/TSX source (125 files, no local Java sample) size distribution:

| p50 | p75 | p90 | p95 | p99 | max | >500 lines | >1000 | >1500 | >2000 |
|---|---|---|---|---|---|---|---|---|---|
| 55 | 149 | 271 | 373 | 636 | 744 | 5/125 | 0 | 0 | 0 |

Calibration run against three real files at/near this repo's own p95/p99/max:

| file | lines | median parse+query | relationship-bearing matches |
|---|---|---|---|
| `src/routes/catalogue.tsx` | 374 | 2.17ms | 62 |
| `src/components/atlas/AtlasScene.tsx` | 637 | 3.56ms | 160 |
| `src/components/ui/sidebar.tsx` | 744 | 2.65ms | 88 |

The real 744-line file costs **2.65ms**; the synthetic fixture at 750 lines costs **~9.9ms parse alone**. Real code's relationship-bearing-syntax density (~0.1–0.4 matches/line) is far below the synthetic fixture's (~3.5+ matches/line, deliberately dense). Parse cost tracks raw AST complexity, not relationship density — so this gap is a real signal, not just "fewer matches to process": a large-but-sparse real file is not free, but it is measurably far cheaper than the worst-case fixture at the same line count.

### 2.5 Option comparison (informational; no decision made)

| Option | CPU safety | Notes |
|---|---|---|
| A. one-file-per-unit (current) | Fails only on high-density/large files; real-repo files (p99 = 636 lines) measure safely (3.56ms) | Real-world risk is narrower than T006's worst-case fixture alone suggested |
| B. relationship-family splitting | Worse — multiplies the dominant parse-cost term by family count | Contradicted by §2.3 |
| C. AST/node-range chunking | Unclear from measurement alone; syntax (multi-line class bodies, nested calls, JSX) crosses naive boundaries; chunking doesn't reduce parse cost since the whole file must be parsed once regardless | Downgraded further after §3 found no prior art for this in either reference project |
| D. stricter file-size ceiling | Blunt — would defer real, cheap, large-but-sparse files while not directly targeting the actual risk driver (density/complexity vs. raw size) | Conservative but imprecise |
| E. runtime CPU circuit breaker | Targets the actual per-file cost directly (abort after parse if a soft budget is exceeded, mark `partial`/deferred) | Not validated for tail behavior (cold start, GC pauses) this session |

### 2.6 Status

T007 STOP unchanged. This narrows *where* the risk concentrates (parse cost, density/complexity-dependent, not uniformly line-count-dependent) but does not by itself validate a replacement architecture.

---

## 3. Reference-Architecture Investigation (graphify, codegraph)

Read-only investigation of two local reference repositories, used purely as architectural precedent — no code copied, no dependencies introduced, neither repository modified, no assumption that either project's architecture is directly compatible with RepoAtlas/Cloudflare Workers.

- `../repotlas-references/graphify` — Python static-analysis engine.
- `../repotlas-references/codegraph` — TypeScript/Node, uses the same `web-tree-sitter` library RepoAtlas uses.

### 3.1 Graphify findings

`_extract_generic()` (`engine.py:3425-3469`) parses a file once, then runs one recursive `walk()` (`engine.py:3653`) over the whole tree. Every relationship type it emits — `contains`, `inherits`, `implements`, `calls`, `references`, `imports`, `requires`, `defines`, `mixes_in` — comes from `add_edge()` calls inside that **same single walk**, on the **same** parsed tree. One parse, one traversal, every relationship type together.

No Tree-sitter Query API usage anywhere — hand-rolled `node.type`/`node.children` branching, not `.scm` compiled queries. No incremental parsing, no cross-file AST cache, no source-size ceiling for code parsing (only unrelated zip-bomb guards for document ingestion at `detect.py:60-68`, `security.py:375`). Consistent with graphify being a long-lived CLI/daemon process with no per-invocation CPU ceiling to defend against.

One narrow exception: Java cross-file import resolution (`resolution.py:2824-2860`) runs a second logical pass, but its own docstring states it caches `parsed: dict[path, (bytes, tree)]` specifically so "each file is only parsed once" even across that two-pass fixup — this reinforces the single-parse pattern rather than breaking it.

### 3.2 CodeGraph findings

`TreeSitterExtractor` (`tree-sitter.ts:546`) parses once per file. `extractFromSource()` returns `{ nodes, edges, unresolvedReferences }` in one call (`parse-worker.ts:99`) — nodes and every edge type are built during that one traversal. Also zero Tree-sitter Query API usage — hand-rolled visitor traversal, same pattern as graphify.

**Directly relevant precedent — file-size ceiling**: `MAX_FILE_SIZE = 1024 * 1024` (1 MiB, `index.ts:159`), enforced as a hard whole-file skip (not chunked) at `index.ts:2288` and `index.ts:2624`. The code comment states the rationale explicitly: *"Skip files larger than this (bytes). Generated bundles, minified JS, and vendored blobs blow the WASM heap and the worker-recycle budget for no useful symbols."* A skipped file produces a `size_exceeded` warning and an empty result — the failure is contained to that one file, matching the shape RepoAtlas's own FR-008 already requires.

Other techniques found, flagged as **not directly applicable** to Cloudflare Workers:

- Module-level `parserCache: Map<Language, Parser>` (`grammars.ts:233`, `getParser()` at 454-466) reusing one `Parser` instance per language across files, recycled every `PARSER_RESET_INTERVAL = 5000` parses to reclaim WASM linear memory (`parse-worker.ts:64,109-112`) — the reuse pattern itself is portable, but the recycle-interval tuning is Node-process-lifetime-specific.
- A `worker_threads` parse pool (`parse-pool.ts`, cap 8/16 threads) — a multi-core-machine optimization; Workers isolates have no threading model, so this has no analog here.
- A separate Rust "kernel" flat-buffer decode path (`parse-worker.ts:81-96`) that avoids materializing per-node JS objects across a worker-thread IPC boundary — targets Node cross-thread structured-clone cost, which does not exist in a single-isolate model.

### 3.3 Direct answer: single-pass vs. split architecture

**Both reference projects parse once, retain the AST in local scope, and derive every relationship type from that one traversal.** Neither has anything resembling RepoAtlas's Feature 002/004 split (a first pass that extracts symbols and discards its AST, forcing a second, separate pass to re-parse for relationships). Graphify's one Java-specific two-pass exception explicitly caches its tree across those two internal passes rather than re-parsing — this reinforces, not contradicts, the general single-parse pattern.

**Nothing found in either project avoids a second parse of an already-parsed-and-discarded file** — because neither project ever discards the tree before deriving relationships in the first place. The structural fix both projects demonstrate is "don't split extraction into two passes," not "here's a trick to make the second pass of a two-pass design cheap."

### 3.4 Comparison tables

**Parsing lifecycle**

| | Graphify | CodeGraph | RepoAtlas (Feature 002 + 004) |
|---|---|---|---|
| Parses per file | 1 (general case) | 1 | **2** (symbol pass, then relationship pass) |
| AST retained across extraction types? | Yes, within one call | Yes, within one call | No — deleted after symbols (`tree.delete()`) |
| Parser reuse across files | Not observed in general path | Yes, cached per language | Not directly comparable (different per-invocation model) |

**Large-file handling**

| | Graphify | CodeGraph | RepoAtlas |
|---|---|---|---|
| Size ceiling | None for source parsing | Hard 1 MiB skip | `CODE_INTEL_MAX_FILE_SIZE_BYTES` exists (Feature 002) |
| Chunking | None | None | None |
| Timeout | None | None | None (circuit-breaker idea floated, unvalidated) |

Neither reference project chunks or does syntax-aware segmentation for large files — both accept the cost (graphify) or skip outright (codegraph). This is evidence against option C (AST/node-range chunking) from §2.5 — no prior art for it in either reference project.

**Performance technique applicability**

| Technique | Graphify | CodeGraph | Applicable to Cloudflare Workers Free? |
|---|---|---|---|
| Single-pass multi-relationship extraction | Yes | Yes | Yes — architectural, no platform dependency |
| Parser instance reuse across files | No | Yes | Yes, cheap — worth checking `grammar-provider.ts` isn't re-instantiating unnecessarily |
| Hard file-size ceiling | No | Yes (1 MiB) | Yes — direct precedent |
| Multi-thread parse pool | N/A | Yes | **No** — no `worker_threads` in Workers |
| Rust flat-buffer IPC fast path | N/A | Yes | **No** — solves a cost that doesn't exist here |
| Incremental parsing (`tree.edit`) | No | No | N/A — no prior art either way |

### 3.5 ADOPT / ADAPT / INSPIRE / DEFER / REJECT matrix

| Technique | Classification | Why |
|---|---|---|
| Hard file-size ceiling for relationship-bearing parse (CodeGraph's 1 MiB pattern) | **ADAPT** | Direct precedent on the same `web-tree-sitter` stack; threshold needs re-tuning against Workers' 10ms line, not CodeGraph's Node-heap line |
| Single-pass multi-relationship extraction (fold Feature 004 into Feature 002's existing parse) | **INSPIRE** | Structurally the only technique found that removes the ~67-70% dominant cost; this is an architecture-scope question for Feature 002 too, not a Feature-004-only fix — see §3.7 |
| Parser-instance reuse across files within one invocation lifetime | **ADOPT** (if not already present) | Cheap, no platform conflict; worth confirming `grammar-provider.ts` isn't re-instantiating `Parser` per file unnecessarily |
| Hand-rolled traversal instead of Tree-sitter Query API | **DEFER** | Real ~29-32% query-cost lever, but doesn't touch the dominant parse-cost term |
| `worker_threads` parse pool | **REJECT** | No threading model in Workers |
| Rust flat-buffer IPC fast path | **REJECT** | Solves a cost that doesn't exist in this runtime |
| AST/node-range chunking | **REJECT** (downgraded from "unclear" in §2.5) | No prior art in either reference project; both skip large files outright rather than chunk |
| Incremental parsing (`tree.edit`) | **DEFER** | Neither project uses it; doesn't match Feature 004's shape (fresh file per unit, not an edit of a previously-parsed one) |

### 3.6 Recommended next investigation

Determine whether Feature 002's existing per-file parse invocation could structurally also run Feature 004's relationship queries in the same invocation, without violating Feature 002's own settled constraints — its immutable snapshot model, the existing memory-safety rationale for `tree.delete()`, and Feature 004's own FR-017 ("no Feature 002 modification"). That last constraint is precisely why this is a decision point, not something to act on directly.

### 3.7 Whether Feature 004 should modify Feature 002 to persist/reuse an intermediate representation

Not decided here. The evidence surfaces a real tension: Feature 004's spec (FR-001, FR-017) currently forbids touching Feature 002 and mandates the second-parse design specifically to honor that boundary. Both reference projects show that exact boundary — splitting symbol extraction from relationship extraction across two passes — is the structural source of the measured dominant cost, not an incidental implementation detail. Folding the two passes together is the one technique found with real prior art that addresses the bottleneck directly.

### 3.8 Scope of that change

**A new architecture decision, not a Feature-004-scoped change.** Feature 004's spec explicitly rules out modifying Feature 002 (FR-017) and frames the second parse as an accepted consequence of that rule (FR-001, `research.md` §3). Reopening it means revisiting Feature 002's completed, production-validated design — outside what a Feature 004 task can do under its current spec/plan without explicit re-scoping.

---

## 4. Remaining uncertainty

- No local Java source of any size exists in this repo — all Java decomposition numbers (§2) are 100% synthetic; the JS/TS/TSX real-file calibration gap is not independently confirmed for Java.
- No real local file near the 1500–2500-line danger zone exists to calibrate directly — extrapolation from the 744-line calibration point is the best available local evidence.
- Local wall-clock cannot capture Cloudflare-isolate-specific costs (cold start, V8/isolate GC behavior, WASM instantiation overhead per invocation).
- The runtime circuit-breaker option (§2.5, option E) is proposed from the decomposition data but not itself measured for reliability under CPU pressure.
- Neither reference project runs on Cloudflare Workers or any CPU-metered serverless platform — their absence of size/chunking/timeout handling reflects their own (different) deployment model, not proof that RepoAtlas doesn't need such handling.

## 5. Status

T007 STOP remains in force. No mitigation implemented. No Feature 001/002/004 spec, plan, task, or code file modified by either investigation. Nothing pushed, deployed, or run against remote Cloudflare resources. Waiting on review/direction.
