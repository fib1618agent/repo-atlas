# Feature 004 T007 — Evidence and Specification Reconciliation (R1–R6)

**Record type:** historical investigation evidence. It is **not** current project state (see `docs/progress/PROGRESS.md` "Current State").
**Date:** 2026-09-24 · **Branch:** `feat/atlas-marble-interaction` · **HEAD:** `c576310` (working tree dirty; pre-existing changes)
**Nature:** analysis and specification review only. No spec, task, production file or T007 status was changed. No live experiment, no Cloudflare access, no commit. The only file written by that task was `docs/ROADMAP.md` (findings table R1–R6).
**Companion record:** `docs/investigations/2026-09-24-f002-f004-parse-boundary-investigation.md` (the earlier parse-boundary investigation that surfaced these gaps).
**Labels:** FACT · UNKNOWN · CONTRADICTION · INCOMPLETE · INFERENCE. Timings are local wall-clock (Bun) and are comparative only; they are not Cloudflare CPU. No CPU budget is selected anywhere in this record.

---

## 1. Evidence reconciliation table

| # | Finding | Label | Blocks F004 | Blocks F002 | Spec amendment | Architecture decision | Production-code fix |
|---|---|---|---|---|---|---|---|
| R1 (X) | Applicable Free-plan Queue Consumer CPU limit not established | UNKNOWN, with CONTRADICTION among sources | Yes (FR-028 a, b) | No | See §2 | Yes, downstream (unit selection) | No |
| R2 (Y) | CPU accounting unit for Free Queue Consumer not established | UNKNOWN (Standard only: invocation; U2 PARTIAL) | Yes (a, b, d) | No | No | Yes, downstream | No |
| R3 | Local CPU measurements disagree; T006 fixture mislabeled | CONTRADICTION + FACT (mislabel) + INCOMPLETE (bytes and node counts not recorded) | Yes (T007 evidence base) | No | Yes: correct "~2,000 lines" wording | No | No |
| R4 | F004 assumes `symbols.is_exported` is populated; F002 always writes NULL | CONTRADICTION (F004 premise vs F002 as built; F002 conforms to its own spec) | EXPORTS only (T018, T021) | No | Yes (F004) | Yes | Not before the decision |
| R5 | `tree.delete()` not exception-safe in `extractFile` | FACT (structure); reachability UNKNOWN | No | No (hygiene) | No | No | Candidate; needs its own approval (005 §11) |
| R6 | `relationship_key` hashes D1 row ids that F002 renumbers on re-extraction | FACT (dependency); practical frequency UNKNOWN | Not the T007 gate; must be settled before T013, T022, T023 | No | Yes (F004 FR-004 / data-model wording) | Minor: identity basis | No (F004 scaffolding only) |

## 2. R1 and R2: X (limit) and Y (accounting unit)

**Sources (FACT unless stated).** `specs/005-queue-cpu-feasibility-architecture/decision-record.md` §3.1, §3.4 (K1, K2, K3, K4), §3.5, §14, §16 (U1, U2), and `evidence/docs-workers-queues.md`.

- Workers Pricing, Free row: "10 milliseconds of CPU time per invocation", not qualified by invocation type (S-d).
- Workers Limits, Free: rows for HTTP request and Cron Trigger only; no Queue-consumer row returned (S-a). Absence in an extraction is UNVERIFIED, not proof of absence.
- Queues Limits: "Consumer CPU time | Configurable to 5 minutes", stated to apply to both Workers Paid and Workers Free (S-g, S-h). The Paid-only label for the setting is the extraction's wording, not a quote (S-b).
- Standard/Paid Pricing: "15 minutes … per Cron Trigger or Queue Consumer invocation" and "5 minutes … per invocation (default: 30 seconds)". K1 is unresolved; neither figure is a Free value.
- The unit is stated only for Standard: the invocation (S-e). No Free statement (K3).
- Repository side: one `queue()` call dispatches the whole batch to the hook, which loops over up to 10 messages of up to 50 files each (`plugins/cloudflare-symbol-queue.ts:20-44`, `wrangler.toml:31-43`, `symbol-worker.ts:113-132`). Delivered batch size and page fill are UNKNOWN; whether `waitUntil`-attached work counts toward CPU is UNKNOWN.

