# T007 Controlled Calibration — Proposal T007-CAL-1

**STATUS: NOT AUTHORIZED**
**Authorization ref: (none)**
**Revision: R1 (2026-09-24, applies the six revisions of the 2026-09-24 20:44 +04:00 proposal review). Original R0 definition superseded by this text.**

This is a definition only. Nothing here has been run, deployed or created. Drafting it authorizes nothing: any Cloudflare deploy, queue, D1, R2 or Wrangler operation needs explicit user authorization naming **T007-CAL-1** (CLAUDE.md Safety and Git Rules; Feature 005 FR-036). A general "proceed" does not qualify. Free plan only; no paid service.

Evidence base: `cloudflare-queue-cpu-dossier-2026-09-24.md` (X = 10 ms CPU per invocation, Y = one MessageBatch, Workers Logs CPU field on Free). Labels: DOC = documented Cloudflare fact · INF = engineering inference · **PARAM = owner-approved experiment parameter (not a Cloudflare limit; needs approval before the run)**.

## 0. Four different numbers (never conflate)

| Number | Value | What it is |
|---|---|---|
| Cloudflare budget X | 10 ms CPU per invocation | DOC (Free plan). The only Cloudflare-documented number here. |
| p95 engineering threshold | ≤ 5 ms | PARAM (margin M = 2 on X). Not a Cloudflare limit. |
| Maximum engineering threshold | ≤ 8 ms | PARAM. Not a Cloudflare limit. |
| `MINIMUM_USEFUL_B` | **16 KiB** | PARAM, **PRE-REGISTERED before the run** (owner-set 2026-09-24). Not a Cloudflare limit. Must not be lowered after seeing results. |

**Approval requirement:** the 5 ms, 8 ms, M = 2 and `MINIMUM_USEFUL_B = 16 KiB` are engineering safety margins and experiment parameters. They require explicit owner approval, recorded in the authorization text, before the calibration run. They are approvals of parameters, not an FR-038 waiver (§11).

## 1. Question answered

What is the largest source-file byte size B (`CODE_INTEL_RELATIONSHIP_MAX_FILE_BYTES`) for which a one-file-per-message parse-and-relationship-extraction workload (`max_batch_size = 1`) stays inside the Free 10 ms per-invocation CPU budget with the §0 margins, measured by platform telemetry, cold-candidate and warm, on dense and minified worst-case shapes? And is that B at least `MINIMUM_USEFUL_B`?

Calibration is feasible conditionally: DOC says Workers Logs is on Free and shows CPU time in the invocation log (dossier A8, B3). It is conditional on the smoke gate (§6). If the smoke gate fails the experiment stops and T007 stays STOPPED pending a waiver decision (FR-029).

## 2. Workload: pinned scratch calibration harness (Revision 1)

**Not the real Feature 004 unit.** Feature 004 tasks T020 (`to-relationship-facts`), T021 (`contains-derivation`), T022 (`relationship-resolver`) and T023 (`extraction-pipeline`) **do not yet exist**. Only the relationship `.scm` query files (T019 area) and `relationship-identity.ts` exist. Therefore:

- The harness is a **scratch calibration harness**, pinned to one recorded commit hash and bundle size. It is **not production Feature 004 code** and **not T008+ implementation**; it does not implement T020–T023 and is not shipped, imported by, or merged into `src/`.
- Purpose: characterize the CPU behavior of the relevant parsing and relationship-extraction workload on the Free Queue Consumer path.
- Content (minimum needed for a CPU-representative path): unchanged `getParser` and grammars; the existing relationship `.scm` query for the language; a minimal fact-mapping step; bounded indexed D1 lookups against a small seeded scratch D1; a per-file scratch write; the candidate attempt-before-work marker write; the candidate oversize check; `ack()`. **The parser is initialized lazily inside the queue handler**, as the production path does, so initialization cost is inside the invocation CPU (initialization in global scope might be charged elsewhere; U4 UNKNOWN).
- **Limitation (must be stated in any result):** the calibration does not prove the final implementation's CPU behavior. The final T020–T023 code may cost more or less than the harness. The 2× margin is the allowance for that difference, not a proof.
- **Later implementation-level re-check is required before T007 can ultimately be cleared:** after T020–T023 exist, the same measurement protocol must be re-run on the real unit at the selected B. Correction to avoid a false assumption: tasks.md **T074** is only a *local* review of T073's local simulation (wall-clock, no Cloudflare). It is the existing task in the repository terminology that reviews worst-case unit timing against T007's classification, and it is retained as that local check, but it does **not** measure Cloudflare CPU and does **not** satisfy this requirement. No existing task covers a Cloudflare-side re-check; it must be added by the reviewed Feature 004 amendment (§10), not by this proposal.

