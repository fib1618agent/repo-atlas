# Evidence — Official public documentation: Workers observability (Feature 005, task T005)

**Class**: OFFICIAL-DOC. **Date read**: 2026-09-24. **Method**: WebFetch of public documentation pages only (no Cloudflare MCP/API, dashboard, Wrangler, remote D1/Queues/R2, deployment, live validation; no credentials or account context).

**Recorded-finding source**: `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-observability-report.md` — findings D1–D16, contradictions C1–C4 ("recorded" below).

## Read-method limitation (inherited from T004; applies to every row)

WebFetch returns text produced by a small extraction model, not raw page text. Quotes were requested verbatim but are not independently confirmed character-exact. **Extracted text is evidence; omitted text is UNVERIFIED.** "Not returned" below means the extraction did not return it — it does NOT mean the page lacks it. Statements such as "the page does not mention X" are the extraction tool's claims and are recorded as such. Extraction-tool paraphrases are marked "(extraction wording, not a quote)".

## Evidence-status labels used

- **FACT** — wording returned by the extraction, recorded as returned (documented fact only to the extent of the read-method limitation).
- **INCOMPLETE** — extracted evidence that is partial or lacks a needed element.
- **UNVERIFIED** — a recorded (D-) statement that this read did not return; neither confirmed nor refuted.
- **CONTRADICTION** — two returned/recorded statements that do not agree; NOT reconciled here.
- **UNKNOWN** — the question is not answered by anything returned.

Questions tracked per page: (Q1) CPU-time fields; (Q2) queue-invocation coverage; (Q3) Free vs Paid availability; (Q4) whether CPU includes startup/init; (Q5) outcome values incl. `exceededCpu`.

Scope note: T005 lists "Query Builder / Observability telemetry". Only the Query Builder page was read here. The Observability telemetry query API and query-language pages (recorded D16) are assigned to task T036 and were **not** read.

## 1. Workers Logs — https://developers.cloudflare.com/workers/observability/logs/workers-logs/ (recorded D3)

| Q | Section | Returned wording | Status / vs recorded |
|---|---|---|---|
| Q1 | Invocation logs | Invocation logs contain "details such as the Request, Response, and related metadata", identified by `$cloudflare.$metadata.type = "cf-worker-event"`. Extraction: "CPU time, wall time, and outcome fields are not mentioned." | FACT (contents). CPU field absence is an extraction claim → INCOMPLETE re CPU. Matches D3 (no CPU wording). |
| Q2 | Handler message-format table | Rows: Alarm `<Scheduled Time>`, Email `<Email Recipient>`, Fetch `<Method> <URL>`, **Queue `<Queue Name>`**, Cron `<UNIX-cron schedule>`, Tail `tail`, RPC `<RPC method>`, WebSocket `<WebSocket Event Type>`. Extraction: "Queue consumer invocations are covered as indicated by the table row" (extraction inference). | FACT (Queue row exists). Coverage inference is the extraction's, not a quote. Matches D3. Whether a CPU field is populated for Queue invocation logs: UNKNOWN. |
| Q3 | Availability & limits | Free: "200,000 per day", "3 Days" retention. Paid: "20 million included per month" plus "$0.60 per additional million", "7 Days". | FACT. Consistent with D3 (Free 200,000/day, 3 d; Paid 20 M/month, 7 d). Price and the account-level 5 billion cap: price new; cap not returned (UNVERIFIED). |
| — | Sampling | "`head_sampling_rate` is set to 0.01, which means one out of every one hundred requests is logged" (example). | FACT (example only). Range 0–1/default from D3 UNVERIFIED. |
| — | Enabling | "You must add the observability setting for your Worker to write logs to Workers Logs." Minimum Wrangler 3.78.6. | FACT. D3 said enabling needs `observability.enabled` and a redeploy; the redeploy statement was not returned (UNVERIFIED). |
| Q4 | — | Not returned. | UNKNOWN. |
| Q5 | — | Not returned (outcome not mentioned). | UNKNOWN on this page. |

## 2. Query Builder — https://developers.cloudflare.com/workers/observability/query-builder/ (recorded D4)

