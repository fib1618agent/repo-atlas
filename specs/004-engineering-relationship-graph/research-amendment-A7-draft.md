# DRAFT — research.md Amendment A7 (T007-LOCAL Gate Outcome)

**Status: DRAFT FOR S-L2 OWNER REVIEW. NOT APPLIED. `research.md` has not been edited.** This file exists so the owner can review, edit, reject, or approve exact amendment text before anything is written into `research.md`. Per plan §9: "then a **reviewed amendment** (research.md A7) records the outcome and, only then, T008+ may be authorized." Approving this draft as-is, editing it, or rejecting it are all owner decisions; none is made by this document.

---

## Proposed A7 text (for `specs/004-engineering-relationship-graph/research.md`)

> **Amendment A7 (T007-LOCAL gate outcome, [DATE OF OWNER APPROVAL]).** T007-LOCAL (the redefined Local Relationship Engine Feasibility gate, A6/D-ARCH-3) executed M-L0 through M-L7 across all three repository tiers (R-S, R-M, two R-L datasets) plus the full file-size band sweep and failure-injection suite. Evidence: `t007-local-feasibility-results.md` (L13) and `t007-local-gate-evaluation.md` (L14).
>
> **Gate outcome: G1 = PASS, G2 = PASS, G3 = CONDITIONAL, G4 = PASS, G5 = CONDITIONAL, G6 = FAIL, G7 = PASS, G8 = CONDITIONAL, G9 = FAIL.**
>
> Per plan §9's clearance rule (G1/G2/G3 = PASS with no conditionals required for T008+), **T008+ clearance is NOT reached as of this evidence set**, because G3 is CONDITIONAL rather than PASS, and two engineering gates (G6, G9) are FAIL. This is recorded as: **[OWNER TO SELECT ONE — see options below]**.

### Options for the owner to select (mutually exclusive; pick one, or propose different wording)

**Option 1 — "NEEDS REMEDIATION" (parallel to Feature 004's own A5 "outcome B" pattern).** T007-LOCAL demonstrates the architecture is sound at the properties that matter most (determinism, durability, throughput margin) but is **not yet cleared for T008+**. A follow-up remediation pass (scope: `t007-local-gate-evaluation.md` Part F.1) must resolve G3/G6/G9 before re-evaluation. No new full T007-LOCAL execution is implied — only the specific fixes named in F.1, followed by a targeted re-measurement of the affected gates (G3's F-4 retest, G6's persist-share retest, G9's B7/B8 completion or accepted-as-is disposition) and a re-scored A7.

**Option 2 — "CONDITIONAL CLEARANCE, OWNER-ACCEPTED."** The owner reviews the specific CONDITIONAL/FAIL items in `t007-local-gate-evaluation.md` Part A and explicitly accepts them as sufficient to proceed to T008+ despite the plan's literal "no conditionals" clearance text — i.e., the owner exercises authority to waive that specific clause for this evidence set, the way Feature 004's own FR-038 waiver mechanism works elsewhere in this repository. This requires the owner to name, for each of G3/G6/G9, why the residual risk is acceptable to carry into implementation (e.g., "G6's persist-share overhead is acceptable for a local-first tool where wall-clock margin (G4) is enormous" or "G9's B7/B8 gap is acceptable because the production default will sit well below B7 regardless").

**Option 3 — "DEFERRED."** No decision yet; T007-LOCAL evidence stands as measured, T008+ remains NOT AUTHORIZED, and the owner will decide at a later session. (This is the default if the owner does not select 1 or 2.)

---

## 1. Gate outcome table (for direct inclusion in the amendment, copied from `t007-local-gate-evaluation.md` Part A)

| Gate | Determination |
|---|---|
| G1 Determinism | PASS |
| G2 Durability | PASS |
| G3 Failure semantics | CONDITIONAL |
| G4 Throughput | PASS |
| G5 Memory | CONDITIONAL |
| G6 Persistence/job overhead | FAIL |
| G7 No-change re-run | PASS |
| G8 Incremental scaling | CONDITIONAL |
| G9 File-size evidence | FAIL |

## 2. Proposed contract amendments to `contracts/local-job-engine.md` (addressing the G3 CONDITIONAL items — drafted, not applied)

These are the specific, disclosed G3 deviations and a proposed amendment direction for each. **None of this is implemented; all require their own separately authorized task.**

