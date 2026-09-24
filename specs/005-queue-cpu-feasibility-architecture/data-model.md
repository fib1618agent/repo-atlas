# Data Model: Decision-Record Entities

Not a database schema. These are the structured facts the decision record must contain. Entities come from the spec's Key Entities. Each field marked *sourced* must carry a citation or the literal token `UNKNOWN`.

## EvidenceRecord
| Field | Rule |
|---|---|
| id | `E<n>` (E1–E8 existing) or `N<n>` for new |
| provenance | enum: `OFFICIAL-DOC` \| `PLATFORM-TELEMETRY` \| `LOCAL-WALLCLOCK` \| `REPO-BEHAVIOR` |
| citation | OFFICIAL-DOC: page title + section + URL + what it explicitly establishes (FR-022). Others: file path |
| scope | invocation type, plan, cold/warm, unit (file/message/batch/invocation), what it includes (startup/init/parse) or `UNKNOWN` |
| sample | size, statistic (median/tail), variability (FR-020) — required for measurements |
| permitted_conclusions | what it may support |
| forbidden_conclusions | what it may not (e.g., LOCAL-WALLCLOCK: platform compliance) |
Validation: LOCAL-WALLCLOCK records MUST NOT be referenced by any "CPU-safe" or "limit is N" claim (FR-019, FR-024).

## CpuAccountingModel
Fields, each *sourced*: `accounting_unit` (invocation \| batch \| message \| file \| UNKNOWN), `invocation_boundary`, `batch_boundary`, `message_boundary`, `file_boundary`, `applicable_limit` {value or UNKNOWN, source, status: established \| unverified-candidate}, `bounding_requirement` (per-file \| per-message \| per-invocation \| undetermined + evidence needed), `source_conflicts[]` (each source + contradiction, unreconciled).
Validation: `applicable_limit.value` non-UNKNOWN requires OFFICIAL-DOC or PLATFORM-TELEMETRY evidence id (FR-026, SC-001).

## ProcessingUnitDefinition (one per candidate shape; one selected at most)
`shape` ∈ {one-file-per-message, multi-file-per-message, multi-message-per-invocation, bounded-files-per-message, bounded-total-work-per-invocation}; `max_files_per_message`, `max_messages_per_invocation`, `max_total_work_per_invocation` (or "unbounded: reason"), `bound_enforcement`; evaluation across the 8 canonical criteria × accounting boundary (CPU exposure, queue ops, D1 read/write volume, R2 reads, retry granularity, duplicate-delivery, determinism, implementation complexity); derived conclusion `budget_fit` (not a criterion); `oversize_file_outcome` (what happens to a file exceeding the configured maximum or fitting no considered unit); `selected: bool`.
Validation: `selected=true` requires ALL of: the relevant CPU budget X established by authoritative evidence or validly waived (FR-007/FR-038); idempotence shown (FR-032); determinism shown (FR-033); bounded re-execution shown (FR-031); cold-invocation justification (FR-010). Any UNKNOWN among these is blocking: the outcome is `no unit selectable yet`. A conditional budget alone never permits `selected=true`. At most one selected (SC-002).

## CpuBudget
`unit` (ref ProcessingUnitDefinition), `condition` ("if authoritative model establishes X for Y"), `limit` {value or UNKNOWN, source, status}, `margin`, `budget_ms` (null while limit UNKNOWN; never invented), `evidence_basis[]` (EvidenceRecord ids), `cold_case_justification` (FR-010), `waiver_ref` (optional).
Validation: `limit.value` MUST NOT default to the Workers Free HTTP 10 ms. The `condition` field is an analysis statement, not a selection basis: while `limit.value` is UNKNOWN and no `waiver_ref` exists, no unit may be selected. Cold-invocation case mandatory unless a specific evidence id justifies amortization.

## ColdStartBreakdown
Line items (each an EvidenceRecord ref, cold and warm separate): `grammar_init`, `parser_init`, `query_init`, `first_file`, `warm_file`; plus `isolate_reuse_assumption` (fixed: "none guaranteed") and `platform_cpu_includes_init` (UNKNOWN unless evidenced).

## CandidateArchitecture
`name` ∈ {two-pass-current, single-pass, cached-query variants}; evaluation over FR-016 criteria (cold/warm CPU, queue ops, R2 reads, D1 volume, retry/idempotency, memory/tree lifecycle, determinism, Feature 002 boundary impact, complexity); `verdict` ∈ {adopt, reject, defer}; `evidence_that_would_decide` (for defer); `amendments_required[]` (artifact paths); `separate_approval_required: bool`.
Query-cache sub-record: `steady_state_benefit`, `cold_cost_remaining`, `safe_init_reuse` (keying, isolate lifetime, staleness), `feature002_change_required`, `working_tree_status` ∈ {retain, revert, adopt-by-separate-approval}.

