# T007-LOCAL — Feasibility Results (Evidence Consolidation, L13)

**Feature**: 004 — Engineering Relationship Graph · **Governing plan**: `t007-local-feasibility-plan.md` · **Tasks**: `t007-local-feasibility-tasks.md` · **Execution log**: `t007-local-execution-log.md` (§1–§16, authoritative for every number below; this document reconciles, it does not re-derive)
**Status**: **L13 — EVIDENCE CONSOLIDATION ONLY. G1–G9 NOT EVALUATED. L14 NOT STARTED. S-L2 NOT STARTED. T008+ NOT AUTHORIZED.** No production code, `src/`, `tests/`, schema, threshold, dataset, parser/DB setting, worker count or protocol was changed to produce this document. No commit, no push, no task checkbox ticked.
**Written**: 2026-09-27 (session time, continuing the 2026-09-27 18:41 +04:00 checkpoint)

> **Label discipline used throughout this document** (per CLAUDE.md evidence discipline, applied consistently):
> - **MEASURED FACT** — a number or observation directly read from evidence JSON/log, not inferred.
> - **CHARACTERIZATION** — a description of behavior derived from measured facts, still not a gate verdict (e.g. "SQLite write throughput falls as the table grows").
> - **CAVEAT / LIMITATION** — a stated boundary on what the evidence does or does not cover.
> - **PROTOCOL DEVIATION** — a place where execution differed from the plan's literal text, disclosed at the time it happened.
> - **KNOWN ARCHITECTURE/MECHANISM GAP** — a finding about the harness or the production contract it stands in for (e.g. missing PAUSED state, missing cross-snapshot incremental reuse).
> - **GATE CRITERION** — the pre-registered pass/conditional/fail text from plan §9, reproduced verbatim.
> - **GATE VERDICT** — explicitly **NOT PRESENT ANYWHERE IN THIS DOCUMENT.** Every gate row below is left as "NOT EVALUATED."

---

## 1. Evidence index — LRF register → measurement → evidence → status

| LRF | Requirement | Measured by | Evidence file(s) | Status |
|---|---|---|---|---|
| LRF-01 | Native/local parser throughput | M-L1, M-L2 | `m-l12-bands-B1-B6.json`, `m-l12/B*.json`, `m-l7-cold-start.json` | COMPLETE (labeled LOCAL-RUNTIME/WASM, not "native" — §1 of the log) |
| LRF-02 | File-size bands | M-L1 | `m-l12-bands-B1-B6.json`, `m-l12/logs/bands78.log`, `m-l12/B7-*.json`, `B8-*.json` | COMPLETE for B1–B6; **PARTIAL/STALL for B7/B8** (§2 below) |
| LRF-03 | AST extraction | M-L1, M-L2 | same as LRF-01/02 | COMPLETE |
| LRF-04 | Symbol extraction | M-L2 | `m-l0-smoke.json`, M-L5 evidence (symbol counts per tier) | COMPLETE |
| LRF-05 | Relationship extraction | M-L2 | M-L5 evidence (relationship counts per tier); M-L1/M-L2 phase attribution | COMPLETE (PROTOTYPE relationship stage) |
| LRF-06 | Relationship resolution | M-L2, M-L3 | `m-l3-sqlite.json`, `m-l3-raw.json`; M-L5 evidence-state distributions | COMPLETE |
| LRF-07 | Memory usage | M-L1, M-L2, M-L5 | M-L1/M-L2 per-band memory (in `m-l12/*.json`); M-L5 peak/avg RSS, RSS slope, all six tier files | COMPLETE |
| LRF-08 | CPU usage/utilization | M-L2, M-L4, M-L5 | M-L4 ladder/inline evidence; M-L5 `cpu` field, all tier files | COMPLETE (recorded; no external CPU limit applies per A6) |
| LRF-09 | Worker concurrency | M-L4 | `m-l4-ladder-cold.json`, `-precheck.json`, `m-l4-warm-ladder.json` | COMPLETE |
| LRF-10 | SQLite throughput | M-L3 | `m-l3-sqlite.json`, `m-l3-raw.json` | COMPLETE |
| LRF-11 | Durable local job throughput/overhead | M-L4 | `m-l4-inline-vs-engine.json`, ladder files | COMPLETE |
| LRF-12 | Incremental indexing | M-L6 | `m-l6-inc0-inc1.json`, `m-l6-inc-dataset-inventory.json`, `m-l6-repo-atlas-inc{2,3}-c{1,2}.json` | COMPLETE, **with the mechanism gap in §5 below — this is itself the result, not a gap in measurement** |
| LRF-13 | Cold-start behavior | M-L7 | `m-l7-cold-start.json`, `m-l7-raw.json` | COMPLETE (informational; plan states no gate number without further evidence) |
| LRF-14 | Large-file behavior | M-L1 bands B6–B8 | `m-l12/B6-*.json` (complete); B7/B8 partial/stall (§2) | PARTIAL |
| LRF-15 | Repository-scale graphification | M-L5 | `m-l5-repo-atlas-rm-c{1,2}-revB.json`, `m-l5-repo-atlas-rs-c{1,2}.json`, `m-l5-gitnexus-rl-c{1,2}.json`, `m-l5-iata-rl-c{1,2}.json` | **COMPLETE across all three tiers (R-S, R-M, R-L×2)** |
| LRF-16 | Failure/retry/recovery | M-L4 tests F-1…F-6 | `m-l4-f1*.json`, `f2*.json`, `f3*.json`, `f4*.json`, `f5.json`, `f6*.json` | COMPLETE on R-M; **NOT run on R-S/R-L or on the M-L6 INC datasets** (limitation, §7) |

