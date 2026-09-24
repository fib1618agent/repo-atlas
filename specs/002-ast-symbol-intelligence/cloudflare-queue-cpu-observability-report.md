# Cloudflare Observability for Queue-Consumer CPU Time — Research Report

**Status**: Read-only documentation research. No deploy, push, Wrangler, or Cloudflare resource access. No production code, Feature 002/004 spec/plan/task/contract change. T007 not touched (remains STOPPED).

**Source caveat**: Every Cloudflare statement below comes from an official `developers.cloudflare.com` page read during this session through a fetch tool that returns a model-processed extract, not raw HTML. Quotes are as returned by that tool. Items backed only by web-search snippets are marked **[snippet]** and are not treated as verified. Anything the documentation did not establish is marked **UNKNOWN**. Where two Cloudflare pages disagree, both are reported and the contradiction is left open.

---

## 1. Executive Summary

- **Cloudflare does document a CPU-time measure, but not one that is documented specifically for Queue-consumer invocations.** The Workers Trace Events dataset has a `CPUTimeMs` field ("The amount of CPU time used by the Worker script, in milliseconds") and an `EventType` value `queue`; Workers Logs / Query Builder reference a `$workers.cpuTimeMs` field; the dashboard and GraphQL expose per-script CPU-time quantiles. No page states that any of these is reported for a Queue-consumer invocation, per message, per batch, or with queue batch size.
- **Free-plan access is partly established**: Workers Logs is documented for Free (200,000 logs/day, 3-day retention) and the Query Builder is "available to all developers"; Workers Trace Events Logpush is **Paid-only**; Tail Workers are **Paid/Enterprise**. Whether `$workers.cpuTimeMs` appears in Free-plan invocation logs for queue invocations is **UNKNOWN**.
- **CPU-overrun evidence is documented for HTTP-style invocations only**: the "Exceeded CPU Time Limits" dashboard category, error 1102, and an `exceededCpu` outcome value on the Tail Handler page. The Trace Events dataset page lists a shorter `Outcome` enum (`ok | canceled | exception | unknown`) — a documentation inconsistency reported below, not reconciled.
- **In-Worker timing cannot substitute**: the "Profiling CPU usage" page states Workers "only increment timers on I/O" for security reasons, making production CPU measurement from inside the Worker difficult. Platform-reported CPU is required.
- **Recommendation**: a controlled live CPU measurement looks **technically plausible** through Workers Logs invocation logs (`$workers.cpuTimeMs`) on the Free plan, but the crucial facts (field present for queue invocations, meaning of the value, startup/WASM inclusion) are UNKNOWN from documentation. See §16.

---

## 2. Verified Documentation Facts