## 3. Fixture families and bands (Revision 3)

Byte bands (source-text size in bytes, recorded per fixture): **4 KiB, 16 KiB, 32 KiB, 64 KiB, 128 KiB.**
Languages required: **Java, TypeScript, JavaScript, TSX.**

Every fixture records: language, shape, exact bytes, **AST node count** and **AST nodes per KiB**, `hasError` (must be false). Nodes/KiB is required because CPU tracks node count while B is a byte gate; the dense and minified fixtures must be the highest nodes/KiB in the set or B is not a valid worst-case bound.

| Family | Shape | Bands | Order / rule |
|---|---|---|---|
| Ordinary (E3-style, ~8 nodes/line) | realistic code | **4 KiB, 16 KiB, 32 KiB** (32 KiB = the one band above 16 KiB) for Java, TS, JS, TSX | 4 KiB feeds the C rule (§9); 16 and 32 KiB are headroom evidence. An ordinary failure at 16 or 32 KiB counts as a failing band for that language (it lowers B). |
| Dense-Java, Dense-TS | dense worst-case AST shape (T006 style, ~36 nodes/line) | 4 → 128 KiB **ascending** | **Stop the family after two consecutive failing bands.** |
| Minified-JS | whitespace-free/minified JavaScript, explicitly measured | 4 → 128 KiB **ascending** | Same stop rule. Highest expected nodes per byte. |
| Dense-JS, Dense-TSX | dense worst-case shape | tested at `B_cand` (§8) | **If a family fails, lower B: test the next lower band and continue down, 30 invocations per step, until it passes or 4 KiB fails.** |
| CALLS-heavy (15+ call sites, T006) | Java, TS | at `B_cand` | Exercises resolution lookups; a failure counts as a failing band for that language. |

Ordinary 4 KiB cells run as **3 rounds of 10** spaced ≥ 20 minutes apart so each language has cold-candidate observations at the smallest size (§5).

## 4. Queue configuration (exact)

- `max_batch_size = 1`, `max_batch_timeout` at the minimum, one consumer.
- `max_retries = 1` (a CPU kill is visible after two attempts) with a dead-letter queue. The production retry value is a separate decision.
- Messages sent one at a time with a delay so invocations do not overlap, except the round spacing in §5.
- No `limits.cpu_ms` (not supported on Free, DOC).

## 5. Observations, stages and cold handling (Revision 4)

**Stage 0 — smoke gate (§6).** 10 invocations of the 4 KiB ordinary fixture.

**Stage 1 — screening.** **30 invocations per screening cell** (a cell = family × language × band). These are **screening evidence, not a strong reliability proof**: 0 failures in 30 only bounds the failure rate at roughly 10% (one-sided 95%, rule of three).

**Stage 2 — confirmation.** **100 invocations at the selected B** (§8) for **Java dense, TypeScript dense and Minified-JS** (300 messages), run as **5 rounds of 20** spaced ≥ 20 minutes apart. Pass: 0 CPU failures (§7), p95 (nearest-rank, the 95th value) ≤ 5 ms, max ≤ 8 ms. Even 0 failures in 100 only bounds the failure rate at about 3%; the safety claim rests on this plus the margin plus the implementation-level re-check (§2).