**M-L0** (harness smoke) — `m-l0-smoke.json`, 41/41 hand-derived relationships matched — COMPLETE, foundational (blocks everything per tasks.md).
**S-L1** (harness-fidelity stop gate) — `s-l1-fidelity.json` (35/35, final harness) plus superseded run1/run2 — **PASS, but self-performed by the executing agent, not an independent owner review** (log §6 caveat, preserved).

---

## 2. M-L1/M-L2 — file-size bands (per-file cost curves)

**MEASURED FACT.** B1–B6 (48 synthetic fixtures + 1 real minified-JS fixture): all 49 completed `OK`. Parsed-unit total median grows from 2–4 ms (B1, ≤4 KiB) to 1.2–24.9 s (B6, 1 MiB), with **ordinary-density files far more expensive than dense-density files at the same nominal size** (e.g. B6 TypeScript ordinary 23.8 s vs dense 1.2 s) — density, not raw byte count, drives cost (the R3/A1 finding this fixture design was built to test). 6 of 49 cells are **insufficient-N** (fewer than 20 iterations fit the 120 s per-stage budget; p95 withheld, median still reported): B5-javascript-ordinary (n=18), B5-tsx-ordinary (n=16), B6-typescript-ordinary (n=5), B6-tsx-ordinary (n=5), B6-javascript-ordinary (n=4), B6-java-dense (n=12).

**CAVEAT / PROTOCOL DEVIATION (B7/B8).** Six of twelve B7/B8 cells never produced a `parsed`-unit summary: four hit the pre-registered 300 s stall guard while still inside the *first* `parsed` iteration's resolve phase (B7-java-ordinary, B7-javascript-ordinary, B7-typescript-ordinary, B8-java-dense); one is `INTERRUPTED/PARTIAL` (B7-typescript-dense, killed mid-shutdown, only `.partial`/`.phase` survive); three are `NOT_ATTEMPTED` (B8-java-ordinary, B8-javascript-ordinary, B8-typescript-ordinary, skipped after the guard fired); B7/B8-tsx-* have **no record at all** (unknown whether scheduled). Two cells completed with insufficient-N (B7-java-dense n=3, ≈139.7 s/unit; B8-javascript-dense n=9, ≈12.5 s/unit). The orchestrator's own B7/B8 summary file was **never written** (shut down intentionally) — nothing here was reconstructed or fabricated; the log-line + per-fixture-JSON evidence is authoritative for exactly what it says and no more (log §12.2, §12.4).

**CHARACTERIZATION.** The resolver-probe series (`m-l12-resolver-probes.json`) measured same-file symbol resolution growing **≈4× per 2× n** (super-linear) at n=1,000…8,000 within one file. **That this probe explains the B7/B8 stalls is UNVERIFIED** — the stalled runs were killed before completion, so the causal link is plausible, not confirmed (log §12.2, preserved verbatim).

**Owner decision still open (unchanged by L13):** disposition of the B7/B8 partial/stall evidence — accept as-is (this document does), or authorize a separately-scoped follow-up. L13 does not resolve this; it is carried forward as an evidence gap for L14 (§8 below).

---

## 3. M-L3 — SQLite characterization

**MEASURED FACT.** Batch-insert throughput at the real R-M graph (10,755 relationships, 2,139 candidates, one fresh VACUUMed copy per run): single-commit WAL 48,370 rel/s median, falling to 10,708 rel/s (WAL) / 2,434 rel/s (DELETE) at per-row (batch=1) commits — **per-row commits in rollback-journal mode are 4.4× slower than WAL** (4,419 ms vs 1,004 ms wall for the same 10,755+2,139 rows). At 1,000-row batches the two journal modes differ by ≤~12%. Synthetic 4×/16×/64× multiplications (index-depth/size scaling only, **not real R-S/R-L row counts**) show throughput falling as the table grows (42.3k → 37.5k → 24.8k → 17.4k rel/s at 1000-row batches, 1×/4×/16×/64×).