| # | Page (title) — URL | Section | Established (as returned by the fetch tool) |
|---|---|---|---|
| D1 | "Workers Trace Events" — https://developers.cloudflare.com/logs/reference/log-fields/account/workers_trace_events/ and https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/account/workers_trace_events/ | Fields | `CPUTimeMs` (int): "The amount of CPU time used by the Worker script, in milliseconds." `WallTimeMs` (int): wall-clock time the JavaScript context remained open (second page adds: "including work performed via `waitUntil()` after response return"). `EventType`: `fetch \| scheduled \| alarm \| queue \| email \| worker_rpc \| hibernatable_web_socket`. `Outcome`: "The outcome of the Worker script invocation" — allowed `ok \| canceled \| exception \| unknown`. `Event`: "Details about the source event." `Exceptions`, `Logs`, `ScriptName`, `ScriptVersion`, `Entrypoint` also listed. No queue name/batch-size field is documented. |
| D2 | "Workers Logpush" — https://developers.cloudflare.com/workers/observability/logs/logpush/ | Plan requirements | "This product is available on the Workers Paid plan." Extract lists example fields Event, EventTimestampMs, Outcome, Exceptions, Logs, ScriptName; CPU/wall time not listed on this page; Queue consumers not mentioned. Logpush supports filters and a sampling rate. |
| D3 | "Workers Logs" — https://developers.cloudflare.com/workers/observability/logs/workers-logs/ | Invocation logs; pricing table; enabling | "Each Workers invocation returns a single invocation log that contains details such as the Request, Response, and related metadata. These invocation logs can be identified by the field `$cloudflare.$metadata.type = "cf-worker-event"`. Each invocation log is enriched with information available to Cloudflare in the context of the invocation." Handler message-format table includes a **Queue** row: `<Queue Name>` (also Fetch, Cron, Alarm, Email, Tail, RPC, WebSocket). Free plan: 200,000 logs/day, 3-day retention; Paid: 20 million/month included, 7-day retention; account-level cap 5 billion logs/day. Enabling requires `"observability": {"enabled": true}` in the Wrangler config and a redeploy. Head-based sampling via `head_sampling_rate` (0-1, default 1). A targeted fetch found **no sentence on this page containing "CPU", "wall", "duration", or "outcome"**. |
| D4 | "Query Builder" — https://developers.cloudflare.com/workers/observability/query-builder/ | Filters | Example: "The key is any field in a log event. For example, you may choose `$workers.cpuTimeMs` or `$metadata.message`." Availability: "The Query Builder is available to all developers and requires no enablement." The page provides no comprehensive field list and does not mention `outcome`, `eventType`, `wallTimeMs`, `exceededCpu`, or filtering by handler type. |
| D5 | "Investigate your Workers with the Query Builder in the new Observability dashboard" (changelog) — https://developers.cloudflare.com/changelog/post/2025-04-09-qb-workers-logs-ga/ | Announcement | Mentions wall time only as an example question; "The Invocations view groups logs together by invocation, which refers to the specific trigger that started the execution of the Worker"; configuration `"invocation_logs": true`. CPU time not mentioned on this page. |
| D6 | "Metrics and analytics" — https://developers.cloudflare.com/workers/observability/metrics-and-analytics/ | Metrics list | Dashboard exposes requests, subrequests, "Wall time per execution", "CPU time per execution" ("historical CPU time data broken down into relevant quantiles"), execution duration (GB-seconds), memory usage, invocation statuses including "Exceeded resources". Note: "higher quantiles may appear to exceed CPU time limits ... because of a mechanism ... that allows rollover CPU time." Retention: up to three months in maximum one-week increments. Not stated: breakdown by invocation/event type, Queue consumers, plan tier, GraphQL dataset names on this page. |
| D7 | "Querying Workers Metrics with GraphQL" — https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/ | Dataset | Dataset `workersInvocationsAdaptive`; dimensions `datetime`, `scriptName`, `status`; quantiles `cpuTimeP50`, `cpuTimeP99`; sums `subrequests`, `requests`, `errors`. Units of CPU-time fields are not stated. Only `status: "success"` appears in the example; no enumeration of statuses. Requires an Analytics API token; up to one month per query, dates available up to three months back. Queue consumers/event types not mentioned. |
| D8 | "Queues — Metrics" — https://developers.cloudflare.com/queues/observability/metrics/ | Metrics | Queues metrics: backlog, consumer concurrency, message operations (billable operations, bytes, lag time, retries, message size). GraphQL datasets `queuesBacklogAdaptiveGroups`, `queueConsumerMetricsAdaptiveGroups` (field `concurrency`), `queueMessageOperationsAdaptiveGroups`. **No CPU time or duration metric is documented for consumer execution.** No plan information. |
| D9 | "Tail Handler" — https://developers.cloudflare.com/workers/runtime-apis/handlers/tail/ | TailItem | `outcome`: "one of: `unknown`, `ok`, `exception`, `exceededCpu`, `exceededMemory`, `scriptNotFound`, `canceled`, `responseStreamDisconnected`." `event` is a `FetchEventInfo` for fetch events and **`null` for other event types**. No `cpuTime`/`wallTime` properties and no queue-specific event info documented. |
| D10 | "Tail Workers" — https://developers.cloudflare.com/workers/observability/logs/tail-workers/ | Availability | "Tail Workers are available to all customers on the Workers Paid and Enterprise tiers. Tail Workers are billed by CPU time, not by the number of requests." Sample event contains no `cpuTime`/`wallTime`; Queue consumers not explicitly mentioned; Free tier availability not stated beyond that sentence. |
| D11 | "Real-time logs" — https://developers.cloudflare.com/workers/observability/logs/real-time-logs/ | Output/sampling | Example `wrangler tail` output has `outcome`, `scriptName`, `exceptions`, `logs`, `eventTimestamp`, `event` (request details); no CPU/wall time fields shown; queue batch info absent; sampling mode may drop messages; plan requirements not stated; queue-consumer visibility not stated. (The `wrangler tail` command reference was not located on the page checked, "General commands".) |
| D12 | "Errors and exceptions" — https://developers.cloudflare.com/workers/observability/errors/ | Error 1102 | "Worker exceeded CPU time limit" (error page table). Detection: dashboard chart "Errors by invocation status" includes an "Exceeded CPU Time Limits" category; Workers Logs can filter errors with `$workers.outcome`. No mention of Queue consumers, cron, or non-HTTP invocations for this error. |
| D13 | "Profiling CPU usage" — https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/ | Measuring | "Workers only increment timers on I/O" for security reasons, making production measurement difficult; local DevTools profiling via `wrangler dev`; "it may be difficult to replicate specific behavior you are seeing in production." Startup: a Worker may "fail to startup due to time limits." Queue consumers not mentioned. |
| D14 | "Limits" (Workers) — https://developers.cloudflare.com/workers/platform/limits/ | CPU time; startup | CPU time excludes waiting on network requests; startup limit 1 second for global scope; queue consumers appear only in the wall-time table (15 min). (Also recorded in `cloudflare-queue-cpu-research-report.md`.) |
| D15 | "Observability" (overview) — https://developers.cloudflare.com/workers/observability/ | Overview | States metrics include "request counts, error rates, CPU time, wall time, and execution duration"; no plan tiers or product-level field detail. |
| D16 | Search results only **[snippet]** | — | Snippets pointed to an Observability telemetry query API (`https://developers.cloudflare.com/api/resources/workers/subresources/observability/subresources/telemetry/methods/query/`) and an observability query-language changelog (`https://developers.cloudflare.com/changelog/post/2026-02-24-observability-query-language/`). These pages were not read. A snippet also claimed CPU time "is surfaced in the Invocation Log for Workers Logs"; no fetched page containing that sentence was found (see contradiction C3). |

