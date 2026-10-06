# T007-LOCAL — S-L2 Owner Review Record

**Feature**: 004 — Engineering Relationship Graph · **Stop gate**: S-L2 (`t007-local-feasibility-tasks.md` — "owner review of L14: only an explicit owner decision on the A7 amendment changes the T007 gate outcome")
**Inputs (unmodified by this pass)**: `t007-local-gate-evaluation.md`, `research-amendment-A7-draft.md`, `t007-local-feasibility-results.md`, `t007-local-execution-log.md` §1–§18, `docs/claude_report/reports.md`, `docs/ROADMAP.md`, `docs/progress/PROGRESS.md`, `docs/session_handoffs/CURRENT.md`.
**Status of this document**: analysis and recommended dispositions, produced at the owner's direction to conduct the S-L2 review, grounded strictly in the L13/L14 evidence and the plan's own registered rules. **No decision below is invented** — where the evidence and the plan's own clearance/amendment rules make a disposition clear-cut, that disposition is stated as the recommended decision; where they do not, the item is marked NEEDS-EVIDENCE rather than resolved by guess. **This document does not itself authorize T008+.** No production code, `src/`, `tests/`, schema, config, threshold, dataset, evidence JSON, or `research.md` was touched to produce it. No task checkbox ticked. No commit, no push.

---

## A. Reconciliation of the L14 gate determinations (exactly as registered, unchanged)

| Gate | L14 determination |
|---|---|
| G1 | PASS |
| G2 | PASS |
| G3 | CONDITIONAL |
| G4 | PASS |
| G5 | CONDITIONAL |
| G6 | FAIL |
| G7 | PASS |
| G8 | CONDITIONAL |
| G9 | FAIL |

**Clearance-rule check (plan §9, verbatim): "G1, G2, G3 = PASS (mandatory, no conditionals); each of G4–G9 = PASS, or CONDITIONAL explicitly accepted by the owner."** Applying this literally to the table above:
- G1, G2 already satisfy the mandatory bar.
- **G3 = CONDITIONAL does not satisfy "PASS, no conditionals."** This alone blocks clearance regardless of anything else.
- G4, G7 already satisfy the G4–G9 bar (PASS).
- G5, G8 = CONDITIONAL — **the clearance rule explicitly permits this to clear IF the owner explicitly accepts it.** Not yet accepted; this record makes that recommendation (§C/D below give the reasoning).
- **G6 = FAIL and G9 = FAIL are not in the clearance rule's allowed set for G4–G9 at all** ("PASS, or CONDITIONAL" — FAIL is neither). A FAIL gate cannot clear by owner acceptance alone under the rule as written; it clears only by (a) remediation that moves it to PASS/CONDITIONAL, or (b) the owner formally revising the registered [ENG] threshold or criterion itself (which the plan explicitly permits at the authorization stage — this is a different action than "accepting" the current FAIL result), or (c) an explicit waiver mechanism analogous to Feature 004's own FR-038 waiver (a precedent already in this repository).

**Conclusion of the reconciliation: T008+ is not clearable today under a literal reading of the clearance rule, on three independent grounds (G3, G6, G9), each requiring its own resolution path — not one.**

---

## B. A7 draft — item-by-item classification

