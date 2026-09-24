# RepoAtlas Master Roadmap

Status view derived from authoritative repository evidence (`specs/`, `docs/progress/PROGRESS.md`, decision records, implementation). This file is **not** a specification, task authority, safety authorization, or evidence repository. If this roadmap conflicts with an authoritative source, **correct this file**.

---

## Current Stage

**Current feature:** Feature 004 — Engineering Relationship Graph

**Current stage:** Phase 2 foundational work complete through CPU-feasibility gate (T001–T007); implementation paused at T008+ pending gate clearance

**Feature 006 (Settings / Control Plane):** COMPLETE (T001–T030 DONE), independent of the Feature 004 gate; not the current feature of this stage. T028 qualifications (two NOT VERIFIED items, NFR-004 narrow-width) are recorded in row 006.

**X/Y evidence (A4, 2026-09-24 17:09 +04:00):** X (Free Queue Consumer CPU limit) = CONTRADICTORY, Y (accounting unit) = PARTIAL; the 10 ms Free Queue Consumer value is NOT directly confirmed. T007 = STOPPED, LX-1 = NOT AUTHORIZED, FR-038 waiver = NOT ISSUED, T008+ = NOT AUTHORIZED. See `specs/004-…/research.md` Amendments A4.

**Blocking gate:** Feature 004 T007 CPU-feasibility gate remains **STOPPED / not cleared** (`specs/005-queue-cpu-feasibility-architecture/decision-record.md` §14.3, `docs/AGENT-GOVERNANCE.md` §12–§13). A checked `[X]` on Feature 004 `tasks.md` T007 is **not** authorization to proceed.

**Immediate next action:** Obtain explicit user instruction on one of: authorize live experiment `LX-1` (`specs/005-queue-cpu-feasibility-architecture/live-experiment-proposal.md`, `STATUS: NOT AUTHORIZED`), record a waiver per `contracts/waiver.md`, or amend Feature 004 in place after review (single-pass / unit architecture) — none of these may begin without authorization (`docs/progress/PROGRESS.md` Feature 005 T049 follow-ups).

**Session continuity:** resume from `docs/progress/PROGRESS.md` "Current State" and `docs/session_handoffs/CURRENT.md`; protocol in `docs/CONTEXT-PROTOCOL.md`.

**Open reconciliation findings:** six evidence/specification gaps found by the 2026-09-24 architecture investigation and T007 reconciliation review are listed under "T007 evidence and specification reconciliation" below. None is resolved; none amends a spec or changes T007.

**Last verified:** 2026-09-24 19:32 +04:00 (Feature 006 closeout: row 006 reconciled, no other status changed; earlier: 2026-09-24 16:58 +04:00 R6 identity decisions applied to F004 docs, no status change; earlier: R4/R6 design reconciliation; earlier: R3–R6 amendments applied; earlier: R3–R6 local investigation; earlier: Feature 005 T049 / STOP GATE S5; `docs/AGENT-GOVERNANCE.md` inventory date)

---

## Roadmap

