# Evidence — Official public documentation: Workers and Queues (Feature 005, task T004)

**Class**: OFFICIAL-DOC. **Date read**: 2026-09-23. **Method**: WebFetch of public documentation pages only (no Cloudflare MCP/API, dashboard, Wrangler, remote D1/Queues/R2, deployment, or live validation; no credentials or account context).

**Recorded-finding source**: `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-research-report.md` §1, findings F1–F20 ("recorded finding" below).

## Read-method caveat (applies to every row)

WebFetch converts each page to markdown and answers a prompt with a small extraction model. Text quoted below is the text **as returned by that tool**; it was asked for verbatim quotes but is not independently confirmed to be character-exact, and the tool may omit sentences that exist on the page. **An omission in this file is therefore NOT proof that the page lacks the sentence** — it only means the extraction did not return it. Where the recorded finding contained wording this read did not return, the "Differs?" column says `NOT RETURNED` (unverified), not `REMOVED`. No contradiction is reconciled here (T004 scope); no conclusion about Queue Consumer CPU is drawn.

Topics: (a) queue-consumer CPU limit on Workers Free; (b) CPU accounting unit; (c) startup / global scope / WASM init; (d) isolate reuse; (e) batch/retry semantics.

## 1. Workers — "Limits" — https://developers.cloudflare.com/workers/platform/limits/

Recorded findings: F1–F9.

| Topic | Section | Wording returned | Differs from recorded finding? |
|---|---|---|---|
| (a) | "CPU time" | "CPU time per HTTP request \| 10 ms" (Free); "CPU time per Cron Trigger \| 10 ms" (Free). Extraction reports the CPU table covers only "HTTP request" and "Cron Trigger" rows; no Queue-consumer row returned. | No (F1). Paid values not returned in this read (F1 recorded Paid 5 min / 30 s). |
| (b) | "CPU time" | "CPU time measures how long the CPU spends executing your Worker code. Waiting on network requests (such as `fetch()` calls, KV reads, or database queries) does **not** count toward CPU time." Unit: milliseconds. | No (F2). |
| (c) | "Worker startup time" | "A Worker must parse and execute its global scope (top-level code outside of handlers) within 1 second." No WASM mention in this section. | No (F7). F9 (error 10021 startup-CPU wording) is on a different page; not on this one. |
| (d) | "CPU time" | "Each isolate has some built-in flexibility to allow for cases where your Worker infrequently runs over the configured limit." | Partly NOT RETURNED: F3's second sentence ("If your Worker starts hitting the limit consistently, its execution will be terminated…") was not returned. |
| (e) | "Wall time limits by invocation type" | Queue consumers: "Each consumer invocation has a maximum wall time of 15 minutes." HTTP: "No hard limit while the client remains connected." | No (F6). |
| config | "Increasing the CPU time limit" | `cpu_ms = 300_000` shown; extraction labels it "Workers Paid plan only, up to 5 minutes". The "Paid only" label is the extraction's own wording, not a returned quote. | F4 example `300000` matches. F4's "Paid setting" characterization: the extraction tool also asserts it; still not a verified quote. Default `30000` not returned. |
| memory | — | Not returned (F8 not re-read; not asked). | NOT RE-VERIFIED. |
| typical usage | — | Not returned (F5 not re-read; not asked). | NOT RE-VERIFIED. |

## 2. Workers — "Pricing" — https://developers.cloudflare.com/workers/platform/pricing/

Recorded finding: F10.

