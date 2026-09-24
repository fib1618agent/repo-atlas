# Decision Record: Queue CPU Feasibility and Processing-Unit Architecture

**Feature**: `specs/005-queue-cpu-feasibility-architecture/`
**Structure governed by**: `contracts/decision-record.md` (16 sections + Appendices A, B, C)
**Record status**: SKELETON — created by task T001. Every section below is PENDING until the named task fills it.

## 1. Status banner

**Feature 004 T007 is NOT cleared by this document. No live Cloudflare operation has been performed or authorized.**

### Authorization boundary

This decision record is produced by documentation, repository reading and (only if a named evidence gap requires it) isolated local measurement. It is **local-first**. Every Feature 005 task carries exactly one of the activity tags below. `EV` in the table means `specs/005-queue-cpu-feasibility-architecture/evidence/`; `DR` means this decision record.

| Tag | Meaning | Permitted? |
|---|---|---|
| `[REPO-READ]` | Read repository files/config/git state read-only | Yes |
| `[DOC-RESEARCH]` | Read official public Cloudflare documentation as documentation only, using WebFetch/WebSearch on public documentation pages | Yes (D-A1) — research, not resource access. See "Documentation-research restrictions" |
| `[LOCAL-MEAS]` | Run a local-only measurement using a newly created script under `EV/local-measurements/` (no existing script may be executed) | Only when a planned step names a concrete evidence gap; documented before running; write-side-effect check first; comparative only (D-A2, G8) |
| `[WRITE-DOC]` | Write/edit a file under `specs/005-queue-cpu-feasibility-architecture/` (or, in T048 only, append to the three project logs) | Yes |
| `[LIVE-GATED]` | Anything touching Cloudflare resources | **NOT AUTHORIZED. No task in `tasks.md` performs one. Drafting a proposal is `[WRITE-DOC]`.** |

**Documentation-research restrictions** (apply to every `[DOC-RESEARCH]` task: T004, T005, T036, T039):

Public Cloudflare documentation may be accessed **only as documentation** (WebFetch/WebSearch of public pages). Explicitly prohibited during doc research: Cloudflare MCP tools and Cloudflare API execution (this includes every `mcp__plugin_cloudflare_*` tool), the Cloudflare dashboard, Wrangler, remote D1, remote Queues, remote R2, deployments, and any production/live validation. Reading a documentation page is never treated as resource access, and no credentials or account context are used.

**Global prohibitions (G0 — apply to every task):**

No deployment; no push; no Wrangler; no Cloudflare API/MCP/dashboard/resource access; no D1/R2/Queue mutation or remote read; no live validation; no edits to Feature 002, Feature 004, Feature 001/003 artifacts, `src/`, `scripts/`, `plugins/`, `wrangler.toml`, `nitro.config.ts`, or `data/`; no cleaning, resetting, stashing, or committing of the working tree; no adoption/reversion/modification/removal of the working-tree Query-cache experiment; no implementation of Query Cache, single-pass extraction, or Feature 004 relationship extraction; no execution of any existing evidence/measurement script (each hardcodes an output path that overwrites a protected Feature 002/004 results file); no creation or granting of a waiver; no numeric Queue CPU budget invented; Workers Free HTTP 10 ms never used as the Queue Consumer budget without authoritative evidence; the 300-file run never called a production worst case and never used for a CPU conclusion. If a task appears to require any of these: STOP and report (see the Stop Gates in `tasks.md`).

**Live work is absent from this workstream.** No `[LIVE-GATED]` task exists in Feature 005 and none is performed by it. Documentation research is not Cloudflare resource access (planning decision D-A1). Any future live Cloudflare experiment (measurements M5–M7 in §4b) requires the user's **explicit authorization of that specific experiment**, after the exact experiment has been documented and is minimal, reversible, limited to the required resources, and followed by documented cleanup (FR-036). No blanket authorization exists, and neither the clarification session nor the plan approval grants one. Any live-experiment proposal produced by this workstream is marked `NOT AUTHORIZED`.

## 2. Evidence catalogue

Filled by task T008. Every record below follows `data-model.md` → EvidenceRecord (id, provenance, citation, scope, sample, permitted conclusions, forbidden conclusions) plus a **currency** column (FR-025). Numbers are copied only from the recorded result files named in each citation; nothing was re-measured and no script was run. Provenance classes: `OFFICIAL-DOC`, `PLATFORM-TELEMETRY`, `LOCAL-WALLCLOCK`, `REPO-BEHAVIOR`. **No PLATFORM-TELEMETRY record exists** — no platform-reported CPU value has been obtained. Evidence status labels: FACT / INCOMPLETE / UNVERIFIED / CONTRADICTION / UNKNOWN.

**Rules applied to the whole catalogue**

- LOCAL-WALLCLOCK records (E1–E6) are relative-comparison evidence only. They MUST NOT be cited for any "CPU-safe", "within budget" or "the limit is N" claim (FR-019, FR-024). Every one of their source files states it is a local wall-clock proxy on this machine under Bun, not Cloudflare Workers CPU.
- OFFICIAL-DOC evidence (E7, E8) was read through WebFetch **extraction**. Extracted text is evidence; **omitted text is UNVERIFIED and is not proof of absence** (T004/T005 read-method limitation, kept unchanged).
- No numeric Free-plan Queue Consumer CPU budget is asserted by any record. The commonly cited Workers Free HTTP 10 ms is not treated as a queue-consumer limit.
- Contradictions are listed and left unreconciled.

### 2.1 Evidence records

| id | provenance | citation | scope | sample / statistic / variability | permitted conclusions | forbidden conclusions | currency |
|---|---|---|---|---|---|---|---|
| **E1** | LOCAL-WALLCLOCK | `specs/004-engineering-relationship-graph/feasibility-results.md` (T006 spike; header generated 2026-09-21T21:10:57Z). Relates to `research.md` §1 (Feature 004). | Relationship-extraction pass only: re-parse one fixture → relationship `.scm` query → stubbed in-memory resolution. Warm/steady-state per the run loop; single file; no queue, D1, R2, startup, or cold isolate. Fixtures: small / medium / large / callsHeavy × java, javascript, typescript, tsx. | 20 iterations per row (stated in the file). min / median / p95 / max. In every row of the recorded table p95 equals max. Values: **large** fixtures median 9.482 (java), 9.552 (js), 10.462 (ts), 9.582 (tsx) ms; p95 12.216 / 9.723 / 11.237 / 10.033 ms. **medium** p95 ≤ 2.752 ms (max of the four medium rows: java 2.752). small and callsHeavy p95 ≤ 1.751 ms. File's own classification of large fixtures: "likely unsafe" (p95 > 8 ms), at its own local thresholds. Warm-up count not stated in this file. | Comparative local ordering: on this machine the second (relationship) parse pass over a large fixture costs several times a medium one; motivates evaluating a single-pass alternative. Motivated the Feature 004 T007 STOP. | That any fixture is or is not within a Cloudflare CPU limit; that "likely unsafe/comfortably bounded" is a platform classification (the 3 ms / 8 ms thresholds are local labels, not platform limits); that the 10 ms Workers Free HTTP figure applies to queue consumers. | Not re-measured by Feature 005. Currency N/A (repository record; header date above). |
| **E2** | LOCAL-WALLCLOCK (timing); the memory table is local-process memory only | `specs/004-engineering-relationship-graph/single-pass-spike-results.md` (generated 2026-09-21T21:43:07Z); `docs/investigations/004-single-pass-architecture-spike.md` (§6). Producing script read only: `scripts/relationship-single-pass-spike.ts`. | Scenarios A (symbol parse), B (relationship second parse), C (hypothetical single-pass), local Bun, real production `getParser` / `toIntermediateRepresentation`, synthetic sweep + calls-heavy/dense fixtures + three real repo TSX files. **Memory / tree-lifecycle test**: 300 sequential single-pass extractions, process memory sampled every 50 files; **no timing recorded** for that test. | Sweep: 20 timed iterations, 5 warm-up — **these counts are read from the script constants (`ITERATIONS = 20`, `WARMUP = 5`, `relationship-single-pass-spike.ts:43-44`); the results file does not state them → INCOMPLETE** for the results file itself. min/median/p95/max recorded. Phase breakdown at 2500 lines, median: two-pass total vs C — java 65.386 vs 44.037 ms (32.7 % lower), javascript 64.494 vs 44.726 (30.7 %), typescript 79.667 vs 54.726 (31.3 %), tsx 99.556 vs 66.522 (33.2 %). Memory test: rss 540.2 → 553.4 MB, heapUsed 187.2 → 194.5 MB, external 140.4 → 142.9 MB across 300 files; 300 tree creations / 300 `tree.delete()`; parser instance reused (`getParser` twice → same instance). Local `--expose-gc` not necessarily enabled; RSS is a trend. | Locally, single-pass (C) was roughly 31–33 % cheaper than two-pass (A+B) at 2500 lines in this synthetic sweep — a **candidate** comparison only. Parser reuse works in production code locally; tree-lifecycle by construction shows no leaked `Tree` in the script's loop. | That single-pass is approved, adopted, or safe on Cloudflare; the memory result as evidence of Cloudflare isolate memory behaviour; the 300-file run as CPU evidence, a CPU worst case, per-invocation CPU or a production upper bound (see `evidence/scale-tiers.md` tier 1: no timing recorded). "300" here is a file count of the synthetic memory loop only. | Not re-measured. Currency N/A. |
| **E3** | LOCAL-WALLCLOCK | `specs/004-engineering-relationship-graph/combined-single-pass-decomposition-results.md`; `specs/004-engineering-relationship-graph/cpu-decomposition-results.md` (generated 2026-09-21T21:24:02Z). Related code observation: `src/lib/code-intel/symbols/to-intermediate-representation.ts:48` at `HEAD` (`new Query` per call). | Phase attribution (C1 parse, C2raw symbols+hash, C3 relationship observation, C4 isolated hashing, C5 total). Resolution excluded. Warm-cache steady state. "300" in this file's sweep tables is a **symbols** count (see `scale-tiers.md` tier 1). | 20 timed + 5 warm-up iterations per fixture (stated in both files). Attribution at the largest ordinary size (1500 lines): parse 37.4–49.9 %, symbols+hash 35.2–52.1 %, relationship observation 10.4–17.4 % of C5; hashing 1.9–5.2 % of C2raw; on real files hashing ≈ 0.0–0.1 % of C2raw. Isolated Query-compile medians (warm process): java 0.793, javascript 1.062, typescript 4.359, tsx 4.752 ms (p95 1.741 / 1.486 / 4.549 / 5.280); the file attributes ≈ 85–95 % of C2raw on the real TS/TSX files to per-call compilation. Tree lifecycle line in this file: "820 trees created / 820 deleted"; the same file also says each fixture parsed "20 timed + 5 warmup = 25 trees" over 41 fixtures (= 1025) — **INCOMPLETE: the two counts as recorded do not match (820 = 41 × 20); not reconciled here**. rss 70.8 → 471.8 MB. Sample size of the isolated compile loop is not stated in the sections read → UNKNOWN. `cpu-decomposition-results.md`: steady-state, per-family diagnostics are not additive (its own caveat); its numbers are not used here. | Relative attribution of local time: hashing is negligible; relationship observation is comparatively small; parse and (before the cache) per-call Query compilation dominate; motivates the Query-cache candidate. | Any platform CPU claim; using the isolated compile figures as cold-isolate costs (they are warm-process); using the percentage attribution as Cloudflare accounting; treating `cpu-decomposition-results.md` per-family columns as additive. | Not re-measured. Currency N/A. |
| **E4** | LOCAL-WALLCLOCK | Same file as E3, section "Post query-cache mitigation" (`combined-single-pass-decomposition-results.md`, from the heading at line 172). Change measured is the **working-tree Query-cache experiment** (unadopted, unmodified by Feature 005; Set B in `evidence/baseline/`). | Warm-cache, real-file and synthetic, single file; cache primed by warm-up, so **excludes the one-time per-isolate compile** (the file states this). | 20 timed + 5 warm-up per fixture. Real files, C5 median before → after: catalogue.tsx 6.698 → 1.788 ms, AtlasScene.tsx 8.775 → 3.743, sidebar.tsx 7.850 → 2.709, symbol-d1-client.ts 6.893 → 2.107, eslint.config.js 1.239 → 0.133. Cold vs warm production `toIntermediateRepresentation`, trivial file, 20 calls: call #1 java 4.813, javascript 3.530, typescript 10.305, tsx 10.097 ms; calls 2–20 median 0.051 / 0.016 / 0.015 / 0.010 ms. Classification labels in the file use p95 and local thresholds. | Steady-state (warm) local benefit of memoizing compiled Queries; the cold first call per language per isolate still pays the compile locally. | That the cache reduces cold-isolate CPU; that it is adopted, safe on Cloudflare, or required; that the working-tree change should be retained or reverted (§9 decides, separately). Any platform conclusion. | Not re-measured. Currency N/A. |
| **E5** | LOCAL-WALLCLOCK | `specs/002-ast-symbol-intelligence/query-cold-start-results.md` §5 (cold compile) and §7 (one-time vs per-file); warm-process compile values come from E3's file. **Provenance note**: `spec.md` lists `query-cold-start-results.md` as the source for the 0.79 / 1.06 / 4.36 / 4.75 ms compile figures, but those four values appear in `combined-single-pass-decomposition-results.md` (isolated-compile table); `query-cold-start-results.md` refers to the warm figure only as "≈ 4.4–4.8 ms measured earlier". Recorded as a source-attribution discrepancy, not resolved. | Symbol-query (`.scm`) compilation cost per language. Warm-process values (E3 file) vs cold first-use (fresh local `bun` process, `query-cold-start-results.md` §5: java 3.3, javascript 4.4, typescript 12.8, tsx 13.2 ms). | Cold: medians of 10 fresh processes (§3 of the file). Warm compile: sample not stated (UNKNOWN). Cold p95 not given in the sections read (variability UNKNOWN for cold). File's own reading: roughly two thirds of first-call "compile" is first-use warmup, not steady compile work. | Compile cost is a per-language cost that repeats per isolate unless isolate reuse holds; TS/TSX are ~3–4× Java/JS locally. | Treating a fresh `bun` process as a Cloudflare isolate (the file itself says Workers isolate startup, WASM tiering and CPU accounting can differ and were not measured); assuming any of these costs is amortized across invocations. | Not re-measured. Currency N/A. |
| **E6** | LOCAL-WALLCLOCK | `specs/002-ast-symbol-intelligence/query-cold-start-results.md` §4 (per-language), §5 (first-file breakdown), §6 (warm), §7 (one-time vs per-file). | Fresh local `bun` process per cold measurement; first file, files 2–10, files 11–50, files 51–100; per language. Includes local-only items: module import of our code (3.4–3.9 ms, "bundled at build/isolate start in Workers") and WASM compile of core + grammars (7.8–8.3 ms, "local-only; Workers uses build-time `?module`"). | 10 fresh processes per cold measurement, 3 for warm (§3). Medians. First real file: typescript 23.29, tsx 22.49, java 8.44, javascript 7.60 ms (parse + toIR); grammar + parser init B: 4.5 / 4.3 / 4.8 / 4.7 ms (java / js / ts / tsx). Sum of B+C+D+E request-time work: java 11.9, js 11.8, ts 27.2, tsx 26.6 ms. Warm: files 51–100 median java 1.16, javascript 1.34, typescript 0.82, tsx 1.00 ms (p95 1.72 / 2.10 / 1.93 / 3.30); files 11–50 medians 0.87–1.53 ms. Cold variability (p95/range across the 10 processes) not given in the sections read → UNKNOWN. | Cold cost is one-time per isolate (core runtime) and per language (grammar, compile, JIT warm-up), not per file, **locally**; line items for §5 (cold-start line items) with cold and warm kept separate and never averaged. | That the same numbers apply on Cloudflare; that isolate reuse occurs or does not occur (not guaranteed; not documented — see E7/N2); that Feature 002's recorded live outcome ("33 files, 0 failures", stated in §9 of the file) demonstrates CPU compliance — it records success under unknown CPU accounting and carries no CPU measurement. | Not re-measured. Currency N/A. |
| **E7** | OFFICIAL-DOC | Recorded report: `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-research-report.md` §1 (F1–F20). **Re-read (current) by T004**: `evidence/docs-workers-queues.md` — Workers "Limits", Workers "Pricing", Queues "Limits", Queues "Batching, Retries and Delays", Queues "Consumer concurrency", Queues "Pricing", Queues "How Queues works", Workers "How Workers works", "Wasm in JavaScript" (URLs with titles/sections in that file). | Workers Free vs Paid; Queue consumer CPU, CPU accounting unit, startup/global/WASM, isolate reuse, batch/retry. Extraction-based reads. | Not a measurement. **Read date: 2026-09-23** (T004). Read method: WebFetch extraction — omissions UNVERIFIED. | Documented (as extracted): Free HTTP and Cron CPU 10 ms; CPU-time definition excludes network wait; queue consumer wall time 15 min; `max_batch_size` default 10 / range 1–100; per-message ack/retry; queue operations counted per message; isolate reuse not guaranteed; Queues "Limits" row "Consumer CPU time: Configurable to 5 minutes" with a note that limits apply to Free and Paid. | That a Free-plan Queue Consumer CPU limit is established; that the Workers Free HTTP 10 ms is the queue-consumer limit; that "5 minutes" or "15 minutes" is the Free-plan queue-consumer limit; that any omitted sentence is absent from the page. | **Read 2026-09-23. Changed since recorded: YES (one wording difference)** — Workers "Pricing" Standard row recorded as "Max of **15** minutes of CPU time per invocation (default: 30 seconds)" (F10); T004 returned "Max of **5** minutes … (default: 30 seconds)". **Preserved as an unresolved evidence discrepancy** (page change vs extraction not determined). Recorded sentences not returned by the T004 read (F3 second sentence, F12 multi-message sentence, F13 ackAll/retryAll, F15 autoscale-during-batch) are **UNVERIFIED**; F5, F8 and some F11 rows not re-read. |
| **E8** | OFFICIAL-DOC | Recorded report: `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-observability-report.md` (D1–D16, C1–C4, §16). **Re-read (current) by T005**: `evidence/docs-observability.md` — Workers Logs, Query Builder, Workers Trace Events (both URLs), Workers Logpush, Tail Workers, Workers Metrics and analytics, Errors and exceptions. The Observability telemetry query API / query-language pages (D16) were **not read** — assigned to task T036. | CPU-time fields, queue-invocation coverage, Free vs Paid availability, startup/init inclusion, outcome values. Extraction-based reads. | Not a measurement. **Read date: 2026-09-24** (T005). Omissions UNVERIFIED. | Documented (as extracted): Trace Events `CPUTimeMs` ("The amount of CPU time used by the Worker script, in milliseconds"), `WallTimeMs`, `EventType` includes `queue`, `Outcome` = ok / canceled / exception / unknown (no `exceededCpu`); Workers Logs handler table has a Queue row; Workers Logs Free 200,000 logs/day, 3-day retention; Query Builder names `$workers.cpuTimeMs` as an example field and is "available to all developers and requires no enablement"; Logpush "available on the Workers Paid plan"; Tail Workers Paid/Enterprise; dashboard "CPU Time per execution" quantiles and a rollover-CPU note; error 10021 startup CPU wording (1 s). | That platform CPU for a queue-consumer invocation is obtainable on Free (not established); that `$workers.cpuTimeMs` is populated for queue invocations (UNKNOWN); that CPU telemetry includes or excludes startup/init (UNKNOWN); that `exceededCpu` is or is not an available outcome (C1 open); in-Worker timers as a substitute for platform CPU. | **Read 2026-09-24. Changed since recorded: NO wording change found; additions only** (WallTimeMs full wording, reservoir sampling, "Exceeded resources" codes 1102/1027 and startup/free-tier causes, Tail sample `diagnosticsChannelEvents`, error 10021 wording). D3 items not returned (5-billion daily cap, `head_sampling_rate` range/default, redeploy statement) and D5, D7, D8, D9, D11, D13–D16 not read → **UNVERIFIED by Feature 005 so far**. Contradictions C1–C3 unchanged; C4 = E7's discrepancy family. |
| **N1** | REPO-BEHAVIOR | `evidence/repo-consumer-mapping.md` (task T006), from `wrangler.toml:31-34,40-43`, `plugins/cloudflare-symbol-queue.ts:20-44`, `plugins/cloudflare-queue.ts:21-41`, `src/lib/code-intel/symbols/symbol-worker.ts:84-151`, `src/lib/code-intel/config.ts:10,69-72`, `src/lib/code-intel/persistence/d1-client.ts:326-354`, `src/lib/code-intel/symbols/grammar-provider.ts:209-283`, `node_modules/nitro/dist/presets/cloudflare/runtime/_module-handler.mjs:51-58`. | Feature 002 symbol-extraction consumer as coded in the working tree; code read only, nothing executed. | Not a measurement. Working-tree state on 2026-09-24. | Repository shape: `max_batch_size` 10 (no `max_batch_timeout`); one `queue()` → one hook dispatch → loop over `batch.messages`; up to `extractionBatchSize` (default 50) files per message; **"one file per invocation" is NOT established (verdict NO)**; files per invocation not established; parser/grammar init lazy in the first `getParser()` call per isolate. | That the delivered batch size or page fill equals the configured maximum; that deployed environment values equal the file values; that Feature 004's "one file per unit" describes the current repository; anything about Cloudflare CPU accounting. | Read 2026-09-24. Deployed configuration not read (remote access prohibited). |
| **N2** | REPO-BEHAVIOR + LOCAL-WALLCLOCK (reading only) | `evidence/scale-tiers.md` (task T007 scale tiers). | Four separately labelled scale tiers: measured 300-file memory run, configured limits, established production upper bound, unknown/unbounded. | Not a measurement (reads E2/E3 and code). | Tier 1 (E2 memory run): lifecycle/memory evidence only, no timing recorded, **not a worst case**; tier 3: **no enforced maximum files per snapshot/source found** in `src/`, `plugins/`, `data/*.sql`, `specs/001*`, `specs/003*` → NOT ESTABLISHED. | Treating the 300-file run as a CPU result, worst case or production bound; treating any configured page/unit size as a snapshot-size cap. | Read 2026-09-24. Absence of a bound is scoped to the searched locations. |

