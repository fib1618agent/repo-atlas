# Claude Audit Report Log

Record of every audit report given to/by Claude in this repo. One entry per
audit: title + timestamp + full report content.

---

## Fresh-session audit — post-T068 state before Feature 004

**Timestamp:** 2026-09-21 (session time)

**Report:**

Branch/status: `feat/atlas-marble-interaction`, in sync with origin. All changes uncommitted (working tree). Nothing touched beyond described scope.

Changed files by feature:

- **Feature 001 (GITHUB_TOKEN fix)**: `src/lib/code-intel/persistence/cloudflare-env.ts`, `src/lib/code-intel/providers/github-content-provider.ts`, `src/lib/github-fetch.ts`, `README.md` (docs)
- **Feature 002 (AST/Symbols, remediation T066-T068)**: `src/lib/code-intel/config.ts`, `src/lib/code-intel/symbols/grammar-provider.ts`, `src/lib/code-intel/symbols/extraction-pipeline.ts`, `src/lib/code-intel/symbol.functions.ts`, `src/routes/__root.tsx`, new `feature-002-server-fn-registration.tsx`, `specs/002-ast-symbol-intelligence/{plan,research,tasks}.md`, symbol-related test files (new + modified), `tests/support/wasm-test-modules.ts`
- **Other/adjacent**: `specs/003-github-source-enhancement/tasks.md` (E1 remediation test note), `docs/progress/PROGRESS.md`, `docs/prompts/` (new — prompt log dir), `tests/integration/repositories/initial-sources.test.ts`

GITHUB_TOKEN wiring: Added `getGitHubToken()` in `cloudflare-env.ts` (reads `resolveEnv()?.GITHUB_TOKEN ?? process.env["GITHUB_TOKEN"] ?? ""`) — mirrors the existing `getSnapshotQueue`/`getSymbolQueue` binding-resolution pattern already in that file. Both `github-content-provider.ts` and `github-fetch.ts` swapped their duplicated `process.env["GITHUB_TOKEN"]` reads for this single helper. README documents `wrangler secret put GITHUB_TOKEN`.

Consistent with architecture? Yes. Same shape as existing queue-binding getters in the same file, closes real deployed-Worker bug (`process.env` doesn't resolve Worker secrets at runtime — only `resolveEnv()`'s bound env does), touches only the accessor, callers unchanged in behavior. No red flags.

Feature 002 completion: `tasks.md` T066/T067/T068 all marked `[X]` with dated pass evidence (2026-09-21), matches prior-session summary (33 extracted, 0 failed, 65 skipped, 77 symbols, version bumped to v2). `plan.md` line 193 still literally says "Planned, not yet implemented" in one status blurb — stale phrasing inside an amendment note, contradicted by surrounding evidence and by `tasks.md`; worth a one-line doc fix later but not a functional gap.

Unexpected/unrelated changes: none found. `__root.tsx`'s 2-line diff is T058's expected server-fn registration, not scope creep.

Recommended next step: commit the GITHUB_TOKEN fix + Feature 002 remediation as separate commits (different features, different authors/sessions) before starting Feature 004, so history stays bisectable. Optionally patch the stale `plan.md` "Planned, not yet implemented" line while in there.

---

---

## Single-Pass Architecture Spike (A vs B vs C) — Feature 004 CPU gate follow-up

**Timestamp:** (session time)

Full report: `docs/investigations/004-single-pass-architecture-spike.md`. Summary: tested whether folding Feature 002 symbol extraction and Feature 004 relationship observation into one Tree-sitter parse (vs. current two separate parses) reduces CPU cost enough to matter. Result: single-pass is consistently ~31-33% cheaper across all four languages at every size tested, using real production `getParser`/`toIntermediateRepresentation` code, not a reimplementation. Not sufficient alone — this repo's own largest real local files (637 and 745 lines) still classify `likely unsafe` under conservative rules even in the single-pass scenario. Verdict stated per instruction: "Single-pass architecture appears viable; Feature 002/004 boundary requires an architecture decision." Separately surfaced: Feature 002's own symbol extraction (independent of Feature 004), once real per-symbol SHA-256 hashing is included, already trends toward the 10ms line on this repo's own larger real files — a risk signal about already-shipped Feature 002 cost, not previously measured. T007 STOP unchanged; no architecture decision made; no code/spec/task files modified; nothing pushed or deployed.

---

## Combined Single-Pass Decomposition (C1-C5) — Feature 004 CPU gate follow-up

**Timestamp:** (session time)