| Q | Section | Returned wording | Status / vs recorded |
|---|---|---|---|
| Q1 | Filters/fields | Field examples: `"$workers.cpuTimeMs"`, `"$metadata.message"`, `"$workers.event.request.cf.country"`, `"$workers.event.response.status"`, `"$workers.event.request.path"`. | FACT (named as examples). Consistent with D4 (cpuTimeMs as example). Does not establish that the field is populated for any invocation type → INCOMPLETE. |
| Q2 | — | "Handler type / Queue invocations filtering: Not described in the provided content." | UNKNOWN (consistent with D4). |
| Q3 | Availability | "The Query Builder is available to all developers and requires no enablement." Also "The retention period is dependent on your plan type" (retention lengths not returned). | FACT. Consistent with D4. Whether Workers Logs data must exist (needs enabling per §1) is a separate dependency: INCOMPLETE. |
| Q4 | — | Extraction: page "does not discuss whether this includes startup CPU time." | UNKNOWN. |
| Q5 | — | Extraction: page does not mention outcome, eventType, wallTimeMs or exceededCpu. | UNKNOWN on this page (consistent with D4). |

## 3. Workers Trace Events (log fields) — https://developers.cloudflare.com/logs/reference/log-fields/account/workers_trace_events/ (recorded D1)

| Q | Field | Returned wording | Status / vs recorded |
|---|---|---|---|
| Q1 | `CPUTimeMs` | "The amount of CPU time used by the Worker script, in milliseconds." | FACT; matches D1. |
| Q1 | `WallTimeMs` | "The elapsed time in milliseconds between the start of a Worker invocation, and when the Workers Runtime determines that no more JavaScript needs to run." | FACT. Differs in form from the D1 summary ("wall-clock time the JavaScript context remained open"); D1 recorded a paraphrase, so this is a wording refinement, not a conflict. |
| Q2 | `EventType` | "The event type that triggered the invocation. Possible values are *fetch* \| *scheduled* \| *alarm* \| *queue* \| *email* \| *worker_rpc* \| *hibernatable_web_socket*." | FACT; matches D1 (`queue` is a listed value). |
| Q5 | `Outcome` | "The outcome of the Worker script invocation. Possible values are *ok* \| *canceled* \| *exception* \| *unknown*." | FACT; matches D1. `exceededCpu` is **not** among the returned values (see C1 below). |
| — | `Event`, `Exceptions`, `Logs`, `ScriptName`, `Entrypoint` | "Details about the source event." / "List of uncaught exceptions during the invocation." / "List of console messages emitted during the invocation." / "The Cloudflare Worker script name." / "The name of the entrypoint class in which the Worker began execution." | FACT; matches D1 field list. |
| Q2 | Queue name / batch size field | Extraction: "Not returned in documentation." | INCOMPLETE/UNKNOWN (matches D1: none documented). |
| Q4 | `CPUTimeMs` startup/init | Extraction: "Not specified in documentation." | UNKNOWN. |
| Q3 | Plan | Not returned. | UNKNOWN on this page. |

## 4. Workers Trace Events (Logpush dataset) — https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/account/workers_trace_events/ (recorded D1, second URL)

| Q | Returned wording | Status / vs recorded |
|---|---|---|
| Q1 | `CPUTimeMs`: "The amount of CPU time used by the Worker script, in milliseconds." `WallTimeMs`: "The elapsed time in milliseconds between the start of a Worker invocation, and when the Workers Runtime determines that no more JavaScript needs to run." Extraction: `waitUntil()` work continues after the response is returned and "is included in `WallTimeMs`" (extraction paraphrase; exact sentence not returned). | FACT (CPU/wall wording); waitUntil sentence INCOMPLETE. Consistent with D1. |
| Q2 | `EventType` values as in §3 (includes `queue`). | FACT; matches D1. |
| Q5 | `Outcome`: `ok`, `canceled`, `exception`, `unknown`. | FACT; matches D1. |
| Q3 | "Plan/availability notes: Not returned." | UNKNOWN on this page. |

## 5. Workers Logpush — https://developers.cloudflare.com/workers/observability/logs/logpush/ (recorded D2)

| Q | Returned wording | Status / vs recorded |
|---|---|---|
| Q3 | "This product is available on the Workers Paid plan." | FACT; matches D2. |
| Q1 | Fields in the example configuration: "Event, EventTimestampMs, Outcome, Exceptions, Logs, ScriptName"; "Additional customizable fields are available." CPU/wall time: not returned. | FACT (example fields). CPU absence is an extraction result → INCOMPLETE (this is an example list, so absence of CPU here is not evidence the field cannot be selected). Matches D2. |
| Q2 | Queue consumers: not returned. | UNKNOWN (matches D2). |
| — | "In Logpush, you can configure filters and a sampling rate to have more control of the volume of data that is sent to your configured destination." | FACT; matches D2. |

