# Implementation Plan: Queue CPU Feasibility and Processing-Unit Architecture

**Branch**: `005-queue-cpu-feasibility-architecture` (Spec Kit feature id; working git branch is `feat/atlas-marble-interaction`, unchanged) | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-queue-cpu-feasibility-architecture/spec.md` (Clarifications Session 1 applied)

**Plan status**: APPROVED with decisions D-A1..D-A6 (2026-09-23), see "Approved Planning Decisions". Tasks generated (`tasks.md`, 49 tasks, none executed). `/speckit-analyze` run twice; both remediation passes (first: H1–H4, M1–M8, L-items; second: N1, M1–M3, L1–L6) applied to the artifacts as document-only passes. No task executed.

**Nature of this plan**: a *feasibility/decision* plan. Its deliverable is a reviewed, evidence-backed **decision record**, not code. It is NOT an implementation plan for Feature 004. It does not modify Feature 004, Feature 001/002/003 artifacts, or source code, and does not clear Feature 004 T007 (FR-030, FR-035).

## Summary

Feature 004's CPU feasibility gate (Feature 004 T007) is STOPPED. This plan sequences the document work needed to reach one of three Feature 004 T007 dispositions (remains STOPPED / redefined / cleared) defensibly: (1) catalogue existing evidence and record doc currency, (2) write the CPU accounting model with UNKNOWNs preserved, (3) fix the evidence standard and measurement protocol, (4) evaluate the five processing-unit shapes, single-pass vs two-pass, and the Query-cache question against that model, (5) draft — but not authorize or run — the minimal live-measurement proposal and waiver template, (6) record the single Feature 004 T007 disposition and the Feature 004 amendment list for review.

Technical approach: pure documentation/analysis over existing repository evidence (E1–E8). No new code. Any additional local measurement is optional, local-only, comparative-only (FR-019), and must be justified in the decision record before being run. All Cloudflare-side facts are either cited from official docs or carried as UNKNOWN.

Default expected outcome given current evidence (a forecast, not a decision): Feature 004 T007 remains STOPPED, because authoritative queue-consumer CPU telemetry is not established (FR-029) and no live operation is authorized (FR-036).

## Technical Context

**Language/Version**: N/A for deliverables (Markdown). Repository context: TypeScript on Bun, TanStack Start, Cloudflare Workers (Nitro preset). Documents only.

**Primary Dependencies**: None added. Inputs are existing repository artifacts (Feature 002/004 reports, Cloudflare research reports E7/E8) and official Cloudflare documentation.

**Storage**: N/A. Decision artifacts are Markdown files under `specs/005-queue-cpu-feasibility-architecture/`. No D1/R2/Queue access.

**Testing**: Document review against spec success criteria SC-001..SC-013 via the checklist in [quickstart.md](./quickstart.md). No test code. Optional local scripts (existing `scripts/relationship-*.ts`, `scripts/query-cold-start-experiment.ts`) may be re-read but running new ones is not required.

**Target Platform**: Cloudflare Workers Queue Consumer on the Workers Free plan (plan constraint FR-027) — the *subject* of the decision; nothing is deployed.

**Project Type**: Decision/feasibility workstream inside an existing web-service repo.

**Performance Goals**: Not applicable to deliverables. The decision must produce an explicit, evidence-backed per-unit CPU budget (FR-007) or state none is defensible yet.

**Constraints**: Local-first. No deploy, push, Wrangler, remote Cloudflare access, remote D1/R2/Queue change, or live validation (FR-036). No Feature 004 modification. No Query Cache or relationship-extraction implementation. Workers Free; existing R2 allowed; no new paid services (FR-027). Queues 10,000 ops/day.

**Scale/Scope**: 5 unit shapes × accounting boundaries × 8 canonical criteria ("budget fit" is derived, not a criterion); 2 architecture candidates; 1 cache decision; 1 disposition. Scale inputs are kept in four labeled tiers (see D-A5): measured stress scenario, configured limits, established production upper bound (if any), unknown/unbounded.

**Open items carried as UNKNOWN (not planning blockers; see research.md)**: Free-plan queue-consumer CPU limit; CPU accounting unit for queue consumers; CPU telemetry availability for queue invocations on Free; whether reported CPU includes startup/WASM init; isolate reuse guarantees.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design (below).*

Constitution v1.0.0 principles govern the atlas application. This feature ships no application code, so most principles are not engaged.

| Principle | Status | Note |
|---|---|---|
| I. Data Fidelity | Pass (applicable in spirit) | Evidence hygiene mirrors it: no invented limits or measurements; every claim sourced or UNKNOWN (FR-004, FR-022, FR-025, SC-001, SC-012). |
| II. Visualization-First | N/A | No scene/UI change. |
| III. Server-Side Secrets & Resilience | Pass | No secrets, no env vars, no remote access. Retry/duplicate-delivery resilience is a decision-record requirement (FR-031/032). |
| IV. Performance Budgets | Pass | Constitution caps untouched. Decision adds explicit per-unit CPU budgets only via the record. |
| V. Simplicity & Minimal Scope | Pass | Docs only; no speculative abstraction; no new dependencies; Feature 004 not touched; conventional-commit and no-history-rewrite rules honored. |
| Development Workflow | Pass | Spec Kit sequence followed: specify → clarify → plan; `/speckit-tasks` deliberately withheld pending user review. |

Additional project gates (from spec/user, not the constitution): Feature 004 T007 stays STOPPED (FR-028–030); amendments to Feature 004 in place after review only (FR-037); live operations need per-operation explicit authorization (FR-036); waiver must satisfy FR-038.

**Gate result**: PASS. No Complexity Tracking entries.

**Post-design re-check (after Phase 1)**: PASS. Design artifacts are Markdown templates/contracts only; no source, schema, config, or Feature 001–004 artifact is modified.

## Phases

Phases sequence the *decision workflow*. Each phase output is a section of one decision record (`decision-record.md`, produced when tasks are executed later) plus supporting artifacts. Nothing below is executed by `/speckit-plan`.

### Phase A — Evidence catalogue and documentation currency (offline)
- Build the Evidence Record table from E1–E8 with provenance class, scope, permitted conclusions.
- Re-verify each cited Cloudflare page's currency by reading **official public documentation** (FR-025; approved D-A1: research, not resource access); record title/section/URL/what-it-establishes/date read. Documentation is read as documentation only: WebFetch/WebSearch of public pages. Explicitly prohibited: Cloudflare MCP/API execution (including the Cloudflare MCP tools), the dashboard, Wrangler, remote D1/Queues/R2, deployments, and production/live validation.
- Re-verify again immediately before the final Feature 004 T007 disposition (FR-025 "at decision time").
- Carry forward the five UNKNOWNs verbatim unless a page now states them.
- Covers: FR-022, FR-024, FR-025, SC-012, US2.

### Phase B — CPU accounting model (US1, P1)
- Fill the CPU Accounting Model: unit, invocation/batch/message/file boundaries, applicable limit; each sourced or UNKNOWN.
- Present the three conflicting queue-CPU statements (Workers Limits, Workers Pricing, Queues Limits) without reconciling; record the HTTP/Cron 10 ms figure as an unverified candidate only.
- State per-file / per-message / per-invocation bounding requirement or what evidence would determine it.
- Covers: FR-001–004, FR-026, SC-001.

### Phase C — Evidence standard and measurement protocol (US2, P1)
- Define acceptability classes: platform-reported CPU (acceptable), local wall-clock (comparative only), in-Worker timers (not acceptable).
- Define measurement protocols: basis, cold/warm, unit (file/message/batch/invocation), sample size, statistic, variability; cold and warm never averaged.
- Covers: FR-018–021, FR-023, FR-024, SC-012.

### Phase D — Candidate evaluation (US3 + US4, P2)
- D1 Processing-unit: evaluate all five shapes (FR-005) against FR-006 criteria under *each* plausible accounting boundary; select at most one with budget/margin/basis, or state none defensible and what evidence resolves it (FR-007, FR-008). Budgets are **conditional only** (D-A4): "if the authoritative execution model establishes budget X for unit Y, the selected unit must stay within X with margin M". The conditional form is an analysis statement, never a selection basis: a unit may be selected only when X is established by authoritative evidence or explicitly waived (FR-038), and only if idempotence (FR-032), determinism (FR-033) and bounded re-execution (FR-031) are shown; otherwise the outcome is "no unit selectable yet", which is an acceptable outcome. UNKNOWN is blocking where required. The evaluation also covers a file exceeding the configured maximum and a file that fits no considered unit. The eight canonical FR-006 criteria are used; "budget fit" is a derived conclusion. No numeric budget is invented. Workers Free HTTP 10 ms is not treated as the Queue Consumer budget absent authoritative evidence. Includes resource-bound arithmetic against Queues 10k ops/day and D1 free-tier (SC-006), with scale in the four labeled tiers of D-A5. Arithmetic on the tiers uses counts only (messages, files, queue operations, D1 operations); the 300-file run recorded lifecycle/memory only and supports no CPU conclusion.
- D2 Cold-start: line items for grammar, parser, Query init, first-file, warm-file, isolate-reuse assumption = none guaranteed (FR-009–011, SC-003).
- D3 Single-pass vs two-pass: one side-by-side table over FR-016 criteria; adopt/reject/defer; name Feature 002/004 boundary impact and amendment list (FR-015–017, SC-004).
- D4 Query cache: separate decision with the four FR-013 distinctions and working-tree status (retain/revert/adopt-by-separate-approval) for the uncommitted experiment in `src/lib/code-intel/symbols/` (FR-012–014, SC-005). The experiment is left exactly as-is (D-A3): not adopted, reverted, modified, implemented, or removed by this workstream; any production change needs separate approval.
- D5 Resilience: retry re-execution bound, duplicate-delivery idempotency, determinism across batch/order/cold-warm (FR-031–033, SC-007–009).
- D6 Regression safety: list Feature 001/002 behaviors possibly affected, each unaffected or needing separately approved amendment (FR-034, SC-010).
- Additional local-only measurement (D-A2; no existing evidence/measurement script may be executed because each overwrites a protected Feature 002/004 results file — any measurement uses a new script under `evidence/local-measurements/` that writes only there, after a recorded write-side-effect check): allowed only when a specific planned step names a concrete evidence gap that no existing evidence (E1–E8) can fill; recorded before running, labeled LOCAL-WALLCLOCK/comparative (FR-019). No open-ended or exploratory benchmarking. Default: none.

### Phase E — Live-measurement proposal and waiver template (documentation only)
- Draft the smallest live experiment as a *proposal*, marked "NOT AUTHORIZED", satisfying FR-036 conditions (documented first, minimal, reversible, resource-limited, cleanup, change/revert log). See [contracts/live-experiment-proposal.md](./contracts/live-experiment-proposal.md).
- Provide the FR-038 waiver template; do not fill or assume one.
- Covers: FR-029, FR-036, FR-038, SC-013.

### Phase F — Feature 004 T007 disposition and amendment list (US5, P3)
- Mark each FR-028 condition (a)–(e) satisfied / unsatisfied / defensibly-waived with evidence.
- Record exactly one disposition; Feature 004 T007 is not cleared unless all conditions satisfied or owner-waived (SC-011).
- If a change is indicated, list Feature 004 (and any Feature 002) artifacts to amend in place; amendment itself is out of scope and requires review (FR-037, SC-013).
- Covers: FR-028–030, FR-035, FR-037, SC-011, SC-013.
- Disposition definitions (see `contracts/decision-record.md`): CLEARED = evidence conditions satisfied, a recommendation only, never itself clearing Feature 004 T007; REDEFINED = original gate condition no longer correct because the architecture/execution model materially changed; STOPPED = otherwise, including insufficient evidence. The record has an append-only revision log (Appendix C) so a later reviewed change, including an explicitly authorized waiver, can be represented; the record states "No waiver exists at this point in the workstream".

## Phase Dependencies

```
A ──► B ──► C ──► D1 ──► D2 ──► D3 ──► D4 ──► D5 ──► D6 ──► E ──► F
       └─(B,C)──────────────────────────────────────▲
