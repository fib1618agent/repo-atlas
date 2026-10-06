# RepoAtlas Master Roadmap

Status view derived from authoritative repository evidence (`specs/`, `docs/progress/PROGRESS.md`, decision records, implementation). This file is **not** a specification, task authority, safety authorization, or evidence repository. If this roadmap conflicts with an authoritative source, **correct this file**.

---

## Current Stage

**Current feature:** Feature 004 — Engineering Relationship Graph

**Current stage:** Phase 2 foundational work complete through CPU-feasibility gate (T001–T007); implementation paused at T008+ pending gate clearance

**Feature 006 (Settings / Control Plane):** COMPLETE (T001–T030 DONE), independent of the Feature 004 gate; not the current feature of this stage. T028 qualifications (two NOT VERIFIED items, NFR-004 narrow-width) are recorded in row 006.

**X/Y evidence (A4, 2026-09-24 17:09 +04:00):** X (Free Queue Consumer CPU limit) = CONTRADICTORY, Y (accounting unit) = PARTIAL; the 10 ms Free Queue Consumer value is NOT directly confirmed. T007 = STOPPED, LX-1 = NOT AUTHORIZED, FR-038 waiver = NOT ISSUED, T008+ = NOT AUTHORIZED. See `specs/004-…/research.md` Amendments A4.

**Final T007 decision (A5, 2026-09-24 20:34 +04:00): outcome B — NEEDS CONTROLLED CALIBRATION.** Cloudflare dossier reconciled: X = 10 ms CPU per invocation (documented chain), Y = active CPU per invocation, one invocation = one MessageBatch (WASM inclusion, retry timing, cold accounting still partial). FR-028: (a) SATISFIED; (b), (c), (d), (e) PARTIALLY SATISFIED. T007 remains STOPPED; calibration `T007-CAL-1` is defined only (`specs/004-…/t007-calibration-proposal.md`, NOT AUTHORIZED); no waiver; T008+ NOT AUTHORIZED. A4 wording above is historical. See `specs/004-…/research.md` Amendments A5.

**Architecture revision (2026-09-25 20:46 +04:00, user-approved, documentation only):** RepoAtlas adopted the **local-first architecture** — `docs/architecture/ADR-001-local-first-runtime.md` (decisions D-ARCH-1…6). Core runtime = local Atlas Engine on SQLite + filesystem with a local durable job engine; Cloudflare demoted to optional deployment adapter; Universe/Repository-Graph two-scope product model; nine-state repository lifecycle; deep-analysis capacity `ATLAS_MAX_DEEP_ANALYSIS_REPOS` = 5 (configurable), independent of catalogue/Universe visibility. Amendments applied: F004 research A6 + spec FR-012/assumptions + plan/tasks notes + `contracts/local-job-engine.md`; F005 decision-record §1 supersession note (historical evidence, preserved verbatim); F003 spec/data-model Amendment A1 + `contracts/repository-catalogue-lifecycle.md` (SPECIFIED, NOT IMPLEMENTED); F009 spec Amendment A1 (SPECIFIED, NOT IMPLEMENTED; perspectives gated on F004); AGENT-GOVERNANCE §12–13. No production code, F001/F002/F006 spec, schema or checkbox changed. The A4/A5 paragraphs above are historical.

**Blocking gate:** Feature 004 T007 is **redefined** (A6, D-ARCH-3) as **Local Relationship Engine Feasibility** — NOT STARTED / NOT AUTHORIZED. The former Cloudflare CPU gate (A5 outcome B, `decision-record.md` §14.3) is **SUPERSEDED, not satisfied**; `T007-CAL-1`/`LX-1` are historical (never run, authorizable on request). A checked `[X]` on Feature 004 `tasks.md` T007 is **not** authorization to proceed. **T008+ remain NOT AUTHORIZED** until the redefined T007 is executed and reviewed, or the user waives it by name.

**Immediate next action:** the redefined T007 is now **DEFINED** (planning pass 2026-09-25: `specs/004-…/t007-local-feasibility-plan.md`, `t007-local-feasibility-tasks.md` T007-L01–L14 with stop gates S-L1/S-L2, `checklists/t007-local-feasibility.md`). User authorization required to **execute** it, naming: the plan (`T007-LOCAL`), the [ENG] gate thresholds (G4–G8 numbers), the real-repository list beyond repo-atlas, and the reference environment (plan §14). Alternative next steps: planning passes for F003 Amendment A1 / F009 Amendment A1. Nothing begins without explicit instruction; no measurement has been run; T008+ NOT AUTHORIZED.

