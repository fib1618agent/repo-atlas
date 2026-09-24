# Evidence — STOP GATE S1 result (Feature 005, task T009)

Recorded by task T009 on 2026-09-24. Source evidence: `evidence/docs-workers-queues.md` (T004, read 2026-09-23) and `evidence/docs-observability.md` (T005, read 2026-09-24). **No new documentation was read for T009**; the result is a classification of the T004/T005 records. No Cloudflare resource access, no measurement, no live operation.

**Read-method limitation (inherited)**: those records come from WebFetch extraction. Extracted text is evidence; omitted text is UNVERIFIED. A "NO" below means *no explicit statement appears in the extracted text* — it is **not** a verified absence from the Cloudflare pages.

This gate result does **not** clear Feature 004 T007 and does **not** alter any plan decision (S1 rule).

## The three S1 questions

### (i) Does any official page now explicitly state the Workers Free queue-consumer CPU limit?

**NO** (not stated in the extracted text).

Statements that come closest, each **not** a Free-plan queue-consumer limit:

| Page / section (URL) | Extracted wording | Why it does not answer (i) |
|---|---|---|
| Workers "Pricing", Workers table, Free (https://developers.cloudflare.com/workers/platform/pricing/) | "10 milliseconds of CPU time per invocation" | Generic Free wording; does not mention queue consumers. Applying it to queue consumers would be an inference the pages do not state. |
| Workers "Limits", "CPU time" (https://developers.cloudflare.com/workers/platform/limits/) | "CPU time per HTTP request \| 10 ms"; "CPU time per Cron Trigger \| 10 ms" (Free). Extraction: no Queue-consumer row. | HTTP and Cron rows only. |
| Queues "Limits" (https://developers.cloudflare.com/queues/platform/limits/) | "Consumer CPU time \| Configurable to 5 minutes"; note "The following limits apply to both Workers Paid and Workers Free plans with the exception of **Message Retention**" | States a configurable ceiling, not the Free-plan limit value; Workers "Limits" describes the configuration setting as a Paid capability (extraction wording). Not reconciled. |

Related unresolved discrepancy (kept, not reconciled): Workers "Pricing" Standard row was recorded earlier as "Max of **15** minutes of CPU time per invocation (default: 30 seconds)" and returned by T004 as "Max of **5** minutes … (default: 30 seconds)".

### (ii) Does any page explicitly state the queue-consumer CPU accounting unit?

**YES — scoped (interpretation flagged for reviewer).**

Quoted page text (T004 read, Workers "Pricing", Workers table, Standard row; https://developers.cloudflare.com/workers/platform/pricing/):

> "Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation"

This explicitly expresses the Standard-plan CPU maximum **per Queue Consumer invocation**, i.e. the invocation is the stated unit for that limit.

Scope and limits of this "YES":
- It is a **Standard/Paid-plan** row. It does not state the Free-plan queue-consumer unit.
- It does not say whether the unit is the batch or a message. A separate statement (Queues "How Queues works": "the Worker is invoked when the queue has messages to deliver"; `MessageBatch` passed to the `queue` handler) links invocation to batch, but the sentence "one invocation receives multiple messages" was NOT returned by the T004 read of "Batching, Retries and Delays" → UNVERIFIED for that page.
- Queues "Consumer concurrency", Billing: "When multiple consumer Workers are invoked, each Worker invocation incurs [CPU time costs]." — invocation named as the unit for CPU cost when multiple consumers run; it is not a statement of the limit's accounting unit.
- The same row participates in the unresolved 15-vs-5-minute wording discrepancy.
- **This wording (F10) was already known before T004** (`research.md` U2 recorded "docs say 'per invocation'" and still classed U2 as UNKNOWN). T004/T005 found no *new* statement. Recorded as YES because the gate asks whether any page explicitly states the unit; the reviewer may reclassify it as NO if (ii) is read as requiring Free-plan scope or a batch/message-level unit.

### (iii) Does any page explicitly state that CPU telemetry is available for queue invocations on Free?

**NO** (not stated in the extracted text).

Closest statements, none of which says CPU telemetry exists for queue invocations on Free:

| Page (T005) | Extracted wording | Gap |
|---|---|---|
| Workers Logs, handler table | Queue row `<Queue Name>` (queue handler invocation logs exist); Free "200,000 per day", "3 Days" retention | Same page returned no CPU/wall/outcome field wording ("CPU time, wall time, and outcome fields are not mentioned" — extraction claim). |
| Query Builder, filters | "`$workers.cpuTimeMs`" named as an example field; "The Query Builder is available to all developers and requires no enablement." | Example field only; extraction: handler-type / queue filtering "Not described". |
| Trace Events (both URLs) | `CPUTimeMs` documented; `EventType` includes `queue` | Delivered via Logpush, "available on the Workers Paid plan" (Logpush page). |
| Tail Workers | "available to all customers on the Workers Paid and Enterprise tiers" | Paid/Enterprise. |
| Metrics and analytics | "CPU Time per execution" quantiles | Event-type breakdown and plan availability "Not returned". |

## S1 result line (as recorded in `decision-record.md` §16)

**S1: (i) NO / (ii) YES (scoped: Standard-plan Pricing row, "per … Queue Consumer invocation"; not Free-plan, not batch/message) / (iii) NO.**

Because (ii) is YES, the gate rule applies: this is recorded here and in the decision record; it is **not** treated as clearing Feature 004 T007; **no plan decision is altered**; and the result is **reported to the user before any further task (T010 onward)**.