| Seq | Workstream / Feature | Type | Status | Started | Completed | Dependencies | Blocker / Gate | Next Action | Last Updated |
|-----|------------------------|------|--------|---------|-----------|--------------|----------------|-------------|--------------|
| 001 | Feature 001 — Code Intelligence Foundation | Feature | COMPLETE | 2026-09-19 | 2026-09-20 | NONE | NONE | Maintain; live validation beyond recorded smoke is out of scope unless authorized | 2026-09-20 02:08 +04:00 |
| 002 | Feature 002 — AST + Symbol Intelligence | Feature | COMPLETE | 2026-09-20 04:15 +04:00 | 2026-09-21 | 001 | NONE | Optional: separate user approval to adopt working-tree Query-cache experiment (Feature 005 §9.3 RETAIN unadopted) | 2026-09-21 |
| 003 | Feature 003 — GitHub Source Enhancement | Feature | COMPLETE | 2026-09-20 14:50 +04:00 | 2026-09-21 | 001, 002 (UI/intel layering; not full 002 completion) | NONE | None required for roadmap scope | 2026-09-21 |
| 004 | Feature 005 — Queue CPU Feasibility Architecture | Feature | COMPLETE | 2026-09-23 | 2026-09-24 | 003, 004 (gate on 004 T007) | NONE | Downstream: does **not** clear Feature 004 T007; follow-ups are user-authorized only | 2026-09-24 |
| 005 | Feature 004 — Engineering Relationship Graph | Feature | BLOCKED | 2026-09-22 | UNKNOWN | 001, 002, 005 (decision record) | Feature 004 T007 CPU-feasibility gate STOPPED / not cleared | Do not start T008+ until gate cleared, redefined via governed amendment, or valid waiver | 2026-09-24 |
| 006 | Feature 006 — Settings / Control Plane | Feature | COMPLETE | UNKNOWN | 2026-09-24 | NONE blocking (`specs/006-…/spec.md` states no dependency on the Feature 004/005 gate) | NONE. T001–T030 DONE (per `docs/progress/PROGRESS.md`/`docs/claude_report/reports.md`; `specs/006-…/tasks.md` checkboxes are unchecked, see contradictions). T028 NOT VERIFIED: (1) absolute proof that preference changes never trigger an atlas-data refetch (none observed; the interception method cannot prove the universal negative); (2) LAN reachability (server bound to 127.0.0.1, no second device/context; not tested, exposure not changed). NFR-004 qualification: at 390×844 the page does not overflow but the configuration table scrolls ~50 px internally with third-column content clipped until scrolled; controls usable (neither PASS nor FAIL) | Awaiting user: review/commit, acceptance of the NOT VERIFIED items and the NFR-004 qualification. Feature 007 not started | 2026-09-24 19:32 +04:00 |
| 007 | Feature 007 — RepoAtlas MCP | Feature | NOT STARTED | UNKNOWN | UNKNOWN | 006 (control plane, COMPLETE), 005 (004 graph) | No `specs/007-*` artifacts; related planning only in `sdd/08-mcp-agent-interface/` | Create SpecKit feature when authorized | 2026-09-24 |
| 008 | Agent & Engineering Intelligence Governance (Stage 2) | Governance | COMPLETE | 2026-09-24 | 2026-09-24 | NONE | NONE | Keep `docs/AGENT-GOVERNANCE.md` aligned with authoritative sources | 2026-09-24 |
| 009 | Feature 009 — Repository Intelligence Visualization | Feature | NOT STARTED | UNKNOWN | UNKNOWN | Feature 001, 002 (structural intelligence); Feature 004 relationships integrated progressively, NOT a blocking dependency | No `specs/009-*` artifacts; no tasks defined | Create SpecKit feature when authorized; no spec folder present | 2026-09-24 19:42 +04:00 |

**Feature 009 note (roadmap point only; no spec, tasks or implementation):** when a user selects a single repository, provide a dedicated repository-level intelligence visualization instead of leaving them in the global Universe view: a RepoAtlas-native, Graphify-inspired model using dimensional marbles / vectorised particles / clustered dots for the repository's internal structure. Conceptual levels: L0 Universe (repository marbles); L1 Repository Intelligence (selected repository, modules/domains/directories, files); L2 Code Structure (modules, classes, interfaces, functions, methods, symbols); L3 Relationship/Execution (IMPORTS, CALLS, EXTENDS, IMPLEMENTS, USES, REFERENCES, future execution/process paths). Intended eventual capabilities: structural clusters, symbol particles, semantic node types, depth/spatial grouping, hover inspection, click/drill-down, camera transitions, breadcrumbs, zoom levels, filtering, relationship visibility, return to Universe, progressive/lazy expansion for large repositories. **Boundaries:** must not introduce a graph database; first implementation leverages existing Feature 001/002 structural intelligence; relationship visualization integrates with Feature 004 progressively once available (Feature 004 is BLOCKED at T007 and is not assumed complete); does not absorb Feature 007 (MCP) responsibilities. Sequencing after Feature 008 (Seq 009); existing Seq/Feature numbering unchanged.

**Source hints (not exhaustive; PROGRESS entries dated before T049 now live in `docs/progress/archive/PROGRESS-2026-09-19_to_2026-09-24.md`):** 001 — PROGRESS archive (2026-09-19–20 live smoke); 002 — `specs/002-ast-symbol-intelligence/tasks.md` (all tasks `[X]`), PROGRESS archive 2026-09-21; 003 — PROGRESS archive 2026-09-21 T027; 004 — `specs/005-…/decision-record.md` Appendix C R0, PROGRESS T049; 005 — `specs/004-…/tasks.md` T001–T007 `[X]`, T008+ `[ ]`, `research.md` §1 STOP; 006 — `specs/006-settings-control-plane/`, `docs/progress/PROGRESS.md` (Feature 006 entry), `docs/claude_report/reports.md`; 007 — absent `specs/007-*`, non-goals in Feature 002/004 specs; 008 — `docs/claude_report/reports.md`, `docs/AGENT-GOVERNANCE.md`.