---

## 3. Available Observability Mechanisms

| Mechanism | Documented CPU-time content | Queue-consumer coverage | Documented plan availability |
|---|---|---|---|
| Workers Logs / invocation logs (D3, D4) | `$workers.cpuTimeMs` cited as an example field on the Query Builder page (D4); Workers Logs page itself has no CPU wording (D3) | Handler table lists Queue invocation log format `<Queue Name>` (D3); whether cpuTimeMs is populated for it: UNKNOWN | Free: 200,000 logs/day, 3 days (D3); Query Builder "available to all developers" (D4) |
| Workers Trace Events (D1) | `CPUTimeMs`, `WallTimeMs` fields documented | `EventType` includes `queue` (D1); no queue batch/queue-name fields documented | Delivered via Logpush (D2): **Paid** |
| Tail Workers (D9, D10) | No `cpuTime`/`wallTime` in documented TailItem | `event` is `null` for non-fetch events (D9) | **Paid/Enterprise** (D10) |
| Real-time logs / `wrangler tail` (D11) | No CPU/wall fields in the documented example | UNKNOWN | UNKNOWN |
| Workers dashboard metrics (D6) | "CPU time per execution" quantiles (per-invocation percentiles) | Not stated by event type | UNKNOWN |
| GraphQL `workersInvocationsAdaptive` (D7) | `cpuTimeP50`, `cpuTimeP99` (units unstated) | Not stated | UNKNOWN (Analytics API token needed) |
| Queues metrics (D8) | None (no CPU/duration for consumers) | Yes for queue-level metrics only | UNKNOWN |
| Local profiling (D13) | DevTools CPU profiler via `wrangler dev` | Not mentioned | n/a (local) |

