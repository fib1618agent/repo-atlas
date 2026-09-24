# Feature Specification: Queue CPU Feasibility and Processing-Unit Architecture

**Feature Branch**: `005-queue-cpu-feasibility-architecture`

**Created**: (session time)

**Status**: Specified, clarified (Session 1), planned, tasks generated, analysis-remediated. Specification/decision workstream only — documentation deliverable; no implementation, no deployment, no live operation. No Feature 005 task has been executed.

**Parent feature**: Feature 004 — Engineering Relationship Graph (`specs/004-engineering-relationship-graph/`). This specification defines the decision that must be made, and the evidence that must exist, before Feature 004 may proceed beyond its CPU feasibility gate (Feature 004 T007, currently STOPPED). It does **not** modify Feature 004's spec, plan, or tasks, and does **not** clear Feature 004 T007. It does not replace Feature 004: if the decision changes the architecture, the approved Feature 004 specification is amended in place after review (see Clarifications, FR-037).

**Input**: User description: "Create a Spec Kit specification for the next architectural decision for Feature 004 — Engineering Relationship Graph, titled 'Queue CPU Feasibility and Processing-Unit Architecture'. Specification/decision phase only. Define the requirements for establishing a defensible processing-unit architecture for Feature 004 under the actual Queue execution model, and determine what must be true before Feature 004 can proceed beyond Feature 004 T007. Required areas: CPU accounting model; processing-unit architecture; cold-start behavior; query caching (candidate, not automatic); single-pass extraction (candidate, not automatic); measurement requirements; Cloudflare evidence; Free-plan constraint (do not encode a 10 ms Queue CPU limit as fact unless evidenced); safety gate; non-goals; objective acceptance criteria."

## Clarifications

### Session 1

- Q: If authoritative platform CPU telemetry for the target Queue Consumer execution path cannot be obtained on the current Cloudflare plan, should Feature 004 T007 stay STOPPED or may a design-margin argument clear it? → A: Feature 004 T007 remains STOPPED by default. Proceeding without authoritative telemetry requires an explicit, recorded waiver from the user. This is the default safety behavior. (FR-029, FR-038)
- Q: Does this specification replace Feature 004, and if it results in an architectural change, is Feature 004 amended in place or superseded by a new relationship-graph feature? → A: Feature 005 is a decision/feasibility specification and does not replace Feature 004. If it results in an architectural change, the approved Feature 004 specification is amended in place rather than creating a replacement relationship-graph feature. Feature 004 is not modified now; this is the intended amendment policy, and any amendment follows review. (FR-035, FR-037)
- Q: Under what conditions may a future Cloudflare live measurement be performed? → A: Only after the exact experiment is documented and the user explicitly authorizes that specific live operation. No blanket authorization is granted by this clarification. The experiment must be minimal, reversible, limited to the required Worker/resources, documented before execution, and followed by cleanup/reversion where applicable. The existing local-first rule is preserved: no deployment, push, Wrangler, remote D1/R2/Queue modification, or live validation without explicit user authorization. (FR-036)

## Relationship to Prior Evidence

This specification is grounded in investigations already completed and recorded in the repository. Every figure below is **local wall-clock on a developer machine, not Cloudflare CPU time**, unless explicitly labeled as platform evidence. None of it proves compliance with any Cloudflare limit.