**Numbering note (Seq vs Feature):** **Seq** is the roadmap order; **Feature NNN** is the spec-directory number. For two rows they differ and are not swapped: Seq 004 = Feature 005 — Queue CPU Feasibility Architecture (`specs/005-queue-cpu-feasibility-architecture/`) = COMPLETE; Seq 005 = Feature 004 — Engineering Relationship Graph (`specs/004-engineering-relationship-graph/`) = BLOCKED at T007. "Feature 004 T007" always means the Relationship Graph gate. The Dependencies column uses the repository's existing notation and, depending on the row, refers to either roadmap Seq numbers or established Feature IDs. A proposal to relabel them as Feature 004 = Queue CPU / Feature 005 = Relationship Graph was considered on 2026-09-24 19:35 +04:00 and not applied (user chose to keep spec-directory numbering). Seq 006 = Feature 006 — Settings / Control Plane (COMPLETE); Seq 007 = Feature 007 — RepoAtlas MCP (NOT STARTED).

**Feature 005 note:** Decision-workstream deliverable is complete (T001–T049, STOP GATE S5). Disposition for Feature 004 T007 is **STOPPED**; no unit selected; no waiver; no live Cloudflare operation (`decision-record.md` §6.4, §14.3).

**Recorded contradictions (roadmap follows governance / PROGRESS / decision record):**

- `specs/005-queue-cpu-feasibility-architecture/tasks.md` header still says **NOT STARTED** and checkboxes are unchecked; execution evidence is in the PROGRESS archive (T001–T048), `docs/progress/PROGRESS.md` (T049) and filled `decision-record.md`.
- `specs/006-settings-control-plane/tasks.md` shows T001–T030 all `[ ]` (0/30 checked) while PROGRESS/reports record T001–T030 DONE (T027–T029 per the user, T028 and T030 evidenced in `docs/claude_report/reports.md`); the roadmap follows PROGRESS/reports. Checkboxes not edited (spec artifact).
- `specs/004-engineering-relationship-graph/tasks.md` line 36 shows T007 `[X]` while Feature 005 disposition and `docs/AGENT-GOVERNANCE.md` require **T007 STOPPED** for implementation authority.
- `specs/004-engineering-relationship-graph/research.md` §1 states the 10 ms Workers Free limit "applies to queue-consumer invocations too"; `specs/005-…/decision-record.md` §3.4 (K4) records 10 ms only as an **unverified candidate for a different trigger**. Not reconciled.
- `specs/004-…/research.md` §1 and `feasibility-results.md` describe the T006 "large" fixtures as ~2,000 lines; `scripts/relationship-cpu-spike.ts` generates them with `repeatBlock(…, 700)` (one line per block, about 705 lines). Not reconciled.

---

## T007 evidence and specification reconciliation

Review of 2026-09-24. Analysis only: no spec, task, production file or T007 status was changed. Status labels follow `CLAUDE.md` (FACT / CONTRADICTION / UNKNOWN / INCOMPLETE).