Full report: `specs/004-engineering-relationship-graph/combined-single-pass-decomposition-results.md`. Decomposed the hypothetical single-pass unit (C) into C1 parse, C2raw symbol extraction (incl. real `computeSymbolKey` hashing as production runs it), C3 relationship observation (no resolution), C4 `computeSymbolKey` isolated, C5 combined total, using real production `getParser`/`toIntermediateRepresentation`/`computeSymbolKey`/relationship `.scm` queries. Finding: `computeSymbolKey` hashing is negligible (0.000-0.16ms even at 300 symbols) — not a meaningful optimization target. Parsing (C1) is significant but not dominant on real files. Unplanned discovery: `toIntermediateRepresentation()` (`to-intermediate-representation.ts:48`) compiles a fresh Tree-sitter `Query` object on every call — isolated measurement shows this costs ~4.4-4.8ms for typescript/tsx (vs ~0.8-1.1ms java/javascript) per file, independent of file size or symbol count, and accounts for ~85-95% of real TS/TSX files' symbol-extraction cost in this dataset. This is a real, already-shipped Feature 002 cost, not a Feature 004 cost, and not modified in this investigation (measurement only, per instruction). T007 STOP unchanged; no code/spec/task modified; no push/deploy/Cloudflare access.

---

## Query-cache mitigation — Feature 002 `toIntermediateRepresentation` (Feature 004 CPU gate follow-up)

**Timestamp:** (session time)

Added per-isolate compiled-`Query` memoization (`WeakMap<Language, Map<querySource, Query>>`) in `src/lib/code-intel/symbols/to-intermediate-representation.ts`; one contract test added in `tests/contract/symbols/to-intermediate-representation.test.ts`. Symbol tests 99/99, full suite 199/199, tsc clean. Warm-cache local re-measure: real-file combined single-pass totals dropped ~3x (e.g. sidebar.tsx 7.85→2.71ms); classifications: catalogue.tsx and symbol-d1-client.ts → comfortably bounded, AtlasScene.tsx and sidebar.tsx → borderline (were likely unsafe). Cold first call per language per isolate still ~10ms locally for ts/tsx. Full before/after: `specs/004-engineering-relationship-graph/combined-single-pass-decomposition-results.md` ("Post query-cache mitigation"). T007 STOP unchanged.

---

## Query cold-start investigation (Feature 002 symbol extraction)

**Timestamp:** (session time)

Measurement-only, fresh-process decomposition; full report `specs/002-ast-symbol-intelligence/query-cold-start-results.md`. Key points: prior "~10 ms cold" figure was understated (real first file ≈ 22-23 ms parse+extraction for TS/TSX plus ≈ 4.7 ms init; ≈ 12 ms Java/JS); Query compile is the largest single TS/TSX cold item (~47-50 %) but not the only one; costs are one-time per isolate/language; no Query precompile API exists in the pinned `web-tree-sitter`; Feature 002 already batches up to 50 files/message in one invocation while live validation passed, so local ms cannot be mapped to Cloudflare CPU-ms. T007 STOP unchanged; no production/spec/task change.

---

## Cloudflare Queue / Workers CPU model — documentation research report

**Timestamp:** (session time)

Research-only report `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-research-report.md` (verified facts vs repo behavior vs local evidence vs inferences vs unresolved, with page/section/URL for each Cloudflare claim). Key results: per-invocation CPU limit documented (Free 10 ms); queue consumer batch = one invocation; ops counted per message; three Cloudflare pages inconsistent/silent on Free-plan queue-consumer CPU (unresolved, not reconciled); isolate reuse not guaranteed; 50-files-per-invocation vs local >10 ms not shown to conflict with docs. T007 stays STOPPED; next step is a drafted (not executed) live CPU-measurement protocol for explicit approval. No code/spec/plan/task/contract changed; no deploy/push/Wrangler/remote access.

---

## Cloudflare observability for Queue-consumer CPU time — documentation research report

**Timestamp:** (session time)

Report `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-observability-report.md`. CPU-time fields exist (Trace Events `CPUTimeMs`, `$workers.cpuTimeMs` cited on the Query Builder page, dashboard/GraphQL quantiles) but none is documented specifically for Queue-consumer invocations, per message, or with batch/file counts; Free-plan access is documented for Workers Logs and Query Builder only; Logpush and Tail Workers are Paid. Four documentation contradictions recorded, unreconciled. T007 stays STOPPED; no code/spec change; no deploy/push/Wrangler/remote access.

---

## Feature 005 specification created (Queue CPU Feasibility and Processing-Unit Architecture)

**Timestamp:** (session time)

`specs/005-queue-cpu-feasibility-architecture/spec.md` (36 FR, 12 SC, 5 user stories, evidence table E1-E8, "Assumptions Explicitly Removed") and quality checklist (all pass, 0 clarification markers). Decision/spec phase only; T007 not cleared; Feature 004 spec/plan/tasks untouched; `.specify/feature.json` repointed to 005. Recommended next: `/speckit-clarify` on three non-blocking items (FR-029 telemetry-unobtainable default; amend-004-vs-supersede; live-measurement authorization policy), then `/speckit-analyze` only after plan/tasks exist.

