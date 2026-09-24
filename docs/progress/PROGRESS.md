# RepoAtlas — Progress Tracker

> Status legend: `[ ]` Planned · `[/]` In progress · `[x]` Done · `[-]` Skipped / deferred

## Current State

Authoritative block, **overwritten after every task**. Below it: concise recent entries. Older history (Phase 0–7 UI checklists, Features 001–003, Feature 004 T001–T007, Feature 005 T001–T048) is archived unedited in `docs/progress/archive/PROGRESS-2026-09-19_to_2026-09-24.md` (HISTORICAL: read only for a specific fact). Protocol: `docs/CONTEXT-PROTOCOL.md`.

- **As of:** 2026-09-24 19:28 +04:00 · branch `feat/atlas-marble-interaction` · HEAD `f1cef88` · working tree dirty (uncommitted Feature 006 work plus pre-existing uncommitted work: see below).
- **Feature 006 (Settings / Control Plane):** T001–T030 **DONE** (T030 persist step completed; closeout reconciliation of `docs/ROADMAP.md` done 2026-09-24 19:32 +04:00). T028 manual browser validation: PASS on all acceptance areas except two items **NOT VERIFIED** (absolute proof of no atlas-data refetch on preference change; LAN reachability) and one narrow-width qualification (390×844: page does not overflow; config table has ~50 px internal horizontal scroll and third-column content is clipped until scrolled; controls usable). Details: `docs/claude_report/reports.md`. Not committed. `docs/ROADMAP.md` reconciled in the closeout (row 006 = Feature 006 Settings, COMPLETE; row 007 = Feature 007 MCP, NOT STARTED).
- **Feature 004 (Engineering Relationship Graph):** BLOCKED. T001–T007 marked `[X]`; T008+ not started. `.specify/feature.json` points at `specs/006-settings-control-plane`.
- **Blocker:** Feature 004 T007 CPU gate **STOPPED** (`specs/005-queue-cpu-feasibility-architecture/decision-record.md` §14.3: FR-028 a–e unsatisfied, no waiver; live experiment `LX-1` not authorized). `[X]` on 004 `tasks.md` T007 is not authorization.
- **Decisions:** none made. Owed by the user: how X and Y (Free-plan Queue Consumer CPU limit and accounting unit) are established; whether to approve the R3–R6 wording amendments and the EXPORTS mechanism. No waiver exists.
- **Last completed:** Feature 006 T030 persisted (2026-09-24 19:28 +04:00): reporting files only, no code/test change. Earlier: R6 decisions D-R6-1 (B+C: extractor version = provenance + dataset validity scope, NOT in `relationship_key`), D-R6-2 (F002 re-extraction must make affected relationships stale; mechanism left to F004 implementation), D-R6-3 (key contract confirmed) applied to F004 docs (spec FR-004/FR-018/Edge Case, data-model, research A3 Resolution, plan, tasks T005/T013/T040 notes, contract scenario 5); docs only, T007 STOPPED, R4 annotations not applied. Earlier: R4/R6 design reconciliation (2026-09-24 16:58 +04:00), documentation review only, no spec/task/code change: R4 five stale unannotated EXPORTS statements found (`research.md:46`, `tasks.md:49`, `tasks.md:127`, `plan.md:173`, `cpu-decomposition-results.md:7`); R6 extractor-version role is NOT uniquely determined by the documents (B+C indicated, A not excluded) and a new contradiction found (FR-018 does not detect same-version F002 re-extraction id renumbering). Report in `docs/claude_report/reports.md`. Earlier: R3–R6 approved and documented (2026-09-24 16:46 +04:00): F004 amendments A1 (R3 wording), A2 (R4 EXPORTS parse-derived), A3 (R6 identity by `symbol_key`) in place; R5 recorded as separate F002 remediation, not implemented; no production code changed; T007 STOPPED. Earlier: R3-R6 local investigation (2026-09-24): R3 PARTIALLY RESOLVED, R4/R5/R6 CONFIRMED, no code/spec/T007 change; report in `docs/claude_report/reports.md`. Earlier: Option 1 documentation-only re-read of X/Y (2026-09-24): X UNKNOWN (CONTRADICTION), Y PARTIAL; T007 unchanged; report in `docs/claude_report/reports.md`. Earlier: context persisted for a clean reset (2026-09-24): the two investigations are in `docs/investigations/2026-09-24-*.md`, PROGRESS history archived, handoff refreshed.
- **Next action:** Feature 006: user decision on commit/review, on the two NOT VERIFIED items and the narrow-width qualification, (`docs/ROADMAP.md` already reconciled). Feature 004: user decision on how X and Y are established; separately owed: approval to apply the proposed R4 annotations; R5 implementation approval. Details: `docs/session_handoffs/CURRENT.md`.
- **Last verification:** Feature 006 (recorded from T027/T029, not re-run in T030): `tsc` PASS; `bun test` 323 pass / 0 fail (124 added by F006); F006 lint clean; repo-wide lint 1815 errors / 6 warnings vs T001 baseline 1810 / 6 (+5 = the five intentional Settings nav-line Prettier errors, not a new regression). Earlier, 2026-09-24 (Stage 3): typecheck exit 0; Feature 005 baseline hashes 0 mismatches. `bun test` and `bun run build` not re-run since.