| # | Finding | Status | Blocks F004 | Blocks F002 | Needs before acting |
|---|---------|--------|-------------|-------------|---------------------|
| R1 | X: applicable Free-plan Queue Consumer CPU limit | **CONTRADICTORY per A4 (`specs/004-engineering-relationship-graph/research.md` Amendments A4, Cloudflare documentation review 2026-09-24 17:09 +04:00); "10 ms CPU per invocation for a Free Queue Consumer" is NOT directly confirmed by authoritative Cloudflare documentation.** Earlier label UNKNOWN (with CONTRADICTION) is retained as history: (re-read 2026-09-24: no Free Queue-Consumer row; Queues Limits page defers to Workers account-plan limits but also states an unqualified 30 s default, a CONTRADICTION; not resolved); sources conflict (`decision-record.md` §3.4 K1/K2, U1) | Yes (gate conditions a, b) | No | Official raw-text statement naming Free plan + Queue Consumer + value; measurement against it needs authorized telemetry (LX-1 is not authorized and does not reveal the limit) |
| R2 | Y: CPU accounting unit for Free Queue Consumer | PARTIAL (unchanged; confirmed by A4, 2026-09-24 17:09 +04:00; re-read 2026-09-24: docs say "per invocation" / "per consumer Worker invocation"; whether one invocation = one delivered batch not stated on the three pages; not resolved) | Yes (a, b, d) | No | Official statement of the unit on Free; delivered messages per invocation from deployed data (not accessible now) |
| R3 | Local CPU measurements disagree | APPROVED 2026-09-24 16:46 +04:00 (decision B, wording/reclassification; applied in F004 `research.md` Amendments A1, `feasibility-results.md`, `tasks.md` T006 note, F005 decision-record notes). PARTIALLY RESOLVED 2026-09-24 (local run: parse-phase disagreement explained by AST node density, Java 0.23-0.24 us/node constant across shapes; T006 "~2,000 line" label still FACT-wrong; query phase, cold start and 820-vs-1025 tree count not re-tested) | Yes (T007 evidence base) | No | Reclassify (not discard) T006/E1/E2 as dense-shape worst case; query-phase and cold-start check if wanted; wording amendment after review |
| R4 | F004 assumes `symbols.is_exported` is populated; F002 always writes NULL | [2026-09-24 16:58 review: five stale unannotated D1-only EXPORTS statements remain (`research.md:46`, `tasks.md:49`, `tasks.md:127`, `plan.md:173`, `cpu-decomposition-results.md:7`); annotations proposed, not applied] APPROVED 2026-09-24 16:46 +04:00 (decision C: EXPORTS is parse-derived within F004; amendment recorded in F004 `research.md` Amendments A2 with annotations on T014/T018/T019/T020/T021/T022/T023, FR-001, `plan.md`, `data-model.md`; F002 not modified; EXPORTS not implemented; open design points listed in A2). CONFIRMED 2026-09-24 as CONTRADICTION (F004 premise vs F002 as built; F002 conforms to its own spec: `spec.md:208` MAY); all persisted `is_exported` are NULL, so EXPORTS is not derivable without new parse-derived data; export nodes exist in the grammar; mechanism decision still open | EXPORTS only (T018, T021) | No | F004 amendment decision: parse-derived, F002 population, or defer |
| R5 | `tree.delete()` not exception-safe in F002 `extractFile` | APPROVED 2026-09-24 16:46 +04:00 as a SEPARATE F002 REMEDIATION, implementation NOT authorized (see "Approved separate remediation" below). CONFIRMED 2026-09-24 by local failure injection (IR throw: 1 tree created, 0 deleted; success and hasError paths delete); no outer `finally`; WASM-abort threshold not re-tested | No | No (hygiene) | Separate approval for a fix; no fix made |
| R6 | `relationship_key` hashes D1 row ids, F002 renumbers ids on re-extraction | [2026-09-24 16:58: D-R6-1 (B+C, version not in key), D-R6-2 (F002 re-extraction makes affected relationships stale; mechanism left to F004 implementation) and D-R6-3 (key contract) APPROVED and recorded in F004 research.md A3 Resolution; implementation of the amended formula not authorized] APPROVED 2026-09-24 16:46 +04:00 (decision C: F004 amendment; key must not use row ids, symbol endpoints by `symbol_key`; recorded in F004 `research.md` Amendments A3 with annotations on FR-004/FR-009/SC-002, T005/T009/T013/T022/T023, `data-model.md`, `plan.md`; relationship persistence not implemented; FR-004 version-scope contradiction recorded, unresolved). CONFIRMED 2026-09-24 by local two-run test (same content and version: `symbol_key`s identical, symbol ids 1-3 became 4-6, relationship keys all changed, `file_extractions.id` stable); production trigger frequency UNKNOWN | Not T007; design before T013 | No | F004 identity-basis decision (ids vs `symbol_key`; target in or out of key) |

### Approved separate remediation (R5) — implementation NOT authorized

