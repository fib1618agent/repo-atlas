# T007-LOCAL — L14 Gate Evaluation (G1–G9)

**Feature**: 004 — Engineering Relationship Graph · **Governing plan**: `t007-local-feasibility-plan.md` §9 · **Consolidated evidence**: `t007-local-feasibility-results.md` (L13) · **Execution log**: `t007-local-execution-log.md` §1–§17
**Status**: **L14 — EVALUATION ONLY.** No production code, `src/`, `tests/`, schema, threshold, dataset, parser/DB setting, worker count or protocol changed. No new benchmark run (two already-captured-but-unreported evidence fields — GitNexus/R-M/R-S/iata-rl per-run RSS-slope figures, and per-fixture p95/RSS-growth from the existing `m-l12/*.json` files — were read from evidence already on disk, not re-measured; see §2 note). No task checkbox ticked. No commit, no push. **S-L2 is pending owner review of this document and does not start here.** T008+ remain NOT AUTHORIZED regardless of any determination below.
**Written**: 2026-09-27 (session time, continuing the L13 checkpoint)

This is an evaluation-only document. Every "Determination" below is a reading of already-captured evidence against the plan's own pre-registered text (plan §9, reproduced verbatim per gate). **No PASS/FAIL/CONDITIONAL word in this document authorizes anything by itself** — clearance for T008+ requires the separate, explicit process in plan §9's "Clearance rule" and S-L2's owner sign-off on the research.md **A7** amendment (drafted, not applied, in the companion file `research-amendment-A7-draft.md`).

---

## A. Gate table (G1–G9)

### G1 — Determinism (MANDATORY, no conditional)