---

## Feature 005 clarification session (telemetry default, amendment policy, live-measurement authorization)

**Timestamp:** (session time)

Three user-supplied policy decisions integrated into `specs/005-queue-cpu-feasibility-architecture/spec.md` (Clarifications Session 1; FR-029/035/036 revised, FR-037/038 and SC-013 added). No blanket live-operation authorization granted; Feature 004 not modified; T007 not cleared; no plan/tasks. Checklist 16/16 before and after (no state changes). Remaining ambiguity is planning-level only (see report).

---

## /speckit-plan — Feature 005 (plan phase; feasibility/decision plan)

**Timestamp:** 2026-09-23

Created `specs/005-queue-cpu-feasibility-architecture/{plan,research,data-model,quickstart}.md` and `contracts/{decision-record,measurement-protocol,live-experiment-proposal,waiver}.md`. Docs only. Feature 004 untouched; T007 not cleared; no tasks generated; no live/Cloudflare operations. Six ambiguities (A1-A6) listed in plan.md for user review.

---

## Feature 005 plan — approved decisions A1-A6 incorporated

**Timestamp:** 2026-09-23

Docs-only edits under specs/005. Found no completed 300-file CPU run (T073 unrun; only the 300-sequential lifecycle/memory spike); flagged as R1. No Feature 002/004 edits; no live ops.

---

## Feature 005 tasks generated

**Timestamp:** 2026-09-23

49 tasks (FR-001..038, SC-001..013 covered; A1-A6, R1, R2 preserved). No task executed; no Cloudflare access.

---

## Feature 005 — analyze remediation review (document-only)

**Timestamp:** 2026-09-23

Remediation of `/speckit-analyze` findings H1–H4, M1–M8, L1–L5 applied to Feature 005 artifacts only (naming: "task T007 (scale tiers)" vs "Feature 004 T007"; unit-selection rule requires budget X established/waived and FR-031/032/033 shown; three-set baseline; four-row consumer table; documentation-research restrictions; stop gates renumbered by occurrence; disposition definitions and revision log; 8 canonical criteria; tsc baseline; hunk classification; 300-file run = lifecycle/memory only). Feature 002/004 untouched, no live operations.

---

## Feature 005 — second analyze remediation review (document-only)

**Timestamp:** 2026-09-23

Findings N1 (T019 would have run scripts that overwrite protected Feature 002/004 results), M1–M3 and L1–L6 remediated in Feature 005 artifacts only. No task executed, no live operations, Feature 004 T007 unchanged.

---

## Feature 005 — execution audit, T010–T047 (recorded at T048)

**Timestamp:** 2026-09-24

**Scope:** Feature 005 execution tasks T010 through T047, one task at a time, each with its own report (overwritten) and PROGRESS entry. Earlier tasks T001–T009 were executed and audited in prior steps; T004–T009 have no separate audit entries here and were not backfilled.

**Sources read**
- Repository: `specs/005-queue-cpu-feasibility-architecture/` (spec, plan, research, tasks, decision-record, contracts, evidence), `specs/002-ast-symbol-intelligence/*` results and reports, `specs/004-engineering-relationship-graph/*` results and planning files, `src/lib/code-intel/**` (symbols, persistence, config), `plugins/cloudflare-symbol-queue.ts`, `wrangler.toml`, `docs/agency-agents-for-repo-atlas.md`. Read-only.
- **Public Cloudflare documentation (WebFetch, documentation only), 2026-09-24**: Observability telemetry "Run a query" API page and the observability query-language changelog post (task T036); Workers Pricing, Workers Limits, Queues Limits, Workers Logs, Query Builder (task T039 re-verification). Earlier reads (T004, T005) are recorded in `evidence/`. No Cloudflare API/MCP, dashboard, Wrangler or account context was used.

**Local measurements run:** none. No script under `scripts/` was executed. No script was created under `evidence/local-measurements/` (T019 = N/A, S2 = gap named NO). Existing local measurement results were read as recorded evidence only. `bunx tsc --noEmit` was run once (T047): exit 0, no output, identical to the T002 baseline.

**Live operations:** none. No deployment, no Wrangler against live resources, no remote D1/R2/Queue access, no live validation. The only live-related artifact is `live-experiment-proposal.md` (LX-1), marked `STATUS: NOT AUTHORIZED`.