**Cold handling:**
- Cold start cannot be forced or proven (U4/U5 UNKNOWN). Classify by **idle gap only**: the first invocation of each round after ≥ 20 minutes idle is a **cold candidate**, and the **first invocation after each deployment** is also a cold candidate. An idle gap is never claimed to prove a cold start; results are labelled "cold-candidate".
- The parser is initialized inside the handler (§2) so initialization cost appears in the invocation CPU.
- **Cold candidates are judged by maximum CPU only** (≤ 8 ms), not p95 (too few observations). They are reported separately from warm observations.

**Volume (informational):** typical ≈ 1,240 messages (ordinary 360, Dense-Java/TS ≤ 300, Minified ≤ 150, Dense-JS/TSX ≥ 60, CALLS-heavy 60, confirmation 300, smoke 10) ≈ 3,700 Queue operations; worst case with step-downs ≈ 1,420 messages ≈ 4,300 operations. Inside the Free 10,000 operations/day (DOC) but shared with production use; split across days if needed. Workers Logs retention on Free is 3 days (DOC): export raw rows within it.

## 6. Telemetry, evidence and smoke gate (Revision 2, 5)

Source: **Workers Logs invocation log** (Free, DOC). Record per invocation: invocation id/timestamp; event type = queue; CPU time (`$workers.cpuTimeMs`, trace attribute `cloudflare.cpu_time_ms`); wall time; `outcome`; script version; exceptions; plus an application JSON log line in the same invocation: `messageId`, `attempts`, `family`, `language`, `band`, `fileBytes`, `nodeCount`, `nodesPerKiB`, `round`, `coldCandidate`, `idleGapSec`, `errorClass` (when caught). Queue side: retry counts and DLQ arrivals. No in-Worker phase timers (they measure wall time, not CPU). Export the raw rows to a file in the repository's evidence area at the end of each stage.

**Smoke gate pass iff:** (i) Workers Logs returns a CPU-time value for queue-handler invocations; (ii) the field's resolution is observed and **declared before Stage 1** as `integer` or `fractional` (§7); (iii) the application log line correlates to the invocation; (iv) observability settings work on the scratch Worker (Feature 005 §14.1 noted a discrepancy about enablement and the Free log quota; the smoke gate settles it empirically). **Fail → stop; do not run Stage 1; T007 stays STOPPED (FR-029); this is not outcome C.** Proceeding without telemetry would need an FR-038 waiver naming the assumed X, the margin M and the unit.

## 7. Result interpretation rules (Revision 5)

**Thresholds (PARAM, §0):** p95 ≤ 5 ms, max ≤ 8 ms, judged on recorded CPU. p95 uses nearest-rank: N = 30 → 29th value; N = 100 → 95th. With N = 30, "p95 ≤ 5 and max ≤ 8" means at least 29 of 30 ≤ 5 ms and none > 8 ms.

**CPU failure (any one fails the observation, and the cell):**
- `outcome = exceededCpu`;
- HTTP/Worker error 1102, or an equivalent CPU-termination outcome, where applicable to the queue path;
- recorded CPU > 10 ms, **even if the outcome is `ok`**;
- recorded CPU above the applicable experiment threshold (cell: p95 > 5 ms or max > 8 ms; cold candidates: > 8 ms);
- **missing CPU value** (telemetry gap): fails that observation.

**Integer CPU resolution:** if the smoke gate declares the reported CPU `integer`, no precision is invented. A reported integer n is treated as the interval [n, n+1) and judged by its **upper bound**: p95 passes only if the reported value ≤ 4, max and cold-candidate max pass only if reported ≤ 7, and a reported 10 or more is a failure. If any fractional value appears later, resolution is re-declared and the affected results are re-judged.

**Rollover:** the runtime's CPU rollover bank affects **enforcement**, not the recorded CPU value. **Absence of an error is not evidence that the workload is within the 10 ms budget.** A cell is judged primarily on recorded CPU. The bank's state is not measured and is never relied on (DOC/staff: it must not be relied on).