| Topic | Section | Wording returned | Differs? |
|---|---|---|---|
| (a) | Workers table, Free | "10 milliseconds of CPU time per invocation" | No (F10). |
| (a) | Workers table, Standard | "Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation" | No (F10). |
| (a)/(b) | Workers table, Standard (default) | "Max of 5 minutes of CPU time per invocation (default: 30 seconds)" | **YES.** F10 recorded "Max of **15** minutes of CPU time per invocation (default: 30 seconds)"; this read returned "**5** minutes". Not reconciled here; flagged for the decision record's evidence handling (page may have changed, or the extraction may differ). |
| (b) | Billing | Paid: "30 million CPU milliseconds included per month + $0.02 per additional million CPU milliseconds". "CPU time is only billed when the Worker runs (on a cache miss or bypass)." Extraction adds "no charges for duration on the Free plan" (extraction's own summary, not a quote). | New content vs F10 (not recorded before). |

Note: the Standard/Paid rows above do not, in the returned text, state a Free-plan Queue Consumer CPU limit. The Free row says "per invocation" without qualifying by invocation type.

## 3. Queues — "Limits" — https://developers.cloudflare.com/queues/platform/limits/

Recorded finding: F11.

| Topic | Section | Wording returned | Differs? |
|---|---|---|---|
| (e) | Limits table | "Maximum consumer batch size \| 100 messages" | No. |
| — | Limits table | "Concurrent consumer invocations \| 250 ^push-based only^" | No. |
| — | Limits table | "Consumer duration (wall clock time) \| 15 minutes" | No. |
| (a) | Limits table | "Consumer CPU time \| Configurable to 5 minutes", footnote "linking to increase instructions" (extraction's paraphrase of the footnote). | Matches the row; footnote text differs in form: F11 recorded footnote 5 "Refer to Workers limits" linking `#cpu-time`; this read returned only a paraphrase. NOT VERIFIED either way. |
| — | Limits table | "Message retention period \| Configurable up to 14 days" | New vs F11 summary. |
| (a) | Opening note | "The following limits apply to both Workers Paid and Workers Free plans with the exception of **Message Retention**, which is non-configurable at 24 hours for the Workers Free plan." | Same substance as F11 note, plus the 24-hour Free retention detail. |

Max batch wait (60 s), per-queue throughput (5,000 msg/s) and message retries (100) from F11 were not returned in this read (NOT RE-VERIFIED).

## 4. Queues — "Batching, Retries and Delays" — https://developers.cloudflare.com/queues/configuration/batching-retries/

Recorded findings: F12–F14.

| Topic | Section | Wording returned | Differs? |
|---|---|---|---|
| (e) | Batch settings | "Maximum Batch Size `max_batch_size` \| 10 messages \| 1 message \| 100 messages" (default, min, max); "Maximum Batch Timeout `max_batch_timeout` \| 5 seconds \| 0 seconds \| 60 seconds" | Consistent with F12 defaults (10 / 5 s); min/max are new detail. |
| (e) | Batching | "you can also define how messages are batched as they are delivered" | F12's statement that one `queue(batch, …)` invocation receives multiple messages (iterated via `batch.messages`) was NOT RETURNED in this read. |
| (e) | Explicit acknowledgement and retries | "Messages that are explicitly acknowledged will not be re-delivered, even if your queue consumer fails on a subsequent message"; "When a single message within a batch fails to be delivered, the entire batch is retried, unless you have explicitly acknowledged a message" | No (F13; `ackAll`/`retryAll` precedence sentence not returned). |
| (a)/(e) | — | Extraction states no mention of CPU or duration implications of batch size. | Consistent with F14 (absence claim; subject to the read-method caveat). |

## 5. Queues — "Consumer concurrency" — https://developers.cloudflare.com/queues/configuration/consumer-concurrency/

Recorded findings: F15–F16.

| Topic | Section | Wording returned | Differs? |
|---|---|---|---|
| (d)/(e) | "How concurrency works" | "After processing a batch of messages, Queues will check to see if the number of concurrent consumers should be adjusted." Factors: "The number of messages in the queue (backlog) and its rate of growth. The ratio of failed (versus successful) invocations… The value of `max_concurrency` set for that consumer." | Consistent in substance with F15. F15's sentences "…will not autoscale while a batch is being processed. Consider reducing batch sizes…" NOT RETURNED. |
| — | "Limit concurrency" | `max_concurrency` set in the Wrangler file; dashboard "Maximum consumer invocations" between `1` and `250`. | Consistent (F15: 1–250). |
| (b) | "Billing" | "When multiple consumer Workers are invoked, each Worker invocation incurs [CPU time costs]." "If you intend to process all messages written to a queue, *the effective overall cost is the same*, even with concurrency enabled." | First sentence matches F15. Second sentence new vs F15. |
| (d) | — | Extraction states the page does not mention whether isolates are reused or created separately for concurrent invocations. | Consistent with F16 (absence claim; subject to caveat). |

## 6. Queues — "Pricing" — https://developers.cloudflare.com/queues/platform/pricing/

Recorded finding: F17.

| Topic | Section | Wording returned | Differs? |
|---|---|---|---|
| — | Operations | "10,000 operations/day included" (Workers Free plan); "An operation is counted for each 64 KB of data that is written, read, or deleted."; "Operations are per message, not per batch. A batch of 10 messages (the default batch size), if processed, would incur 10x write, 10x read, and 10x delete operations: one for each message in the batch." | No (F17). |
| (a)/(b) | — | Extraction states no CPU-related content on this page. | Absence claim; subject to caveat. |

## 7. Queues — "How Queues works" — https://developers.cloudflare.com/queues/reference/how-queues-works/

Recorded finding: F18.

| Topic | Section | Wording returned | Differs? |
|---|---|---|---|
| (e) | Consumers | "A consumer Worker, which is push-based: the Worker is invoked when the queue has messages to deliver." | No (F18). |
| (e) | Create a consumer Worker | "The `MessageBatch` that is passed to your `queue` handler includes a `queue` property with the name of the queue the batch was read from." | Consistent with F18 (each invocation receives a `MessageBatch`). |
| (d) | — | Extraction states isolate reuse, CPU and concurrency are not addressed on this page. | Consistent with F18 (absence claim; subject to caveat). |

## 8. Workers — "How Workers works" — https://developers.cloudflare.com/workers/reference/how-workers-works/

Recorded finding: F19.

| Topic | Section | Wording returned | Differs? |
|---|---|---|---|
| (d) | Isolates | "An isolate may be spun down and evicted for a number of reasons: Resource limitations on the machine. A suspicious script - anything seen as trying to break out of the isolate sandbox. Individual resource limits." | No (F19). |
| (d) | Isolates | "it is generally advised that you not store mutable state in your global scope unless you have accounted for this contingency." | No (F19). |
| (d) | Distributed execution | "Because there is no guarantee that any two user requests will be routed to the same or a different instance of your Worker, Cloudflare recommends you do not use or mutate global state." | Consistent with F19; wording differs slightly ("no guarantee … same or a different instance" is the same idea). |
| (c) | Startup Speed | "Isolates are also designed to start very quickly. Instead of creating a virtual machine for each function, an isolate is created within an existing environment." | New vs F19. |

## 9. Workers — "Wasm in JavaScript" — https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/

Recorded finding: F20.

| Topic | Section | Wording returned | Differs? |
|---|---|---|---|
| (c) | "Use from JavaScript" | "This should be done at the top level of the script to avoid instantiation on every request." | No (F20). |
| (c) | "Bundling" | "Wrangler will bundle any Wasm module that ends in `.wasm` or `.wasm?module`"; "so that it is available at runtime within your Worker. This is done using a default bundling rule" | No (F20). |
| (c) | — | Extraction states no mention of CPU limitations, startup restrictions or code-generation restrictions; the phrase "Wasm code generation disallowed by embedder" is not mentioned. | Consistent with F20's absence claim (subject to caveat). |

## Summary of differences from recorded findings

Only one difference in returned *wording* of a recorded quote: Workers "Pricing" Standard row "15 minutes" (F10) vs "5 minutes" (this read). Several recorded sentences were **not returned** (F3 second sentence, F12 multi-message sentence, F15 no-autoscale-during-batch sentence, F13 `ackAll`/`retryAll` sentence); these are unverified, not refuted. Some F-findings (F5, F8) were not re-read. Nothing here establishes the Workers Free Queue Consumer CPU limit, and nothing here changes any recorded UNKNOWN. Contradictions (F1/F10/F11 relationship) are not reconciled by this file.

## Boundary confirmation

Documentation reads only. No Cloudflare MCP/API tool, dashboard, Wrangler, remote D1/Queues/R2, deployment, or live validation was used. No repository file other than this one was created or modified by T004.

---

## Addendum — FR-025 documentation re-verification (Feature 005 task T039)

**Class**: OFFICIAL-DOC. **Date read**: 2026-09-24 (second read; first read 2026-09-23, task T004). **Method**: WebFetch of public documentation pages only, prompted to quote verbatim; same extraction caveat (not independently character-exact; omitted text UNVERIFIED, not absent). No Cloudflare MCP/API, dashboard, Wrangler, remote D1/Queues/R2, deployment or live validation.

| Page — URL | Returned wording (as returned 2026-09-24) | Versus T004 read (2026-09-23) and recorded findings |
|---|---|---|
| Workers "Pricing" — https://developers.cloudflare.com/workers/platform/pricing/ | Free: "10 milliseconds of CPU time per invocation". Standard: "30 million CPU milliseconds included per month"; **two separate rows** — "Max of 5 minutes of CPU time per invocation (default: 30 seconds)" and "Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation". The extraction states these are a generic Standard row and a distinct Cron/Queue Consumer row. | **Same two figures as the T004 read.** The T004 read already returned both; this read additionally reports them as **two rows**. The earlier recorded finding F10 ("15 minutes of CPU time per invocation (default: 30 seconds)") matches **neither row as returned** (it pairs "15" with the generic wording and "default: 30 seconds"). See K1 note below. |
| Workers "Limits" — https://developers.cloudflare.com/workers/platform/limits/ | CPU table: HTTP request Free "10 ms" / Paid "5 min (default: 30 seconds)"; Cron Trigger Free "10 ms" / Paid "30 seconds (< 1 hour interval) / 15 min (>= 1 hour interval)". **No Queue-consumer CPU row.** "Each isolate has some built-in flexibility to allow for cases where your Worker infrequently runs over the configured limit. If your Worker starts hitting the limit consistently, its execution will be terminated according to the limit configured." Wall time: "Queue consumers \| 15 minutes \| Each consumer invocation has a maximum wall time of 15 minutes." | Table now shows Free and Paid columns (T004 returned Free only). The **second sentence of the isolate-flexibility statement (recorded F3), NOT RETURNED in T004, is returned now** — it is no longer UNVERIFIED as to existence. Paid Cron values are new. No Queue row again (extraction; UNVERIFIED as absence). |
| Queues "Limits" — https://developers.cloudflare.com/queues/platform/limits/ | Full table returned: "Consumer CPU time \| Configurable to 5 minutes"; "Maximum consumer batch size \| 100 messages"; "Message retries \| 100"; "Maximum Batch wait time \| 60 seconds"; "Per-queue message throughput \| 5,000 messages per second"; "Concurrent consumer invocations \| 250"; "Consumer duration (wall clock time) \| 15 minutes"; "Message retention period \| Configurable up to 14 days". Opening note: "The following limits apply to both Workers Paid and Workers Free plans with the exception of **Message Retention**, which is non-configurable at 24 hours for the Workers Free plan." Footnote on the CPU row: returned only as a paraphrase ("includes a footnote linking to Workers documentation on CPU time limits and references the configuration method for increasing this limit"). | Consistent with T004. Previously "NOT RE-VERIFIED" rows (max batch wait 60 s, throughput 5,000/s, retries 100) are now returned and match F11. Footnote exact text **still not returned** (INCOMPLETE). |

**K1 (15 vs 5 minutes) after this second read — narrowed, not resolved.** Two independent reads (2026-09-23 and 2026-09-24) both return the same two Standard-plan figures, and this read reports them as two distinct rows (generic 5 minutes; Cron/Queue Consumer 15 minutes). That is **consistent with outcome B** (different rows) and would explain the earlier record F10 as a possible merge of the two rows (outcome D), but **both readings are inferences from an extraction, not confirmed by a raw-text read**. K1 stays CONTRADICTION / **UNRESOLVED (narrowed)**; neither figure is a Free-plan value.

**S1 effect**: see `decision-record.md` §14 and `evidence/s1-gate-result.md`; the three S1 answers are unchanged by this read (NO / YES scoped / NO). Nothing here states a Free-plan Queue Consumer CPU limit; the Free row remains the unqualified "10 milliseconds of CPU time per invocation".