**CONTRADICTIONS recorded.** (a) F004 `research.md` §1 states the 10 ms limit "applies to queue-consumer invocations too" and that no Free exception exists; the decision record (K4) records 10 ms only as an unverified candidate for a different trigger. (b) K1 and K2 among the Cloudflare pages.

**What follows (not a selection).** No CPU budget was selected and none may be inferred from local wall-clock, HTTP/Cron figures, Standard figures, wall-time limits or app configuration. F002's live success on 33 files gives an unmeasured CPU figure and an unknown message count per invocation, so it cannot bound X (INCOMPLETE).

**Missing authoritative evidence.** (1) An official statement naming the Free plan, the Queue Consumer path, a limit value and its unit. (2) Whether reported CPU includes startup and initialization (U4), telemetry availability on Free (U3), and isolate reuse (U5). (3) Delivered batch size and page fill from deployed data (not accessible without Cloudflare).

**Can documentation resolve X and Y?** Partly. A raw-text read of the Workers Pricing and Limits tables and the Queues Limits footnote could state X and Y for Free if the pages do so; the earlier reads were extraction-based (K1, K2). Documentation cannot show U3, U4 or U5, and Cloudflare's own text says isolates get "built-in flexibility" over the limit, so a documented limit does not establish safe operation. **Live telemetry (`LX-1`, `specs/005-…/live-experiment-proposal.md`, `STATUS: NOT AUTHORIZED`)** would show whether CPU is reported for a queue invocation and what it covers (U3, U4, M5/M6); it would not reveal the limit value. The limit value therefore needs documentation (or a waiver naming X, M and the unit), while measurement against it needs telemetry.

**Gate impact.** FR-028 conditions (a), (b), (c), (d), (e) are all unsatisfied, no waiver exists (`decision-record.md` §13, §14.2). T007 remains STOPPED.

## 3. R3: contradictory local measurements

**Sources.** `feasibility-results.md` (T006, E1), `cpu-decomposition-results.md`, `single-pass-spike-results.md` (E2), `combined-single-pass-decomposition-results.md` (E3), scripts `scripts/relationship-{cpu-spike,cpu-decomposition,single-pass-spike,combined-single-pass-decomposition}.ts`, `decision-record.md` §4d.

**Findings.**

1. **The T006 "large ~2,000 lines" label is wrong for its own fixture (FACT).** `scripts/relationship-cpu-spike.ts` builds each large fixture with `repeatBlock(…, 700)`, one line per block, so it is about 705 lines of call-dense code (three calls per single-line method). The "~2,000" wording is in F004 `research.md` §1, `feasibility-results.md` and T006.
2. **Three of four sets agree once line counts are corrected.** T006 java large median 9.482 ms at about 705 lines; E2 java B-scenario at 750 lines 9.515 ms median; the decomposition set's parse+query at 750 lines about 10 ms. All use the call-dense shape.
3. **E3 disagrees and was not averaged in.** At 750 lines, java, parse is 1.384 ms in E3 against 6.872 ms p95 in the decomposition (about 5x). E3's "ordinary" shape is a variable, an `if` and one call per line. Bytes per line are similar; node density was never recorded, so a shape explanation is possible but unverified and the residual gap is UNKNOWN.
4. **Other incomparabilities (FACT).** T006 has no warm-up, the others use 5. The decomposition script uses `new Parser()`, the others production `getParser`. The scripts were authored between 01:05 and 01:52 on the same night, so machine state is a possible factor (UNVERIFIED). The 820-vs-1025 tree-count inconsistency (005 E3 note) is unreconciled.
5. **T007's "likely unsafe" is a local threshold classification** (<3 / 3–8 / >8 ms). It is not a statement about any Cloudflare limit (`decision-record.md` §4a). The STOP follows F004's own T007 rule, not evidence that the fixture is unsafe on Cloudflare.

**Minimum controlled local experiment (proposed only; not run).**