| | |
|---|---|
| **Registered criterion** | Identical snapshot + versions → byte-identical relationship set (count + `relationship_key`s + evidence states), ≥3 runs, **including the F-1 resumed run and the M-L6 graph-diff checks**. PASS = all identical. FAIL = any diff. No conditional. |
| **Evidence** | R-M: one hash (`616ca53f21ca…`) across 6 M-L5 runs + 20 M-L4 ladder runs + every clean-reference comparison in F-1…F-6. R-S: one hash (`1e80b0c0e6bc…`) across 6 runs. R-L GitNexus: one hash (`cd7e50df0857…`) across 6 runs. R-L iata-one-order: one hash (`2007179fb510…`) across 6 runs. F-1: **56/56** kill/restart tests (rev-C 26/26 + F-1c 30/30) all matched the clean reference hash, 0 invariant/completeness violations, 0 changed completed files. M-L6: INC-0 3 runs = one hash (same as R-M's reference hash); INC-1 identical to INC-0 trivially (writes nothing); INC-2 and INC-3 each 6 runs (3 reps × 2 concurrencies) = one hash per dataset. |
| **Determination** | **PASS**, with a disclosed scope caveat (see next row). No diff was found anywhere in this evidence set, across every tier, every concurrency, every kill/restart test, and every M-L6 scenario. |
| **Evidence limitation** | The registered criterion names "the M-L6 graph-diff checks" as part of what G1 covers. As documented in the results artifact (§6, "Deviation 1"), no cross-snapshot incremental-recompute path exists, so the graph-diff check available for INC-2/INC-3 is **degenerate**: it re-confirms same-snapshot determinism (3 from-scratch runs of the changed snapshot agree with each other), not a genuine incremental-result-vs-full-recompute diff. This is an **absence of a specific named sub-test**, not an observed violation — nothing was diffed and found different; the intended comparison simply has no second artifact to compare against. This determination treats that absence as an evidence-coverage gap on G1's named sub-component, not as a diff, and not as grounds to downgrade the otherwise extensive positive evidence to FAIL (rule: do not invent a diff that was never observed) or to silently call the gap "satisfied" (rule: do not upgrade). |
| **Required follow-up** | None to change this PASS. If a genuine incremental-reuse mechanism is ever built (see G8, F.3 below), its correctness must be validated by a real incremental-vs-full graph diff at that time — this is a future G1-adjacent check, not a gap in today's G1 evidence for the mechanism that actually exists today. |

### G2 — Durability (MANDATORY, no conditional)

| | |
|---|---|
| **Registered criterion** | F-1 passes. PASS = zero loss/duplication. FAIL = any loss, duplication or corruption. No conditional. |
| **Evidence** | F-1 (rev-C): 26/26 attempts, 32 kills (14 mid-RUNNING-`parsed`, 6 mid-RUNNING-`symbols`). F-1c: 30/30 random-time kills, all mid-RUNNING-`symbols`. **56/56 total.** Every restart produced the clean reference hash, 0 invariant/completeness violations, 0 changed completed files (1,571 checked), checkpoint row counts matched. Restart wall median 1.49 s (F-1) / 2.3 s (F-1c) against a 1.5 s lease. |
| **Determination** | **PASS**, within the owner-approved evidence scope (per the standing owner decision preserved for this evaluation: G2 stays within the SIGKILL/restart scope actually tested; a `synchronous=FULL`/power-loss/commit-targeted experiment was explicitly not required for this gate). |
| **Evidence limitation** | Whole-process SIGKILL only (OS page cache intact); `synchronous=NORMAL` only; no kill aimed at commit/checkpoint specifically; no kill during recovery itself; no worker-thread-only crash (only whole-process kills). These are the accepted scope boundaries, not unresolved gaps — the owner decision preserved for this evaluation places them outside G2's evidence requirement, not inside it as missing evidence. |
| **Required follow-up** | None to change this PASS, given the accepted scope. If the owner later widens G2's required scope (e.g., to include a power-loss variant), that would need new, separately authorized measurement — not implied by this determination. |

### G3 — Failure semantics (MANDATORY; **CONDITIONAL is a valid score per the registered text**, but plan §9's separate T008+ clearance rule requires PASS with "no conditionals" for T008+ — see Part C)

| | |
|---|---|
| **Registered criterion** | F-2…F-6 behave per contract. PASS = all. CONDITIONAL = minor deviations with a documented contract amendment proposal. FAIL = containment or idempotency broken. |
| **Evidence** | F-2 (3 victims, pre-work + mid-transaction ROLLBACK): exactly the victims' rows missing, 0 extra, `completed_partial` — meets contract. F-3 (bounded retry ≤3, backoff≥base, 24 retries/20 units, clean hash) + F-3c (mid-persist transient, 20/20 retried, clean hash) — meets contract. F-6 (oversized-file SKIPPED policy, after the D9 env-inheritance fix): every skip has a SKIPPED job + `skipped_unsupported` row + retained structural metadata, 0 silent disappearances — meets contract. **F-4**: relationship-stage idempotency holds (25 redelivered units short-circuit; recompute with cleared checkpoint identical, 0 dropped keys; whole-run re-enqueue spawns 0 workers). **Symbols-stage redelivery breaks idempotency**: hash differs, 36 relationship endpoints dangle (a known, disclosed, pre-existing F002/R6/D-R6-2 hazard, not a new defect introduced by this prototype). **F-4e**: under a realistic 1.5 s lease with realistic unit durations, 0 reclaims / 5-5 clean hashes; under a genuinely long unit (13.3 s) exceeding a 1.5 s lease, reclaim/duplicate execution occurred 3/3 times but the final graph matched the reference in all 3 (no silent divergence under this realistic-but-stressed condition); only under an **artificially short 2 ms lease** (a deliberate stress probe, not a realistic configuration) did 1 of 3 runs show a silent divergence (4 nested symbols lost their parent link). **F-5**: pause/resume met 6/6; cancel-halt *behavior* met (claiming stops, no RUNNING left, invariants hold, clean hash on resume) but the contract defines **no CANCELLED state**, so the end-state *label* is not evaluable — nothing was violated because nothing was specified to violate. Additional open contract gaps: PAUSED is not derivable from the seven states; lease/retry/backoff defaults are unspecified (harness values, not proposals); crash-time reclaim does not increment `attempts` (a persistently-crashing unit could retry unboundedly). |
| **Determination** | **CONDITIONAL.** F-2, F-3, F-6 meet the contract cleanly. F-4/F-4e/F-5/the open contract gaps are each a **disclosed, bounded, already-documented** deviation with an identifiable amendment path (see `research-amendment-A7-draft.md` §2 for the proposed contract amendments), matching the registered CONDITIONAL text exactly ("minor deviations with a documented contract amendment proposal") rather than the FAIL text ("containment or idempotency broken" **with no identified path**). The one place idempotency is literally broken (symbols-stage redelivery, F-4) is a **known, pre-existing, named hazard** (R6/D-R6-2) that predates this prototype and already has a resolution direction on record (stable identity independent of row ids) — this is precisely the "documented… proposal" case, not an unbounded or newly-discovered break. |
| **Evidence limitation** | All F-1…F-6 evidence is **R-M only** — none of the failure-injection suite was re-run at R-S/R-L scale or against the M-L6 INC-0/1/2/3 datasets. The F-4e silent-divergence evidence exists only under an artificial 2 ms lease (explicit owner framing for this evaluation: "targeted characterization only; no fencing implementation during T007") — under every realistic lease/duration combination tested, no divergence occurred. |
| **Required follow-up** | Per the standing owner decisions preserved for this evaluation: **no production redesign of F-4's symbols-stage redelivery and no fencing implementation during T007** — both are named as amendment candidates for a future task, not fixed now. See Part F.1 (mandatory-before-T008) and the A7 draft for the specific proposed contract amendments (define CANCELLED, define PAUSED derivation, define lease/retry/backoff defaults, bound crash-reclaim attempts, resolve symbols-stage id-stability). |

### G4 — Throughput [ENG]

| | |
|---|---|
| **Registered criterion** | R-M end-to-end ≤5 min wall; R-L ≤30 min, at concurrency 2 on the reference environment. PASS = within. CONDITIONAL = exceeded but scales ~linearly with a bottleneck+mitigation identified. FAIL = super-linear blow-up or R-M > 3× the bound. |
| **Evidence** | R-M c=2: engine wall median 1367 ms = 1.4 s (0.5% of the 5 min / 300 s bound). GitNexus (R-L) c=2: 29,438.9 ms = 29.4 s (1.6% of the 30 min / 1800 s bound). iata-one-order (R-L) c=2: 3,671.0 ms = 3.7 s (0.2% of the bound). |
| **Determination** | **PASS.** Every measured tier is within its bound by a margin exceeding two orders of magnitude. |
| **Evidence limitation** | The criterion is defined specifically "at concurrency 2," which is fully covered. **No R-L run was made at concurrency 4 or 8** — the concurrency ladder (which found c=8 *slower* than c=1 on R-M, §4 of the results doc) was never repeated at R-L scale, so whether R-L throughput would degrade at higher worker counts (as R-M's did) is unmeasured. This does not affect the c=2 determination above, since G4 is defined only at c=2, but it is a gap in understanding R-L's behavior away from the primary configuration. |
| **Required follow-up** | Non-blocking for this gate's PASS. Recommended as a post-T007 characterization item (Part F.3) before choosing a production default worker count. |

### G5 — Memory [ENG]

| | |
|---|---|
| **Registered criterion** | Peak RSS ≤1.5 GiB during R-M at concurrency 2; RSS slope across sequential files ≈ flat (no leak), operationalized (log §2) as: on the **concurrency-1 R-L run**, least-squares slope of per-unit RSS over the second half of units; projected growth = slope × (units in 2nd half); material if projected growth > 15% of the RSS at the half-way point. PASS = within, flat. CONDITIONAL = above bound but flat, with identified cause. FAIL = unbounded growth. |
| **Evidence — peak-RSS bound.** | R-M c=2: 340 MiB (23% of 1.5 GiB). R-S c=2: 267.7 MiB. GitNexus c=2: 1,067.6 MiB (71% of the bound — the highest of any tier, but still within it). iata-one-order c=2: 601.97 MiB. **All four tiers pass the peak-RSS bound comfortably.** |
| **Evidence — slope/flatness, read from the R-L (GitNexus) c=1 run as the operationalization specifies.** | Run 0: RSS first 95.3 MiB → mid 543.5 MiB → last 747.9 MiB (second-half growth 204.4 MiB = **37.6% of the mid-point RSS**). Runs 1/2: 38.1% and 40.2% respectively. **This crosses the pre-registered 15% "material" threshold by roughly 2.5×, in all 3 reps.** For context (not the formal check, which is R-L-specific): R-M c=1 second-half growth is 15.6% of mid-point (borderline, essentially at the line); R-S c=1 is 10.3% (below); iata-rl c=1 is 13.6% (below). The material-growth pattern scales with dataset complexity/relationship volume (GitNexus: 300,790 candidates, 316,895 relationships — far more than any other tier), not simply with file count. **Additional, directly relevant evidence from M-L1/M-L2 (§2 of the results doc): even the smallest fixtures (B1, ≤4 KiB) show 92–199 MiB of RSS growth across just 20 in-process repeated iterations, and B2 (16 KiB) shows 128–414 MiB** — i.e., a measurable per-iteration RSS accumulation exists even for trivial file sizes, in a *different* harness code path (the M-L1/M-L2 fixture-sweep loop, not the M-L5/M-L6 per-file-worker engine). This is **consistent with**, but does **not prove**, the same underlying accumulation mechanism producing the GitNexus R-L slope result — the two measurements exercise different code paths and this document does not claim they share a root cause. |
| **Determination** | **CONDITIONAL.** The peak-RSS sub-criterion passes cleanly everywhere measured. The slope/flatness sub-criterion, evaluated exactly where the plan pre-registers it (R-L c=1), is **not flat** by the plan's own numeric test (37.6–40.2% vs the 15% material threshold) — this is measured evidence, not an inference. A plausible cause is identified (working-set size scaling with relationship/candidate volume, corroborated by a same-direction — though not proven-identical — effect even at trivial file sizes in a different harness path), matching CONDITIONAL's "above bound but flat, with identified cause" text in spirit, though the growth here is on the slope sub-criterion rather than the peak-bound sub-criterion the sentence's literal wording addresses. This is **not** classified FAIL, because the growth plateaus at the end of each finite run (peak ≈ final RSS in every rep) rather than continuing without limit — it does not match "unbounded growth" as literally observed within the runs actually made. |
| **Evidence limitation** | The identified "cause" (working-set proportional to relationship/candidate volume) is a **plausible explanation, UNVERIFIED by memory profiling**. No test exists that varies corpus size while holding relationship density constant (or vice versa) to isolate which variable drives the growth, and no test exists at a corpus larger than GitNexus's 3,174 Tier-1 files to see whether growth continues past what this run's corpus alone would explain. |
| **Required follow-up** | **Recommended before T008 relies on this number**: heap/RSS profiling of a repository-scale run to distinguish "working set that grows with and is bounded by corpus size" from "a true per-unit leak that would continue on a larger corpus." Named in Part F.1. |

### G6 — Persistence / job overhead [ENG]

| | |
|---|---|
| **Registered criterion** | SQLite persist ≤30% of pipeline wall; job-engine overhead ≤15% vs inline. PASS = within. CONDITIONAL = above, with a concrete batching/tuning proposal measured at least once. FAIL = overhead dominates (>50%). |
| **Evidence — persist share (the pre-registered metric: persistLock+persistBody+persistCommit ÷ per-unit `parsed`-pipeline time, at concurrency 2, write-lock wait included).** | R-M: **64%**. R-S: **62.2%**. GitNexus (R-L): **66.8%**. iata-one-order (R-L): **67.6%**. **Every tier measured at the primary c=2 configuration shows persist share in the 62–68% range** — consistent across four independent datasets of very different sizes and languages, which weighs against this being a fluke of any one dataset. At c=1 (R-M only, supplementary), persist share is 46% — still above the 30% [ENG] figure, though below the 50% FAIL threshold. |
| **Evidence — job-engine overhead vs inline (the other pre-registered G6 metric, R-M only).** | Engine c=1 vs inline-main: median **+12.3%**, min +3.6%, max +18.4%, 2 of 8 rounds above 15%. Within the 15% bound at the median, but not in every round. |
| **Determination** | **FAIL, on the persist-share sub-criterion, at the primary (c=2) configuration, in every tier measured.** 62–68% literally and consistently exceeds the registered FAIL threshold text ("overhead dominates (>50%)"). This is not a borderline or single-dataset result: it is the same magnitude across R-S, R-M, and both R-L datasets. The job-overhead sub-criterion (12.3% median) is within its own 15% bound and would, on its own, support PASS or a mild CONDITIONAL — it does not rescue the compound G6 criterion, since the persist-share sub-metric is named as part of the same gate and independently crosses its own FAIL line. |
| **Evidence limitation** | M-L3's batch-size sweep (§3 of the results doc) demonstrates that SQLite write throughput is highly sensitive to batch size and transaction shape on this same schema (single-commit 48.4k rel/s vs per-row-commit 2.4–10.7k rel/s) — this is **suggestive evidence that a tuning path exists**, but it was measured against a *different* write pattern (a standalone bulk-insert benchmark) than the one actually used by the M-L4/M-L5/M-L6 engine's per-unit persist path. **No concrete batching/tuning change has actually been applied to, and re-measured against, the engine's own persist bottleneck** — so the CONDITIONAL text's specific requirement ("a concrete batching/tuning proposal measured **at least once**" against the actual bottleneck) is not met; only an adjacent, suggestive measurement exists. |
| **Required follow-up** | **Mandatory before T008** (Part F.1): redesign or re-batch the engine's persist transaction shape (informed by, but not yet validated against, the M-L3 batch-size curve) and re-measure persist share against the same 30% figure — or, alternatively, the owner may revise the [ENG] 30%/50% figures themselves at S-L2 if 62–68% is judged acceptable for this architecture; that is an owner decision this document does not make. |

### G7 — No-change re-run [ENG]

| | |
|---|---|
| **Registered criterion** | INC-1 short-circuits (FR-009): ≥95% cheaper than INC-0. PASS = within. FAIL = re-derives work. No conditional. |
| **Evidence** | INC-0 (3 reps, c=2): engine wall median 1128.5 ms. INC-1 (same DB, immediately after): **0/0/0 ms in all 3 reps**, `shortCircuitedRun: true` in all 3. **Reduction = 100% in every rep.** |
| **Determination** | **PASS.** 100% clears the ≥95% bound with no ambiguity. |
| **Evidence limitation** | Measured only on R-M; not repeated at R-S or R-L scale. Given the mechanism (0 open jobs → 0 workers spawned) is a structural property of the job table's state, not of dataset size, this limitation is judged unlikely to change the result at other tiers — but that judgment is not itself measured evidence, and is noted as such. |
| **Required follow-up** | None to change this PASS. Optionally repeat at R-L scale for completeness (Part F.4 — non-blocking). |

### G8 — Incremental scaling [ENG]

| | |
|---|---|
| **Registered criterion** | INC-2 cost scales with the change, not the repository (≤10% of INC-0 on R-M). PASS = within. CONDITIONAL = mechanism partly future: cost recorded, viability argued from measured per-file costs, follow-up task named. FAIL = incremental cost ≈ full cost with no identified path. |
| **Evidence** | INC-0 (c=2) median 1128.5 ms. INC-2 (1 file changed, c=2) median 1038.5 ms = **92.0% of INC-0**. INC-3 (24/239 files changed, c=2) median 1049.4 ms = **93.0% of INC-0**. Both are far above the ≤10% bound, and — as required by this evaluation's instructions — this is read exactly as measured: **no cross-snapshot incremental-reuse mechanism exists** (`classifyJobs` enqueues one job per file per snapshot with no reference to any prior snapshot, disclosed in the results doc §6, not a new finding here), so INC-2/INC-3 measure full-reprocessing cost of the new snapshot, not a change-scoped cost. **This document does not manufacture an incremental-saving result; none exists to report.** |
| **Determination** | **CONDITIONAL**, matching the registered text precisely: "mechanism partly future" — true, the mechanism does not exist yet; "cost recorded" — true, done above; "viability argued from measured per-file costs" — a viability argument can be constructed from already-captured evidence without a new measurement (permitted under this evaluation's rules): R-M's per-file average across the full pipeline is 1128.5 ms ÷ 239 Tier-1 files ≈ **4.7 ms/file** (a rough proxy spanning parse+symbols+contains+relationships+persist); M-L7's steady-state *parse+extraction only* per-file cost is 0.18–0.62 ms/file. If a future change-scoped mechanism reprocessed only the 1 file changed in INC-2 (plus whatever job-table/enqueue bookkeeping overhead a real implementation would carry), the plausible cost would land in the low single-digit-to-tens-of-ms range rather than the ~1039 ms measured today — i.e., plausibly under 1–2% of INC-0, comfortably clearing the ≤10% bound *if* such a mechanism were built. This is a plausibility argument from existing per-file numbers, not a new measurement, and is exactly the CONDITIONAL text's allowance — it is explicitly **not** the same as the FAIL text's "no identified path": a path is identified (content-hash/snapshot-diff-aware job enumeration, named as a follow-up task below). |
| **Evidence limitation** | The viability argument above is arithmetic extrapolation from measured per-file costs, not a built-and-measured incremental mechanism. It could be wrong if a real implementation's bookkeeping/diffing overhead (finding which files changed, propagating dependent-symbol invalidation) turns out to be non-trivial relative to one file's own parse cost — that overhead has never been measured because the mechanism does not exist. |
| **Required follow-up** | **Mandatory before T008 can claim G8 as PASS** (Part F.1): design and build a change-scoped job-enumeration mechanism (content-hash or path-diff based, informed by the plan §11 Rust-repeat register and the R6/D-R6-2 identity-stability discussion already on record for F-4), then re-run M-L6 against it. This is explicitly a **T008+ implementation task**, not something to build during T007. |

### G9 — File-size evidence

| | |
|---|---|
| **Registered criterion** | Complete band table (§5.1) exists; default + hard-ceiling recommendation derived from the curves; 512 KiB explicitly judged. PASS = complete. FAIL = bands missing or default asserted without data. No conditional. |
| **Evidence** | B1–B6 (48 fixtures) + 1 real minified fixture: all `OK`, with real p95 data for 43 of 48 cells (6 flagged insufficient-N — median only, p95 withheld exactly as the pre-registered rule requires) — pulled from `m-l12/B*.json` for this evaluation (already-captured evidence, not a re-run). **B7/B8 (16 cells across two bands × 4 languages × 2 densities): 6 stalled at the 300 s guard, 1 interrupted/partial, 3 not-attempted, and B7/B8-tsx (4 cells) have no record at all** — this is the literal "bands missing" condition. |
| **Determination** | **FAIL**, on the literal "complete band table" clause. The band table required by plan §5.1 (B1–B8 × 4 languages × 2 densities = 64 cells) is genuinely incomplete — not merely thin, but **entirely absent** for 4 cells (B7/B8-tsx) and unusable/partial for 6 more. This is distinct from "default asserted without data" — the recommendation below (Part D) is derived only from the data that actually exists and is explicitly scoped to that data, not asserted past it — but the registered PASS bar is "complete," and it is not met. |
| **Evidence limitation** | The **512 KiB (B5) sub-clause specifically is well-evidenced**: all 8 language/density combinations at B5 have a real median, and 6 of 8 have a real p95 (java-ordinary, typescript-ordinary, and all 4 dense variants); javascript-ordinary and tsx-ordinary are insufficient-N (18 and 16 iterations respectively — p95 withheld, median exists: 6.47 s and 6.70 s). So "512 KiB explicitly judged" is satisfied on its own terms even though the *overall table* is not complete. |
| **Required follow-up** | The B7/B8 disposition decision, already flagged as open at L13 (accept the partial/stall evidence as final, or authorize a scoped follow-up to fill the 6 stalled/missing cells) is the direct blocker to a PASS here. Named in Part F.1. |

---

## B. Overall T007 feasibility conclusion (per the registered gate logic, plan §9)

Applying plan §9's own "Clearance rule for T008+" literally: **G1, G2, G3 must each = PASS (mandatory, no conditionals)** before T008+ can be authorized; **each of G4–G9 must be PASS, or CONDITIONAL explicitly accepted by the owner**; the evidence artifact (§10, satisfied by L13's results.md) must be complete; then a reviewed amendment (A7) records the outcome.

Measured against that rule with the determinations in Part A:

- **G1 = PASS, G2 = PASS.** Both mandatory gates clear.
- **G3 = CONDITIONAL.** The clearance rule's own text says mandatory gates need PASS **with no conditionals** — a CONDITIONAL G3, however well-evidenced and however disclosed the underlying deviations are, **does not by itself satisfy the clearance rule as written**. This is the single item currently blocking a clean mandatory-gate clearance.
- **G4 = PASS, G5 = CONDITIONAL, G6 = FAIL, G7 = PASS, G8 = CONDITIONAL, G9 = FAIL.**

**Conclusion, stated exactly as the evidence supports and no further:** T007-LOCAL demonstrates the local relationship engine is **functionally correct and durable at every scale tested** (G1/G2 clear PASS across R-S/R-M/R-L and every failure-injection test run), and its wall-clock throughput comfortably clears the proposed [ENG] bounds at every tier (G4 PASS, large margins). It does **not yet** satisfy the plan's own clearance rule for T008+, because: (a) G3 carries real, disclosed, but currently-unresolved failure-semantics deviations that the clearance rule requires to reach PASS (not CONDITIONAL) before implementation; (b) G6's persist-share sub-metric consistently and substantially exceeds its FAIL threshold across every tier measured — this is the most decisive negative finding in this evaluation, not a borderline one; (c) G8 confirms, exactly as expected, that no incremental-reuse mechanism exists yet, which G8's own text anticipates as a CONDITIONAL (not FAIL) outcome given a named follow-up path, but which still represents unbuilt, required functionality; (d) G9's band table is incomplete pending an owner disposition decision already open since L13. **This is not a verdict that the architecture is infeasible** — G1/G2/G4/G7 PASS cleanly, and G5/G8's CONDITIONAL scores both have identified, plausible remediation paths — but the registered clearance rule is **not met today**, and this document does not soften that to make it appear met.

---

## C. Mandatory-gate summary

| Gate | Determination | One-line reason |
|---|---|---|
| **G1 Determinism** | **PASS** | Byte-identical relationship sets in every run at every tier, every concurrency, every kill/restart test, and every M-L6 scenario; the one named sub-check (M-L6 incremental-vs-full diff) has no artifact to diff against, which is a disclosed evidence-coverage gap, not an observed violation. |
| **G2 Durability** | **PASS** | 56/56 kill/restart tests, zero loss/duplication/corruption, within the owner-accepted SIGKILL/restart scope. |
| **G3 Failure semantics** | **CONDITIONAL** | F-2/F-3/F-6 meet contract cleanly; F-4 symbols-stage redelivery, F-4e's artificial-lease stress case, F-5's undefined cancel-state, and the open PAUSED/lease-default/crash-reclaim-attempts contract gaps are each disclosed, bounded, and have an identified amendment path — matching the registered CONDITIONAL text, not the FAIL text. **Per the plan's own clearance rule, a CONDITIONAL mandatory gate does not clear T008+ on its own; it requires resolution to PASS.** |

**All three mandatory gates are individually well-evidenced. Two (G1, G2) are clean PASSes. The third (G3) is CONDITIONAL — real, disclosed, bounded issues with identified paths, not a broken-beyond-repair result, but not yet the "PASS, no conditionals" the clearance rule requires.**

---

## D. File-size recommendation

**Measured evidence used (all from `m-l12/B*.json`, read for this evaluation, not re-measured):**

| Band | Size | Worst p95, parsed-unit total (ms) | Worst RSS growth over 20 iterations (MiB) |
|---|---|---|---|
| B1 | ≤4 KiB | 8.0 | 198.8 |
| B2 | 16 KiB | 22.2 | 413.5 |
| B3 | 64 KiB | 153.9 | 665.3 |
| B4 | 256 KiB | 1,860.5 | 1,058.9 |
| B5 | 512 KiB | 6,460.0 (2 of 8 cells insufficient-N, p95 withheld; worst *measured* p95 shown) | 1,254.8 |
| B6 | 1 MiB | 1,578.2 dense / **insufficient-N for every ordinary cell** (median 20.1–24.9 s) | 1,782.6 |

**Applying the pre-registered rule literally on the *time* axis** (default = largest band whose worst p95 ≤1 s; ceiling = largest band whose worst p95 ≤10 s): worst p95 crosses 1 s **at B4** (1,860.5 ms) — B3's worst p95 (153.9 ms) is the largest band still under 1 s → **time-based default candidate = B3 (64 KiB)**. Worst *measured* p95 crosses 10 s only when B6's ordinary-density cells are considered, and those are insufficient-N (median already 20–25 s, clearly over 10 s regardless); B5's worst measured p95 (6.46 s, with 2 of 8 cells unmeasured but their medians — 6.47 s, 6.70 s — pattern-consistent with staying under 10 s) is the largest band with usable evidence still under 10 s → **time-based ceiling candidate = B5 (512 KiB)**.

**Applying the same rule literally on the *RSS-growth* axis** (≤256 MiB for default, ≤1 GiB for ceiling): B1 already shows 198.8 MiB (within 256 MiB) but **B2 shows 413.5 MiB — already over the 256 MiB default bound**, and B4 shows 1,058.9 MiB — already over the 1 GiB ceiling bound. Read literally, this axis alone would put the default at **B1 (≤4 KiB)** and the ceiling somewhere in the B3 region.

**Measured evidence vs. engineering recommendation — explicitly distinguished, per this deliverable's own requirement:**

- **Measured evidence**: the two tables above, exactly as captured. Both are real numbers from real runs; neither is disputed.
- **The RSS-growth-per-band figures carry a specific, disclosed measurement-methodology caveat**, and applying them literally to a file-size threshold is **not recommended without resolving it first**: `rssGrowthMiB` is the harness's process-wide RSS growth across **20 repeated iterations in one long-lived process**, not the incremental memory cost of parsing **one** instance of a file at that size. That even a ≤4 KiB fixture shows ~100–199 MiB of "growth" over 20 iterations demonstrates this metric is dominated by iteration-loop accumulation (JIT warmup, allocator behavior, WASM heap growth pinned to a high-water mark, or similar), not by the file's own footprint — a genuinely single-file memory cost at 4 KiB cannot plausibly be 100+ MiB. Using this metric as-is would produce an internally inconsistent recommendation (a smaller-than-currently-proposed default driven by a measurement artifact, not by file-size-driven memory cost).
- **Engineering recommendation (not measured evidence — a synthesis, flagged as requiring owner confirmation)**: use the **time-based** result as the primary basis, since the per-file pipeline-time curve does directly and plausibly reflect file-size/density-driven cost (consistent with the B7/B8 stall mechanism and the R3 density finding already on record). On that basis:
  - **Recommended default: B3 region (64 KiB)** — the largest band whose worst-case (ordinary-density) real-file p95 stays under 1 second per file.
  - **Recommended ceiling: B5 (512 KiB)** — the largest band with usable p95 evidence staying under 10 seconds per file; this also happens to match the plan's own D-ARCH-6 *proposed* default (512 KiB), which this evidence would instead place at the **ceiling**, not the default — a materially different conclusion than the proposal it was meant to test.
  - Above the ceiling (B6/1 MiB and up, plus the confirmed-expensive real B7/B8 territory): the existing SKIPPED-with-structural-metadata policy (F-6, verified working in M-L4) is the correct behavior, not a smaller max-file-size default.
- **Confidence and limitations**: MEDIUM for the default/ceiling *time* numbers (grounded in real p95 data for 43 of 48 B1–B6 cells, but the band table above B6 is incomplete — G9 FAIL — so whether B7's dense cells, which did complete at ~4.9–139.7 s, would change the ceiling recommendation if fully measured is unknown). LOW for using RSS-growth as a threshold input at all, pending the measurement-methodology fix named above. **This recommendation is not a gate PASS for G9** (G9 = FAIL, Part A) — it is the best synthesis the *existing* evidence supports, offered because plan §9/§10 calls for a recommendation regardless of G9's completeness state, explicitly labeled as engineering judgment layered on top of, and distinguished from, the raw measured numbers.

---

## E. Draft research/spec amendment (A7)

Drafted only, for S-L2 owner review — **not applied to `research.md`**. See the companion file: **`specs/004-engineering-relationship-graph/research-amendment-A7-draft.md`**.

---

## F. T007 follow-up register

### F.1 — Mandatory before T008 (blocks the clearance rule as currently evidenced)
1. Resolve G3 to PASS (not CONDITIONAL): either (a) fix the symbols-stage id-stability hazard (F-4, R6/D-R6-2) so redelivery is idempotent, or (b) the owner explicitly accepts the CONDITIONAL items via a reviewed contract amendment that the clearance rule's "no conditionals" language is read to permit — this is an owner/process decision, not one this document makes.
2. Resolve G6's persist-share FAIL: redesign/re-batch the engine's persist transaction shape and re-measure against the 30% figure (or the owner revises the [ENG] figure itself).
3. Resolve or accept G9's incompleteness: decide the B7/B8 disposition (accept as-is, or run a scoped follow-up for the 6 missing/stalled cells).
4. Build and measure the G8 change-scoped incremental mechanism named in Part A's G8 row (a T008-scope implementation task, not a T007 task).
5. Recommended (not strictly gate-blocking, but directly informs whether G5's CONDITIONAL should be treated as acceptable): heap/RSS profiling to distinguish bounded working-set growth from a true per-unit leak.

### F.2 — Conditional / owner-accepted (already-preserved decisions, unchanged by this evaluation)
- F-4 symbols-stage redelivery: known F002/R6/D-R6-2 hazard; no production redesign during T007 (preserved).
- F-4e: targeted characterization only; no fencing implementation during T007 (preserved).
- Crash-reclaim attempt semantics: amendment candidate (preserved).
- G2 scope: SIGKILL/restart only; no FULL/power-loss/commit-targeted experiments (preserved).
- G6 config: WAL+`synchronous=NORMAL`; no `sync=FULL` experiment (preserved).

### F.3 — Post-T007 engineering improvements (non-blocking)
- R-L concurrency-4/8 ladder (G4/G5 context only; not required by either gate's literal criterion).
- Repeat G7 (no-change re-run) at R-L scale for completeness.
- Native/Rust Tree-sitter comparison point (Rust-repeat register, plan §11) for every LOCAL-RUNTIME number in this evaluation.
- Concurrent reader/writer SQLite contention measurement (out of scope for M-L3 as pre-registered).

### F.4 — Evidence gaps that do NOT block any registered gate
- No inline baseline was measured at R-S or R-L (G6's registered metric is R-M-specific as pre-registered; this is a scope note, not a gap in the G6 determination itself).
- No F-1…F-6 failure-injection evidence at R-S/R-L or against the M-L6 INC datasets (none of G1/G2/G3's registered criteria require it beyond R-M).

---

## G. Explicit statements

- **No production code changed.** No file under `src/` or `tests/` was modified.
- **No thresholds changed.** Every [ENG] number in Part A is quoted exactly as registered in plan §9; none was revised, loosened, or tightened.
- **No benchmark rerun.** Every number cited in this document comes from evidence files already on disk before this evaluation began (`m-l4-*.json`, `m-l5-*.json`, `m-l6-*.json`, `m-l7-*.json`, `m-l12*.json`, `m-l3-*.json`, `s-l1-fidelity.json`, `m-l0-smoke.json`); the only new activity in this pass was reading additional fields (RSS-slope, p95, RSS-growth) already present in those same files but not previously surfaced in the consolidated results.
- **No task checkbox ticked.**
- **No commit, no push.**
- **S-L2 is still pending owner review** of this document and of `research-amendment-A7-draft.md`.
- **T008+ remain unauthorized**, regardless of any PASS/CONDITIONAL/FAIL determination above — per plan §9, only a reviewed amendment following owner review changes the T007 gate outcome, and no such review has occurred.

**This document stops here. L14 does not proceed to S-L2 or to any implementation.**
