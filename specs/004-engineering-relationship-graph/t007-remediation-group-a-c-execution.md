# T007 Remediation — Group A/C Execution: RT-02, RT-05, RT-15

**Feature**: 004 · **Authorization**: Group A (RT-02, RT-05) and Group C-prep (RT-15) only, per the owner's explicit task-level authorization. **Group B (RT-09/RT-10) and Group D (K.4/G8) are NOT authorized and NOT touched by this document.** SpecKit stage: ANALYSE→RESEARCH already done at the planning checkpoint (`t007-remediation-speckit-plan.md`) and extended here with new source research specific to RT-02; this document is the SPECIFY-level output for the three authorized tasks. **No implementation. No benchmark. No production code, `src/`, `tests/`, schema, config, dataset, evidence JSON, or reference-repo change. No F002 file touched.** T008 remains blocked; nothing here authorizes it.

---

## RT-02 — Stable symbol identity (SYM-01 design)

### New research this task required (beyond the planning checkpoint's research), reading actual F002 source

- **F002 already computes a snapshot-scoped, deterministic, row-id-independent symbol identity**: `src/lib/code-intel/symbols/symbol-identity.ts`, `computeSymbolKey(snapshotId, filePath, kind, qualifiedNameOrName, startLine, startColumn)` → `SHA-256("${snapshotId} ${filePath} ${kind} ${qualifiedNameOrName} ${startLine} ${startColumn}")`. This is F002's existing `symbol_key` — persisted as a column on `symbols` (confirmed at `src/lib/code-intel/persistence/symbol-d1-client.ts:190`, in the `INSERT INTO symbols (…, symbol_key, …)` column list) and **already deterministic across redelivery** (same file content, same snapshot → same key, independent of the row's SQLite `id`).
- **The T007 harness's own resolver already reads and carries this value, but discards it before persistence.** `scripts/t007-local/lib/unit.ts:338` selects `symbol_key AS key` alongside `id` into `symByStart`. `scripts/t007-local/lib/rel.ts` constructs every symbol-kind `Endpoint` with **both** fields — `{ kind: "symbol", id: c.id, ref: c.key }` (line 349), `{ kind: "symbol", id: srcSym.id, ref: srcSym.key }` (line 387), and two more sites (588, 594) — but `persistRows` (line 481) only writes `source_id`/`target_id` from `Endpoint.id` (the volatile row id); `Endpoint.ref` (the already-stable `symbol_key`) is computed, carried through the whole resolution pipeline, and then **dropped** at the last step.
- **The relationships table's `source_id`/`target_id` columns are F004-owned, `INTEGER`-typed** (`specs/004-engineering-relationship-graph/contracts/d1-schema-additions.sql:13,15`) — this schema belongs entirely to Feature 004, not Feature 002.

**This changes the framing of the whole problem**: F-4's symbols-stage redelivery break is **not** caused by a missing identity concept in F002 — F002 already has exactly the identity F004 needs, and F004's own resolver already computes it. **The break is caused by F004's own persistence layer choosing to store the volatile row id instead of the already-available stable key.** This is a strictly better finding than the planning checkpoint assumed (which treated "does a stable key exist" as an open design question) — it is not a design question, it is a **wiring bug in the T007 harness / F004 persistence layer**, fixable entirely within F004 as D1 already required, with **zero need to touch F002 in any way.**

### 1. Exact proposed stable-key formula

**Reuse F002's existing `symbol_key` verbatim — do not invent a new key.** For a symbol-kind relationship endpoint, the persisted identity is `symbols.symbol_key` (already computed by `computeSymbolKey`), not `symbols.id`.

### 2. Canonical input fields

Unchanged from F002's existing five inputs: `snapshotId`, `filePath`, `kind`, `qualifiedNameOrName`, `startLine`, `startColumn`. No new field is introduced.

### 3. Normalization rules

None beyond what F002 already applies — exact field order, single-space separators, no case-folding, no path normalization beyond whatever `filePath` already receives upstream. Inherited unchanged; this task proposes no change to `computeSymbolKey` itself.

### 4. Collision analysis

