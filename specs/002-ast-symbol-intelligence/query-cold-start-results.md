# Query Cold-Start Investigation (Feature 002 symbol extraction)

**Status**: Informational, measurement only. No production code, spec, plan, task, or contract changed by this investigation. Only artifacts: `scripts/query-cold-start-experiment.ts` and this document. T007 remains STOPPED. Nothing pushed, deployed, or run against Cloudflare.

**LOCAL WALL-CLOCK PROXY ONLY** (`process.hrtime.bigint()`, this machine, Bun). Not Cloudflare CPU-ms. Nothing below is called "Cloudflare-safe". A fresh `bun` process is used as the closest local analogue of a fresh isolate (empty module state, cold JIT, empty Query cache, no grammar loaded); Workers' V8 isolate startup, WASM tiering and CPU accounting can differ and were not measured.

## 1. Executive Summary

- **Correction to the prior report.** The earlier "cold first call ≈ 10 ms for TS/TSX" figure timed only `toIntermediateRepresentation` on a trivial one-line file, in a process where the parser was already initialized and had already parsed once. Measured properly in a genuinely fresh process, the first real file costs far more: **TS/TSX ≈ 22-23 ms for parse + symbol extraction alone, plus ≈ 4.7 ms for grammar/parser initialization** (≈ 27-28 ms total, excluding a local-only WASM compile and module import). Java/JavaScript first-file total ≈ 12 ms. All four classify **likely unsafe** for a first-in-isolate file under the conservative rule.
- **After the first file the cost collapses.** By the 2nd-3rd file per-file cost is ≈ 1-6 ms (size-dependent); across 100 warm files the median is ≈ 0.8-1.5 ms/file and p95 ≈ 1.7-3.9 ms.
- **Query compilation is the single largest cold item for TS/TSX (~47-50 % of the first-file cost)** but not the only one: cold parse (~27 %), grammar/parser init (~18 %), Query execution (~6-7 %). `computeSymbolKey` is ≈ 0 ms. For Java/JS, init (~37 %), compile (27-37 %) and parse (~20 %) are comparable.
- **The cost is a one-time-per-isolate (core runtime) + one-time-per-language (grammar, Query compile, JIT warmup) cost, not a per-file cost.** Whether it is paid once per file or once per many files depends on how often Cloudflare creates a fresh isolate for a queue invocation, which cannot be determined locally.
- **No credible precompile path exists in the pinned `web-tree-sitter@0.25.10`** (H3): `Query` can only be built from source text via `_ts_query_new`; there is no serialize/deserialize API, and a Query is a pointer into that isolate's own WASM heap.
- **T007 is not cleared.**

## 2. Current Query Cache Model

`to-intermediate-representation.ts` holds a module-level `WeakMap<Language, Map<querySource, Query>>` (lazy, per language + query body). `grammar-provider.ts` holds module-level `initPromise`, `languageCache`, `parserCache`. All are per-isolate, never evicted, empty on a cold isolate. Everything is lazy: nothing runs until the first file is processed, so the first file in a fresh isolate pays core runtime init + grammar load + Query compile + cold execution paths, all inside the invocation that also does that file's work.

## 3. Cold-Isolate Measurement Method