| ID | Evidence | Where recorded | What it does and does not establish |
|---|---|---|---|
| E1 | Feature 004's original CPU spike: two-pass extraction (Feature 002 parse for symbols, then a second parse for relationships) can exceed a 10 ms local wall-clock on larger files | `specs/004-engineering-relationship-graph/feasibility-results.md`, `research.md` §1 | Motivated the Feature 004 T007 STOP. Local proxy only. |
| E2 | Single-pass spike: one parse producing symbol and relationship observations is roughly 31-33% cheaper than the two-pass approach; parser reuse works; tree lifecycle validated (one delete per tree, no observed leak) | `docs/investigations/004-single-pass-architecture-spike.md`, `specs/004-engineering-relationship-graph/single-pass-spike-results.md` | Architectural *candidate*. Not approved. Crosses the current Feature 002 / Feature 004 boundary. |
| E3 | Decomposition: symbol-identity hashing is negligible; relationship observation is comparatively small; parsing is significant; Feature 002's per-call Query compilation was unexpectedly expensive | `specs/004-engineering-relationship-graph/combined-single-pass-decomposition-results.md` | Identifies where local time goes. |
| E4 | Query-cache experiment (Feature 002 scope): warm real-file single-pass medians improved approximately 6.70 to 1.79 ms (catalogue.tsx), 8.78 to 3.74 ms (AtlasScene.tsx), 7.85 to 2.71 ms (sidebar.tsx), 6.89 to 2.11 ms (symbol-d1-client.ts) | same file, "Post query-cache mitigation" section | Steady-state benefit only; warm-cache measurement. |
| E5 | Symbol-query compilation cost locally: Java about 0.79 ms, JavaScript about 1.06 ms, TypeScript about 4.36 ms, TSX about 4.75 ms (warm process); cold first-use compile was measured several times higher | `specs/002-ast-symbol-intelligence/query-cold-start-results.md` | Cost exists once per isolate per language if the cache holds; cold value is larger. |
| E6 | Cold-isolate investigation: first real TS/TSX file about 22-23 ms local (parse plus extraction) plus about 4.7 ms grammar/parser initialization; Java/JS about 8 ms plus about 4.4 ms; warm per-file about 0.8-1.5 ms median. Isolate reuse is not guaranteed by Cloudflare | same file | Cold cost is one-time per isolate/language, not per file; whether it is paid per invocation depends on unproven isolate reuse. |
| E7 | Cloudflare CPU documentation research: a queue consumer invocation receives one batch; queue billing is per message; the queue-specific CPU limit on the Workers Free plan is **not conclusively established** — three official pages give different or missing statements; the commonly cited 10 ms Workers Free limit cannot be treated as a proven queue-consumer gate | `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-research-report.md` | Governs what this specification may and may not assume. |
| E8 | Cloudflare observability research: Workers Trace Events documents `CPUTimeMs`/`WallTimeMs` and a `queue` event type but is delivered through Logpush, documented as Paid; Workers Logs / Query Builder cites `$workers.cpuTimeMs` as an example field and is documented as available, but queue-specific availability is **not established**; Queues metrics expose no CPU/duration; in-Worker timing cannot substitute for platform CPU; whether the platform CPU value includes startup/global/WASM initialization is unresolved | `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-observability-report.md` | Governs what evidence is obtainable. |

### Assumptions Explicitly Removed

The following statements were previously used, implicitly or explicitly, and are **not** assumed by this specification:

- "Workers Free enforces 10 ms CPU per queue-consumer invocation." (Not established; see E7.)
- "One file per unit means one file per invocation." (A queue consumer invocation receives a batch; the existing consumer pattern loops all messages of a batch inside one invocation.)
- "Feature 002's live validation proves the per-invocation shape is CPU-safe." (No CPU time was captured; validation inputs were small.)
- "A warm isolate will amortize initialization cost." (Isolate reuse is not guaranteed.)
- "Local wall-clock below (or above) 10 ms means safe (or unsafe) on Cloudflare." (Local wall-clock is a comparative proxy only.)
- "Worker-internal timing can verify platform CPU." (Documented as unreliable in production.)
- "Single-pass extraction is approved" and "query caching is required." (Both are candidates awaiting decision.)
- "Feature 004's 'no Feature 002 modification' boundary is permanent." (It is a constraint the decision must explicitly confirm or revise.)

## User Scenarios & Testing *(mandatory)*

The actors in this specification are the project owner/maintainer (who must approve any change of direction) and the engineers who will later plan and implement Feature 004. The "product" delivered by this specification is a reviewed, evidence-backed decision record, not code.

### User Story 1 - Establish the CPU accounting model (Priority: P1)

The maintainer needs to know exactly what is being budgeted: which unit the platform meters for CPU (whole invocation, batch, message, or file), what boundaries exist, and what the applicable limit is for the target execution path — without assuming the answer.

**Why this priority**: Every other decision (unit size, batching, single-pass vs two-pass) depends on what is metered. Deciding those first would encode unverified assumptions.

**Independent Test**: Review the decision record's CPU accounting section against the evidence catalogue; every accounting statement cites an authoritative source or is explicitly marked UNKNOWN, and the record states which boundary the CPU limit applies to for the target path or declares the question unresolved.

**Acceptance Scenarios**:

1. **Given** the reviewed Cloudflare documentation and observability evidence, **When** the CPU accounting model is written, **Then** it identifies the accounting unit, the invocation boundary, batch boundary, message boundary, and file-processing boundary, each with a source or an UNKNOWN marker.
2. **Given** conflicting or missing Cloudflare statements for the queue-consumer CPU limit, **When** the model is written, **Then** the conflict is reported, not reconciled, and no numeric limit is recorded as established unless authoritative evidence or an observed measurement establishes it.
3. **Given** a candidate limit that is only documented for a different trigger (for example an HTTP request), **When** it is considered for the queue-consumer path, **Then** it is recorded as an unverified candidate, not as the gate.

---

### User Story 2 - Define the evidence standard and required measurements (Priority: P1)

The maintainer needs a written standard for what counts as acceptable evidence for Feature 004 T007 — separating local wall-clock from platform CPU, cold from warm, and per-file from per-message, per-batch and full queue invocation — so that no future measurement is over-interpreted.

**Why this priority**: The prior investigations produced many numbers of different provenance. Without a standard, the gate could be cleared on the wrong kind of evidence.

**Independent Test**: For any proposed measurement, a reviewer can classify it against the standard as acceptable or not, and can tell what conclusion it may and may not support.

**Acceptance Scenarios**:

1. **Given** a local wall-clock measurement, **When** it is classified, **Then** it is labeled comparative only and cannot by itself clear the gate.
2. **Given** a platform-reported CPU measurement, **When** it is classified, **Then** the record states which invocation type, plan, cold/warm state, and unit (per-invocation, per-message, per-file) it covers and what it includes (startup, initialization, parse) or marks that UNKNOWN.
3. **Given** a measurement taken from inside the Worker using its own clock, **When** it is classified, **Then** it is not accepted as platform CPU evidence.

---

### User Story 3 - Choose a processing unit with an explicit CPU budget (Priority: P2)

The maintainer needs the Feature 004 processing unit (files per message, messages per invocation, total work per invocation) chosen deliberately, with an explicit CPU budget stated for the chosen unit and justified against the accounting model.

**Why this priority**: The unit is the design lever that bounds CPU. It can only be chosen after the accounting model and evidence standard exist.

**Independent Test**: The decision record lists each candidate unit shape, its implications for CPU, queue operations, D1 access, retry granularity and complexity, selects one (or states none can be defended yet), and states the numeric budget the selected unit must stay within with its basis.

**Acceptance Scenarios**:

1. **Given** the candidate shapes (one file per message; multiple files per message; multiple messages per invocation; bounded files per message; bounded total work per invocation), **When** they are evaluated, **Then** each is assessed for CPU exposure under each plausible accounting boundary from User Story 1, not under an assumed one.
2. **Given** a selected unit, **When** the record is reviewed, **Then** it states an explicit CPU budget for that unit, the margin applied, and the evidence the budget rests on.
3. **Given** unresolved accounting semantics, **When** a unit cannot be defended under all plausible boundaries, **Then** the record says so and records what evidence would resolve it, rather than selecting a unit anyway.

---

### User Story 4 - Decide single-pass vs two-pass and the Query-cache question (Priority: P2)

The maintainer needs a recorded comparison of the current two-pass architecture against the single-pass candidate, and a separate recorded decision on compiled-Query caching, each supported by evidence and each stating whether Feature 002 needs a separately approved change.

**Why this priority**: Both candidates change CPU materially but touch Feature 002, which is completed and production-validated. They must be judged, not adopted by momentum.

**Independent Test**: The decision record contains a like-for-like comparison of two-pass vs single-pass across CPU (cold and warm), queue and D1 amplification, R2 reads, failure/retry behavior, Feature 002 boundary impact and complexity, and a separate query-cache section distinguishing steady-state benefit from cold-isolate cost.

**Acceptance Scenarios**:

1. **Given** the local evidence, **When** single-pass is evaluated, **Then** it is compared against two-pass on the same criteria and its Feature 002 / Feature 004 boundary impact is stated explicitly; it is not approved by default.
2. **Given** the query-cache evidence, **When** it is evaluated, **Then** the record separates warm steady-state benefit, cold-isolate cost, and safe initialization/reuse, and states whether a separately approved Feature 002 change is required.
3. **Given** the cache is already present in the working tree from an experiment, **When** the decision is recorded, **Then** its status (kept, reverted, or formally adopted by separate approval) is stated, because it is not decided by the experiment itself.