- **Question:** does parse time per byte and per node differ between the dense and ordinary shapes, and is the difference stable across processes and over time?
- **Design:** one new script outside production, using production `getParser`, no D1/R2/network. Both shape families for all four languages at matched bytes and matched line counts. Record bytes, lines, `rootNode.descendantCount` and call-expression count; assert `hasError` is false. Time parse alone and query alone separately, query compiled outside the timed region, `tree.delete()` outside it. At least 30 timed iterations after 10 warm-up iterations; report median, p95 and max, per byte and per node. Three fresh processes with the family order swapped (ABBA), plus a fixed trivial-parse control before, between and after each run to detect drift. Record Bun version and machine load.
- **Rules:** cold and warm reported separately, never averaged. Per 005 T019 (late-gap procedure), document the question, script and write-side-effect check first and tell the user before running.
- **Outcome:** if per-node cost matches across shapes and the control is flat, the contradiction is a shape difference; if not, it stays a CONTRADICTION.

**Required amendment (proposed).** Correct the "~2,000 lines" wording in F004 `research.md` §1, `feasibility-results.md` and T006 after review.

## 4. R4: EXPORTS versus F002's `is_exported`

**Sources.** F004 `research.md` §2 line 40, `plan.md:78`, `tasks.md` T018 and T021; F002 `spec.md:208`, `contracts/d1-schema-additions.sql:42`, `contracts/symbol-query.functions.md:58`; `symbol-d1-client.ts:191` (literal `NULL`); `SymbolIR` (no field); `src/lib/code-intel/symbols/queries/*.scm` (zero "export" matches in all four); `tests/contract/symbols/symbol-provenance.test.ts:48`; `relationships/queries/{java,javascript}.scm` comments.

**Assessment.** CONTRADICTION between F004's premise and F002 as built. F002 conforms to its own spec (`spec.md:208`: export status "MAY be recorded" where directly observable). Not an F002 defect.

**Affected.** EXPORTS relationship only (T018, T021, T019 comment, `plan.md` §5). The other seven relationship types are unaffected. Blocks F004: partially. Blocks F002: no.

**Decision needed (architecture).** Where export observation lives: parse-derived captures in F004 (EXPORTS then stops being D1-only and adds parse work per file), F002-side population (an F002 change, a `SYMBOL_EXTRACTOR_VERSION` bump from `v2`, and a conflict with F004 FR-017), or defer EXPORTS. Java has no export keyword; T018 already anticipates asserting zero Java EXPORTS.

**Evidence needed before acting.** A per-language definition of "exported" (TS `export_statement`, `export default`, re-exports, CommonJS `module.exports`, Java visibility) and fixtures for each.

## 5. R5: `tree.delete()` exception safety

**Sources.** `extraction-pipeline.ts:131-152` (delete after `toIntermediateRepresentation` returns; no `try/finally`; only the `hasError` branch deletes before throwing); `:167` catch cannot reach the tree; F002 `research.md:61` (T014: delete immediately after extraction, undeleted trees caused a WASM `Aborted()` runtime error).

**Assessment.** FACT for the code structure. Reachability of a throw between parse and delete is UNKNOWN. Candidates: `new Query` on a malformed build-time `.scm` (would fail every file), `computeSymbolKey`, `query.matches` raising a WASM runtime error, allocation failure. No test asserting deletion on a throw was found by search. F002's live run had zero failed extractions but this does not cover the throw path. If the WASM runtime is already poisoned, a delete in a `finally` may itself throw and needs its own guard.

**Impact.** F002 production code, hygiene. Blocks neither feature. F004's own future pipeline (T023) needs `try/finally` from the start (F004's spike scripts delete per iteration without `finally`). A fix to F002 needs separate approval (005 §11).

**Evidence needed before acting.** A local unit test injecting a throw after parse and counting undeleted trees; identification of what can actually throw.

## 6. R6: `relationship_key` depends on D1 row ids

**Sources.** `specs/004-…/data-model.md` (key formula), `relationships/relationship-identity.ts:16-40` (`sourceId`, `targetId`, `evidenceFileExtractionId`), `contracts/d1-schema-additions.sql:13,31-33` (`source_id` has no FK; `UNIQUE (snapshot_id, relationship_key)`), `data/code-intel-schema.sql:110` (`symbols.id` AUTOINCREMENT), `symbol-d1-client.ts:177-209` (delete and re-insert), `symbol-identity.ts` (content-derived `symbol_key`), F004 `spec.md` FR-004, FR-009, SC-002, FR-018, `symbol.functions.ts:36-89`, `decision-record.md` §10.1 (O1, O4).