---

## Recent entries

## Feature 006 — T030 persisted; feature complete (2026-09-24, 19:28 +04:00)

Reporting files only (PROGRESS, reports.md, prompt log, CURRENT.md); no implementation, test, roadmap, package or F001–F005/F007 change; no commit or push. **T028** (local browser, Playwright, `./run.sh`): PASS: navigation from all five pages, configuration surface and defaults, client-visible Site URL, secret rows configured/not-configured only, invalid numeric (`ATLAS_MAX_SOURCES=abc` → "Invalid / unavailable", no fabricated value), preference immediate behavior, persistence, reset (+toast), corrupted-storage per-item fallback, blocked-storage notice, code-intel Unavailable/`no_binding`, server-function response safety (no secrets, paths, SQL, infrastructure identifiers, stack traces), read-only boundary, Explore regression. Sentinel run: neither secret value in rendered text, HTML/DOM, storage or the raw `getConfiguration` body. **NOT VERIFIED:** (1) absolute proof that a preference change never triggers an atlas-data refetch (none observed; the fetch hook cannot prove absence of every request type); (2) LAN reachability (server bound to 127.0.0.1, no second device/context; testing would change exposure). **Qualification:** at 390×844 the page does not overflow but the configuration table scrolls ~50 px internally and third-column content is clipped until scrolled; controls usable. Not a silent PASS or FAIL. **T029** scope audit: F006 changed no `package.json`, lockfile, `.env.example`, `sources-store.ts`, `atlas-config.ts`, `code-intel/config.ts`, AI/storage code, F001–F005 or F007 source, or `docs/ROADMAP.md`. Pre-existing uncommitted work, **not** F006: `AGENTS.md`, `docs/AGENT-GOVERNANCE.md`, `roadmap.md`, `specs/004-…/{plan,research,tasks}.md`, Query-cache experiment (`to-intermediate-representation.ts`, its test, `scripts/query-cold-start-experiment.ts`, `specs/002-…/query-cold-start-results.md`), `.claude/skills/gitnexus/`. Evidence: untracked `.playwright-mcp/` (validation artifacts, kept, not committed, `.gitignore` unchanged). Report: `docs/claude_report/reports.md`.

---

## Working-tree documentation inventory and commit grouping (2026-09-24)

Inventory of the 43 dirty entries, no structural moves approved (option a). Committed locally in logical groups: governance/session docs, F002 CPU reports, F003 remediation, F004, F005, About page. Held back uncommitted pending user decision: `AGENTS.md` (GitNexus block duplicates `CLAUDE.md`), Query-cache experiment (Set B: `to-intermediate-representation.ts`, its test, `scripts/query-cold-start-experiment.ts`, `specs/002-…/query-cold-start-results.md`), `.claude/skills/gitnexus/`. T007 STOPPED, X UNKNOWN, Y PARTIAL, LX-1 NOT AUTHORIZED, no waiver, F004 T008+ NOT AUTHORIZED. No push, no Cloudflare, no source change.

---

## R6 identity decisions applied (2026-09-24 16:58 +04:00)

