---

description: "Task list for Feature 005 — Queue CPU Feasibility and Processing-Unit Architecture (decision/feasibility workstream; documentation deliverable only)"
---

# Tasks: Queue CPU Feasibility and Processing-Unit Architecture

**Input**: `specs/005-queue-cpu-feasibility-architecture/` — spec.md (FR-001..038, SC-001..013, Clarifications Session 1), plan.md (approved with D-A1..D-A6), research.md, data-model.md, contracts/, quickstart.md

**Status**: GENERATED, NOT STARTED. No task below has been executed. **Feature 004 T007 remains STOPPED.** This file was revised once by a document-only remediation pass following `/speckit-analyze` (findings H1–H4, M1–M8, L1–L5); task IDs were not renumbered.

**Deliverable**: one reviewed decision record `specs/005-queue-cpu-feasibility-architecture/decision-record.md` (16 sections + Appendix A traceability, B success-criteria result, C revision log, per `contracts/decision-record.md`) plus supporting files under `specs/005-queue-cpu-feasibility-architecture/evidence/`. No source code, no tests, no implementation.

**ID note (absolute rule)**: task IDs here (T001..T049) belong to Feature 005 only. Two different things carry the number 007 and must never be confused:
- Feature 005's own task is always written **"task T007 (scale tiers)"** (its checkbox ID `T007` is the only place the bare token appears, as required by the checklist format).
- The Feature 004 CPU feasibility gate is always written **"Feature 004 T007"**.
A bare "T007" is not used anywhere else. Neither task is renamed or renumbered. Feature 005's T001–T049 are otherwise unrelated to Feature 004's T001–T076.

**Contract vs deliverable**: files in `contracts/` (e.g., `contracts/decision-record.md`, `contracts/live-experiment-proposal.md`, `contracts/waiver.md`) are contracts/templates. The deliverables live at the feature root (`decision-record.md`, `live-experiment-proposal.md`) or `evidence/`. A waiver record exists only if the user grants one.

## Activity classes (every task is tagged)

| Tag | Meaning | Permitted? |
|---|---|---|
| `[REPO-READ]` | Read repository files/config/git state read-only | Yes |
| `[DOC-RESEARCH]` | Read official public Cloudflare documentation as documentation only, using WebFetch/WebSearch on public documentation pages | Yes (D-A1) — research, not resource access. See "Documentation-research restrictions" |
| `[LOCAL-MEAS]` | Run a local-only measurement using a newly created script under `EV/local-measurements/` (no existing script may be executed) | Only when a planned step names a concrete evidence gap; documented before running; write-side-effect check first; comparative only (D-A2, G8) |
| `[WRITE-DOC]` | Write/edit a file under `specs/005-queue-cpu-feasibility-architecture/` (or, in T048 only, append to the three project logs) | Yes |
| `[LIVE-GATED]` | Anything touching Cloudflare resources | **NOT AUTHORIZED. No task in this file performs one. Drafting a proposal is `[WRITE-DOC]`.** |

## Documentation-research restrictions (apply to every `[DOC-RESEARCH]` task: T004, T005, T036, T039)

Public Cloudflare documentation may be accessed **only as documentation** (WebFetch/WebSearch of public pages). Explicitly prohibited during doc research: Cloudflare MCP tools and Cloudflare API execution (this includes every `mcp__plugin_cloudflare_*` tool), the Cloudflare dashboard, Wrangler, remote D1, remote Queues, remote R2, deployments, and any production/live validation. Reading a documentation page is never treated as resource access, and no credentials or account context are used.

## Global prohibitions (apply to every task — G0)

No deployment; no push; no Wrangler; no Cloudflare API/MCP/dashboard/resource access; no D1/R2/Queue mutation or remote read; no live validation; no edits to Feature 002, Feature 004, Feature 001/003 artifacts, `src/`, `scripts/`, `plugins/`, `wrangler.toml`, `nitro.config.ts`, or `data/`; no cleaning, resetting, stashing, or committing of the working tree; no adoption/reversion/modification/removal of the working-tree Query-cache experiment; no implementation of Query Cache, single-pass extraction, or Feature 004 relationship extraction; no execution of any existing evidence/measurement script (each hardcodes an output path that overwrites a protected Feature 002/004 results file); no creation or granting of a waiver; no numeric Queue CPU budget invented; Workers Free HTTP 10 ms never used as the Queue Consumer budget without authoritative evidence; the 300-file run never called a production worst case and never used for a CPU conclusion. If a task appears to require any of these: STOP and report (see Stop Gates).

## Format: `- [ ] T### [P?] [US#?] Description with file path`

`[P]` = safe in parallel (different files, no unfinished dependency). **No task that edits `DR` is ever `[P]`; all `DR`-editing tasks run strictly in ID order.** Paths are relative to repo root; `DR` = `specs/005-queue-cpu-feasibility-architecture/decision-record.md`; `EV` = `specs/005-queue-cpu-feasibility-architecture/evidence/`.

---

## Phase 1: Setup

**Purpose**: Create the deliverable skeleton, freeze a tamper-evident baseline, and state the authorization boundary.

