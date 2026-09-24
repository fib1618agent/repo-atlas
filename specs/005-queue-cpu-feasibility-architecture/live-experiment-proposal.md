# Live-Experiment Proposal LX-1 — Queue Consumer CPU telemetry probe

```
STATUS: NOT AUTHORIZED
Authorization ref: (none)
```

**This is a document. Drafting it authorizes nothing.** No step below has been run, and none may be run without the user's explicit authorization that names experiment id **LX-1** (FR-036). A general "proceed", the clarification session, the plan approval and any Feature 005 task do not qualify. Template: `contracts/live-experiment-proposal.md`. Feature 004 T007 remains STOPPED; this proposal does not clear it.

Drafted by task T037 on 2026-09-24. Dependencies read: T015/T016 (`decision-record.md` §4b/§4c), T027 (§6.4), T036 (`evidence/docs-observability.md` addendum).

## 1. ID and question answered

- **ID**: LX-1.
- **Question**: for one Queue Consumer invocation of `repo-atlas-symbol-extraction` on the project's Workers Free plan, does the platform report a CPU value at all, and what does it cover?
- **Resolves (if it observes)**: U3 (telemetry availability for queue invocations on Free), U4 (whether reported CPU includes startup/init, by comparing a cold and a warm invocation if both are reachable), and gives first PLATFORM-TELEMETRY points for measurements M5 (tiny unit, cold) and M6 (one larger unit). It does **not** resolve U1 (the limit value), U2 (accounting unit) or U5 (isolate reuse) by itself; a single sample never supports a gate conclusion (FR-020). M7 (repeated samples) is out of scope for LX-1 and would need its own proposal.
- **A run that fails to observe queue CPU is still a valid outcome** and leaves Feature 004 T007 STOPPED.

## 2. Preconditions (offline; all must be completed and recorded before any live step)

1. Documentation read for the telemetry keys (task T036, 2026-09-24): **`$workers.cpuTimeMs`, `$workers.eventType`, `$workers.outcome` were not found in the returned text** of the two query pages read (C3, C1 still OPEN, UNVERIFIED as absence). Before authorization the reviewer should decide whether more offline reading (a key-reference page) is wanted; the experiment's field list in §5 is therefore provisional.
2. Feature 002 local tests green on the working tree and the working-tree state recorded (`git status`), including the unadopted Query-cache experiment (§9.1). The experiment must be deployed **as the committed code, or the deployed code must be stated exactly**; deploying the uncommitted working tree is not implied by this proposal.
3. A read of the deployed configuration is **not** available offline; the authorizing user states the deployed Worker/queue names and that they are the intended targets.
4. The user names the snapshot to use (smallest already-acquired snapshot) and confirms that re-running extraction on it is acceptable.
5. The measurement protocol fields to record are those in §4b/§4c: invocation type, outcome, warmth, unit, what it includes (or UNKNOWN), sample size, statistic, variability, environment (plan, runtime, commit sha).

## 3. Resources touched (minimal; nothing else)

- Worker `repo-atlas` (`wrangler.toml` `name`), deployed configuration only.
- Queue `repo-atlas-symbol-extraction` (consumer), exactly one tiny unit message; optionally one larger unit message afterwards.
- One already-acquired snapshot chosen by the user (its D1 rows in `snapshot_files`, `file_extractions`, `symbols`, `extraction_jobs` are re-written by extraction; R2 objects of that snapshot are read).
- Workers Logs / observability configuration of the Worker (a configuration change, §4).
- No other Worker, queue, database, bucket, account setting, or paid service.

## 4. Exact steps (each with command class; deployment steps marked)

| # | Step | Command class | Deployment? |
|---|---|---|---|
| 1 | Record baseline: git state, deployed version identifier, observability setting as it is now, row counts for the chosen snapshot's extraction tables | read-only (dashboard or Wrangler read commands, remote D1 read) | no |
| 2 | Enable observability / Workers Logs for the Worker (`wrangler.toml` observability setting or the dashboard setting) | **configuration change followed by redeploy** | **YES — a deployment** |
| 3 | Trigger extraction for the chosen tiny unit through the app's existing entry point so exactly one message is enqueued to `repo-atlas-symbol-extraction` | application action; one queue write | no (but a remote mutation: D1/R2/Queue writes) |
| 4 | Read the resulting invocation record(s) with the documented telemetry route (Workers Logs / Query Builder; the exact field names to be confirmed from the documentation, precondition 1) | read-only | no |
| 5 | (Optional) repeat steps 3–4 once for one larger unit, and record whether the invocation was cold or warm if that is visible | as steps 3–4 | no |
| 6 | Correlate each invocation with the file count and sizes from the app's D1 records for the same snapshot and unit | read-only D1 read | no |
| 7 | Run the reversal steps (§6) and verify cleanup | see §6 | **YES if step 2 is reverted by redeploy** |

## 5. Expected observations (fields to record; provisional pending precondition 1)

`$workers.cpuTimeMs` (or the equivalent documented field), `$workers.outcome` (or equivalent), `$workers.eventType`, timestamp, invocation type (queue), whether the value covers the whole invocation and whether it includes startup/init (the outcome may be "cannot tell", recorded as UNKNOWN), warmth if visible, and the file count and sizes of the unit from D1 records. Any field that is absent is recorded as "absent", not filled in.

## 6. Reversal steps

1. Disable observability / Workers Logs and redeploy the **previous** configuration recorded in step 1 (a deployment).
2. Extraction re-run is idempotent as coded (upsert/replace; `decision-record.md` §10, N3), so the chosen snapshot's rows end in the same state modulo generated ids and timestamps; **no manual row deletion is planned**. If the authorizing user wants the pre-run state restored exactly, that needs a further explicit authorization (remote D1 write) naming the statements; this proposal does not include it.
3. Confirm the queue has no leftover messages from the run and no retries pending.
4. **Cleanup verification**: read back the deployed configuration and confirm it equals the step-1 record; confirm queue depth zero; confirm row counts for the snapshot; record each in the post-execution log.

## 7. Failure handling

If any change cannot be reverted, or verification fails: state exactly what remains changed (for example "observability remains enabled on version X"), **stop**, do nothing further live, and require the user's explicit direction. No automatic retry of a live action; no escalation.

## 8. Cost and limit impact

- Queue operations: about 3 per message (write, read, delete; T004 §6, OFFICIAL-DOC as extracted); a tiny unit is one message, plus retries if any; the run consumes a negligible part of the 10,000 operations/day allowance, plus any traffic on the queue from other sources (unknown).
- Workers Logs (Free: 200,000 logs/day, 3-day retention per T005) — usage from a few invocations only.
- D1: statements per file as in `decision-record.md` §7.5 for the files in the chosen unit; the free-tier figures are UNKNOWN (§7.5), so the comparison is not made here.
- R2: one read per parsed file of the chosen unit.
- **No paid service is used or required.** Paid-only routes (Logpush, Tail Workers, CPU-limit configuration) are not part of LX-1.

## 9. Post-execution log (blank; to be filled only if the user authorizes and runs LX-1)

| Field | Value |
|---|---|
| What changed | — |
| What was reverted | — |
| Results (sample size, cold/warm, unit, inclusions) | — |
| Cleanup verified | — |
| Authorization reference | — |