Documentation only. User approved D-R6-1 (B+C), D-R6-2, D-R6-3; recorded in F004 research.md "A3 Resolution" with annotations in spec FR-004/FR-018/Edge Case, data-model, plan, tasks T005/T013/T040, contract scenario 5. F002 not modified; no code, test or schema change; R4 annotations not applied; signaling mechanism for D-R6-2 left to implementation. T007 STOPPED, X UNKNOWN, Y PARTIAL, LX-1 NOT AUTHORIZED, no waiver, T008+ NOT AUTHORIZED. No commit. Report: `docs/claude_report/reports.md`.

---

## R4/R6 design reconciliation (2026-09-24 16:58 +04:00)

Documentation review only; no spec/plan/task/contract/code change. R4: A2 covers every requested EXPORTS statement; five unannotated stale D1-only EXPORTS statements found (proposed annotations not applied). R6: symbol endpoint = `symbol_key` (excludes extractor version, F002 precedent); relationship identity per A3; documents indicate version = stored provenance + dataset invalidation (B+C) but FR-004 wording also allows version inside the hash (A), so decision D-R6-1 is owed. New CONTRADICTION: A3 relies on FR-018, but F002 same-version re-extraction (F002 spec Acceptance 4) renumbers ids without a version change; decision D-R6-2 owed. R5 and R3 records verified consistent. T007 STOPPED, X UNKNOWN, Y PARTIAL, LX-1 NOT AUTHORIZED, no waiver, T008+ NOT AUTHORIZED. No commit. Report: `docs/claude_report/reports.md`.

---

## R3–R6 approved amendments (2026-09-24 16:46 +04:00)

Documentation only. R3=B: T006/E1/E2 reclassified as dense worst-case AST-shape (≈705 lines as built, not ~2,000), values preserved, unresolved gaps kept. R4=C: EXPORTS parse-derived within F004 (persisted `is_exported` is NULL); open design points recorded. R6=C: `relationship_key` must not use D1 row ids; symbol endpoints by `symbol_key`. R5: separate F002 remediation recorded in `docs/ROADMAP.md`, implementation not authorized. Recorded contradiction: FR-004 says identity is scoped to `relationship_extractor_version`, the formula has no version term. Affected verified task IDs: T005, T009, T013, T014, T018, T019, T020, T021, T022, T023. No production source, F002, tests, T007 status or Cloudflare touched; no commit. Report: `docs/claude_report/reports.md`.

---

## R3-R6 local investigation (2026-09-24)

Local-only evidence gathering; experiments ran from the session scratchpad (outside the repo), no repo file besides docs changed, no commit/push/Cloudflare/Wrangler. R3: parse cost tracks AST node count (Java 0.23-0.24 us/node in dense and ordinary shapes; TypeScript 0.26 vs 0.35); T006/decomposition/E3 disagreement is fixture density (dense ~36 nodes/line vs ordinary ~8; real repo files 6.6-11.4). R4: `is_exported` is always NULL (`symbol-d1-client.ts:191`), `SymbolIR` has no field, symbol `.scm` files have no export capture; EXPORTS is not derivable from F002 data; export nodes exist in the grammar. R5: an IR throw leaves the tree undeleted (1 created, 0 deleted; success and hasError paths delete). R6: a second `extractFile` of identical content gives identical `symbol_key`s but new symbol ids and different relationship keys. T007 STOPPED, X UNKNOWN, Y PARTIAL, LX-1 NOT AUTHORIZED, no waiver, F004 T008+ NOT AUTHORIZED. Report: `docs/claude_report/reports.md`.

---

## Option 1 — X/Y documentation re-read (2026-09-24)

Documentation-only; no Cloudflare account access, Wrangler, LX-1, waiver, spec/code change, commit or push. Raw markdown of Workers Pricing, Workers Limits and Queues Limits read. X: no Free Queue-Consumer CPU row anywhere; Queues Limits says consumers share the Workers per-invocation limits (Free = 10 ms in the account-plan table) yet also states an unqualified 30 s default and "Configurable to 5 minutes" that Workers Limits scopes to Workers Paid, so X stays UNKNOWN with a CONTRADICTION. Y: unit stated as per invocation; invocation-to-batch mapping not stated, so PARTIAL. T007 remains STOPPED. Report: `docs/claude_report/reports.md`.

---

## Feature 005 — T049 executed; STOP GATE S5 reached (2026-09-24)