- [ ] T001 [WRITE-DOC] Create `DR` as a skeleton with the 16 section headings and order defined in `specs/005-queue-cpu-feasibility-architecture/contracts/decision-record.md`, plus Appendix A (traceability), Appendix B (success-criteria result) and Appendix C (revision log, initial version R0). Each section initially "PENDING — see task Txxx". Section 1 (status banner) must read: "Feature 004 T007 is NOT cleared by this document. No live Cloudflare operation has been performed or authorized." Also create the directory `EV` (via a `README.md` naming it as supporting evidence for the decision record). Depends on: none. (FR-030, FR-036, SC-011, SC-013)
- [ ] T002 [REPO-READ] [WRITE-DOC] Create the protected-path baseline under `EV/baseline/` as **three sets**, representing the actual starting state at the time T002 runs. Depends on T001. Do not clean, reset, stash, commit or otherwise modify the working tree. Steps:
  1. Record `EV/baseline/state.txt`: timestamp, `git rev-parse HEAD`, current branch, `git status --short` (full output, including untracked).
  2. **Set A — ENFORCED** (`EV/baseline/set-A-files.txt` = exact sorted file list including untracked files; `EV/baseline/set-A.sha256` = SHA-256 of every listed file). Build the list from both tracked and untracked files (`git ls-files` plus `git ls-files --others --exclude-standard`, restricted to the roots below). Roots: `specs/001-code-intelligence-foundation` (Feature 001, code-intel foundation), `specs/002-ast-symbol-intelligence`, `specs/004-engineering-relationship-graph`, and — as documentation-only protection — the two other spec directories `specs/001-dynamic-github-sources` (the earlier dynamic-GitHub-sources feature; it shares the number prefix 001 but is a different feature from Feature 001) and `specs/003-github-source-enhancement`; `src/lib/code-intel/**` (including untracked `domain/relationship.ts` and `relationships/`, excluding the Set B files); `plugins/` (the Feature 001/002 queue consumers); `nitro.config.ts`; `wrangler.toml`; `data/code-intel-schema.sql`; `scripts/relationship-*.ts` are listed by name (the experiment script `scripts/query-cold-start-experiment.ts` belongs to Set B, not Set A); code-intel tests (`tests/contract/symbols/**`, `tests/integration/symbols/**`, and any other test file found by `grep -rl "code-intel" tests`); execution-surface files `package.json`, `tsconfig.json`, `bun.lock`, `bunfig.toml`; `.specify/feature.json`. **Feature 003 / dynamic-sources scope decision**: the *implementation* files of `specs/001-dynamic-github-sources` and `specs/003-github-source-enhancement` (atlas UI and GitHub-source data layer: `src/lib/github-fetch.ts`, `github-url.ts`, `sources-store.ts`, `connected-sources.ts`, `atlas-config.ts`, `source-input-mode.ts`, `repositories.functions.ts`, `src/lib/ai/**`, `src/routes/**`, `src/components/**`) are deliberately OUT of Set A and are recorded in Set C: they are not on the queue-consumer / symbol-extraction execution surface this workstream reasons about, and FR-034 protects Feature 001 (code-intel foundation) and Feature 002. Any Feature 003 change that lands inside `src/lib/code-intel/**`, `plugins/` or the schema is still covered by Set A. The two `specs/001-*` directories are never conflated. Additions, deletions and modifications must all be detectable: T046 regenerates the file list with the same commands and diffs it against the stored list (additions/deletions) **and** verifies hashes (modifications). `shasum -c` alone is not sufficient because it does not detect added files.
  3. **Set B — QUERY-CACHE** (`EV/baseline/set-B.sha256`, `EV/baseline/set-B.patch`): track the Query-cache experiment files separately — `src/lib/code-intel/symbols/to-intermediate-representation.ts` (the file whose diff matches Query-cache changes) and the experiment script `scripts/query-cold-start-experiment.ts` (its Query-cache association is confirmed or corrected in task T029) — with SHA-256 hashes and a saved diff of each file: `git diff -- <file>` for a tracked file, and `git diff --no-index -- /dev/null <file>` for an **untracked** file (plain `git diff` shows nothing for untracked files; exit status 1 from `--no-index` means "differs" and is expected). Every untracked file in Set A or Set B is covered by a content hash in its `.sha256` file. Files listed in Set B are excluded from Set A. Set B is enforced exactly like Set A (see T046); membership is fixed at T002 and is not reshuffled by the later hunk classification in T029. `src/lib/code-intel/config.ts` is Feature 004 scaffolding (relationship constants) and stays in Set A; the hunk classification of dirty files is performed later in task T029, not guessed here.
  4. **Set C — UNRELATED** (`EV/baseline/set-C-recorded.txt`): record, but do not enforce, every other dirty/untracked path from `git status` (for example `src/routes/**`, `src/routeTree.gen.ts`, `src/routes/about.tsx`, non-code-intel tests, docs). Unrelated UI or generated files are NOT put in Set A merely because they are under `src/`.
  5. **tsc baseline**: run `bunx tsc --noEmit` once and store the exit code and full output in `EV/baseline/tsc-baseline.txt` (pre-existing diagnostics are recorded as the baseline; this run writes no build output).
  6. Write `EV/baseline/README.md` with the exact commands used for each step so T046 repeats them identically.
  (FR-035, FR-034, D-A3, SC-010)
- [ ] T003 [WRITE-DOC] In `DR` §1, add an "Authorization boundary" table reproducing the activity-class table above (REPO-READ / DOC-RESEARCH / LOCAL-MEAS / LIVE-GATED), the Documentation-research restrictions, and the Global prohibitions list, stating that LIVE-GATED work is absent from this workstream and that any future live experiment needs explicit user authorization of that specific experiment. Depends on T001. (FR-036, SC-013)

**Checkpoint**: `DR` skeleton exists; three-set baseline recorded; boundary stated.

---

## Phase 2: Foundational — Evidence Catalogue and Repo Facts (blocks all user stories)

**Purpose**: Establish sourced evidence and resolve planning ambiguities R1 and R2 by reading only. Nothing in later phases may assert a fact not supported here. T004, T005, T006 and task T007 (scale tiers) each depend on T001 only and write four separate files under `EV/`, so they are the only parallel tasks.

- [ ] T004 [P] [DOC-RESEARCH] Create `EV/docs-workers-queues.md`: read the current official public Cloudflare pages — Workers "Limits", Workers "Pricing", Queues "Limits", Queues "Batching, Retries and Delays", Queues "Consumer concurrency", Queues "Pricing", Queues "How Queues works", Workers "How Workers works", "Wasm in JavaScript" (URLs in `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-research-report.md` §1 F1–F20). For each: page title, section, URL, date read, exact wording relevant to (a) queue-consumer CPU limit on Workers Free, (b) CPU accounting unit, (c) startup/global/WASM init, (d) isolate reuse, (e) batch/retry semantics; and whether it differs from the recorded finding. Documentation only: apply the Documentation-research restrictions (no Cloudflare MCP/API execution, dashboard, Wrangler, remote D1/Queues, deployments, live validation). Do not reconcile contradictions. Depends on T001. (FR-022, FR-024, FR-025, D-A1, SC-012)
- [ ] T005 [P] [DOC-RESEARCH] Create `EV/docs-observability.md`: read current official public pages — Workers Logs, Query Builder / Observability telemetry, Workers Trace Events (dataset), Logpush, Tail Workers, Workers Metrics and analytics, Errors and exceptions (URLs in `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-observability-report.md` D1–D16). Record title/section/URL/date read, what each explicitly establishes about CPU-time fields, queue-invocation coverage, Free vs Paid availability, whether CPU includes startup/init, outcome values (`exceededCpu` etc.). Documentation only: apply the Documentation-research restrictions. Do not reconcile contradictions C1–C4. Depends on T001. (FR-022, FR-023, FR-025, D-A1, SC-012)
- [ ] T006 [P] [REPO-READ] Resolve **R2**. Create `EV/repo-consumer-mapping.md` by reading (no execution) what the current code establishes, without inferring beyond it. Depends on T001. Inspect and cite file:line for at minimum: `wrangler.toml` (both `[[queues.consumers]]` blocks: `max_batch_size`, `max_retries`, and whether `max_batch_timeout` is set); `plugins/cloudflare-symbol-queue.ts` and `plugins/cloudflare-queue.ts` (how `batch.messages` is iterated, per-message `ack()`/`retry()` semantics, what is called per message); `src/lib/code-intel/symbols/symbol-worker.ts` (`processSymbolQueueMessage`, the `listSnapshotFilesPage(..., config.extractionBatchSize, ...)` call, the per-file loop, `enqueueNextUnit`); `src/lib/code-intel/config.ts` (`CODE_INTEL_EXTRACTION_BATCH_SIZE`, `CODE_INTEL_MAX_FILE_SIZE_BYTES`; also `CODE_INTEL_RELATIONSHIP_CONTAINS_BATCH_SIZE`, recorded separately as Feature 004 scaffolding, not as a consumer quantity); `nitro.config.ts`; Feature 002 `plan.md`/`data-model.md`. Produce a **four-row table**, each row with columns *value*, *source file/location*, *what is established*, *what remains unknown*:
  1. Queue configuration (Cloudflare `max_batch_size` and retry settings);
  2. Consumer invocation / message batch (how one `queue()` invocation iterates `batch.messages`; messages per invocation, if the code establishes a number);
  3. RepoAtlas files-per-message configuration (`extractionBatchSize` and what it bounds — e.g. a D1 page size);
  4. Files processed per invocation (filled ONLY if the code actually establishes it; otherwise "not established" with the derivation that is *not* made).
  Then state explicitly, as REPO-BEHAVIOR from the code, whether the current repository establishes **"one file per invocation"** (yes / no / unknown, with evidence). Do NOT infer this from Feature 004 planning language: Feature 004 `tasks.md`/`plan.md` statements (e.g. its planned extraction unit) are listed in a separate section "Planning assumptions (not evidence)". Also record where parsers/grammars/Queries are initialized (module scope vs per call). Mark anything not determinable as UNKNOWN. (Resolves R2; FR-002, FR-006, FR-031, SC-001)
