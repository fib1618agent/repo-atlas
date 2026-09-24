# Cloudflare Queue / Workers CPU Model — Research Report

**Status**: Research only. No production source, Feature 002/004 spec, plan, task, or contract changed. No deploy, push, Wrangler, or remote Cloudflare resource access (only public documentation pages were read). T007 remains STOPPED.

**Method and source caveat**: Cloudflare behavior below comes only from official pages on `developers.cloudflare.com`, read during this session with a fetch tool that returns a model-processed extract of each page, not raw HTML. Where a page was fetched twice to check exact wording, the second (verbatim-requested) extract is used. Statements the fetch tool added as its own inference (not quoted from the page) are marked **[tool inference]** and are not treated as verified. A few search-snippet-only statements are marked **[snippet]**. Doc contents can change; this report records what the pages said when read.

---

## 1. VERIFIED FACTS (official Cloudflare documentation)

| # | Page (title) — URL | Section | What it explicitly establishes |
|---|---|---|---|
| F1 | "Limits" (Workers) — https://developers.cloudflare.com/workers/platform/limits/ | CPU time (table) | CPU time per HTTP request: Workers Free **10 ms**, Workers Paid 5 min (default 30 s). CPU time per Cron Trigger: Free **10 ms**; Paid 30 s (< 1 h interval) / 15 min (>= 1 h). **The table has no Queue-consumer row.** |
| F2 | same | CPU time (definition) | "CPU time measures how long the CPU spends executing your Worker code. Waiting on network requests (such as `fetch()` calls, KV reads, or database queries) does **not** count toward CPU time." |
| F3 | same | CPU time (isolate note) | "Each isolate has some built-in flexibility to allow for cases where your Worker infrequently runs over the configured limit. If your Worker starts hitting the limit **consistently**, its execution will be terminated according to the limit configured." |
| F4 | same | CPU time (configuration) | Paid-plan users can raise the limit with `limits.cpu_ms` in Wrangler config (example `300000`; default `30000`). The extract described this as a Workers Paid setting. |
| F5 | same | CPU time (typical usage) | "The average Worker uses approximately 2.2 ms per request"; heavier work (auth, SSR, parsing large payloads) "typically use[s] 10-20 ms." |
| F6 | same | Wall time limits by invocation type | **Queue consumers: 15 minutes** wall time per consumer invocation (also Cron 15 min, DO alarms 15 min, HTTP unlimited). This is wall time, not CPU time. |
| F7 | same | Worker startup time | "A Worker must parse and execute its global scope (top-level code outside of handlers) within **1 second**." |
| F8 | same | Memory | 128 MB per isolate, including JS heap and WebAssembly allocations; "per-isolate, not per-invocation." |
| F9 | "Errors and exceptions" — https://developers.cloudflare.com/workers/observability/errors/ | Error 10021 "Script startup exceeded CPU time limit" | Doing work in top-level scope that takes more than the startup limit (1 s) of CPU time triggers this error. |
| F10 | "Pricing" (Workers) — https://developers.cloudflare.com/workers/platform/pricing/ | Workers table | Free: "10 milliseconds of CPU time per invocation." Standard/Paid: "Max of 15 minutes of CPU time per invocation (default: 30 seconds)" and, separately, "Max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation." |
| F11 | "Limits" (Queues) — https://developers.cloudflare.com/queues/platform/limits/ | Limits table + applicability note | Note: the listed limits "apply to both Workers Paid and Workers Free plans with the exception of Message Retention." Rows: max consumer batch size **100 messages**; concurrent consumer invocations **250** (push-based only); consumer duration (wall clock) **15 minutes**; **"Consumer CPU time: Configurable to 5 minutes"** (footnote 5: "Refer to Workers limits", linking `#cpu-time`); max batch wait 60 s; per-queue throughput 5,000 msg/s; message retries 100. |
| F12 | "Batching, Retries and Delays" (Queues) — https://developers.cloudflare.com/queues/configuration/batching-retries/ | Batching | `max_batch_size` default 10; `max_batch_timeout` default 5 s; whichever is reached first triggers delivery. The consumer `queue(batch, env, ctx)` handler receives **one invocation containing multiple messages**, iterated via `batch.messages`. |
| F13 | same | Retries | Each message can be individually acknowledged, avoiding whole-batch redelivery. "When a single message within a batch fails to be delivered, the entire batch is retried, unless you have explicitly acknowledged a message (or messages) within that batch." Per-message `ack()`/`retry()` take precedence over `ackAll()`/`retryAll()`. |
| F14 | same | (absence) | The page does **not** discuss CPU or duration implications of batch size. |
| F15 | "Consumer concurrency" (Queues) — https://developers.cloudflare.com/queues/configuration/consumer-concurrency/ | How concurrency works | Concurrent consumer count autoscales on backlog size/growth, ratio of failed invocations, and `max_concurrency` (1-250; enabled by default). "Queues checks if it should autoscale consumers only after processing an entire batch of messages, so it will not autoscale while a batch is being processed. Consider reducing batch sizes or refactoring your consumer to process messages faster." "When multiple consumer Workers are invoked, each Worker invocation incurs CPU time costs." |
| F16 | same | (absence) | The page does **not** say whether concurrent invocations use separate, reused, or new isolates. |
| F17 | "Pricing" (Queues) — https://developers.cloudflare.com/queues/platform/pricing/ | Operations | Free plan: 10,000 operations/day. "An operation is counted for each 64 KB of data that is written, read, or deleted." "Operations are per message, not per batch." A default batch of 10 messages incurs 10 writes + 10 reads + 10 deletes. |
| F18 | "How Queues works" — https://developers.cloudflare.com/queues/reference/how-queues-works/ | Consumers | Consumers are push-based: "the Worker is invoked when the queue has messages to deliver"; each invocation receives a `MessageBatch`. The page does not address isolate reuse or concurrency mechanics. |
| F19 | "How Workers works" — https://developers.cloudflare.com/workers/reference/how-workers-works/ | Isolates; Distributed execution | Isolates start on demand and "may be spun down and evicted for a number of reasons" (resource limits, suspicious script, individual limits). "It is generally advised that you not store mutable state in your global scope unless you have accounted for this contingency." Recommends not relying on global state because there is "no guarantee that any two user requests will be routed to the same or a different instance." |
| F20 | "Wasm in JavaScript" — https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/ | Instantiation; imports | Instantiation "should be done at the top level of the script to avoid instantiation on every request." Modules are imported statically (`import mod from './simple.wasm'`) and Wrangler bundles modules ending in `.wasm` / `.wasm?module`. The page does **not** mention the "Wasm code generation disallowed by embedder" restriction. |

