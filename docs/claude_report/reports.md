# T007-CAL-1 Proposal Revision R1

**Timestamp**: 2026-09-24 20:49 +0400 · Documentation only. No experiment, no Cloudflare operation, no production code, no T008 or T020–T023, no new T007 decision, no commit/push.

## Result: PROPOSAL READY FOR AUTHORIZATION (authorization itself NOT given)
`specs/004-engineering-relationship-graph/t007-calibration-proposal.md` rewritten as **R1** applying the six revisions from the 2026-09-24 20:44 +04:00 review. T007 STOPPED; T007-CAL-1 NOT AUTHORIZED; T008+ NOT AUTHORIZED; no FR-038 waiver.

## Six revisions (where)
1. §2: pinned scratch harness; T020–T023 do not exist; not production code, not T008+; does not prove final CPU; later implementation-level Cloudflare re-check required.
2. §10: FR-036 resource/lifecycle (scratch Worker, Queue, DLQ, D1, R2; Free config; pre-run checks; recorded identifiers; teardown; deleted-resource confirmation). No identifiers invented; production names listed only to exclude them.
3. §3: matrix (ordinary 4/16/32 KiB for Java, TS, JS, TSX; dense ascending with two-consecutive-failure stop; Minified-JS ladder; nodes/KiB recorded; JS/TSX dense at B_cand with step-down; CALLS-heavy).
4. §5: Stage 1 = 30 per cell (screening evidence only); Stage 2 = 100 at selected B (Java dense, TS dense, minified JS); cold = idle-gap candidates only, first-after-deploy counts, in-handler init, judged by max.
5. §7: CPU-failure list, integer upper-bound rule, rollover statement, retry/DLQ classification, missing CPU fails observation.
6. §8: MINIMUM_USEFUL_B = 16 KiB pre-registered; B = minimum of largest passing bands over five families; no extrapolation; below 16 KiB does not clear T007 (§9 C rule).

## Corrections and consistency
- **Correction to my 2026-09-24 20:44 review:** it treated tasks.md T074 as the later re-check. T074 is a *local* review of T073's local simulation (wall-clock), not a Cloudflare measurement. R1 keeps T074 as the local check and states that the Cloudflare implementation-level re-check has no existing task and must be added by the reviewed Feature 004 amendment (§2, §9).
- Kept distinct (§0): Cloudflare 10 ms (DOC) vs 5 ms p95 (PARAM) vs 8 ms max (PARAM) vs 16 KiB (PARAM, pre-registered). The 5/8 ms and M = 2 need owner approval before the run; 16 KiB is owner-set.
- Dense/minified 4 KiB failure alone is not automatic C (§9). Smoke-gate failure is not C.
- Volume recomputed: typical ≈ 1,240 messages ≈ 3,700 Queue ops (worst ≈ 1,420 / 4,300), within Free 10,000/day but shared with production use; the earlier 720/2,200 figures are superseded.
- Interpretive choices to review: ordinary failures at 16/32 KiB count as failing bands; CALLS-heavy retained; Dense-JS/TSX are step-down checks not full ladders; Stage 2 covers three families.

## Files changed
- Modified (untracked file, rewritten): `specs/004-engineering-relationship-graph/t007-calibration-proposal.md` (previous R0 kept at the session scratchpad only).
- Modified: `docs/claude_report/reports.md`, `docs/progress/PROGRESS.md`, `docs/ROADMAP.md` (change-history row), `docs/session_handoffs/CURRENT.md`, `docs/prompts/claude-prompts/prompt-log.md` (condensed).
- Not modified: research.md, plan.md, tasks.md, Feature 005 record, source code. Pre-existing modified files (AGENTS.md, AGENT-GOVERNANCE.md, roadmap.md, `src/components/atlas/RepositoryPanel.tsx`, `src/routeTree.gen.ts`, `src/routes/catalogue.tsx`, the to-intermediate-representation files) are not from this task.

## Next
Owner decision: authorize T007-CAL-1 by name with the §0 parameters approved, or decline/defer.