**Assessment.** FACT: F004's key depends on ids, while F004 FR-004 describes a stable identity "analogous to `symbol_key`". Under normal flows, symbol ids change after F004 has run only through a `SYMBOL_EXTRACTOR_VERSION` change (FR-018 detects that); a restart after a failed run precedes F004. Two independent F002 runs of the same snapshot give different ids and identical `symbol_key`s. Operational actions such as a D1 restore are UNKNOWN. Also, the key includes the target, so it changes when a fact moves from unresolved to resolved (relevant if raw facts were ever persisted first).

**Impact.** F004 FR-004, FR-009, SC-002, data model, contracts, T005 (marked `[X]`, code exists as untracked scaffolding), T013, T022, T023, T031. Blocks the T007 gate: no. Blocks F002: no. Needs an F004 amendment (identity basis: ids or `symbol_key`; target in or out of the key) and a minor design decision. Changing the key basis would revisit a completed task; its status was not changed.

**Evidence needed before acting.** A local test running F002 twice on the same fixture snapshot and comparing row ids with `symbol_key`s; a decision on whether F004's query contract (FR-014, by entity id) exposes ids.

## 7. T007 gate impact

T007 stays STOPPED (`decision-record.md` §14.3). All five FR-028 conditions are unsatisfied and no waiver exists. R3 weakens the evidence behind the STOP but not the gate, because the gate rests on X and Y being unknown. R4–R6 are independent of the gate. `[X]` on F004 `tasks.md` T007 is not authorization.

## 8. Feature 002 impact

R1–R4 violate no F002 requirement. R5 is the only F002 code candidate (hygiene). F002's large-file exposure is unmeasured and it runs under the same unknown limit. Nothing here requires reopening F002 architecture; R4 would touch F002 only if F002-side `is_exported` population were chosen.

## 9. Feature 004 impact

R4 requires revising T018, T021 and `plan.md`. R6 touches a completed task's design. R5 adds a requirement to T023. R1/R2 leave the original architecture gate intact. R3 requires correcting wording.

## 10. Required specification amendments (proposals; none made)

Amendments follow `decision-record.md` §15, after the decision record is reviewed.

1. F004 `research.md` §1, `feasibility-results.md`, T006: correct "~2,000 lines"; remove the statement that the 10 ms limit "applies to queue-consumer invocations too".
2. F004 EXPORTS mechanism (`research.md` §2, `plan.md`, T018, T019, T021) once R4 is decided.
3. F004 FR-004 and `data-model.md`: state the identity basis; decide whether the target belongs in the key.
4. F004 T023 and `plan.md`: require exception-safe tree deletion in the F004 pipeline.
5. F002: none required; R5 is a code change and R4 an F002 spec change only if F002-side population is chosen.

## 11. Required future experiments (none authorized or run)

- R1/R2: a documentation-only raw-text read of the Workers Pricing and Limits tables and the Queues Limits footnote (public documentation; not a Cloudflare account operation), and `LX-1` for telemetry (U3, U4), by explicit authorization naming the experiment.
- R3: the controlled local experiment in §3.
- R5: a local test injecting a throw after parse.
- R6: a local two-run comparison of ids against `symbol_key`s.
- R4: a fixtures-only local check of "exported" per Tier-1 language.

## 12. Exact next decision point

**The user decides how X and Y are established:** (a) authorize a documentation-only raw-text re-read of the three Cloudflare pages; (b) authorize `LX-1` by its ID; (c) grant an FR-038 waiver naming X, M and the selected unit; or (d) amend Feature 004 in place after reviewing the decision record. Independently, the user may authorize the R3 local experiment, approve the R3–R6 wording amendments, and decide the EXPORTS mechanism. The investigation's leaning was (a) then the R3 experiment, both cheap and read-only. Feature 004 T007 remains STOPPED.

## 13. Where this is summarized

`docs/ROADMAP.md` section "T007 evidence and specification reconciliation" holds the R1–R6 status table. `docs/session_handoffs/CURRENT.md` points here.

## 14. Limits of this record

Local wall-clock is not Cloudflare CPU. Documentation statements come from earlier extraction-based reads (Feature 005) and were not re-fetched. The proposed experiments were not run. Line references are to the working tree at HEAD `c576310` on 2026-09-24.