---

## 4. Queue Consumer CPU Measurement

- **Per invocation / message / batch / consumer execution**: The Trace Events dataset describes fields "of the Worker script invocation" (D1), so a value is per invocation. A queue consumer invocation is one batch (D-batching page in the prior report, https://developers.cloudflare.com/queues/configuration/batching-retries/). **A per-message CPU value is not documented anywhere (UNKNOWN).** A per-batch value would only exist as the per-invocation value, if the platform reports one for queue invocations (UNKNOWN).
- **Distinguishing a queue invocation from an HTTP request**: Trace Events has `EventType = queue` (D1). Workers Logs has a Queue row in its handler table (D3) with message `<Queue Name>`. Whether the Workers Logs metadata exposes an event-type field usable in the Query Builder is UNKNOWN (D4 does not mention `eventType`). Dashboard/GraphQL breakdown by event type: UNKNOWN (D6, D7).
- **Metric semantics**: `CPUTimeMs` is described as CPU time used "by the Worker script" (D1); `WallTimeMs` is wall-clock with a separate description (D1). "CPU time per execution" (D6) is presented as quantiles. The units and precise definition of `cpuTimeP50`/`cpuTimeP99` are not stated (D7). The Metrics page also notes quantiles may exceed limits because of "rollover CPU time" (D6) — the mechanism is not explained on the page read. **Billed duration**: no documented CPU-related billed-duration measure was found for queue consumers; the Workers pricing "CPU time" statements apply to billing on Paid, not read further here.

---

## 5. Free Plan Availability

- Workers Logs: documented for Free — 200,000 logs/day, 3-day retention (D3). Requires adding `observability.enabled` and redeploying (D3), which is a deployment of a configuration change.
- Query Builder: "available to all developers and requires no enablement" (D4).
- Trace Events via Logpush: **Paid** (D2). Tail Workers: **Paid/Enterprise** (D10) — neither is available on Free.
- Dashboard metrics and GraphQL: plan availability not stated (D6, D7) — UNKNOWN. The GraphQL API requires an Analytics API token (D7).
- Real-time logs: plan requirements not stated (D11) — UNKNOWN.
- Whether a Free-plan invocation log contains `$workers.cpuTimeMs` for queue invocations: **UNKNOWN**.

---

## 6. CPU vs Wall-Clock Semantics

- CPU time (Workers Limits page): "CPU time measures how long the CPU spends executing your Worker code. Waiting on network requests ... does not count toward CPU time." (https://developers.cloudflare.com/workers/platform/limits/)
- `WallTimeMs`: elapsed time the JavaScript context stayed open (D1). Do not treat any "duration" field as CPU time; the only fields documented as CPU time are `CPUTimeMs` (D1), `$workers.cpuTimeMs` (named only as an example on D4), and the "CPU time per execution" quantiles (D6). Execution "duration" in GB-seconds (D6) is a billing-oriented duration measure and is **not** documented as CPU time.
- The "rollover CPU time" note (D6) means quantiles can look above the limit without termination; its interaction with per-invocation accounting for queue consumers is UNKNOWN.

---

## 7. Startup/Global Initialization

- The Worker startup limit (1 s for global scope) and error 10021 are documented separately from per-invocation CPU (Limits page; https://developers.cloudflare.com/workers/observability/errors/).
- Whether `CPUTimeMs` / `$workers.cpuTimeMs` includes global-scope execution, WebAssembly instantiation, JavaScript parsing/compilation, or only handler execution: **UNKNOWN** — no fetched page states what the field includes.
- D13 says Workers may fail to start "due to time limits" but does not say how startup CPU appears in per-invocation metrics.

---

## 8. Correlation With Queue Batches

- Queue batch size, number of messages, or files per message is **not documented as a field** in Trace Events (D1: `Event` is only "Details about the source event"), Tail Handler (D9: `event` null for non-fetch), Workers Logs (D3: message is the queue name), or Queues metrics (D8).
- Queue-level GraphQL metrics (backlog, concurrency, message operations, lag, retries) are documented (D8), but no join to per-invocation CPU is documented.
- Files-per-message is a RepoAtlas concept and would not appear in any Cloudflare field; it would have to be recovered from application data (for example D1 rows for the unit) or application logs. Whether `console.log` output is attached to the corresponding invocation log in Workers Logs is UNKNOWN from the pages read (D3 mentions nothing on this beyond invocation logs being enriched with context).

---

## 9. Termination/Overrun Evidence

- Dashboard: "Errors by invocation status" includes an "Exceeded CPU Time Limits" category (D12); metrics list "Exceeded resources" (D6).
- Workers Logs: errors can be filtered with `$workers.outcome` (D12).
- Tail Handler: `outcome` can be `exceededCpu` or `exceededMemory` (D9).
- Error 1102 "Worker exceeded CPU time limit" is described in an HTTP context; the page has no mention of Queue consumers, cron, or non-HTTP invocations (D12).
- How a queue consumer terminated for CPU overrun is represented (outcome value, retry behavior, batch redelivery reason): **UNKNOWN** for queue-specific behavior.

---

## 10. What We Can Measure Locally

- Local wall-clock timing of parse/query/extraction (already done in prior investigations) — a proxy only.
- `wrangler dev` DevTools CPU profiling (D13) — documented as possibly unrepresentative of production; not used or run here.
- Fresh-process cold-start decomposition (already done). In-Worker timers are documented as unreliable for CPU in production (D13), so instrumenting the Worker with its own clock is not a substitute.

---

## 11. What Requires Cloudflare Runtime Evidence

- Actual CPU time (`CPUTimeMs` / `$workers.cpuTimeMs`) of a real Free-plan queue-consumer invocation.
- What the platform's CPU number includes (startup, WASM instantiation, parse).
- Whether a queue invocation carrying many files/messages is reported as one CPU value, and how it relates to the 10 ms limit and the "infrequent overrun" tolerance.
- Whether and how a queue consumer is terminated on CPU overrun and how that appears in logs.

---

## 12. Unresolved Questions

1. Is `$workers.cpuTimeMs` populated in Workers Logs invocation logs for Queue-consumer invocations on the Free plan? (D4 names the field only as an example; D3 has no CPU wording.)
2. Can the Query Builder filter/group by handler/event type? (D4: not mentioned.)
3. Does the CPU value include global-scope execution and WASM initialization? (Not stated.)
4. Are CPU/wall-time metrics in the dashboard and GraphQL reported for queue invocations, and are they separable from HTTP invocations? (D6/D7: not stated.)
5. Units and definition of `cpuTimeP50`/`cpuTimeP99` (D7).
6. Meaning and scope of "rollover CPU time" (D6).
7. How a queue consumer CPU overrun is represented and whether it retries the batch.
8. Whether custom `console.log` output is linked to the invocation log so batch size/file count could be correlated.
9. Which of the Observability query API pages (D16) document the available telemetry keys (not read).

### Contradictions between Cloudflare pages (not reconciled)

- **C1 — `Outcome` values.** The Trace Events dataset pages (D1) list only `ok | canceled | exception | unknown`. The Tail Handler page (D9) lists `unknown`, `ok`, `exception`, `exceededCpu`, `exceededMemory`, `scriptNotFound`, `canceled`, `responseStreamDisconnected`. A search snippet stated `exceededCpu` also appears in analytics/Logpush [snippet, unverified]. The Metrics page (D6) and Errors page (D12) refer to "Exceeded resources" / "Exceeded CPU Time Limits" as dashboard categories. The docs do not explain how these relate.
- **C2 — CPU fields per product.** The Trace Events dataset documents `CPUTimeMs`/`WallTimeMs` (D1) but the Tail Handler's `TailItem` (D9) and the Tail Workers sample (D10) show no `cpuTime`/`wallTime`, and the Logpush page extract (D2) lists only example fields without CPU time. Whether the omission is real or only reflects examples is not established.
- **C3 — CPU in Workers Logs.** The Query Builder page (D4) uses `$workers.cpuTimeMs` as a log-event field example, while the Workers Logs page (D3) contains no wording about CPU, wall time, duration, or outcome, and does not document a `$workers` metadata namespace. A search snippet asserted CPU time is surfaced in the invocation log [snippet, source page not located].
- **C4 — Queue-consumer CPU limit (from the prior report, unchanged)**: Workers Limits (no queue-consumer CPU row), Workers Pricing (15 minutes Paid), Queues Limits ("Consumer CPU time: Configurable to 5 minutes", both plans). See `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-research-report.md`.

---

## 13. Implications for Feature 002

Documentation offers a plausible path to real CPU numbers for Feature 002's existing consumer without code changes, but does not confirm it works for queue invocations on Free. Until such a number exists, the size of the Feature 002 batching design (up to 10 messages x up to 50 files per invocation) relative to the 10 ms limit stays unmeasured, and nothing here supports changing it.

## 14. Implications for Feature 004

The one-file-per-unit premise remains unproven either way. If the platform's per-invocation CPU for queue consumers can be captured, it could calibrate both the actual limit that applies and the real CPU of cold and warm invocations. No Feature 004 architecture change is supported by this documentation.

## 15. Implications for T007

T007 stays STOPPED. The documentation establishes that a platform CPU measure exists in at least some products, but not that it covers Free-plan queue invocations, includes initialization, or can be tied to batch size. That is insufficient to redefine or clear the gate.

---

## 16. Recommended Next Step

**Is a controlled live CPU measurement technically possible?** Plausibly yes, via Workers Logs invocation logs on the Free plan (D3, D4), but this is not established for queue invocations. Trace Events/Logpush and Tail Workers are Paid-only and cannot be used on Free (D2, D10).

**Exact metric required**: the per-invocation `$workers.cpuTimeMs` (Workers Logs invocation log; equivalent to Trace Events `CPUTimeMs`) for the specific queue-consumer invocation, plus its outcome (`$workers.outcome`) and timestamp, so it can be matched to one known unit (queue name identifies the invocation type in the log message, D3). The known unit's file count and sizes come from the application's own D1 records, since Cloudflare fields do not carry batch/file counts (§8). Percentile dashboards/GraphQL (D6/D7) are a fallback but mix HTTP and queue traffic in one script and give only quantiles.

**Is Free-plan access sufficient?** Workers Logs and the Query Builder are documented for Free (D3, D4); whether the CPU field is present for queue invocations is UNKNOWN, so sufficiency is unconfirmed.

**Before any live step (offline, no Cloudflare access)**: read the Observability telemetry query API and query-language pages found in search (D16, unread) to see whether they document the available keys (`$workers.cpuTimeMs`, `$workers.eventType`, `$workers.outcome`) and their semantics.

**Smallest safe experiment if live validation is later authorized** (needs explicit approval; enabling Workers Logs requires a configuration change and redeploy per D3, which is a deployment): (1) enable `observability` with full sampling and no code change; (2) trigger extraction for one already-acquired tiny snapshot so the consumer runs exactly one small unit; (3) read that single queue invocation in the Query Builder and record `$workers.cpuTimeMs`, outcome, and timestamp; (4) match it to the known file count from D1; (5) repeat once with a single larger unit; (6) disable observability afterward. Record whether the field exists for queue invocations before drawing any conclusion. Do not treat the result as clearing T007 without a separate decision.