**Retry, exceedance and DLQ classification** (every retry or DLQ arrival is classified; none is silent):
- `exceededCpu` invocation → **CPU failure**.
- 1102 or equivalent CPU termination → **CPU failure**.
- Retry with a logged non-CPU cause (`errorClass`: R2, D1, other exception) → **non-CPU failure**: excluded from CPU statistics and reported; more than one per cell voids that cell for re-run.
- Retry with `outcome = ok` and no logged error → **platform redelivery**: reported separately and **investigated** before any B is accepted.
- Retry with **no corresponding invocation log** → **failure** (telemetry gap).
- A DLQ arrival not classified by the rules above fails its cell.

## 8. B selection rule (Revision 6)

`MINIMUM_USEFUL_B = 16 KiB` (PARAM, pre-registered; §0).

1. For each required family, determine its **largest passing band**: Dense-Java, Dense-TS, Minified-JS (ascending ladders; a band passes only if the cell and every lower band in that family passed, and any ordinary or CALLS-heavy failure in that language at that band or below fails it); Dense-JS and Dense-TSX (tested at `B_cand`, then stepped down per §3).
2. `B_cand` = the minimum of the largest passing bands of Dense-Java, Dense-TS and Minified-JS.
3. Dense-JS and Dense-TSX are tested at `B_cand`; on failure the next lower band is tested and so on (30 invocations per step).
4. **Final B = the MINIMUM of the largest passing bands of all five families:** Java, TypeScript, JS, TSX and minified JS.
5. **Never extrapolate** above an observed passing band; **round down** to the available band (4, 16, 32, 64, 128 KiB); cap at `CODE_INTEL_MAX_FILE_SIZE_BYTES`.
6. Run Stage 2 at the selected B. If it fails, B drops one band; any family not yet screened at that band is screened there (30 invocations) and Stage 2 repeats.
7. **B must be ≥ 16 KiB** to satisfy the minimum-useful criterion. If the resulting B is below 16 KiB, **T007-CAL-1 does not clear T007** and the outcome is classified under §9 (C / defer). The minimum useful B is **not** silently lowered.

## 9. Outcomes

**Toward A — CLEARED recommendation (only after ALL hold; FR-030/FR-037 still require the reviewed amendment):**
- the smoke gate passed;
- selected B ≥ 16 KiB;
- the 100-invocation confirmation passed;
- cold-candidate maximum ≤ 8 ms;
- the approved 5 ms / 8 ms margin is satisfied throughout;
- the reviewed Feature 004 amendment adds the resulting controls: `max_batch_size = 1`, `CODE_INTEL_RELATIONSHIP_MAX_FILE_BYTES = B`, oversize skip before the R2 read (`skipped_oversize`, snapshot `completed_partial`), the attempt-before-work marker, the file-level retry boundary, **and** a task for the implementation-level Cloudflare re-check of §2;
- that implementation-level re-check is completed on the real unit.

**Toward C — T007 remains blocked / feature deferred or materially reshaped, if:**
- **ordinary** code in a required language fails at **4 KiB** (fixed per-invocation cost too large; a byte gate cannot help), including a cold-candidate maximum > 8 ms there; or
- the resulting B is below 16 KiB; or
- another FR-028 gate condition is shown to fail.

**Not automatically C:** a **dense (or minified) 4 KiB failure alone**. That is not a realistic-file failure; it means the byte gate is an insufficient control. Stop, report, and the owner decides between a density/node-count gate amendment and C. **Not C either:** a smoke-gate failure (§6).

**Effect on FR-028 if A conditions hold:** (a) satisfied, (b) satisfied (B selected), (c) satisfied with isolate reuse still UNKNOWN and cold judged by candidates only, (d) satisfied after the amendment, (e) satisfied by platform telemetry rather than a waiver.

## 10. FR-036 experiment resources and lifecycle (Revision 2)