### 2.2 Currency and re-verification status (FR-025)

| Item | Last read | Method | Status |
|---|---|---|---|
| Workers / Queues documentation (E7) | 2026-09-23 (T004) | WebFetch extraction of 9 public pages | Current as of read; one wording difference (Workers Pricing Standard row, 15 → 5 minutes) **unresolved**; several recorded sentences UNVERIFIED |
| Observability documentation (E8) | 2026-09-24 (T005) | WebFetch extraction of 8 public pages | Current as of read; no wording change; several recorded items UNVERIFIED or not yet read (T036) |
| Local measurement files (E1–E6) | not re-read for change; not re-measured | — | Numbers copied as recorded; no re-measurement in Feature 005 |
| Repository code (N1, N2) | 2026-09-24 | file reads | Working tree at that date |

Documentation must be re-verified immediately before the final Feature 004 T007 disposition (`doc_reverification_date`, §14); this section does not record that re-verification.

### 2.3 Cross-record evidence notes (recorded, not reconciled)

1. **E7 — 5-minute vs 15-minute wording**: preserved as an evidence discrepancy (see E7 currency). Not resolved by any T004–T008 evidence.
2. **E7 — Free-plan Queue Consumer CPU**: Workers "Limits" CPU table (Free HTTP / Cron rows, no Queue row, as extracted), Workers "Pricing" (Free: "10 milliseconds of CPU time per invocation"; Standard: queue-consumer wording), and Queues "Limits" ("Consumer CPU time: Configurable to 5 minutes", limits apply to Free and Paid) do not agree on a single Free-plan Queue Consumer statement → **CONTRADICTION / UNKNOWN**, no value chosen.
3. **E8 — C1–C3**: Outcome values (`exceededCpu` absent from the Trace Events values; recorded in Tail Handler page not re-read), CPU fields per product, and `$workers.cpuTimeMs` in Workers Logs — open.
4. **E3 — tree-count inconsistency** (820 vs 1025) recorded, not resolved.
5. **E5 — source attribution**: `spec.md` credits `query-cold-start-results.md` with the warm compile values that appear in E3's file.
6. **No PLATFORM-TELEMETRY evidence exists.** Everything numeric above is local.

### 2.4 Statements the catalogue does NOT support

- Any numeric Free-plan Queue Consumer CPU budget.
- That single-pass extraction, the Query cache, or any unit shape is approved or safe.
- That Feature 004 T007 is cleared.

(Sections 3–16 are filled by their own tasks; this section states no accounting model, no measurement protocol and no disposition.)

## 3. CPU accounting model

Sub-sections 3.1–3.3 are filled by task T010 and 3.4 "Source conflicts" by task T011. 3.5 "Applicable limit and bounding requirement" is filled by task T012; verification is task T013.

**Conventions.** Evidence labels: FACT / INCOMPLETE / UNVERIFIED / CONTRADICTION / UNKNOWN. OFFICIAL-DOC statements come from `evidence/docs-workers-queues.md` (task T004, read 2026-09-23) and keep its **WebFetch-extraction limitation**: text not returned is UNVERIFIED, not absent. REPO-BEHAVIOR statements come from `evidence/repo-consumer-mapping.md` (task T006, code read 2026-09-24, nothing executed). No numeric Free-plan Queue Consumer CPU limit is asserted anywhere in this section. **Plan scope rule (S1 review, user-confirmed):** a Standard/Paid-plan statement is never generalized to the Free plan. Feature 004 T007 is not cleared by this section.

### 3.1 Accounting unit and boundaries

**Accounting unit for the Queue Consumer path on the project's plan (Workers Free): UNKNOWN.** No page returned by task T004 or T005 states it for Free (S1 (ii) is YES only scoped to Standard/Paid; register U2 = PARTIAL). The unit is not assumed to be the invocation, the batch, the message or the file.

| Boundary | Authoritative source that defines it | What the source establishes | Status |
|---|---|---|---|
| **Accounting unit (Free plan)** | none found | — | **UNKNOWN** (U2 PARTIAL) |
| **Accounting unit (Standard/Paid plan)** — scoped, not applicable to Free | Workers "Pricing", Workers table, Standard row — https://developers.cloudflare.com/workers/platform/pricing/ (T004 §2) | Wording returned: "Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation". The stated unit for that Standard-plan limit is the *invocation*. The same read also returned "Max of 5 minutes of CPU time per invocation (default: 30 seconds)" where the earlier recorded finding F10 read "15 minutes": an unresolved wording discrepancy (see §2, E7; reconciliation is task T011). | FACT (as extracted) for Standard only; **not** evidence for Free |
| **Invocation boundary** | Queues "How Queues works" — "Consumers" — https://developers.cloudflare.com/queues/reference/how-queues-works/ (T004 §7); Workers "Limits" — "Wall time limits by invocation type" (T004 §1); repository hook code (REPO-BEHAVIOR) | Docs: "A consumer Worker, which is push-based: the Worker is invoked when the queue has messages to deliver"; "Each consumer invocation has a maximum wall time of 15 minutes." (wall time, not CPU). Repository: one Worker `queue()` call dispatches one `cloudflare:queue` hook call carrying the whole `batch` (`node_modules/nitro/dist/presets/cloudflare/runtime/_module-handler.mjs:51-58`; `plugins/cloudflare-symbol-queue.ts:20-44`). The docs define *when* an invocation occurs, not whether a Free-plan CPU limit attaches to it. Hook work is attached via `context.waitUntil(...)`: how the platform counts CPU for `waitUntil` work in a queue handler is **UNKNOWN** (no T004/T005 page returned addresses it). | Invocation definition: FACT (docs, as extracted; repo, code). CPU attached to it on Free: **UNKNOWN** |
| **Batch boundary** | Queues "How Queues works" (T004 §7); Queues "Batching, Retries and Delays" (T004 §4); Queues "Limits" (T004 §3) | Docs: "The `MessageBatch` that is passed to your `queue` handler includes a `queue` property with the name of the queue the batch was read from"; `max_batch_size` default 10, min 1, max 100 (Queues "Limits": "Maximum consumer batch size \| 100 messages"). The recorded sentence that one invocation receives *multiple* messages (F12) was **NOT RETURNED** by the T004 read → **UNVERIFIED** as documentation; the repository code does iterate `batch.messages` inside one invocation (REPO-BEHAVIOR). Whether the CPU limit or CPU measurement covers the whole batch: no page returned states it. | Batch = the `MessageBatch` of one invocation: FACT (docs, as extracted; repo). CPU limit/measurement scope over the batch: **UNKNOWN** |
| **Message boundary** | Queues "Batching, Retries and Delays" (T004 §4); Queues "Pricing" (T004 §6) | Docs: "Messages that are explicitly acknowledged will not be re-delivered, even if your queue consumer fails on a subsequent message"; "When a single message within a batch fails to be delivered, the entire batch is retried, unless you have explicitly acknowledged a message"; "Operations are per message, not per batch." The message is a documented unit for acknowledgement, retry and operation billing. No page returned states a per-message CPU limit or measurement. | Message as ack/retry/billing unit: FACT (docs, as extracted). Message as CPU unit: **UNKNOWN** |
| **File-processing boundary** | RepoAtlas code only (REPO-BEHAVIOR) | The platform has no notion of a "file". In the repository a message is a unit `{ snapshotId, unitIndex, fromCursor }` (`symbol-worker.ts:41-46`); one message loops over up to `extractionBatchSize` files (default 50; `config.ts:10`, `symbol-worker.ts:113-132`); per-file work is `extractFile`. The file boundary is defined by RepoAtlas, not by an authoritative platform source, so no Cloudflare statement links CPU accounting to it. | File boundary (app-defined): FACT (code). Platform CPU accounting at file level: **UNKNOWN** (nothing supports it) |

### 3.2 Repository consumer quantities (REPO-BEHAVIOR; four-row table from `evidence/repo-consumer-mapping.md`, task T006)

The four repository quantities are distinct and are not merged. Full source lines, "established" and "unknown" columns are in the evidence file.

| # | Quantity | Value | Source | What is established | What remains unknown |
|---|---|---|---|---|---|
| 1 | **Queue configuration** (Cloudflare `max_batch_size`, retries) | `max_batch_size = 10`, `max_retries = 5` for both consumers; `max_batch_timeout` **not set** | `wrangler.toml:31-34`, `wrangler.toml:40-43` | The repository requests at most 10 messages per delivered batch (a maximum, not a guarantee). No `[vars]`, `limits.cpu_ms` or `max_concurrency` in the file. | Delivered batch size at runtime (never observed); whether the deployed configuration differs from the file (not read; remote access prohibited); `max_concurrency` platform default (not verified). |
| 2 | **Consumer invocation / message batch** | One `queue()` call → one hook dispatch → sequential loop over **all** `batch.messages`; per message `processSymbolQueueMessage` then `ack()`, on throw `retry()` | `plugins/cloudflare-symbol-queue.ts:20-44`; `plugins/cloudflare-queue.ts:21-41`; `_module-handler.mjs:51-58` | All messages of a delivered batch are processed inside one invocation; retry granularity is per message (`ack()`/`retry()`). | The number of messages per invocation (the code shows a loop, not a number). CPU/time accounting of `waitUntil`-attached work (UNKNOWN). Behaviour of the unfiltered snapshot plugin on symbol batches — **flagged only, not investigated** (outside T006 and T010 scope). |
| 3 | **RepoAtlas files-per-message configuration** | `extractionBatchSize` default 50, env-overridable (`CODE_INTEL_EXTRACTION_BATCH_SIZE`); used as the `LIMIT` of a D1 page query | `config.ts:10`, `config.ts:69-72`; `symbol-worker.ts:113`; `persistence/d1-client.ts:326-354` | One message = one unit = up to `extractionBatchSize` `snapshot_files` rows, every file of the page processed in a loop; it bounds a D1 page size and (because the whole page is consumed) the files per message. Files unsupported or larger than `CODE_INTEL_MAX_FILE_SIZE_BYTES` (10 MB default; `config.ts:12`) still occupy a loop slot but are skipped before any R2 read/parse. | Deployed value of the env override; whether `process.env` is populated on Workers under `nodejs_compat`. `CODE_INTEL_QUEUE_BATCH_SIZE = 10` (`config.ts:6`) has **no consumer** in `src/` or `plugins/` (dead constant; does not set the Cloudflare batch size). |
| 4 | **Files processed per invocation** | **Not established** | — | The code fixes only the shape: invocation → loop over delivered messages → each message loops over up to `extractionBatchSize` files. No number of files per invocation is asserted here. | "Messages per invocation × files per message" is **not derived**: it would need the delivered batch size (row 2: UNKNOWN) and page fill (row 3 gives only a ceiling). |

### 3.3 "One file per invocation" — REPO-BEHAVIOR verdict

**NO — the current repository does not establish "one file per invocation"; the code establishes a different shape for Feature 002's symbol-extraction consumer.**

Evidence (REPO-BEHAVIOR, from `evidence/repo-consumer-mapping.md`): (1) `symbol-worker.ts:113-132` processes a page of up to `extractionBatchSize` (default 50) files inside one `processSymbolQueueMessage` call; (2) `plugins/cloudflare-symbol-queue.ts:34-41` runs that function for every message of the delivered batch inside one hook call; (3) nothing in `src/` or `plugins/` sets the extraction unit to one file or the delivered batch to one message (`wrangler.toml:42` = 10 maximum, `max_batch_timeout` unset). Not claimed: that a batch of 10 full 50-file messages ever occurs (runtime batch size and page fill are UNKNOWN).

**Recorded CONTRADICTION (not reconciled):** the comment at `symbol-worker.ts:78-83` and `specs/002-ast-symbol-intelligence/plan.md:81` state "one unit per invocation" (a unit being a bounded file batch); the plugin loop delivers as many messages as the batch holds, so that statement is not confirmed by the hook code.

**Planning assumptions (not evidence).** These describe design intent and were not used to fill any row above: `specs/004-engineering-relationship-graph/research.md:11-18` ("one file re-parsed per unit"), `plan.md:25`, `:80` ("one file per invocation (research.md §1)"), `:135`, `:141`, `:183`, and `tasks.md:68` (Feature 004 T023). They conflict in shape with the Feature 002 consumer as coded; a Feature 004 unit is "one file" only if a future consumer sets both the unit size and the delivered batch to one, which nothing establishes. Not reconciled here.

### 3.4 Source conflicts (task T011)

Every Cloudflare statement bearing on Queue Consumer CPU is listed below **verbatim as returned** by the T004/T005 reads (WebFetch extraction; not independently confirmed character-exact; omitted text is UNVERIFIED, not absent). **No conflict is reconciled by assumption (FR-004).** No new documentation was read for T011; no page was re-fetched. Source files: `evidence/docs-workers-queues.md` (T004, read 2026-09-23), `evidence/docs-observability.md` (T005, read 2026-09-24), recorded findings in `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-research-report.md` §1 (F1–F20) and `…-observability-report.md`. Plan-scope rule (S1 review): Standard/Paid statements are never read as Free-plan statements, and vice versa.

#### 3.4.1 Statements about Queue Consumer CPU, side by side

| # | Page — section — URL | Statement (verbatim as returned) | Plan scope stated by the page | Names Queue Consumer? | Recorded earlier (F-id) vs T004 read |
|---|---|---|---|---|---|
| S-a | Workers "Limits" — "CPU time" — https://developers.cloudflare.com/workers/platform/limits/ | "CPU time per HTTP request \| 10 ms"; "CPU time per Cron Trigger \| 10 ms" (Free rows; these 10 ms figures are an **unverified candidate for a different trigger** — see K4). The extraction reports the CPU table has only "HTTP request" and "Cron Trigger" rows; **no Queue-consumer row returned** (an omission, so UNVERIFIED as absence). | Free (rows returned) | No (no row returned) | F1: same. Paid values not returned in T004 (F1 recorded Paid 5 min / 30 s). |
| S-b | Workers "Limits" — "Increasing the CPU time limit" — same URL | `cpu_ms = 300_000` example; the "Workers Paid plan only, up to 5 minutes" label is the **extraction's own wording, not a returned quote**. | Paid (extraction's label) | No | F4 example matches; "Paid setting" characterization not a verified quote. |
| S-c | Workers "Limits" — "Wall time limits by invocation type" — same URL | "Each consumer invocation has a maximum wall time of 15 minutes." | not plan-qualified in the returned text | Yes (consumer), but **wall time, not CPU** | F6: same. Listed only because "15 minutes" appears here; it is not a CPU statement. |
| S-d | Workers "Pricing" — Workers table, **Free** — https://developers.cloudflare.com/workers/platform/pricing/ | "10 milliseconds of CPU time per invocation" (**unverified candidate for a different trigger** — K4; not a Queue Consumer statement) | Free | **No** — "per invocation" unqualified by invocation type | F10: same. |
| S-e | Workers "Pricing" — Workers table, **Standard** — same URL | "Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation" | Standard (Paid) | Yes | F10: same wording family. |
| S-f | Workers "Pricing" — Workers table, **Standard (default)** — same URL | "Max of 5 minutes of CPU time per invocation (default: 30 seconds)" | Standard (Paid) | No (unqualified "per invocation") | **Differs.** F10 recorded "Max of **15** minutes of CPU time per invocation (default: 30 seconds)"; the T004 read returned "**5** minutes". |
| S-g | Queues "Limits" — limits table — https://developers.cloudflare.com/queues/platform/limits/ | "Consumer CPU time \| Configurable to 5 minutes"; footnote returned only as an extraction paraphrase ("linking to increase instructions"; F11 recorded footnote 5 "Refer to Workers limits" → `#cpu-time`). | see S-h | Yes (Consumer) | Row matches F11; footnote form differs, unverified either way. |
| S-h | Queues "Limits" — opening note — same URL | "The following limits apply to both Workers Paid and Workers Free plans with the exception of **Message Retention**, which is non-configurable at 24 hours for the Workers Free plan." | Both plans (returned wording) | applies to the table incl. the CPU row | F11 note: same substance. |
| S-i | Queues "Batching, Retries and Delays" — https://developers.cloudflare.com/queues/configuration/batching-retries/ | Extraction states no mention of CPU or duration implications of batch size. | — | — | Consistent with F14 (absence claim; subject to the read-method caveat). |

#### 3.4.2 Conflicts and silences (recorded, NOT reconciled)

**K1 — Workers Pricing Standard row: 15 vs 5 minutes — CONTRADICTION / UNRESOLVED.**
- *Previous recorded statement*: F10 — "Max of 15 minutes of CPU time per invocation (default: 30 seconds)".
- *Current extracted statements (same page, same read, 2026-09-23)*: S-e "Max of **15** minutes of CPU time per Cron Trigger or Queue Consumer invocation" **and** S-f "Max of **5** minutes of CPU time per invocation (default: 30 seconds)". The T004 read returned **both** figures for the Standard plan on the one page; it does not attribute them to different plans, products or dates.
- *What changed, as far as the evidence shows*: the wording recorded as F10 ("15 minutes … (default: 30 seconds)") is now returned as "5 minutes … (default: 30 seconds)". Whether the page text changed, the earlier extraction was wrong, or the page carries two rows (one Queue-Consumer/Cron-specific, one generic) is **not determined** by anything read.
- *Consistency observations (not evidence for either value)*: "5 minutes" also appears in S-b (extraction label) and S-g; "15 minutes" also appears in S-c and in Queues "Limits" as "Consumer duration (wall clock time) \| 15 minutes" — both of those are wall-clock statements. No returned text says either that the CPU figure was deliberately aligned to, or distinct from, the wall-time figure.
- *Outcome classification*: of the possible outcomes (A current wording supersedes / B different plans-products-limits / C ambiguous / D earlier record wrong) the sources support **C — ambiguous**. Neither value is selected, neither is taken as correct, and **neither is treated as a Free-plan Queue Consumer CPU allowance**.
- *What would resolve it*: a raw-text (non-extraction) read of the Workers "Pricing" Workers table, or an official page change note; **not** a local measurement and **not** a live experiment (neither is authorized). Task T039 re-reads documentation before the final disposition and may bear on this.

