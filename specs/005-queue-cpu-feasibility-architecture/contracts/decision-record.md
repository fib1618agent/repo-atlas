# Contract: Decision Record (`decision-record.md`)

> **Naming note**: this file is the *contract* (required structure and rules). The *deliverable* it governs is `specs/005-queue-cpu-feasibility-architecture/decision-record.md`, created when tasks run. The same distinction applies to `contracts/live-experiment-proposal.md` (template) vs the root-level `live-experiment-proposal.md` (instance) and `contracts/waiver.md` (template) vs a waiver record (created only if the user grants one).

The decision record is the feature's only deliverable of substance. This contract fixes its required sections so each success criterion is checkable by inspection. A record missing any section, or containing a forbidden statement, fails review.

## Required sections (in order)

| # | Section | Must contain | FR | SC |
|---|---|---|---|---|
| 1 | Status banner | "Feature 004 T007 not cleared by this document"; live operations: none performed/authorized unless referenced | FR-030, FR-036 | SC-011, SC-013 |
| 2 | Evidence catalogue | EvidenceRecord table (E1–E8+), provenance class, doc page title/section/URL, currency note | FR-022, FR-024, FR-025 | SC-012 |
| 3 | CPU accounting model | unit, invocation/batch/message/file boundaries, applicable limit, per-item source or `UNKNOWN`, conflicting sources listed unreconciled; repository quantities from the four-row consumer table (Queue configuration / consumer invocation-message batch / files-per-message configuration / files per invocation — each with value, source, established, unknown; whether the repository establishes "one file per invocation" stated explicitly) | FR-001–004, FR-026 | SC-001 |
| 4 | Measurement protocol | see [measurement-protocol.md](./measurement-protocol.md) | FR-018–021, FR-023 | SC-012 |
| 5 | Cold-start line items | grammar, parser, Query init, first-file, warm-file, isolate-reuse assumption, init-included-in-CPU status | FR-009–011 | SC-003 |
| 6 | Processing-unit evaluation | all 5 shapes × accounting boundaries × the 8 canonical FR-006 criteria (budget fit is a derived conclusion, not a 9th criterion); oversize-file / fits-no-unit evaluation; ≤1 selected ONLY if budget X is established or waived AND FR-031/032/033 are shown, otherwise "no unit selectable yet" | FR-005–008 | SC-002 |
| 7 | Resource bounds (scale in four labeled tiers: measured scenario / configured limits / established upper bound / unknown; counts only — message, file, queue-operation and D1-operation counts — with no CPU-ms arithmetic drawn from the 300-file lifecycle/memory run) | max files/message, messages/invocation, work/invocation, enforcement; worst-case per-invocation work, queue ops/snapshot, D1 ops/snapshot vs free-tier, arithmetic shown | FR-008, FR-027 | SC-006 |
| 8 | Single-pass vs two-pass | side-by-side over FR-016 criteria; adopt/reject/defer; boundary impact | FR-015–017 | SC-004 |
| 9 | Query-cache decision | 4 distinctions (steady-state, cold cost, safe init/reuse, Feature 002 change?) + working-tree status | FR-012–014 | SC-005 |
| 10 | Resilience and determinism | per-shape re-execution on failure and its bound; duplicate-delivery equivalence; determinism across batch/order/cold-warm | FR-031–033 | SC-007–009 |
| 11 | Feature 001/002 regression impact | every affected behavior: unaffected or requires separately approved amendment | FR-034 | SC-010 |
| 12 | Live-measurement proposal | pointer to [live-experiment-proposal.md](./live-experiment-proposal.md) instance; marked NOT AUTHORIZED | FR-036 | SC-013 |
| 13 | Waiver status | "No waiver exists at this point in the workstream", or a link to an FR-038-compliant waiver; a later explicitly authorized waiver is recorded through Appendix C, never assumed | FR-029, FR-038 | SC-013 |
| 14 | Feature 004 T007 disposition | exactly one of STOPPED / REDEFINED / CLEARED (definitions below); conditions (a)–(e) each satisfied/unsatisfied/waived with evidence; evidence that would change it; FR-025 documentation re-verification date | FR-025, FR-028–030 | SC-011 |
| 15 | Amendment policy and list | amend Feature 004 in place after review; artifacts to amend; no replacement feature | FR-035, FR-037 | SC-013 |
| 16 | Open UNKNOWN register | every unresolved item carried forward | FR-025 | SC-001 |

## Disposition state definitions (section 14)
- **STOPPED**: at least one FR-028 condition (a)–(e) is unsatisfied and not validly waived, including any case where evidence remains insufficient. Default.
- **CLEARED**: the evidence conditions for the Feature 004 T007 gate are satisfied (or validly waived under FR-038). This is a *recommendation only*: the decision record itself does NOT clear Feature 004 T007 (FR-030). Effective clearance requires the appropriate reviewed Feature 004 amendment/process (FR-037).
- **REDEFINED**: the original Feature 004 T007 gate condition is no longer the correct gate because the architecture or execution model has materially changed (for example a different processing unit, single-pass adoption, or a different CPU accounting boundary) such that the original gate wording would test the wrong thing. The record states which change, why the original wording no longer applies, and the proposed replacement gate; the replacement takes effect only through a reviewed Feature 004 amendment.

## Appendix C — Revision log (required)
Each later reviewed change to the record (new evidence, a documentation change, an explicitly authorized waiver, a user-directed correction) is recorded as a dated revision entry: what changed, which sections and conditions are affected, the authorizing reference, and which tasks or checks were re-run. The initial version is revision R0. A revision never silently overwrites a prior disposition; it appends and re-states the disposition.

## Appendices
A = requirement traceability; B = success-criteria checklist result; C = revision log.

## Forbidden statements (review failure)
- "10 ms Queue CPU" (or any numeric limit) stated as fact without OFFICIAL-DOC or PLATFORM-TELEMETRY evidence for the queue-consumer path.
- Any LOCAL-WALLCLOCK figure used to assert compliance with, or violation of, a platform limit.
- Averaged cold and warm figures.
- Assuming one file per invocation, or warm-isolate amortization, without a cited justifying evidence id.
- Selecting a processing unit while the relevant CPU budget X is UNKNOWN and no valid waiver exists (a conditional budget is not a basis for selection); selecting a unit without shown idempotence (FR-032), determinism (FR-033) and bounded re-execution (FR-031); inventing a numeric budget; treating Workers Free HTTP 10 ms as the queue budget without authoritative evidence.
- Performing CPU arithmetic on, or drawing a CPU conclusion from, the 300-file sequential run (it recorded lifecycle/memory only).
- Hardcoding "no waiver exists" as permanent.
- Calling the 300-file scenario the production worst case without an enforced bound.
- Any statement or action by this workstream that *performs* an adoption, reversion, modification or removal of the Query-cache experiment, or describes one as already done. (Evaluating and *recommending* retain / revert / adopt-by-separate-approval is permitted and required by FR-014 and A3; any production change still requires separate approval.)
- Marking Feature 004 T007 cleared when any FR-028 condition is unsatisfied and un-waived.
- A waiver inferred from silence, generic "proceed", or local measurements.
- Any edit to Feature 001/002/004 artifacts by the record's production.

## Acceptance
All 16 sections present; each `sourced` field carries a citation or `UNKNOWN`; forbidden statements absent; SC-001..SC-013 checklist in [../quickstart.md](../quickstart.md) all pass.