Everything is **scratch**. **No production resource is touched, bound, read or written.** Production names to exclude (from `wrangler.toml`): D1 `repo-atlas-code-intel`, R2 `repo-atlas-snapshots`, queues `repo-atlas-snapshot-acquisition` and `repo-atlas-symbol-extraction` and their bindings. **Scratch resource identifiers are not chosen in this proposal**; they are assigned at authorization time, must differ from every production name above, and are recorded in the run record.

| Resource | Use | Note |
|---|---|---|
| Scratch Worker | calibration harness (queue consumer + a sender) | own script name; no production binding; no route exposure beyond what sending requires (decided at authorization) |
| Scratch Queue | screening/confirmation messages, `max_batch_size = 1`, `max_retries = 1` | Free-plan Queue |
| Scratch DLQ | receives messages that exhaust retries | Free-plan Queue |
| Scratch D1 database | seeded lookup data, scratch per-file writes and attempt markers | Free-plan D1; separate from `repo-atlas-code-intel` |
| Scratch R2 prefix or bucket | synthetic fixtures only | UNKNOWN which fits the existing R2 subscription and plan constraint; decided at authorization; no production bucket data read |

**Required Free-plan configuration:** Workers Free; no paid add-on; `limits.cpu_ms` absent; observability enabled as the smoke gate requires; no Logpush/Tail Worker/OTel (paid).
**Pre-run checks (all must pass before any resource is created):** written user authorization naming T007-CAL-1 with the §0 parameters approved; the Free plan permits the additional Worker, two queues, D1 database and R2 usage (UNKNOWN until checked, not assumed); resource names differ from all production names; current Queue-operations and request usage leaves room for the §5 volume; fixtures and harness are pinned (commit hash, bundle size, fixture checksums, node counts).
**Recorded during the run:** the exact identifiers created (as created, not predicted); timestamps of each deployment; raw Workers Logs rows; queue retry/DLQ observations; the declared CPU resolution; all deviations.
**Teardown (mandatory, after evidence export):** delete the scratch Worker, both queues, the D1 database and the scratch R2 objects/bucket; confirm each deletion against the platform listing; record what was deleted and when; verify that production resources are unchanged. **The run record must state what was changed and what was reverted (FR-036).** If teardown cannot be completed, report it as an open item, do not leave it silent.
**Confirmation to record after the run:** "no production resource was touched" and "the following scratch resources were deleted: …", each backed by the listing evidence above. Not yet true; this proposal records only the requirement.

## 11. FR-038 waiver status

**No FR-038 waiver is required to execute.** The experiment exists to obtain authoritative telemetry (the FR-029 requirement), and X = 10 ms is documented, so no telemetry or budget waiver is involved. Required before execution instead: an authorization naming **T007-CAL-1** (FR-036), and explicit owner approval of the §0 parameters (M = 2, 5 ms, 8 ms, `MINIMUM_USEFUL_B = 16 KiB`) recorded in that authorization. A waiver becomes relevant only if the smoke gate fails and the owner wants to proceed without telemetry; it would then have to name the assumed X, the margin M and the selected unit.

## 12. Remains unknown after the experiment

- Scratch-versus-production equivalence (bundle size, startup, D1 latency effects).
- The final CPU of the not-yet-built T020–T023 code (§2).
- Whether the rollover bank tolerated any run (not observable); the criteria do not depend on it.
- Platform cold-start accounting and isolate reuse (U4/U5): only idle-gap-classified candidates.
- WASM inclusion in CPU time stays "behaviorally indicated, not documented" (dossier B1); the experiment measures the outcome, not the rule.
- Retry backoff timing after a CPU kill (dossier B2).
- Files with more nodes per KiB than the dense and minified fixtures, and languages outside the four.
- Queue-consumer draw on the 100,000 requests/day pool (dossier C4).
- Whether the Free plan permits the scratch resources and exposes the CPU field on queue invocations (smoke gate and pre-run checks).
- What fraction of real repositories' Tier-1 files exceed a 16 KiB gate (product impact, not a gate condition).