- [ ] T007 [P] [REPO-READ] **Task T007 (scale tiers)** — resolve **R1**. Create `EV/scale-tiers.md` with four labeled tiers. Depends on T001. (1) *Measured 300-file run* — read `specs/004-engineering-relationship-graph/single-pass-spike-results.md` and `docs/investigations/004-single-pass-architecture-spike.md`; record exactly what was measured: 300 sequential single-pass extractions sampling rss/heapUsed/external and tree-delete counts (lifecycle/memory). State explicitly that this run **does NOT establish** CPU time, CPU budget compliance, per-invocation CPU, or production worst-case CPU, and that no timing was recorded; confirm the "300" column in the decomposition sweep tables (`combined-single-pass-decomposition-results.md`) is a **symbols** count (e.g. 300 symbols at 1500 lines), not a file count and not a 300-file run; confirm the *planned* 300-file CPU simulation (Feature 004 T073) is unchecked/unrun in `specs/004-engineering-relationship-graph/tasks.md` and do NOT run it. (2) *Configured limits* — queue `max_batch_size`, `CODE_INTEL_EXTRACTION_BATCH_SIZE`, `CODE_INTEL_MAX_FILE_SIZE_BYTES`, any other cap found (cross-reference `EV/repo-consumer-mapping.md`; do not merge the distinct quantities). (3) *Established production upper bound* — search `src/`, `plugins/`, `data/*.sql`, `specs/001*`, `specs/003*` for an enforced maximum files per snapshot/source (constants, validation, schema CHECKs); record the bound with file:line only if enforced, else "NOT ESTABLISHED". (4) *Unknown/unbounded*. State that tier 1 is not a worst case, and that a CPU conclusion, if one is needed, must come from a separately identified local measurement (comparative only) or authoritative platform evidence. (Resolves R1; D-A5, FR-008, SC-006)
- [ ] T008 [WRITE-DOC] Fill `DR` §2 (Evidence catalogue): a table of EvidenceRecords E1–E8 per `data-model.md` (id, provenance class OFFICIAL-DOC / PLATFORM-TELEMETRY / LOCAL-WALLCLOCK / REPO-BEHAVIOR, citation, scope, sample size/statistic/variability, permitted conclusions, forbidden conclusions). Take numbers only from the recorded result files (`specs/004-engineering-relationship-graph/*results.md`, `specs/002-ast-symbol-intelligence/query-cold-start-results.md`); OFFICIAL-DOC rows come from `EV/docs-workers-queues.md` and `EV/docs-observability.md`; add a "currency" column (date read, changed-since-recorded yes/no). Depends on T004, T005. (FR-022, FR-024, FR-025, SC-012)
- [ ] T009 [WRITE-DOC] Fill `DR` §16 (Open UNKNOWN register) initial state: U1 Free-plan queue-consumer CPU limit; U2 CPU accounting unit; U3 telemetry availability for queue invocations on Free; U4 whether reported CPU includes startup/init; U5 isolate reuse — each with status after T004/T005 (still UNKNOWN / now stated by page X, quoted) and the evidence that would resolve it. **Then record the explicit S1 result** in `DR` §16 as three yes/no answers with quoted page text where "yes": (i) does any official page now explicitly state the Workers Free queue-consumer CPU limit? (ii) does any page explicitly state the queue-consumer CPU accounting unit? (iii) does any page explicitly state that CPU telemetry is available for queue invocations on Free? Depends on T004, T005. (FR-025, SC-001)

**STOP GATE S1 (after T009; blocking on the recorded result)**: T010 and every later task depend on the S1 result line existing in `DR` §16. If any of the three answers is **YES**: record it in `EV/` and `DR`, do NOT treat it as clearing Feature 004 T007, do NOT alter plan decisions, and report to the user before continuing. If all three are **NO**: record "S1: NO/NO/NO" and continue. Continuing without a recorded yes/no result is not permitted.

**Checkpoint**: Evidence catalogue, UNKNOWN register, S1 result recorded; R1 and R2 answered from repository evidence. User-story phases may begin.

---

## Phase 3: User Story 1 — CPU accounting model (Priority: P1) 🎯

**Goal**: Record what is metered and where the boundaries are, without assuming.

**Independent Test**: In `DR` §3, every boundary/limit statement cites an OFFICIAL-DOC / PLATFORM-TELEMETRY / REPO-BEHAVIOR source or says `UNKNOWN`; every numeric-milliseconds hit in `DR` §3 is labeled unverified-candidate or LOCAL-WALLCLOCK.

- [ ] T010 [US1] [WRITE-DOC] Fill `DR` §3 "Accounting unit and boundaries": accounting unit (invocation / batch / message / file / UNKNOWN); invocation boundary, batch boundary, message boundary (from `EV/docs-workers-queues.md`), file-processing boundary and the four-row repository consumer table (from `EV/repo-consumer-mapping.md`, REPO-BEHAVIOR), including the explicit "one file per invocation" statement. Each with a citation or `UNKNOWN`. Depends on T006 and T009 (including the recorded S1 result). (FR-001, FR-002, SC-001)
- [ ] T011 [US1] [WRITE-DOC] Fill `DR` §3 "Source conflicts": list each Cloudflare statement about queue-consumer CPU verbatim with title/section/URL (Workers Limits — no queue row; Workers Pricing — Paid "15 minutes"; Queues Limits — "Configurable to 5 minutes", applies to both plans; any change found in T004) and the observability contradictions C1–C4 (from T005), explicitly unreconciled. Record Workers Free HTTP/Cron 10 ms only as an *unverified candidate for a different trigger*. Depends on T010. (FR-004, FR-026, US1 scenarios 2–3)
- [ ] T012 [US1] [WRITE-DOC] Fill `DR` §3 "Applicable limit and bounding requirement": `applicable_limit` = value/UNKNOWN + source + status (`established` | `unverified-candidate`), UNKNOWN unless OFFICIAL-DOC or PLATFORM-TELEMETRY supports it for the Queue Consumer path; state whether CPU must be bounded per file / per message / per invocation, or "undetermined" plus the exact evidence that would determine it. Do NOT write any numeric Queue CPU budget. Depends on T011. (FR-003, FR-026, D-A4)
- [ ] T013 [US1] [WRITE-DOC] Verify US1 independent test: re-read `DR` §3, confirm each boundary line has citation or UNKNOWN and no unqualified numeric limit; fix any violation in `DR`. Depends on T012. (SC-001)

**Checkpoint**: US1 complete; accounting vocabulary available for later phases.

---

## Phase 4: User Story 2 — Evidence standard and measurement requirements (Priority: P1)