```
- B depends on A (sourced facts). C depends on B (need accounting vocabulary). D1–D6 depend on B and C (evaluate under accounting boundaries using the evidence standard). D3/D4 depend on D2 (cold/warm line items). E depends on C (what telemetry is required) and D1 (what unit the measurement targets). F depends on all and on user review of E's outcome.
- External dependencies: current official Cloudflare public documentation (Phase A and the pre-disposition re-check); explicit user authorization for any live operation (Phase E gate). The plan-review precondition for `/speckit-tasks` has been met.

## Gates

| Gate | Condition | Phase affected | Default |
|---|---|---|---|
| G0 No-live-ops | No deploy/push/Wrangler/remote CF/D1/R2/Queue/live validation | All | Enforced by FR-036 |
| G1 Doc-read boundary | Official public docs may be read/re-verified (D-A1); nothing else on Cloudflare is touched | A | Permitted: docs only |
| G2 Live-operation authorization | Exact experiment documented + user authorizes that specific operation | E (execution, not drafting) | Not authorized |
| G3 Telemetry default | No authoritative platform CPU for target path ⇒ Feature 004 T007 STOPPED | F | STOPPED |
| G4 Waiver | Explicit user waiver per FR-038 | F | None exists |
| G5 Feature 004 amendment | Only after this decision record is reviewed; amend in place | Post-F | Not started |
| G6 Feature 002 change | Query cache / single-pass changes to Feature 002 need separate approval; current Query-cache experiment untouched (D-A3) | D3/D4 | Not approved |
| G7 Plan review | Plan approved with decisions (2026-09-23); tasks generated on explicit instruction | — | Met |
| G8 Local measurement | Only for a named evidence gap, documented first (D-A2) | D | None planned |

## Requirement Coverage

| Requirements | Phase | Primary artifact section | SC |
|---|---|---|---|
| FR-001–004 | B | decision-record §CPU Accounting Model | SC-001 |
| FR-005–008 | D1 | §Processing-Unit Evaluation, §Resource Bounds | SC-002, SC-006 |
| FR-009–011 | D2 | §Cold-Start Line Items | SC-003 |
| FR-012–014 | D4 | §Query-Cache Decision | SC-005 |
| FR-015–017 | D3 | §Single-Pass vs Two-Pass | SC-004 |
| FR-018–021 | C | §Measurement Protocol | SC-012 |
| FR-022–025 | A (+B, C) | §Evidence Catalogue | SC-012, SC-001 |
| FR-026–027 | B, D1 | §CPU Accounting Model, §Plan Constraints | SC-001, SC-006 |
| FR-028–030 | F | §Feature 004 T007 Disposition | SC-011 |
| FR-031–033 | D5 | §Resilience and Determinism | SC-007–009 |
| FR-034 | D6 | §Feature 001/002 Regression Impact | SC-010 |
| FR-035 | All | (negative constraint: no edits outside `specs/005/`) | SC-010 |
| FR-036 | E, G0/G2 | §Live-Measurement Proposal | SC-013 |
| FR-037 | F, G5 | §Amendment Policy and List | SC-013 |
| FR-038 | E, F, G4 | §Waiver | SC-013 |

All 38 FRs and 13 SCs map to a phase. User Stories: US1→B, US2→C(+A), US3→D1/D2, US4→D3/D4, US5→F.

## Decision Artifacts

Produced by this plan (design phase): `plan.md`, `research.md`, `data-model.md`, `contracts/*`, `quickstart.md`.

To be produced when tasks are later executed (not now):

| Artifact | Path | Purpose |
|---|---|---|
| Decision record | `specs/005-queue-cpu-feasibility-architecture/decision-record.md` | All sections in Phases A–F |
| Evidence catalogue | section within decision record, backed by `evidence/*.md` supporting files | Evidence Records, citations |
| Live-experiment proposal | `specs/005-queue-cpu-feasibility-architecture/live-experiment-proposal.md` | Marked NOT AUTHORIZED |
| Waiver record (only if user grants one) | `specs/005-queue-cpu-feasibility-architecture/waiver-<date>.md` | FR-038 |
| Feature 004 amendment list | section within decision record | Input to a separately reviewed amendment |

Post-decision, outside this feature: PROGRESS.md / audit-log / prompt-log entries per project practice.

## Project Structure

### Documentation (this feature)

```text
specs/005-queue-cpu-feasibility-architecture/
├── spec.md              # /speckit-specify + /speckit-clarify (done)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (decision-record entities)
├── quickstart.md        # Phase 1 output (review/validation guide)
├── contracts/           # Phase 1 output — CONTRACTS/TEMPLATES (not the deliverables)
│   ├── decision-record.md          # contract for the deliverable below
│   ├── measurement-protocol.md
│   ├── live-experiment-proposal.md # template for the proposal below
│   └── waiver.md                   # template; a waiver exists only if the user grants one
├── checklists/
│   └── requirements.md
├── tasks.md             # /speckit-tasks output (generated; no task executed)
│
│   (the entries below are DELIVERABLES created only when tasks run; they do not exist yet)
├── decision-record.md            # DELIVERABLE (16 sections + Appendix A/B/C)
├── live-experiment-proposal.md   # DELIVERABLE, stays NOT AUTHORIZED
└── evidence/                     # supporting evidence created by tasks
    ├── docs-workers-queues.md, docs-observability.md   # documentation research
    ├── repo-consumer-mapping.md                        # four-row consumer table (R2)
    ├── scale-tiers.md                                  # four scale tiers (R1)
    ├── README.md                                       # created by task T001
    ├── hunk-classification.md                          # dirty-hunk classification (task T029)
    ├── baseline/                                       # three-set protected baseline + tsc baseline (task T002)
    └── local-measurements/                             # only if a named evidence gap requires it: NEW script + write-check.md; no existing script is executed
```

### Source Code (repository root)

None. This feature changes no source, schema, config, script, or test. Existing `scripts/relationship-*.ts` and `scripts/query-cold-start-experiment.ts` are evidence inputs only.

**Structure Decision**: Documentation-only workstream confined to `specs/005-queue-cpu-feasibility-architecture/`. The uncommitted working-tree changes (query-cache experiment, Feature 004 scaffolding) are observed, not altered.

## Approved Planning Decisions (2026-09-23)

| ID | Decision | Effect on plan |
|---|---|---|
| D-A1 | Reading/re-verifying official public Cloudflare docs is research, allowed. Forbidden: Cloudflare API calls, dashboard/resource access, Wrangler, deploy, D1/R2/Queue mutation, live validation. | Phase A re-verifies currency; G1 relaxed to docs-only. |
| D-A2 | Additional local measurements only when a specific planned step names a concrete evidence gap; no exploratory benchmarking; prefer existing evidence. | Phase D rule + gate G8; none currently planned. |
| D-A3 | Leave the Query-cache experiment exactly as-is (no adopt/revert/modify/implement/remove). Decision record may evaluate retain/revert/adopt; production change needs separate approval. | Phase D4; G6. |
| D-A4 | No invented/assumed numeric CPU budget while queue-consumer CPU semantics are unresolved. Conditional budgets allowed; "no unit selectable yet" acceptable; HTTP 10 ms not the queue budget without authoritative evidence. | Phase D1; research.md R3; data-model CpuBudget. |
| D-A5 | 300-file figure is an established stress/evidence scenario, not the production worst case unless architecture establishes it as a bound. Distinguish four tiers (below). | Phase D1 resource-bound arithmetic; SC-006. |
| D-A6 | Keep plan-phase entries already in PROGRESS.md, audit-log, prompt log. | No change. |

### Scale tiers (D-A5) — as found in the repository, to be verified in Phase D1

| Tier | What it is | Current repo evidence |
|---|---|---|
| 1. Measured 300-file scenario | Existing 300-sequential-extraction local run (single-pass spike: tree lifecycle + memory, RSS ~+13 MB) in `specs/004-engineering-relationship-graph/single-pass-spike-results.md`; the "300" in the decomposition-sweep tables is a *symbols* column (300 symbols at 1500 lines), not a file count and not a 300-file run | Lifecycle/memory observations only (rss, heap, external, tree deletes; no timing recorded). It does NOT establish CPU time, CPU budget compliance, per-invocation CPU, or production worst-case CPU. |
| 2. Configured limits | Queue `max_batch_size = 10` (both consumers, `wrangler.toml`); `CODE_INTEL_EXTRACTION_BATCH_SIZE = 50` (`src/lib/code-intel/config.ts`); `CODE_INTEL_MAX_FILE_SIZE_BYTES` = 10 MiB | Config values only. Four quantities are kept distinct and recorded in the four-row consumer table (Queue configuration `max_batch_size`; consumer invocation/message batch; files-per-message configuration; files per invocation); the relationship between them is recorded only where the code establishes it, never inferred. |
| 3. Established production upper bound | Max files per snapshot / per source | Not established in the reviewed artifacts; treated as UNKNOWN unless Phase D1 finds an enforced repository cap. |
| 4. Unknown / unbounded | Anything above tiers 1–3 | Reported as such; no worst case asserted. |

Note: Feature 004 T073 (a planned exact-300-file simulation, unchecked in `tasks.md`) has not been run. It is not evidence and this plan does not treat it as one.

## Remaining Ambiguities

- **R1 — Tier 1 wording**: the existing 300-file run is the 300-sequential-extraction spike (lifecycle/memory only). No 300-file CPU-timing run exists; Feature 004 T073 is unrun. Resolved by the planned evidence work: task T007 (scale tiers) records exactly this and searches for an enforced production upper bound.
- **R2 — Batching quantities**: resolved by the planned evidence work in task T006, which produces a four-row table from the code (`wrangler.toml`, `plugins/cloudflare-symbol-queue.ts`, `src/lib/code-intel/symbols/symbol-worker.ts`, `src/lib/code-intel/config.ts`) and states whether the repository establishes "one file per invocation". Not assumed here.

Both are answered by document/code reading only; neither requires execution or Cloudflare access.

## Gate mapping: plan G-gates ↔ tasks S-gates
The plan's G-gates are policy gates; `tasks.md` S-gates are the execution checkpoints that enforce them.

| Plan gate | Tasks stop gate / enforcement |
|---|---|
| G0 No live operations | S0 (global) |
| G1 Documentation reads only (D-A1) | Documentation-research restrictions on T004, T005, T036, T039; S0 |
| G2 Live-operation authorization | S0; T037 stays NOT AUTHORIZED; S5 (follow-ups need explicit user instruction) |
| G3 Telemetry default | S1 (recorded yes/no result), T039–T040 |
| G4 Waiver | T027(a), T038; waiver contract; S5 |
| G5 Feature 004 amendment | T040–T041; S5 |
| G6 Feature 002 change | T031, T033; S4 (drift gate on Sets A and B) |
| G7 Plan review | Met (tasks generated) |
| G8 Local measurement only for a named gap | S2 (T018/T019), T018 late-gap rule |
| (baseline integrity) | S4 at T046 (Set A/B drift blocks T047–T049); S3 after T043 is a non-blocking presentation checkpoint |

## Cross-cutting: Protected-path baseline (three sets)
Established by the first setup task that touches evidence (task T002): Set A ENFORCED (exact file list + SHA-256; detects additions, deletions and modifications; roots: `specs/001-code-intelligence-foundation`, `specs/002*`, `specs/004*` and, as documentation-only protection, `specs/001-dynamic-github-sources` and `specs/003*` (their implementation files — atlas UI and GitHub-source data layer — are deliberately Set C), `src/lib/code-intel/**` excluding Set B files, `plugins/`, `nitro.config.ts`, `wrangler.toml`, `data/code-intel-schema.sql`, relevant `scripts/` and code-intel tests, `package.json`/`tsconfig.json`/`bun.lock`/`bunfig.toml`, `.specify/feature.json`); Set B QUERY-CACHE (experiment files tracked separately: hashes, saved diff, hunk classification); Set C UNRELATED (UI routes, generated route tree, other working-tree state — recorded, never enforced). It also stores the `bunx tsc --noEmit` baseline result so the final check compares against it. `shasum -c` alone is not used because it cannot detect added files. Untracked files are listed via `git ls-files --others --exclude-standard`, hashed, and diffed with `git diff --no-index -- /dev/null <file>` (plain `git diff` shows nothing for them). Nothing is cleaned, reset, stashed or committed.

## Complexity Tracking

No constitution violations. Not applicable.