| A7 item | Classification | Basis |
|---|---|---|
| Overall gate-outcome table (A7 §1) | **ACCEPT** | Matches L14 exactly; nothing to dispute. |
| Option 1 ("NEEDS REMEDIATION") vs Option 2 ("CONDITIONAL CLEARANCE, OWNER-ACCEPTED") vs Option 3 ("DEFERRED") | **Recommended: a hybrid, not any single option as drafted** — see §H.1. G3/G6/G9 need remediation-or-reformulation (Option-1-shaped); G5/G8 are recommended for owner-accepted CONDITIONAL clearance (Option-2-shaped) once G3/G6/G9 are resolved. Neither pure option fits; the A7 final text should say so explicitly rather than picking one label. |
| §2.1 Symbols-stage identity stability (F-4/R6/D-R6-2) | **ACCEPT** the proposed direction; implementation is a required SpecKit follow-up (§K.1) | Real idempotency break, known hazard, clear fix path already named in the repo's own R6 history. |
| §2.2 Lease fencing (F-4e) | **DEFER** the fencing *implementation*; **ACCEPT** an interim documented operating constraint (lease must exceed realistic max unit duration with margin) as a lower-cost substitute for now | No divergence was observed under any realistic condition tested; only an artificially-short 2 ms lease diverged. Matches the owner's own already-preserved framing ("targeted characterization only; no fencing implementation during T007"). |
| §2.3 PAUSED state (add state vs. amend guarantee-7 wording) | **NEEDS-EVIDENCE / DEFER the choice** — the amendment direction itself is accepted (a gap exists and should be closed), but which of the two options is correct is a design decision this record does not have grounds to make; route to SpecKit SPECIFY (§K.3) | Behavior already correct; only the model/label is undefined. Non-blocking for T008. |
| §2.4 CANCELLED state | **ACCEPT** (add CANCELLED as a terminal state, matching observed "finish-then-clean-hash" behavior) | Cheap, low-risk, documentation-shaped; closes a real but non-blocking gap. |
| §2.5 Lease/retry/backoff defaults | **ACCEPT** the need to name defaults; **DEFER** the specific numbers to T008 planning | The contract's silence on defaults is a real gap, but the numbers themselves are an implementation decision naturally made when T008 is planned, not something T007 evidence determines. |
| §2.6 Crash-reclaim `attempts` increment | **ACCEPT** | Simple, clear, closes a real robustness gap (unbounded retry risk) already named by the owner as "an amendment candidate" — accepting the direction does not contradict deferring its *implementation timing*, which §H.1 places before T008. |
| §3 G6 batching remediation direction | **ACCEPT the direction; NEEDS-EVIDENCE on whether it is *sufficient*** | M-L3 shows batching affects throughput on a *different* write pattern than the engine's own persist path; the direction is plausible but unconfirmed against the actual bottleneck until it is built and re-measured. See §D. |
| §4 G8 change-scoped incremental mechanism | **ACCEPT as a follow-up requirement; NOT a T008 blocker** | See §E. |
| §5 G9 disposition (accept-as-is vs. scoped follow-up) | **Recommended: neither of the two options as literally drafted — a third disposition (narrow/amend the criterion)**, see §F | The two drafted options were "accept incompleteness" or "complete the missing cells"; evidence supports a third path the draft did not itself propose. |

---

## C. G3 — item-by-item review