**Goal**: Fix what counts as evidence so no measurement is over-interpreted; keep documentation research, local measurement, and future live validation distinct.

**Independent Test**: A reviewer can classify any proposed measurement from `DR` §4 as acceptable / comparative-only / rejected and state what it may conclude.

- [ ] T014 [US2] [WRITE-DOC] Fill `DR` §4a "Evidence acceptability": table from `contracts/measurement-protocol.md` (OFFICIAL-DOC, PLATFORM-TELEMETRY, LOCAL-WALLCLOCK, REPO-BEHAVIOR, not-accepted in-Worker timers) and a "What cannot be inferred from local measurements" list (platform CPU-ms, enforced limit, isolate reuse, what platform CPU includes) — local wall-clock is comparative only and never proof in either direction. Depends on T013. (FR-019, FR-024, US2 scenarios 1–3)
- [ ] T015 [US2] [WRITE-DOC] Fill `DR` §4b "Measurement protocol": define M1–M7 per `contracts/measurement-protocol.md` with required fields (basis, warmth cold/warm never averaged, unit file/message/batch/full-invocation, includes, sample size, statistic median + tail, variability, environment). Mark M1–M4 as `existing (local wall-clock, comparative)` and M5–M7 as `defined — platform CPU — NOT AUTHORIZED (LIVE-GATED)`. State that one sample never supports a gate conclusion and that the 300-sequential-extraction run (lifecycle/memory only) is not one of M1–M4. Depends on T014. (FR-018, FR-019, FR-020, FR-021)
- [ ] T016 [US2] [WRITE-DOC] Fill `DR` §4c "Required runtime telemetry": the platform-reported CPU measurement for the target Queue Consumer path must identify invocation type, outcome, and enough context to relate it to a known unit (file count/sizes via the app's own D1 records, since Cloudflare fields do not carry them); note Free-plan availability is UNKNOWN (U3) and cite the Workers Logs route from `EV/docs-observability.md`. Depends on T015. (FR-023, FR-024)
- [ ] T017 [US2] [REPO-READ] [WRITE-DOC] Classify every existing local measurement E2–E6 in `DR` §4d by protocol fields (basis, cold/warm, unit, includes, sample size, statistic, variability) by reading `specs/004-engineering-relationship-graph/{single-pass-spike,cpu-decomposition,combined-single-pass-decomposition}-results.md` and `specs/002-ast-symbol-intelligence/query-cold-start-results.md`; mark any field the source does not state as `NOT RECORDED` (do not infer). Depends on T008, T015, T016. (FR-020, FR-021, SC-012)
- [ ] T018 [US2] [WRITE-DOC] Create the evidence-gap register in `DR` §4e (D-A2/G8): for each requirement that needs evidence (FR-009–011, FR-016, FR-013, FR-024 etc.), state whether existing evidence E1–E8 + T004–task T007 (scale tiers) outputs are sufficient. Default outcome: "no additional local measurement needed". Any gap must name the question, why no existing evidence fills it, and which requirement it blocks. Record the explicit result "S2: gap named YES/NO". **Late-gap carry-forward rule**: a gap discovered after T018 (during T021–T039) MUST NOT trigger an unrecorded measurement. It is (1) recorded in `DR` §4e as a "late gap" with the question, the requirement it blocks and the task that found it; (2) treated as UNKNOWN in the affected sections, and therefore blocking wherever this file says UNKNOWN blocks (T025, T027, T039); (3) carried into `DR` §16 with the evidence that would resolve it; and (4) if a local-only measurement is judged necessary, proposed through an Appendix C revision entry and executed only under the T019 rules (question, script and write-side-effect check documented before running) — the user is told before it runs. Depends on T017. (FR-019, D-A2)
- [ ] T019 [US2] [LOCAL-MEAS] CONDITIONAL — execute only if T018 recorded "S2: gap named YES" (or a late gap has been carried forward under the T018 rule); otherwise mark this task "N/A — no gap named" with the T018 reference, do nothing, and treat it as a **completed task state** (so T020 may proceed). **No existing evidence/measurement script may be executed as part of T019** — this includes `scripts/query-cold-start-experiment.ts` and every `scripts/relationship-*.ts`: each hardcodes an output path that overwrites a protected Feature 002/004 results file (`specs/002-ast-symbol-intelligence/query-cold-start-results.md`; `specs/004-engineering-relationship-graph/*-results.md`). If a measurement is required: (1) first record in `DR` §4e the question, expected label (LOCAL-WALLCLOCK, comparative only), cold/warm, sample size and statistic; (2) create a **new** script under `EV/local-measurements/` (never under `scripts/`, `src/`, or `plugins/`) that writes only inside `EV/local-measurements/`; (3) **before executing, perform and record a write-side-effect check** in `EV/local-measurements/write-check.md`: read the new script and list every filesystem write, network call, and subprocess; confirm every write target is inside `EV/local-measurements/` and that there is no network, Cloudflare, D1, R2, Queue, or Wrangler use — if anything fails the check, do not run it and report; (4) run it locally only, no Cloudflare access, no open-ended benchmarking, results recorded with variability. Depends on T018. (D-A2, G8, FR-019–021)
- [ ] T020 [US2] [WRITE-DOC] Verify US2 independent test: sample three items (one OFFICIAL-DOC, one local number, one hypothetical in-Worker timer) and confirm §4a–4d classifies each correctly; fix `DR` if not. Depends on T019. (SC-012)

**Checkpoint**: US2 complete.

---

## Phase 5: User Story 3 — Processing unit with explicit budget (Priority: P2)

**Goal**: Evaluate the five unit shapes under every plausible accounting boundary; select a unit only when the safety conditions hold, otherwise state "no unit selectable yet".

**Independent Test**: `DR` §5–§7 and §10 contain all five shapes × the 8 canonical criteria; budgets are conditional analysis statements only; no unit is selected while budget X is UNKNOWN without a valid waiver; resource arithmetic uses four labeled scale tiers with counts only.

- [ ] T021 [US3] [WRITE-DOC] Fill `DR` §5 "Cold-start line items": grammar init, parser init, Query init, first-file, warm-file as separate LOCAL-WALLCLOCK line items from E5/E6 (each with its §4d classification, cold and warm separate, never averaged); `isolate_reuse_assumption = none guaranteed` (cite `EV/docs-workers-queues.md`); `platform_cpu_includes_init = UNKNOWN (U4)` unless `EV/docs-observability.md` shows otherwise; note per `EV/repo-consumer-mapping.md` where init happens (module scope vs per call). Depends on T005 (init-inclusion evidence), T008, T017, T020. (FR-009, FR-010, FR-011, FR-021, SC-003)
- [ ] T022 [US3] [WRITE-DOC] Fill `DR` §6 "Processing-unit evaluation": a matrix for all five shapes (one file per message; multiple files per message; multiple messages per invocation; bounded files per message; bounded total work per invocation) × accounting boundaries {file, message, batch/invocation} × the **eight canonical criteria of FR-006**: CPU exposure, queue operations, D1 read/write volume, R2 reads, retry granularity, duplicate-delivery impact, determinism, implementation complexity. "Budget fit" is a *derived conclusion* (CPU exposure compared against the T023 budget condition), reported as such and not as a ninth criterion. Use `EV/repo-consumer-mapping.md` to describe the *current* shape as REPO-BEHAVIOR; do not assume one file per invocation. Exposure under an unresolved boundary is reported for each boundary, not one. **Oversize handling**: evaluate a file that exceeds the configured maximum (`CODE_INTEL_MAX_FILE_SIZE_BYTES`, and any per-unit limit found in T006) and explicitly state what happens to a file that fits no currently considered processing unit (from the code in `EV/repo-consumer-mapping.md` and Feature 002's behavior for oversize/unsupported files), recording the outcome as `oversize_file_outcome` per shape. Depends on T010–T012, T006, T021. (FR-005, FR-006, FR-008, SC-002)
- [ ] T023 [US3] [WRITE-DOC] Fill `DR` §6 "CPU budget condition (analysis only)": for each shape, write the conditional statement "If the authoritative Queue Consumer execution model establishes CPU budget X for unit Y, the selected unit must remain within X with safety margin M" with X = UNKNOWN and M = a named parameter (not a number chosen without basis). This statement is an analysis statement only and is **never a basis for selecting a unit**. No numeric budget; do not use Workers Free HTTP 10 ms as X; state the cold-invocation justification requirement per shape and derive "budget fit" from it as a conclusion (not a criterion). Depends on T022. (FR-007, FR-010, FR-026, D-A4)
- [ ] T024 [US3] [WRITE-DOC] Fill `DR` §7 "Resource bounds" using `EV/scale-tiers.md` and `EV/repo-consumer-mapping.md`: four labeled tiers (measured 300-file run / configured limits / established production upper bound or NOT ESTABLISHED / unknown-unbounded); enforced maxima (files per message, messages per invocation, total work per invocation) and where each is enforced, or "unbounded: reason", keeping the four distinct repository quantities separate; worst-case per-invocation *work* (counts of messages and files), Queue operations per snapshot (Queues billing per message, 10,000 ops/day; cite `EV/docs-workers-queues.md`), D1 operations per snapshot vs D1 free-tier figures — locate the D1 free-tier limits from repo docs (`docs/plan.md`, `specs/001*`) or the official D1 pricing/limits public page and cite, else `UNKNOWN`. **Arithmetic is limited to counts** (messages, files, queue operations, D1 operations). It MUST NOT perform CPU-ms arithmetic that implies a CPU conclusion from the 300-file run, which recorded lifecycle/memory only; if a CPU conclusion is needed it must come from a separately identified local measurement (T019, comparative only) or authoritative platform evidence. Never label tier 1 a production worst case unless task T007 (scale tiers) found an enforced matching bound. Depends on task T007 (scale tiers), T006, T022. (FR-008, FR-027, D-A5, SC-006)
- [ ] T025 [US3] [WRITE-DOC] Fill `DR` §10 "Resilience and determinism" per unit shape: what is re-executed on failure/retry (using message/batch ack semantics from `EV/docs-workers-queues.md` F12/F13 and `EV/repo-consumer-mapping.md`), whether re-execution cost is bounded (FR-031), whether duplicate delivery yields identical persisted state (FR-032; cite the idempotency mechanism in Feature 002 code/data-model, read-only), and determinism across batch composition, message order, cold vs warm isolate (FR-033). Mark each as `shown` (with evidence id) or `UNKNOWN`. **UNKNOWN is a blocking state for selection** (see T027). Depends on T022. (FR-031, FR-032, FR-033, SC-007, SC-008, SC-009)
- [ ] T026 [US3] [WRITE-DOC] Add `DR` §6 "Plan-constraint check": each shape/architecture depends only on Workers Free, existing R2, Queues within 10,000 ops/day, D1 within free tier; any paid-service dependency (e.g., Trace Events/Logpush/Tail Workers, Paid CPU limit configuration) is reported as *out of constraint*, not adopted. Depends on T022. (FR-027)
- [ ] T027 [US3] [WRITE-DOC] Record `DR` §6 "Selection outcome" using this rule. A processing unit **may be selected only if ALL** hold: (a) the relevant CPU budget X is established by authoritative evidence (OFFICIAL-DOC or PLATFORM-TELEMETRY) **or** explicitly waived under the FR-038 waiver rules (a valid waiver record exists — none is created or assumed by this workstream); (b) bounded re-execution is shown (FR-031); (c) idempotence is shown (FR-032); (d) determinism is shown (FR-033); (e) a cold-invocation justification exists (FR-010); (f) the plan-constraint check (T026) passes; (g) the oversize-file / fits-no-unit case (T022) has a stated outcome. **If X remains UNKNOWN and there is no valid waiver — or any of (b)–(g) is UNKNOWN — the outcome MUST be "no unit selectable yet"**, listing the specific evidence that would resolve each blocker. The conditional budget statement of T023 is not a basis for selection. At most one unit may be selected. Depends on T023, T024, T025, T026. (FR-007, FR-010, FR-031–033, SC-002)
- [ ] T028 [US3] [WRITE-DOC] Verify US3 independent test: five shapes × eight criteria complete; at most one selected and only under the T027 rule; no numeric budget; four scale tiers present with counts-only arithmetic; oversize outcome stated; fix `DR`. Depends on T027. (SC-002, SC-003, SC-006, SC-007, SC-008, SC-009)

**Checkpoint**: US3 complete.

---

## Phase 6: User Story 4 — Single-pass vs two-pass and Query-cache decisions (Priority: P2)

**Goal**: Record two separate decisions, each evidence-backed and each explicitly *not* an approved implementation.

**Independent Test**: `DR` §8 and §9 contain the required comparisons; working-tree Query-cache status is stated; Set A and Set B baselines show no change (verified in T046).

- [ ] T029 [US4] [REPO-READ] Inventory the existing Query-cache experiment read-only: `git status --short`, `git diff -- src/lib/code-intel/ scripts/ tests/` and `git diff -- specs/002-ast-symbol-intelligence/query-cold-start-results.md` (read-only) to list dirty files and hunks, and — because plain `git diff` shows nothing for untracked files — `git diff --no-index -- /dev/null <file>` for each untracked file in scope (for example `scripts/query-cold-start-experiment.ts`, `specs/002-ast-symbol-intelligence/query-cold-start-results.md`, and the untracked files under `src/lib/code-intel/`); the scope explicitly includes `tests/` (for example the modified `tests/contract/symbols/to-intermediate-representation.test.ts`) and `specs/002-ast-symbol-intelligence/query-cold-start-results.md`; write `DR` §9 "Working-tree status (as found)" and `EV/hunk-classification.md`. **Classify every relevant dirty hunk** as one of: *Feature 004 scaffolding* / *Query Cache experiment* / *unknown or unrelated*, with the basis for each classification (what the hunk contains) — do not guess from filename alone; a hunk not explicitly inspected stays *unknown*. The baseline expectation to preserve (verify, do not assume): `src/lib/code-intel/config.ts` contains Feature 004 scaffolding (relationship constants), and `src/lib/code-intel/symbols/to-intermediate-representation.ts` is the file matching Query-cache-related changes. Compare against the T002 baseline to confirm no drift. Do not stage, stash, revert, edit, or run anything that changes these files (classification reads them only; the T002 baseline set memberships are not reshuffled). Depends on T002, T028. (FR-014, D-A3)
- [ ] T030 [US4] [WRITE-DOC] Fill `DR` §8 side-by-side table: current two-pass vs single-pass across cold CPU, warm CPU, queue operations, R2 reads, D1 volume, retry/idempotency, memory/tree lifecycle (E2 lifecycle result), determinism, Feature 002 boundary impact (including Feature 004's current no-modification constraint FR-017), complexity — each cell cites an evidence id and is labeled LOCAL-WALLCLOCK where applicable (≈31–33% cheaper locally is comparative only). Depends on T008, T017, T021, T029. (FR-016, SC-004)
- [ ] T031 [US4] [WRITE-DOC] Fill `DR` §8 "Verdict and boundary impact": one verdict — adopt / reject / defer (with the evidence that would decide) — worded as a *recommendation for review*, not an approval; single-pass extraction remains a decision candidate and is not implemented; list which Feature 002 and Feature 004 artifacts (paths only) would require amendment if single-pass were adopted; state that any change requires separate review/approval and Feature 002 is untouched. Depends on T030. (FR-015, FR-017, G6, SC-004)
- [ ] T032 [US4] [REPO-READ] [WRITE-DOC] Fill `DR` §9 "Query-cache decision": four separate distinctions — (a) steady-state benefit (E4, warm), (b) cold-isolate cost still incurred (E5/E6), (c) safe initialization and reuse (read the Query-cache hunks classified in T029 and Feature 002 query loading read-only: keying by language, isolate-lifetime safety, no stale/incorrect reuse, failure behavior on init error — analyze only hunks classified *Query Cache experiment*; unknown hunks remain unknown), (d) whether a separately approved Feature 002 change is required. Explicitly label the cache an *evidence-only, unadopted candidate decision, not an approved implementation*. Depends on T029, T031. (FR-012, FR-013, SC-005)
- [ ] T033 [US4] [WRITE-DOC] Fill `DR` §9 "Working-tree status recommendation": one of retain / revert / adopt-by-separate-approval, with rationale; state that no action was taken by this workstream, that the experiment remains unmodified and unadopted, and that any production change requires separate approval. Depends on T032. (FR-014, D-A3, SC-005)
- [ ] T034 [US4] [WRITE-DOC] Fill `DR` §11 "Feature 001/002 regression impact": list every Feature 001/002 behavior the decision could affect (snapshot persistence, Feature 002 grammar loading, symbol queries, extraction pipeline, extraction batch size, queue consumers in `plugins/`) each marked *unaffected* or *requires separately approved amendment*. Depends on T031, T033. (FR-034, SC-010)
- [ ] T035 [US4] [WRITE-DOC] Verify US4 independent test: all FR-016 criteria present in §8; §9 has all four FR-013 distinctions and the FR-014 status; hunk classification present; fix `DR`. Depends on T034. (SC-004, SC-005, SC-010)

**Checkpoint**: US4 complete.

---

## Phase 7: User Story 5 — Feature 004 T007 disposition (Priority: P3)

**Goal**: Draft the (unauthorized) live proposal and waiver posture, then record exactly one disposition.

**Independent Test**: `DR` §12–§16 and Appendix C contain exactly one disposition; each FR-028 condition (a)–(e) is marked; the live proposal carries "NOT AUTHORIZED"; no waiver is assumed and a later waiver can be recorded through Appendix C.

- [ ] T036 [US5] [DOC-RESEARCH] Read (public documentation only; apply the Documentation-research restrictions) the Cloudflare Observability telemetry query API / query-language pages (D16, previously unread) and append to `EV/docs-observability.md` whether `$workers.cpuTimeMs`, `$workers.eventType`, `$workers.outcome` are documented keys and their semantics. This is an offline precondition for the live proposal. Depends on T035. (FR-025, FR-023)
- [ ] T037 [US5] [WRITE-DOC] Create `specs/005-queue-cpu-feasibility-architecture/live-experiment-proposal.md` from `contracts/live-experiment-proposal.md`: banner `STATUS: NOT AUTHORIZED` / `Authorization ref: (none)`; question answered; preconditions; resources touched (minimal); exact steps marking any step that is a deployment (enabling observability is a config change + redeploy); expected observations; reversal steps; cleanup verification; failure handling if reversion fails (state what remains changed and stop for user direction); Queue-operation/D1/R2 cost impact; post-execution log left blank. Documents only — nothing is run. Depends on T036, T015, T016, T027. (FR-036, SC-013)
- [ ] T038 [US5] [WRITE-DOC] Fill `DR` §12 (pointer to the proposal, "NOT AUTHORIZED") and §13 "Waiver status": state **"No waiver exists at this point in the workstream."** (a dated statement, not a permanent one), restate FR-038 requirements (names gate condition, reasoning/evidence, residual risk, withdrawal conditions; not inferable from silence/general "proceed"/local measurements), that FR-029 says a design-margin argument alone cannot clear Feature 004 T007, and that a later explicitly authorized waiver is recorded as a waiver file per `contracts/waiver.md` plus an Appendix C revision entry after which T039–T043 are re-run for the affected conditions. State that any waiver that touches the CPU budget (gate condition (b), or the selection rule of T027(a)) must explicitly name the assumed CPU budget X, the safety margin M, and the selected processing unit. Do NOT create or grant a waiver file. Depends on T037. (FR-029, FR-038, SC-013)
- [ ] T039 [US5] [DOC-RESEARCH] [WRITE-DOC] **First**, perform the FR-025 documentation re-verification immediately before the disposition: re-read (documentation only) the public pages that bear on gate conditions (a)–(e) — at least Workers Limits, Queues Limits, Workers Pricing, and the observability pages relevant to queue CPU telemetry — record date read in `DR` §14 and `EV/docs-*.md`; if any page changed in a way that bears on S1's three questions, redo the S1 yes/no result and stop for the user as in S1. **Then** fill `DR` §14 "Gate conditions": mark FR-028 (a) accounting semantics, (b) processing unit with explicit budget, (c) cold-start understanding, (d) bounded architecture, (e) telemetry/validation available — each `satisfied` / `unsatisfied` / `waived(ref)` with evidence ids from §2–§10; apply the telemetry default (no authoritative queue CPU telemetry ⇒ STOPPED unless waived). Where a condition rests on UNKNOWN evidence it is `unsatisfied`. List the evidence that would change each unsatisfied condition. Confirm every late gap carried forward under the T018 rule appears in `DR` §4e and §16. Depends on T013, T020, T028, T035, T038. (FR-025, FR-028, FR-029, SC-011)
- [ ] T040 [US5] [WRITE-DOC] Record `DR` §14 "Disposition": exactly one of STOPPED / REDEFINED / CLEARED, using the definitions in `contracts/decision-record.md`: **STOPPED** = any FR-028 condition unsatisfied and not validly waived (including insufficient evidence) — the default; **CLEARED** = the evidence conditions for the Feature 004 T007 gate are satisfied (or validly waived), recorded as a *recommendation only* — this record does NOT clear Feature 004 T007 and effective clearance requires the appropriate reviewed Feature 004 amendment/process (FR-030, FR-037); **REDEFINED** = the original gate condition is no longer the correct gate because the architecture or execution model has materially changed (state the change, why the original wording no longer applies, and the proposed replacement gate; effective only via a reviewed Feature 004 amendment). Do not edit `specs/004-engineering-relationship-graph/tasks.md` or any Feature 004 artifact; do not mark Feature 004 T007 cleared. Depends on T039. (FR-028, FR-030, SC-011)
- [ ] T041 [US5] [WRITE-DOC] Fill `DR` §15 "Amendment policy and list": state Feature 004 is amended in place after review (no replacement feature), amendment does not begin until this record is reviewed; list (paths only) Feature 004 and any Feature 002 artifacts that would need amendment given §8/§9/§14 outcomes, or "none indicated". No amendment performed. Depends on T031, T040. (FR-035, FR-037, SC-013)
- [ ] T042 [US5] [WRITE-DOC] Finalize `DR` §16 "Open UNKNOWN register": carry forward every unresolved item from T009, T012, T021, T024, T025, T027 with what would resolve it. Depends on T027, T040. (FR-025, SC-001)
- [ ] T043 [US5] [WRITE-DOC] Verify US5 independent test: exactly one disposition; conditions (a)–(e) each marked; live proposal marked NOT AUTHORIZED; §13 states the dated "no waiver at this point" and Appendix C can record a later waiver; fix `DR`. Depends on T042. (SC-011, SC-013)

**CHECKPOINT S3 (after T043; presentation only, NON-BLOCKING)**: Produce a short status summary for the user (disposition, key UNKNOWNs, artifacts). This is a review/presentation checkpoint, not a gate: execution continues to T044 without waiting and no approval is implied. Do not amend Feature 004, do not modify Feature 002, do not run any live operation.

**Checkpoint**: US5 complete.

---

## Phase 8: Polish and Cross-Cutting Verification

- [ ] T044 [WRITE-DOC] Append to `DR` "Appendix A: Requirement traceability" mapping FR-001..FR-038 and SC-001..SC-013 to the section and task that satisfy each (use the coverage tables at the bottom of this `tasks.md`); flag any FR/SC without content. Depends on T043. (all FRs, all SCs)
- [ ] T045 [REPO-READ] Forbidden-statement scan of `DR`, `EV/*.md`, and `live-experiment-proposal.md` against the "Forbidden statements" list in `contracts/decision-record.md`: `grep -nE "10 ?ms|budget|300"` and manual review for unqualified numeric limits, averaged cold/warm figures, the 300-file run called a worst case or used for a CPU conclusion, assumed one-file-per-invocation, a unit selected while X is UNKNOWN, Query-cache/single-pass described as approved, a waiver inferred or "no waiver" hardcoded as permanent; fix each hit in the offending file. Depends on T044. (FR-019, FR-026, D-A4, D-A5)
- [ ] T046 [REPO-READ] **STOP GATE S4 check — verify protected-path integrity** by repeating exactly the commands in `EV/baseline/README.md`: (Set A) regenerate the file list with the same commands and `diff` it against `EV/baseline/set-A-files.txt` (detects additions and deletions), **then** verify SHA-256 hashes against `EV/baseline/set-A.sha256` (detects modifications); (Set B) compare hashes and the saved diff against `EV/baseline/set-B.sha256`/`set-B.patch`, regenerating the diff with the same command per file (`git diff -- <file>` tracked; `git diff --no-index -- /dev/null <file>` untracked) — Query-cache experiment files must be byte-identical; Set A and Set B are both enforced; (Set C) compare against `EV/baseline/set-C-recorded.txt` and report differences as **informational only** (they may be concurrent unrelated work) — Set C never triggers a stop. Files under `specs/005-queue-cpu-feasibility-architecture/` and the three logs appended in T048 are outside Sets A/B and are allowed to differ. Any Set A or Set B difference ⇒ STOP: report the exact paths, do not revert automatically, and do not run T047–T049 until the user directs. Depends on T045, T002. (FR-035, FR-034, SC-010, D-A3)
- [ ] T047 [REPO-READ] Run the review checklist in `specs/005-queue-cpu-feasibility-architecture/quickstart.md` against `DR` and record pass/fail for SC-001..SC-013 in `DR` Appendix B; also run `bunx tsc --noEmit` and **compare its exit code and output with the baseline recorded in `EV/baseline/tsc-baseline.txt`** (T002): pre-existing diagnostics are not a Feature 005 failure; any new or changed diagnostics are reported and must be attributed. Any checklist fail ⇒ fix the owning section and re-check. Depends on T046 (S4 passed). (SC-001..SC-013)
- [ ] T048 [WRITE-DOC] Per standing project practice, append dated entries (no rewriting of existing ones) to `docs/progress/PROGRESS.md`, `docs/audit_reports/audit-log.md` (record: sources read incl. public docs, local measurements run or "none", live operations "none", disposition), and `docs/prompts/claude-prompts/prompt-log.md` (the user prompt verbatim). Depends on T047. (D-A6)
- [ ] T049 [WRITE-DOC] **Finalization task.** Finalize revision entry R0 in `DR` Appendix C (created as a skeleton in T001; fill date, initial disposition, checks run) and give the final report to the user: disposition, what evidence would change it, R1/R2 answers (four-row consumer table and scale tiers), list of artifacts, S1/S2 results, baseline results (Sets A/B/C, tsc); confirm Feature 004 T007 status unchanged and no amendment begun. Then STOP (Stop Gate S5). Depends on T048. (Finalizes FR-030, FR-036, FR-037, SC-011, SC-013 by confirming the record's status statements; introduces no new requirement.)

**STOP GATE S5 (end of execution)**: End of Feature 005 execution. Next steps (Feature 004 amendment, any live-experiment authorization, any waiver, any Feature 002 approval, a follow-up `/speckit-analyze`) require explicit user instruction.

---

## Dependencies and Execution Order

```
T001 ─► T002, T003
T001 ─► T004 ┐
T001 ─► T005 ├─ [P] (four separate EV files) ─► T008 (T004,T005), T009 (T004,T005) ─► [S1 recorded]
T001 ─► T006 │
T001 ─► T007 ┘  (task T007 (scale tiers))
[S1] ─► US1: T010 (T006,T009) → T011 → T012 → T013
US1 ─► US2: T014 → T015 → T016 → T017 (T008,T015,T016) → T018 ─[S2 result]─► T019 (conditional) → T020
US2 ─► US3: T021 (T005,T008,T017,T020) → T022 → T023 → T024 (task T007 (scale tiers), T006) → T025 → T026 → T027 → T028
US3 ─► US4: T029 (T002,T028) → T030 → T031 → T032 → T033 → T034 → T035
US4 ─► US5: T036 → T037 → T038 → T039 → T040 → T041 → T042 → T043 ─► [CHECKPOINT S3, non-blocking]
Polish: T044 → T045 → T046 [S4: blocking] → T047 → T048 → T049 ─► [S5 end]
```

- **Setup** has no unfinished dependency beyond T001; **Foundational** blocks all stories.
- **No task that edits `DR` is `[P]`.** T010–T049 that edit `DR` run strictly in ID order; US1 and US2 are NOT interleaved (both edit `DR`); T014 starts only after T013.
- **The only parallel tasks** are T004, T005, T006 and task T007 (scale tiers), which write four distinct `EV/*.md` files.
- **Explicit cross-dependencies added by remediation**: T010 depends on T006 (and on T009's S1 result); T021 depends on T005; T044–T049 form a chain; T002 depends on T001.
- Parallel example: `T004`, `T005`, `T006` and task T007 (scale tiers) together.

## Stop Gates (ordered by actual occurrence)

| ID | When it occurs | Type | Trigger | Required action |
|---|---|---|---|---|
| S0 | Global, any task | Blocking | Any task would need a prohibited action (deploy/push/Wrangler/Cloudflare MCP/API/dashboard/resource access/D1-R2-Queue access/live validation/edits to Feature 001–004, `src/`, `scripts/`, `plugins/`) | STOP, report, wait for user |
| S1 | After T009 | Blocking, explicit yes/no | The recorded S1 result answers three yes/no questions (Free queue-consumer CPU limit stated? accounting unit stated? queue telemetry on Free stated?). Any YES | Record, do not clear Feature 004 T007, report before continuing. All-NO must still be recorded before T010 may start (T010 depends on the recorded result) |
| S2 | After T018 | Result recorded; conditional action | T018 records "S2: gap named YES/NO". YES (or a late gap carried forward under the T018 rule) | Document the question first; create a NEW script under `EV/local-measurements/`; record the write-side-effect check before running; no existing script may be executed; if it would require Cloudflare or a write outside `EV/local-measurements/`, STOP. NO ⇒ T019 is N/A and counts as completed |
| S3 | After T043 | **Non-blocking review/presentation checkpoint** | Decision record content complete | Present a status summary; execution continues to T044; no approval implied |
| S4 | T046 | **Blocking; cannot be bypassed** | Any Set A or Set B drift (Set C is informational) | STOP and report exact paths; T047, T048, T049 must not run until the user directs; do not auto-revert |
| S5 | After T049 | Terminal | End of Feature 005 execution | STOP; follow-ups need explicit user instruction |

All gates are consistent with the local-first policy: none authorizes a live operation.

## Live-Operation Authorization Gates

- **No task in this file is `[LIVE-GATED]`.** Feature 005 execution performs zero live operations. Documentation research (T004, T005, T036, T039) is documentation-only and is not Cloudflare resource access (D-A1).
- The only live-related output is `live-experiment-proposal.md` (T037), a document with `STATUS: NOT AUTHORIZED`.
- A future live measurement (M5–M7) requires: (1) the exact experiment documented (T037 satisfies this precondition only), (2) the user's explicit authorization naming that experiment, (3) minimal, reversible, resource-limited scope, (4) documented cleanup with a change/revert log (FR-036). No blanket authorization exists; clarification/plan approvals grant none.
- A waiver (FR-038) is a separate user decision; T038 creates none and states only that none exists at this point in the workstream.

## Decision Artifacts Produced

| Artifact | Task(s) |
|---|---|
| `specs/005-queue-cpu-feasibility-architecture/decision-record.md` (16 sections + Appendix A traceability, B success-criteria result, C revision log) | T001, T003, T008–T049 |
| `EV/docs-workers-queues.md`, `EV/docs-observability.md` (documentation research) | T004, T005, T036, T039 |
| `EV/repo-consumer-mapping.md` (R2 resolution, four-row table) | T006 |
| `EV/scale-tiers.md` (R1 resolution) | task T007 (scale tiers) |
| `EV/baseline/` (Set A list+hashes, Set B hashes+patch, Set C record, state, tsc baseline, README) | T002 |
| `EV/hunk-classification.md` | T029 |
| `EV/local-measurements/` incl. `write-check.md` and the new script (only if T019 executes) | T019 |
| `specs/005-queue-cpu-feasibility-architecture/live-experiment-proposal.md` (NOT AUTHORIZED) | T037 |
| Log entries (PROGRESS.md, audit-log.md, prompt-log.md) | T048 |

No waiver file, no amendment to Feature 004/002, no source changes.

## Functional Requirement Coverage (all 38)

| FR | Task(s) | FR | Task(s) |
|---|---|---|---|
| FR-001 | T010 | FR-020 | T015, T017, T019 |
| FR-002 | T006, T010 | FR-021 | T015, T017, T021 |
| FR-003 | T012 | FR-022 | T004, T005, T008 |
| FR-004 | T011 | FR-023 | T005, T016, T036 |
| FR-005 | T022 | FR-024 | T004, T008, T014, T016 |
| FR-006 | T006, T022 | FR-025 | T004, T005, T008, T009, T036, T039, T042 |
| FR-007 | T023, T027 | FR-026 | T011, T012, T023, T045 |
| FR-008 | task T007 (scale tiers), T022, T024 | FR-027 | T024, T026 |
| FR-009 | T021 | FR-028 | T039, T040 |
| FR-010 | T021, T023, T027 | FR-029 | T038, T039 |
| FR-011 | T021 | FR-030 | T001, T040 |
| FR-012 | T032 | FR-031 | T006, T025, T027 |
| FR-013 | T032 | FR-032 | T025, T027 |
| FR-014 | T029, T033 | FR-033 | T025, T027 |
| FR-015 | T031 | FR-034 | T002, T034, T046 |
| FR-016 | T030 | FR-035 | T002, T041, T046 |
| FR-017 | T031 | FR-036 | T001, T003, T037 |
| FR-018 | T015 | FR-037 | T041 |
| FR-019 | T014, T015, T018 | FR-038 | T027, T038 |

## Success Criteria Coverage (SC-001..SC-013)

| SC | Task(s) |
|---|---|
| SC-001 | T009, T010–T013, T042 |
| SC-002 | T022, T027, T028 |
| SC-003 | T021, T028 |
| SC-004 | T030, T031, T035 |
| SC-005 | T032, T033, T035 |
| SC-006 | task T007 (scale tiers), T024, T028 |
| SC-007 | T025, T028 |
| SC-008 | T025, T028 |
| SC-009 | T025, T028 |
| SC-010 | T002, T034, T046 |
| SC-011 | T039, T040, T043 |
| SC-012 | T004, T005, T008, T017, T020 |
| SC-013 | T003, T037, T038, T041, T043 |

## Planning Decisions and Ambiguities — Where Preserved

| Item | Preserved by |
|---|---|
| D-A1 public docs allowed (documentation only) | T004, T005, T036, T039; Documentation-research restrictions; global prohibitions |
| D-A2 local measurement only for named gap | T018, T019, S2 |
| D-A3 Query-cache experiment untouched, unadopted | T002 (Set B), T029, T033, T046, global prohibitions |
| D-A4 no invented budget; no selection while X UNKNOWN | T012, T023, T027, T045 |
| D-A5 300-file run ≠ worst case, lifecycle/memory only | task T007 (scale tiers), T024, T045 |
| D-A6 keep logs | T048 (append only) |
| R1 (300-file evidence) | task T007 (scale tiers) |
| R2 (batching quantities; four-row table) | T006 |
| Feature 004 T007 gate (never cleared by this workstream) | T001, T038, T039, T040, T049; S1; global prohibitions |

## Implementation Strategy

1. **Minimum defensible increment (MVP)**: Phases 1–2 + US1 + US2 (T001–T020). This alone yields an evidence-classified accounting model and measurement standard; sufficient to justify that Feature 004 T007 stays STOPPED.
2. Add US3 (unit evaluation) → US4 (architecture/cache decisions) → US5 (disposition). Each phase leaves `DR` in a reviewable state.
3. Stop at S4/S5; nothing beyond the decision record is authorized.
