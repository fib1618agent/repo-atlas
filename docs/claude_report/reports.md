## GROUP A / C EXECUTION REPORT

**Date:** 2026-09-27 · **Branch:** `feat/atlas-marble-interaction` · **HEAD:** `430e170`. Full text: `specs/004-engineering-relationship-graph/t007-remediation-group-a-c-execution.md`. **Only RT-02, RT-05, RT-15 were executed. Group B (RT-09/RT-10) and Group D (K.4/G8) were NOT touched.**

## RT-02 SYMBOL IDENTITY

**Major finding, reframes the problem.** Read F002 source directly (`src/lib/code-intel/symbols/symbol-identity.ts`, `to-intermediate-representation.ts`, `persistence/symbol-d1-client.ts`): **F002 already computes exactly the stable identity F004 needs.** `computeSymbolKey(snapshotId, filePath, kind, qualifiedNameOrName, startLine, startColumn)` → SHA-256, deterministic, independent of the SQLite row id, already persisted as `symbols.symbol_key`.

Further: the T007 harness's own resolver (`scripts/t007-local/lib/rel.ts`) **already carries this value through the whole resolution pipeline** as `Endpoint.ref` — at every symbol-endpoint construction site (lines 349, 387, 588, 594) — but `persistRows` discards it and persists only the volatile row `id` into F004's own `relationships.source_id`/`target_id` (confirmed `INTEGER`-typed at `contracts/d1-schema-additions.sql:13,15` — this is **F004's own schema**, not F002's).

**Conclusion: F-4's symbols-stage redelivery break is not "F002 lacks a stable identity" — it's "F004's own persist layer drops an identity it already has in hand."** This is a materially better, more actionable finding than the planning checkpoint assumed.

**Hard-stop condition, explicitly evaluated: NOT triggered.** F002's existing schema is exactly sufficient. No F002/F004 cross-feature amendment is required. Zero F002 files touched or proposed to be touched.

**Proposed key**: reuse `symbol_key` verbatim, no new formula invented. **Proposed fix**: additive `source_symbol_key`/`target_symbol_key` TEXT columns on F004's own `relationships` schema, populated from the already-computed `Endpoint.ref` — a schema-additive, not schema-breaking, change. Full collision analysis, examples, migration implications, and SYM-01 acceptance criteria (0 dangling endpoints, matching reference hash) in the execution file.

## RT-05 CONTRACT AMENDMENTS

Drafted proposed contract text for all 7 items: CANCELLED (extends the existing cancel transition to a real terminal state), PAUSED (full semantics per Decision D2 — meaning, in/out transitions, cancel/cancelHalt/lease/retry interaction, non-terminal, persisted-state requirement), lease/retry/backoff defaults, F-4e interim lease-margin note, crash-reclaim `attempts` semantics.

**Secondary finding**: the harness's `DEFAULT_POLICY.leaseMs` constant (30,000 ms, `jobs.ts:41-45`) was **never actually exercised by any F-1/F-1c/F-3/F-4e-control test** — every one explicitly overrode the lease to **1500 ms** (`m-l4-failures-c.ts:599,666,689`), which is the number the 56/56 clean durability evidence actually validates. **Proposed contract default lease is 1500 ms, not 30,000 ms** — distinguishing measured-and-validated contract defaults from an untested implementation constant, exactly as instructed. `maxAttempts: 3`, `backoffBaseMs: 25` (exponential) proposed unchanged, backed by F-3's actual retry evidence.

## RT-15 G9 CRITERION

**CURRENT G9 STATUS = FAIL** (unchanged).

**PROPOSED AMENDED CRITERION** = "complete band table" scoped to **B1, B2, B3, B4, B5, B6, and the real minified-JS fixture**; B7/B8 excluded from the completeness requirement, tracked separately as non-blocking research, because the adopted ceiling (B5/≈512 KiB) sits below B7's threshold and the SKIPPED-policy already governs anything above it. Full drafted text in the execution file, ready for owner approval.

**RE-SCORING REQUIRED = RT-16** — not performed by this pass.

Reviewed every existing G9-adjacent reference (plan §9, results.md, gate-evaluation.md, the checklist) — confirmed the proposal doesn't alter registered semantics beyond the approved scope, and confirmed historical L13/L14 records are correctly left un-retouched (amendments are additive, per this repository's convention — never a silent retroactive edit).

No ADR-001 or `research.md` edit performed, exactly as instructed — that remains a separate, later Group C step (RT-17), not authorized here.

## VALIDATION

No production code changed. No benchmark executed. No threshold changed. No dataset changed. No evidence JSON changed. **No F002 schema changed.** No G6 implementation performed (Group B untouched). No G8 work performed (Group D untouched). G9 remains FAIL pending RT-16. T008 remains blocked.

## NEW OPEN QUESTIONS

1. RT-02's additive-column-vs-replace-column schema-shape choice (proposed: additive) wasn't itself pre-decided at D1 — D1 fixed the *ownership boundary* (F004, not F002), not this specific schema-shape detail.
2. RT-02's read-time repair lookup (current row id by `symbol_key` after redelivery) may need a new `symbols(snapshot_id, symbol_key)` index to stay fast at R-L scale (GitNexus: 12,660 symbols) — an RT-03 implementation detail, not designed yet.
3. RT-05's 1500ms-vs-30,000ms lease-default finding is new this pass, not flagged at any earlier checkpoint — the owner should explicitly confirm which number becomes the contract default.

## UNAUTHORIZED WORK NOT PERFORMED

Group B (RT-09's remaining numeric-bound design, RT-10's batched-persist implementation) — not touched. Group D (K.4, any G8 work) — not touched. RT-16 (G9 re-score) — not performed. RT-17 (ADR-001/`research.md` edit) — not performed. RT-18 (B7/B8 tracking pointer) — not performed. No task checkbox ticked anywhere.

## GATE STATUS

**G3 = CONDITIONAL. G6 = FAIL. G9 = FAIL. T008 = BLOCKED.**

## FILES CHANGED

- `specs/004-engineering-relationship-graph/t007-remediation-group-a-c-execution.md` (**new**)
- `specs/004-engineering-relationship-graph/t007-local-execution-log.md` (§22 appended)
- `docs/prompts/claude-prompts/prompt-log.md` (this prompt appended verbatim)
- `docs/claude_report/reports.md` (this report, overwritten)
- `docs/progress/PROGRESS.md`, `docs/session_handoffs/CURRENT.md`, `docs/ROADMAP.md` (checkpoint entries)
- No `src/`, `tests/`, schema, config, threshold, dataset, evidence JSON, `research.md`, or F002/reference-repo file changed. No task checkbox ticked.

## COMMIT/PUSH STATUS

No commit. No push.

RT-02, RT-05 and RT-15 completed within authorization. No Group B or Group D task was authorized or executed.
