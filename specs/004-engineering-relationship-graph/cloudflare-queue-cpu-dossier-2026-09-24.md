# RepoAtlas T007 — Cloudflare Workers Queue Consumer CPU Limits & Accounting

**Prepared:** 2026-09-24 (docs retrieved and quoted live on this date)
**Purpose:** Architecture gate evidence for RepoAtlas — verify whether "a Cloudflare Workers Queue Consumer on the Free plan has a CPU budget of 10 ms per invocation" is confirmed by authoritative Cloudflare documentation, and pin down exactly what "CPU per invocation" means.
**Method:** All quantitative/limit claims quoted verbatim from Cloudflare's own documentation (developers.cloudflare.com), supplemented by Cloudflare staff/community statements and third-party measurements — each labeled by source class. Where documentation is silent, the verdict is explicitly "NOT DOCUMENTED / NOT CONFIRMED".

---

## 1. Executive verdict

> **The statement is CONFIRMED in substance, with three qualifications.**

1. **"10 ms CPU on the Free plan" for Queue Consumers is established by a two-document chain, not by a single sentence.** No Cloudflare page says "Free plan Queue Consumer: 10 ms CPU" verbatim. What the docs do say:
   - Workers Free plan limit: **"10 milliseconds of CPU time per invocation"** (Workers › Pricing) and **"CPU time: 10 ms"** (Workers › Limits).
   - Queues › Limits: **"Queue consumer Workers are Worker scripts, and share the same per invocation CPU limits as any Workers do."**
   - The conjunction of the two is explicit: a Free-plan queue consumer invocation is capped at **10 ms of CPU time per invocation**.