Recorded 2026-09-24 16:46 +04:00. **Not implemented; no Feature 002 production code changed.**
- **FACT**: `src/lib/code-intel/symbols/extraction-pipeline.ts` `extractFile` (`:131–152`) does not guarantee `tree.delete()` when `toIntermediateRepresentation()` throws (no `try/finally`; the `catch` at `:167` cannot reach the tree).
- **LOCAL MEASUREMENT** (failure injection, session scratchpad, no repo change): success 1 created / 1 deleted; `hasError` 1 created / 1 deleted; IR throws 1 created / **0 deleted**.
- **FACT**: existing tests do not verify deletion counts (`extraction-pipeline.test.ts` asserts only "does not throw").
- **DECISION (intended remediation)**: the parse-to-delete lifecycle should use exception-safe cleanup (`try/finally`), guarding a throwing `delete()`.
- **UNKNOWN**: whether an IR throw is reachable in production; how many leaked trees trigger the WASM `Aborted()` (T014 finding).
- **Status**: a separate Feature 002 remediation that needs its own implementation approval (005 decision record §11, §15). It does not affect T007. Feature 004's own pipeline (T023) should use exception-safe cleanup from the start (noted in F004 amendments).

---

## Dependency Flow

```text
Feature 001 — Code Intelligence Foundation
       ↓
Feature 002 — AST + Symbol Intelligence
       ↓
Feature 003 — GitHub Source Enhancement
       ↓
Feature 005 — Queue CPU Feasibility Architecture  (decision / evidence gate)
       ↓
Feature 004 — Engineering Relationship Graph  (BLOCKED at T007)
       ↓
Feature 006 — Settings / Control Plane  (COMPLETE; T001–T030 DONE, T028 qualifications recorded)
       ↓
Feature 007 — RepoAtlas MCP  (NOT STARTED; no spec yet)
```

This is a **dependency-oriented view**, not a blanket rule that every feature must be 100% complete before unrelated work can begin (`CLAUDE.md`, `docs/AGENT-GOVERNANCE.md` §12). Feature 003 proceeded while Feature 002 tasks were still open in an earlier session; readiness is task- and gate-driven.

---

## Status definitions

| Status | Meaning |
|--------|---------|
| NOT STARTED | Planned but execution has not begun |
| RESEARCH | Research/evidence gathering underway |
| SPECIFYING | Specification work underway |
| PLANNING | Implementation planning underway |
| READY | Prerequisites satisfied and execution can begin |
| IN PROGRESS | Active implementation/execution |
| BLOCKED | A prerequisite, safety gate, authorization, or evidence gap prevents progress |
| PARTIALLY COMPLETE | Some defined scope is complete, remaining scope exists |
| COMPLETE | Defined scope is complete and validated |
| DEFERRED | Intentionally postponed |
| CANCELLED | Explicitly discontinued |

---

## Roadmap maintenance rules

1. Inspect authoritative evidence before changing a row.
2. Update **Last Updated** only from evidence timestamps, not from edit time alone.
3. Preserve **Seq** numbers; do not renumber; use sub-sequences (e.g. 004.1) only when inserting historically between existing items.
4. Do not infer completion from ordering, directory presence, or unchecked task files alone.
5. Do not modify feature specs to match the roadmap.

---

## Roadmap change history