**K2 — Free-plan Queue Consumer CPU: three pages, no agreement on one statement — CONTRADICTION / UNKNOWN.**
- Workers "Limits" (S-a): Free rows for HTTP and Cron only; no Queue row returned.
- Workers "Pricing" (S-d): Free "10 milliseconds of CPU time per invocation" (unverified candidate for a different trigger, K4), not qualified by invocation type; Standard has an explicit Queue Consumer wording (S-e).
- Queues "Limits" (S-g, S-h): "Consumer CPU time \| Configurable to 5 minutes", stated to apply to both Workers Paid and Workers Free plans (except Message Retention); Workers "Limits" (S-b) describes the configuration setting as a Paid capability (extraction's wording, not a quote).
- These do not combine into a single Free-plan Queue Consumer CPU statement. "Configurable to 5 minutes" does **not** establish a Free-plan allowance of 5 minutes, and the Free "per invocation" wording does not establish that a queue-consumer invocation is metered at 10 ms. Status: **UNKNOWN** (register U1); no value chosen.

**K3 — Standard "per … Queue Consumer invocation" vs Free accounting unit — scoped SILENCE.** S-e names the invocation as the unit for the Standard limit only. No returned page states the unit for Free (register U2 = PARTIAL). Not generalized.

**K4 — Workers Free HTTP/Cron 10 ms — an unverified candidate for a different trigger.** The 10 ms figures in S-a (and the Free wording in S-d) are documented for HTTP requests and Cron Triggers. They are recorded here **only as an unverified candidate** for the Queue Consumer path (no page returned states that they apply to queue consumers, and no page returned states that they do not). They are not a Queue Consumer budget, are not used as budget X anywhere in this record, and support no "within budget" claim.

**Observability contradictions (from T005, carried unreconciled; not Queue-consumer CPU limits but they bear on whether a limit can be observed):**
- **C1 — Outcome values.** Trace Events `Outcome` values returned: `ok | canceled | exception | unknown` (no `exceededCpu`). The Tail Handler page (recorded D9, **not read in T005**) is recorded as listing `exceededCpu`, `exceededMemory`, and others. Metrics and Errors pages use dashboard categories "Exceeded resources" / "Exceeded CPU Time Limits". No returned text explains how these relate. Source: `evidence/docs-observability.md` Q5 and "Contradictions" section. STILL OPEN.
- **C2 — CPU fields per product.** `CPUTimeMs` / `WallTimeMs` are documented for Trace Events; they are absent from the returned Logpush example fields and the Tail Workers sample. Whether the omission is real or reflects examples/extraction is not established. STILL OPEN.
- **C3 — CPU in Workers Logs.** Query Builder returns `$workers.cpuTimeMs` as an example field; the Workers Logs page returned no CPU wording and no `$workers` namespace description. The recorded search-snippet claim (D16) is unconfirmed by any page read. Task T036 is assigned to read the query-language pages. STILL OPEN.
- **C4 — Queue-consumer CPU limit.** The recorded observability report's C4 is the same family as K1/K2 above (Workers Limits / Workers Pricing / Queues Limits). T005 did not touch it; T011 records it as K1 and K2 and does not reconcile it.

#### 3.4.3 What this sub-section does not do

- It states no accounting unit, no applicable limit and no bounding requirement (task T012), and no numeric Queue Consumer CPU budget.
- It does not change the S1 result (NO / YES scoped / NO) or register U1–U5 (U1 UNKNOWN, U2 PARTIAL, U3 UNKNOWN, U4 UNKNOWN, U5 UNKNOWN).
- It does not clear Feature 004 T007, which remains STOPPED.

### 3.5 Applicable limit and bounding requirement (task T012)

No documentation was read for T012; it rests on §3.1–§3.4, `evidence/docs-workers-queues.md`, `evidence/docs-observability.md` and `evidence/repo-consumer-mapping.md`. No numeric Queue Consumer CPU budget is written in this section. Plan-scope rule (S1 review): Standard/Paid statements are not read as Free statements.

#### 3.5.1 Applicable limit (`applicable_limit`)

| Field | Value |
|---|---|
| **applicable_limit** (CPU limit for the Queue Consumer path on the project's plan, Workers Free) | **UNKNOWN** |
| **source** | none. No OFFICIAL-DOC or PLATFORM-TELEMETRY evidence supports a value for this path. No PLATFORM-TELEMETRY record exists (§2.3). |
| **status** | **UNKNOWN**. It is not `established`. It is not even an `unverified-candidate`: no candidate is adopted for this path. |

Statements considered and **not** adopted as the applicable limit (each keeps its own scope; none is combined with another):

| Statement | Why it is not the applicable limit | Ref |
|---|---|---|
| Workers Free "10 ms" (HTTP request, Cron Trigger; Pricing "10 milliseconds of CPU time per invocation") | Documented for other triggers, or unqualified by invocation type. It stays an **unverified candidate for a different trigger** (K4); it is not Queue Consumer budget X. | S-a, S-d, K4 |
| Standard/Paid "15 minutes … per Cron Trigger or Queue Consumer invocation" and "5 minutes … per invocation (default: 30 seconds)" | Standard/Paid scope; the two figures are an unresolved contradiction (K1); neither is chosen; neither is a Free value. | S-e, S-f, K1 |
| Queues "Consumer CPU time \| Configurable to 5 minutes" | A configurable ceiling stated for both plans; it is not the Free-plan value and no returned page says how the Free-plan value relates to it (K2). Workers "Limits" describes the configuration setting as a Paid capability, in the extraction's wording only (S-b). | S-g, S-h, K2 |
| "Maximum wall time of 15 minutes" per consumer invocation; Queues "Consumer duration (wall clock time) \| 15 minutes" | Wall time. No CPU limit is inferred from a wall-time limit. | S-c |
| Repository configuration (`max_batch_size = 10`, `extractionBatchSize = 50`, `CODE_INTEL_MAX_FILE_SIZE_BYTES`) | REPO-BEHAVIOR quantities. No CPU limit is inferred from queue or app configuration values. | §3.2 |
| Local wall-clock figures (E1–E6) | LOCAL-WALLCLOCK is comparative evidence only. No limit is derived from it, and no "within limit" claim is made. | §2 |

#### 3.5.2 Bounding requirement: at which level must CPU be bounded?

**Status: UNDETERMINED.** The record does not state that CPU must be bounded per file, per message or per invocation, because the accounting unit for the Queue Consumer path on Free is UNKNOWN (U2 PARTIAL; §3.1) and no limit value is established. A bounding requirement follows from *a limit at a stated unit*; neither is available.

What the record can state without inference, as a **conditional analysis** (not a decision, not a selection basis, not a budget; conditions are unresolved):

| If the authoritative accounting boundary turns out to be… | then the quantity that must be bounded is… | The repository's current bound on that quantity (REPO-BEHAVIOR, §3.2) |
|---|---|---|
| the whole invocation | total work across every message the invocation receives, that is, messages per invocation × files per message, plus any `waitUntil`-attached work if that counts | Not established: delivered batch size, page fill and files per invocation are all UNKNOWN (rows 2 and 4). Ceilings only: `max_batch_size` 10 and `extractionBatchSize` 50 (rows 1 and 3). The product is not derived here. |
| the batch | the same aggregate as above (a batch is what one invocation receives) | same as above |
| the message | the work of one message: up to `extractionBatchSize` files | ceiling of 50 files per message by default (row 3); deployed override UNKNOWN |
| the file | the work of one file | no per-file cap besides `CODE_INTEL_MAX_FILE_SIZE_BYTES`, which is a size gate that skips larger files (`config.ts:12`, `extraction-pipeline.ts:101-117`); it is not a CPU bound |

The table states only which quantity would need bounding under each boundary. It does not say that any of them exceeds or fits a limit, and it uses no CPU-ms figure.

Evidence that would determine the requirement (any one is sufficient to start; none exists today):
1. An official statement naming the Workers Free plan and the Queue Consumer path that gives the limit **and** its accounting unit (invocation / batch / message). Route: a raw-text read of the Workers "Pricing" and "Limits" tables and the Queues "Limits" footnote, since the current reads are extraction-based (K1, K2). Task T039 re-reads documentation before the final disposition.
2. Platform-reported CPU for Queue Consumer invocations on Free (PLATFORM-TELEMETRY), which needs the telemetry availability that register U3 leaves UNKNOWN. Obtaining it would need a separately and explicitly authorized live experiment; none is authorized (§12).
3. Separately, for the *repository* side: the delivered batch size and page fill (to derive files per invocation), which the code alone does not establish.

Local measurements cannot supply items 1 or 2 (§4a, task T014).

#### 3.5.3 What this sub-section does not do

- It selects no processing unit and states no conditional budget statement (tasks T022, T023).
- It changes neither the S1 result (NO / YES scoped / NO) nor the register (U1 UNKNOWN, U2 PARTIAL, U3 UNKNOWN, U4 UNKNOWN, U5 UNKNOWN).
- It does not clear Feature 004 T007, which remains STOPPED.

## 4. Measurement protocol

Structure: §4a evidence acceptability (task T014), §4b measurement protocol (task T015), §4c required runtime telemetry (task T016), §4d classification of existing local measurements (task T017), §4e evidence-gap register (tasks T018, T019). Verification: task T020. Governing contract: `contracts/measurement-protocol.md`.

### 4a. Evidence acceptability (task T014)

Three activity classes are never mixed: documentation research (public Cloudflare pages read as documentation only), local-only measurement (only for a named evidence gap; none is planned or run so far), and future live validation (NOT authorized; a separate explicit authorization per experiment). Plan-scope rule: evidence from one plan, trigger or invocation type is not carried to another (Standard/Paid → Free; HTTP/Cron → Queue Consumer).

| Class | Example | May support | May NOT support |
|---|---|---|---|
| **OFFICIAL-DOC** | A current Cloudflare documentation page (title, section, URL, date read) | Statements the page explicitly makes, scoped to what the page says | Anything the page is silent on; a reconciled contradiction; a statement for a plan or trigger the page does not name. Extraction-based reads (T004/T005): omitted text is UNVERIFIED and is not proof of absence. |
| **PLATFORM-TELEMETRY** | Platform-reported per-invocation CPU for a queue-consumer invocation (e.g. Workers Logs `$workers.cpuTimeMs` with outcome, if present) | The observed CPU of that invocation, if scope and inclusions are recorded | General limits; other plans or invocation types; any conclusion from a single sample. **No such record exists in Feature 005** (§2.3). |
| **LOCAL-WALLCLOCK** | Local Bun timings recorded in `specs/004-…/*-results.md` and `specs/002-…/query-cold-start-results.md` (E1–E6) | Relative comparison ("X is n % cheaper than Y" on this machine), dominant-cost ranking, cold-vs-warm ordering | Compliance or violation of any Cloudflare limit, in either direction; a Cloudflare CPU value; an "is safe"/"is unsafe" classification against a platform limit. Comparative only. |
| **REPO-BEHAVIOR** | Reading the current consumer code (`evidence/repo-consumer-mapping.md`, N1) | Describing what the code does | Platform behavior; deployed configuration; runtime batch size or page fill. |
| **Not accepted** | In-Worker `performance.now()` / `Date.now()` timing | — | Platform CPU (documented as unreliable in production per the recorded research; not re-verified by Feature 005). |

**What cannot be inferred from local measurements** (LOCAL-WALLCLOCK is comparative only and is never proof in either direction):
1. Platform CPU-milliseconds for any operation on Cloudflare.
2. The enforced Cloudflare CPU limit for the Queue Consumer path, on any plan.
3. Whether an isolate is reused across queue-consumer invocations.
4. What Cloudflare's reported CPU includes (startup, grammar/parser/Query initialization, WASM instantiation, I/O wait handling) — register U4.
5. That a local fresh `bun` process reproduces a Cloudflare isolate's cold start (E5's own caveat).
6. That "fast locally" means "within budget", or that "slow locally" means "over budget".

**Other inference bans applied throughout this record**: no local timing → Cloudflare CPU; no Standard/Paid statement → Free; no HTTP/Cron figure → Queue Consumer; no CPU limit from a wall-time limit; no CPU limit from a Queues or app configuration value; an agent's opinion is not evidence.

### 4b. Measurement protocol (task T015)

**Required fields for every measurement** (`contracts/measurement-protocol.md`): basis (`local-wallclock` | `platform-cpu`); warmth (`cold` | `warm`, reported separately and **never averaged**, FR-021); unit (file | message | batch | full queue invocation); what it includes (startup, grammar/parser/Query init, parse, extraction, D1/R2 wait excluded) or `UNKNOWN`; sample size; statistic (median **and** a tail: p95 or max); variability; environment (plan, runtime, commit sha). Every local wall-clock result carries the label **comparative only**.

**Gate-conclusion rules**: (1) **one sample never supports a gate conclusion** (FR-020); (2) a platform-cpu conclusion applies only to the invocation type, plan and unit measured; (3) without M5–M7 or a documented limit for the path, gate condition (e) is unsatisfied and Feature 004 T007 stays STOPPED unless validly waived (FR-029, FR-038).

| ID | Basis | Warmth | Unit | Purpose | Includes (as defined) | Status |
|---|---|---|---|---|---|---|
| **M1** | local-wallclock | cold | first file per language | cold-init line items | per-language grammar/parser init, Query compile, first-file parse + IR; local-only extras (module import, WASM compile) are separate line items (E6) | **existing (local wall-clock, comparative only)** — source E6 (10 fresh processes, median; cold tail/variability NOT RECORDED in the sections read) |
| **M2** | local-wallclock | warm | file | steady-state per-file cost | parse + extraction on a primed process; excludes one-time init | **existing (local wall-clock, comparative only)** — sources E2, E4, E6 §6 (20 timed iterations + 5 warm-up per fixture in E2/E3/E4 scripts; 3 processes for E6 warm) |
| **M3** | local-wallclock | cold and warm, reported separately | file, two-pass vs single-pass | architecture comparison (§8) | phase attribution (parse, symbols, relationship observation, hashing); resolution excluded | **existing (local wall-clock, comparative only)** — sources E2, E3 (median, p95, max recorded; warm-up count for E2 is from the script constants, INCOMPLETE in the results file) |
| **M4** | local-wallclock | warm vs cold, reported separately | file, Query cache off vs on | Query-cache benefit vs cold cost (§9) | warm-cache benefit; one-time per-isolate compile excluded in the warm figure, included in the cold first call | **existing (local wall-clock, comparative only)** — sources E4, E5 |
| **M5** | platform-cpu | cold | full queue invocation, one tiny unit | telemetry availability; whether reported CPU includes startup/init (U3, U4) | UNKNOWN until measured | **defined — platform CPU — NOT AUTHORIZED (LIVE-GATED)** |
| **M6** | platform-cpu | cold and warm if reachable | full queue invocation, one larger unit | how CPU scales with unit size; limit behavior | UNKNOWN until measured | **defined — platform CPU — NOT AUTHORIZED (LIVE-GATED)** |
| **M7** | platform-cpu | repeated | full queue invocation, ≥ N samples (N to be set by the experiment proposal, not here) | variability; "consistently over limit" tolerance (recorded finding F3, second sentence not re-verified) | UNKNOWN until measured | **defined — platform CPU — NOT AUTHORIZED (LIVE-GATED)** |

Fields **sample size, statistic, variability and environment** for M1–M4 are taken only from the source records and are classified line by line in §4d (task T017); anything a source does not state is `NOT RECORDED` there. For M5–M7 they are set by the live-experiment proposal (task T037), which is a document with `STATUS: NOT AUTHORIZED`; nothing is run.

**Explicitly not one of M1–M4**: the 300-sequential-extraction run in the Feature 004 single-pass spike (E2 memory/tree-lifecycle test). It recorded process memory (rss / heapUsed / external) and tree-delete counts only. It provides no CPU time, no CPU-budget compliance, no per-invocation CPU and no production worst-case CPU. The "300" column in the decomposition sweep tables is a **symbols** count, not a file count (see `evidence/scale-tiers.md`).

**Protocol non-claims**: defining M5–M7 authorizes nothing (no live operation, no deployment, no Wrangler, no Cloudflare API/MCP/dashboard). In-Worker `performance.now()`/`Date.now()` is not an accepted substitute (§4a).

### 4c. Required runtime telemetry (task T016)

Source evidence: `evidence/docs-observability.md` (task T005, read 2026-09-24, WebFetch extraction; omissions are UNVERIFIED). Nothing here was measured or obtained from Cloudflare; this sub-section states what the telemetry would have to contain to count as PLATFORM-TELEMETRY (§4a) for the target path, and where a route to it is documented.

**Requirement.** A platform-reported CPU measurement for the target **Queue Consumer** path counts as usable evidence only if it identifies:
1. **Invocation type**: that the record is a queue-consumer invocation, not an HTTP or Cron one (needed because of the no-HTTP/Cron→Queue rule, §4a).
2. **Outcome**: the invocation outcome, including whether it was terminated for exceeding a limit (see open contradiction C1 on which outcome values exist).
3. **Scope and inclusions**: whether the CPU value covers the whole invocation, and whether it includes startup/init (U4 UNKNOWN); the measurement must state this or it is recorded as UNKNOWN.
4. **Enough context to relate it to a known unit**: the number and sizes of the files processed. Cloudflare fields do not carry these, so they must come from the application's **own D1 records** for the same snapshot and unit (messages `{ snapshotId, unitIndex, fromCursor }`, `snapshot_files` rows, per-file extraction records). Correlation is by snapshot/unit and time; the record does not assume it is exact.
5. **Plan, runtime and commit** of the measured deployment (protocol "environment" field).

**Route documented (as extracted; not confirmed to work for queue invocations on Free).**
- Workers Logs — the handler table has a Queue row (`<Queue Name>`); Free "200,000 per day", "3 Days" retention. The extraction returned no CPU, wall-time or outcome field wording for this page (https://developers.cloudflare.com/workers/observability/logs/workers-logs/).
- Query Builder — `$workers.cpuTimeMs` is named as an example field; "available to all developers and requires no enablement"; handler-type (queue) filtering "not described" (https://developers.cloudflare.com/workers/observability/query-builder/). Whether `$workers.cpuTimeMs`, `$workers.eventType` and `$workers.outcome` are documented keys with these semantics is the subject of task T036 (query-language pages not yet read).
- Workers Trace Events dataset — `CPUTimeMs`, `WallTimeMs`, `EventType` (includes `queue`), `Outcome` (`ok | canceled | exception | unknown`). Delivery is via Logpush ("available on the Workers Paid plan") or Tail Workers (Paid/Enterprise); both are **outside the Free-plan constraint** (FR-027) and are reported here as out of constraint, not adopted.

**Availability on the Free plan: UNKNOWN (register U3).** No returned page states that CPU telemetry is available for queue invocations on Free (S1 (iii) = NO, meaning "not in the extracted text", not "verified absent"). Contradictions C1–C3 bear directly on it and remain open. Whether reported CPU includes startup/init is UNKNOWN (U4).

**Consequence for the protocol.** M5–M7 (§4b) would need this telemetry; obtaining it needs a separately and explicitly authorized live experiment, which is not authorized. Local wall-clock timing, in-Worker timers and app-side logging of elapsed time are not substitutes for the required platform CPU field.

### 4d. Classification of existing local measurements (task T017)

Read (no execution): `specs/004-engineering-relationship-graph/single-pass-spike-results.md`, `cpu-decomposition-results.md`, `combined-single-pass-decomposition-results.md`, and `specs/002-ast-symbol-intelligence/query-cold-start-results.md` (headers and the sections cited in §2). Every field a source does not state is **NOT RECORDED**; nothing is inferred. All records are LOCAL-WALLCLOCK, comparative only, on one machine under Bun; each source states it is "NOT Cloudflare Workers CPU-ms" and does not prove compliance. **Environment for every record**: "this machine, Bun runtime" as stated in each header; Bun version, host hardware, Cloudflare plan and commit sha are **NOT RECORDED** in the headers or sections read. E1 (feasibility spike) is outside the T017 set (E2–E6) and is not re-classified here.

> **Amendment note 2026-09-24 16:46 +04:00 (user-approved R3, decision B; historical text unchanged):** E1, E2 and the dense decomposition rows are **dense worst-case AST-shape measurements**. E1's "large" fixture is about 705 lines as built (not ~2,000). A later LOCAL MEASUREMENT showed AST node density explains the Java parse-phase discrepancy against the E3 "ordinary" fixtures (Java 0.229–0.238 µs per node in both shapes). Unresolved: TypeScript per-node difference (about 30%), query-phase, cold-start, the 820-vs-1,025 tree count, non-TypeScript re-runs. No Cloudflare CPU claim; T007 unchanged. See `specs/004-engineering-relationship-graph/research.md` Amendments A1.

| Field | E2 — single-pass spike (M3; memory test not an M-item) | E3 — decomposition C1–C5 (M3) | E4 — post query-cache (M2, M4 warm side) | E5 — Query compile per language (M1, M4 cold side) | E6 — first-file / warm cold-start (M1, M2) |
|---|---|---|---|---|---|
| **Basis** | local-wallclock (`process.hrtime.bigint()`); memory test = local process memory (rss/heap/external) | local-wallclock | local-wallclock | local-wallclock | local-wallclock |
| **Cold / warm** | warm, steady-state; memory test: sequential, no timing. Cold not measured. | warm, steady-state (5 warm-up discarded); cold-start tail "a separate, real, unmeasured risk" per `cpu-decomposition-results.md` | warm-cache (primed by warm-up), plus a cold-vs-warm call table (call #1 vs calls 2–20) | cold: fresh `bun` process; warm-process compile: separate figure from E3's file | cold: fresh `bun` process (first file); warm: files 11–100 in a process. Cold and warm reported separately. |
| **Unit** | file (synthetic sweep by line count, fixtures, three real TSX files); 300-extraction memory loop | file / fixture; "300" in sweep tables = symbols count | file (real and synthetic) | Query compile per language (per isolate/process) | first file per language; file index bands 2–10, 11–50, 51–100 |
| **Includes** | parse → symbol extraction → (B) second parse + relationship query + resolution (stubbed) → delete; production `getParser` / `toIntermediateRepresentation` | C1 parse; C2raw symbols + hashing; C3 relationship-query observation; C4 hashing in isolation; resolution excluded | as E3, with compiled-Query cache active | Query compilation only (cold figure includes first-use warm-up per the file's own reading) | grammar + parser init; Query compile; parse; execute; IR; local-only module import and WASM compile listed separately |
| **Sample size** | 20 timed + 5 warm-up (script constants `ITERATIONS`, `WARMUP`; **not stated in the results file → INCOMPLETE**); memory test 300 files, sampled every 50 | 20 timed + 5 warm-up per fixture (stated); 41 fixtures | 20 timed + 5 warm-up per fixture; cold-vs-warm table 20 calls | cold: 10 fresh processes; warm compile sample **NOT RECORDED** | 10 fresh processes per cold measurement; 3 for warm (stated in §3) |
| **Statistic** | min / median / p95 / max (p95 equals max at n = 20 in the recorded rows) | median (attribution %), and min/median/p95/max in tables | medians (before → after), call-#1 vs calls 2–20 median/max | median of 10 processes; p95 or range of the cold set **NOT RECORDED** in sections read | medians; warm files 51–100 also p95 |
| **Variability** | p95/max per cell; memory trend is a single run | per-cell spread as recorded; sample-size for the isolated compile loop **NOT RECORDED** | per-cell spread as recorded; classification labels in the file use p95 and local thresholds | cold variability **NOT RECORDED** | cold p95/range **NOT RECORDED**; warm p95 recorded |
| **Notes / caveats carried** | "300" is the file count of the memory loop only; not CPU, not worst case | tree-count line inconsistent (820 vs 1025), **INCOMPLETE**, not reconciled; per-family columns not additive | excludes the one-time per-isolate compile (stated); measures the working-tree Query-cache experiment (Set B, unadopted) | fresh `bun` process ≠ Cloudflare isolate (the file's own caveat); source attribution of the warm compile figures differs from `spec.md` (recorded, not resolved) | the file's "33 files, 0 failures" live outcome is success under unknown CPU accounting and carries no CPU measurement |
| **May support** | relative ordering, lifecycle/memory trend, parser reuse locally | dominant-cost ranking | steady-state benefit of the cache locally | per-language relative compile cost | one-time-per-isolate/per-language vs per-file cost pattern, locally |
| **May NOT support** | any Cloudflare CPU claim; single-pass adopted/safe; 300 files as CPU evidence or worst case | any platform CPU claim; cold-isolate cost from warm-process compile numbers | cold-isolate CPU reduction; cache adopted or safe | isolate-equivalence; amortization across invocations | Cloudflare numbers; isolate reuse; CPU compliance |

**Class result**: all five are LOCAL-WALLCLOCK, comparative only. **None satisfies a platform-cpu protocol row (M5–M7).** The classification adds no numeric limit and no budget.

### 4e. Evidence-gap register (task T018; T019 outcome appended by task T019)

**Question asked (D-A2, G8)**: for each requirement that needs evidence, are the existing records E1–E8 and the T004–T007 outputs (`evidence/docs-*.md`, `repo-consumer-mapping.md`, `scale-tiers.md`) sufficient to satisfy it? A gap is named only where a **local-only, comparative** measurement could fill something existing evidence cannot. Default outcome: no additional local measurement needed. No measurement, script or Cloudflare access was used for this register.

| Requirement | Needs | Existing evidence | Sufficient? | Note |
|---|---|---|---|---|
| FR-009 cold-start line items (grammar/parser/Query init, first file, warm file) | LOCAL-WALLCLOCK cold and warm, separate | E5, E6 (cold, 10 fresh processes), E3/E4 (warm) | **Yes, as comparative local evidence** | Cold variability and warm-compile sample size are NOT RECORDED in the sources (§4d); these are reporting gaps in the source text, not evidence that a new measurement would change any conclusion. |
| FR-010 cold-invocation justification / no isolate-reuse assumption | statement of isolate-reuse status | E7 (Workers "How Workers works": no guarantee), N1 (init is lazy per isolate) | **Yes for "no reuse may be assumed"**; reuse itself remains UNKNOWN (U5) | No local measurement can establish platform isolate reuse (§4a item 3). |
| FR-011 init cost vs per-file cost | separate line items | E5, E6 | Yes (local, comparative) | Platform inclusion of init in reported CPU is UNKNOWN (U4); not a local-measurement question. |
| FR-012/FR-013 Query-cache benefit, cold cost, safe reuse | warm vs cold local numbers; code reading | E4, E5, E6; hunk classification (task T029) | **Yes for the local comparison**; safety of reuse is a code-reading question (T029/T032) | Cold-isolate benefit on Cloudflare is not locally measurable. |
| FR-016 single-pass vs two-pass comparison | local A/B/C comparison, memory/tree lifecycle | E2, E3 | **Yes (comparative)** | Platform CPU difference is not locally measurable; recorded as a limit, not a gap to measure. |
| FR-024 platform-reported CPU evidence | PLATFORM-TELEMETRY | none | **No**, but only a live measurement (M5–M7) or an official statement can fill it | Not fillable locally; not authorized; carried to §16. |
| FR-003/FR-025 limit and accounting unit for the Queue Consumer path on Free | OFFICIAL-DOC or PLATFORM-TELEMETRY | E7, E8 (contradictory / silent) | **No** | Not fillable locally; documentation re-read at T039; U1–U5 carried in §16. |
| FR-008/FR-027 resource bounds (counts) | counts of messages/files/queue and D1 operations | N1, N2, E7 (Queues Pricing), repo docs | Sufficient for count arithmetic; delivered batch size and page fill are unobserved | Not a local-measurement question (runtime-delivered values). |
| FR-031–FR-033 bounded re-execution, idempotence, determinism | code and data-model reading | N1, Feature 002 code (read-only, task T025) | Decided in T025 | No measurement implied. |

**Result:**
- Every gap that remains is one that a local wall-clock measurement **cannot** fill: platform CPU, the limit and accounting unit, telemetry availability, init inclusion, isolate reuse, and delivered batch size.
- No question was found that a new local measurement would answer and no existing record does.

**S2: gap named NO.**

Consequence: task T019 is `N/A — no gap named` (reference: this register). It counts as a completed task state so T020 may proceed.

**Late-gap carry-forward rule (in force for T021–T039).** A gap discovered after T018 must not trigger an unrecorded measurement. It is (1) recorded here as a "late gap" with the question, the requirement it blocks and the task that found it; (2) treated as UNKNOWN in the affected sections and therefore blocking wherever this record says UNKNOWN blocks (T025, T027, T039); (3) carried into §16 with the evidence that would resolve it; and (4) if a local-only measurement is judged necessary, proposed through an Appendix C revision entry and executed only under the T019 rules (question, script and write-side-effect check documented before running; a new script under `EV/local-measurements/`; no existing script executed), with the user told before it runs.

**Late gaps recorded so far**: none.

**T019 outcome: N/A — no gap named** (reference: §4e, "S2: gap named NO", task T018). No local measurement was run; no script was created under `EV/local-measurements/`; no existing evidence or measurement script was executed. Recorded as a completed task state so task T020 may proceed.

## 5. Cold-start line items

Filled by task T021. Numbers are copied from `specs/002-ast-symbol-intelligence/query-cold-start-results.md` (§4–§7) as recorded in §2 E5/E6 and classified in §4d. Every figure is **LOCAL-WALLCLOCK, comparative only** (fresh local `bun` process, this machine; not Cloudflare CPU; not an isolate). **Cold and warm are reported separately and never averaged (FR-021).** No value below is a limit, a budget, or evidence that any Cloudflare limit is or is not met. Nothing was re-measured.

### 5.1 Cold line items (fresh local process; medians of 10 processes; ms) — cold variability NOT RECORDED

| Line item (source table) | java | javascript | typescript | tsx | Scope stated by the source |
|---|---|---|---|---|---|
| Grammar init + parser init — "B. grammar + parser init (`getParser` first call: core init + language load + `Parser()`)" (§5) | 4.5 | 4.3 | 4.8 | 4.7 | core runtime once per isolate; ≈ 0.35–0.64 per additional language (§4 note) |
| Query init — "D. Query compile (cold)" (§5; includes first-use warm-up per the file's own reading) | 3.3 | 4.4 | 12.8 | 13.2 | once per language per isolate |
| Cold parse — "C. parse (cold)" (§5) | 2.7 | 2.3 | 7.6 | 7.1 | once per language per isolate for the cold excess |
| Query execution — "E. Query execution (cold)" (§5) | 1.4 | 0.8 | 2.0 | 1.7 | per file (cold instance shown) |
| **First file** — "file #1 parse+toIR" (§4) | 8.44 | 7.60 | 23.29 | 22.49 | one measured cold file per language; parse + symbol extraction only, **excludes** grammar/parser init |
| Source-stated sum of request-time cold items B+C+D+E (§5) | 11.9 | 11.8 | 27.2 | 26.6 | a sum of listed items, not an average; rows above are separately measured medians, so this sum and the "first file" row are **not additive with each other** |
| Local-only items (excluded from the request-time sum): module import of our code (§5 A) | 3.9 | 3.4 | 3.5 | 3.6 | "bundled at build/isolate start in Workers" (source's words) |
| Local-only items: WASM compile of core + grammars (§5 A') | 8.3 | 7.9 | 7.8 | 8.0 | "local-only; Workers uses build-time `?module`" (source's words) |

### 5.2 Warm line items (same local process after the first files; ms) — reported separately from §5.1

| Line item (source table) | java | javascript | typescript | tsx |
|---|---|---|---|---|
| Warm file, files 2–10 median (§6) | 2.36 | 2.71 | 1.22 | 1.27 |
| Warm file, files 11–50 median / p95 (§6) | 1.37 / 2.23 | 1.53 / 2.46 | 0.87 / 2.37 | 1.05 / 3.95 |
| Warm file, files 51–100 median / p95 (§6) | 1.16 / 1.72 | 1.34 / 2.10 | 0.82 / 1.93 | 1.00 / 3.30 |

Sample: 3 processes for warm measurements (§3 of the source). Warm Query execution ≈ 0.1–0.9, warm `toIntermediateRepresentation` ≈ 0.08–0.9, hashing ≈ 0.00–0.04 per file (source's words). A separate warm-**process** compile figure exists in `combined-single-pass-decomposition-results.md` (java 0.793, javascript 1.062, typescript 4.359, tsx 4.752; sample size NOT RECORDED); it is a different measurement from the cold "D." row and is not merged with it.

### 5.3 Reading the line items (locally, comparative)

Locally, the large items are once per isolate or once per language (core runtime, grammar/parser, Query compile, cold parse excess), and after the first files the per-file cost is small. The source itself states that whether these costs recur "once per file" in production depends on isolate reuse. This section draws no CPU conclusion.

### 5.4 Assumptions and unknowns

| Field | Value | Basis |
|---|---|---|
| `isolate_reuse_assumption` | **none guaranteed** — the design must not assume warm reuse across queue-consumer invocations | Workers "How Workers works" (T004 §8): "An isolate may be spun down and evicted for a number of reasons"; "there is no guarantee that any two user requests will be routed to the same or a different instance of your Worker"; Queues "Consumer concurrency" and "How Queues works" extractions state isolate reuse is not addressed (absence claims subject to the extraction caveat). Register **U5 = UNKNOWN** for queue consumers. |
| `platform_cpu_includes_init` | **UNKNOWN** (register U4) | `evidence/docs-observability.md` (T005) shows no page stating whether platform CPU (`CPUTimeMs` / `$workers.cpuTimeMs`) includes startup, grammar/parser/Query initialization or WASM instantiation. Workers "Limits" gives Worker startup its own limit ("parse and execute its global scope … within 1 second") and error 10021 names a startup CPU limit; that establishes a separate startup limit, not the inclusion rule for reported per-invocation CPU. |
| Cold cost per invocation or per isolate on Cloudflare | **UNKNOWN** | no PLATFORM-TELEMETRY exists; local fresh process ≠ Cloudflare isolate (§4a item 5) |

### 5.5 Where initialization happens in the repository (REPO-BEHAVIOR, `evidence/repo-consumer-mapping.md` "Initialization sites")

- WASM modules (core + 4 grammars): module scope, build-time `?module` imports (`grammar-provider.ts:2-6`).
- `Parser.init`, `Language.load`, `new Parser()` + `setLanguage`: **lazy, inside the first `getParser()` call in an isolate**, memoized in module-level `initPromise` / `languageCache` / `parserCache` (`grammar-provider.ts:209-283`). They are paid inside the first handler call that needs them; shared by later invocations only if the same isolate is reused (not guaranteed).
- Compiled `Query`: at `HEAD`, `new Query(...)` runs **per call** (`to-intermediate-representation.ts:48` at `HEAD`); in the working tree an unadopted Query-cache experiment (Set B) memoizes it per (Language, query source) at module level (`to-intermediate-representation.ts:50-63`). Its adoption is decided separately (§9), not here.
- Query `.scm` sources: module scope, build-time `?raw` strings (`extraction-pipeline.ts:13-16`, `28-33`).
- Per-file tree: created and `tree.delete()`d per call (`extraction-pipeline.ts:131-153`).

Not established: how often consecutive queue invocations get a fresh isolate (U5).

## 6. Processing-unit evaluation

Structure: 6.1 processing-unit evaluation (task T022), 6.2 CPU budget condition, analysis only (task T023), 6.3 plan-constraint check (task T026), 6.4 selection outcome (task T027). Verification: task T028.

### 6.1 Processing-unit evaluation (task T022)

Basis: §3 (accounting boundaries; unit and limit UNKNOWN on Free), §4d/§5 (local comparative evidence), `evidence/repo-consumer-mapping.md` (REPO-BEHAVIOR), `evidence/docs-workers-queues.md` (T004; extraction-read caveat). Code read for T022 (read-only): `src/lib/code-intel/symbols/symbol-worker.ts:105-140` and `extraction-pipeline.ts:84-175`. **This evaluation uses counts and qualitative structure only; it contains no CPU-ms figure, no CPU budget and no selection.** "Budget fit" is a *derived conclusion* (task T023) and is not evaluated here; it is not a ninth criterion (FR-006). The current repository is described as REPO-BEHAVIOR and is **not** assumed to be one file per invocation (§3.3).

**Five shapes** (parameters are named, not chosen; no numeric value is selected here):

| Shape | Definition | Relation to the repository as coded |
|---|---|---|
| **P1** one file per message | each queue message carries one file | not the current shape (current message = a cursor page, `symbol-worker.ts:113`) |
| **P2** multiple files per message | a message covers a page of files, all processed in the message | **current shape**: page = up to `extractionBatchSize` (default 50; env-overridable) |
| **P3** multiple messages per invocation | one invocation receives a batch of messages and processes them all | **current behavior**: the hook loops over all `batch.messages`; delivered count ≤ `max_batch_size` (10 in `wrangler.toml`), actual count UNKNOWN |
| **P4** bounded files per message | P2 with an explicit cap `k` on files per message | expressible by the existing `extractionBatchSize` setting; `k` unchosen |
| **P5** bounded total work per invocation | an explicit ceiling `W` on aggregate work across all messages of one invocation | not present; would need new cross-message accounting and early-exit/re-enqueue logic |

The current repository is P2 + P3 combined: a message is a page of up to 50 files and an invocation may contain several messages.

**6.1.1 CPU exposure under each plausible accounting boundary** (from §3.1; which boundary applies on Free is UNKNOWN, so exposure is reported for **each**, as work that accrues inside the boundary, in counts). `m` = messages per invocation (UNKNOWN; ≤ the configured maximum, 10 in the current file); `E` = `extractionBatchSize`; "init" = grammar/parser/Query initialization paid once per isolate/language if the isolate is fresh (§5.4; reuse not guaranteed).

| Shape | File boundary | Message boundary | Batch / invocation boundary |
|---|---|---|---|
| **P1** | 1 file | 1 file + per-message overhead (page query, job upserts) | m files (m from delivered batch; UNKNOWN) + init on a fresh isolate |
| **P2** (current unit) | 1 file | up to E files (default 50) | m × up to E files + init on a fresh isolate |
| **P3** | 1 file | as P2 | m messages' work; m governed by `max_batch_size` (1 to 100 per T004 §4; configured 10) and by what the platform delivers |
| **P4** | 1 file | ≤ k files | m × ≤ k files + init on a fresh isolate |
| **P5** | 1 file | ≤ its share of W | ≤ W by construction; m no longer multiplies exposure, provided the ceiling is enforced |

Whether any exposure exceeds or fits a limit is not stated (limit UNKNOWN, §3.5; the derived conclusion belongs to task T023).

**6.1.2 The eight canonical criteria (FR-006)** — counts and structure, from the code read and T004 §4/§6. `N` = files in a snapshot.

| Criterion | P1 | P2 (current) | P3 | P4 | P5 |
|---|---|---|---|---|---|
| **CPU exposure** | see 6.1.1 | see 6.1.1 | see 6.1.1 | see 6.1.1 | see 6.1.1 |
| **Queue operations** | one message per file: about N messages per snapshot; each message costs a write, a read and a delete operation (Queues Pricing, T004 §6: "Operations are per message, not per batch"; 64 KB granularity, Free 10,000/day per T004 §6) → about 3N, plus retries | about ceil(N / E) messages → about 3·ceil(N / E) | unchanged message count vs P2 (batching changes invocations, not messages) | about ceil(N / k) messages (k below E raises operations) | as P2/P4 plus extra operations whenever the ceiling forces a re-enqueue of remaining work |
| **D1 read/write volume** | per-file D1 work as coded (`getSnapshotFileRow` read; `upsertFileExtraction`; `replaceSymbolsForFile`; a checkpoint `upsertExtractionJob` per file) **plus per-unit overhead paid per file** (page query, job upserts, `recomputeJobCounters`, `markJobCompleted`) | per-file D1 work as above; per-unit overhead amortized over up to E files | as P2 | between P1 and P2 depending on k | as P2 plus extra unit bookkeeping when work is split |
| **R2 reads** | one `getObject` per parsed file; unsupported and oversize files skip R2 (`extraction-pipeline.ts:101-117` gate uses recorded `sizeBytes`) | same per file | same | same | same |
| **Retry granularity** | one file (per-message `ack()`/`retry()`; docs: when a message in a batch fails, "the entire batch is retried, unless you have explicitly acknowledged a message", T004 §4) | one page (up to E files); the resume checkpoint (`symbol-worker.ts:108-109, 131`) limits re-work within a unit as coded, to be judged in §10 (task T025) | as P2; a failing message can lead to the batch being retried except messages already acknowledged | up to k files | depends on the design of the ceiling; not defined |
| **Duplicate-delivery impact** | redelivery of a completed unit is a no-op (`symbol-worker.ts:96-99`, as coded); shown status is decided in §10 | same; redelivery mid-unit resumes past the checkpoint as coded | same | same | UNKNOWN until designed |
| **Determinism** | decided in §10 (task T025); per-file extraction is independent of batch composition as coded, not yet shown | decided in §10 | decided in §10 | decided in §10 | UNKNOWN until designed |
| **Implementation complexity** | change of message shape and enqueue logic (`enqueueNextUnit` cursor page → file); many more messages | none (current) | none in code; a configuration value (`max_batch_size`) in `wrangler.toml` | configuration only (`CODE_INTEL_EXTRACTION_BATCH_SIZE`); whether `process.env` is populated on Workers is UNVERIFIED (§3.2 row 3) | new cross-message accounting, early exit and re-enqueue paths in the Feature 002 consumer (a change to a protected feature; needs separate approval) |

*Not evaluated here*: Budget fit (task T023); shown/UNKNOWN status of bounded re-execution, idempotence and determinism (task T025); plan-constraint check (task T026). Statements marked "as coded" describe the repository, not verified behavior.

**6.1.3 Oversize and fits-no-unit handling (`oversize_file_outcome`)**

- **File above `CODE_INTEL_MAX_FILE_SIZE_BYTES`** (default 10 MB, `config.ts:12`): identical under P1–P5. The file is gated on its recorded `sizeBytes` **before any R2 read or parse**, and is persisted as `status: "skipped_unsupported"` with a `failureReason` such as "exceeds size ceiling (… > … bytes)" plus an empty symbol set (`extraction-pipeline.ts:101-117`). The unit shape does not change this. The 10 MB value is a size gate; it is not a CPU bound and no CPU limit is inferred from it.
- **A file that fits no considered unit** — a file within the size gate whose own parse cost would exceed the applicable CPU limit even as a single file: **no shape in P1–P5 splits a file below one file**, so none can help. What happens is UNKNOWN on two counts: (a) the limit and its unit are UNKNOWN (§3.5); (b) what the platform does on CPU exhaustion inside a queue consumer (which outcome value is reported, whether the message is retried) is UNKNOWN (C1 open). App side as coded: per-file failures inside `extractFile` are caught and recorded (`status: "failed"`), but a platform termination would not be caught by that handler; the unit-level cap is `maxRetryAttempts = 5` (`symbol-worker.ts:161-167`). `oversize_file_outcome` for this case = **UNKNOWN** for every shape.
- **Unsupported-language files**: recorded `skipped_unsupported`, no parse (same code path).

**6.1.4 Evaluation result.** All five shapes are evaluated against all three boundaries and all eight criteria above. No shape is selected, none is approved, and no criterion value is derived from local wall-clock timing. The selection decision belongs to task T027.

### 6.2 CPU budget condition (analysis only) (task T023)

**Status of this sub-section: analysis statements only. They are never a basis for selecting a unit** (selection is decided only under the rule in §6.4, task T027). No numeric budget is written. Workers Free HTTP "10 ms" is not used as X (K4). Neither "5 minutes" nor "15 minutes" is used as X (K1, K2).

**Parameters**
- **X** = the CPU budget established by the authoritative Queue Consumer execution model for the Workers Free plan. **X = UNKNOWN** (register U1; §3.5). It is not chosen, estimated or derived from local timing.
- **Y** = the accounting unit at which X applies (invocation / batch / message / file). **Y = UNKNOWN on Free** (register U2 PARTIAL; §3.1).
- **M** = a safety margin. It is a **named parameter with no value**: no number is chosen for M, and none can be justified without X.

**The conditional statement, per shape** (P1–P5 from §6.1). Each has the same form: *If the authoritative Queue Consumer execution model establishes CPU budget X for unit Y, the selected unit must remain within X with safety margin M.* What "the selected unit must remain within X" would mean for each shape, given the unit Y that the platform turns out to use:

| Shape | If Y = file | If Y = message | If Y = batch / invocation |
|---|---|---|---|
| **P1** one file per message | per-file work ≤ X with margin M | same as file (a message is one file) | the aggregate of the messages delivered in one invocation (m files plus init on a fresh isolate) ≤ X with margin M; m is UNKNOWN, so the condition depends on the delivered batch size |
| **P2** multiple files per message (current unit) | per-file work ≤ X with margin M | the work of a page of up to E files ≤ X with margin M | m pages (m × up to E files plus init on a fresh isolate) ≤ X with margin M |
| **P3** multiple messages per invocation | per-file work ≤ X with margin M | per-message work ≤ X with margin M | the aggregate across the delivered batch ≤ X with margin M; the shape adds no bound on m by itself (`max_batch_size` is a maximum, not a guarantee) |
| **P4** bounded files per message | per-file work ≤ X with margin M | ≤ k files' work ≤ X with margin M; k must be chosen after X is known | m × ≤ k files ≤ X with margin M |
| **P5** bounded total work per invocation | per-file work ≤ X with margin M | per-message share ≤ X with margin M | ceiling W chosen so the invocation aggregate ≤ X with margin M; W chosen only after X and Y are known |

Each statement is conditional on an unresolved premise (X and Y). The record does not assert that any shape satisfies or violates any of them.

**Cold-invocation justification requirement (FR-010), per shape.** Any selected shape must include a justification that it holds when the invocation is **cold**, that is, on a fresh isolate paying grammar/parser/Query initialization and the cold parse excess (§5.1) inside the measured unit, because isolate reuse is not guaranteed (`isolate_reuse_assumption = none guaranteed`, U5 UNKNOWN) and whether reported CPU includes initialization is UNKNOWN (U4). The justification cannot rest on warm figures (§5.2), on locally measured medians as if they were platform CPU, or on an amortization across invocations. What the justification would have to show, per shape:
- **P1**: init is paid once per fresh isolate; with a small unit, the initialization share of the unit is large. Whether X covers init + one file cannot be asserted.
- **P2 / P4**: init is paid once per fresh isolate and shared across the files of the page; the page-level total must still be shown against X at unit Y.
- **P3**: init is paid once per fresh isolate and shared across all messages of the invocation; the aggregate must be shown against X at unit Y, with m unknown.
- **P5**: init is inside the ceiling W; W must leave room for it at the cold case.

**Derived conclusion — budget fit (a derived conclusion, not a ninth criterion; FR-006).** Because X and Y are UNKNOWN, budget fit is **undetermined for every shape** (P1, P2, P3, P4, P5). It is not "fits", not "does not fit", and no shape ranks above another on this basis. It will remain undetermined until authoritative evidence establishes X and Y (OFFICIAL-DOC or PLATFORM-TELEMETRY) or a waiver is validly granted (FR-038; none exists).

**Not done here**: no unit is selected (task T027); no numeric budget or margin is stated; no local timing is compared with X; Feature 004 T007 is not cleared and remains STOPPED.

### 6.3 Plan-constraint check (task T026)

**Constraint (FR-027)**: each shape and architecture may depend only on the Workers **Free** plan, the **existing R2** bucket, Cloudflare Queues **within 10,000 operations/day**, and D1 **within its free tier**. A dependency on any paid service is **reported as out of constraint, not adopted**. Sources: `evidence/docs-workers-queues.md` (T004 §6, Queues Pricing, extraction-read), §7 (counts), `wrangler.toml`. No documentation was read for T026 and nothing was measured. Result values: `within` / `out of constraint` / `undetermined`.

| Dependency | P1 | P2 (current) | P3 | P4 | P5 | Basis |
|---|---|---|---|---|---|---|
| Workers Free plan only | within | within | within | within | within | no shape needs a plan-gated Workers feature; none requires raising the CPU limit |
| Existing R2 (no new bucket) | within | within | within | within | within | R2 reads per parsed file (§6.1.2), existing bucket |
| Queues ≤ 10,000 operations/day | **undetermined** | **undetermined** | **undetermined** | **undetermined** | **undetermined** | about 3 operations per message (§7.4); the number of files per day is UNKNOWN (tier 4), so the daily total cannot be judged. Ceilings only: about 3,333 messages/day; P1 message count grows with the number of files, P2/P4 with the number of pages; retries and the acquisition queue are extra (UNVERIFIED scope of the daily allowance) |
| D1 within its free tier | **undetermined** | **undetermined** | **undetermined** | **undetermined** | **undetermined** | D1 free-tier figures UNKNOWN (§7.5); statement counts per file are ≥ 3 (§7.5); P1 pays per-unit overhead per file, P2/P4 amortize it |
| No paid observability or delivery service | within | within | within | within | within | shapes do not depend on one; see the out-of-constraint list below for the telemetry route |

**Out of constraint (reported, not adopted)**:
- **Workers Trace Events via Logpush** — "available on the Workers Paid plan" (T005 evidence E8).
- **Tail Workers** — "available to all customers on the Workers Paid and Enterprise tiers" (E8).
- **Paid CPU-limit configuration** — raising the CPU limit through `cpu_ms` is labelled Paid-only in the extraction of Workers "Limits" (S-b; the label is the extraction's wording, not a verified quote), and Queues "Limits" describes "Consumer CPU time: Configurable to 5 minutes" (S-g). Neither is adopted, and neither is read as available on Free (K2).
- Any additional queue, Durable Object, KV or paid D1/R2 usage a shape might need: none is required by P1–P5 as described.

**Within-constraint telemetry route (not adopted as evidence, only listed)**: Workers Logs (Free: 200,000 logs/day, 3-day retention, T005) and Query Builder ("available to all developers and requires no enablement", T005) — whether they carry CPU for queue invocations on Free is UNKNOWN (U3).

**Plan-constraint check result**: **not passed for any shape**, because two conditions are `undetermined` for all five (Queues daily operations against an unknown workload; D1 free-tier figures unknown). This is not a "fail" — no shape was found to exceed a constraint — and it is not a "pass". It is a blocker for selection under T027 condition (f) until D1 free-tier figures and a daily file-volume basis exist. No unit is selected; Feature 004 T007 remains STOPPED.

### 6.4 Selection outcome (task T027)

**Rule (tasks.md T027).** A processing unit **may be selected only if ALL** of (a)–(g) hold. If X remains UNKNOWN and there is no valid waiver, or any of (b)–(g) is UNKNOWN, the outcome **MUST** be "no unit selectable yet". The conditional budget statement of §6.2 is not a basis for selection. At most one unit may be selected.

**Outcome: NO UNIT SELECTABLE YET.** No unit among P1–P5 is selected, recommended or ranked. The current repository shape (P2 + P3) is described as REPO-BEHAVIOR only and is not endorsed by this outcome.

| Condition | State | Evidence | What would resolve it |
|---|---|---|---|
| **(a)** budget X established by authoritative evidence (OFFICIAL-DOC / PLATFORM-TELEMETRY) **or** validly waived under FR-038 | **NOT MET.** X = UNKNOWN (U1); unit Y = UNKNOWN on Free (U2 PARTIAL); K1 (15 vs 5 minutes) and K2 unresolved; **no waiver exists** (none created or assumed by Feature 005) | §3.1, §3.4, §3.5, §6.2, §16 | An official statement naming Workers Free, the Queue Consumer path, a value and its unit; or platform-reported CPU for queue invocations on Free (needs a separately authorized live experiment; none authorized); or an explicitly authorized waiver recorded through Appendix C. A local measurement cannot supply any of these. |
| **(b)** bounded re-execution shown (FR-031) | **PARTIAL.** `shown (N3)` for P2/P3/P4 by code reading (checkpoint + capped attempts); UNKNOWN for P1 and P5; the cold-init repeat per retry on a fresh isolate is bounded only by the attempt cap; no test evidence | §10 | Design of P1/P5; tests or an execution record for the shapes that are candidates |
| **(c)** idempotence shown (FR-032) | **PARTIAL.** `shown (N3)` for sequential duplicate delivery on P2/P3/P4; concurrent duplicates UNKNOWN (no mutual exclusion found, frequency UNKNOWN); P1/P5 UNKNOWN; "identical persisted state" definition (O4) pending review | §10 | Authoritative statement on consumer concurrency and duplicates, or a lease design; review of the persisted-state definition |
| **(d)** determinism shown (FR-033) | **PARTIAL.** `shown (N3)` for per-file content across batch composition and message order on P2/P3/P4; cold-vs-warm output equivalence UNKNOWN for every shape | §10 | A local output-equivalence check under the T019 rules (late-gap procedure; not run) |
| **(e)** cold-invocation justification exists (FR-010) | **NOT MET.** Requirement stated per shape (§6.2); no justification exists because X, Y and the platform's init accounting (U4) and isolate reuse (U5) are UNKNOWN | §5.4, §6.2 | Evidence for X/Y (a) plus init-inclusion and isolate-reuse statements |
| **(f)** plan-constraint check passes (T026) | **NOT MET.** Undetermined for all shapes: Queues daily operations against an unknown file volume; D1 free-tier figures UNKNOWN | §6.3, §7.4, §7.5 | D1 free-tier figures from the official D1 pricing/limits page read as documentation (or a repository document citing them); a basis for daily file volume |
| **(g)** oversize / fits-no-unit case has a stated outcome (T022) | **PARTIAL.** Oversize (> `CODE_INTEL_MAX_FILE_SIZE_BYTES`, 10 MiB default): outcome stated (skipped before R2/parse, recorded as `skipped_unsupported`). A file within the size gate whose own cost exceeds the limit: **UNKNOWN** for every shape (limit UNKNOWN; platform behavior on CPU exhaustion UNKNOWN, C1) | §6.1.3 | Same evidence as (a), plus the platform's behavior on CPU exhaustion in a queue consumer |

**Decision**: because (a), (e) and (f) are NOT MET and (b), (c), (d), (g) are PARTIAL with UNKNOWN parts, the selection rule is not satisfied. The record selects **no unit**.

**What this does not say**: it does not say the current shape is unsafe or safe; it does not create or presume a waiver; it does not change the S1 result or U1–U5; it does not clear Feature 004 T007, which remains STOPPED.

## 7. Resource bounds

Filled by task T024 from `evidence/scale-tiers.md` (task T007 scale tiers) and `evidence/repo-consumer-mapping.md` (T006). **Arithmetic in this section is limited to counts** (messages, files, queue operations, D1 statements). It contains **no CPU-ms arithmetic and no CPU conclusion**, and does not use the 300-file run for any CPU statement. Working-tree values; deployed values UNKNOWN.

### 7.1 The four scale tiers (four different quantities; none converts into another)

| Tier | Label | Content | Status |
|---|---|---|---|
| **1** | Measured 300-file run | One synthetic run of 300 sequential single-pass extractions on a local Bun process; recorded process memory (rss/heapUsed/external) and tree-delete counts only. **No timing was recorded.** | **Lifecycle/memory evidence only. Not a worst case, not a production size, not a CPU result, not per-invocation CPU.** The "300" in the decomposition sweep tables is a symbols count. Feature 004 T073 (planned 300-file simulation) is unrun and not authorized here. |
| **2** | Configured limits | `max_batch_size` 10 (`wrangler.toml:33`, `:42`); `max_retries` 5; `CODE_INTEL_EXTRACTION_BATCH_SIZE` 50, env-overridable (`config.ts:10`, `symbol-worker.ts:113`); `CODE_INTEL_MAX_FILE_SIZE_BYTES` 10 MiB (`config.ts:12`, gate `extraction-pipeline.ts:101-117`); `CODE_INTEL_CHECKPOINT_FILE_COUNT` 200 (acquisition unit, Feature 001, `config.ts:4`); list-API page sizes 500/100 (`config.ts:8-9`); `CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET` 20_000 (`config.ts:5`; **meaning and use not investigated: UNVERIFIED, and not to be read as a Cloudflare CPU budget**). | Constants in the working tree; unit/page/size quantities, distinct from each other. None is a cap on files per snapshot. |
| **3** | Established production upper bound | Searched `src/`, `plugins/`, `data/*.sql`, `specs/001*`, `specs/003*` for an enforced maximum of files per snapshot/source. | **NOT ESTABLISHED.** `specs/001-…/spec.md:154`: "there is no fixed repository-size ceiling in this specification". Absence is scoped to the searched locations. Tier 1 is therefore not a production worst case. |
| **4** | Unknown / unbounded | Files per snapshot in production; real file-size and language distribution; delivered batch size and page fill; Cloudflare CPU accounting for a queue-consumer invocation on Free; isolate reuse; files processed before an isolate recycles. | **UNKNOWN**. |

### 7.2 Enforced maxima and where each is enforced (the four repository quantities stay separate)

| Quantity | Bound | Enforced by | Enforced how / note |
|---|---|---|---|
| Messages per invocation | ≤ `max_batch_size` = 10 in the current file | Cloudflare queue configuration (`wrangler.toml:42`) | a *maximum*, not a guarantee; delivered count never observed (UNKNOWN); deployed config unread |
| Files per message | ≤ `extractionBatchSize` = 50 (default) | D1 `LIMIT` in `listSnapshotFilesPage` (`persistence/d1-client.ts:326-354`), `symbol-worker.ts:113` | code-enforced; env override; whether `process.env` is populated on Workers is UNVERIFIED |
| File size that is parsed | files above 10 MiB are skipped before R2 read/parse | `extraction-pipeline.ts:101-117` | per file, not a CPU or count bound |
| **Total work per invocation** | **unbounded by any aggregate control** | none | no cross-message cap exists (P5 absent, §6.1). Ceiling from configuration only: messages × files per message. |
| Files per snapshot | **unbounded**: no enforced maximum found | — | tier 3 NOT ESTABLISHED |

### 7.3 Worst-case per-invocation work — counts, not CPU

- **Configuration ceiling, not an observed value**: if the platform delivered a full batch of 10 messages and every message were a full page of 50 files, one invocation would handle up to 10 × 50 = **500 files** (`max_batch_size` × `extractionBatchSize`). This is arithmetic on two configured maxima only. Whether the platform delivers a full batch, and whether pages are full, is UNKNOWN (§3.2 rows 2 and 4).
- **One structural limit from the code**: a single snapshot has at most one unfinished symbol-extraction message in flight, because `enqueueNextUnit` runs only after the current unit finishes (`symbol-worker.ts:144-146`, `171-178`). A single snapshot therefore contributes at most one page (≤ 50 files) to one invocation, apart from redelivery. A larger count needs messages from other snapshots, redeliveries or retries, and the code does not show how often that occurs.
- Per-file parse work is skipped for unsupported-language and oversize files (no R2 read, no parse), so "files handled" is an upper bound on "files parsed".
- No relation between these counts and CPU is stated (limit UNKNOWN; §3.5).

### 7.4 Queue operations per snapshot (counts; free-plan quota from Queues "Pricing", T004 §6)

Documented (as extracted): "10,000 operations/day included" on the Workers Free plan; "An operation is counted for each 64 KB of data that is written, read, or deleted"; "Operations are per message, not per batch. A batch of 10 messages … would incur 10x write, 10x read, and 10x delete operations". The symbol-queue message body is `{ snapshotId, unitIndex, fromCursor }` (`symbol-worker.ts:41-46`), far below 64 KB, so each message costs about **3 operations** (one write, one read, one delete), more on retry or redelivery.

| Shape | Messages per snapshot of N files | Queue operations per snapshot (≈, no retries) |
|---|---|---|
| P1 (one file per message) | about N | about 3 N |
| P2, P3 (current; E = 50) | about ceil(N / 50) | about 3 · ceil(N / 50) |
| P4 (cap k) | about ceil(N / k) | about 3 · ceil(N / k) |
| P5 | at least as P2/P4; more when a ceiling forces re-enqueue | not derivable until W is designed |

Against the documented 10,000 operations/day (Free): ceilings of about 3,333 messages/day (all shapes, one queue, no retries). Under P1 that is about 3,333 files/day; under P2 about 3,333 × 50 = 166,650 files/day. **These are ceilings from documented per-message counting only**; they exclude retries and redeliveries, the Feature 001 snapshot-acquisition queue (which draws on the same account-level daily operation allowance, per the page text as extracted; confirming this scope is UNVERIFIED), and any other queue traffic. They are not measured and not forecasts.

### 7.5 D1 operations per snapshot (counts) vs D1 free-tier figures

Per parsed file the code issues at least: 1 read (`getSnapshotFileRow`), 1 write `upsertFileExtraction`, `replaceSymbolsForFile` (statement and row count depend on the number of symbols: UNKNOWN), and 1 checkpoint `upsertExtractionJob` (`symbol-worker.ts:115-132`; `extraction-pipeline.ts`). Unsupported and oversize files still incur the extraction-row and symbol-replace writes but no R2 read. Per unit, additionally: the page query, job upserts, `recomputeJobCounters` and `markJobCompleted`; the exact statement counts are not itemized here. Under P1 the per-unit overhead is paid per file; under P2 it is amortized over up to 50 files (§6.1.2).

**D1 free-tier figures: UNKNOWN.** No D1 free-tier limit was found in the repository documentation searched (`docs/plan.md`, `specs/001*`, `specs/002*`, `docs/`). The task allows the official D1 pricing/limits page as a source; task T024 is a documentation-writing task and **no public documentation was read for it** (documentation research is authorized only for T004, T005, T036 and T039), so no D1 figure is cited and no D1 free-tier comparison is made. This gap is carried to §16 for task T042 (what would resolve it: the official D1 pricing/limits page read as documentation, or a repository document that already cites it).

### 7.6 What this section does not conclude

No CPU conclusion from any tier; tier 1 is not a worst case; no file-count ceiling for production is established or assumed; no numeric Queue Consumer CPU budget; no local timing is used. Feature 004 T007 remains STOPPED.

## 8. Single-pass vs two-pass

Structure: 8.1 side-by-side comparison (task T030), 8.2 verdict and boundary impact (task T031). Single-pass extraction is a **decision candidate**; this record does not approve or implement it (FR-015).

### 8.1 Current two-pass vs single-pass (task T030)

**Definitions (as used in the sources).** *Two-pass* = the Feature 002 symbol-extraction pass (parse, symbols) followed by a **separate** Feature 004-style relationship pass that re-parses the same file (E2 scenarios A and B; `twoPass_total = A + B`, described by the source as modeling the two-invocation architecture). It is the **planned** Feature 004 architecture (`specs/004-…/research.md` §1, `plan.md:135`: "one unit per Tier-1 file"); Feature 004 is not implemented, so the "current two-pass" is a planning assumption plus the measured local A/B pieces, not deployed behavior. *Single-pass* = one parse feeding symbol extraction and relationship observation, one tree delete (E2 scenario C, hypothetical, unbuilt). Local numbers are **LOCAL-WALLCLOCK, comparative only** (§4a); the roughly 31–33 % figure is a relative local comparison, not a Cloudflare CPU saving. Evidence ids: E2, E3, E5, E6 (§2, §4d), N1 (`evidence/repo-consumer-mapping.md`), T004 §6 via E7, planning documents (labelled).

| Criterion | Two-pass (planned Feature 004: symbols pass + separate relationship re-parse) | Single-pass (hypothetical, unbuilt) | Evidence and label |
|---|---|---|---|
| **Cold CPU** | Each pass runs in its own queue invocation, so each may pay grammar/parser/Query initialization if its isolate is fresh (reuse not guaranteed, U5). Structural, **not measured**. | Initialization paid once per unit on a fresh isolate. Structural, **not measured**; no cold single-pass measurement exists (E2 is warm, steady-state). | E2 (warm only), E5/E6 (cold items per invocation, LOCAL-WALLCLOCK); platform cold CPU **UNKNOWN**; U4/U5 |
| **Warm CPU** | At 2,500 lines, median two-pass total: java 65.386, javascript 64.494, typescript 79.667, tsx 99.556 ms (LOCAL-WALLCLOCK) | median single-pass (C): java 44.037, javascript 44.726, typescript 54.726, tsx 66.522 ms, i.e. **32.7 %, 30.7 %, 31.3 %, 33.2 % lower locally** than two-pass at that size and language | E2 phase breakdown; LOCAL-WALLCLOCK, comparative only, synthetic sweep; **not** platform CPU and not a compliance statement |
| **Queue operations** | Two message streams: Feature 002 pages (about ceil(N / 50) messages, §7.4) **plus** the planned Feature 004 parsed-phase messages, one per Tier-1 file (planning assumption, not evidence), each about 3 queue operations | One message stream if relationship work rides in the Feature 002 units; no separate parsed-phase messages | counts from §7.4 (T004 §6, OFFICIAL-DOC as extracted); Feature 004 unit shape = planning assumption (`plan.md:135`) |
| **R2 reads** | Each file's bytes are read once per pass (Feature 002 does not retain parsed ASTs; the relationship pass re-parses from stored bytes: `research.md` §3, §1) → about two reads per parsed file | one read per parsed file | N1 (`extraction-pipeline.ts:131-139` read per file); Feature 004 `research.md` (planning assumption for the second read) |
| **D1 volume** | Per-pass job/checkpoint rows and per-unit overhead in each pass, plus relationship writes | shared unit overhead; the relationship and symbol writes themselves are the same in count; whether cross-file resolution still needs a later step is **UNKNOWN** | §6.1.2/§7.5 counts; `relationship_extraction_jobs` in `data/code-intel-schema.sql` (Feature 004 scaffolding, §9.1); resolution placement **UNKNOWN** |
| **Retry / idempotency** | Each pass is independently retried and independently idempotent by design (Feature 004 plan: skip if rows already exist for the file at the version pair, `plan.md:135`); a relationship-pass failure does not re-run symbol extraction | one unit re-executes both symbol and relationship work on retry (larger re-execution per failure); one job state; a relationship failure would re-run symbol extraction unless separated in the design | N3 for the Feature 002 half (§10.1); Feature 004 half = planning assumption; single-pass = UNKNOWN until designed |
| **Memory / tree lifecycle** | Two trees per file, each deleted after use (as designed); no memory measurement of the two-pass shape as such | one tree per file, one `tree.delete()`. E2 memory test: 300 sequential single-pass extractions, rss 540.2 → 553.4 MB, heapUsed 187.2 → 194.5 MB, external 140.4 → 142.9 MB, 300 trees created / 300 deleted, parser instance reused (local Bun process; **no timing; not Cloudflare isolate memory**) | E2 memory test (LOCAL, lifecycle/memory only); two-pass memory **UNKNOWN**; the 300 is a file count of that loop only, not a worst case |
| **Determinism** | Two independent deterministic passes (symbol identity is a pure hash, N3); ordering dependency: the relationship pass needs the symbols persisted first | one pass; identical per-file content is expected but not shown; cross-file resolution ordering is a design question | N3; the single-pass determinism is UNKNOWN until designed |
| **Feature 002 boundary impact** | Additive only: new tables/queue/functions; Feature 002 source and function signatures unchanged; **consistent with Feature 004 FR-017** ("MUST NOT modify any Feature 001 or Feature 002 table, source file, or public function signature") | Requires extracting relationship observation inside Feature 002's extraction path (`extractFile` / `toIntermediateRepresentation` or a wrapper), which **conflicts with Feature 004 FR-017 as currently written**; possible only through a separately reviewed amendment (task T031, FR-017 of Feature 005) | `specs/004-…/spec.md:124` (FR-017), `specs/005-…/spec.md` FR-016/FR-017; REPO-BEHAVIOR (N1) for where the path lives |
| **Complexity** | Two workers, two job tables, two queues' worth of state (planned); duplicate parse | one worker path, coupled failure/retry semantics, changes to a protected feature, a new unit contract | planning documents; REPO-BEHAVIOR; qualitative |

**Statements this table does not support**: that single-pass is approved, safe or adopted; that the local 31–33 % reduction is a platform saving; that cold CPU differs by any amount on Cloudflare; that either shape fits a Cloudflare limit. **Source-record notes carried**: E2's warm-up count is INCOMPLETE in its results file; the recorded tree-count inconsistency in E3 (820 vs 1025) is unresolved.

### 8.2 Verdict and boundary impact (task T031)

**Verdict (a recommendation for review, not an approval): DEFER.** Single-pass extraction is neither adopted nor rejected by this record. It remains a decision candidate and is **not implemented** (FR-015). Nothing in this record changes any Feature 002 or Feature 004 artifact.

**Why defer, from the evidence**
- The only support for single-pass is a **local, comparative, warm** reduction (about 31–33 % lower wall-clock at 2,500 lines in a synthetic sweep, E2; LOCAL-WALLCLOCK). It is not a platform CPU saving, and the record has no platform CPU evidence at all.
- Whether either shape fits a Cloudflare limit cannot be assessed: the limit X and its accounting unit Y are UNKNOWN on Free (U1, U2), and the record's selection outcome is "no unit selectable yet" (§6.4).
- Cold CPU for both shapes is UNKNOWN; two-pass memory is UNKNOWN; single-pass retry, idempotency and determinism are UNKNOWN until a unit is designed (§10); whether cross-file resolution can be part of a single-pass unit is UNKNOWN.
- Adoption would change protected Feature 002 code paths and conflict with Feature 004 FR-017 as written (§8.1), so it would need a separate, reviewed amendment.
- Rejection is not supported either: the local evidence points toward lower duplicated work (one parse, one R2 read, no second stream of messages), and nothing found shows that single-pass violates a constraint.

**Evidence that would decide it (adopt or reject)**
1. Authoritative evidence for X and Y on the Free plan (§3.5; a valid waiver would also be a decision input), so the unit can be compared with a limit.
2. Cold-invocation evidence for both shapes: what platform-reported CPU includes (U4) and how often an isolate is fresh (U5); a local cold single-pass comparison would only be comparative.
3. A single-pass unit design with shown bounded re-execution, idempotence and determinism (FR-031–033), including where cross-file resolution happens.
4. A memory comparison of the two-pass shape (E2 measured single-pass only).
5. Review outcome on amending Feature 004 FR-017 and the Feature 002 boundary.

**Artifacts that would require amendment if single-pass were adopted (paths only; no amendment is made or begun)**

*Feature 002 (protected; not modified by this workstream)*
- `src/lib/code-intel/symbols/extraction-pipeline.ts`
- `src/lib/code-intel/symbols/to-intermediate-representation.ts`
- `src/lib/code-intel/symbols/symbol-worker.ts`
- `src/lib/code-intel/persistence/symbol-d1-client.ts`
- `specs/002-ast-symbol-intelligence/spec.md`, `plan.md`, `data-model.md`, `research.md`, `tasks.md`, and `contracts/`

*Feature 004 (not modified by this workstream)*
- `specs/004-engineering-relationship-graph/spec.md` (FR-001 and FR-017 in particular), `plan.md`, `research.md` (§1 and §3), `data-model.md`, `tasks.md`, and `contracts/` (`extract-relationships.functions.md`, `d1-schema-additions.sql`)
- `src/lib/code-intel/relationships/` and `src/lib/code-intel/domain/relationship.ts` (Feature 004 scaffolding, §9.1)

This list is a scoping aid and is not exhaustive; a review would confirm it.

**Change control.** Any change to these artifacts requires a separate review and approval; this workstream does not begin it. **Feature 002 is untouched.** Feature 004 is not modified. Feature 004 T007 remains STOPPED.

## 9. Query-cache decision

Structure: 9.1 working-tree status as found (task T029), 9.2 Query-cache decision (task T032), 9.3 working-tree status recommendation (task T033). Full classification: `evidence/hunk-classification.md`.

### 9.1 Working-tree status (as found) (task T029)

**Status label (fixed by the task): the Query-cache change in the working tree is an evidence-only, unadopted experiment. It is not an approved implementation.** Feature 005 has not staged, stashed, reverted, edited, run or committed it; T002 Set B hashes were re-checked read-only on 2026-09-24 and both files are byte-identical to the T002 baseline.

| Item | Where | Classification |
|---|---|---|
| Compiled-`Query` memo (`compiledQueryCache` WeakMap, `getCompiledQuery`) and its use in `collectRawEntries` | `src/lib/code-intel/symbols/to-intermediate-representation.ts` (+26 / −1, uncommitted) | **Query Cache experiment** |
| Contract test for cache keying by query source | `tests/contract/symbols/to-intermediate-representation.test.ts` (+11, uncommitted) | **Query Cache experiment** |
| Cold-start measurement script | `scripts/query-cold-start-experiment.ts` (untracked; Set B). It contains no cache code; it measures the standalone compile cost that motivates the cache. | **Query Cache experiment** (evidence side); association wording corrected |
| Cold-start results document | `specs/002-ast-symbol-intelligence/query-cold-start-results.md` (untracked) | **Query Cache experiment** (evidence) |
| Relationship constants and config entries | `src/lib/code-intel/config.ts` (+21) | **Feature 004 scaffolding** |
| Relationship tables | `data/code-intel-schema.sql` (+77) | **Feature 004 scaffolding** |
| Relationship domain/identity code, CPU-spike scripts | `src/lib/code-intel/domain/relationship.ts`, `relationships/relationship-identity.ts`, `scripts/relationship-*.ts` | **Feature 004 scaffolding** (whether the combined-decomposition script's post-mitigation section runs through the cache: **unknown**) |
| Relationship `.scm` query files | `src/lib/code-intel/relationships/queries/*.scm` | **unknown** (not inspected) |
| Initial-sources fallback test | `tests/integration/repositories/initial-sources.test.ts` (+15) | **unknown or unrelated** |

Baseline expectation confirmed by hunks: `config.ts` is Feature 004 scaffolding; `to-intermediate-representation.ts` matches the Query-cache changes. Set B membership is unchanged (not reshuffled).

### 9.2 Query-cache decision (task T032)

**Label: the Query cache is an evidence-only, unadopted candidate decision. It is not an approved implementation.** The working-tree change is an experiment (§9.1). Its existence in the tree, the local measurements and this analysis do not adopt it. Only hunks classified **Query Cache experiment** in §9.1 were analyzed; unknown hunks remain unknown. Code was read read-only; **nothing was run** (including the contract test added with the experiment).

**(a) Steady-state (warm) benefit — E4 (LOCAL-WALLCLOCK, comparative only).** With the compiled-`Query` memo active and the cache primed by warm-up, C5 medians on real files went from 6.698 to 1.788 ms (catalogue.tsx), 8.775 to 3.743 (AtlasScene.tsx), 7.850 to 2.709 (sidebar.tsx), 6.893 to 2.107 (symbol-d1-client.ts) and 1.239 to 0.133 (eslint.config.js); the source attributes about 85–95 % of the symbols-step cost on the real TS/TSX files to per-call compilation before the change (E3). This is a steady-state local benefit on one machine. It says nothing about Cloudflare CPU.

**(b) Cold-isolate cost still incurred — E5/E6 (LOCAL-WALLCLOCK).** The cache cannot remove the first compile per language per isolate: cold "Query compile" is 3.3 (java), 4.4 (javascript), 12.8 (typescript), 13.2 (tsx) ms in a fresh local process (E5/E6; includes first-use warm-up per the source), and the cold-vs-warm production call table shows call #1 at 4.813 / 3.530 / 10.305 / 10.097 ms against calls 2–20 medians of 0.051 / 0.016 / 0.015 / 0.010 ms (E4's file). E4's own note: the warm figures exclude the one-time per-isolate compile. Whether the cold cost recurs per invocation on Cloudflare depends on isolate reuse (U5 UNKNOWN); if isolates are not reused, the cache would give **no** benefit across invocations. Cold benefit is therefore UNKNOWN and could be nil.

**(c) Safe initialization and reuse (code reading; N3-style REPO-BEHAVIOR; not tested by Feature 005).** `to-intermediate-representation.ts:50-63` (working tree):
- *Keying by language and query body*: a `WeakMap<Language, Map<string, Query>>` keyed by the `Language` object and then by the query source text. A different grammar (a different `Language` object) or a different `.scm` body cannot reuse another's compiled `Query`. The experiment adds a contract test for the keying (`tests/contract/symbols/to-intermediate-representation.test.ts`, +11 lines); it was **not run** here.
- *Language identity is stable within an isolate*: `grammar-provider.ts:210-283` memoizes one `Language` per supported language in a module-level `languageCache`, and `extractFile` passes `parser.language`; so the WeakMap key is stable for the isolate's life.
- *Isolate-lifetime safety*: module scope, never evicted, re-created on a fresh isolate, the same lifetime as `parserCache`/`languageCache` (the code comment states this). No cross-isolate state is shared. Entries per isolate are bounded by (languages × distinct query sources), 4 languages and one symbol query each in production as coded.
- *No stale or incorrect reuse*: query sources are build-time `?raw` strings (`extraction-pipeline.ts:13-16`, `28-33`), immutable per bundle; a `Query` is bound to its `Language`. As coded there is no path that changes a compiled query after creation.
- *Concurrent use*: `query.matches(tree.rootNode)` is synchronous and JavaScript is single-threaded per isolate, so shared use between interleaved async calls cannot overlap inside `matches`; this is reasoning from the code, not observed.
- *Failure on initialization error*: the entry is stored only after `new Query(...)` returns; if construction throws (for example a malformed `.scm`), nothing is cached and the next call retries. The call is inside `extractFile`'s `try`, so the failure is recorded as a per-file `failed` result (`extraction-pipeline.ts:121` onward), as before the change.
- *Memory*: cached `Query` objects are never `delete()`d, which suits objects kept for the isolate's life; no `query.delete()` call was found either at `HEAD` or in the working tree, so at `HEAD` each call created a `Query` that was not explicitly freed. The effect of that on Cloudflare isolate memory is **UNKNOWN** and is not claimed as a benefit.
- *Not established*: cold-vs-warm equivalence of extracted outputs (no evidence compares outputs; §10); behavior under Cloudflare isolate eviction beyond "a fresh isolate starts with an empty cache".

**(d) Is a separately approved Feature 002 change required? Yes.** `to-intermediate-representation.ts` and its contract test belong to Feature 002's code, a protected feature under this workstream (G0; Feature 004 FR-017 forbids Feature 004 from modifying it, and Feature 005 does not modify it). Adopting the cache for production would be a Feature 002 source change that needs its own review and approval; this record neither makes nor recommends adopting it (§9.3 records the working-tree recommendation). Feature 004's own re-parse path would reuse the same `getParser` unchanged; whether it would also want the cache is not decided.

**Summary of the four distinctions**: (a) local steady-state benefit: shown locally, comparative; (b) cold cost: still incurred locally, platform effect UNKNOWN and dependent on isolate reuse (U5); (c) safe reuse: supported by code reading for keying and lifetime, not tested here, output equivalence not shown; (d) separately approved Feature 002 change: required for production. Status: **unadopted candidate**. Feature 004 T007 remains STOPPED.

### 9.3 Working-tree status recommendation (task T033)

**Recommendation for review (not an action): RETAIN — keep the Query-cache change in the working tree as an unadopted, uncommitted experiment, and make no production adoption decision until a separate approval.** The three options were: retain / revert / adopt-by-separate-approval.

**Rationale**
- *Against adopting now*: the only evidence is local, comparative and warm (§9.2 (a)); the cold benefit on Cloudflare is UNKNOWN and may be nil without isolate reuse (U5); output equivalence is not shown; adoption is a change to a protected Feature 002 file that needs its own review (§9.2 (d)); and there is no platform CPU basis for calling it necessary (X and Y UNKNOWN, §3.5).
- *Against reverting now*: the experiment is the code under which E4 and the Set B evidence were produced. Removing it would make that evidence non-reproducible and would be an action on a protected file that Feature 005 is not authorized to take (G0). A revert also decides nothing about whether the cache is useful.
- *For retaining*: it keeps every option open at no cost to the decision record, and it leaves the choice with the reviewer. The working-tree change is not deployed by existing.

**Risk noted (recommendation-level)**: the change lives uncommitted alongside Feature 004 scaffolding in the same working tree; if it is staged or committed with other work, it could be adopted by accident. Keeping it separated (Set B, §9.1) and reviewed on its own would avoid that. This record does not perform any Git action.

**Status of the working tree (unchanged by this workstream)**: no action was taken by Feature 005. The experiment remains **unmodified and unadopted** (Set B files byte-identical to the T002 baseline at T029, §9.1). Any production change requires separate approval. Feature 004 T007 remains STOPPED.

## 10. Resilience and determinism

Filled by task T025. **UNKNOWN is a blocking state for selection** (§6.4, task T027 conditions (b)–(d)).

**Evidence used, introduced here as N3 (REPO-BEHAVIOR, code reading only; not added to the §2 catalogue, which task T008 fixed).** Read-only, 2026-09-24, nothing executed: `src/lib/code-intel/symbols/symbol-worker.ts:84-200`, `symbols/extraction-pipeline.ts:84-175`, `persistence/symbol-d1-client.ts` (`upsertFileExtraction`, `replaceSymbolsForFile`, `upsertExtractionJob`), `symbols/symbol-identity.ts` (`computeSymbolKey`), `plugins/cloudflare-symbol-queue.ts:34-41`, `wrangler.toml:42-43`; documentation statements from T004 §4 (`evidence/docs-workers-queues.md`). N3 describes what the code does; **Feature 005 ran no test and no execution**, and whether the Feature 002 test suite covers these properties was not checked. "Shown" below therefore means: supported by N3 code reading, with the mechanism cited. A reviewer may judge code reading alone insufficient for FR-031–033; the record does not claim more.

### 10.1 Mechanisms in the current code (N3)

| Mechanism | Where | Effect |
|---|---|---|
| Redelivery of a finished unit is a no-op | `symbol-worker.ts:96-99` (`existingJob.status === "completed"` → return); `92-95` (extraction not `in_progress` → return) | two D1 reads, no file work |
| Per-file checkpoint | `symbol-worker.ts:131` (`upsertExtractionJob(… String(file.id))` after each file); resume `108-109` (`resumeCursor = max(fromCursor, checkpointCursor)`); page query `id > cursor` (`d1-client.ts:326-354`) | a retried unit resumes after the last checkpointed file |
| Per-file writes are upsert / replace | `upsertFileExtraction`: `ON CONFLICT (snapshot_id, snapshot_file_id) DO UPDATE`; `replaceSymbolsForFile`: `DELETE` then re-insert in one atomic batch, parent links in a second batch | re-extracting a file replaces its rows, never duplicates them |
| Job upsert never regresses `completed` | `upsertExtractionJob`: `status = CASE WHEN status = 'completed' THEN status …` | a late duplicate cannot un-complete a unit |
| Failure handling and caps | `handleUnitFailure` (`symbol-worker.ts:154-167`): `retryCount + 1 >= maxRetryAttempts (5)` → mark job `failed` and finalize the snapshot `failed`; otherwise record the retry and rethrow so the message is retried; platform `max_retries = 5` (`wrangler.toml:43`); plugin calls `message.retry()` per failed message (`cloudflare-symbol-queue.ts:38-40`) | a bounded number of attempts per unit |
| Per-file failures are contained | `extractFile` catches per-file errors and records `status: "failed"` (`extraction-pipeline.ts:121` onward) | one bad file does not fail the unit |
| Symbol identity is deterministic | `computeSymbolKey` = SHA-256 of `snapshotId filePath kind qualifiedNameOrName startLine startColumn` (`symbol-identity.ts:18-30`); `extractor_version` is deliberately not part of it | same file content and position → same key |
| Next unit enqueued only after the current unit finishes | `symbol-worker.ts:144-146`, `171-178` | at most one unfinished unit message per snapshot in flight |

**Observations recorded from N3 (not verified by execution):**
- **O1 — unit boundaries can shift after a resume.** After a crash the page is re-listed from `resumeCursor` with limit `E`, so the resumed unit may cover files past the original page end. Per-file results are per-file keyed, so final per-file content is unaffected as coded, but `unit_index` / job-row partitioning can differ from an uninterrupted run.
- **O2 — non-atomic window inside one file.** `upsertFileExtraction` (status `extracted`) precedes `replaceSymbolsForFile`, and its two batches are not atomic with each other. A crash between them leaves a file marked extracted with stale or absent symbols until the retry re-extracts it (the checkpoint is written only after the file completes, so a retry re-does it). Converges on retry as coded; not verified.
- **O3 — no mutual exclusion on a unit.** No lock or lease was found in the code read. Two concurrent deliveries of the same unit (possible under at-least-once delivery with `max_concurrency` unset, platform default not verified) would both process the same files; the writes are idempotent, but the CPU is duplicated. How often this occurs is UNKNOWN.
- **O4 — "identical persisted state" needs a definition.** FR-032 does not say whether raw auto-increment `id`, `parent_symbol_id` values and timestamps (`created_at`, `updated_at`) count. Rows are equal on (`symbol_key`, kind, name, qualified name, positions, `extractor_version`, status) across re-runs as coded; raw ids and timestamps differ. The record uses "equal modulo generated ids and timestamps" and flags the definition as a review point.

### 10.2 Per shape: what is re-executed, bounds, duplicates, determinism

Status vocabulary: `shown (N3)` (supported by the cited code mechanism; not tested here) or `UNKNOWN`. For a shape that is **not implemented** in the repository (P1, P5) the mechanisms above are the current code's, so nothing about the unbuilt shape is shown: status UNKNOWN until it is designed. P4 is the current code path with a smaller page size (configuration only).

| Item | P1 one file / message | P2 multiple files / message (current) | P3 multiple messages / invocation (current) | P4 bounded files / message | P5 bounded total work / invocation |
|---|---|---|---|---|---|
| **What is re-executed on failure/retry** | a whole message = one file (not implemented; design would decide) | the failing message: after the last checkpointed file, plus the in-flight file; a thrown error rethrows and the plugin calls `message.retry()`. Docs: "the entire batch is retried, unless you have explicitly acknowledged a message" (T004 §4), and the plugin acks per message, so earlier acknowledged messages in the same batch are not redelivered | as P2 for the failing message; other messages in the batch already acked stay done; messages after the failure still run in this invocation, because the plugin's `try/catch` is per message (`cloudflare-symbol-queue.ts:34-41`); `shown (N3)` | as P2 with pages of ≤ k files | UNKNOWN (design) |
| **Re-execution cost bounded (FR-031)** | UNKNOWN (shape not built) | `shown (N3)`: per-file checkpoint bounds re-work to the in-flight file plus the page query; attempts per unit are capped (app 5, platform `max_retries` 5). *Not shown*: the cold-init cost repeated on a fresh isolate per retry, which is bounded only by the attempt cap | `shown (N3)` for each message as P2; the aggregate across a batch is not separately bounded (no aggregate cap, §7.2) | `shown (N3)` as P2 | UNKNOWN |
| **Duplicate delivery gives the same persisted result, no unbounded CPU amplification (FR-032)** | UNKNOWN | `shown (N3)` for sequential duplicates: completed unit is a no-op; mid-unit duplicate resumes; writes are upsert/replace; equal modulo generated ids and timestamps (O4). **Concurrent duplicate deliveries: UNKNOWN** (O3): idempotent writes but duplicated CPU, frequency UNKNOWN | as P2 | as P2 | UNKNOWN |
| **Determinism across batch composition (FR-033)** | UNKNOWN | `shown (N3)` for per-file content: `extractFile` takes (snapshot, file, extractor version) and touches only that file's rows; identity is a pure hash. Job/unit partition can differ (O1) | as P2; message order does not enter per-file content as coded | as P2 | UNKNOWN |
| **Determinism across message order** | UNKNOWN | `shown (N3)` as above (per-file independence) | as P2 | as P2 | UNKNOWN |
| **Determinism cold vs warm isolate** | UNKNOWN | **UNKNOWN**: the caches (`parserCache`, `languageCache`, module-level Query cache in the working-tree experiment) are memoization as coded, but no evidence compares extracted outputs between cold and warm runs (E5/E6 compare times, not outputs) | UNKNOWN | UNKNOWN | UNKNOWN |

**Result.** For the shapes that already exist in the code (P2, P3, and P4 as a configuration of P2) bounded re-execution, sequential idempotence and per-file determinism across batch composition and order are `shown (N3)` by code reading. **Not shown**: cold-vs-warm equivalence of outputs (UNKNOWN for every shape), concurrent-duplicate behavior (UNKNOWN), and anything about P1 and P5 (UNKNOWN until designed). These UNKNOWNs are blocking for selection (T027 (b)–(d)) and are carried to §16 (T042).

**What would resolve them**: for cold/warm equivalence, a local output-equivalence check under the T019 rules (a late-gap procedure: question, new script, write-side-effect check; none run); for concurrent duplicates, an authoritative statement on consumer concurrency and duplicate delivery (or a lease design); for P1/P5, a design.

**Not concluded**: no unit is selected; no CPU conclusion; Feature 004 T007 remains STOPPED.

## 11. Feature 001/002 regression impact

Filled by task T034. Scope: every Feature 001 (code-intelligence foundation) and Feature 002 (AST symbol intelligence) behavior that the decisions in this record could affect. "Under the recorded decisions" = §6.4 (no unit selected), §8.2 (single-pass DEFER), §9.3 (Query cache RETAIN, unadopted). This record changes no Feature 001/002 file, and none of the recorded decisions requires a change. "If adopted later" names what a future adoption of a candidate would need. Feature 001 here is the code-intelligence foundation; it is not the earlier dynamic-GitHub-sources feature that shares the 001 prefix.

| Feature 001/002 behavior | Where | Under the recorded decisions | If a candidate were adopted later |
|---|---|---|---|
| Snapshot acquisition and persistence (snapshot rows, `snapshot_files`, R2 objects, acquisition unit size `CODE_INTEL_CHECKPOINT_FILE_COUNT`) | `src/lib/code-intel/acquisition/`, `data/code-intel-schema.sql` (Feature 001 tables), `snapshot.functions.ts` | **unaffected** | unaffected by single-pass or the Query cache; a processing-unit change confined to the extraction consumer would not touch it; **requires separately approved amendment** only if a chosen unit changed acquisition (no candidate does) |
| Grammar loading (`getParser`, `Parser.init`, language cache, WASM `?module` imports) | `src/lib/code-intel/symbols/grammar-provider.ts` | **unaffected** | unaffected by any candidate; Feature 004's re-parse path would reuse it unchanged (per its own research) |
| Symbol queries (`.scm` sources, compiled `Query` per call) | `symbols/queries/`, `symbols/to-intermediate-representation.ts` | **unaffected at `HEAD`**; the Query-cache experiment is present in the working tree, uncommitted and unadopted (§9.1) | Query cache: **requires separately approved amendment** (Feature 002 source change, §9.2 (d)). Single-pass: **requires separately approved amendment** |
| Extraction pipeline (`extractFile`: language detection, size gate, R2 read, parse, IR, persistence) | `symbols/extraction-pipeline.ts` | **unaffected** | single-pass: **requires separately approved amendment**; a smaller or different unit (P1, P4, P5): unit shape belongs to the consumer, but P5 and P1 would change consumer logic: **requires separately approved amendment**; P4 is a configuration value only |
| Extraction batch size (`CODE_INTEL_EXTRACTION_BATCH_SIZE`, default 50, env-overridable) | `config.ts:10`, `symbol-worker.ts:113` | **unaffected**; no value change is recommended | changing the default is a Feature 002 configuration change: **requires separately approved amendment** (a per-deployment env override is not a code change; whether `process.env` is populated on Workers is UNVERIFIED) |
| Queue consumers in `plugins/` (`cloudflare-symbol-queue.ts`, `cloudflare-queue.ts`) and queue configuration (`wrangler.toml` `max_batch_size`, `max_retries`) | `plugins/`, `wrangler.toml`, `nitro.config.ts` | **unaffected** | any P3/P5 change (batch size, aggregate ceiling, early exit) or a new consumer: **requires separately approved amendment** |
| Symbol identity (`computeSymbolKey`) and persisted symbol rows | `symbols/symbol-identity.ts`, `persistence/symbol-d1-client.ts` | **unaffected** | unaffected by the candidates as described; a single-pass unit that changed persistence: **requires separately approved amendment** |
| Extraction job / checkpoint / retry behavior | `symbols/symbol-worker.ts` | **unaffected** | P1, P5 or single-pass would change what a unit is: **requires separately approved amendment** |
| Feature 001/002 tests and contracts | `tests/contract/symbols/`, `tests/integration/symbols/`, `specs/001-code-intelligence-foundation/`, `specs/002-ast-symbol-intelligence/` | **unaffected**; the working tree contains one uncommitted test added with the Query-cache experiment (§9.1) | updated only under the same approved amendments |

**Result**: under the recorded decisions every listed behavior is **unaffected**. Feature 005 made no change to any Feature 001/002 file, and the only difference from `HEAD` in the Feature 002 area is the pre-existing, unadopted Query-cache experiment. No regression risk is introduced by this record, and the record does not claim the current Feature 002 behavior is safe under any Cloudflare CPU limit. Feature 004 T007 remains STOPPED.

## 12. Live-measurement proposal

The only live-related output of Feature 005 is the document `specs/005-queue-cpu-feasibility-architecture/live-experiment-proposal.md` (experiment **LX-1**, created by task T037). Its banner reads **`STATUS: NOT AUTHORIZED`** and **`Authorization ref: (none)`**. It is a proposal only: nothing in it has been run, drafting it authorizes nothing, and a future authorization must name the experiment id (FR-036); a general "proceed" does not qualify. It targets U3 and U4 and would give first PLATFORM-TELEMETRY points for measurements M5 and M6 (§4b); a run that fails to observe queue CPU is still a valid outcome. Its precondition list records that task T036 did not find the `$workers.*` telemetry keys in the text returned by the query pages (C1 and C3 remain open). Feature 004 T007 remains STOPPED.

## 13. Waiver status

**No waiver exists at this point in the workstream.** (This is a dated statement, 2026-09-24, not a permanent one.) Feature 005 has created no waiver file, has assumed none, and has presumed none.

**Requirements for any future waiver (FR-038; `contracts/waiver.md`).** A waiver is an explicit user decision. It must name the gate condition waived (the FR-028 letter and wording), the reasoning and evidence relied on (evidence ids; it may not rest on LOCAL-WALLCLOCK alone or on silence), the residual risk accepted, the withdrawal conditions, and who granted it, when, and its status (`active` or `withdrawn`). It is **invalid** if inferred from silence, from a general instruction to proceed, or from local measurements. A waiver does not authorize any live operation (FR-036 is separate) and does not itself amend Feature 004 (FR-037).

**Design margin alone is not enough.** FR-029: a design-margin argument alone cannot clear Feature 004 T007.

**Waivers that touch the CPU budget.** Any waiver that touches the CPU budget, meaning gate condition (b) or the selection rule of §6.4 (task T027 (a)), must explicitly name (i) the **assumed CPU budget X** (value and unit, stated as an assumption and not as established evidence), (ii) the **safety margin M**, and (iii) the **selected processing unit** it applies to. A budget-related waiver that omits any of the three is invalid. This record supplies none of them (X UNKNOWN, M unnamed, no unit selected).

**How a later waiver is recorded.** If the user explicitly grants one, it is recorded as a waiver file per `contracts/waiver.md` plus an Appendix C revision entry; the checks of tasks T039–T043 are then re-run for the affected conditions. If later evidence contradicts a waiver's reasoning it returns to review and Feature 004 T007 returns to STOPPED. No such waiver has been created or assumed here.

## 14. Feature 004 T007 disposition

Structure: 14.1 documentation re-verification (task T039), 14.2 gate conditions (task T039), 14.3 disposition (task T040). **This record does not clear Feature 004 T007 (FR-030).** Feature 004 T007 is the CPU-feasibility gate of Feature 004; it is not Feature 005's task T007 (scale tiers).

### 14.1 Documentation re-verification (FR-025; task T039) — `doc_reverification_date`: **2026-09-24**

Public documentation only (WebFetch, extraction-based; omitted text UNVERIFIED); no Cloudflare API/MCP/dashboard/Wrangler/remote resources. Full records: `evidence/docs-workers-queues.md` and `evidence/docs-observability.md` (addenda dated 2026-09-24).

| Page (read 2026-09-24) | Bears on | Change versus the earlier read |
|---|---|---|
| Workers "Pricing" | K1, S1 (i)/(ii) | Same two Standard figures as the 2026-09-23 read, now reported as two separate rows (generic 5 minutes; "per Cron Trigger or Queue Consumer invocation" 15 minutes). Free row unchanged: "10 milliseconds of CPU time per invocation". |
| Workers "Limits" | S1 (i), U5 | Free/Paid columns returned; still no Queue-consumer CPU row; the previously unreturned second isolate-flexibility sentence is now returned ("…terminated according to the limit configured"). |
| Queues "Limits" | S1 (i), K2 | Unchanged: "Consumer CPU time \| Configurable to 5 minutes", both plans; footnote text still only paraphrased. |
| Workers Logs | S1 (iii), U3 | New: "included in both the Free and Paid Workers plans"; Queue is a listed handler; CPU/wall/outcome fields not mentioned. Free log-quota figure differs from the T005 read (5 billion/day returned vs 200,000/day recorded); not reconciled. |
| Query Builder | S1 (iii), U3, C3 | `$workers.cpuTimeMs` named as an example field; queue filtering and plan availability not mentioned; wording now says observability settings must be added to the Wrangler configuration and the Worker redeployed (the T005 read recorded "requires no enablement"); not reconciled. |

**S1 redone after this re-verification: (i) NO / (ii) YES (scoped to Standard/Paid: "per Cron Trigger or Queue Consumer invocation") / (iii) NO — unchanged.** No returned page states the Workers Free Queue Consumer CPU limit; the only Queue Consumer unit wording is Standard/Paid and is not generalized to Free; no returned page states that CPU telemetry is available for queue invocations on Free (Workers Logs availability on Free and a `$workers.cpuTimeMs` example are not that statement, and combining them would be an inference). The user-confirmed S1 result is therefore unchanged and no new S1 decision is created. The wording changes above are flagged for the reviewer because they touch (iii)-adjacent material (Workers Logs on Free; Query Builder enablement).

**K1 (15 vs 5 minutes): narrowed, not resolved.** Two reads agree on the same two figures and the second reports them as two rows, which is consistent with two different rows (and with F10 having merged them). This is an inference from an extraction; K1 stays UNRESOLVED until a raw-text read or an official change note. Neither figure is a Free-plan value.

**Late gaps**: none were recorded under the T018 rule (§4e). The D1 free-tier documentation gap found in task T024 is a documentation gap and is carried to §16 by task T042; it is not a measurement gap.

### 14.2 Gate conditions (FR-028) — telemetry default applied (FR-029)

Default: without authoritative platform CPU telemetry for the target Queue Consumer path, Feature 004 T007 stays STOPPED unless a valid waiver exists. **No waiver exists (§13).** A condition resting on UNKNOWN evidence is `unsatisfied`.

| Condition | Wording (FR-028) | State | Evidence ids / sections | Evidence that would change it |
|---|---|---|---|---|
| **(a)** | CPU accounting semantics established sufficiently | **unsatisfied** | §3.1, §3.4, §3.5: Free-plan unit and limit UNKNOWN (U1, U2 PARTIAL); K1 narrowed but unresolved; K2 unresolved | An official statement naming Workers Free, the Queue Consumer path, a value and its unit; or platform-reported CPU for queue invocations on Free |
| **(b)** | the processing unit defined with an explicit budget | **unsatisfied** | §6.2, §6.4: X UNKNOWN, Y UNKNOWN on Free; "no unit selectable yet" | Evidence for X and Y (as (a)), then a unit satisfying §6.4 (a)–(g); or a valid waiver naming X, M and the unit (§13) |
| **(c)** | cold-start behavior understood sufficiently | **unsatisfied** | §5: local cold/warm line items exist (E5, E6; LOCAL-WALLCLOCK, comparative); platform cold cost UNKNOWN; U4 and U5 UNKNOWN | An official statement of what reported CPU includes (U4) and of isolate reuse for queue consumers (U5), or platform-reported cold and warm CPU |
| **(d)** | a bounded processing architecture exists | **unsatisfied** | §7.2, §10: no aggregate per-invocation bound; files per snapshot unbounded (tier 3); §6.4 selects no unit; several §10 items UNKNOWN | A designed and evidenced bounded unit (§6.4 conditions (b)–(g)); a daily file-volume basis; D1 free-tier figures |
| **(e)** | required telemetry or validation is available, or the gate is otherwise defensibly established | **unsatisfied** | §4c: no PLATFORM-TELEMETRY record; availability on Free UNKNOWN (U3); C1–C3 open; T036 found no `$workers.*` key documentation in returned text; LX-1 is NOT AUTHORIZED | A separately and explicitly authorized live experiment (LX-1 or another) yielding telemetry, or an official statement of availability; or a valid waiver |

**Waived conditions**: none. **Late gaps carried forward under the T018 rule**: none exist; §4e and §16 are consistent on that (§16 receives the D1 free-tier documentation gap at task T042).

### 14.3 Disposition (task T040)

**Disposition of Feature 004 T007: STOPPED.**

Definition applied (`contracts/decision-record.md`): **STOPPED** = at least one FR-028 condition (a)–(e) is unsatisfied and not validly waived, including any case where evidence remains insufficient. It is the default. All five conditions are `unsatisfied` (§14.2), none is waived (no waiver exists, §13), and the telemetry default of FR-029 applies: no authoritative platform CPU telemetry for the Queue Consumer path exists, and a design-margin argument alone cannot clear the gate.

**Why not the other two states**
- **CLEARED** would require every condition satisfied or validly waived; none is. In any case CLEARED would be a recommendation only: this record does not clear Feature 004 T007 (FR-030), and effective clearance would need a reviewed Feature 004 amendment or process (FR-037).
- **REDEFINED** would require that the architecture or execution model has materially changed so the original gate wording tests the wrong thing. No such change is established: no unit is selected (§6.4), single-pass is deferred (§8.2), and the Query cache is an unadopted candidate (§9). The original gate wording is not shown to be wrong; it is shown to be unmet.

**Evidence that would change the disposition** (each condition's own list is in §14.2): an official statement of the Workers Free Queue Consumer CPU limit and accounting unit, or platform-reported queue-invocation CPU on Free (which needs a separately authorized live experiment such as LX-1, currently NOT AUTHORIZED); statements on initialization inclusion (U4), isolate reuse (U5) and telemetry availability (U3); a bounded, evidenced processing unit satisfying §6.4; or an explicitly authorized waiver under FR-038 (none exists; it would have to name X, M and the unit).

**Recorded actions**: no edit was made to `specs/004-engineering-relationship-graph/tasks.md` or any Feature 004 artifact; Feature 004 T007 is not marked cleared, ready, approved or executable by this record.

## 15. Amendment policy and list

**Policy (FR-035, FR-037).** If a decision in this record later changes the architecture, the approved Feature 004 specification is **amended in place after review**; there is **no replacement feature**. **Amendment does not begin until this record has been reviewed.** No amendment is made or begun by Feature 005, and no Feature 001–004 artifact was modified by this workstream. Any change to a Feature 002 artifact needs its own review and approval (§8.2, §9.2 (d), §11).

**List for the recorded outcomes (paths only):**

| Recorded outcome | Amendment indicated now? |
|---|---|
| §14.3 Feature 004 T007 = **STOPPED** | **none indicated**: the gate stays as written; nothing in Feature 004's `tasks.md` is to change |
| §8.2 single-pass = **DEFER** | **none indicated** |
| §9.3 Query cache = **RETAIN**, unadopted | **none indicated** |
| §6.4 **no unit selectable yet** | **none indicated** |

**Contingent lists (would apply only if a later reviewed decision adopts the candidate; not recommended or started here):**
- Single-pass adopted: the Feature 002 and Feature 004 paths listed in §8.2.
- Query cache adopted for production: `src/lib/code-intel/symbols/to-intermediate-representation.ts`, `tests/contract/symbols/to-intermediate-representation.test.ts` (Feature 002 code; separate approval, §9.2 (d)), and the Feature 002 spec directory documents that describe symbol-query loading (`specs/002-ast-symbol-intelligence/plan.md`, `research.md`, `tasks.md`), to be confirmed by that review.
- A processing unit different from the current shape adopted (P1, P4 as a changed default, P5): the Feature 004 documents that state a unit and an invocation shape (`specs/004-engineering-relationship-graph/research.md` §1, `plan.md`, `tasks.md`) and the Feature 002 consumer paths (`plugins/cloudflare-symbol-queue.ts`, `src/lib/code-intel/symbols/symbol-worker.ts`, `wrangler.toml`).

**Reviewer point (not an amendment).** Feature 004's planning documents describe "one file per invocation" (`specs/004-engineering-relationship-graph/research.md:11-18`, `plan.md:80`, `tasks.md` T023), which the repository does not establish (§3.3, REPO-BEHAVIOR verdict NO). Whether those statements should be corrected is for the review that follows this record and is not proposed as an edit here.

Feature 004 T007 remains STOPPED.

> **Amendment note 2026-09-24 16:46 +04:00:** the "none indicated" rows above are historical as of Feature 005 T049. By explicit user instruction the R3, R4 and R6 amendments were then applied in place to Feature 004 (`research.md` Amendments A1–A3 with annotations in `spec.md`, `plan.md`, `data-model.md`, `tasks.md`, `feasibility-results.md`). This is not a T007 change: T007 remains STOPPED. R5 is recorded as a separate Feature 002 remediation (`docs/ROADMAP.md`); no Feature 002 artifact was modified.

## 16. Open UNKNOWN register

**Initial state, filled by task T009** (after T004 read 2026-09-23 and T005 read 2026-09-24). Task T042 records the final state. Status vocabulary: `UNKNOWN` (no page states it in the extracted text) / `PARTIAL` (a page states part of it, quoted) — never `established` in this initial state. **Read-method limitation**: statuses rest on WebFetch extraction; text not returned is UNVERIFIED and is not proof that a page lacks the statement. No numeric Free-plan Queue Consumer CPU budget is asserted. Feature 004 T007 is not cleared by anything in this section.

### 16.1 Register

| id | Question | Status after T004/T005 | What the evidence says (quoted; page — section — URL) | Evidence that would resolve it |
|---|---|---|---|---|
| **U1** | Free-plan queue-consumer CPU limit | **UNKNOWN** | Workers "Limits" — "CPU time": "CPU time per HTTP request \| 10 ms", "CPU time per Cron Trigger \| 10 ms" (Free); no Queue-consumer row in the extraction — https://developers.cloudflare.com/workers/platform/limits/. Workers "Pricing" — Workers table: Free "10 milliseconds of CPU time per invocation"; Standard "Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation" and, in the T004 read, "Max of 5 minutes of CPU time per invocation (default: 30 seconds)" (recorded earlier as "15 minutes") — https://developers.cloudflare.com/workers/platform/pricing/. Queues "Limits": "Consumer CPU time \| Configurable to 5 minutes", limits "apply to both Workers Paid and Workers Free plans with the exception of **Message Retention**" — https://developers.cloudflare.com/queues/platform/limits/. The three pages give different or missing statements; the **15-vs-5-minute** wording difference is an open evidence discrepancy. **Not reconciled.** | An official statement that names the Workers Free plan and the Queue Consumer path (raw-text read, or documentation that explicitly resolves the three pages), **or** platform-reported CPU for queue-consumer invocations on Free (PLATFORM-TELEMETRY; would need a separately authorized experiment — not authorized, not proposed here). Local measurements cannot resolve U1. |
| **U2** | CPU accounting unit for queue consumers | **PARTIAL** (Standard plan: per invocation; Free plan and batch/message level: UNKNOWN) | Workers "Pricing" — Standard row (quoted above): CPU max "per Cron Trigger or Queue Consumer invocation" — https://developers.cloudflare.com/workers/platform/pricing/. Queues "Consumer concurrency" — "Billing": "When multiple consumer Workers are invoked, each Worker invocation incurs [CPU time costs]" — https://developers.cloudflare.com/queues/configuration/consumer-concurrency/. Queues "How Queues works" — "A consumer Worker, which is push-based: the Worker is invoked when the queue has messages to deliver"; "The `MessageBatch` that is passed to your `queue` handler…" — https://developers.cloudflare.com/queues/reference/how-queues-works/. The recorded sentence that one invocation receives multiple messages ("Batching, Retries and Delays") was **not returned** by T004 → UNVERIFIED. No page returned states a per-message or per-batch CPU limit. | The same explicit statement for the Workers Free plan, and whether the invocation's CPU covers the whole `batch` (documentation or platform-reported CPU per queue invocation). |
| **U3** | Availability of CPU telemetry for queue invocations on Free | **UNKNOWN** | Workers Logs — handler table has a Queue row (`<Queue Name>`); Free "200,000 per day", "3 Days" retention; extraction: no CPU/wall/outcome fields mentioned — https://developers.cloudflare.com/workers/observability/logs/workers-logs/. Query Builder — "`$workers.cpuTimeMs`" named as a field example; "available to all developers and requires no enablement"; handler-type filtering not described — https://developers.cloudflare.com/workers/observability/query-builder/. Trace Events `CPUTimeMs` / `EventType` includes `queue` (Logpush "available on the Workers Paid plan"); Tail Workers "Paid and Enterprise". Contradictions C1–C3 (E8) unreconciled. | An official statement that `$workers.cpuTimeMs` (or equivalent) is populated for queue-consumer invocations on Free, or the Observability telemetry query-language pages (task T036, not yet read); otherwise a separately authorized live read of one queue invocation (not authorized, not proposed here). |
| **U4** | Does reported CPU include startup / global-scope / WASM init | **UNKNOWN** | Workers "Limits" — "Worker startup time": "A Worker must parse and execute its global scope (top-level code outside of handlers) within 1 second." Errors — error 10021 "Script startup exceeded CPU time limit" ("more than the startup time limit (1s) of CPU time") — https://developers.cloudflare.com/workers/observability/errors/. Metrics — "Exceeded resources" "may … be also caused by a Worker exceeding startup time or free tier limits" — https://developers.cloudflare.com/workers/observability/metrics-and-analytics/. These establish that startup has its own 1 s CPU limit and error; **no page returned states whether startup CPU is counted in the per-invocation CPU value** (Trace Events `CPUTimeMs`, Query Builder, Metrics). | An official statement of what `CPUTimeMs` / `$workers.cpuTimeMs` includes, or platform-reported CPU for a cold and a warm queue invocation (authorization required; not proposed here). |
| **U5** | Isolate reuse across queue-consumer invocations | **UNKNOWN** for queue consumers; general Workers statement recorded | Workers "How Workers works" — "An isolate may be spun down and evicted for a number of reasons"; "Because there is no guarantee that any two user requests will be routed to the same or a different instance of your Worker, Cloudflare recommends you do not use or mutate global state." — https://developers.cloudflare.com/workers/reference/how-workers-works/. Queues "Consumer concurrency" and "How Queues works": extraction states isolate reuse is not mentioned. Workers "Limits": "Each isolate has some built-in flexibility to allow for cases where your Worker infrequently runs over the configured limit" (second F3 sentence not returned → UNVERIFIED). Repo design must not assume warm reuse (FR-010). | An official statement of isolate-reuse behavior for queue-consumer invocations; local measurements cannot establish it. |

### 16.2 STOP GATE S1 result

Full record: `evidence/s1-gate-result.md`.

- **(i)** Does any official page now explicitly state the Workers Free queue-consumer CPU limit? **NO** (not in the extracted text). Nearest statements are generic Free "10 milliseconds of CPU time per invocation" and Queues "Consumer CPU time \| Configurable to 5 minutes"; neither names the Free-plan Queue Consumer limit.
- **(ii)** Does any page explicitly state the queue-consumer CPU accounting unit? **YES — scoped.** Quoted: Workers "Pricing", Standard row — "Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation" (https://developers.cloudflare.com/workers/platform/pricing/). This names the *invocation* as the unit for the Standard-plan limit only; not Free, not batch-vs-message; this wording predates T004 (recorded earlier as F10) and participates in the unresolved 15-vs-5-minute discrepancy. Flagged for reviewer interpretation.
- **(iii)** Does any page explicitly state CPU telemetry is available for queue invocations on Free? **NO** (not in the extracted text).

**S1: (i) NO / (ii) YES (scoped) / (iii) NO.**

Because (ii) is YES: recorded here and in `evidence/s1-gate-result.md`; **not treated as clearing Feature 004 T007**; **no plan decision altered**; **reported to the user before any further task (T010 onward)**. The recorded line exists, so the S1 dependency of T010 onward is satisfied only once the user has been informed and has authorized continuing.

### 16.3 Carried-forward items outside U1–U5 (recorded, not reconciled)

- E7 15-vs-5-minute Workers Pricing wording discrepancy (§2, E7).
- E8 contradictions C1–C3 (§2, E8); D-pages not yet read (task T036).
- No PLATFORM-TELEMETRY evidence exists (§2.3).
- Delivered queue batch size and files per invocation are not established by the repository (`evidence/repo-consumer-mapping.md`, N1).
- No enforced upper bound on files per snapshot found (`evidence/scale-tiers.md`, N2).

Task T042 records the final state of this register (§16.4 below). §16.1–§16.3 are left as recorded by task T009 (audit trail); §16.4 supersedes their status column where it differs.

### 16.4 Final state (task T042; as of 2026-09-24, after tasks T036 and T039)

Statuses: `UNKNOWN`, `PARTIAL`, `CONTRADICTION`, `INCOMPLETE`, `UNVERIFIED`. Nothing was upgraded to established. S1 remains **(i) NO / (ii) YES (scoped to Standard/Paid) / (iii) NO** (redone at task T039, unchanged). Feature 004 T007 = **STOPPED** (§14.3).

**A. Platform questions**

| id | Question | Final status | What changed since T009 | Evidence that would resolve it |
|---|---|---|---|---|
| **U1** | Free-plan Queue Consumer CPU limit | **UNKNOWN** | T039 re-read: still no Queue row in Workers "Limits"; Free "10 milliseconds of CPU time per invocation" unqualified; Queues "Limits" "Configurable to 5 minutes" (both plans) | Official statement naming Free + Queue Consumer + value + unit, or PLATFORM-TELEMETRY (needs an authorized live experiment) |
| **U2** | CPU accounting unit for queue consumers | **PARTIAL** (Standard: "per Cron Trigger or Queue Consumer invocation"; Free and batch/message level UNKNOWN) | T039: the Standard wording is a distinct row | Same statement for Free; whether the batch is covered |
| **U3** | CPU telemetry for queue invocations on Free | **UNKNOWN** | T036 found no `$workers.*` key documentation in returned text; T039: Workers Logs "included in both Free and Paid", Queue listed as a handler, CPU fields not mentioned; Query Builder wording now requires observability settings and a redeploy | Official statement of the CPU field for queue invocations on Free, or an authorized live read (LX-1 is NOT AUTHORIZED) |
| **U4** | Does reported CPU include startup/init | **UNKNOWN** | none | Official statement of what `CPUTimeMs` / `$workers.cpuTimeMs` covers, or cold and warm platform CPU |
| **U5** | Isolate reuse for queue consumers | **UNKNOWN** | T039: Workers "Limits" second isolate-flexibility sentence returned (about limit hits, not reuse) | Official statement for queue consumers |

**B. Contradictions and discrepancies (not reconciled)**

| id | Item | Final status | Note |
|---|---|---|---|
| **K1** | Workers Pricing Standard: 15 vs 5 minutes | **CONTRADICTION — UNRESOLVED (narrowed)** | two reads return the same two figures; the second reports two rows; F10 matches neither; inference only (§14.1). Resolve by a raw-text read or a change note |
| **K2** | Free queue-consumer CPU across Workers Limits / Pricing / Queues Limits | **CONTRADICTION / UNKNOWN** | no single Free statement |
| **K3** | Standard "per Queue Consumer invocation" not stated for Free | **scoped SILENCE** | not generalized |
| **K4** | Free HTTP/Cron 10 ms | **unverified candidate for a different trigger** | not Queue Consumer budget X |
| **C1** | Outcome values (`exceededCpu` etc.) | **CONTRADICTION — OPEN** | Tail Handler page still unread; T036 pages did not return `$workers.outcome` |
| **C2** | CPU fields per product | **OPEN** | |
| **C3** | CPU in Workers Logs / `$workers.cpuTimeMs` | **OPEN** | example field only; queue filtering not mentioned |
| **C4** | Queue-consumer CPU limit (same family as K1/K2) | **OPEN** | |
| — | Workers Logs Free quota: 200,000/day (T005 read) vs "5 Billion per account per day" (T039 read) | **CONTRADICTION — UNRESOLVED** | earlier Feature 005 text cites 200,000 as recorded |
| — | Query Builder: "requires no enablement" (T005 read) vs observability settings + redeploy required (T039 read) | **CONTRADICTION — UNRESOLVED** | LX-1 already assumes a configuration change and redeploy |
| — | Comment `symbol-worker.ts:78-83` and Feature 002 `plan.md:81` ("one unit per invocation") vs the plugin loop over all messages | **CONTRADICTION — UNRECONCILED** | §3.3 |
| — | E3 tree-count line (820 vs 1,025) | **INCOMPLETE** | source inconsistency |
| — | E5 warm-compile figures attributed to the wrong results file in `spec.md` | **recorded discrepancy** | |
| — | E2 warm-up count only in script constants | **INCOMPLETE** | |

**C. Repository and design unknowns (from tasks T012, T021, T024, T025, T027)**

| Item | Final status | Source task | Evidence that would resolve it |
|---|---|---|---|
| Delivered queue batch size and page fill; files per invocation | **UNKNOWN** | T012, T024 | runtime observation (needs an authorized live read) |
| Deployed values (`max_batch_size`, `CODE_INTEL_EXTRACTION_BATCH_SIZE`, env overrides) and whether `process.env` is populated on Workers | **UNKNOWN / UNVERIFIED** | T006, T024 | reading deployed configuration (not authorized) |
| `waitUntil` CPU accounting in a queue handler | **UNKNOWN** | T010 | official statement |
| Applicable limit X and unit Y; bounding level | **UNKNOWN / UNDETERMINED** | T012 | as U1, U2 |
| Platform cold CPU for either architecture; two-pass memory | **UNKNOWN** | T021, T030 | platform telemetry; a memory comparison |
| Cold-vs-warm output equivalence (all shapes) | **UNKNOWN (blocking)** | T025 | local output-equivalence check under the T019 rules (late-gap procedure; not run) |
| Concurrent duplicate deliveries of one unit (no mutual exclusion found) | **UNKNOWN (blocking)** | T025 | consumer-concurrency documentation or a lease design |
| P1 and P5 behavior; single-pass unit design, including where cross-file resolution happens | **UNKNOWN until designed** | T025, T030 | a design |
| FR-032 "identical persisted state" definition regarding generated ids and timestamps | **review point** | T025 | reviewer decision |
| D1 free-tier figures; daily file volume | **UNKNOWN** (documentation gap, not a measurement gap; no public documentation was read for T024) | T024, T026 | official D1 pricing/limits page read as documentation, or a repository document citing it |
| Files per snapshot upper bound in production | **NOT ESTABLISHED** | T024 | a production distribution or an enforced cap |
| Meaning and use of `CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET = 20_000` | **UNVERIFIED** (not a Cloudflare CPU budget) | T024 | reading its usage |
| Effect of the unfiltered snapshot plugin on symbol batches | **flagged, not investigated** | T010 | analysis outside Feature 005 scope |
| Feature 002 plan step "skip a file whose extraction row exists at the current version" not seen in the code read | **UNVERIFIED** | T006 | reading beyond the lines read |
| Whether `$workers.*` keys are documented (`cpuTimeMs`, `eventType`, `outcome`) | **UNVERIFIED as absence** | T036 | a key-reference page |
| Read-method limitation: all OFFICIAL-DOC statements are extraction-based | **UNVERIFIED for omitted text** | T004, T005, T036, T039 | raw-text read |
| Evidence id N3 (§10) is not in the §2 catalogue | **INCOMPLETE** (catalogue) | T025 | add at the review stage |
| Unadopted experiment status: Query cache | **unadopted; RETAIN recommended** | T029, T033 | separate approval |

**D. Blocking items for a processing-unit selection (§6.4)**: (a) X and Y; (b)–(d) as in section C (cold-vs-warm equivalence, concurrent duplicates, P1/P5); (e) cold-invocation justification; (f) D1 free-tier figures and file volume; (g) the fits-no-unit outcome.

**E. Not authorized and not done by Feature 005**: live experiments (LX-1 is NOT AUTHORIZED), waivers (none exist), amendments (none begun), Query-cache adoption, single-pass adoption. **Feature 004 T007 remains STOPPED.**

---

## Appendix A — Requirement traceability (task T044)

Built from the coverage tables at the bottom of `tasks.md` (FR-001..FR-038, SC-001..SC-013) and the sections actually filled. **"Content present" means the section or artifact exists and addresses the requirement; it does not mean the requirement's subject is satisfied** (for example FR-028's conditions are all `unsatisfied` in §14.2, and FR-007's selection is "no unit selectable yet" in §6.4). "Finalization by" names tasks that remain after this appendix (Appendix B by task T047, the logs by T048, Appendix C by T049). Flag column: any requirement without content would be flagged "none"; **no FR or SC is flagged as lacking content** except where the whole content is a later verification task noted as pending.

### A.1 Functional requirements

| FR | Tasks | Section / artifact | Content present? |
|---|---|---|---|
| FR-001 | T010 | §3.1–3.3 | yes |
| FR-002 | T006, T010 | evidence/repo-consumer-mapping.md; §3.2; §3.1–3.3 | yes |
| FR-003 | T012 | §3.5 | yes |
| FR-004 | T011 | §3.4 | yes |
| FR-005 | T022 | §6.1 | yes |
| FR-006 | T006, T022 | evidence/repo-consumer-mapping.md; §3.2; §6.1 | yes |
| FR-007 | T023, T027 | §6.2; §6.4 | yes |
| FR-008 | task T007 (scale tiers), T022, T024 | evidence/scale-tiers.md; §7; §6.1; §7 | yes |
| FR-009 | T021 | §5 | yes |
| FR-010 | T021, T023, T027 | §5; §6.2; §6.4 | yes |
| FR-011 | T021 | §5 | yes |
| FR-012 | T032 | §9.2 | yes |
| FR-013 | T032 | §9.2 | yes |
| FR-014 | T029, T033 | §9.1; evidence/hunk-classification.md; §9.3 | yes |
| FR-015 | T031 | §8.2 | yes |
| FR-016 | T030 | §8.1 | yes |
| FR-017 | T031 | §8.2 | yes |
| FR-018 | T015 | §4b | yes |
| FR-019 | T014, T015, T018 | §4a; §4b; §4e | yes |
| FR-020 | T015, T017, T019 | §4b; §4d; §4e (N/A) | yes |
| FR-021 | T015, T017, T021 | §4b; §4d; §5 | yes |
| FR-022 | T004, T005, T008 | evidence/docs-workers-queues.md; §2; evidence/docs-observability.md; §2; §2 | yes |
| FR-023 | T005, T016, T036 | evidence/docs-observability.md; §2; §4c; evidence/docs-observability.md addendum | yes |
| FR-024 | T004, T008, T014, T016 | evidence/docs-workers-queues.md; §2; §2; §4a; §4c | yes |
| FR-025 | T004, T005, T008, T009, T036, T039, T042 | evidence/docs-workers-queues.md; §2; evidence/docs-observability.md; §2; §2; §16; evidence/s1-gate-result.md; evidence/docs-observability.md addendum; §14.1, §14.2; evidence addenda; §16.4 | yes |
| FR-026 | T011, T012, T023, T045 | §3.4; §3.5; §6.2; forbidden-statement scan | yes; finalization by T045 |
| FR-027 | T024, T026 | §7; §6.3 | yes |
| FR-028 | T039, T040 | §14.1, §14.2; evidence addenda; §14.3 | yes |
| FR-029 | T038, T039 | §12, §13; §14.1, §14.2; evidence addenda | yes |
| FR-030 | T001, T040 | §1, skeleton; §14.3 | yes |
| FR-031 | T006, T025, T027 | evidence/repo-consumer-mapping.md; §3.2; §10; §6.4 | yes |
| FR-032 | T025, T027 | §10; §6.4 | yes |
| FR-033 | T025, T027 | §10; §6.4 | yes |
| FR-034 | T002, T034, T046 | evidence/baseline; §11; integrity check | yes; finalization by T046 |
| FR-035 | T002, T041, T046 | evidence/baseline; §15; integrity check | yes; finalization by T046 |
| FR-036 | T001, T003, T037 | §1, skeleton; §1; live-experiment-proposal.md; §12 | yes |
| FR-037 | T041 | §15 | yes |
| FR-038 | T027, T038 | §6.4; §12, §13 | yes |

### A.2 Success criteria

| SC | Tasks | Section / artifact | Content present? |
|---|---|---|---|
| SC-001 | T009, T010–T013, T042 | §16; evidence/s1-gate-result.md; §3.1–3.3; §3.4; §3.5; §3 (verification); §16.4 | yes |
| SC-002 | T022, T027, T028 | §6.1; §6.4; §5–§7, §10 (verification) | yes |
| SC-003 | T021, T028 | §5; §5–§7, §10 (verification) | yes |
| SC-004 | T030, T031, T035 | §8.1; §8.2; §8–§9 (verification) | yes |
| SC-005 | T032, T033, T035 | §9.2; §9.3; §8–§9 (verification) | yes |
| SC-006 | task T007 (scale tiers), T024, T028 | evidence/scale-tiers.md; §7; §7; §5–§7, §10 (verification) | yes |
| SC-007 | T025, T028 | §10; §5–§7, §10 (verification) | yes |
| SC-008 | T025, T028 | §10; §5–§7, §10 (verification) | yes |
| SC-009 | T025, T028 | §10; §5–§7, §10 (verification) | yes |
| SC-010 | T002, T034, T046 | evidence/baseline; §11; integrity check | yes; finalization by T046 |
| SC-011 | T039, T040, T043 | §14.1, §14.2; evidence addenda; §14.3; §12–§16 (verification) | yes |
| SC-012 | T004, T005, T008, T017, T020 | evidence/docs-workers-queues.md; §2; evidence/docs-observability.md; §2; §2; §4d; §4 (verification) | yes |
| SC-013 | T003, T037, T038, T041, T043 | §1; live-experiment-proposal.md; §12; §12, §13; §15; §12–§16 (verification) | yes |

**Flags**: none of FR-001..FR-038 or SC-001..SC-013 lacks content. Several requirements are addressed by recording an explicit UNKNOWN, `unsatisfied`, "undetermined" or "not authorized" state rather than a positive result; those states are carried in §16.4.

## Appendix B — Success-criteria result (task T047)

Run 2026-09-24 against `quickstart.md`'s review checklist. **"PASS" here means the record contains the required content and states its scope honestly; it does not mean the subject is satisfied.** Where the required content is an explicit UNKNOWN / undetermined / "no unit selectable yet" state, that is the result the evidence supports and it is marked "PASS (content)" with the open items named.

| SC | Result | Basis (sections) | Open items carried |
|---|---|---|---|
| SC-001 CPU model | **PASS (content)** | §3.1–3.5, §16.4: every boundary line has a source or UNKNOWN; no unsourced numeric limit (T013, T045) | U1–U5, K1–K4 |
| SC-002 processing unit | **PASS (content)** | §6.1 (five shapes × three boundaries × eight criteria), §6.4 "no unit selectable yet"; oversize handling §6.1.3 | selection blocked by (a), (e), (f); (b), (c), (d), (g) partial |
| SC-003 cold-start | **PASS (content)** | §5: grammar/parser init, Query init, first file, warm files separate; isolate reuse = none guaranteed; cold and warm never averaged | platform cold cost UNKNOWN (U4, U5) |
| SC-004 single-pass vs two-pass | **PASS (content)** | §8.1 covers all ten FR-016 criteria; §8.2 one verdict (DEFER) | evidence that would decide is listed |
| SC-005 Query cache | **PASS (content)** | §9.2 four distinctions; §9.1 status; §9.3 RETAIN | cold benefit UNKNOWN; adoption needs separate approval |
| SC-006 resource bounds | **PASS (content)** | §7: four scale tiers; 300-file run not a worst case; counts-only arithmetic; queue quota and D1 free tier | D1 free-tier figures UNKNOWN (documentation gap) |
| SC-007 failure/retry | **PASS (content)** | §10.2 per shape, bound shown by code reading (N3) for existing shapes | P1/P5 UNKNOWN; code reading is not a test |
| SC-008 duplicate delivery | **PASS (content)** | §10.1–10.2: sequential duplicates shown (N3); no unit is chosen | concurrent duplicates UNKNOWN; "identical state" definition is a review point |
| SC-009 determinism | **PASS (content)** | §10.2: per-file determinism shown (N3) across batch composition and order | cold-vs-warm output equivalence UNKNOWN for every shape |
| SC-010 Feature 001/002 impact | **PASS** | §11 list; T046/S4: zero Set A/B drift, zero Feature 001/002 files modified by Feature 005 | pre-existing unadopted Query-cache experiment noted |
| SC-011 Feature 004 T007 disposition | **PASS** | §14.3: exactly one disposition (STOPPED); §14.2 (a)–(e) each marked | all five unsatisfied; T007 not cleared |
| SC-012 Cloudflare claims and measurements | **PASS (content)** | every Cloudflare claim cites title/section/URL and read date (§3.4, §14.1, evidence files); measurements classified by protocol fields in §4d | fields NOT RECORDED in sources (§4d); OFFICIAL-DOC evidence is extraction-based |
| SC-013 amendment policy / live / waiver | **PASS** | §15 amend-in-place; `live-experiment-proposal.md` NOT AUTHORIZED; §13 dated no-waiver, FR-038-conformant requirements | none |

**Checklist items outside SC numbers**: repository consumer table with the "one file per invocation" statement present (§3.2, §3.3): **PASS**.

**Typecheck (`bunx tsc --noEmit`, run 2026-09-24)**: exit code 0, zero lines of output; baseline `evidence/baseline/tsc-baseline.txt` (2026-09-23): exit code 0, zero lines. **Identical: no new or changed diagnostics.** (`tsc` ran with `noEmit`.)

**Not a pass/fail item**: satisfaction of the underlying gate conditions is stated in §14.2 (all unsatisfied); Feature 004 T007 remains STOPPED.

## Appendix C — Revision log

| Revision | Date | Trigger | Sections / conditions affected | Authorization ref | Checks re-run | Disposition after |
|---|---|---|---|---|---|---|
| R0 (initial) | 2026-09-24 | initial version (Feature 005 execution, tasks T001–T049) | all sections §1–§16 and Appendices A–C; gate conditions FR-028 (a)–(e) recorded `unsatisfied` | none (no waiver, no live authorization, no amendment; user approvals of individual tasks and the S1 result confirmation only) | T013, T020, T028, T035, T043 (section verifications); T045 forbidden-statement scan; T046 protected-path integrity (S4: Set A and Set B no difference); T047 checklist SC-001..SC-013 and `bunx tsc --noEmit` (exit 0, no output, equal to baseline); S1 redone at T039 (unchanged); S2 = gap named NO | **STOPPED** (Feature 004 T007) |

R0 was created as a skeleton (task T001) and finalized by task T049 on 2026-09-24. Later reviewed changes (new evidence, a documentation change, an explicitly authorized waiver, a user-directed correction) are appended as new revisions and never silently overwrite a prior disposition.