**Documentation inconsistency (not ours) — Queue-consumer CPU limit.** Three official pages say three different things and none states the Free-plan queue-consumer CPU limit explicitly:
- Workers "Limits" (F1): CPU table lists HTTP and Cron only; queue consumers appear only in the wall-time table (F6).
- Workers "Pricing" (F10): Paid tier "Max of 15 minutes of CPU time per ... Queue Consumer invocation."
- Queues "Limits" (F11): "Consumer CPU time: Configurable to 5 minutes", and an applicability note that the limits apply to Free and Paid.
Read literally together: Free = 10 ms per invocation (F10) in general, but F11 says its CPU row applies to Free too and F4 describes the CPU setting as a Paid capability. The documentation does not reconcile these. **[tool inference, not verified]**: the fetch tool stated F11's CPU-time configurability carries "no plan-only restriction"; that sentence was the tool's own reading, not a quote.

---

## 2. REPOATLAS CURRENT BEHAVIOR (repository code and Feature 002/004 artifacts)

- **Queue config** (`wrangler.toml`): both existing consumers set `max_batch_size = 10`, `max_retries = 5`. No `[limits]` / `limits.cpu_ms` setting anywhere (grep of `wrangler.toml`, `nitro.config.ts`, `vite.config.ts` found none), so the account's default CPU model applies.
- **Messages per invocation**: `plugins/cloudflare-symbol-queue.ts` handles the `cloudflare:queue` hook with `for (const message of batch.messages) { await processSymbolQueueMessage(...); message.ack() | message.retry() }` — all messages of one delivered batch run sequentially inside one hook call (one Cloudflare consumer invocation, per F12), acked individually.
- **Files per message**: `processSymbolQueueMessage` (`symbols/symbol-worker.ts`, loop at line 115) processes `listSnapshotFilesPage(..., config.extractionBatchSize, ...)` files sequentially per message; `CODE_INTEL_EXTRACTION_BATCH_SIZE = 50` (`config.ts:10`). One message = one "unit" = up to 50 snapshot files (skipped non-Tier-1 files are cheap; only Tier-1 files parse). After a unit it enqueues the next unit.
- **So the nesting is**: 1 invocation = up to 10 messages (repo config) x up to 50 files/message = up to 500 files per invocation in the worst configured case; the queue max batch is 100 (F11), the repo uses 10.
- **Isolate/WASM initialization** (`symbols/grammar-provider.ts`): grammar and core WASM come from build-time `?module` imports (consistent with F20's bundling model). But `Parser.init`, `Language.load`, and `new Parser()` run **lazily inside the first `getParser()` call** (module-level `initPromise`/`languageCache`/`parserCache`), i.e. inside the first request that needs them, not at top-level script scope. Compiled Query objects are memoized module-level in `to-intermediate-representation.ts` (`WeakMap<Language, Map<querySource, Query>>`), also lazy.
- **Feature 004 plan/research** (`plan.md`, `research.md` §1): `parsed` unit = one file per unit, explicitly modeled as "the same per-invocation shape empirically proven safe by Feature 002." Feature 004's consumer (T011) is planned as a third queue plugin (`plugins/cloudflare-relationship-queue.ts`, filtering on `batch.queue`) mirroring the existing plugins; T011 does not spell out the per-message loop, but mirroring the existing plugins implies the same one-handler-call-per-batch shape (inference, not stated).
- **Live validation history** (`specs/002.../tasks.md` T068, PROGRESS.md, audit log): 5 real snapshots (small public repos, e.g. `sindresorhus/is-obj`, `pify`, `is-plain-obj`, a Java hello-world, a Vite TSX boilerplate); 33 Tier-1 files `extracted`, 65 skipped non-Tier-1, **0 `failed`**, 77 symbols; per-file sizes not recorded; **no CPU-time measurement was captured** from the live runs (research.md §1 itself flags "never measured/logged" as a Medium-confidence gap).
- **Earlier Feature 004 reasoning** (`research.md` §1) leaned on F3 ("built-in flexibility ... infrequently") as the explanation for why Feature 002's live run succeeded.

---

## 3. LOCAL EXPERIMENTAL EVIDENCE (already performed; local wall-clock only, not Cloudflare CPU-ms)

Sources: `specs/004-engineering-relationship-graph/{feasibility-results,cpu-decomposition-results,single-pass-spike-results,combined-single-pass-decomposition-results}.md`, `specs/002-ast-symbol-intelligence/query-cold-start-results.md`, and the investigation docs under `docs/investigations/`.

- Real repo-atlas TS/TSX files (374-745 lines): before the query cache, single-pass parse+symbols+relationship-observation medians were 6.7-8.8 ms; after the query cache (warm) 1.8-3.7 ms. Two of four real files remained "borderline" (p95) after the cache.
- Fresh-process cold first file: TS/TSX ≈ 22-23 ms parse+extraction plus ≈ 4.7 ms grammar/parser init; Java/JS ≈ 8 ms plus ≈ 4.4 ms init. Cold Query compile ≈ 12.8-13.2 ms (TS/TSX), ≈ 3.3-4.4 ms (Java/JS).
- Warm per-file (100-file runs): median ≈ 0.8-1.5 ms/file, p95 ≈ 1.7-3.9 ms (files of ~150-750 lines).
- `computeSymbolKey` ≈ 0 ms; core runtime init ≈ 3.6-4.4 ms; grammar load ≈ 0.35-0.64 ms/language.
- The local numbers used repo-atlas's own files and synthetic ~150-2500-line fixtures. Production validation used tiny public packages. Example: local warm cost for the 40-line real `eslint.config.js` was ≈ 0.13 ms.

---

## 4. INFERENCES

1. **Batch, messages-per-invocation, and files-per-message are three distinct quantities with different CPU consequences**, but only the first two are Cloudflare concepts.
   - *Queue max batch size / `max_batch_size`* (F11/F12) sets how many messages one consumer invocation receives. Because F1/F10 express CPU limits per invocation and F12 states one invocation holds the whole batch, a larger batch means more work sharing one invocation's CPU budget. The docs never state the batch-size/CPU relationship (F14); this is an inference from "per invocation" wording.
   - *Messages per invocation* in this repo equals the delivered batch size (≤ 10), because the plugin loops the whole batch in one handler call. It also affects retry granularity (F13): an unacked failure retries the batch's unacked messages, and RepoAtlas acks each message individually.
   - *Files per message* (`extractionBatchSize`, 50) is purely RepoAtlas design. It multiplies work inside a single message and therefore inside the same invocation; Cloudflare's docs are silent on it. It is the largest CPU multiplier in the current design (up to 500 files/invocation in the worst configured case).
   - *Operations/day* (F17) counts per message, not per invocation or batch, so batch size changes CPU-per-invocation but not the daily operation count for the same number of messages. Files-per-message reduces message count (fewer queue operations) at the cost of more CPU per invocation. This is a real tension for Free-plan budgeting.
2. **Whether "up to 50 files in one invocation, local aggregate > 10 ms" conflicts with the documented CPU model is not settled by the documentation.**
   - *Cloudflare documentation states* CPU is limited per invocation (Free 10 ms, F10), that queue consumers' invocations are limited by wall time 15 min (F6), and that infrequent overruns are tolerated while consistent overruns are terminated (F3).
   - *Our local observation was* that a batch of tens of parsed files could sum to well over 10 ms of local wall-clock, yet the live runs recorded zero failures.
   - **Unresolved** — no page establishes the Free-plan CPU limit for a queue consumer invocation (see the doc inconsistency above), and no CPU time was captured live. Three explanations remain open and cannot be ranked from evidence: (a) the Free 10 ms per-invocation limit does apply and the live files were small enough (tiny packages, mostly skipped files) not to exceed it consistently — no conflict at all; (b) the F3 tolerance masked infrequent overruns in only 5 runs; (c) queue consumers on this account have a different effective CPU limit than the Free HTTP table (per F10/F11 wording). Local wall-clock is also not equal to Cloudflare CPU time (WASM tiering, CPU vs wall accounting), and F2 excludes I/O wait, which local numbers include only for the D1-free measurement scripts.
3. **The earlier "5-minute" / "15-minute" queue CPU statements should not be relied on for this account**: F10/F11 describe Paid or configurable limits, and F4 describes configuration as a Paid capability; the repo sets no `cpu_ms`.
4. **Isolate reuse is not something Cloudflare promises** (F19), and the queue docs do not address it (F16, F18). The repo's per-isolate caches (`parserCache`, `languageCache`, compiled-Query cache) are therefore an optimization, not a guarantee; correctness never depends on them, but cost-per-invocation planning cannot assume them warm. Within one invocation, though, the batch loop necessarily reuses them across all messages/files, so cold cost is paid at most once per invocation, not per file.
5. **Global-scope initialization**: F7/F9 establish a separate 1 s CPU startup limit for top-level code, and F20 recommends top-level Wasm instantiation. They do not say that global-scope CPU is excluded from a request's CPU budget, nor whether Tree-sitter's asynchronous `Parser.init` / `Language.load` may run at top level (those are Promises; the fetched pages do not address async work in global scope). Whether module-level eager initialization would move cold cost out of the per-invocation budget is therefore **unresolved by documentation**.
6. **F20's "top-level instantiation" advice and RepoAtlas's lazy in-handler initialization differ**: the repo pays instantiation inside the first invocation's CPU. Whether that is a defect or a necessity (async init, module constraints) is not established.

---

## 5. UNRESOLVED QUESTIONS

1. What CPU limit applies to a queue consumer invocation on **Workers Free**? (F1 omits it; F10 general Free statement says 10 ms/invocation; F11 says "Configurable to 5 minutes" for both plans; F10 Paid says 15 min. Not reconciled by the docs.)
2. Does the CPU limit apply to the whole `queue()` handler invocation (the batch) or per message? (Documentation says "per invocation"; does not say per-message; F14 confirms no batch-size/CPU guidance.)
3. What exactly is "consistently" in F3 (frequency/threshold) — not defined.
4. Is CPU spent in top-level/global scope counted against an invocation's CPU budget, or only against the separate 1 s startup limit (F7/F9)? Not stated.
5. Can asynchronous Wasm/Tree-sitter initialization run at global scope in Workers? Not addressed by the pages read.
6. Do consecutive queue-consumer invocations reuse an isolate? (F16/F18/F19 — not guaranteed or documented.)
7. How much CPU did Feature 002's live invocations actually use? Never captured. Whether Workers observability/log fields expose per-invocation CPU time for queue consumers was not investigated here.
8. Does the tool-summarized reading of the Queues "Configurable to 5 minutes" row ("no plan-only restriction") match the raw page? Only a raw-page read can confirm.

---

## 6. ARCHITECTURAL IMPLICATIONS

- **Feature 002**: Already batches (50 files/message, up to 10 messages/invocation) and is live-validated only on tiny inputs with no CPU measurement. The documentation neither validates nor invalidates that shape for Free. Note that the local cold/warm numbers indicate it would exceed 10 ms of local time on batches of realistic-size files; whether that matters on Cloudflare depends on unresolved questions 1-3. No Feature 002 change is justified by documentation alone.
- **Feature 004**: Its "one file per unit" premise is justified in `research.md` by Feature 002's live success and F3's tolerance; both rest on unmeasured CPU. The unit-size decision cannot be closed by documentation; the plugin pattern still processes up to `max_batch_size` units per invocation, so "one file per unit" is not "one file per invocation" unless the batch size is 1. Batch size and files-per-message are the real CPU levers, and the docs do not describe their CPU effect.
- **Queue batching**: `max_batch_size` (currently 10) directly scales files per invocation; docs say autoscaling only reacts after a whole batch finishes (F15) and advise smaller batches for slow consumers. Reducing it costs no extra queue operations per message (F17: per-message counting) but increases invocation count; the Free-plan limits on invocation count for consumers were not found in the pages read.
- **Isolate reuse**: not guaranteed (F19). Cold-start costs (≈ 26-28 ms local for the first TS/TSX file) should be treated as potentially paid on any invocation.
- **Tree-sitter initialization**: F20 favors top-level instantiation; repo initializes lazily and asynchronously. Moving it is a design change with unresolved feasibility (open question 5) — not adopted or recommended here.
- **Query caching**: correct and beneficial regardless (amortizes within an invocation and across warm invocations); cannot help a truly cold invocation.
- **T007**: see below.

---

## 7. T007 ASSESSMENT

**Recommendation: keep T007 STOPPED. Do not redefine the gate yet.**

Reasoning: the gate's premise ("10 ms per invocation, one file per unit") depends on (a) the actual CPU limit for a Free-plan queue consumer, which official pages do not state consistently, and (b) how much CPU real invocations consume, which nobody has measured. Local numbers cannot settle either. Redefining the gate now would encode an unverified limit; clearing it would be unsupported. The documentation research has narrowed the uncertainty (batch/message/file semantics are now well defined; per-invocation CPU on Free queue consumers is the remaining hinge) but has not removed it.

**Next step**: proceed to **one further controlled experiment**, not an implementation — a measurement of real per-invocation CPU time for Feature 002's already-deployed queue consumer.

---

## Executive summary

- Cloudflare documents CPU limits per invocation (Free: 10 ms), excluding I/O wait, with tolerance for infrequent overruns and termination for consistent ones. A queue consumer invocation receives one batch of messages (repo config: ≤ 10). Queue operations are counted per message.
- The docs give **inconsistent or missing** statements for the Free-plan CPU limit of a queue consumer (three pages, three different statements). It is unresolved.
- RepoAtlas nests up to 10 messages x 50 files per invocation. Local warm cost ≈ 1-1.5 ms/file makes an aggregate above 10 ms plausible, but whether that "conflicts" with Cloudflare's model is **not established**: live validation used tiny files and captured no CPU numbers, and the docs neither confirm nor rule out the tolerance explanation.
- Batch size, messages per invocation, and files per message are three distinct levers; only the first two are Cloudflare concepts and the docs are silent on their CPU effect. Files per message is the biggest multiplier and is purely a RepoAtlas choice.
- Isolate reuse is not guaranteed by docs; caches are an optimization only.

**Exact recommendation for the next step**: keep T007 stopped and authorize (or decline) a **single, tightly scoped live measurement** of Feature 002's existing consumer — draft the protocol first (which snapshot, which observability fields, which single batch) for your explicit approval before anything is run. Before that, do a cheap offline check of whether Cloudflare documents a per-invocation CPU-time field for queue consumers in Workers observability/logs, so the live run captures the right number. No mitigation, code change, or spec change should precede that data.