2. **"Per invocation" for a queue consumer = per queue-handler invocation, which processes one batch of messages** (up to 100, default 10). The whole batch shares the one CPU budget. There is **no documented per-message CPU allocation**.
3. **Enforcement is not a hard cut at exactly 10 ms.** The runtime gives isolates a CPU "rollover bank" (documented obliquely as "built-in flexibility" / "rollover CPU time"; mechanics confirmed by Cloudflare's Workers lead engineer in a public Discord answer). Occasional overshoot is tolerated; **consistent** over-limit execution is terminated with error 1102 / outcome `exceededCpu`. A Free-plan consumer running a Tree-sitter/WASM parse that regularly exceeds ~10 ms of active CPU will, per documented behavior, be killed and its unacknowledged batch retried.

Also confirmed: queue consumer invocations get **15 minutes of wall-clock time** — the "long wall-clock execution" half of the claim is correct; the CPU budget is the binding constraint on the Free plan.

---

## 2. Document inventory (all retrieved 2026-09-24)

| Document | URL | Last updated (as shown) |
|---|---|---|
| Workers › Pricing | https://developers.cloudflare.com/workers/platform/pricing/ | (page current) |
| Workers › Limits | https://developers.cloudflare.com/workers/platform/limits/ | Jul 28, 2026 |
| Queues › Limits | https://developers.cloudflare.com/queues/platform/limits/ | (page current) |
| Wrangler › Configuration (Limits) | https://developers.cloudflare.com/workers/wrangler/configuration/ | (page current) |
| Queues › How Queues Works | https://developers.cloudflare.com/queues/reference/how-queues-works/ | (page current) |
| Queues › Batching, Retries and Delays | https://developers.cloudflare.com/queues/configuration/batching-retries/ | Apr 21, 2026 |
| Workers › Errors and exceptions | https://developers.cloudflare.com/workers/observability/errors/ | (page current) |
| Workers › Metrics and analytics | https://developers.cloudflare.com/workers/observability/metrics-and-analytics/ | (page current) |
| Workers › Profiling CPU usage | https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/ | (page current) |
| Workers › Spans and attributes (traces) | https://developers.cloudflare.com/workers/observability/traces/spans-and-attributes/ | (page current) |
| Workers › Security model | https://developers.cloudflare.com/workers/reference/security-model/ | (page current) |
| Queues › Observability › Metrics | https://developers.cloudflare.com/queues/observability/metrics/ | (page current) |
| Workers › Observability (overview) | https://developers.cloudflare.com/workers/observability/ | (page current) |
| Workers for Platforms › Pricing | https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/ | (page current) |
| Changelog: Queues on Free plan | https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/ | Feb 4, 2026 |
| Changelog: higher CPU limits | https://developers.cloudflare.com/changelog/post/2025-03-25-higher-cpu-limits/ | Mar 25, 2025 |
| Changelog: CPU/wall time published in invocations | https://developers.cloudflare.com/changelog/product/workers/9/ (and changelog/42 mirror) | ~2025-04 |

---

## 3. A. CONFIRMED BY CLOUDFLARE

### A1. The 10 ms Free-plan CPU figure (Workers › Pricing)
> "| **Free** | 100,000 per day | No charge for duration | 10 milliseconds of CPU time per invocation |"
> "| **Standard** | ... | Max of [5 minutes of CPU time] per invocation (default: 30 seconds) Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation |"

### A2. CPU time definition and per-type limits (Workers › Limits)
> "CPU time measures how long the CPU spends executing your Worker code. Waiting on network requests (such as `fetch()` calls, KV reads, or database queries) does **not** count toward CPU time."
> "| CPU time per HTTP request | 10 ms | 5 min (default: 30 seconds) |"
> "| CPU time per Cron Trigger | 10 ms | 30 seconds (< 1 hour interval) 15 min (>= 1 hour interval) |"
> "Heavier workloads that handle authentication, server-side rendering, or **parse large payloads typically use 10-20 ms**."
> "Each isolate has some built-in flexibility to allow for cases where your Worker infrequently runs over the configured limit. If your Worker starts hitting the limit consistently, its execution will be terminated according to the limit configured."
> "When a Worker exceeds its CPU time limit, Cloudflare returns Error 1102 ... In analytics and Logpush, the invocation outcome is `exceededCpu`."
> Duration table row: "| Queue Consumer | 15 min |"

### A3. Queue Consumers share Worker per-invocation CPU limits (Queues › Limits) — the critical link
> "Queue consumer Workers are Worker scripts, and share the same per invocation CPU limits as any Workers do. Note that CPU time is active processing time: not time spent waiting on network requests, storage calls, or other general I/O."
> "By default, the maximum CPU time per consumer Worker invocation is set to 30 seconds, but can be increased by setting `limits.cpu_ms` in your Wrangler configuration" (with a `cpu_ms: 300000` = 5 min example).
> Limits table row: "| Consumer CPU time | Configurable to 5 minutes |"
> Wall time table row: "| Queue consumers | 15 minutes | Each consumer invocation has a maximum wall time of 15 minutes. |"

### A4. `limits.cpu_ms` — paid-only, per-invocation, max 5 minutes (Wrangler › Configuration)
> "You can impose limits on your Worker's behavior at runtime. **Limits are only supported for the Standard Usage Model.**"
> "The CPU limit can be set to a maximum of 300,000 milliseconds (5 minutes)."
> "`cpu_ms` `number` optional - The maximum CPU time allowed per invocation, in milliseconds."

### A5. Batch-level retry semantics (Queues › How Queues Works; Batching, Retries and Delays)
> "By default, messages within a batch are treated as all or nothing when determining retries. If the last message in a batch fails to be processed, the entire batch will be retried. You can also choose to explicitly acknowledge messages as they are successfully processed..."
> "When a single message within a batch fails to be delivered, the entire batch is retried, unless you have explicitly acknowledged a message (or messages) within that batch."
> "Messages that reach the configured maximum retries will be deleted from the queue, or if a dead-letter queue (DLQ) is configured, written to the DLQ instead." (default `max_retries` = 3; limit table max = 100)
> "each queue can only have one active consumer. This allows Cloudflare Queues to achieve at least once delivery."

### A6. Exceed behavior & error codes (Workers › Errors; Workers › Limits)
> "| `1102` | Worker exceeded CPU time limit. |"
> "| `1027` | Worker exceeded free tier daily request limit. |"
> Dashboard: "Exceeded CPU Time Limits" under Metrics › Errors › Invocation Statuses; analytics/Logpush outcome: `exceededCpu`. Trace attribute `cloudflare.outcome` may be `exceededCpu`; `cloudflare.cpu_time_ms` = CPU time of the invocation.

### A7. Rollover mechanism exists (Workers › Metrics and analytics)
> "In some cases, higher quantiles may appear to exceed CPU time limits without generating invocation errors because of a mechanism in the Workers runtime that allows rollover CPU time for requests below the CPU limit."

### A8. Measurability — official mechanisms
> Workers › Limits, "Monitoring CPU usage": "**Workers Logs** — CPU time and wall time appear in the invocation log. **Tail Workers / Logpush** — CPU time and wall time appear at the top level of the Workers Trace Events object."
> Workers › Pricing: "Workers Logs is included in both the Free and Paid Workers plans. | Workers Free | 200,000 per day | 3 Days |"
> Changelog (Workers, ~Apr 2025): "CPU time and Wall time now published for Workers Invocations ... For Workers Logs, CPU time and Wall time are surfaced in the Invocation Log."
> Workers for Platforms › Observability: GraphQL `workersInvocationsAdaptive` "returns request counts, error counts, and CPU time quantiles".
> Queues › Metrics: queue-level datasets cover backlog, consumer concurrency, message operations (writes/reads/deletes, retries, lag) — **no CPU-time metric at queue level**.

### A9. Paid-plan CPU distinction for consumers exists (Workers › Pricing + Workers for Platforms › Pricing)
> Workers › Pricing (Standard): "Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation" (vs. 5 min general/HTTP).
> Workers for Platforms › Pricing: "Max of 30 seconds of CPU time per invocation; Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation."
So on **paid** plans Cloudflare explicitly distinguishes queue consumers from ordinary HTTP invocations by granting them a larger CPU ceiling. On the **Free** plan, no separate row exists — consumers inherit the uniform 10 ms per invocation.

### A10. Queues is available on the Free plan (Changelog, Feb 4, 2026)
> "Cloudflare Queues now available on Workers Free plan ... All features of the existing Queues functionality are available on the free plan ... maximum retention period on the free tier, however, is 24 hours rather than 14 days." No CPU provision was added for free-plan consumers in this (or any other located) changelog entry.

---

## 4. B. PARTIALLY CONFIRMED

### B1. Is WebAssembly execution included in CPU time?
- **Official docs: no explicit sentence.** The memory limit is explicitly WASM-inclusive ("Each isolate can consume up to 128 MB of memory, including the JavaScript heap and WebAssembly allocations"), but the CPU-time definition does not name WASM.
- Supporting context: Workers › Security model — "Workers does not allow our customers to upload native-code binaries ... only JavaScript and WebAssembly. Both are passed through V8 to convert these formats into true native code." WASM runs inside the same V8 isolate as JS, i.e., the same metered execution environment.
- Behavioral evidence (third-party, labeled): a 2022 community thread ("Built a Golang WASM and deploy to Worker — CPU time exceed 10ms for each request") and a 2026 GitHub issue (muse#306) both report free-plan Workers doing WASM compute (resvg/satori image rendering) hitting `exceededCpu` at the ~10 ms budget; a Cloudflare staff answer in the 2022 thread confirms "Cloudflare will start returning an error if your Worker consistently exceeds the CPU time limit."
- **Verdict: CPU time includes WASM execution — behaviorally indicated, explicitly NOT documented.**

### B2. Does the batch retry automatically after CPU exhaustion?
- Docs state failure semantics precisely: messages are only deleted after successful consumption ("messages are not deleted from a queue until the consumer has successfully consumed the message"); a batch whose processing fails is retried whole (default, all-or-nothing) up to `max_retries` (default 3), then deleted or DLQ'd.
- **No document describes the CPU-limit-kill case specifically for Queues.** By documented mechanism, an invocation killed by CPU exhaustion does not complete/ack its batch, so the batch is re-delivered — but this chain is inference from documented primitives, not a stated rule. Retry timing (backoff) after a hard kill is not documented.
- 2025-03 changelog confirms the kill is observable: `exceededCpu` outcome in tail/logs.

### B3. CPU telemetry on the Free plan
- **Confirmed:** Workers Logs (dashboard + Query Builder + API) is available on Free (200,000 events/day, 3-day retention — note pricing page states 3 days; page variations exist) and the invocation log contains CPU time and wall time for queue-handler invocations like any other invocation.
- **Not confirmed on Free:** Workers Logpush (documented "only available on the Workers Paid plan"), Tail Workers ("available to all customers on the Workers Paid and Enterprise tiers"), and OTel export (free tier marked "Not available"). Dashboard CPU Time per execution chart / GraphQL CPU-time quantiles: capturable on Free in practice, but the docs do not state an explicit Free-plan entitlement for the full metrics set.
- **Verdict: an official mechanism exists on Free (Workers Logs invocation log, CPU time field) — that is the least-privilege documented path.**

### B4. What exactly happens when the limit is exceeded — the "softness"
- Documented: "some built-in flexibility" (Wrangler/Workers docs) + "rollover CPU time" (analytics doc). Undocumented: the bank's parameters.
- Cloudflare staff (Kenton Varda, Workers lead engineer, Cloudflare Developers Discord, Feb 2024 — community transcript, not docs): each isolate holds a "rollover bank" of CPU time; under-use on one invocation tops it up; over-use draws it down; the bank starts with extra time generously seeded; only when the bank empties does the invocation error; startup also gets extra headroom (order of ~400 ms on first execution per staff).
- Practical third-party measurement (Zenn, ma2no4413, 2026-08-21): on the Free plan a pure-compute loop returned 200 OK at 150M iterations (~1.9 s) and hit 1102 at ~2 s of compute — "the docs say 10 ms; the measured enforcement is more than two orders of magnitude more lenient."
- **Verdict: the 10 ms figure is the documented budget, not a measured hard cap on any single invocation; sustained over-limit use is what ends executions. Engineering cannot rely on the leniency (staff: "you cannot rely upon it").**

---

## 5. C. NOT CONFIRMED (explicitly absent from documentation)

1. **A single sentence stating "Free-plan Queue Consumer = 10 ms CPU".** Only the two-doc chain exists.
2. **Per-message CPU allocation.** No doc allocates CPU per message within a batch. The documented model is per-invocation (= per batch delivery). A third-party blog (markaicode.com, 2026-05-22) claims "Each message receives a fresh 30-second CPU budget" — no Cloudflare source supports this; treat as unreliable (see D).
3. **Whether a CPU-killed consumer invocation retries the batch after a specific delay/backoff.** Undocumented (B2).
4. **Whether queue consumer invocations consume the Free plan's 100,000 requests/day and message-count capacity.** The Free-plan Queues changelog does not state a message-count ceiling for consumers; only retention (24 h) and ops pricing (10,000 ops/day, from pricing page) are stated.
5. **CPU-time metric inside Queues' own GraphQL datasets.** Queues metrics expose backlog/concurrency/operations only.
6. **Exact free-plan dashboard entitlement for the CPU Time per execution chart / GraphQL quantiles.** Not stated per plan.
7. **An explicit doc statement that CPU time includes WebAssembly** (see B1).

---

## 6. D. CONTRADICTORY / CONFLICTING SOURCES

1. **Paid-plan consumer CPU ceiling: 5 minutes vs 15 minutes (internal docs conflict).**
   - Workers › Pricing (Standard): "Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation".
   - Queues › Limits: consumer CPU time "Configurable to 5 minutes"; example `cpu_ms: 300000`.
   - Wrangler › Configuration: CPU limit max "300,000 milliseconds (5 minutes)".
   - Cloudflare staff (Discord, Dec 2024, community transcript): "The max cpu time is 30s (except for cron triggers). The max duration is 15 minutes for Queue consumers."
   → The 15-minute figure is plausibly a platform ceiling Cloudflare can grant for consumer/cron invocations (mirrored in Workers for Platforms pricing), while 30 s/5 min is what tools/documentation currently expose. **Free plan unaffected** — 10 ms is the Free ceiling in every source.
2. **Wording drift: "per invocation" vs "per request".** The cloudflare.com Workers product page (marketing) states "CPU Time Free 10 ms / request"; docs consistently say "per invocation". For queue consumers the docs' "invocation" unit (one batch) governs.
3. **Enforcement leniency vs stated limits.** Third-party measurement (Zenn, 2026-08-21) shows ~2 s of sustained compute on Free before 1102 — contradicts a literal reading of "10 ms hard limit," consistent with the rollover bank. Not a doc contradiction; a strictness caveat.
4. **Third-party claim of per-message CPU budgets** (markaicode.com, 2026-05-22): "Each message receives a fresh 30-second CPU budget..." — contradicts the official per-invocation model; no first-party or staff support found.
5. **Stale docs copies** (e.g., a `cloudflare-docs-*.pages.dev` mirror) quote a 400 ms startup CPU limit; current official docs say 1 second. Use only developers.cloudflare.com.

---

## 7. Q&A — the 15 research questions

| # | Question | Answer (documented) | Verdict |
|---|---|---|---|
| 1 | Which doc states 10 ms CPU for Free-plan Queue Consumers? | No single sentence. Chain: Workers › Pricing ("10 milliseconds of CPU time per invocation", Free) + Queues › Limits ("share the same per invocation CPU limits as any Workers do") | CONFIRMED (by chain) |
| 2 | Exact URL & title | Workers › Pricing — developers.cloudflare.com/workers/platform/pricing/; Queues › Limits — developers.cloudflare.com/queues/platform/limits/; Workers › Limits — developers.cloudflare.com/workers/platform/limits/ | — |
| 3 | Minimum quotes | See Section 3, A1 + A3 | — |
| 4 | Does 10 ms apply to Queue Consumers, HTTP, cron, or all? | Queues consumers explicitly share Worker per-invocation CPU limits (Queues › Limits). Free = 10 ms per invocation for all invocation types; paid differs by type (HTTP 5 min default 30 s; cron 30 s/15 min; queue consumer 5 min configurable, 15 min ceiling per pricing page) | Queue consumer: CONFIRMED |
| 5 | CPU time, wall-clock, or duration? | CPU time = active processing: "CPU time measures how long the CPU spends executing your Worker code. Waiting on network requests ... does not count." Wall time is separate (consumer wall limit: 15 min per invocation) | CPU time |
| 6 | What constitutes CPU time? | Executing Worker code; I/O wait excluded (fetch, KV, DB). Internal V8/GC overhead implicitly included (isolate-level metering; "built-in flexibility") | CONFIRMED (definition), inclusion of GC not detailed |
| 7 | WASM included? | No explicit doc sentence; memory includes WASM; V8 executes both JS and WASM in the isolate; WASM workloads demonstrably hit `exceededCpu` at budget | PARTIALLY CONFIRMED |
| 8 | Batch of N messages — once, per-message, or other? | Per invocation; one invocation = one batch delivery (queue handler receives a MessageBatch). Whole batch shares the budget. Per-message CPU allocation: NOT DOCUMENTED | Per-invocation CONFIRMED; per-message NOT CONFIRMED |
| 9 | What happens when exceeded? | Error 1102 / dashboard "Exceeded CPU Time Limits" / outcome `exceededCpu`; isolate flexibility tolerated for occasional overshoot; consistent over-limit use → terminated | CONFIRMED (for Workers generally; consumer-specific doc absent) |
| 10 | Auto-retry after CPU exhaustion? | Implicit via at-least-once + all-or-nothing batch semantics (unacked messages re-delivered, up to `max_retries` default 3, then DLQ/delete). Explicit "CPU kill → retry" statement: absent | PARTIALLY CONFIRMED |
| 11 | CPU telemetry for consumers on Free? | Workers Logs (Free: 200k events/day, 3-day retention) surfaces CPU time in invocation logs for all invocation types; Logpush/Tail Workers/OTel export are paid-only | CONFIRMED (Workers Logs path) |
| 12 | Official mechanism to measure one invocation's CPU? | Invocation log CPU time field (Workers Logs, free); GraphQL `workersInvocationsAdaptive` CPU-time quantiles; traces attribute `cloudflare.cpu_time_ms`; dashboard CPU Time per execution chart; DevTools CPU profiling (local); no in-worker CPU timer (security model forbids self-measurement) | CONFIRMED |
| 13 | Does Cloudflare distinguish consumer CPU from request CPU? | On paid: yes — pricing page grants queue consumers up to 15 min CPU per invocation vs 5 min general. On Free: no per-type rows; consumers share the uniform 10 ms. Queues › Limits ties consumers to the same per-invocation model rather than a bespoke one | PARTIALLY (paid: yes; free: explicit same-model statement) |
| 14 | `limits.cpu_ms`? | Wrangler `limits.cpu_ms` = max CPU per invocation (ms). Supported only on Standard (paid) usage model; max 300,000 ms; applies to the Worker's invocations including queue-handler invocations (Queues › Limits shows it for consumers). Free plan: not supported — 10 ms fixed | Yes (paid); Free: NO |
| 15 | Docs support "Tree-sitter/WASM unsafe on Free"? | Docs state parsing-heavy workloads "typically use 10-20 ms" (above the Free budget), that consistent over-limit execution is terminated (1102), that WASM runs in the same V8 isolate, and that unacked batches retry then DLQ. The conclusion for a specific parse workload is an engineering inference from these primitives — the mechanism is documented, the outcome for Tree-sitter specifically is not benchmarked by Cloudflare | MECHANISM CONFIRMED; workload-specific conclusion = inference |

---

## 8. T007 gate evidence (what RepoAtlas actually needs)

**X = applicable CPU limit for a Free-plan Queue Consumer:** **10 ms of CPU time per invocation** (Workers › Pricing "10 milliseconds of CPU time per invocation"; Workers › Limits "CPU time: 10 ms"; scoped to consumers by Queues › Limits "share the same per invocation CPU limits as any Workers do"; fixed — `limits.cpu_ms` is Standard-plan only).

**Y = accounting model:** **CPU time = active execution** (JS and — behaviorally — WASM) **metered per invocation**, where one consumer invocation = **one queue-handler call processing one MessageBatch** (max 100 messages, default 10; batch assembled by `max_batch_size`/`max_batch_timeout`, whichever first). I/O wait (R2 fetches, D1 queries, fetch()) does not count. Wall-clock is separately capped at 15 min per invocation. Enforcement is a per-isolate budget with rollover tolerance for occasional overshoot; sustained over-limit use terminates the invocation (1102/`exceededCpu`) and the un-acked batch is re-delivered (all-or-nothing by default; `ack()` per message narrows the blast radius; `max_retries` default 3 → DLQ/delete).

**Implication chain for the Engineering Relationship Graph pipeline (objective, from docs):**
- On the Free plan, batching does not multiply the CPU budget — a 100-message batch still gets 10 ms total CPU. Tree-sitter WASM parsing of non-trivial source files typically exceeds 10 ms of active CPU per file (docs' own guidance: heavy parsing "typically uses 10-20 ms"), so a Free-plan consumer processing even one file per message can be killed, and whole unacked batches will re-queue.
- Documented options that change the CPU budget per invocation, without changing the queue architecture: (a) Workers Standard (paid) — default 30 s, configurable up to 5 min per consumer invocation (pricing page lists a 15-min ceiling for consumer invocations); (b) per-message `ack()` to prevent whole-batch retries; (c) offload of the CPU-heavy parse (docs suggest Durable Objects or smaller chunks across invocations — Workers › Limits "Offload work"); (d) Workflows steps (Free 10 ms; Standard 30 s default / configurable to 5 min active CPU per step, unlimited wall time).
- Open items to verify before committing: whether Free-plan consumer invocations draw from the 100,000 requests/day pool; actual CPU cost per file of the chosen Tree-sitter WASM bundle (measure via Workers Logs invocation-log CPU time on any plan); paid-plan ceiling inconsistency (5 min vs 15 min) if Standard is adopted.

---

## 9. Source-class labels used

- **Official docs (first-party):** verbatim quotes from developers.cloudflare.com — authoritative for limits.
- **Cloudflare staff (community transcripts):** Discord/forum answers — authoritative for undocumented runtime mechanics (rollover bank), not contractual.
- **Third-party measurements/blogs:** labeled as such; used only for enforcement behavior, never for limit values.