Finalized DR Appendix C revision R0 (date 2026-09-24, initial version, checks re-run, disposition **STOPPED**). Final report given in `docs/claude_report/reports.md`. Feature 005 execution ends here: disposition Feature 004 T007 = STOPPED; no waiver; no live operation; no amendment begun; no Git mutation. Follow-ups (Feature 004 amendment, live-experiment authorization, waiver, Feature 002 approval, a follow-up /speckit-analyze) require explicit user instruction.

---

## Governance Stage 3 — analysis and readiness (2026-09-24)

Analysis-only stage; Feature 004 and Feature 005 were not executed and Feature 004 T007 remains **STOPPED**. Verified Feature 005's terminal state from repository artifacts (decision record §6.4/§13/§14: no unit selectable, no waiver, all FR-028 conditions unsatisfied; Set A/B baseline hashes: 0 mismatches; `bunx tsc --noEmit` exit 0). Recorded contradictions without reconciling them: Feature 004 `tasks.md` T007 `[X]` vs STOPPED; Feature 005 `tasks.md` 0/49 checked vs "T001–T049 executed"; Feature 005 decision-record header still "SKELETON". Analyzed the existing GitNexus index (HEAD `c576310`, 4,706 nodes / 7,289 edges, read-only `cypher`/`impact`) and, on explicit user authorization, ran `graphify update .` (Graphify 0.9.6; 3,073 nodes / 4,502 edges; output in gitignored `graphify-out/`). Produced the Feature 004 per-task readiness matrix, cross-feature graph, relationship and evidence-state comparisons, and the next-action recommendation (human decision required on how T007 is resolved). Full report: `docs/claude_report/reports.md`. No commit, push, Cloudflare or Wrangler operation. The Stage 2 GitNexus registry side effect (`ADLC-KQSE` auto-pruned) is unchanged and unreconstructed. Stage 1 and Stage 2 governance tasks (`CLAUDE.md`, `docs/AGENT-GOVERNANCE.md`) were not logged here at the time because those tasks limited file changes.

---

## Context Budget and Session Continuity Protocol (2026-09-24)

Repository-side context management only; no application code, spec, Feature 004/005 status or Cloudflare resource touched, no commit. Investigated what loads into Claude Code context (docs read via fetch: memory, context-window, costs, sub-agents; Claude Code 2.1.281) and what this repository supplies. Findings: only `CLAUDE.md` auto-loads (`AGENTS.md` does not when a `CLAUDE.md` exists); compaction re-injects `CLAUDE.md` but summarizes conversation; current context usage is not observable by the agent (user-side `/context`); `PROGRESS.md` is 137 KB with a stale header and no current-state block; two 2026-09-21 handoffs were stale. Added `docs/CONTEXT-PROTOCOL.md` (hierarchy, ownership, reset policy, handoff contract, budget, subagent policy, duplication analysis), `docs/session_handoffs/CURRENT.md`, a "Current State" block at the top of this file, a "Session Continuity" and "Compact instructions" section in `CLAUDE.md`, SUPERSEDED banners on the two old handoffs, and ROADMAP entries. Recommendations awaiting a decision (PROGRESS archive split, persisting the two 2026-09-24 analyses, a compact-source hook) are listed in `docs/CONTEXT-PROTOCOL.md` §10. Full report: `docs/claude_report/reports.md`.

---

## Context persisted before reset (2026-09-24)

Repository-side only; no application code, spec, Feature 004/005 status or Cloudflare resource touched; no commit. Added `docs/investigations/2026-09-24-f002-f004-parse-boundary-investigation.md` and `docs/investigations/2026-09-24-f004-t007-evidence-reconciliation.md` (self-contained historical records of the two analyses; R1–R6 status stays in `docs/ROADMAP.md`). Moved the historical PROGRESS body (about 135 KB) unedited to `docs/progress/archive/PROGRESS-2026-09-19_to_2026-09-24.md`; this file now holds the Current State block and the three most recent entries. Refreshed `docs/session_handoffs/CURRENT.md` ("Not Yet Persisted" empty), backfilled the three unlogged prompts of 2026-09-24 in `docs/prompts/claude-prompts/prompt-log.md`, updated read-path wording in `CLAUDE.md` and `docs/CONTEXT-PROTOCOL.md`. Report: `docs/claude_report/reports.md`.