- **Overload/collision risk**: two symbols with the same `kind`+`qualifiedNameOrName` at the same `startLine`/`startColumn` would collide — this is an **existing F002 risk**, not introduced or worsened by reusing the key in F004. In practice this requires two distinct AST nodes to report the identical start position, which the grammar/query design would need to produce; not observed in any T007 evidence (0 duplicate `symbol_key` values in any measured graph, including GitNexus's 12,660 symbols).
- **Generated code** (iata-one-order's JAXB classes): no additional collision risk — `filePath` already disambiguates per-file, and generated getter/setter/builder methods still get distinct `startLine`/`startColumn` per occurrence.
- **Duplicate names across files**: fully disambiguated by `filePath` (and `snapshotId`) already being part of the key.
- **Nested symbols**: each symbol's `symbolKey` is computed independently in `to-intermediate-representation.ts`'s pass 1 (before `parentSymbolKey` is resolved in pass 2), so nesting depth does not affect key collision risk.
- **Anonymous/unnamed constructs**: `qualifiedNameOrName` for an anonymous construct is whatever F002's IR assigns it (a synthesized name or empty string) — an existing F002 behavior, unchanged and out of this task's scope to alter.
- **Redelivery / determinism across repeated extraction**: this is exactly the property `computeSymbolKey` is designed for — confirmed by its own doc comment ("Deterministic snapshot-scoped symbol identity") and by the fact that no measurement in this entire T007 evidence set ever found two different `symbol_key` values for what should be the same symbol.
- **Compatibility with existing persisted symbols/relationships**: see migration implications (§6).

### 5. Examples

Using real evidence from this session's own measurements (illustrative, not exhaustive): for `repo-atlas` snapshot id `N`, file `src/lib/atlas-config.ts`, a function symbol named `parseAtlasLimit` starting at line 12, column 0 — `symbol_key = SHA256("N src/lib/atlas-config.ts function parseAtlasLimit 12 0")`. Redelivering the same file at the same snapshot (unchanged content) recomputes the **identical** hex string, regardless of what integer row `id` the reinsert happens to receive.

### 6. Migration implications

**Recommended: additive, not a breaking schema change.** Add a new column pair to F004's `relationships` schema — e.g. `source_symbol_key TEXT`, `target_symbol_key TEXT` (nullable, populated only for `source_kind='symbol'`/`target_kind='symbol'` rows) — rather than changing `source_id`/`target_id`'s existing `INTEGER` type. At persist time, `persistRows` writes both the current `id` (for fast joins against today's schema/indexes, unaffected) and the stable `symbol_key` (for identity-safe re-linking after redelivery). At resolve/read time after a redelivery, a lookup by `(snapshot_id, symbol_key)` against the current `symbols` table (already indexed via `idx_symbols_snapshot_name` per M-L3's characterization, though a key-specific index may be needed — see acceptance criteria) recovers the *current* row id, and a repair step can rewrite stale `source_id`/`target_id` values to match. **This is additive and requires no backfill of historical data for correctness going forward** (existing rows without the new key populated simply aren't repairable retroactively, but nothing currently in production depends on this — T007 is pre-implementation). A full replacement of `source_id`/`target_id` with the key (dropping the integer entirely) is a larger, riskier alternative **not recommended** for the first remediation pass, since it touches every existing index and join shape characterized by M-L3.

### 7. Impact on existing F002 contracts

**None.** F002's `symbol_key`, `computeSymbolKey`, and the `symbols` table schema are unchanged by this proposal. F004 only starts *persisting a value F002 already computes and F004's own resolver already reads* — no new F002 output, no new F002 read pattern, no F002 file touched.

### 8. Proof that the first implementation can remain entirely within F004

Every file this proposal touches is F004-owned: `specs/004-engineering-relationship-graph/contracts/d1-schema-additions.sql` (the new columns), `scripts/t007-local/lib/rel.ts` (`persistRows`, to write the new columns from the already-existing `Endpoint.ref` field — no new computation needed there either), and a new repair/re-link step in `scripts/t007-local/lib/unit.ts`'s `runSymbols` redelivery path. **Zero files under `src/lib/code-intel/symbols/` or any other F002 path are touched.** This is not an assertion — it is confirmed by having read every function in the chain (`computeSymbolKey` → `to-intermediate-representation.ts` → `symbol-d1-client.ts` → `unit.ts` → `rel.ts`) this pass and finding the stable value already flows all the way to `rel.ts`'s `Endpoint.ref` before being dropped.

### 9. Acceptance criteria for SYM-01

Re-run F-4's symbols-stage redelivery scenario against the implemented fix: **0 dangling relationship endpoints** (vs. the 36 originally found); the resulting graph hash equals the clean reference hash (`616ca53f21ca…` for R-M); a new invariant check confirms every `source_symbol_key`/`target_symbol_key`-bearing row resolves to a symbol that currently exists in `symbols` for that snapshot. (SYM-02's crash-reclaim acceptance criteria are unrelated to this key design and are unchanged from the original Phase 3 specification — not restated here.)

### 10. Hard-stop condition — explicitly evaluated, NOT triggered

The owner's directive required an immediate STOP if F002's existing schema proves insufficient to represent the needed stable identity. **This did not occur.** F002's `symbol_key` is exactly sufficient — deterministic, already computed, already persisted, already read by the T007 resolver. The only insufficiency found is in **F004's own** `relationships` schema (storing only the volatile `INTEGER` row id), which F004 already owns and can amend without any F002 involvement or cross-feature escalation. **No F002/F004 cross-feature amendment is required for RT-02.**

---

## RT-05 — G3 contract amendments (drafted; not applied to `contracts/local-job-engine.md`)

Each item below is proposed contract text plus its acceptance criteria. **None of this is written into the actual contract file in this pass.**

### 1. CANCELLED (terminal state)

> **Guarantee 2a (proposed addition)**: A snapshot-level cancel operation transitions every job in that snapshot currently in PENDING, RETRYING, or PAUSED state to **CANCELLED** — a terminal state distinct from FAILED, carrying no retryability. A job already CLAIMED or RUNNING at cancel time is unaffected by this transition; it continues to COMPLETED, FAILED, or SKIPPED normally (cancel does not interrupt in-flight work).

**Acceptance criteria**: re-run F-5's cancel-halt scenario against an implementation of this state; unclaimed jobs land in CANCELLED (not the current FAILED('cancelled') workaround); RUNNING units still finish/checkpoint exactly as today's evidence already shows; snapshot rollup reports a new terminal status reflecting CANCELLED jobs distinctly from FAILED ones.

### 2. PAUSED (persisted eighth state)

> **State model (proposed addition)**: PAUSED is an eighth job state. **Meaning**: a job held back from claiming because its snapshot is paused. **Valid transitions in**: PENDING → PAUSED only. **Valid transitions out**: PAUSED → PENDING (on resume). **Interaction with cancel()**: PAUSED → CANCELLED (extends item 1's cancel transition to include PAUSED jobs). **No RUNNING → PAUSED and no CLAIMED → PAUSED** — pause never interrupts in-flight work. **Leases**: a PAUSED job holds no lease (only unclaimed PENDING jobs can become PAUSED). **Retry/reclaim interaction**: RETRYING jobs are not moved to PAUSED; the existing pause-flag check inside `claim()` already prevents a RETRYING job's scheduled retry from being claimed while paused, which is sufficient — RETRYING jobs stay RETRYING. **`cancelHalt()` interaction**: unaffected — `cancelHalt` is a claim-stopping flag only and rewrites no job rows regardless of state, PAUSED included. **Terminal/non-terminal**: **non-terminal** — PAUSED always resolves onward to PENDING (resume) or CANCELLED (cancel), never a final resting state. **Persistence**: PAUSED MUST be a value in the job row's own `state` column, durable across process restart — not represented solely by a separate control-table flag the way today's harness implements pause/resume.

**Acceptance criteria**: a pause operation moves every currently-PENDING job of the target snapshot to PAUSED (verified by row count before/after); a resume operation moves every PAUSED job back to PENDING; no RUNNING/CLAIMED job is ever observed transitioning to or through PAUSED in any test; the snapshot's lifecycle projection (guarantee 7) correctly reports PAUSED using only job-state counts, once PAUSED jobs exist as real rows (closing the "extra bookkeeping" contradiction the S-L1 finding originally raised).

### 3, 4, 5. Lease, retry, and backoff defaults — contract text and the harness/contract discrepancy found this pass

> **Guarantee 1 (proposed clarifying amendment)**: the contract SHALL name default lease, max-attempts, and backoff-base values. Implementations MAY override these via configuration; the contract's stated defaults are the values validated by this project's own failure-injection evidence, not an arbitrary or invented number.

**New research finding this pass, distinguishing contract defaults from implementation tuning exactly as instructed**: the harness's `DEFAULT_POLICY` constant (`scripts/t007-local/lib/jobs.ts:41-45`) is `{ leaseMs: 30_000, maxAttempts: 3, backoffBaseMs: 25 }` — but **this 30-second lease value was never actually exercised by any F-1/F-1c/F-3/F-4e-control test in this evidence set.** Every one of those tests explicitly overrode the lease to **1500 ms** (`scripts/t007-local/m-l4-failures-c.ts:599,666,689` and the M-L4 F-4e-control evidence, `m-l4-f4e-control-lease1500.json`), which is the value that actually produced the 56/56 clean F-1/F-1c results and the 5/5 clean F-4e-control results. **Proposed contract default lease: 1500 ms (1.5 s), not 30,000 ms** — the number that is actually backed by measurement, not the harness's separate, untested constant. `maxAttempts: 3` and `backoffBaseMs: 25` (exponential, `backoffBaseMs * 2^(attempts-1)`) **are** the values F-3's 24-retries-for-20-injected-units evidence actually exercised, and are proposed unchanged.

**Explicit distinction, as instructed**: these are proposed **contract defaults grounded in what was actually measured**, not newly invented performance thresholds — no new number is proposed that lacks a corresponding piece of T007 evidence behind it. The *numeric tuning* for a production deployment (e.g., whether 1.5 s is the right lease for production file sizes, which may run longer than any T007 fixture) remains an explicit T008-planning question, unchanged from the original ratification.

**Acceptance criteria**: contract text states these three numbers (or explicitly delegates to a named, versioned config surface carrying them); no new benchmark is required to accept this item, since the numbers are already backed by existing evidence — only the *documentation* is new.

### 6. F-4e lease-margin operating constraint

> **Operating note (proposed, non-normative — an interim measure, not a contract guarantee)**: until a fencing mechanism (a claim-generation token, rejecting a write from a superseded claim) is implemented, operators MUST configure the lease duration to exceed the realistic maximum unit duration by a comfortable margin. This project's own evidence: at a lease of 1500 ms, 0 divergence occurred in 5 runs under realistic unit durations, and 0 divergence occurred even when one real unit ran 13.3 s against a 1500 ms lease (a reclaim/duplicate execution did occur, but the final graph still matched the reference in 3/3 runs). **Divergence was observed only under an artificially short 2 ms lease** (`m-l4-f4e-graph-diff-vs-clean.json`) — an explicit, deliberate stress probe used to characterize the failure mode, never a realistic operating configuration, and this distinction is preserved here exactly as instructed.

**Acceptance criteria**: this is a documentation item; no new test is required, since the supporting evidence already exists (F-4e's own 1500 ms and 13.3 s-unit test results, already measured).

### 7. Crash-reclaim attempt semantics

> **Guarantee 1 (proposed clarifying amendment)**: `attempts` MUST be incremented on every reclaim of a stale CLAIMED/RUNNING job, not only on an explicit FAILED/RETRYING transition, so that a persistently-crashing unit is bounded by the same `maxAttempts` policy that governs explicit failures. Retry-exhaustion behavior (a job that reaches `maxAttempts` via reclaim-driven increments) MUST be explicit: the job transitions to FAILED with a typed error indicating exhaustion-via-reclaim, distinct from exhaustion via repeated explicit transient failures (for diagnostic clarity, not a different terminal state).

**Acceptance criteria**: a new crash-loop test (a unit injected to crash on every attempt) reaches FAILED after exactly `maxAttempts` reclaims, not unboundedly; the resulting `error` field distinguishes reclaim-driven exhaustion from explicit-failure-driven exhaustion.

---

## RT-15 — G9 criterion amendment (finalized wording, pending owner approval; NOT yet applied)

**CURRENT G9 STATUS = FAIL.** Unchanged by this task. This section proposes wording only.

**PROPOSED AMENDED CRITERION** (for `t007-local-feasibility-plan.md` §9's G9 row, to be applied as a **dated, additive amendment** once approved — the original frozen row is superseded, not silently overwritten, matching this repository's amendment convention):

> **G9 File-size evidence (amended).** Complete band table for **B1, B2, B3, B4, B5, B6, and the real minified-JS fixture** (§5.1) exists; default + ceiling recommendation derived from those bands; 512 KiB explicitly judged. **B7 and B8 are tracked separately as a non-blocking research item and are excluded from this criterion's completeness requirement**, because the adopted ceiling (≈512 KiB, B5) sits below the B7 threshold (4 MiB), and files above the adopted ceiling are already governed by the SKIPPED-with-structural-metadata policy (F-6, verified) regardless of their exact per-file cost. PASS = the B1–B6-plus-minified table is complete. FAIL = any of B1–B6 or the minified fixture is missing, or a default/ceiling is asserted without data from this region.

**RE-SCORING REQUIRED = RT-16.** This wording is a proposal for owner approval; it does not itself re-score G9. Once approved, RT-16 applies it to the existing (unchanged, un-rerun) B1–B6 + real-minified evidence, which is already complete (49/49 `OK` fixtures plus the real-minified fixture) — RT-16 would need no new measurement, only the application of the newly-approved wording to evidence that already exists.

**Review of all current G9 references, confirming the proposed wording does not alter registered gate semantics beyond the approved scope**: checked `t007-local-feasibility-plan.md:143` (the row being amended — direct target), `t007-local-feasibility-results.md:174` (a historical L13 record, correctly NOT re-scored by this proposal — evidence-discipline convention preserved, amendments are additive, not retroactive edits to prior records), `t007-local-gate-evaluation.md` Part A's G9 row (the L14 score — also a historical record, to be superseded only by RT-16's explicit re-score, not by this wording proposal alone), `checklists/t007-local-feasibility.md:11` (already correctly phrased "512 KiB judged from curves, never declared" — consistent with, and not contradicted by, this amendment). **No other document's G9-adjacent text needs to change for this proposal to be internally consistent.**

**ADR-001/`research.md` edits**: **not performed by RT-15**, exactly as instructed — RT-15's own task definition is scoped to the G9 criterion wording only; the separate, conditional ADR-001/D-ARCH-6 and `research.md:213` edits (FSIZE-02) remain a distinct, later Group C step, requiring the owner's separate acceptance of the 64 KiB/512 KiB values (already given per Decision D5) plus its own execution authorization (not given here — RT-15 is authorized, RT-17 is not).

---

## Validation

- **No production code changed** — confirmed; every file discussed in RT-02's research (`symbol-identity.ts`, `to-intermediate-representation.ts`, `symbol-d1-client.ts`) was read, not edited.
- **No benchmark executed** — confirmed; no `bun run-scale.ts`, `m-l4-*.ts`, or any harness script was invoked this pass.
- **No threshold changed** — confirmed; G3/G6/G9's registered [ENG]/criterion text is quoted, not altered, anywhere above (RT-15's proposal is a drafted amendment awaiting approval, not an applied change).
- **No dataset changed** — confirmed; no template DB, `dataset-inventory.json`, or scratch clone touched.
- **No evidence JSON changed** — confirmed.
- **No F002 schema changed** — confirmed; explicitly proven in RT-02 §8.
- **No G6 implementation performed** — confirmed; Group B (RT-09/RT-10) not touched.
- **No G8 work performed** — confirmed; Group D not touched.
- **G9 remains FAIL pending RT-16** — confirmed; stated explicitly in RT-15.
- **T008 remains blocked** — confirmed; nothing in this document authorizes it.

## New open questions discovered by this pass

1. **RT-02's migration path** (§6) proposes an *additive* column pair (`source_symbol_key`/`target_symbol_key`) rather than replacing `source_id`/`target_id` — this itself is a design choice the owner may want to confirm before RT-03 implements it, since it wasn't explicitly pre-decided at the D1 decision-resolution step (D1 fixed the *ownership boundary*, not this specific schema-shape choice).
2. **RT-02's read-time repair mechanism** (looking up the current row id by `symbol_key` after a redelivery) may need a new index on `symbols(snapshot_id, symbol_key)` for that lookup to stay fast at R-L scale (GitNexus: 12,660 symbols) — not yet designed, an RT-03 implementation detail.
3. **RT-05's proposed lease default (1500 ms, not the harness's untested 30,000 ms constant)** is a genuinely new finding from this pass, not previously flagged at the planning or decision-resolution checkpoints — worth the owner's explicit attention since it changes what "the tested default" actually is.

## Unauthorized work not performed

Group B (RT-09's remaining numeric-bound design, RT-10's batched-persist implementation) — not touched. Group D (K.4, the change-scoped incremental mechanism; any G8 work) — not touched. RT-16 (G9 re-scoring) — not performed; RT-15 only drafts the wording. RT-17 (ADR-001/`research.md` edit) — not performed. RT-18 (B7/B8 tracking pointer) — not performed. No task checkbox in `t007-local-feasibility-tasks.md` or any ROADMAP row was ticked.

## Gate status

**G3 = CONDITIONAL. G6 = FAIL. G9 = FAIL. T008 = BLOCKED.**

RT-02 and RT-05's drafted designs, once implemented and re-measured (RT-03/RT-04/RT-06/RT-07/RT-08 — none of which is authorized by this pass), are what could move G3 toward PASS. RT-15's wording, once approved and applied via RT-16, is what could move G9's *criterion* — not automatically its score, since RT-16 (the re-score) is also not authorized here. Nothing in this document changes any gate's current determination.