**MEASURED FACT.** Lookups/bounded-traversal pages are microsecond-scale (warm medians 0.005–0.07 ms, p95 ≤0.16 ms) and grow only slightly with 64× more rows.

**CAVEAT (preserved verbatim).** WAL reads/writes look ~10–25% faster than DELETE in every class — **UNVERIFIED**, because WAL always ran before DELETE in every configuration (not interleaved), so the difference is not attributable to journal mode alone. R1 (symbols-by-name) mostly measures index *misses* (69% of R-M's CALLS are UNKNOWN) — hit-path latency is exercised only by the minority of matching names. R3's 0.0092→0.069 ms growth (1×→64×) is a **scaling artifact of the synthetic-clone construction** (symbols-per-file grows 64×, not table size per se), directionally consistent with — but not proof of — the same-file-resolution-cost finding from M-L1/M-L2.

**LIMITATION (preserved).** Single machine; OS cache not dropped (cold = connection-cold only); `synchronous=NORMAL` only (FULL/power-loss not pre-registered here); no concurrent reader/writer measurement (contention was measured separately in M-L4); DB size is measured for the **real R-M tier only** (R-S/R-L DB-size scaling was not separately characterized — the M-L5 R-S/R-L evidence in §4 below gives their actual DB sizes, but not the same batch/journal/pagination sweep as M-L3 ran on R-M); traversal is 1-hop pages only.

---

## 4. M-L4 — job engine, concurrency, failure suite (R-M only)

**MEASURED FACT — inline vs engine (G6 pre-registered measure).** Inline-main 1092 ms (1058–1176) · inline-in-worker 1083 ms (1050–1123) · engine c=1 1240 ms (1173–1259), 8 rounds. **Engine c=1 vs inline-main: median +12.3%, min +3.6%, max +18.4%, 2/8 rounds above 15%.** Descriptive only — no threshold is applied here.

**MEASURED FACT — concurrency ladder (interleaved, 5 rounds/level).** Engine wall medians: c=1 1213 ms, c=2 1045 ms (speedup 1.16×, the only clearly-separated level), c=4 1139 ms (1.06×), c=8 1248 ms (0.97× — **slower than c=1**). Peak RSS scales 258→336→448→608 MiB (c=1→2→4→8). Parsed-unit write-lock wait rises 0%→28%→56%→72% with concurrency. **"Single-writer SQLite is the limiter" remains UNVERIFIED** — lock-wait share rises with c, but no persist-stubbed/WASM-only control run exists to isolate the cause (Reality Checker correction, preserved verbatim, log §8/§11).

**KNOWN ARCHITECTURE/MECHANISM GAP — G3-relevant, all preserved exactly as found, none adjusted or resolved by L13:**
- **F-4 symbols-stage redelivery**: re-executing a `symbols`-kind unit through the unmodified production `extractFile` (delete + re-insert, assigning new row ids) leaves **36 relationship endpoints dangling** — classified `PARTIAL`, not adjusted. This is a genuine architecture finding (R6/D-R6-2 hazard), not a harness bug.
- **F-4e duplicate execution under an artificially short lease** (2 ms lease ≪ unit time, 4 workers, ~190 reclaims/run): 2 of 3 runs identical; **1 of 3 runs silently differs** (4 nested symbols lost their parent link; all SQL invariants stay clean). Under a realistic 1.5 s lease (5 runs) and a genuinely long 13.3 s unit (3 runs): 0 reclaims at 1.5 s in the normal case, but a reclaim/duplicate execution *did* occur in 3/3 runs when a unit's real duration (13.3 s) exceeded the 1.5 s lease — the final graph nonetheless matched the reference in all 3 (no silent divergence at this lease/duration combination). **Classification: known lease/fencing design risk in the contract, not a production-readiness verdict** — no lease value or fencing rule was chosen.
- **F-5 cancel-halt semantics NOT EVALUABLE** — the `local-job-engine.md` contract defines no CANCELLED state; the harness maps cancel→FAILED('cancelled') as a workaround, not a proposal. Behavior (claiming stops, no RUNNING left, invariants hold, resumable after clearing the flag) was verified; the *end-state label* was not, because the contract has no answer.
- **Crash-time reclaim does not increment `attempts`** — a unit that crashes mid-run and gets reclaimed is not counted against the bounded-retry policy, i.e. a persistently crashing unit could retry unboundedly (Reality Checker finding, preserved).
- **Contract gaps found by S-L1, still open**: PAUSED is not derivable from the seven job states (contradicts guarantee 7's "no extra bookkeeping"); no CANCELLED state; lease/retry/backoff defaults are unspecified in the contract (harness values are not proposals); recovery latency after a crash equals the lease timeout by design; the F002 symbol unit is not atomic with its job row (recovery relies on idempotent delete-then-insert).

**MEASURED FACT — F-1/F-1c kill/restart (durability).** rev-C (strengthened): **26/26 kill attempts** (32 kills, 14 mid-RUNNING-parsed-unit, 6 mid-RUNNING-symbols-unit) plus **F-1c 30/30 random-time kills** (all mid-RUNNING-symbols-unit) — every final graph hash equal to the clean reference `616ca53f21ca…`, 0 invariant/completeness violations, 0 changed completed files (1,571 checked). **Coverage limits (preserved): whole-process SIGKILL only** (OS page cache intact), `synchronous=NORMAL`, **no power-loss/fsync test, no kill aimed at commit/checkpoint, no kill during recovery, no worker-thread-only crash.**

**MEASURED FACT — other failure classes.** F-2 (3 victims, pre-work + mid-transaction real ROLLBACK): exactly the victims' rows missing, snapshot `completed_partial`. F-3 (bounded retry, ≤3 attempts, backoff≥base): 24 retries for 20 injected units, clean hash. F-6 (oversized-file policy): after fixing D9 (Bun workers don't inherit runtime `process.env` changes without explicit passing — a harness defect, fixed, not a protocol change), every skip has a SKIPPED job + `skipped_unsupported` row + retained structural metadata, 0 silent disappearances.

**LIMITATION.** All M-L4 failure-suite evidence is **R-M only**. It was **not re-run on R-S, R-L, or the M-L6 INC-0/INC-1/INC-2/INC-3 datasets** — the R-S/R-L/INC evidence (§§ below) covers throughput/memory/determinism at those scales but carries no independent failure-injection evidence of its own.

---

## 5. M-L5 — repository-scale graphification (R-S, R-M, R-L — all three tiers, COMPLETE)

### 5.1 R-M (repo-atlas, 239 Tier-1 files) — reference tier

**MEASURED FACT** (rev-B, authoritative; rev-A superseded but kept, within ~4%): engine wall c=2 (primary) 1367/1418/1418 ms median/p95/max; c=1 1584/1598/1598 ms. Peak RSS c=2 340 MiB, c=1 259 MiB. **Same graph hash in all 6 runs** (`616ca53f21ca…`): 662 symbols, 10,755 relationships (CALLS 8,294: RESOLVED 2,071 / AMBIGUOUS 538 / UNKNOWN 5,685 = 69%), 2,139 candidates, 0 duplicate keys, 0 invariant violations, DB 4.4 MiB. 5/234 supported files failed extraction (real syntax errors under the pinned grammar, confirmed by an independent direct-parse check — F002 behavior, not a T007 defect). c=2 is only ~1.16× faster than c=1 (§4 ladder, same finding).

### 5.2 R-S (repo-atlas `src/lib`, 83 Tier-1 files)

**MEASURED FACT** (this checkpoint, 2026-09-27): engine wall c=1 345.6/348.5/348.5 ms; c=2 324.1/387.1/387.1 ms (noisy at this size, ~1.07× nominal speedup). Peak RSS 202.7–275.5 MiB. **Deterministic** — one graph hash (`1e80b0c0e6bc20ab…`) at both concurrencies: 371 symbols, 2,334 relationships, 103 candidates, 0 invariant violations. 1/92 files failed extraction (syntax error), 9 skipped_unsupported.

### 5.3 R-L — GitNexus (JS/TS-dominant, 3,174 Tier-1 files, 91.7% JS/TS)

**MEASURED FACT.** Engine wall c=1 39,609.9/39,722.4/39,722.4 ms; c=2 29,438.9/30,567.8/30,567.8 ms (**1.35× speedup, the clearest concurrency benefit of any tier measured**). Peak RSS c=1 755.6 MiB, c=2 1,067.6 MiB (71% of the plan's [ENG] 1.5 GiB figure, not evaluated as a gate). **Deterministic** — one graph hash (`cd7e50df0857d3f6…`) at both concurrencies: 12,660 symbols, 316,895 relationships, 300,790 candidates, 0 invariant violations, DB 127.2–127.4 MiB. 118/3,174 files failed extraction (syntax errors), 2,492 skipped_unsupported.

**MEASURED FACT — 62% of CALLS UNKNOWN, preserved as characterization, NOT a gate verdict.** CALLS: RESOLVED 51,824 / AMBIGUOUS 32,057 / UNKNOWN 197,512 of 281,393 total CALLS = **62% UNKNOWN** (rate comparable to, slightly better than, R-M's 69%-of-8,294; AMBIGUOUS rate 10.1% here vs R-M's 6.5% — *higher* ambiguity at this scale). This reflects the PROTOTYPE resolver's name-based-only resolution (no type information), consistently across tiers — it characterizes the current relationship-resolution prototype's behavior at scale, and is explicitly **not** read as a gate result anywhere in this document.

**CHARACTERIZATION — item-12 large-file finding does not reproduce as a repository-scale effect.** GitNexus's 13.3× larger Tier-1 file count over R-M produced files/s falling only moderately (R-M 151–175 → GitNexus 79.9–103.8) while rel/s and resolutions/s at GitNexus scale were *higher* than at R-M (7,978–10,367 vs 6,788–7,867) — consistent with the B7/B8 mechanism (§2) being file-size/density-driven, not file-count-driven. **No B7/B8-band file exists in this dataset**, so whether one oversized file inside a large repository would reproduce the per-file stall at repository scale remains **UNVERIFIED** (not tested; out of scope for the R-S/R-L pass).

### 5.4 R-L — iata-one-order (Java-dominant, 1,304 Tier-1 files, 100% Java)

**MEASURED FACT.** Engine wall c=1 3,702.0/3,840.1/3,840.1 ms; c=2 3,671.0/3,671.7/3,671.7 ms — **essentially no concurrency speedup (1.008×)**, unlike GitNexus (1.35×) or even R-M (1.16×). Peak RSS 418.8–615.3 MiB. **Deterministic** — one graph hash (`2007179fb51093…`) at both concurrencies: 13,937 symbols, 24,420 relationships, **0 candidates**, 0 invariant violations, DB 15.0 MiB. 0 failed extractions, 65 skipped_unsupported.

**LIMITATION — JAXB representativeness caveat, sharply confirmed (preserved and strengthened, per the continuation instruction's item 9).** This dataset produced **zero relationship candidates and no RESOLVED/AMBIGUOUS relationship rows of any type** — only CALLS UNKNOWN (145), IMPORTS UNKNOWN (8,952), and CONTAINS/EXTRACTED (15,323). The pre-registered caveat (1,302 of 1,304 files are JAXB-generated model classes) is not merely a qualitative risk here — the measured evidence shows this dataset **exercises no cross-file CALLS/EXTENDS/IMPLEMENTS resolution whatsoever**. **This dataset characterizes throughput/memory/determinism at file-count scale only; GitNexus is the only R-L data point in the entire T007 evidence set that exercises relationship resolution at repository scale.** This is unchanged from the S-L1-era qualification decision and is not reopened by L13.

---

## 6. M-L6 — incremental / no-change (repo-atlas-rm; INC-2/INC-3 derived datasets)

**MEASURED FACT — INC-0 (full baseline, c=2, 3 reps).** Engine wall 1128.5/1181.6/1181.6 ms; graph hash `616ca53f21ca…` = the **same** reference hash as every other R-M M-L5 run in this document (§5.1) — confirms INC-0 is not a different dataset, just a freshly-paired baseline for the INC-1 comparison.

**MEASURED FACT — INC-1 (no-change re-run, same DB/snapshot, immediately after INC-0).** Engine wall **0/0/0 ms in all 3 reps**; `shortCircuitedRun: true` in all 3; **100% reduction**. This is the FR-009 short-circuit guarantee (`engine.ts`, "guarantee 2" — nothing to do → 0 workers spawned), already exercised once before under M-L4's F-4 whole-run re-enqueue probe (§4) and repeated here as its own paired, 3-rep INC-1 measurement.

**MEASURED FACT — INC-2 (1 file changed) and INC-3 (24/239 = 10.04% of Tier-1 files changed).** Both produced via a real content edit committed to a **scratch git clone** of repo-atlas (`.cache/t007-local/inc-repo/`, gitignored, never the working checkout), pinned to the R-M commit, then git-archived into two new dataset templates and measured with the **unmodified** `run-scale.ts` (same harness code as §5's R-S/R-L runs — no new measurement code was written for INC-2/INC-3, only new dataset content). Results: INC-2 c=1 1158.6/1164.2 ms, c=2 1038.5/1064.5 ms; INC-3 c=1 1177.0/1180.8 ms, c=2 1049.4/1076.1 ms. **Both cost statistically the same as INC-0** (compare c=2 medians: 1128.5 vs 1038.5 vs 1049.4 ms, within ~8%). **Deterministic** in every cell (one graph hash per dataset per concurrency), 0 invariant violations, 0 duplicate keys.

**KNOWN ARCHITECTURE/MECHANISM GAP (preserved exactly, per instruction items 4–6 — this is the central M-L6 finding, not an incidental one).** No cross-snapshot incremental-reuse mechanism exists in the harness or in the production path it stands in for: `classifyJobs` (`scripts/t007-local/lib/unit.ts:476`) enqueues one job per file for whatever `snapshot_id` it is given, with **no reference to any prior snapshot's completed work**. This was already an open item before M-L6 ran ("M-L6 incremental (mechanism unwritten)", recorded at the 2026-09-25 22:55 checkpoint) — M-L6 measures the direct consequence of that pre-existing gap; **it does not newly discover the gap, and no incremental-reuse mechanism was built to work around it** (that would be an unauthorized production-code/harness-architecture change, explicitly out of scope for a measurement task). INC-2 and INC-3 therefore measure **the current full-reprocessing cost of a new (whole, but content-edited) snapshot** — the only thing the current mechanism can produce — not a change-scoped incremental cost. INC-2 ≈ INC-3 ≈ INC-0 is the expected and correct measurement of that mechanism, not an anomaly.

**PROTOCOL DEVIATION 1 — "graph diff against a from-scratch run" (plan §5.3) could not be exercised as a genuine incremental-vs-full comparison.** With no separate incremental-recompute code path to diff against a full recompute, the check available reduces to the same determinism check used throughout this document (§5): 3 independent from-scratch runs of each changed snapshot, all producing the same hash. This was true for both INC-2 and INC-3, both concurrencies. **This verifies correctness under the harness's actual capability but does not exercise a genuine incremental-vs-full comparison, because that comparison does not exist to be checked.** Recorded as a deviation in *method*, not in *outcome* — no result was omitted or approximated to hide this; the equivalence is stated plainly.

**PROTOCOL DEVIATION 2 / CAVEAT — the edit was comment-only, and identical graph hashes do NOT mean the edits were ignored.** The INC-2/INC-3 edits were each a single appended comment line (`// T007-LOCAL M-L6 INC-{2,3} scratch content edit`) — a deliberate choice so as not to introduce an unauthorized real semantic/syntax change into a fixture. The parser/symbol/relationship extraction pipeline does not turn a trailing comment into any symbol, relationship, or CONTAINS-graph change, so INC-2/INC-3's graph hash and all counts (662 symbols, 10,755 relationships, 2,139 candidates) came out **byte-identical** to the unedited R-M reference graph (§5.1). **This identity is a property of the chosen edit type, not evidence that the edit was dropped or unprocessed**: the new commits (`3411c44…` for INC-2, `5cc0542…` for INC-3) and their newly-hashed blob content are recorded in `m-l6-inc-dataset-inventory.json`, confirming the file content genuinely differs from the base commit and was genuinely re-ingested through the unmodified `extractTree`/`ingestLocalSnapshot` pipeline before extraction ran on it.

**Failures/retries/reclaims.** None anywhere in M-L6: INC-1 enqueues 0 jobs (nothing can fail by construction); INC-0/INC-2/INC-3 all show `attemptsSum=0`, `reclaimsSum=0`, `busyErrors=0`, 0 invariant violations.

---

## 7. M-L7 — cold-start characterization

**MEASURED FACT.** Fixed once-per-process cost before any file: module import ≈3–3.4 ms + WASM compile ≈8.1 ms + first `getParser` ≈4.3–4.9 ms; a second language adds only ≈0.3–0.64 ms. **Cold Query compile is the dominant language-specific item: ≈12.3–13.0 ms for TS/TSX vs ≈3.2–4.4 ms for Java/JS.** First file is 8.5–16.4 ms (parse+extraction) vs steady-state 0.18–0.62 ms/file — a one-time-per-process-per-language penalty; file #2 is already ≈0.4–2.4 ms. Whole-process wall (10 files) is 54–87 ms per language.

**LIMITATION (preserved verbatim).** **Process-cold only** — OS page cache was NOT dropped (needs privileges the harness does not have), so grammar/WASM/source files are OS-cache-warm; no stronger cold definition was measured. This is **WASM Tree-sitter under Bun, not native** (Rust-repeat register marks cold start "YES — engine-bound," meaning this number must be re-measured against a native/Rust engine before it can be used as a native-parser figure). Local wall-clock only, not Cloudflare CPU accounting (irrelevant post-A6, but noted for completeness). No worker-thread cold start measured here (that is covered separately by M-L4/M-L5's worker-init timing, including the D7 serialized-init workaround). No DB in the M-L7 path. File #1 size differs per language (confounds cross-language first-file comparisons; the Query-compile line items are size-independent and are the load-bearing comparison).

---

## 8. Deviation and finding register (consolidated, none reinterpreted)

| ID | Finding | Where first recorded | Status |
|---|---|---|---|
| D1 | Local `git archive` acquisition replaces Feature 001's GitHub tar path (no internet) | §4 (log) | Unchanged, standing deviation for the whole T007-LOCAL execution |
| D2 | Scratch schema extension (name index, `t7_*` unresolved-fact fields, job tables) — production schema untouched, sha256-verified | §4 | Unchanged; **finding for T008** |
| D3 | Prototype resolver cross-language name-collision bug, fixed before S-L1 | §4 | Fixed, not a protocol change |
| D4 | S-L1 instrument timestamp-rounding bug, fixed | §4 | Fixed |
| D5 | Persist-phase attribution split (lock/body/commit) after first probe showed conflation | §4 | Applied before S-L1 re-run |
| D6 | Incidental `git diff --quiet` in owner's local iata-one-order repo touched `.git/index` mtime only (no content/HEAD/worktree change) | §4 | Disclosed; no repo content affected |
| D7 | **Bun 1.3.14 crashes on concurrent multi-worker `WebAssembly.compile`** (SIGTRAP/SIGSEGV, 7/40 and 2/25 reproductions); serialized-init workaround: 0/60 (c=2), 0/50 (c=4/8) | §9 | **Accepted by the owner as a finding; workaround in force for every M-L4/M-L5/M-L6 run in this document ("harnessRev: revB … sequential worker init"). Supports the Rust-core preference.** |
| D8 | Unindexed `Resolver.files` × `file_extractions` join (missing `snapshot_id` filter) — harness inefficiency, fixed; negligible effect at R-M | §8 | Fixed before rev-B |
| D9 | Bun workers do not inherit runtime `process.env` changes unless passed explicitly — caused F-6 attempt-1 failure, fixed | §11 | Fixed; attempt 1 kept as evidence of the original failure mode |
| D10 | Claim query scanned every job of the snapshot (missing snapshot-scoped index) — harness defect, fixed | §11 | Fixed |
| D11 | Identity hashing moved out of the write lock | §11 | Applied |
| D12 | Snapshot rollup mislabelled a cancel-halted run `completed` instead of `in_progress` — fixed; F-5 evidence keeps the original wording for the record | §11 | Fixed |
| M-L6 gap | No cross-snapshot incremental-reuse mechanism exists (§6) | §16 (this checkpoint) | **Not fixed — out of scope; the absence itself is the measured M-L6 result** |
| External-repo observation | Unattributed working-tree changes in `../repotlas-references/{GitNexus,graphify,codegraph}` (build output, `.git/index` mtimes) — **not caused by T007**, dataset provenance unaffected because `git archive` ran before these observations | §12.5 | Disclosed; no action taken; reference repos remain untouched |

---

## 9. Gate criteria — reproduced verbatim from plan §9, **NOT EVALUATED**

| Gate | Criterion | Evidence that exists (this document, by section) | Verdict |
|---|---|---|---|
| **G1 Determinism** | Identical snapshot+versions → byte-identical relationship set, ≥3 runs, incl. F-1 resumed run and M-L6 graph-diff | R-M/R-S/R-L determinism (§5), F-1/F-1c resumed-run hashes (§4), M-L6 INC-0/1/2/3 determinism (§6, adapted method per Deviation 1) | **NOT EVALUATED** |
| **G2 Durability** | F-1 passes, zero loss/duplication | F-1/F-1c on R-M only (§4) | **NOT EVALUATED** |
| **G3 Failure semantics** | F-2…F-6 behave per contract | F-2/F-3/F-4/F-4e/F-5/F-6 on R-M only (§4), open items listed there | **NOT EVALUATED** |
| **G4 Throughput** [ENG] | R-M ≤5 min wall, R-L ≤30 min, c=2 | R-M 1.4 s, GitNexus 29.4 s (c=2), iata-rl 3.7 s (c=2) — all §5 | **NOT EVALUATED** |
| **G5 Memory** [ENG] | Peak RSS ≤1.5 GiB at R-M c=2; flat slope | R-M 340 MiB, GitNexus 1,067.6 MiB, iata-rl 601.97 MiB — all §5; RSS-slope method defined in log §2 but not separately re-stated per-tier here | **NOT EVALUATED** |
| **G6 Persistence/job overhead** [ENG] | Persist ≤30% of pipeline wall; job overhead ≤15% vs inline | Inline-vs-engine +12.3% median (§4); persist shares vary 37–68% across tiers (§5, §6) — **not reconciled against the 30% figure in this document; that reconciliation is L14's job** | **NOT EVALUATED** |
| **G7 No-change re-run** [ENG] | INC-1 ≥95% cheaper than INC-0 | **100% reduction measured (§6)** | **NOT EVALUATED** (the number clears the bar; no verdict is stated) |
| **G8 Incremental scaling** [ENG] | INC-2 cost ≤10% of INC-0 | **INC-2 ≈ 100% of INC-0 (no scaling with change size) — measured, §6** | **NOT EVALUATED** (the number does not clear the bar; still no verdict is stated — that is L14's job, including whether the CONDITIONAL "mechanism partly future" text in plan §9 applies) |
| **G9 File-size evidence** | Complete band table; default+ceiling recommendation; 512 KiB explicitly judged | B1–B6 complete, B7/B8 partial/stall (§2) | **NOT EVALUATED** |

**No PASS/CONDITIONAL/FAIL word appears against any gate above with intent — the "NOT EVALUATED" column entries are the only verdict-shaped text in this document, and they all say the same thing.**

---

## 10. Evidence sufficiency for L14 — gaps identified, not resolved

This section names what L14 will need to look at before it can respond to §9; it decides nothing.

1. **G1**: sufficient evidence at R-M scale (many determinism checks); **the M-L6 "graph diff against a from-scratch run" evidence is the adapted/degenerate version described in Deviation 1** — L14 will need to decide whether that adaptation is acceptable evidence for G1's incremental clause or whether it is a gap.
2. **G2**: F-1 evidence is R-M-only; missing (per the log's own §11 sufficiency note, unchanged): a `synchronous=FULL`/power-loss variant, kills aimed at commit/checkpoint, kills during recovery, worker-thread-only crash.
3. **G3**: **NOT sufficient** until the owner decides the three open items preserved in §4 — F-4 symbols-stage redelivery, F-4e lease/fencing, F-5 cancel-state semantics. This document changes nothing about that; it is carried forward as-is.
4. **G4/G5**: R-S/R-M/R-L numbers exist (§5) at both concurrencies; **no R-L run was made at concurrency 4/8** (the ladder in §4 is R-M-only), so the [ENG] G4/G5 numbers have only a c=1/c=2 data point at R-L scale.
5. **G6**: the pre-registered metric (engine c=1 vs inline) exists only for R-M (§4); **no inline baseline was measured for R-S or R-L**, so G6's [ENG] 15% figure has no R-L-scale comparison point, only the persist-share numbers reported per-tier in §5/§6 (which are a different, supplementary metric, not the primary G6 measure).
6. **G7/G8**: fully measured (§6); no gap.
7. **G9**: B7/B8 partial/stall evidence (§2) is real but incomplete — 6 of 12 cells produced no usable parsed-unit figure. The owner decision named in §2 ("accept as documented, or authorize a follow-up") is still open; L14 cannot derive a complete band table without it.
8. **Cross-cutting**: no failure-suite (F-1…F-6) evidence exists at R-S or R-L scale, or against the M-L6 INC-2/INC-3 datasets — every G2/G3 statement in this document is implicitly R-M-scoped.

---

## 11. Limitations (mandatory, plan §10)

- **Single-machine scope.** Every number in this document (M-L1 through M-L6, plus the R-M-only M-L4 failure suite) comes from one reference environment (`environment-frozen.json`, envHash `e2b32efaacbd45bf`, Apple M3 Max / 36 GiB / macOS 14.5 / Bun 1.3.14). Nothing here has been reproduced on a second machine.
- **PROTOTYPE-vs-production divergence.** The relationship extraction/resolution stage, the durable job engine, and the M-L6 scratch datasets are all harness PROTOTYPE code standing in for unbuilt T008+ production code (plan §3). Only the symbol-extraction stage (`getParser`, `extractFile`, `toIntermediateRepresentation`) is unmodified production code. Every throughput/memory/CPU number that includes the relationship/job-engine stage inherits this divergence.
- **WASM, not native, Tree-sitter.** Every parse/extraction number in this document is LOCAL-RUNTIME (WASM Tree-sitter under Bun); the Rust-repeat register (plan §11) marks parse/extraction throughput, M-L5 memory/CPU at scale, and M-L7 cold start as items that must be re-measured against a native/Rust engine before being read as engine-independent.
- **D7 serialized-worker-init workaround is in force for every M-L4/M-L5/M-L6 number that used more than one worker** — a real Bun-runtime-stability finding, not a benchmark artifact, and one that supports (without deciding) the Rust-core preference.
- **NOT RECORDED anywhere in this evidence set**: a native-Tree-sitter comparison point; any R-L run at concurrency 4/8; any failure-injection test outside R-M; a genuine (non-degenerate) incremental-vs-full graph diff; OS-page-cache-dropped cold-start numbers; `synchronous=FULL`/power-loss durability evidence; concurrent-reader/writer SQLite contention measurement.
- **No cloud telemetry dependency anywhere** in this evidence set (plan §10 requirement, satisfied by construction — the whole T007-LOCAL execution is local-only).

---

## 12. What L13 changed vs what it preserved

**Changed by L13**: nothing measured. This document is new; it consolidates and cross-references existing evidence files. No JSON evidence file was edited. No number in §1–§7 differs from the number recorded in the execution log at the time it was measured.
**Preserved exactly, per the continuation instruction's explicit list**: the M-L4 G3 open items (§4), the M-L5 GitNexus 62%-UNKNOWN characterization (§5.3, explicitly not a gate verdict), the iata-one-order JAXB limitation (§5.4, sharpened, not reinterpreted), the M-L6 no-mechanism finding and its two deviations (§6), the M-L7 process-cold/WASM/Bun limitations (§7), and every registered threshold/gate-criterion text (§9, verbatim, no evaluation performed).

---

## 13. Remaining T007 work

**L14** (score G1–G9 per plan §9, derive the file-size default+ceiling recommendation from §2's B1–B6 data, draft the reviewed amendment research.md **A7**) is next. **S-L2** (owner review of L14's A7 draft) follows. Neither is started by this document. **G1–G9 remain NOT EVALUATED.** No commit, no push, T008+ NOT AUTHORIZED.