## 6. Tail Workers — https://developers.cloudflare.com/workers/observability/logs/tail-workers/ (recorded D10; D9 Tail Handler not in T005's list)

| Q | Returned wording | Status / vs recorded |
|---|---|---|
| Q3 | "Tail Workers are available to all customers on the Workers Paid and Enterprise tiers." "Tail Workers are billed by CPU time, not by the number of requests." | FACT; matches D10. Free availability beyond that sentence not returned → UNKNOWN. |
| Q1 | Sample event fields returned: `scriptName`, `outcome`, `eventTimestamp`, `event` (request data), `logs`, `exceptions`, `diagnosticsChannelEvents`. `cpuTime`/`wallTime` not present in the returned sample (extraction). | FACT (sample). INCOMPLETE re whether real events carry CPU fields (a sample may be non-exhaustive). Matches D10 (adds `diagnosticsChannelEvents`). |
| Q5 | Sample shows `"outcome": "exception"`; page does not enumerate values (extraction). | INCOMPLETE. `exceededCpu` (recorded D9 from the Tail Handler page) not on this page → D9 statement UNVERIFIED by T005 (page outside T005 list). |
| Q2 | Queue-consumer coverage: not returned. | UNKNOWN (matches D10). |

## 7. Workers Metrics and analytics — https://developers.cloudflare.com/workers/observability/metrics-and-analytics/ (recorded D6)

| Q | Section | Returned wording | Status / vs recorded |
|---|---|---|---|
| Q1 | CPU Time per execution | "The CPU Time per execution chart shows historical CPU time data broken down into relevant quantiles using reservoir sampling." Quantile definitions: the page references external interpretation guidance ("Learn more about interpreting quantiles"). | FACT. "using reservoir sampling" is new relative to D6. Quantile semantics: INCOMPLETE. |
| Q1/Q4 | Rollover | "In some cases, higher quantiles may appear to exceed CPU time limits without generating invocation errors because of a mechanism in the Workers runtime that allows rollover CPU time for requests below the CPU limit." | FACT; consistent with D6. Mechanism scope for queue consumers: UNKNOWN. |
| Q5 | Invocation statuses | "Exceeded resources" = "Worker exceeded runtime limits" with error codes 1102, 1027. Note: it "may appear when the Worker exceeds a runtime limit. The most common cause is excessive CPU time, but is also caused by a Worker exceeding startup time or free tier limits." | FACT (extraction). D6 recorded the status name only; error codes and the startup / free-tier causes are new. Relevance: the status is documented as also covering startup-time excess. |
| — | Retention | "Worker metrics can be inspected for up to three months in the past in maximum increments of one week." | FACT; matches D6. |
| Q2 | Breakdown by event type | Not returned. | UNKNOWN (matches D6). |
| Q3 | Plan availability | Not returned. | UNKNOWN (matches D6). |
| Q4 | Startup in CPU | Not returned. | UNKNOWN. |

## 8. Errors and exceptions — https://developers.cloudflare.com/workers/observability/errors/ (recorded D12; F9 in T004's recorded findings)

| Q | Returned wording | Status / vs recorded |
|---|---|---|
| Q4/Q5 | Error 1102: `"Worker exceeded CPU time limit"`. Error 10021: `"Script startup exceeded CPU time limit"`; context: "This means that you are doing work in the top-level scope of your Worker that takes more than the startup time limit (1s) of CPU time." | FACT; matches D12 / F9. Establishes that startup has its own CPU limit (1 s) reported as a distinct error; does NOT establish whether startup CPU counts toward a request/queue invocation's CPU: UNKNOWN. |
| Q5 | Dashboard category: `"Exceeded CPU Time Limits"` — "Worker exceeded CPU time limit or other resource constraints." | FACT; matches D12 (definition wording new). |
| Q5 | `$workers.outcome` mentioned for filtering errors, example `$workers.outcome = "exception"`. | FACT; matches D12. |
| Q2 | Queue consumers / cron / non-HTTP: "Not returned … no references to Queue consumers, cron triggers, or non-HTTP event handlers." | UNKNOWN (extraction claim; matches D12). |