| Item | Current evidence | Current contract gap | Proposed A7 amendment | Owner decision required | Blocks T008+? |
|---|---|---|---|---|---|
| **F-4 symbols-stage redelivery / identity stability** | Redelivering a completed `symbols` unit (delete+reinsert) changes row ids; 36 relationship endpoints dangle. Known, disclosed, pre-existing (R6/D-R6-2), not newly introduced. | Symbols have no identity stable across redelivery, unlike relationships (`relationship_key`). | Give symbols a stable natural key (mirroring `relationship_key`), so redelivery re-links by key, not row id. | Authorize the SpecKit follow-up to design + implement the stable-key change (a Feature 002/004 boundary task). | **YES** — this is the literal idempotency-break case G3's own FAIL text names; it must be resolved (or explicitly risk-accepted via a formal waiver) before G3 can reach PASS. |
| **F-4e artificial lease stress result** | 0/5 divergence at a realistic 1.5 s lease; 0/3 divergence even when a real unit (13.3 s) exceeded a 1.5 s lease (reclaim happened, final graph still correct); 1/3 divergence **only** under an artificial 2 ms lease. | No fencing token exists to make a stale worker's completion safe if a reclaim has already happened. | Add a fencing token to job rows; reject writes from a superseded claim generation. | Decide: implement fencing now, or accept an interim lease-sizing policy (lease ≫ realistic max unit duration) as a documented mitigation. | **NO, if the interim policy is adopted** — no realistic-condition divergence was ever observed; fencing is a hardening item, not a currently-demonstrated production risk. |
| **F-5 undefined CANCELLED state** | Cancel-halt *behavior* verified correct (claiming stops, invariants hold, resumable, clean hash) in every test run. Only the end-state *label* is undefined by the contract. | Contract defines 7 states, none of them CANCELLED; harness maps cancel→FAILED('cancelled') as a workaround, not a proposal. | Add CANCELLED as a terminal state distinct from FAILED. | Approve the contract-text addition. | **NO** — behavior already matches what CANCELLED would mean; this is a documentation-completeness fix, not a behavior fix. |
| **PAUSED contract** | Pause/resume behavior verified 6/6 correct. The *representation* (state vs. flag) contradicts contract guarantee 7's "no extra bookkeeping" wording. | Model ambiguity: is PAUSED a state or a flag outside the state machine? | Either add an eighth PAUSED state, or amend guarantee 7's wording to explicitly permit a snapshot-level flag. | Choose one of the two options (a design decision, not an evidence question). | **NO** — behavior already correct; only the model needs to be named. |
| **Lease defaults** | Harness values exist and work in every test run but are explicitly not proposals. | Contract is silent on default lease duration. | Name a default (or delegate to versioned config) in the contract. | Approve naming a default (the number itself can be chosen during T008 planning, informed by M-L4's measured unit durations). | **NO** for T007's gate; **YES as a prerequisite** before T008's own tasks can be written with a concrete value. |
| **Retry/backoff defaults** | Same pattern as lease defaults — harness values work, aren't normative. | Contract is silent. | Same as above. | Same as above. | Same as lease defaults. |
| **Crash-reclaim attempt semantics** | A crashed-and-reclaimed unit's `attempts` counter is not incremented — a persistently-crashing unit could retry unboundedly. Owner already named this "an amendment candidate." | Bounded-retry guarantee (F-3) does not actually bound crash-driven retries. | Increment `attempts` on every reclaim, not only on explicit FAILED. | Approve the fix; it is small and does not require a design choice. | **YES, bundled with the F-4 remediation** — this is part of what "resolve G3 to PASS" requires, since it is a real gap in the bounded-retry guarantee G3 evaluates. |

**Net G3 disposition recommended**: **remediation required before T008** for the two items that actually block clearance (F-4 identity stability, crash-reclaim attempts); the remaining five items (F-4e, CANCELLED, PAUSED, lease defaults, retry defaults) can be resolved as lightweight contract-documentation amendments that do not themselves block T008 and can proceed in parallel with, or slightly ahead of, T008 planning.

---

## D. G6 — persistence overhead disposition

**The measured result is treated as decisive and is not reinterpreted or softened**: persist share is 62.2% (R-S), 64% (R-M), 66.8% (GitNexus), 67.6% (iata-one-order) of parsed-unit pipeline time at concurrency 2 — consistently, across four independent datasets of very different size, language and content. This is not close to the 30% [ENG] figure and is well past the registered ">50% = overhead dominates" FAIL line in every single measurement.

**Disposition options considered, per the task's framing:**
1. *Remediation required before T008.*
2. *Conditional acceptance with explicit technical debt.*
3. *Another documented disposition* — e.g., revising the [ENG] 30%/50% figures themselves.

**Recommended: (1), remediation required before T008 — not conditional acceptance.** Reasoning: the magnitude (62–68%, not a marginal 35–40%) and its consistency across every tier indicate a structural property of the current persist path (per-unit-immediate-commit against a single-writer SQLite connection), not dataset-specific noise. M-L3's own batch-size evidence (§B above) shows this same schema's write throughput is highly sensitive to batching, which strongly suggests — though does not yet prove against the actual bottleneck — that a viable, moderate-effort fix exists (batch several completed units' persist work per transaction, bounded so durability, guarantee 1, is not weakened). Accepting 62–68% as permanent technical debt would mean building the entire relationship-extraction pipeline in T008 on top of a bottleneck that consumes roughly two-thirds of every unit's wall time, when a comparatively cheap architectural change is already suggested by evidence on hand. Revising the [ENG] figures themselves (disposition 3) is not recommended as the *primary* path, because 62–68% is large enough that simply relabeling the threshold would not be an honest engineering response to a real, measured bottleneck — though the owner retains the authority to choose that path instead at final sign-off.

**This record does not design the remediation** (per instruction) — only its disposition. The concrete task (build a batched-persist variant of the engine, re-measure G6 against it) is named in §K.2.

---

## E. G8 — incremental mechanism disposition

**Acknowledged plainly, as measured, without softening**: INC-2 costs 92.0% and INC-3 costs 93.0% of INC-0 — the current mechanism provides **no meaningful incremental saving**. This is because no cross-snapshot incremental-reuse mechanism exists at all (§ already established at L13/L14); every new snapshot is fully reprocessed regardless of how many files actually changed.

**Recommended disposition: accepted as a follow-up requirement, tracked but NOT a T008 blocker.** Reasoning: unlike G6 (a FAIL, not in the clearance rule's allowed set), G8's determination is CONDITIONAL, which the clearance rule explicitly allows to clear via owner acceptance. The registered CONDITIONAL text itself anticipates exactly this situation ("mechanism partly future… follow-up task named") — the plan's own authors expected the incremental-reuse mechanism might not exist yet at gate time and wrote a clearance path for that case. Architecturally, a working full-graphification pipeline is also a natural prerequisite for building change-scoped incremental reuse on top of it (you need correct full processing before you can safely skip parts of it) — so sequencing incremental-reuse *after* an initial T008 implementation, rather than before it, is a defensible engineering order, not merely a convenient deferral.

---

## F. G9 — file-size evidence disposition

**Preserved exactly as required**: 6 of 16 B7/B8 cells are missing, stalled, or unusable (4 B7/B8-tsx cells have no record at all); the B5 (512 KiB) evidence itself is real and usable (8/8 medians, 6/8 p95s); the overall G9 gate, as registered, is **FAIL** — this record does not upgrade it.

**Disposition options considered:**
1. Complete the missing evidence (run a scoped B7/B8 follow-up).
2. Formally narrow/amend the criterion.
3. Defer the missing bands (leave G9 as an accepted, permanent incompleteness).

**Recommended: (2), formally narrow/amend the criterion — not (1) or (3) as drafted.** Reasoning: the file-size *recommendation* that actually matters for engineering purposes (default ≈ B3/64 KiB, ceiling ≈ B5/512 KiB, §G below) sits entirely below the region where B7/B8 evidence is missing (B7 starts at 4 MiB, nearly 8× the recommended ceiling). Files above the recommended ceiling are already correctly handled by the SKIPPED-with-structural-metadata policy (F-6, verified working) regardless of their exact per-file cost — so completing B7/B8 would add due-diligence data about a size region the recommendation already excludes, not change the recommendation itself. The criterion should therefore be **amended to scope "complete band table" to the bands at or below the adopted ceiling** (B1–B6 plus the real-minified fixture, all of which are complete or near-complete), with the B7/B8 stall investigation tracked separately as a non-blocking research item (plausibly linked to the still-UNVERIFIED super-linear same-file-resolution finding from M-L1/M-L2). This is **not** a silent downgrade of the FAIL — it requires an explicit, owner-approved rewording of G9's own text (a small SpecKit amendment, §K.4), and until that rewording is approved, **G9 remains FAIL exactly as scored.**

---

## G. File-size recommendation — confirmation and required follow-through

Confirmed explicitly: **default ≈ B3 (64 KiB) and ceiling ≈ B5 (512 KiB) is engineering synthesis derived from the L14 evaluation, not a measured G9 PASS.** G9 is FAIL (§F); this recommendation stands independently of that score, exactly as the plan's own §9/§10 anticipates a recommendation being produced regardless of G9's completeness state.

**Explicit identification, as instructed**: the plan's own D-ARCH-6 text currently names **512 KiB as the *proposed default*** (`t007-local-feasibility-plan.md` §5.1: "the ADR-001 §2 D-ARCH-6 *proposed* default"). If the owner accepts the B3/B5 recommendation above, **512 KiB moves from "default" to "ceiling" — a materially different role** — and the D-ARCH-6/ADR-001 text **must be explicitly amended to say so**, not left as-is with a new default silently coexisting with old "512 KiB is the default" language elsewhere in the docs. This amendment is named as a required SpecKit follow-up (§K.5) **conditioned on the owner accepting the recommendation** — it is not performed in this pass, and no config value (`CODE_INTEL_MAX_FILE_SIZE_BYTES` or any new default constant) is changed here.

---

## H. T007 S-L2 decision record

1. **Gate outcome**: G1 PASS, G2 PASS, G3 CONDITIONAL, G4 PASS, G5 CONDITIONAL, G6 FAIL, G7 PASS, G8 CONDITIONAL, G9 FAIL — reconciled unchanged from L14 (§A).
2. **Owner decision for G3 (recommended)**: remediation required before T008 for symbols-stage identity stability (F-4) and crash-reclaim `attempts` (bundled); the remaining five items resolve as lightweight contract-documentation amendments, non-blocking, proceeding via SpecKit in parallel with T008 planning (§C).
3. **Owner decision for G5 (recommended)**: accept as CONDITIONAL for clearance purposes (peak-RSS bound clearly passes; slope-flatness sub-check is material but plateaus within-run, plausible-but-unverified cause); track RSS/heap profiling as a non-blocking post-T007 follow-up, not a T008 prerequisite.
4. **Owner decision for G6 (recommended)**: **remediation required before T008** — not conditional acceptance. Build and measure a batched-persist variant against the same 30%/50% figures before relying on this gate (§D).
5. **Owner decision for G8 (recommended)**: accept as a tracked follow-up requirement; **not** a T008 blocker (§E).
6. **Owner decision for G9 (recommended)**: formally narrow/amend the criterion to scope "complete band table" to bands at/below the adopted ceiling; track the B7/B8 stall investigation separately, non-blocking. **G9 remains FAIL until that amendment is itself approved** (§F).
7. **File-size default decision (recommended, pending owner acceptance)**: **64 KiB (B3 region)** — superseding any assumption that 512 KiB is the default.
8. **File-size ceiling decision (recommended, pending owner acceptance)**: **512 KiB (B5)** — the plan's former *proposed default* is recommended to become the *ceiling* instead.
9. **A7 items — final classification**: see §B table above (repeated in the section headers below).
10. **Exact conditions before T008 (all must be satisfied, not any one)**:
    - G3 → PASS: symbols-stage identity stability implemented and re-verified (F-4 retest clean); crash-reclaim `attempts` fix implemented; OR an explicit, formally-issued owner waiver analogous to FR-038 covering the residual risk, naming it explicitly.
    - G6 → PASS or owner-accepted CONDITIONAL: batched-persist remediation built and re-measured against 30%/50%; OR an explicit owner decision to revise the [ENG] figures themselves with stated reasoning.
    - G9 → PASS on an amended criterion: the criterion-narrowing amendment (§F) formally approved by the owner (a SpecKit-level wording change to the plan's own G9 text, not a new measurement, unless the owner instead chooses to complete B7/B8 first).
    - G5/G8 → owner explicitly accepts the CONDITIONAL determinations for clearance (the clearance rule permits this without further remediation, but requires an explicit acceptance, not silence).
    - The A7 amendment itself, incorporating the above, is written into `research.md` and reviewed/approved by the owner (this is the actual, final S-L2 action — not yet performed).
11. **Is T008 blocked?** **YES.** None of the three blocking conditions (G3, G6, G9) is yet satisfied. This record does not, and cannot, unblock T008 by itself — it only names what would.
12. **Is SpecKit amendment/specification work required before implementation?** **YES**, on four separate tracks (§K): (a) the `contracts/local-job-engine.md` amendments for G3; (b) a scoped persist-batching design+remeasurement task for G6; (c) the G9 criterion-narrowing amendment; (d) the G8 change-scoped-incremental design (tracked, non-blocking, can follow T008 rather than precede it). None of these four tracks has been specified, planned, tasked, or authorized yet — this record only identifies that they are needed and roughly what each covers.

---

## I. SpecKit follow-up chain (named, not executed)

For each of the three T008-blocking tracks and the one non-blocking track, the standard SpecKit lifecycle (ANALYSE → RESEARCH → SPECIFY → PLAN → TASKS → CHECKLIST → AUTHORIZATION) applies. None of these steps has been performed by this pass; each is a distinct future authorization the owner must grant by name, exactly as every prior T007 phase required.

### K.1 — G3 remediation (symbols-stage identity stability + crash-reclaim attempts + contract-documentation items)
- **ANALYSE**: confirm the R6/D-R6-2 resolution direction (stable symbol key) does not conflict with any other Feature 002 consumer of symbol row ids.
- **RESEARCH**: survey how `symbol_key`-equivalent identity should be derived for symbols (name + kind + containing-file + position, or similar — mirroring the existing `relationship_key` precedent).
- **SPECIFY**: amend `contracts/local-job-engine.md` (CANCELLED, PAUSED, lease/retry defaults, crash-reclaim attempts) and, separately, Feature 002's symbol-schema contract (identity stability) — likely two small spec amendments, not one.
- **PLAN / TASKS / CHECKLIST**: a small implementation plan scoped to the schema/identity change plus a re-run of F-4 against it.
- **AUTHORIZATION**: owner names this task explicitly, as every T007 phase before it required.

### K.2 — G6 remediation (persist batching)
- **ANALYSE**: confirm which persist operations can be safely batched across units without weakening durability guarantee 1 (F-1's kill/restart evidence would need to be re-verified against the batched design, not assumed to still hold).
- **RESEARCH**: reuse M-L3's batch-size curve as the starting hypothesis; identify the checkpoint/commit boundary that bounds batch size for durability.
- **SPECIFY / PLAN / TASKS**: a scoped harness change (not production code, still PROTOTYPE-labeled per plan §3, unless the owner elects to fold this directly into a T008 design decision) plus a re-measurement task mirroring M-L4/M-L5's existing method.
- **AUTHORIZATION**: owner names this task explicitly.

### K.3 — G9 criterion amendment
- **ANALYSE / SPECIFY**: propose the exact revised wording for plan §5.1/§9's G9 row, scoping "complete band table" to the adopted ceiling region.
- **AUTHORIZATION**: a lightweight, single-document amendment; owner approval is the primary gate here, not a large task.

### K.4 — G8 change-scoped incremental mechanism (tracked, non-blocking — can follow T008)
- **ANALYSE / RESEARCH / SPECIFY / PLAN / TASKS / CHECKLIST**: the full lifecycle, likely feature-sized (content-hash-based snapshot diffing, dependent-symbol invalidation), deliberately deferred past initial T008 per §E's recommended sequencing.
- **AUTHORIZATION**: named separately, at a time of the owner's choosing — not urgent for T008 itself.

### K.5 — File-size default/ceiling adoption (conditioned on owner accepting §G)
- **SPECIFY**: amend `docs/architecture/ADR-001-local-first-runtime.md` §2 (D-ARCH-6) to state ceiling=512 KiB / default=64 KiB, superseding the "512 KiB is the proposed default" wording.
- **PLAN/TASKS**: the actual config default (`CODE_INTEL_MAX_FILE_SIZE_BYTES` or a new constant) is a T008-scope implementation detail once the ADR is amended — not performed here.

---

## What this record does NOT do

No `src/`, `tests/`, schema, config, threshold, dataset, evidence JSON, or `research.md` file was changed. No task checkbox ticked. No commit, no push. No T008 authorization is claimed or implied — every "recommended decision" above is exactly that: a recommendation, grounded in the L13/L14 evidence and the plan's own registered rules, produced for the owner's actual sign-off. **T008 remains blocked** until the conditions in §H.10 are met and the A7 amendment is actually written into `research.md` with the owner's approval — neither of which this pass performs.