## MeasurementProtocol
`id`, `basis` (local-wallclock \| platform-cpu), `warmth` (cold \| warm — never merged), `unit` (file \| message \| batch \| full-invocation), `sample_size`, `statistic`, `variability`, `includes` (startup/init/parse or UNKNOWN), `status` (defined \| authorized \| executed), `authorization_ref` (required for status ≥ authorized when platform-cpu).
Validation: single sample cannot support a gate conclusion (FR-020).

## LiveExperimentProposal
`id`, `question_answered`, `resources_touched[]`, `steps[]`, `reversal_steps[]`, `cleanup_verification`, `documented_before_execution: true`, `minimal: true`, `authorization_status` (default `NOT AUTHORIZED`), `change_log` (what changed / what reverted — filled only post-execution), `on_cleanup_failure` (state remaining changes; halt for user direction).
Validation: any execution requires `authorization_status = AUTHORIZED` referencing that specific experiment id (FR-036).

## Waiver (exists only if user grants)
`gate_condition` (FR-028 letter), `reasoning`, `evidence_relied_on[]`, `residual_risk_accepted`, `withdrawal_conditions[]`, `granted_by`, `date`, `status` ∈ {active, withdrawn}; and, when the waiver touches the CPU budget: `assumed_cpu_budget_X` (value + unit, marked as an assumption), `safety_margin_M`, `selected_processing_unit` — all three required, otherwise the waiver is invalid for unit selection.
Validation: cannot be inferred from silence, general "proceed", or local measurements (FR-038). Contradicting later evidence ⇒ status returns to review and Feature 004 T007 returns to STOPPED (spec edge case).

## Feature004T007DispositionRecord
`disposition` ∈ {STOPPED, REDEFINED, CLEARED} (exactly one; definitions in `contracts/decision-record.md`: CLEARED is a recommendation that the evidence conditions are met and never itself clears Feature 004 T007; REDEFINED requires stated criteria — materially changed architecture/execution model, original gate wording no longer tests the right thing, proposed replacement gate); `conditions` {a..e: satisfied \| unsatisfied \| waived(waiver_ref)} with evidence; `evidence_that_would_change[]`; `feature004_amendments[]`; `amendment_policy_note` (amend in place after review).
Rule: `CLEARED` (recommendation) iff all of a–e ∈ {satisfied, waived}. `REDEFINED` iff the criteria above hold. Otherwise `STOPPED`. Fixed by FR-028–030; effective change of the Feature 004 gate only via a reviewed Feature 004 amendment (FR-037). Also holds `doc_reverification_date` (FR-025).

## Relationships
EvidenceRecord ← cited by → CpuAccountingModel, CpuBudget, ColdStartBreakdown, CandidateArchitecture, MeasurementProtocol.
CpuAccountingModel → constrains → ProcessingUnitDefinition → requires → CpuBudget.
MeasurementProtocol → specifies evidence for → LiveExperimentProposal → (optionally) yields → EvidenceRecord (PLATFORM-TELEMETRY).
Waiver → may satisfy → Feature004T007DispositionRecord.conditions.

## ScaleTiers (D-A5)
Four separately labeled inputs for resource-bound arithmetic: `measured_scenario`, `configured_limits`, `established_upper_bound` (or UNKNOWN), `unbounded_or_unknown`. A measured scenario MUST NOT be labeled the production worst case unless the repository enforces it as a bound.

## RecordRevision
`id` (R0 = initial), `date`, `trigger` (new evidence | documentation change | explicitly authorized waiver | user-directed correction), `sections_affected[]`, `conditions_affected[]`, `authorization_ref`, `checks_rerun[]`, `disposition_after`. Append-only; never overwrites a prior disposition (Appendix C of the decision record).

## RepoConsumerMapping (four rows)
Rows: (1) Queue configuration; (2) Consumer invocation / message batch; (3) RepoAtlas files-per-message configuration; (4) Files processed per invocation. Each row: `value`, `source` (file:line), `established` (what the code proves), `unknown` (what remains unknown). Plus `one_file_per_invocation_established: yes | no | unknown` with evidence. Values are taken from code only; Feature 004 planning language is recorded separately as a planning assumption, never as evidence. Row 4 is filled only if the code actually establishes it.

## ProtectedBaseline (three sets)
Set A ENFORCED (exact file list + SHA-256; additions, deletions, modifications all detected), Set B QUERY-CACHE (experiment files tracked separately: hashes plus a saved diff, with per-hunk classification from task T029), Set C UNRELATED (recorded, never enforced). Also stores git HEAD/branch, `git status --short`, timestamp, and the `bunx tsc --noEmit` baseline result.