| Date | Change | Evidence |
|------|--------|----------|
| 2026-09-24 | Created canonical `docs/ROADMAP.md` with Features 001–007, governance row, dependency flow, Current Stage | `docs/progress/PROGRESS.md` (through T049), `specs/005-…/decision-record.md`, `specs/004-…/tasks.md`, `docs/AGENT-GOVERNANCE.md` |
| 2026-09-24 | Added open reconciliation findings R1–R6 and two recorded contradictions; no status row changed | `decision-record.md` §3.1–3.5, §16; `specs/004-…/research.md` §1–§2; `scripts/relationship-cpu-spike.ts`; `src/lib/code-intel/symbols/extraction-pipeline.ts`; `persistence/symbol-d1-client.ts`; `relationships/relationship-identity.ts`; `specs/002-…/spec.md:208` |
| 2026-09-24 | Corrected PROGRESS source pointers after the archive split (`docs/progress/archive/PROGRESS-2026-09-19_to_2026-09-24.md`); no status row changed | `docs/progress/PROGRESS.md`, `docs/progress/archive/PROGRESS-2026-09-19_to_2026-09-24.md` |
| 2026-09-24 | Added session-continuity pointer to Current Stage; no status row changed | `docs/CONTEXT-PROTOCOL.md`, `docs/session_handoffs/CURRENT.md`, `docs/progress/PROGRESS.md` "Current State" |
| 2026-09-24 16:42 +04:00 | Option 1 documentation-only raw-text re-read of Workers Pricing, Workers Limits, Queues Limits: R1 stays UNKNOWN/CONTRADICTION, R2 PARTIAL; no status row changed, T007 unchanged | developers.cloudflare.com `workers/platform/pricing` (updated Aug 28 2026), `workers/platform/limits` (Sep 5 2026), `queues/platform/limits` (Apr 21 2026); `docs/claude_report/reports.md` |
| 2026-09-24 16:42 +04:00 | R3-R6 local investigation: R3 PARTIALLY RESOLVED, R4/R5/R6 CONFIRMED; T007, X, Y, LX-1, waiver, F004 T008+ unchanged; no status row changed | `docs/claude_report/reports.md`; local experiments (scratchpad, outside repo) |
| 2026-09-24 16:46 +04:00 | Approved R3 (B), R4 (C), R6 (C) in place in F004/F005 documents; recorded R5 as separate F002 remediation (implementation NOT authorized). T007 STOPPED, X UNKNOWN, Y PARTIAL, LX-1 NOT AUTHORIZED, no waiver, T008+ NOT AUTHORIZED; no status row changed | F004 `research.md` Amendments A1–A3, `feasibility-results.md`, `tasks.md`, `spec.md`, `plan.md`, `data-model.md`; F005 `decision-record.md` §4d/§15 notes; `docs/claude_report/reports.md` |
| 2026-09-24 16:58 +04:00 | R4/R6 design reconciliation (documentation review only): R4 stale-statement list, R6 extractor-version ambiguity (D-R6-1) and FR-018 gap (D-R6-2) recorded; no spec/task/code change; T007 STOPPED, X UNKNOWN, Y PARTIAL, LX-1 NOT AUTHORIZED, no waiver, T008+ NOT AUTHORIZED; no status row changed | `docs/claude_report/reports.md`; F004 spec/data-model/research A2–A3/tasks/plan; `relationship-identity.ts`; `symbols/symbol-identity.ts`; F002 `spec.md:90` |
| 2026-09-24 16:58 +04:00 | Applied approved R6 decisions D-R6-1/2/3 to F004 docs (research.md A3 Resolution; spec FR-004/FR-018; data-model; plan; tasks T005/T013/T040 notes; contract scenario 5). R4 annotations not applied; R3/R5 unchanged; T007 STOPPED, X UNKNOWN, Y PARTIAL, LX-1 NOT AUTHORIZED, no waiver, T008+ NOT AUTHORIZED; no status row changed | `docs/claude_report/reports.md`; F004 specs |
| 2026-09-24 19:32 +04:00 | Feature 006 closeout: row 006 relabelled from "Feature 007" to Feature 006 — Settings / Control Plane and set COMPLETE (T001–T030 DONE, T028 NOT VERIFIED items and NFR-004 qualification recorded); row 007 relabelled Feature 007 — RepoAtlas MCP (NOT STARTED); Seq numbers preserved; Features 001–005, governance row, T007 STOPPED unchanged | `docs/progress/PROGRESS.md`, `docs/claude_report/reports.md`, `specs/006-settings-control-plane/` |
| 2026-09-24 19:35 +04:00 | Numbering clarification only: added Seq-vs-Feature note (Seq 004 = Feature 005 Queue CPU COMPLETE; Seq 005 = Feature 004 Relationship Graph BLOCKED at T007); no status row changed | `specs/004-…`, `specs/005-…` directory names; user decision to keep spec-directory numbering |
| 2026-09-24 19:42 +04:00 | Added Feature 009 — Repository Intelligence Visualization (Seq 009, NOT STARTED, roadmap point only: no spec, tasks or code); no existing row, Seq or Feature number changed | user instruction 2026-09-24; `docs/ROADMAP.md` only |
| 2026-09-24 20:07 +04:00 | Synchronized R1/R2 and Current Stage with Feature 004 amendment A4 (documentation review 2026-09-24 17:09 +04:00): X = CONTRADICTORY (was UNKNOWN with CONTRADICTION note), Y = PARTIAL; T007 STOPPED, LX-1 NOT AUTHORIZED, no waiver, T008+ NOT AUTHORIZED; no status row changed; R4/R5 unchanged | `specs/004-…/research.md` A4 |