---

### User Story 5 - Record the Feature 004 T007 disposition (Priority: P3)

The maintainer needs a final, explicit disposition of Feature 004 T007 — remains STOPPED, redefined, or cleared — with the criteria that produced it, so that Feature 004 implementation is never started on an implicit assumption.

**Why this priority**: It is the outcome of the previous stories; it can only be written last.

**Independent Test**: The record contains exactly one disposition, each safety-gate condition is marked satisfied / unsatisfied / defensibly waived with evidence, and Feature 004 T007 is not cleared unless all conditions hold.

**Acceptance Scenarios**:

1. **Given** any safety-gate condition unsatisfied, **When** the disposition is recorded, **Then** Feature 004 T007 remains STOPPED and the record lists what evidence would change that.
2. **Given** all conditions satisfied, **When** the disposition is recorded, **Then** it names which Feature 004 artifacts require amendment and states that amendment requires separate review before any plan or task change.

---

### Edge Cases

- Platform CPU telemetry turns out to be unavailable on the Workers Free plan for queue invocations: what then defends (or fails to defend) the gate?
- Platform CPU includes initialization for a cold invocation but excludes it for a warm one, or vice versa, or the documentation never says.
- The observed CPU limit for the queue-consumer path differs from the documented statements.
- The observed CPU of a real invocation varies run to run (tolerance for infrequent overruns vs consistent overruns); a single sample proves nothing.
- A batch is redelivered after a partial failure: work already done must not be duplicated or double-counted, and CPU per redelivery must be bounded.
- A single file is so large or complex that no unit shape keeps it within budget on its own.
- The evidence supports single-pass but the Feature 002 boundary cannot be changed without a Feature 002 amendment.
- Isolate reuse never occurs in practice, so every invocation pays cold cost.
- Documentation changes after this specification is reviewed.
- A live measurement is authorized but part of its change cannot be reverted, or cleanup fails: the record must state what remains changed and require explicit user direction before any further live action.
- A waiver of the telemetry default is granted and later evidence contradicts the reasoning it relied on: the waiver must be re-evaluated, and Feature 004 T007 returns to STOPPED until the owner confirms or withdraws it.

## Requirements *(mandatory)*

### Functional Requirements

**CPU accounting model**