## Contradictions and discrepancies (recorded, NOT reconciled)

- **C1 — Outcome values.** Returned `Outcome` values for the Trace Events dataset are `ok | canceled | exception | unknown`. Recorded D9 (Tail Handler page, not read in T005) lists `exceededCpu`, `exceededMemory`, etc. The Metrics page (returned) and Errors page (returned) use dashboard categories "Exceeded resources" / "Exceeded CPU Time Limits". No returned text explains how these relate. STILL OPEN (evidence unchanged).
- **C2 — CPU fields per product.** `CPUTimeMs`/`WallTimeMs` documented for Trace Events; not present in the returned Logpush example fields or Tail Workers sample. Whether the omission is real or only reflects examples/extraction is not established. STILL OPEN.
- **C3 — CPU in Workers Logs.** Query Builder returns `$workers.cpuTimeMs` as an example field; the Workers Logs page returned no CPU wording and no `$workers` namespace description. Recorded search snippet claim (D16) not confirmed by any page read here. STILL OPEN.
- **C4 — Queue-consumer CPU limit.** Not a T005 topic. Carried unchanged from the prior report. The T004 discrepancy (Workers Pricing Standard "15 minutes" recorded F10 vs "5 minutes" returned in T004) is **not** touched or resolved by T005 (no page read in T005 addresses it; the Metrics page's "free tier limits" phrase, above, is not a Queue-consumer CPU limit statement).

## Summary of T005 evidence vs recorded D1–D16

- Matches recorded: D1 (fields, `queue` EventType, outcome values), D2 (Paid), D3 (Queue row, Free 200,000/day 3 d), D4 (example field, "available to all developers"), D6 (CPU quantiles, rollover, retention), D10 (Paid/Enterprise), D12 (1102, "Exceeded CPU Time Limits", `$workers.outcome`).
- New vs recorded: `WallTimeMs` full wording; reservoir sampling; "Exceeded resources" error codes 1102/1027 and startup/free-tier causes; Tail Workers sample `diagnosticsChannelEvents`; error 10021 wording; Workers Logs Paid price; Wrangler ≥ 3.78.6 requirement.
- UNVERIFIED by T005 (not returned or page not in T005 scope): D3 5-billion cap, `head_sampling_rate` range/default, redeploy statement; D5 (changelog), D7 (GraphQL), D8 (Queues metrics), D9 (Tail Handler), D11 (real-time logs), D13 (profiling), D14/D15, D16 (query API — T036).
- Still UNKNOWN after T005: whether `$workers.cpuTimeMs`/`CPUTimeMs` is populated for queue-consumer invocations (any plan); whether it includes startup/init; whether Free-plan availability of CPU telemetry for queue invocations exists; per-message vs per-batch CPU attribution; units/semantics of quantiles; rollover mechanism scope.
- Nothing here establishes a Free-plan Queue Consumer CPU limit; no numeric budget is asserted.

## Boundary confirmation

Documentation reads only (8 WebFetch calls to public pages). No Cloudflare MCP/API tool, dashboard, Wrangler, remote D1/Queues/R2, deployment or live validation. No measurement was run or created. No repository file other than this one was created or modified for T005.

---

## Addendum — Observability telemetry query pages (Feature 005 task T036; recorded finding D16, previously unread)

**Class**: OFFICIAL-DOC. **Date read**: 2026-09-24. **Method**: WebFetch of public documentation pages only (extraction by a small model; asked for verbatim quotes; **omitted text is UNVERIFIED and is not proof of absence**). No Cloudflare MCP/API execution, dashboard, Wrangler, remote D1/Queues/R2, deployment, or live validation; no credentials or account context. Same read-method caveat as the rest of this file.

**Question**: are `$workers.cpuTimeMs`, `$workers.eventType`, `$workers.outcome` documented keys, and with what semantics?

| Page (title as described by the extraction) — URL | Returned wording | Result |
|---|---|---|
| Telemetry "Run a query" API method (Workers observability) — https://developers.cloudflare.com/api/resources/workers/subresources/observability/subresources/telemetry/methods/query/ | Extraction: the page "focuses exclusively on the structure and parameters of the 'Run a query' API endpoint, including request parameters, filter operations, aggregation calculations, and response schemas". The three keys: **"Not present in the returned text"**. Plan availability (Free vs Paid): **not present**. Startup/init CPU: **not present**. | No key documented in the returned text. **UNVERIFIED as absence** (extraction may have omitted example key names). |
| Observability query language changelog post (2026-02-24) — https://developers.cloudflare.com/changelog/post/2026-02-24-observability-query-language/ | Only one `$workers.*` key returned, in an example: "filter by specific fields using comparison operators (for example, `status = 500` or `$workers.wallTimeMs > 100`)". The three keys asked about: **"not present in the returned text"**. Plan availability and startup/init CPU: **not present**. | `$workers.wallTimeMs` appears as an example filter key (wall time, ms). The three asked-about keys are not returned. |

**Findings (as returned)**
- `$workers.cpuTimeMs`: **not documented in the text returned by either page**. It remains documented only as an example field in the Query Builder page (T005, C3), with no semantics returned. Contradiction **C3 remains OPEN**.
- `$workers.eventType` and `$workers.outcome`: **not documented in the text returned by either page**. Semantics unknown from these pages. Whether an outcome value for CPU-limit termination exists (C1) is **not resolved**.
- `$workers.wallTimeMs`: appears as an example key in the changelog; this is new information relative to T005 and says nothing about CPU time.
- Nothing returned addresses Free-plan availability for queue invocations (U3) or whether reported CPU includes startup/init (U4). **U3 and U4 unchanged (UNKNOWN).**
- S1 questions: no returned text answers (i), (ii) or (iii); S1 result (NO / YES scoped / NO) unaffected.

**Limits of this read**: two pages only; the extraction did not enumerate keys; other query-language reference pages (for example a key-reference page) may name the keys and were not identified or read. Recorded as UNVERIFIED, not as absent.

**Boundary confirmation**: documentation reads only; no other repository file was modified by this addendum's task except logs. Feature 004 T007 remains STOPPED.

---

## Addendum — FR-025 documentation re-verification (Feature 005 task T039)

**Class**: OFFICIAL-DOC. **Date read**: 2026-09-24 (second read of these two pages; first read 2026-09-24, task T005 — same day). **Method**: WebFetch, public pages only, extraction caveat as above; omitted text UNVERIFIED. No live/API/MCP/dashboard/Wrangler use.

| Page — URL | Returned wording | Versus T005 read |
|---|---|---|
| Workers Logs — https://developers.cloudflare.com/workers/observability/logs/workers-logs/ | Handlers listed: "Alarm, Email, Fetch, Queue, Cron, Tail, RPC, WebSocket". "Workers Logs is included in both the Free and Paid Workers plans." "Maximum logs per account per day: 5 Billion" with "a 1% head-based sample will be applied for the remainder of the day" once exceeded. Retention: Free "3 Days", Paid "7 Days". CPU time / wall time / outcome fields: **not mentioned in the returned text**. | The T005 read recorded Free "200,000 logs/day" and 3-day retention; **this read returned "5 Billion" per account per day and did not return the 200,000 figure** — a discrepancy in extracted wording, **not reconciled** (which figure applies to Free is UNVERIFIED). The "included in both plans" statement is new (concerns Workers Logs generally, not CPU telemetry). |
| Query Builder — https://developers.cloudflare.com/workers/observability/query-builder/ | "$workers.cpuTimeMs" is "referenced in filter examples"; other keys named: `$workers.event.request.cf.country`, `$workers.event.request.path`, `$workers.event.response.status`. Queue/handler-type filtering: not mentioned. Plan availability: not mentioned. **Enablement: "you must add observability settings to your Wrangler configuration file and redeploy your Worker to enable Workers Logs before Query Builder can access your data."** | **Wording differs from T005**, which recorded "available to all developers and requires no enablement". Not reconciled (page change vs extraction not determined). The new wording matches what the LX-1 proposal already assumes (enabling observability is a configuration change plus a redeploy). |

**Effect on open items**: C3 (CPU in Workers Logs) stays OPEN: `$workers.cpuTimeMs` is named as an example field, queue filtering and CPU field semantics are not returned. U3 (availability of CPU telemetry for queue invocations on Free) stays UNKNOWN. U4 unchanged. The T005-era Free log-quota figure used in earlier Feature 005 text (200,000/day) is **kept as recorded from T005** and flagged as conflicting with this read.