1. **Symbols-stage redelivery idempotency (F-4, R6/D-R6-2 hazard).** Problem: re-executing a `symbols`-kind unit via delete-then-reinsert assigns new row ids, breaking relationships that reference the old ids (36 dangling endpoints observed). Proposed direction: adopt the same identity-stability principle already used for the relationship stage (`relationship_key`, content-derived, not row-id-derived) for the symbol stage — i.e., resolve R6/D-R6-2 by giving symbols a stable natural key that survives redelivery, so relationship endpoints can be re-linked by key rather than by row id. Owning task: a Feature 002/004 boundary task (F002 owns the symbols schema).
2. **Lease/fencing (F-4e).** Problem: a unit whose real duration exceeds its lease can be claimed twice; under an artificial 2 ms lease this produced one silent divergence in three runs. Proposed direction: add a fencing token (a monotonic claim generation number) to the job row, and require a completing worker to present the fencing token that matches the row's current claim generation, rejecting a write from a token that has since been superseded by a reclaim. This is a standard fencing pattern and does not require choosing a specific lease value — it makes an incorrect lease value safe rather than merely rare.
3. **PAUSED state.** Problem: the seven-state model cannot represent "paused" without extra bookkeeping outside the state machine, contradicting contract guarantee 7. Proposed direction: either (a) add PAUSED as an eighth state with defined transitions from PENDING/CLAIMED, or (b) explicitly amend guarantee 7 to permit a snapshot-level pause flag as the intended mechanism (matching what the harness already does) rather than a per-job state — the owner should choose (a) or (b), not this draft.
4. **CANCELLED state.** Problem: no CANCELLED state exists; the harness maps cancel→FAILED('cancelled') as a workaround. Proposed direction: add CANCELLED as a terminal state distinct from FAILED, with a defined rule for jobs already RUNNING at cancel time (finish vs. abandon — the harness's F-5 evidence shows "finish" is the currently observed behavior; the contract should say so explicitly if that is the intended design).
5. **Lease/retry/backoff defaults.** Problem: the contract specifies the existence of a lease and bounded retry with backoff, but not their default values; the harness's values are not proposals. Proposed direction: the contract should name defaults (or explicitly delegate them to a documented, versioned configuration surface) so that future conformance tests have something normative to check against, not just "whatever the current harness happens to use."
6. **Crash-time reclaim and `attempts`.** Problem: a unit that crashes mid-run and is reclaimed does not have its `attempts` counter incremented, so a persistently-crashing unit could retry unboundedly, defeating the bounded-retry guarantee's intent. Proposed direction: increment `attempts` on every reclaim, not only on an explicit FAILED transition, so the existing bounded-retry policy actually bounds crash-driven retries too.

## 3. Proposed G6 remediation direction (drafted, not applied)

Problem: persist share is 62–68% of parsed-unit pipeline time at concurrency 2, across every tier measured, far above the 30% [ENG] figure and into FAIL territory (>50%). M-L3's batch-size sweep shows this schema's write throughput is highly sensitive to batch size (48.4k rel/s single-commit vs 2.4–10.7k rel/s per-row), suggesting the engine's current per-unit-immediate-commit persist pattern is a likely, though unconfirmed, cause. Proposed direction: batch relationship/candidate inserts across several completed units per transaction (bounded by a checkpoint interval so durability guarantee 1 is not weakened), then re-measure persist share against the same 30%/50% figures before this amendment is finalized as PASS.

## 4. Proposed G8 remediation direction (drafted, not applied)

Problem: no cross-snapshot incremental-reuse mechanism exists; INC-2/INC-3 measure full-reprocessing cost (~92–93% of INC-0), not change-scoped cost. Proposed direction (a T008+ implementation task, informed by the same identity-stability work in §2.1 above): given a new snapshot, diff its `snapshot_files` content hashes against the immediately-preceding snapshot for the same repository; enqueue `symbols`/`parsed` jobs only for files whose content hash changed, plus any file whose relationships reference a changed file's exported symbols (a dependent-invalidation set, not just the literal changed-file set); reuse all other rows by copying them forward (not recomputing) with correct snapshot-scoping. Re-run M-L6 against this mechanism once built.

## 5. Proposed G9 disposition (owner decision, not resolved by this draft)

The B7/B8 partial/stall evidence (6 of 16 cells missing or unusable) has been an open decision since the L13 checkpoint (2026-09-26 05:24 +04:00) and remains open here. Two paths: (a) accept the B1–B6 + partial B7/B8 evidence as final and adopt the Part D recommendation (default ≈ B3/64 KiB, ceiling ≈ B5/512 KiB) with G9 recorded as a **known, accepted incompleteness** rather than pursued to full completion; or (b) authorize a scoped follow-up task specifically to complete the 6 missing/stalled B7/B8 cells (likely requiring the stall-guard's underlying super-linear same-file-resolution cost, flagged in M-L1/M-L2, to be understood or bounded first, since that is the probable — UNVERIFIED — cause of the stalls).

## 6. What this draft does NOT do

- It does not change `contracts/local-job-engine.md`.
- It does not change any [ENG] threshold in `t007-local-feasibility-plan.md` §9.
- It does not implement any of the six §2 contract amendments, the §3 batching change, or the §4 incremental mechanism.
- It does not resolve the §5 G9 disposition.
- It does not authorize T008+.