- **FR-001**: The decision record MUST define the CPU accounting unit for the target execution path (Queue consumer on the project's Cloudflare plan) as one of: whole invocation, batch, message, file — or declare it UNKNOWN. It MUST NOT assume the answer.
- **FR-002**: The record MUST identify, for each of invocation boundary, batch boundary, message boundary, and file-processing boundary, the authoritative source that defines it, or mark it UNKNOWN.
- **FR-003**: The record MUST state whether CPU must be bounded per file, per message, or per invocation, or state that this cannot yet be determined and what evidence would determine it.
- **FR-004**: Where authoritative sources conflict or are silent on the queue-consumer CPU limit, the record MUST present each source and the contradiction and MUST NOT reconcile them by assumption.

**Processing-unit architecture**

- **FR-005**: The record MUST evaluate each of: one file per message; multiple files per message; multiple messages per invocation; bounded files per message; bounded total work per invocation.
- **FR-006**: Each evaluation MUST address CPU exposure under each plausible accounting boundary from FR-001, queue operation count, D1 read/write volume, R2 reads, retry granularity, duplicate-delivery impact, determinism, and implementation complexity. These eight are the canonical criteria. "Budget fit" is a *derived conclusion* (CPU exposure compared against the FR-007 budget condition) and is reported as such, not as a ninth criterion.
- **FR-007**: The record MUST require an explicit CPU budget for the chosen unit, with its numeric value, the margin applied, and the evidence basis. A unit without an evidence-backed budget MUST NOT be selected. A unit MAY be selected only when the relevant CPU budget X is (a) established by authoritative evidence, or (b) explicitly waived under FR-038. If X is UNKNOWN and no valid waiver exists, the outcome MUST be "no unit selectable yet". A conditional budget ("if X is established for unit Y, the unit must stay within X with margin M") is an analysis statement only and MUST NOT be treated as a basis for selection. In addition, a unit MUST NOT be selected unless FR-031 (bounded re-execution), FR-032 (idempotence) and FR-033 (determinism) are each shown for it; where the required evidence is UNKNOWN, that UNKNOWN is blocking.
- **FR-008**: The record MUST state the resulting bounds: maximum files per message, maximum messages per invocation, and maximum total work per invocation (or state which is unbounded and why that is acceptable), and how each bound is enforced. The record MUST also evaluate a file that exceeds the configured maximum (file size or unit size) and state explicitly what happens to a file that fits no currently considered processing unit.

**Cold-start behavior**

- **FR-009**: The record MUST separately account for grammar initialization, parser initialization, Query initialization, first-file parse, and warm-file processing, and for the uncertainty of isolate reuse.
- **FR-010**: The record MUST NOT assume warm-isolate amortization is guaranteed. The chosen unit MUST be justified for a cold invocation, or the record MUST state the specific evidence that justifies treating cold cost as amortized.
- **FR-011**: The record MUST state whether platform CPU includes initialization for cold invocations, or mark it UNKNOWN.

**Query caching**

- **FR-012**: Compiled-Query caching MUST be treated as an evidence-backed optimization candidate and MUST NOT be made a required implementation by this specification.
- **FR-013**: The decision record MUST distinguish (a) steady-state benefit, (b) cold-isolate cost still incurred, (c) whether the cache can be safely initialized and reused (keyed correctly, safe across isolate lifetimes, no stale/incorrect reuse), and (d) whether a separately approved Feature 002 change is required.
- **FR-014**: The record MUST state the status of the query-cache change that currently exists in the working tree from the earlier experiment (retain, revert, or adopt by separate approval).

**Single-pass extraction**

- **FR-015**: Single-pass extraction MUST be treated as an architectural candidate and MUST NOT be approved by this specification's existence.
- **FR-016**: The record MUST compare single-pass against the current two-pass architecture on: cold and warm CPU, queue operations, R2 reads, D1 volume, retry/idempotency behavior, memory/tree lifecycle, determinism, Feature 002 boundary impact (including Feature 004's current no-modification constraint), and complexity.
- **FR-017**: If single-pass is selected, the record MUST state which Feature 002 and Feature 004 artifacts would require amendment and MUST require a separate review before those artifacts are changed.

**Measurement requirements**

- **FR-018**: The specification MUST define required measurements, each labeled by basis: local wall-clock vs platform CPU; cold vs warm invocation; per-file, per-message, per-batch, and full queue invocation.
- **FR-019**: Local wall-clock measurements MUST be labeled comparative only and MUST NOT be used as proof of platform compliance in either direction.
- **FR-020**: A measurement's record MUST state its sample size, the statistic reported (median, tail), and its variability; a single sample MUST NOT establish a gate conclusion.
- **FR-021**: Cold and warm results MUST be reported separately, never averaged together.

**Cloudflare evidence**

- **FR-022**: Authoritative evidence for platform behavior MUST be current official Cloudflare documentation, recorded with page title, section, URL, and what it explicitly establishes.
- **FR-023**: Required runtime telemetry MUST be a platform-reported CPU measurement for the target execution path that identifies the invocation type, the outcome, and enough context to relate it to the unit (for example the known work in that invocation).
- **FR-024**: The record MUST state what cannot be inferred from local measurements: platform CPU-ms, the enforced limit, isolate reuse behavior, and what the platform CPU value includes.
- **FR-025**: Unresolved documentation questions MUST be carried forward as explicit UNKNOWN items; the record MUST NOT resolve them by assumption, and MUST re-verify documentation currency at decision time.

**Free-plan constraint**

- **FR-026**: The specification MUST NOT encode "10 ms Queue CPU" (or any numeric CPU limit) as an established fact unless evidence establishes it for the target execution path. It MUST instead require the documented or observed CPU constraint for that path to be recorded with its source.
- **FR-027**: The decision MUST respect the project's plan constraints (Workers Free; existing R2 subscription allowed; no additional paid Cloudflare services). A design that depends on a paid service MUST be reported as out of constraint, not silently adopted.

**Safety gate**

- **FR-028**: Feature 004 T007 MUST remain STOPPED until all of the following are satisfied or defensibly waived with recorded justification and owner approval: (a) CPU accounting semantics established sufficiently; (b) the processing unit defined with an explicit budget; (c) cold-start behavior understood sufficiently; (d) a bounded processing architecture exists; (e) required telemetry or validation is available, or the gate is otherwise defensibly established.
- **FR-029**: If authoritative platform CPU telemetry for the target Queue Consumer execution path cannot be obtained on the current Cloudflare plan, Feature 004 T007 MUST remain STOPPED by default. Proceeding without authoritative telemetry MUST require an explicit, recorded waiver from the user (see FR-038). A design-margin argument alone MUST NOT clear Feature 004 T007.
- **FR-030**: This specification, and any decision record derived from it, MUST NOT itself clear Feature 004 T007.

**Resilience and determinism (requirements the chosen architecture must be shown to satisfy)**

- **FR-031**: The decision record MUST show how the chosen unit behaves under failure and retry: what is re-executed, what is checkpointed, and that re-execution cost is itself bounded.
- **FR-032**: The record MUST show that duplicate delivery of a unit produces the same persisted result as a single delivery and does not amplify CPU without bound.
- **FR-033**: The record MUST show that extraction results are deterministic for a given snapshot, file content, extractor version, and unit definition, regardless of batch composition, message order, or isolate state (cold vs warm).

**Regression safety and governance**

- **FR-034**: The decision MUST state its impact on Feature 001 (snapshot acquisition/persistence) and Feature 002 (symbol extraction, grammar loading, symbol queries) and MUST identify any change requiring a separately approved amendment; existing behavior MUST NOT change without that approval.
- **FR-035**: This specification MUST NOT modify Feature 004's spec, plan, or tasks, or any Feature 001/002 artifact. Amendments, if any, follow review of this specification and are governed by FR-037.
- **FR-036**: No implementation, deployment, push, Wrangler invocation, remote Cloudflare access, remote D1/R2/Queue modification, or live validation is part of this specification, and none is authorized by it or by its clarifications; the local-first rule stands. Any future Cloudflare live measurement MUST be performed only after (a) the exact experiment is documented and (b) the user explicitly authorizes that specific live operation. No blanket authorization exists. The documented experiment MUST be minimal, reversible, limited to the required Worker/resources, documented before execution, and followed by cleanup/reversion where applicable; the record MUST state what was changed and what was reverted.
- **FR-037**: Feature 005 is a decision/feasibility specification and MUST NOT replace Feature 004. If the decision results in an architectural change, the approved Feature 004 specification MUST be amended in place, not superseded by a replacement relationship-graph feature. The amendment MUST NOT begin until this specification and the decision record have been reviewed, and this specification does not amend Feature 004 itself.
- **FR-038**: A waiver of the telemetry default (FR-029) MUST be an explicit, recorded user decision that names the specific gate condition being waived, the reasoning and evidence relied on, the residual risk accepted, and the conditions under which it is withdrawn. A waiver MUST NOT be inferred from silence, from a general instruction to proceed, or from local measurements.

### Non-Goals

Production implementation; Cloudflare deployment; live validation; Query Cache implementation; Feature 004 relationship implementation; impact analysis; process discovery; MCP; AI inference; graph database; any change to the eight approved Feature 004 relationship types or the five-state evidence model.

### Key Entities *(include if feature involves data)*

- **CPU Accounting Model**: The recorded answer to what unit the platform meters, where the invocation/batch/message/file boundaries lie, and what limit applies to the target path — each element sourced or marked UNKNOWN.
- **Evidence Record**: One item of evidence with its provenance class (official documentation, platform-reported telemetry, local wall-clock, repository behavior), its scope (what it covers), and its permitted conclusions.
- **Processing Unit Definition**: The chosen shape (files per message, messages per invocation, total work per invocation) plus its enforced bounds.
- **CPU Budget**: The numeric per-unit allowance, margin, and the evidence it rests on.
- **Candidate Architecture**: A compared option (two-pass current; single-pass; cached-Query variants) with its evaluation across the required criteria.
- **Measurement Protocol**: The definition of a required measurement (basis, cold/warm, unit, sample size, statistic).
- **Feature 004 T007 Disposition Record**: The single final disposition with the state of each safety-gate condition.

## Success Criteria *(mandatory)*

These are the objective acceptance criteria for the decision record. They are verifiable by document review; they do not require running any system.

### Measurable Outcomes

- **SC-001 (CPU model)**: The record contains an accounting section in which 100% of the boundary statements (unit, invocation, batch, message, file, applicable limit) each cite an authoritative source or carry an explicit UNKNOWN marker, and zero numeric limits are recorded as established without a cited source or observed measurement.
- **SC-002 (Processing unit)**: The record evaluates all five unit shapes in FR-005 against all criteria in FR-006, selects at most one, and gives the selected unit's explicit CPU budget, margin, and evidence basis — or states that none can yet be defended and why.
- **SC-003 (Cold-start handling)**: The record reports grammar, parser, Query initialization, first-file, and warm-file cost as separate line items, states the isolate-reuse assumption used (none guaranteed), and shows the chosen unit's justification for a cold invocation.
- **SC-004 (Single-pass vs two-pass)**: The record contains one side-by-side comparison covering every criterion in FR-016 and ends in one of: adopt, reject, or defer with the evidence that would decide it; the Feature 002 / 004 boundary impact is named.
- **SC-005 (Query-cache decision)**: The record contains a separate decision with the four distinctions in FR-013 and states the working-tree status required by FR-014; it declares whether a separately approved Feature 002 change is required.
- **SC-006 (Resource bounds)**: The record states the enforced maximums required by FR-008 and the resulting worst-case per-invocation work, queue operations per snapshot, and D1 operations per snapshot against the project's stated free-tier budgets, with the arithmetic shown.
- **SC-007 (Failure/retry)**: The record explains, per unit shape considered, what is re-executed on failure and shows that re-execution cost is bounded (FR-031).
- **SC-008 (Duplicate delivery)**: The record shows that duplicate delivery yields identical persisted state for the chosen unit (FR-032).
- **SC-009 (Deterministic behavior)**: The record shows result equivalence across batch composition, message order, and cold vs warm isolate for the chosen unit (FR-033).
- **SC-010 (Feature 001/002 regression safety)**: The record lists every Feature 001/002 behavior the decision could affect, each marked unaffected or requiring separately approved amendment; zero Feature 001/002 artifacts are modified by this specification.
- **SC-011 (Feature 004 T007 disposition)**: The record contains exactly one Feature 004 T007 disposition (remains STOPPED / redefined / cleared) and each condition in FR-028 is marked satisfied, unsatisfied, or defensibly waived (with owner approval reference). Feature 004 T007 is not marked cleared unless every condition is satisfied or approved-waived.
- **SC-013 (Governance)**: The record states the Feature 004 amendment policy (amend in place, no replacement feature, after review), and every live-measurement proposal it contains carries the documented-before-execution, minimal, reversible, resource-limited, cleanup-followed conditions of FR-036 and is marked as not authorized until the user authorizes that specific operation; any waiver referenced satisfies FR-038.
- **SC-012 (Evidence hygiene)**: 100% of Cloudflare behavior claims in the record carry documentation page title, section, and URL; 100% of measurements carry their basis label (local wall-clock vs platform CPU, cold vs warm, unit) and sample size.

## Assumptions

- The project's Cloudflare constraints remain: Workers Free, existing R2 subscription allowed, no additional paid services, Queues 10,000 operations/day, D1 within the stated free-tier limits. These are inputs to the decision, not outputs of it.
- The reviewed Cloudflare documentation is current only as of when it was read; FR-025 requires re-verification at decision time.
- Feature 002 remains completed and production-validated for its current scope; this specification does not reopen that validation.
- The eight Feature 004 relationship types, single-valued evidence-state model, EXPORTS-from-persisted-metadata design, and bounded D1 resolution are unchanged by this decision.
- A live platform measurement may ultimately be required (FR-023), but obtaining it is a separately authorized action outside this specification.
- The telemetry default (FR-029), amendment policy (FR-037), and live-measurement authorization conditions (FR-036) were confirmed in Clarifications Session 1; they are policy, not open questions.
- Clarification Session 1 grants no authorization for any live operation and does not amend Feature 004.
- Reading current official public Cloudflare documentation is research, not Cloudflare resource access (planning decision D-A1). FR-036 prohibits resource, API, dashboard, Wrangler, deployment and live access; it does not prohibit reading public documentation pages as documentation. Cloudflare MCP/API tools are not used for this purpose.