**T007 remediation Group A/C execution: RT-02, RT-05, RT-15 (2026-09-27):** Group B/D NOT touched. **RT-02 major finding**: F002 already has the exact stable symbol identity F004 needs (`computeSymbolKey`, deterministic, row-id-independent); the T007 resolver already carries it (`rel.ts` `Endpoint.ref`) but `persistRows` drops it, keeping only the volatile row id — **the fix is entirely within F004's own schema, zero F002 touch, hard-stop NOT triggered.** RT-05: drafted all 7 contract items; found the harness's 30,000ms lease constant was never actually tested (every test used 1500ms) — proposed contract default is 1500ms. RT-15: G9 wording finalized (B1–B6+minified scope) — **G9 remains FAIL**, RT-16 not performed. No code/threshold/dataset/`research.md`/F002 change; no benchmark; no checkboxes ticked. **G3=CONDITIONAL, G6=FAIL, G9=FAIL, T008=BLOCKED.** Log §22, `docs/claude_report/reports.md`.

**T007 remediation decision resolution (2026-09-27):** owner resolved D1 (symbol-identity stays in F004, F002 untouched, hard-stop escalation), D2 (PAUSED = explicit 8th state, full semantics specified, reclassified from documentation-only to harness-implementation), D3 (row-count-primary batching, per-file completion/containment non-negotiable, mandatory stop-and-amend if unpreservable), D4 (G9 narrowing direction approved, **G9 remains FAIL**), D5 (64KiB/512KiB approved, 3 stale-default doc locations left unedited per instruction), D6/D7 (G5/G8 unchanged). Next groups named (A/B/C/D), **none authorized**. No code/threshold/dataset/`research.md` change; no benchmark; no checkboxes ticked. **G3=CONDITIONAL, G6=FAIL, G9=FAIL, T008=BLOCKED.** Log §21, `docs/claude_report/reports.md`.

**T007 remediation SpecKit planning cycle (2026-09-27, K.1/K.2/K.3):** owner ratified S-L2; full ANALYSE→CHECKLIST cycle produced (`t007-remediation-speckit-plan.md`). G6's 62–68% persist share traced to source (`unit.ts:415`, one transaction per file); 13 requirements specified, 18 tasks planned (incl. gate-validation for G3/G6/G9), checklist has 2 unresolved + 2 conditional items, disclosed. No code/threshold/dataset/`research.md` change; no benchmark; no checkboxes ticked. **T008 remains blocked; no implementation authorization granted.** Log §20, `docs/claude_report/reports.md`.

**T007-LOCAL S-L2 checkpoint (2026-09-27, owner-review analysis):** `t007-s-l2-owner-review.md` produced. **T008 blocked on three independent grounds (G3 CONDITIONAL, G6 FAIL, G9 FAIL), not one.** Recommended (not invented) dispositions: G3 needs symbol-identity-stability + crash-reclaim-attempts remediation before T008 (5 other items non-blocking); **G6 needs remediation before T008, explicitly not conditional acceptance** (62–68% persist share, consistent across all 4 tiers); G8 accepted as tracked follow-up, not a blocker; G9 recommended for a criterion-narrowing amendment (remains FAIL until approved). File-size default 64 KiB / ceiling 512 KiB recommended, flagged as requiring an ADR-001/D-ARCH-6 amendment if accepted. Four SpecKit tracks named, none executed. No code/threshold/dataset/`research.md` change; no new benchmark; no checkboxes ticked. **T008 remains blocked.** Log §19, `docs/claude_report/reports.md`.

**T007-LOCAL L14 checkpoint (2026-09-27, gate evaluation):** G1–G9 scored. **G1=PASS, G2=PASS, G3=CONDITIONAL, G4=PASS, G5=CONDITIONAL, G6=FAIL, G7=PASS, G8=CONDITIONAL, G9=FAIL.** Headline: G6 persist-share 62–68% at c=2 across every tier — consistently exceeds the registered FAIL bound. **T008+ clearance is NOT reached per the plan's own clearance rule** (mandatory gates need PASS with no conditionals; G3=CONDITIONAL). Draft A7 amendment (`research-amendment-A7-draft.md`) proposes contract amendments + G6/G8 remediation directions; `research.md` untouched. No production code/threshold/dataset change, no new benchmark run. **S-L2 NOT started; T008+ NOT AUTHORIZED**; no checkboxes ticked. Log §18, `t007-local-gate-evaluation.md`, `docs/claude_report/reports.md`.