Orchestrator spawns fresh `bun` processes. Modes: `first` (10 distinct files in order), `split` (first-file breakdown with standalone Query compile vs execution vs isolated hashing), `init` (first `getParser` = core runtime + language + parser, then a second language = language + parser only), `warm` (100 files cycling a 10-file set). 10 fresh processes per cold measurement, 3 for warm. File sets: real repo files for TS/TSX (10 each) and JS (`eslint.config.js`, 40 lines - the only real local JS file, then synthetic); Java is 100 % synthetic (no real Java file exists locally). Production `getParser`, `toIntermediateRepresentation`, `computeSymbolKey` and the real symbol `.scm` files are used unmodified. Persistence/resolution/relationship queries excluded. Per-position results are confounded by differing file sizes (file #1 vs #2 are different files); use the warm and split tables for cost attribution.

## 4. Per-Language Results (medians of 10 fresh processes, ms)

| lang | file #1 parse+toIR | file #2 | file #3 | file #10 |
|---|---|---|---|---|
| java | 8.44 | 2.69 | 2.89 | 2.64 |
| javascript | 7.60 | 3.26 | 2.81 | 3.01 |
| typescript | 23.29 | 3.02 | 3.09 | 1.17 |
| tsx | 22.49 | 5.78 | 4.07 | 1.72 |

Add ≈ 4.3-4.8 ms grammar/parser init before file #1 (table 2 below), paid once per isolate for the core runtime and ≈ 0.35-0.64 ms per additional language.

## 5. First-File Breakdown (fresh process, first file, medians, ms)

| component | java | javascript | typescript | tsx |
|---|---|---|---|---|
| A. module import of our code (bundled at build/isolate start in Workers) | 3.9 | 3.4 | 3.5 | 3.6 |
| A'. WASM compile of core + grammars (local-only; Workers uses build-time `?module`) | 8.3 | 7.9 | 7.8 | 8.0 |
| B. grammar + parser init (`getParser` first call: core init + language load + `Parser()`) | 4.5 | 4.3 | 4.8 | 4.7 |
| C. parse (cold) | 2.7 | 2.3 | 7.6 | 7.1 |
| D. Query compile (cold) | 3.3 | 4.4 | 12.8 | 13.2 |
| E. Query execution (cold) | 1.4 | 0.8 | 2.0 | 1.7 |
| F+G. symbol processing + `computeSymbolKey` | ≈ 0-0.1 | ≈ 0 | ≈ 0.04 | ≈ 0 |
| **Sum of B+C+D+E (request-time work)** | **11.9** | **11.8** | **27.2** | **26.6** |

Shares of B+C+D+E: TS/TSX - compile 47-50 %, parse 27-28 %, init 18 %, exec 6-7 %. Java - init 38 %, compile 27 %, parse 22 %, exec 12 %. JS - init 37 %, compile 37 %, parse 19 %, exec 7 %.

Cold compile (12.8-13.2 ms TS/TSX) is ≈ 3x the warm-process compile (4.4-4.8 ms, measured earlier): roughly two thirds of "compile" on the first call is first-use warmup of the query engine, not steady compile work.

## 6. Warm-File Breakdown

| lang | files 2-10 median | files 11-50 median / p95 | files 51-100 median / p95 | total 10 / 50 / 100 files |
|---|---|---|---|---|
| java | 2.36 | 1.37 / 2.23 | 1.16 / 1.72 | 29.6 / 83.2 / 140.0 |
| javascript | 2.71 | 1.53 / 2.46 | 1.34 / 2.10 | 32.0 / 91.5 / 154.6 |
| typescript | 1.22 | 0.87 / 2.37 | 0.82 / 1.93 | 37.1 / 84.9 / 136.1 |
| tsx | 1.27 | 1.05 / 3.95 | 1.00 / 3.30 | 41.7 / 100.7 / 165.5 |

Warm Query execution ≈ 0.1-0.9 ms, warm toIR ≈ 0.08-0.9 ms, hashing ≈ 0.00-0.04 ms per file. First-file totals in this table (7.4-23.3 ms) are the cold outliers; everything after is near steady state.

## 7. One-Time vs Per-File Costs

| cost | scope | TS/TSX (ms) | Java/JS (ms) |
|---|---|---|---|
| core runtime init (`Parser.init`, est.) | once per isolate | ≈ 3.6-3.7 | ≈ 4.1-4.4 |
| grammar load + `Parser()` | once per language per isolate | ≈ 0.6 | ≈ 0.35 |
| Query compile (cold, incl. first-use warmup) | once per language per isolate | ≈ 12.8-13.2 | ≈ 3.3-4.4 |
| cold parse excess (cold − warm parse) | once per language per isolate | ≈ +5 | ≈ +1 |
| parse + execute + symbol build + hash | per file | ≈ 1-4 | ≈ 1-3 |

(Core-init estimate = first-language `getParser` minus second-language `getParser`; grammar sizes differ, so it is approximate.) Nothing measured here is an unavoidable per-file cost; the large items are once per isolate/language. Whether they behave as "once per file" in production depends on isolate reuse (Section 9).

## 8. TS/TSX Analysis

TS/TSX are the outliers because the TypeScript grammar is much larger than Java/JavaScript: cold Query compile is 3-4x (12.8-13.2 vs 3.3-4.4 ms) and cold parse ≈ 3x (7-7.6 vs 2.3-2.7 ms). TS and TSX behave alike. The symbol query (`typescript.scm`/`tsx.scm`) compile cost scales with the grammar's size, so trimming pattern count is a possible lever but was not measured here (the pattern-count-vs-compile-time relationship is untested).

## 9. Queue/Worker Execution Implications (observation only, nothing deployed)

- **Feature 002 already processes many files per invocation.** `symbol-worker.ts:115` loops `for (const file of page.files)` over a batch of up to `CODE_INTEL_EXTRACTION_BATCH_SIZE = 50` files in one queue-message invocation, and `plugins/cloudflare-symbol-queue.ts` loops over up to `max_batch_size = 10` messages inside one `cloudflare:queue` hook call. So a single invocation can run many files in one warm isolate and amortize the cold cost across them.
- **But that amplifies a different concern.** At ≈ 1-1.5 ms warm per file, 50 files ≈ 70 ms of local CPU in one invocation, far above a strict 10 ms per-invocation cap - yet Feature 002's live validation processed 33 files with 0 failures on the same Free plan. Either the cap is not enforced per queue invocation as documented, CPU accounting differs from local wall-clock, or the run stayed under a tolerance the docs describe as flexible. This is **unexplained by anything measured here** and is the largest open question for interpreting every local number in this investigation.
- **Feature 004's planned one-file-per-unit model does not by itself mean one file per fresh isolate.** Units are queue messages; the existing consumer pattern delivers up to 10 messages per batch to one handler invocation. Whether Cloudflare hands a queue batch a fresh or warm isolate cannot be determined locally.

## 10. Possible Mitigation Options (not evaluated further, none implemented)

1. **H1 module-level eager Query init.** Requires a loaded `Language`, which requires async `Parser.init` + `Language.load` - currently lazy and async. Whether Workers permits this in global scope, and whether global-scope CPU counts against a request's 10 ms, is unverified and untestable locally.
2. **H2 lazy per-language cache (current).** Measured above: cold first call still pays the cost once per language per isolate.
3. **H3 precompiled/static Query.** Not available: `Query`'s constructor is the only path (`web-tree-sitter/src/query.ts`, `C._ts_query_new(language, sourceAddress, ...)`); no serialize/deserialize API in the pinned version; handle is an isolate-local WASM pointer. Not credible with `web-tree-sitter@0.25.10` (version pin constrained by grammar `dylink` compatibility, see research.md).
4. **Smaller/split symbol query text** (fewer patterns → cheaper compile): untested.
5. **Bound per-invocation work / process fewer files per invocation:** interacts with the queue-batch unit sizing; architectural, not evaluated.
6. **Hand-rolled AST traversal instead of Tree-sitter Query** (what graphify/codegraph do): eliminates Query compile entirely; large change, not evaluated.

## 11. Risks

- Local fresh-process cold behaviour may over- or under-state a Workers cold isolate (JIT/WASM tiering, snapshotting, CPU accounting).
- The unexplained gap between local per-invocation numbers (batch of 50 files ≈ 70 ms local) and successful live validation means local ms cannot be mapped to Cloudflare CPU-ms with any confidence.
- File-position comparisons in Section 4 are confounded by different file sizes.
- No real Java file exists locally; Java is fully synthetic. JS is one 40-line real file plus synthetic.
- Cold first-file cost being "once per isolate" is only a benefit if isolates are actually reused across queue invocations; that is platform behaviour, not measured.

## 12. Recommendation

No architectural decision is made here. Evidence-scoped conclusions only: (1) the cold first-file cost is real and was understated previously; (2) it is a one-time-per-isolate/per-language cost, not per-file; (3) Query precompilation is not available in the pinned version; (4) the largest uncertainty is platform behaviour (isolate reuse, global-scope CPU accounting, the 10 ms vs 50-files-per-invocation discrepancy), which needs Cloudflare documentation review and, later and only with explicit authorization, live measurement - not more local benchmarking. Suggested next step: a documentation-only investigation of Workers CPU accounting for queue consumers and global-scope initialization, then decide.

## 13. Impact on Feature 004 T007

**T007 remains STOPPED.** This evidence does not establish a defensible CPU-feasibility basis: first-in-isolate cost classifies likely unsafe in all four languages under the conservative rule, warm per-file cost is borderline-to-comfortable but only meaningful if isolates are reused, and the local-to-Cloudflare mapping is unresolved. It also does not justify changing Feature 004's architecture or a further Feature 002 production change on its own.

## Answers A-L

- **A. Is Query compilation the dominant cold-start cost?** For TS/TSX yes, the single largest item (~47-50 % of request-time first-file cost, 12.8-13.2 ms), but cold parse (~27 %) and init (~18 %) together exceed it. For Java/JS no: init, compile and parse are comparable.
- **B. Grammar initialization?** Grammar load ≈ 0.35-0.64 ms per language; local WASM compile ≈ 8 ms is local-only (Workers: build-time). Module import ≈ 3.4-3.9 ms (bundle evaluation; isolate-start cost in Workers).
- **C. Parser initialization?** Core runtime `Parser.init` ≈ 3.6-4.4 ms (estimate); `getParser` first call total ≈ 4.3-4.8 ms.
- **D. Query compilation?** Cold: TS/TSX ≈ 12.8-13.2 ms, JS ≈ 4.4, Java ≈ 3.3. Warm-process: ≈ 4.4-4.8 (TS/TSX), 0.8-1.1 (Java/JS).
- **E. First parse?** TS/TSX ≈ 7.1-7.6 ms cold vs ≈ 2 ms warm; Java/JS ≈ 2.3-2.7 ms cold.
- **F. Does a warm isolate amortize sufficiently?** Locally yes: after file 1, per-file ≈ 1-4 ms and ≈ 0.8-1.5 ms median across 100 files. Sufficiency against a 10 ms cap depends on isolate reuse, unmeasured.
- **G. Can multiple files benefit from one warm isolate in the current architecture?** Yes structurally: up to 50 files per message and up to 10 messages per handler invocation already run sequentially in one isolate.
- **H. Credible way to precompile/preinitialize the Query?** Precompile: no (no API). Preinitialize at module scope: unverified for Workers (async dependencies, global-scope restrictions).
- **I. Compatible with existing Workers/WASM architecture?** Precompile: n/a. Eager init: unknown, requires Cloudflare docs check.
- **J. Justifies a Feature 002 production change?** Not on this evidence; the query cache already captured the recurring cost, the remainder is one-time.
- **K. Justifies changing Feature 004's architecture?** No.
- **L. Clears T007?** No.

## 14. Appendix — Raw Data (generated by `scripts/query-cold-start-experiment.ts`)

Each cold measurement = 10 independent FRESH `bun` processes (fresh process ≈ fresh isolate: empty module state, cold JIT, empty Query cache, no grammar loaded). Values are median (min / p95 / max) across those 10 processes, in ms. LOCAL WALL-CLOCK PROXY, not Cloudflare CPU-ms. "local-only" rows have no Workers equivalent at request time.

#### 1. Fresh process — per-file cost by file position (parse + real `toIntermediateRepresentation`, ms)

| lang | file # | parse | toIR (symbol extraction incl. Query compile on #1, execution, hashing) | parse+toIR |
|---|---|---|---|---|
| java | 1 | 2.697 (min 2.578 / p95 2.753 / max 2.753) | 5.744 (min 5.568 / p95 5.831 / max 5.831) | 8.441 (min 8.224 / p95 8.577 / max 8.577) |
| java | 2 | 1.136 (min 1.025 / p95 1.521 / max 1.521) | 1.394 (min 1.008 / p95 1.967 / max 1.967) | 2.690 (min 2.324 / p95 3.278 / max 3.278) |
| java | 3 | 1.868 (min 1.305 / p95 2.307 / max 2.307) | 1.166 (min 0.757 / p95 1.478 / max 1.478) | 2.885 (min 2.361 / p95 3.072 / max 3.072) |
| java | 10 | 1.651 (min 1.500 / p95 1.719 / max 1.719) | 0.988 (min 0.872 / p95 1.120 / max 1.120) | 2.635 (min 2.372 / p95 2.839 / max 2.839) |
| javascript | 1 | 2.307 (min 2.171 / p95 2.446 / max 2.446) | 5.327 (min 5.032 / p95 5.459 / max 5.459) | 7.604 (min 7.249 / p95 7.905 / max 7.905) |
| javascript | 2 | 1.438 (min 1.361 / p95 1.533 / max 1.533) | 1.807 (min 1.624 / p95 1.981 / max 1.981) | 3.262 (min 3.017 / p95 3.506 / max 3.506) |
| javascript | 3 | 1.868 (min 1.523 / p95 1.937 / max 1.937) | 1.019 (min 0.726 / p95 1.707 / max 1.707) | 2.809 (min 2.596 / p95 3.421 / max 3.421) |
| javascript | 10 | 2.092 (min 2.012 / p95 2.200 / max 2.200) | 0.951 (min 0.875 / p95 1.055 / max 1.055) | 3.007 (min 2.899 / p95 3.254 / max 3.254) |
| typescript | 1 | 7.529 (min 7.289 / p95 8.329 / max 8.329) | 15.806 (min 15.246 / p95 15.962 / max 15.962) | 23.291 (min 22.534 / p95 24.235 / max 24.235) |
| typescript | 2 | 2.131 (min 2.030 / p95 2.328 / max 2.328) | 0.858 (min 0.797 / p95 0.949 / max 0.949) | 3.020 (min 2.908 / p95 3.124 / max 3.124) |
| typescript | 3 | 2.076 (min 1.898 / p95 2.188 / max 2.188) | 1.014 (min 0.957 / p95 1.044 / max 1.044) | 3.086 (min 2.867 / p95 3.191 / max 3.191) |
| typescript | 10 | 0.796 (min 0.714 / p95 1.001 / max 1.001) | 0.411 (min 0.349 / p95 0.514 / max 0.514) | 1.166 (min 1.089 / p95 1.490 / max 1.490) |
| tsx | 1 | 6.975 (min 6.728 / p95 7.257 / max 7.257) | 15.471 (min 14.866 / p95 15.759 / max 15.759) | 22.487 (min 21.932 / p95 22.707 / max 22.707) |
| tsx | 2 | 3.980 (min 3.765 / p95 4.305 / max 4.305) | 1.873 (min 1.772 / p95 2.176 / max 2.176) | 5.784 (min 5.582 / p95 6.481 / max 6.481) |
| tsx | 3 | 3.116 (min 3.003 / p95 3.427 / max 3.427) | 0.942 (min 0.852 / p95 1.051 / max 1.051) | 4.068 (min 3.959 / p95 4.355 / max 4.355) |
| tsx | 10 | 1.172 (min 1.048 / p95 1.225 / max 1.225) | 0.527 (min 0.466 / p95 0.588 / max 0.588) | 1.716 (min 1.548 / p95 1.766 / max 1.766) |

#### 2. Fresh process — one-time per-process / per-language setup before the first file (ms)

| lang | module import (our code) | WASM compile (local-only) | getParser first call (core init + language load + Parser()) |
|---|---|---|---|
| java | 3.915 (min 3.373 / p95 4.943 / max 4.943) | 8.297 (min 7.737 / p95 11.412 / max 11.412) | 4.503 (min 4.220 / p95 4.718 / max 4.718) |
| javascript | 3.446 (min 3.289 / p95 3.707 / max 3.707) | 7.938 (min 7.572 / p95 8.201 / max 8.201) | 4.344 (min 4.098 / p95 4.764 / max 4.764) |
| typescript | 3.453 (min 3.326 / p95 3.863 / max 3.863) | 7.802 (min 7.510 / p95 8.067 / max 8.067) | 4.846 (min 4.490 / p95 5.164 / max 5.164) |
| tsx | 3.560 (min 3.267 / p95 4.485 / max 4.485) | 8.004 (min 7.768 / p95 8.135 / max 8.135) | 4.686 (min 4.436 / p95 5.412 / max 5.412) |

#### 3. Grammar/parser init split (production `getParser`, primer language first, then target language, ms)

| target lang | primer | 1st getParser (core init + primer lang + Parser) | 2nd getParser (target lang load + Parser only) | est. core runtime init (1st − 2nd) |
|---|---|---|---|---|
| java | javascript | 4.768 (min 4.189 / p95 4.994 / max 4.994) | 0.348 (min 0.304 / p95 0.417 / max 0.417) | 4.420 (difference of medians; primer/target grammars differ in size, so this is an estimate) |
| javascript | java | 4.470 (min 4.194 / p95 5.091 / max 5.091) | 0.359 (min 0.335 / p95 0.436 / max 0.436) | 4.111 (difference of medians; primer/target grammars differ in size, so this is an estimate) |
| typescript | javascript | 4.380 (min 4.223 / p95 5.178 / max 5.178) | 0.640 (min 0.554 / p95 0.742 / max 0.742) | 3.740 (difference of medians; primer/target grammars differ in size, so this is an estimate) |
| tsx | javascript | 4.223 (min 4.068 / p95 5.018 / max 5.018) | 0.616 (min 0.582 / p95 0.688 / max 0.688) | 3.607 (difference of medians; primer/target grammars differ in size, so this is an estimate) |

#### 4. First-file breakdown (fresh process, first file only, ms)

| lang | file | parse (cold) | Query compile (cold, standalone) | Query exec (cold) | Query exec (warm) | toIR 1st call after standalone compile | toIR warm | computeSymbolKey 1st call | computeSymbolKey ×N total | symbols |
|---|---|---|---|---|---|---|---|---|---|---|
| java | synthetic-java-0.src | 2.674 (min 2.569 / p95 2.915 / max 2.915) | 3.256 (min 3.203 / p95 3.509 / max 3.509) | 1.439 (min 1.347 / p95 1.728 / max 1.728) | 0.482 (min 0.439 / p95 0.515 / max 0.515) | 3.482 (min 3.378 / p95 3.668 / max 3.668) | 0.493 (min 0.459 / p95 0.554 / max 0.554) | 0.001 (min 0.001 / p95 0.002 / max 0.002) | 0.037 (min 0.028 / p95 0.038 / max 0.038) | 39 |
| javascript | eslint.config.js | 2.284 (min 2.171 / p95 4.589 / max 4.589) | 4.384 (min 4.269 / p95 5.695 / max 5.695) | 0.778 (min 0.715 / p95 0.950 / max 0.950) | 0.100 (min 0.087 / p95 0.243 / max 0.243) | 3.448 (min 3.097 / p95 6.623 / max 6.623) | 0.075 (min 0.071 / p95 0.387 / max 0.387) | 0.119 (min 0.099 / p95 0.314 / max 0.314) | 0.000 (min 0.000 / p95 0.001 / max 0.001) | 0 |
| typescript | src/lib/code-intel/persistence/symbol-d1-client.ts | 7.649 (min 7.395 / p95 8.147 / max 8.147) | 12.812 (min 12.179 / p95 13.405 / max 13.405) | 1.992 (min 1.885 / p95 2.263 / max 2.263) | 0.863 (min 0.841 / p95 0.943 / max 0.943) | 11.364 (min 11.130 / p95 11.661 / max 11.661) | 0.900 (min 0.861 / p95 0.953 / max 0.953) | 0.014 (min 0.012 / p95 0.053 / max 0.053) | 0.036 (min 0.031 / p95 0.068 / max 0.068) | 18 |
| tsx | src/routes/catalogue.tsx | 7.054 (min 6.770 / p95 7.462 / max 7.462) | 13.169 (min 12.774 / p95 13.609 / max 13.609) | 1.711 (min 1.630 / p95 1.880 / max 1.880) | 0.762 (min 0.657 / p95 0.813 / max 0.813) | 11.341 (min 10.670 / p95 11.755 / max 11.755) | 0.712 (min 0.683 / p95 0.789 / max 0.789) | 0.006 (min 0.004 / p95 0.012 / max 0.012) | 0.003 (min 0.003 / p95 0.007 / max 0.007) | 2 |

Derived warm symbol-processing (toIR warm − Query exec warm − hashing ×N) is small residual; see per-file toIR warm above.

#### 5. Warm process — per-file cost over 100 files (10-file set cycled; 3 independent processes pooled, ms)

| lang | file #1 (cold) | files 2-10 median | files 11-50 median / p95 | files 51-100 median / p95 | total time, 10 files | total, 50 files | total, 100 files |
|---|---|---|---|---|---|---|---|
| java | 8.603 (min 8.437 / p95 8.640 / max 8.640) | 2.358 | 1.366 / 2.225 | 1.157 / 1.717 | 29.558 | 83.234 | 140.005 |
| javascript | 7.428 (min 7.394 / p95 7.513 / max 7.513) | 2.712 | 1.527 / 2.460 | 1.337 / 2.103 | 31.985 | 91.480 | 154.649 |
| typescript | 23.326 (min 23.284 / p95 23.751 / max 23.751) | 1.218 | 0.868 / 2.371 | 0.821 / 1.930 | 37.065 | 84.911 | 136.089 |
| tsx | 22.799 (min 21.630 / p95 24.913 / max 24.913) | 1.269 | 1.047 / 3.947 | 1.003 / 3.304 | 41.738 | 100.691 | 165.480 |