**Repository integrity (T046, STOP GATE S4):** Set A file list and hashes: no difference; Set B (Query-cache experiment) hashes and saved patch: no difference; Set C differences informational only. No Git mutation was performed.

**Decisions and disposition recorded in `decision-record.md`:** no processing unit selectable yet (§6.4); single-pass DEFER (§8.2); Query cache RETAIN, unadopted (§9.3); no amendment indicated (§15); no waiver exists (§13); **Feature 004 T007: STOPPED** (§14.3; all FR-028 conditions unsatisfied).

**Open items flagged for review:** at T039 the S1 answers were judged unchanged and execution continued (flagged in §14.1); code-reading "shown (N3)" in §10 is not test evidence; D1 free-tier figures UNKNOWN (no documentation research authorized for T024); two new documentation wording conflicts (Workers Logs Free quota; Query Builder enablement) unreconciled; K1 (15 vs 5 minutes) narrowed but unresolved.

---

## Governance Stage 3 — analysis and readiness audit

**Timestamp:** 2026-09-24

**Scope:** Verification of Feature 005's actual state, Feature 004 task-by-task readiness, and local engineering-intelligence analysis (GitNexus index, Graphify graph). Analysis only; no Feature 004/005 task executed.

**Sources read**
- Repository: `CLAUDE.md`, `AGENTS.md`, `docs/AGENT-GOVERNANCE.md`, `docs/agency-agents-for-repo-atlas.md`, `.specify/` workflow and constitution, `specs/004-engineering-relationship-graph/` (tasks, research §1, feasibility results), `specs/005-queue-cpu-feasibility-architecture/` (tasks, decision-record, evidence baseline), `research/ADOPTION_MATRIX.md`, `research/CODEGRAPH_RESEARCH.md`, `research/GRAPHIFY_RESEARCH.md`, `docs/investigations/004-*`, source files under `src/lib/code-intel/`.
- Derived tools: `.gitnexus/meta.json` and the GitNexus graph via read-only `gitnexus cypher -r repo-atlas` and `gitnexus impact`; `graphify-out/graph.json`, `GRAPH_REPORT.md`, `manifest.json`; GitNexus package README/CLI help; Graphify CLI help.
- No public web documentation was fetched.

**Local operations run:** `graphify update .` (authorized by the user; Graphify 0.9.6; created gitignored `graphify-out/`); `bunx tsc --noEmit` (exit 0); `shasum -c` of Feature 005's Set A/B baselines (0 mismatches); read-only GitNexus queries. Not run: `gitnexus analyze`, `gitnexus list`, `gitnexus status`, `--embeddings`, `bun test`, `bun run build`.

**Live operations:** none. No deployment, no Wrangler, no remote D1/R2/Queue access, no Cloudflare API/dashboard.

**Repository integrity:** SHA-1 of all files under `specs/` identical before and after; `CLAUDE.md`, `AGENTS.md`, constitution, `docs/AGENT-GOVERNANCE.md`, agency mapping unchanged by this stage; HEAD unchanged; no Git mutation. GitNexus registry hash unchanged by this stage's commands.

**Findings**
- Feature 004 T007 remains STOPPED (004 research §1 result STOP; 005 DR §14.3 STOPPED; no waiver; no unit selectable). Nothing in Feature 004 is READY.
- CONTRADICTIONS recorded, not reconciled: 004 tasks.md T007 `[X]` vs STOPPED; 005 tasks.md 0/49 checked vs executed; 005 decision-record header "SKELETON".
- 004 tasks.md path errors: T010 (`src/lib/atlas-errors.ts` is the real path), T024 (`symbol-worker.ts` lives in `symbols/`); T019 `.scm` files already exist while unchecked.
- GitNexus "up-to-date" is commit-based; the index covers the dirty working tree. Community count 38 (nodes) vs 90 (metadata) unexplained.
- Graphify indexed 53 nodes from `.claude/skills/gitnexus/` (GitNexus-generated skill docs); 0 from `.gitnexus/`. `.graphifyignore` not changed.
- `AGENTS.md` and `CLAUDE.md` contain GitNexus-generated blocks with stronger imperative rules than repository governance; left unchanged, flagged for the user.
- Importer counts agree across grep, GitNexus and Graphify (`cloudflare-env.ts` 34; `atlas-errors.ts` 19); `implements` = 3 in source, GitNexus and Graphify.

**Prior side effect (Stage 2), unchanged:** GitNexus `status`/`list` auto-pruned the stale `ADLC-KQSE` registry entry; the entry was not captured and is not reconstructed.

**Open items flagged for review:** how T007 is to be resolved (waiver, authorized live experiment, or reviewed Feature 004 amendment); record-state hygiene edits; whether to keep GitNexus-generated blocks and skill docs; unconfirmed `bun test` / build status.