**T007-LOCAL L13 checkpoint (2026-09-27, evidence consolidation):** registered results artifact produced at `specs/004-…/t007-local-feasibility-results.md` (plan §10's path), consolidating M-L0–M-L7 with full caveat/deviation preservation and the plan §9 gate table left entirely "NOT EVALUATED." No new measurement, no code/threshold/dataset change. **M-L1–M-L7 COMPLETE; L13 COMPLETE.** L14/S-L2 NOT started; no gate evaluated; T008+ NOT AUTHORIZED; no checkboxes ticked. Log §17.

**T007-LOCAL M-L6 checkpoint (2026-09-27 18:41 +04:00):** incremental/no-change measured on repo-atlas-rm. INC-1 no-change re-run: 0 ms, FR-009 short-circuit, 100% reduction (3/3). INC-2/INC-3 (1 file / 24 files changed via a scratch git-clone commit): cost ≈ full baseline in both cases — no cross-snapshot incremental-reuse mechanism exists (disclosed, not new). **M-L1–M-L7 now all COMPLETE/characterized**; L13/L14/S-L2 NOT started; no gate evaluated; T008+ NOT AUTHORIZED; no checkboxes ticked. Log §16, `docs/claude_report/reports.md`.

**T007-LOCAL M-L5 R-S/R-L checkpoint (2026-09-27 18:32 +04:00):** M-L5 extended to R-S (repo-atlas `src/lib`) and R-L (GitNexus JS/TS; iata-one-order Java, JAXB-generated-classes caveat sharply confirmed — 0 relationship candidates). 18 cold runs, one graph hash per dataset at both concurrencies, 0 invariant violations, 0 retries/reclaims. **M-L5 now COMPLETE (R-M+R-S+R-L)**; M-L6/L13/L14/S-L2 NOT started; no gate evaluated; T008+ NOT AUTHORIZED; no checkboxes ticked. Log §15, `docs/claude_report/reports.md`.

**T007-LOCAL M-L7 checkpoint (2026-09-26 06:21 +04:00):** cold-start characterization measured and recorded (process-cold only); R-S/R-L/M-L6 NOT started; no gate evaluated; T008+ NOT AUTHORIZED; no checkboxes ticked. Log §14.

**T007-LOCAL M-L3 checkpoint (2026-09-26 05:52 +04:00):** SQLite characterization measured and recorded; B7/B8 accepted as documented; M-L6/M-L7/R-S/R-L NOT started; no gate evaluated; T008+ NOT AUTHORIZED; no checkboxes ticked. Log §13.

**T007-LOCAL M-L1/M-L2 checkpoint (2026-09-26 05:26 +04:00):** bands B1–B6 + real minified recorded; B7/B8 partial/stall evidence recorded (no summary file); M-L3 NOT started; no gate evaluated; T008+ NOT AUTHORIZED; no task checkboxes ticked. Log §12.

**T007-LOCAL M-L4 checkpoint (2026-09-26 03:45 +04:00):** M-L4 (jobs + failures, repo-atlas R-M) executed; measured results and classifications recorded, NO gate evaluated, owner decisions pending (report §N); T008+ NOT AUTHORIZED; no task checkboxes ticked.

**T007-LOCAL execution checkpoint (2026-09-25 22:55 +04:00):** execution AUTHORIZED by the owner and IN PROGRESS (Phase A harness built, S-L1 PASS 35/35, first R-M benchmark measured; no gate evaluated; T008+ NOT AUTHORIZED; S-L2 owner review pending; no task checkboxes ticked). Log: `specs/004-engineering-relationship-graph/t007-local-execution-log.md`.

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
| 005 | Feature 004 — Engineering Relationship Graph | Feature | BLOCKED | 2026-09-22 | UNKNOWN | 001, 002, 005 (historical evidence) | Redefined T007 (Local Relationship Engine Feasibility, research.md A6) NOT STARTED / NOT AUTHORIZED; former Cloudflare CPU gate SUPERSEDED (2026-09-25) | Do not start T008+ until redefined T007 executed and reviewed, or user waiver by name | 2026-09-25 20:46 +04:00 |
| 006 | Feature 006 — Settings / Control Plane | Feature | COMPLETE | UNKNOWN | 2026-09-24 | NONE blocking (`specs/006-…/spec.md` states no dependency on the Feature 004/005 gate) | NONE. T001–T030 DONE (per `docs/progress/PROGRESS.md`/`docs/claude_report/reports.md`; `specs/006-…/tasks.md` checkboxes are unchecked, see contradictions). T028 NOT VERIFIED: (1) absolute proof that preference changes never trigger an atlas-data refetch (none observed; the interception method cannot prove the universal negative); (2) LAN reachability (server bound to 127.0.0.1, no second device/context; not tested, exposure not changed). NFR-004 qualification: at 390×844 the page does not overflow but the configuration table scrolls ~50 px internally with third-column content clipped until scrolled; controls usable (neither PASS nor FAIL) | Awaiting user: review/commit, acceptance of the NOT VERIFIED items and the NFR-004 qualification. Feature 007 not started | 2026-09-24 19:32 +04:00 |
| 007 | Feature 007 — RepoAtlas MCP | Feature | NOT STARTED | UNKNOWN | UNKNOWN | 006 (control plane, COMPLETE), 005 (004 graph) | No `specs/007-*` artifacts; related planning only in `sdd/08-mcp-agent-interface/` | Create SpecKit feature when authorized | 2026-09-24 |
| 008 | Agent & Engineering Intelligence Governance (Stage 2) | Governance | COMPLETE | 2026-09-24 | 2026-09-24 | NONE | NONE | Keep `docs/AGENT-GOVERNANCE.md` aligned with authoritative sources | 2026-09-24 |
| 009 | Feature 009 — Repository Intelligence Visualization | Feature | PARTIALLY COMPLETE | 2026-09-24 | — | Feature 001, 002 (structural intelligence); Feature 004 relationships integrated progressively, NOT a blocking dependency | Closure open (not a code blocker): user review of evidence; T024/T025 not ticked (evidence gaps); `docs/claude_report/reports.md` not written (concurrent Feature 004 session owns it); uncommitted. Qualifications: SVG map nodes < 24 px at 390×844 (accessible outline twin is full size); AT-009-01 passes only with the sources-store hydration workaround (pre-existing bug, separate issue, not fixed here) | Owner review; write reports.md once safe; commit on user instruction (scope in `docs/session_handoffs/F009-repository-intelligence-visualization.md`) | 2026-09-24 23:15 +04:00 |

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
| R1 | X: applicable Free-plan Queue Consumer CPU limit | **UPDATE 2026-09-24 20:34 +04:00 (A5): X = 10 ms CPU per invocation by documented two-document chain plus `limits.cpu_ms` Standard-only; contradiction resolved as Paid-only reading. A4 text below is the dated historical state.** **CONTRADICTORY per A4 (`specs/004-engineering-relationship-graph/research.md` Amendments A4, Cloudflare documentation review 2026-09-24 17:09 +04:00); "10 ms CPU per invocation for a Free Queue Consumer" is NOT directly confirmed by authoritative Cloudflare documentation.** Earlier label UNKNOWN (with CONTRADICTION) is retained as history: (re-read 2026-09-24: no Free Queue-Consumer row; Queues Limits page defers to Workers account-plan limits but also states an unqualified 30 s default, a CONTRADICTION; not resolved); sources conflict (`decision-record.md` §3.4 K1/K2, U1) | Yes (gate conditions a, b) | No | Official raw-text statement naming Free plan + Queue Consumer + value; measurement against it needs authorized telemetry (LX-1 is not authorized and does not reveal the limit) |
| R2 | Y: CPU accounting unit for Free Queue Consumer | **UPDATE 2026-09-24 20:34 +04:00 (A5): one invocation = one MessageBatch; batch shares the 10 ms; WASM inclusion, retry timing and cold accounting still partial. Earlier text is historical.** PARTIAL (unchanged; confirmed by A4, 2026-09-24 17:09 +04:00; re-read 2026-09-24: docs say "per invocation" / "per consumer Worker invocation"; whether one invocation = one delivered batch not stated on the three pages; not resolved) | Yes (a, b, d) | No | Official statement of the unit on Free; delivered messages per invocation from deployed data (not accessible now) |
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
| 2026-09-24 20:34 +04:00 | Final T007 decision pass (A5): outcome B, needs controlled calibration; X = 10 ms documented chain, Y = per-invocation batch; FR-028 a SATISFIED, b/c/d/e PARTIAL; calibration T007-CAL-1 defined, NOT AUTHORIZED; T007 STOPPED, no waiver, T008+ NOT AUTHORIZED; status row unchanged (BLOCKED); Feature 005 record untouched | `specs/004-…/research.md` A5, `cloudflare-queue-cpu-dossier-2026-09-24.md`, `t007-calibration-proposal.md`, `docs/claude_report/reports.md` |
| 2026-09-24 20:44 +04:00 | Reviewed calibration proposal T007-CAL-1: verdict PROPOSAL NEEDS REVISION (six exact changes); no waiver needed for execution; no status row changed; T007 STOPPED, T007-CAL-1 NOT AUTHORIZED, T008+ NOT AUTHORIZED | `specs/004-…/t007-calibration-proposal.md`, `docs/claude_report/reports.md` |
| 2026-09-24 20:49 +04:00 | Applied six review revisions to T007-CAL-1 (R1); MINIMUM_USEFUL_B = 16 KiB pre-registered; 5/8 ms are owner-approval-required parameters; no status row changed; T007 STOPPED, T007-CAL-1 NOT AUTHORIZED, T008+ NOT AUTHORIZED | `specs/004-…/t007-calibration-proposal.md`, `docs/claude_report/reports.md` |
| 2026-09-24 23:15 +04:00 | Feature 009 row NOT STARTED → PARTIALLY COMPLETE: spec artifacts, implementation and tests exist (uncommitted); D1/D2/D3(a) confirmed by user; T026 gates PASS, T027 browser acceptance recorded with qualifications; closure items open (see row); no other row changed | `docs/session_handoffs/F009-repository-intelligence-visualization.md`, `specs/009-repository-intelligence-visualization/` |
| 2026-09-25 20:46 +04:00 | Architecture revision analysis pass (local-first platform prompt): conflicts C1–C10, proposed spec deltas, waves W0–W5, tasks AR-T01–AR-T12, open decisions D-ARCH-1…6 recorded in `docs/claude_report/reports.md`; **no status row, spec, task or gate changed**; T007 remains STOPPED under its existing definition; revision execution NOT AUTHORIZED pending user decisions | `docs/prompts/architecture-revisit/RepoAtlas_Complete_Architecture_Revision_Prompt.md`, `docs/claude_report/reports.md` |
| 2026-09-25 (revision execution) | User approved D-ARCH-1…6; documentation revision executed: ADR-001 created; F004 amendments (research A6, spec FR-012/assumptions, plan header note, tasks T007 redefinition note, `contracts/local-job-engine.md`, extract-relationships contract note); F005 decision-record §1 supersession note; F003 spec/data-model Amendment A1 + `contracts/repository-catalogue-lifecycle.md`; F009 spec Amendment A1; AGENT-GOVERNANCE §12–13; Current Stage + row 005 blocker wording updated (row status stays BLOCKED). Redefined T007 NOT STARTED / NOT AUTHORIZED; T008+ NOT AUTHORIZED; T007-CAL-1/LX-1 historical. No code, schema, F001/F002/F006 spec or checkbox changed; no commit/push | `docs/architecture/ADR-001-local-first-runtime.md`; F003/F004/F005/F009 spec artifacts; `docs/AGENT-GOVERNANCE.md`; `docs/claude_report/reports.md` |
| 2026-09-25 (T007 planning) | Redefined T007 planning pass: created `specs/004-…/t007-local-feasibility-plan.md` (LRF-01…16, measurement matrix M-L0…M-L7, gates G1–G9 with [ENG]-labeled thresholds, evidence artifact spec, Rust-repeat register, reference 4-point notes), `t007-local-feasibility-tasks.md` (T007-L01…L14, stop gates S-L1/S-L2, owner-approval parameters), `checklists/t007-local-feasibility.md` (16/16 PASS); research.md A6 addendum pointer; Current Stage next action updated. NO measurement executed; no harness/fixture created; no src/tests/schema/config change; T007 outcome unchanged; T008+ NOT AUTHORIZED; no commit/push | `specs/004-engineering-relationship-graph/t007-local-feasibility-{plan,tasks}.md`, `checklists/t007-local-feasibility.md`, `docs/claude_report/reports.md` |
