# T007-LOCAL — Execution Log (living document)

**Feature**: 004 · **Plan**: `t007-local-feasibility-plan.md` · **Tasks**: `t007-local-feasibility-tasks.md` · **Started**: 2026-09-25 (execution authorized by the owner in-session)
**Status**: EXECUTION IN PROGRESS — **Phase A + S-L1 + M-L1 through M-L7 all COMPLETE/characterized + L13 (§17) + L14 gate evaluation done (§18); S-L2 NOT started**. Thresholds, architecture and protocol are FROZEN; nothing below changes them. No commit, no push. T008+ NOT AUTHORIZED.

> Labels (CLAUDE.md evidence discipline): FACT / INCOMPLETE / UNVERIFIED / CONTRADICTION / UNKNOWN. A MEASURED RESULT is never a GATE RESULT; gates are evaluated only after the full raw evidence exists.

## 1. wasm.ts — architecture check (owner-requested, 2026-09-25)

**FACT** — `scripts/t007-local/lib/wasm.ts`:
1. **Why it exists**: the EXISTING RepoAtlas parser stack (Feature 002, `src/lib/code-intel/symbols/grammar-provider.ts`, `web-tree-sitter@0.25.10` + `tree-sitter-wasms@0.1.13` grammars in `public/wasm/`) loads its WASM through build-time `?module` imports that only Nitro/Vite resolve. Under plain `bun` those imports resolve to file-path strings, so the production module exposes two test hooks (`setTestCoreWasmModule`, `setTestGrammarModules`). `wasm.ts` calls those hooks with locally `WebAssembly.compile`d bytes — the same mechanism as `tests/support/wasm-test-modules.ts`.
2. **It does NOT introduce a new parser/runtime.** It then calls the unmodified production `getParser`; symbols come from the unmodified production `extractFile`/`toIntermediateRepresentation`. (The earlier T006 spike script bypassed `getParser`; this harness does not.)
3. **WASM is an adapter detail of the implementation under test, but the benchmark is inherently WASM-Tree-sitter-dependent**, because the existing RepoAtlas implementation is: no native Tree-sitter package exists in `node_modules` (only `web-tree-sitter` + `tree-sitter-wasms`), and adding one would be a dependency change outside the approved harness scope.
4. **Tension with the approved direction — SURFACED, NOT RESOLVED**: the plan's LRF-01 is titled "Native/local parser throughput" and ADR-001 prefers native Tree-sitter. The runtime actually under test is *local* (in-process, no cloud, Bun + SQLite) but **not native**: it is WASM Tree-sitter inside Bun. Plan §4 says the runtime is "Bun + TypeScript … the currently available local path (Rust is a preferred direction, not a dependency of this T007)" and plan §11 already marks parse/extraction throughput, cold start, memory/CPU and concurrency as **"repeat on the Rust Atlas Engine: YES"**. So: no conflict with the local-first protocol; parser numbers are labeled **LOCAL-RUNTIME (WASM Tree-sitter under Bun)**, never "native parser throughput", and a native-parser comparison remains a future item. If the owner wants a native-parser data point inside T007, that is a separate authorization (dependency addition).
5. **No protocol/architecture change was made** to accommodate it.

## 2. Pre-registered operationalizations (written BEFORE any gate-relevant measurement)

These are protocol *interpretations* needed to compute the frozen thresholds; they do not alter the thresholds.

| Item | Operationalization |
|---|---|
| G4 metric | primary = **process wall** at concurrency 2 (cold start included) **+** local snapshot-ingest time for that dataset (strict, end-to-end); engine-only wall reported alongside |
| G5 peak | process-wide peak RSS (all worker threads share the process), 50 ms sampler, at concurrency 2 |
| G5 slope ("no material positive slope") | on the concurrency-1 R-L run: least-squares slope of per-unit RSS samples over the second half of units; projected growth = slope × (units in 2nd half); **material** if projected growth > 15% of the RSS at the half-way point |
| G6 persistence | (persistLock + persistBody + persistCommit) ÷ per-unit pipeline time for the F004 `parsed` unit (plan M-L2 pipeline), at concurrency 2 (strict: includes write-lock wait). Write-only (body+commit) and the F002 symbol/contains stages are reported as supplementary |
| G6 job overhead | engine at concurrency 1 vs the identical units run inline (no job table), work loop only, init excluded: (T_engine − T_inline)/T_inline. Bookkeeping share (claim+RUNNING+COMPLETED writes) reported as supplementary |
| G7 / G8 | like-for-like graphification cost (snapshot rows present → queryable graph; acquisition/hashing excluded on both sides). Sensitivity including acquisition also reported; if the verdict differs it is flagged for the owner, not silently chosen |
| R-L qualification | plan §5.1/§5.2: **Tier-1 files** in 1,000–5,000 AND dominant-language share ≥ 70% of Tier-1 files; raw tracked-file count is reported and any disagreement with the authorization's raw wording is flagged |
| G9 recommendation rule | proposed (owner decides): default = largest band whose worst-language/dense p95 per-file pipeline ≤ 1 s and per-file RSS growth ≤ 256 MiB; hard ceiling = largest band with worst p95 ≤ 10 s and RSS growth ≤ 1 GiB; behavior above the ceiling = SKIPPED-with-structural-metadata (F-6) |
| Statistics | file level ≥ 20 iterations; repository level ≥ 3 cold runs; median / p95 / max (p95 = nearest-rank; with n=3 it equals max) |

## 3. Harness modules (scripts/t007-local/, PROTOTYPE-labeled, throwaway-but-promotable)

`lib/wasm.ts` (see §1) · `lib/db.ts` (scratch schema: production `data/code-intel-schema.sql` applied read-only + scratch extension) · `lib/fsr2.ts` (local FS R2 stand-in) · `lib/snapshot.ts` (local snapshot ingest; **deviation D1**) · `lib/rel.ts` (relationship facts/resolver/identity — PROTOTYPE) · `lib/jobs.ts` (durable job engine per `contracts/local-job-engine.md`) · `lib/unit.ts` (units: production `extractFile` for symbols; prototype contains/parsed) · `worker.ts` + `engine.ts` (Bun Worker threads, coordinator) · `lib/graph.ts` (canonical graph hash, invariants) · `prepare-datasets.ts`, `smoke.ts`, `s-l1.ts`, `baseline.ts`, `run-scale.ts`.

## 4. Deviations / findings recorded so far

- **D1 (acquisition)**: Feature 001's GitHub tar acquisition is not used (no internet; local repos). `git archive <sha>` (read-only) → scratch tree → production `hashContent`/`deriveR2Key` → production-schema rows + content-addressed local blobs. Snapshot identity = the pinned commit SHA. INC scenarios (later) will use content-derived pseudo-commits instead of real commits.
- **D2 (scratch schema extension)**: `idx_symbols_snapshot_name` (F004's "indexed bounded lookup" needs a name index the F002 schema lacks — **finding for T008**), `relationships.t7_target_name/t7_import_spec` (unresolved-fact fields for incremental re-resolution), `t7_*` job tables. Production schema file untouched (sha256-verified).
- **D3 (resolver fix during M-L0)**: the first smoke run showed name-based resolution crossing languages (a TS call listed a Java method as a candidate). This was a *prototype resolver defect*, fixed before S-L1 by restricting candidates to the caller's language family; it is not a protocol change.
- **D4 (S-L1 instrument fix)**: S-L1 run 1 = 34/35; the single failure (C-A6 backoff gaps 39/79 ms vs 40/80) was a timestamp-resolution error in the test instrument (julianday rounding). Instrument changed to the job row's integer-ms `updated_at`; run 2 = 35/35. Run 1 evidence kept: `evidence/t007-local/s-l1-fidelity-run1-34of35.json`.
- **D5 (attribution refinement after first probe)**: the first probe showed "persist" dominating; `persist` was split into write-lock wait / SQL body / commit so contention is not conflated with write cost. S-L1 re-run afterwards.
- **D6 (git index touch, disclosure)**: while inspecting candidate repos I ran `git diff --quiet` in the owner's local `iata-one-order` repo; its `.git/index` mtime is 18:25Z (during this session). Only a stat-cache refresh is possible (no content, HEAD, or worktree change; `git archive` is used for all reads). Reference repos' `.git/index` mtimes predate the session and are unchanged (baseline-verified).
- **Contract gaps found by S-L1 (for the owner, not silently fixed in the contract)**: (1) PAUSED is not derivable from the seven job states (needs a control flag) — contradicts guarantee 7's "no extra bookkeeping"; (2) no CANCELLED state (harness maps cancel → FAILED('cancelled')); (3) lease/retry/backoff defaults are unspecified (harness values are not proposals); (4) recovery latency after a crash equals the lease timeout by design; (5) the F002 symbol unit (production `extractFile`) is not atomic with its job row → recovery relies on idempotent delete-then-insert.

## 5. Dataset qualification (S-L1 step 6–7; details `evidence/t007-local/dataset-inventory.json`)

| Dataset | Tier | Commit | Raw tracked files | Tier-1 files | Tier-1 language mix | Tier-1 MiB | Qualification (pre-registered rule) |
|---|---|---|---|---|---|---|---|
| repo-atlas (HEAD) | R-M | `430e170` | 473 | 239 | TS 156, TSX 82, JS 1 | 1.03 | **QUALIFIES** (100–1,000 Tier-1) — approved repository |
| repo-atlas `src/lib` | R-S | `430e170` | 92 | 83 | TS 81, TSX 2 | 0.28 | **QUALIFIES** (≤100 Tier-1) — real-repository subset |
| GitNexus (`../repotlas-references`, read-only) | R-L JS/TS | `233ca28` | **5,666** | 3,174 | TS 2,636, JS 194, TSX 81, Java 263 → JS/TS 91.7% | 32.71 | **QUALIFIES on the plan's Tier-1 definition** (3,174 ∈ 1,000–5,000; 91.7% ≥ 70%). **FLAG**: raw tracked-file count 5,666 exceeds 5,000 — qualifies only if "files" means Tier-1 files (plan §5.1/§5.2). Owner to confirm the reading |
| iata-one-order (owner's local repo, **outside** `../repotlas-references`, read-only) | R-L Java | `a686149` | 1,369 | 1,304 | Java 1,304 (100%) | 7.66 | **QUALIFIES numerically** (1,304 ∈ 1,000–5,000; 100% Java). **FLAG (representativeness)**: 1,302 of the files are JAXB-generated model classes in one package — this dataset under-exercises CALLS/EXTENDS/IMPLEMENTS resolution. The protocol has no non-generated criterion, so it is not rejected; owner decision requested. No reference repo is Java-dominant (GitNexus 8.3%, codegraph 0.1%, graphify ~0%); other local repos inspected: camel-karavan 85 Java/497 Tier-1 (not dominant, too small), supabase (JS/TS, ~4,940–5,306 Tier-1 but 12.5k raw files), behave-graph, focalboard, topmind_finance_app, sim, open-design (no Java) |

Inspection basis: `git ls-files`/`git archive` only (read-only); no download; reference repos untouched (HEAD, porcelain and `.git/index` verified unchanged by S-L1 C-I3).

## 6. S-L1 harness-fidelity gate — **PASS (35/35)** (final harness)

Performed by the executing agent under the authorization §7 delegation (**not an independent owner review**). Evidence: `evidence/t007-local/s-l1-fidelity.json` (+ run 1 34/35 and pre-D5 run 2 35/35 kept). Coverage: state machine (all observed transitions ⊂ contract), retry/backoff (exponential, bounded), failure containment (`completed_partial`), stale-claim lease reclaim, `symbols<contains<parsed` barrier, snapshot scoping + pause/resume/cancel, purge, lifecycle projection, idempotent redelivery (short-circuit and recompute byte-identical), no-change re-run spawns no workers, concurrency bound, determinism at 1/2/4 workers + comparator negative control, phase attribution (Σ phases ≈ unit total ≤2%; worker time accounting ≤5%), metrics completeness, SQLite invariants (integrity, FK, dangling refs, evidence-state shape), functional `kill -9` + restart (graph identical to clean run), isolation (data/* sha256, src/tests untouched, reference repos untouched, scratch under `.cache/t007-local`). M-L0 smoke: 41/41 hand-derived relationships matched, deterministic across runs (`m-l0-smoke.json`). **S-L1 is functional conformance only — it produced no gate numbers and is not G1/G2/G3 evidence** (those require R-M-scale runs).

## 7. First controlled benchmark — M-L5, repo-atlas R-M (MEASURED RESULTS; gate evaluation deferred)

3 cold runs each (fresh DB copy, fresh process), env hash `e2b32efaacbd45bf`, loadavg 4.3 at start (other apps running; on battery). Median / p95 / max:

| | c=2 (primary) | c=1 |
|---|---|---|
| engine wall (ms) | 1367 / 1418 / 1418 | 1584 / 1598 / 1598 |
| process wall incl. cold start (ms) | 1427 / 1482 / 1482 | 1645 / 1658 / 1658 |
| CPU user+system (ms) / CPU÷wall | 2144 / 1.6 | 1838 / 1.2 |
| peak RSS (MiB) / avg | 340 / 288 | 259 / 216 |
| Tier-1 files/s · symbols/s · relationships/s · resolutions/s | 175 · 484 · 7867 · 6962 | 151 · 418 · 6788 · 6007 |
| parsed-unit persist share (lock+body+commit) | 64% | 46% |
| F002 symbol-stage persist share · contains-stage persist share | 54% · 90% | 25% · 89% |
| job bookkeeping share of unit time | 29% | 26% |

Same graph hash in all 6 runs (`616ca53f21ca…`): 662 symbols, 10,755 relationships (CALLS 8,294 of which RESOLVED 2,071 / AMBIGUOUS 538 / UNKNOWN 5,685; IMPORTS 445 RESOLVED / 490 UNKNOWN; EXPORTS 277; EXTENDS 8+1; IMPLEMENTS 2; CONTAINS 1,238), 2,139 candidate rows, 0 duplicate keys, 0 invariant violations, DB 4.4 MiB. 5 of 234 supported files failed extraction (syntax errors under the pinned grammar) → their parsed units SKIPPED. Parsed phases at c=1 (ms, 239 files): parse 105, facts 95, resolve 173, persist 336 (lock 1, body 244, commit 91), total 727. At c=2 write-lock wait becomes 357 ms of 708 persist. c=2 is only ~1.16× faster than c=1 — single-writer SQLite is the visible scaling limiter. **These are measured values, not gate verdicts.** Thresholds are frozen and untouched; G1–G9 evaluate only after the full suite.


## 8. Resume checkpoint review (2026-09-26 02:55 +04:00) — in-session specialist lenses

These are **in-session reasoning lenses** (Performance Benchmarker, LSP/Index Engineer, Database Optimizer, Reality Checker), not separate agent processes. They changed no threshold, dataset rule, protocol or architecture.

**Performance Benchmarker.** Method sound for what it measures: fresh process + fresh DB per run, ≥3 runs, median/p95/max, env hash recorded, identical graph hash in every run. Caveats: R-M is small (239 Tier-1 files, ~1.4 s, many sub-millisecond units) so fixed costs dominate; the RSS sampler is 50 ms (~28 samples per run) so peaks are sampled, not exact (per-unit RSS series also kept); per-unit `rss()` calls are on in all runs (cost unmeasured, expected small); other apps ran (loadavg 4–8 on 14 cores). Rev A (battery) vs rev B (AC): engine wall 1367→1424 ms (c=2), 1584→1554 ms (c=1), peak RSS 340→335 / 259→257 MiB: within ~4%, no power effect visible. Still needed before any gate: G5 slope (R-L c=1 series), G6 job overhead (inline baseline), G1 resumed-run comparison.

**LSP / Index Engineer.** The symbol stage IS the existing production pipeline (`getParser`, `extractFile`, `toIntermediateRepresentation`, unmodified). Independent recomputation through the production functions outside the harness reproduced the DB exactly on repo-atlas R-M: **662/662 symbols, 0 missing, 0 extra**; the 5 `failed` files also fail an independent direct parse (`hasError`: real syntax errors under the pinned grammar; F002 behavior, 5/234 = 2.1% of supported files get no symbols/relationships). `bun test tests/contract/symbols` = 99 pass / 0 fail. The relationship stage is a PROTOTYPE (labeled). Honesty notes: 65% of relationships are UNKNOWN (CALLS UNKNOWN 5,685 of 8,294 = 69%; name-based resolution, no type info); USES/REFERENCES not exercised; `@/` alias imports resolve UNKNOWN.

**Database Optimizer.** Config recorded: WAL, synchronous=NORMAL, busy_timeout 15 s, 4 KiB pages, autocheckpoint 1000. `EXPLAIN QUERY PLAN` on the hot statements: all indexed except **D8** — `Resolver.files` joined `file_extractions` without `snapshot_id`, forcing a `SCAN fe` per import lookup (harness inefficiency, would scale O(files) per lookup at R-L). Fixed (`AND fe.snapshot_id = sf.snapshot_id`); effect at R-M negligible (resolve 164→176 ms, noise), S-L1 re-run 35/35. Symbol-by-name uses the (snapshot,name,kind) index but sorts all matches (temp B-tree) before `LIMIT 21` — a design cost kept, measured inside `resolve`. Attribution caveats: `persistLock` is time inside `BEGIN IMMEDIATE` and therefore includes SQLite's busy-handler sleep schedule (per SQLite docs; UNVERIFIED on this Bun build), so it can overstate pure lock-hold contention; the F002 symbol stage persists through the D1 shim with per-statement autocommit and its lock waits are counted in `persist` (not split). No index/pragma tuning was applied (that would be tuning the benchmark); PRAGMA variants belong to M-L3 as separate characterization.

**Reality Checker.** No gate is concluded anywhere. Corrections applied: (1) my earlier "single-writer SQLite is the limiter" is **UNVERIFIED inference** (lock-wait time supports it; CPU contention/WASM/memory bandwidth not excluded) — M-L3/M-L4 (ladder 1/2/4/8, persist-isolated runs) must test it. (2) The "job bookkeeping share 26–29%" is NOT the G6 metric (pre-registered G6 = engine c=1 vs inline); do not read it as a G6 result. (3) The kill/restart probing so far is S-L1 *functional* evidence (+6/6 `killdbg` recoveries), not G2 evidence (R-M F-1 not yet run). (4) S-L1 was self-performed. (5) **D7 (new finding, see §4)**: the S-L1 flakiness was a Bun runtime crash, not a harness logic error.

## 9. Additional deviations / findings (appended 2026-09-26)

- **D7 — Bun 1.3.14 crashes when several worker threads run `WebAssembly.compile`/instantiate concurrently.** Reproduced with the engine CLI: parallel worker init at c=2 → SIGTRAP (exit 133) in 7/40 runs (smoke) and 2/25 (R-S); one S-L1 run exited 139 (SIGSEGV); one S-L1 kill test failed because the child died at init (`killedAt: null`). Workers=1: 0/40. **Serialized worker init (one worker at a time): 0/60 at c=2, 0/50 at c=4/8.** Harness workaround = serialized init (init cost is excluded from work wall, included in process wall). **Not a protocol change, but a production-relevant runtime-stability finding** (a Bun multi-thread engine must serialize or otherwise protect WASM init; supports the Rust-core preference). `T7_PARALLEL_INIT=1` reproduces the crash. Owner decision requested: accept the workaround for the measurements.
- **D8 — harness query inefficiency** (see §8). Fixed; rev-B R-M evidence supersedes rev-A (kept).
- **Evidence handling**: failing/flaky S-L1 logs and the crash probe preserved in `evidence/t007-local/flaky-run-logs/`; frozen environment written to `evidence/t007-local/environment-frozen.json` (power state varied: rev A on battery, rev B on AC).

## 10. Evidence validity table (2026-09-26)

| Artifact | Status |
|---|---|
| `dataset-inventory.json`, `isolation-baseline.json`, `environment-frozen.json` | VALID |
| `m-l0-smoke.json` | VALID (41/41; re-run after fixes) |
| `s-l1-fidelity.json` (latest 35/35, final harness), run1 34/35, run2 35/35 | VALID as history; latest is authoritative. Flaky runs explained by D7 |
| `m-l5-repo-atlas-rm-c{1,2}-revB.json` | **VALID — authoritative** (final harness: serialized init, indexed join) |
| `m-l5-repo-atlas-rm-c{1,2}.json` (rev A) | VALID-WITH-CAVEAT, superseded (parallel init; unindexed join; battery); within ~4% of rev B; kept |
| M-L4 evidence (see §11) | VALID — collected 2026-09-26 on the final harness (rev C); rev-A/B failure files kept |
| Everything else (M-L1–M-L3, M-L7 sweeps, R-S/R-L scale, M-L6, results.md, gate evaluation) | NOT DONE |

## 11. M-L4 — jobs + failures on repo-atlas R-M (2026-09-26 03:41 +04:00) — MEASURED RESULTS / CLASSIFICATIONS, NO GATE VERDICTS

Owner decisions in force: D7 serialized init accepted (kept as an explicit finding); GitNexus qualifies on Tier-1 files (5,666 tracked files reported separately as context); local `iata-one-order` accepted as the Java R-L dataset with the disclosed limitation that **1,302 of its 1,304 Java files are JAXB-generated model classes** (call-resolution representativeness is weak; it does not represent a typical Java application); native Tree-sitter = separate follow-up, not part of this gate; AC power is the reference state; `local-job-engine.md` untouched (gaps preserved as findings).

**Reviews (four in-session reviews were run as real subagents: Performance Benchmarker, Database Optimizer, LSP/Index Engineer, Knowledge Graph Engineer; Reality Checker after the evidence).** Applied (measurement mechanics only): third baseline arm "inline-in-worker"; sampler and per-unit RSS off in the baseline; one discarded warm-up + 8 rotated rounds; interleaved cold ladder; warm ladder relabelled *main-thread-warm / worker-cold*; persist share also reported net of the job-completion write and the bookkeeping denominator corrected; stronger graph invariants (wrong-kind target, cross-language target, AMBIGUOUS<2 candidates, dangling candidates, orphan directories, CONTAINS completeness); F-1 hard assertions (completed work unchanged, checkpoint row counts); F-2 full canonical-graph diff; real mid-transaction ROLLBACK injection; F-4e duplicate-execution probe. New harness findings: **D9** Bun workers do not see runtime changes to `process.env` unless `env` is passed explicitly (F-6 attempt 1 failed for this reason; fixed, attempt kept); **D10** claim query scanned every job of the snapshot (missing snapshot-scoped index; fixed as a schema-level harness defect, same class as D2/D8); **D11** identity hashing moved out of the write lock; **D12** snapshot rollup reported `completed` for a cancel-halted run with PENDING jobs (fixed to `in_progress`; the F-5 evidence records the original wording). A **claim-precheck variant** (read-only look before the write-lock claim) is reported separately, not as the primary configuration.

### Inline baseline (`m-l4-inline-vs-engine.json`; 8 rounds after 1 discarded; graph hash/table counts/invariants identical in every arm)
Work wall medians (min–max): inline-main 1092 ms (1058–1176) · inline-in-worker 1083 ms (1050–1123) · engine c=1 1240 ms (1173–1259). **Pre-registered G6 measure (engine c=1 vs inline-main): median +12.3%, min +3.6%, max +18.4%, 2/8 rounds above 15%** (ratio of medians 13.6%). Thread effect (worker vs main): ≈0% (−7.7…+2.7%). Job-table effect (engine vs inline-worker): median +12.8%. Descriptive only — the 15% threshold is not applied here; the margin is inside the run-to-run spread. Measured at WAL + `synchronous=NORMAL` only.

### Concurrency ladder (`m-l4-ladder-cold.json`, interleaved, 5 rounds/level; `m-l4-warm-ladder.json`; variant `-precheck`)
| c | engine wall ms | process wall ms | speedup vs c=1 | CPU ms | peak RSS MiB | parsed-unit write-lock wait | files/s |
|---|---|---|---|---|---|---|---|
| 1 | 1213 (1196–1256) | 1271 | 1.00 | 1469 | 258 | 0% | 197 |
| 2 (primary) | 1045 (1037–1091) | 1113 | 1.16 | 1873 | 336 | 28% | 229 |
| 4 | 1139 (1100–1213) | 1227 | 1.06 | 2646 | 448 | 56% | 210 |
| 8 | 1248 (1132–1485) | 1366 | 0.97 | 4114 | 608 | 72% | 192 |
Every cell: 0 attempts beyond the first, 0 reclaims, 0 busy errors, one graph hash, 0 invariant violations. Warm (main-thread-warm, worker-cold) medians: 1353/1208/1271/1463 ms (c=1/2/4/8). Precheck variant: 1274/1139/1122/1255 ms — no material change. Only c=2 vs c=1 is clearly separated; "single-writer SQLite is the limiter" remains **UNVERIFIED** (lock-wait share rises with c, but no persist-stubbed/WASM-only control run exists). Claim writes share the same lock (claimMs total 86 ms at c=1 → 1181 ms at c=8).

### Failure suite (raw + classifications; nothing auto-retried)
- **F-1 kill -9/restart:** rev A/B 15+23 attempts all met the criteria; **rev C (strengthened) 26/26 attempts, 32 kills (14 during a RUNNING parsed unit, 6 during a RUNNING symbols unit)** and **F-1c 30 random-time kills, all with a RUNNING symbols unit** — every final graph hash equal to the clean reference `616ca53f21ca…`, 0 invariant/completeness violations, 0 changed completed files (1,571 checked), checkpoint row counts matched. Restart wall median 1.49 s (F-1) / 2.3 s (F-1c) against a 1.5 s lease; first progress after restart ≈ 60 ms. Coverage limits: whole-process SIGKILL only (OS page cache intact), `synchronous=NORMAL`, no power-loss/fsync, no kill aimed at commit/checkpoint, no kill during recovery, no worker-thread-only crash.
- **F-2:** 3 victims, pre-work and mid-transaction (real ROLLBACK) faults — 963 missing lines = exactly the victims' parsed rows, 0 extra lines, snapshot `completed_partial`. Symbols-unit failure cascades (contains FAILED, parsed SKIPPED) recorded separately.
- **F-3:** bounded at 3 attempts, backoff ≥ base, recoverable case hash = clean (24 retries for 20 injected units); F-3c transient failure inside the persist transaction: 20/20 retried, hash = clean.
- **F-4:** relationship stage idempotent (25 redelivered units short-circuit; recompute with cleared checkpoint identical, 0 dropped keys; whole-run re-enqueue spawns no workers, 7 ms). **Symbols-stage redelivery (unmodified production `extractFile`): hash differs and 36 relationship endpoints dangle** (delete + re-insert assigns new row ids; known R6/D-R6-2 hazard) — classification "PARTIAL", not adjusted. **F-4e (lease 2 ms ≪ unit time, 4 workers, ~190 reclaims/run): 2 of 3 runs identical; run 1 silently differs** (4 nested symbols lost their parent link; all invariants clean — `m-l4-f4e-graph-diff-vs-clean.json`). Needs a fencing/lease decision; none was invented.
- **F-5:** pause/resume 6/6 (c=2,4) behaviour met (no new claims while paused, resume → clean hash, pause-to-quiet 6–468 ms). Cancel-halt: behaviour only (claiming stops, no RUNNING left, invariants hold, finishing after clearing the flag → clean hash); **cancel end-state semantics NOT EVALUABLE — the contract defines no cancelled state, none invented**. The pre-fix rollup mislabelled the halted run `completed` (D12).
- **F-6:** attempt 1 not met (D9: env cap never reached the workers; kept). After the fix: 512 KiB cap skips the 600 KiB, 3 MiB and 11 MiB files, default 10 MiB cap skips only the 11 MiB file, and an 8 KiB cap on R-M skips 34 files — every skip has a SKIPPED job, a `skipped_unsupported` row with reason, retained structural metadata (directory CONTAINS file), no symbols, no silent disappearance.

### Reality Checker (advisory) — key challenges
G3 has open items (F-4 symbols redelivery, F-4e, F-5 cancel semantics) that need an owner decision or contract amendment before any label; F-1 proves no loss/duplication only via a same-engine reference hash under SIGKILL; crash-time reclaim does not increment `attempts` (unbounded retry for a crashing unit); benchmark contamination exists (loadavg 4–7, ladder order fixed c=1,2,4,8 within each round, sampler/`--rss` on in the ladder but off in the baseline) without flipping any result; the G6 margin is within the noise; "PASS-CRITERIA-MET" strings are criteria checks, not gate verdicts.

### Evidence sufficiency for later G1/G2/G3 (not a verdict)
**G1:** enough at R-M for the determinism comparison (≥3 clean runs — the 20 cold ladder runs and the clean-reference runs of every failure test all gave one hash — plus 94 kill/restart resumed runs across rev A/B/C and F-1c); still missing M-L6 graph-diff runs and any independent correctness oracle at R-M scale. **G2:** F-1 evidence exists; missing per owner scope: `synchronous=FULL`/power-loss variant (or explicit acceptance that it is out of scope), kills aimed at commit/checkpoint and during recovery, worker-thread crash. **G3:** NOT sufficient until the owner decides the F-4 symbols-stage, F-4e and F-5-cancel questions.

## 12. M-L1/M-L2 file-band sweep — CHECKPOINT / RECORDING (2026-09-26 05:24 +04:00) — MEASURED RESULTS + PARTIAL/STALL EVIDENCE, NO GATE VERDICTS

Documentation-only recording. Nothing was re-run; no threshold, dataset, protocol, parser behavior, lease setting or production code was changed; no task checkbox ticked; **G1–G9 NOT evaluated; M-L3 NOT STARTED**; no commit, no push. Evidence root: `specs/004-engineering-relationship-graph/evidence/t007-local/`. Basis label: **LOCAL-RUNTIME (WASM Tree-sitter under Bun) + unmodified production symbols pipeline + PROTOTYPE relationship stage**; process-cold per fixture, in-process iterations warm; env hash `e2b32efaacbd45bf`.

**Pre-registered run rules, recorded as written in the evidence (unchanged):** stall guard `stallGuardS` = 300 s; per-stage budget `perStageBudgetS` = 120 s; iteration rule = 20 iterations when affordable, else as many as fit the per-stage budget (min 3), flagged `insufficientN`, **p95 withheld**.

### 12.1 B1–B6 (48 synthetic fixtures + 1 real minified fixture) — all 49 completed, status `OK`
Evidence: `m-l12-bands-B1-B6.json` (manifest of 49) plus per-fixture `m-l12/B{1..6}-<lang>-<density>.json` (`.partial`/`.phase` retained). Parsed-unit total median (F002 symbols + F004 contains/parsed pipeline unit, prototype relationship stage); ⚠nN = completed but **insufficient-N** (only N iterations fit the budget; median shown, no p95):

| fixture | B1 (<=4KiB) | B2 (16KiB) | B3 (64KiB) | B4 (256KiB) | B5 (512KiB) | B6 (1MiB) |
|---|---|---|---|---|---|---|
| typescript ordinary | 3 ms | 18 ms | 144 ms | 1.7 s | 6.2 s | 23.8 s ⚠n=5 |
| typescript dense | 4 ms | 18 ms | 71 ms | 295 ms | 595 ms | 1.2 s |
| tsx ordinary | 3 ms | 18 ms | 141 ms | 1.7 s | 6.7 s ⚠n=16 | 23.5 s ⚠n=5 |
| tsx dense | 4 ms | 17 ms | 72 ms | 294 ms | 604 ms | 1.2 s |
| javascript ordinary | 3 ms | 18 ms | 143 ms | 1.8 s | 6.5 s ⚠n=18 | 24.9 s ⚠n=4 |
| javascript dense | 4 ms | 18 ms | 74 ms | 300 ms | 604 ms | 1.4 s |
| java ordinary | 2 ms | 15 ms | 122 ms | 1.5 s | 5.2 s | 20.1 s ⚠n=5 |
| java dense | 4 ms | 19 ms | 103 ms | 819 ms | 2.7 s | 9.2 s ⚠n=12 |

Iterations: every cell not flagged ran 20. Flagged: B5-javascript-ordinary 18, B5-tsx-ordinary 16, B6-typescript-ordinary 5, B6-tsx-ordinary 5, B6-javascript-ordinary 4, B6-java-ordinary 5, B6-java-dense 12. Values are the manifest's `parsedTotalMedianMs`, rounded; the owner brief's 72 ms for TS dense B3 is 71 ms in the manifest (rounding only).

**Real minified fixture** (`m-l12/real-minified-js.json`): 619,692 bytes, 20 iterations, parsed-unit median **729 ms** (parse median 110 ms), `OK`, 0 invariant violations.

### 12.2 B7/B8 (4 MiB / ~10 MiB) — mixed states, EXACTLY as evidenced
Source of the per-fixture line: `m-l12/logs/bands78.log` (the only B7/B8 summary that exists) + per-fixture `.json`/`.partial`/`.phase`.

| Fixture | State | Evidence |
|---|---|---|
| B7-java-ordinary | **STALL** — hit the 300 s stall guard; total wall 436.8 s; terminated (exit 137); last heartbeat `m-l2:parsed:resolve`, iter 0 | wrapper `.json` with `salvagedBeforeFailure` (M-L1 parse n=20; M-L2 symbols/contains-dirs/contains stages n=20; **no completed `parsed` iteration → no parsed-unit figure**) |
| B7-java-dense | **COMPLETED, insufficient-N** — wall 485.6 s; `parsed` stage **3 iterations**, median ≈ 139.7 s per parsed unit; **no p95** | `B7-java-dense.json` (symbols/contains stages n=20) |
| B7-javascript-ordinary | **STALL** — guard hit; wall 424.6 s; last heartbeat `parsed:resolve` iter 0 | wrapper `.json` (salvaged as above) |
| B7-javascript-dense | **COMPLETED** — wall 130.1 s; `parsed` n=20; median ≈ 4.9 s | `B7-javascript-dense.json` |
| B7-typescript-ordinary | **STALL** — guard hit; wall 420.6 s; last heartbeat `parsed:resolve` iter 0 | wrapper `.json` (salvaged as above) |
| B7-typescript-dense | **INTERRUPTED / PARTIAL** — killed during the controlled shutdown; **no final `.json`**, only `.partial` + `.phase` (heartbeat `m-l2:parsed:persist`, iter 8); `.partial` holds M-L1 + symbols/contains stages, **no parsed-stage summary → no median, no insufficient-N determination** | `B7-typescript-dense.json.partial`, `.json.phase` |
| B8-java-ordinary | **SKIPPED** (`NOT_ATTEMPTED`) after B7-java-ordinary hit the guard | log line only |
| B8-java-dense | **STALL** — guard hit; wall 459.6 s; last heartbeat `parsed:resolve` iter 0 | wrapper `.json` (salvaged as above) |
| B8-javascript-ordinary | **SKIPPED** (`NOT_ATTEMPTED`) | log line only |
| B8-javascript-dense | **COMPLETED, insufficient-N** — wall 192.3 s; `parsed` **9 iterations**, median ≈ 12.5 s; **no p95** | `B8-javascript-dense.json` |
| B8-typescript-ordinary | **SKIPPED** (`NOT_ATTEMPTED`) | log line only |
| B8-typescript-dense; all B7-tsx-*/B8-tsx-* | **NO RECORD** — no file and no log line (the orchestrator was shut down before reaching them, or they were not scheduled; which one is **UNKNOWN**) | — |

Notes: (a) The orchestrator's **B7/B8 summary file was never written** (the orchestrator was intentionally shut down); none was reconstructed or fabricated — the log lines and per-fixture files above are the authoritative partial/stall evidence. (b) The log's summary lines and the stage JSON differ by a few ms for completed fixtures (e.g. B7-java-dense 139,676 vs 139,679 ms); both are the same measurement, cited approximately. (c) B8-javascript-ordinary/typescript-ordinary `NOT_ATTEMPTED` are in the log although the owner brief named only B8-java-ordinary; the log is authoritative.

**Stall-guard observations (FACT):** all four stalled fixtures (B7 java/javascript/typescript ordinary, B8 java-dense) had completed the M-L1 parse iterations and the symbols/contains stages, and were **still inside the first `parsed` iteration's resolve phase** when the 300 s guard fired; the first `parsed` iteration never completed. The resolver-probe series (`m-l12-resolver-probes.json`, `m-l12/P1..P5-n{250..8000}.json`, `logs/probes.log`) measured same-file resolution growing ≈4× per 2× n in probe P3 (463.9 → 1,796 → 7,220 → 28,944 ms for n = 1,000 … 8,000), i.e. super-linear; **that these probes explain the B7/B8 stalls is UNVERIFIED** (the stalled runs were killed before completion). The M-L4 report §F.6 already flagged a suspected quadratic same-file lookup.

### 12.3 F-4e lease-1500 control — recorded from `m-l4-f4e-control-lease1500.json` (characterization, NOT a production sign)
- Configured **1.5 s lease on R-M** (5 runs): 0 reclaims; **5/5** graph hashes equal to the clean reference (`616ca53f21ca…`); max unit 153–684 ms.
- **Large fixture** (owner brief: ≈768 KiB TS; size not re-verified in this session): reference longest unit **13.3 s > 1.5 s lease**; a reclaim / duplicate execution occurred in **3/3 runs** (`anyReclaim` = true); final graph nonetheless matched the single-worker reference **3/3** (`anyDivergence` = false; `missingLinesVsReference` 0).
- Silent divergence remains evidenced **only** in the artificial 2 ms-lease stress case (1 of 3 runs; §11, `m-l4-f4e-graph-diff-vs-clean.json`, `m-l4-f4e-stale-live-duplicate-execution.json`).
- Classification: **known lease/fencing design risk** (a unit longer than the lease is re-executed while the original is still running; the contract has no fencing). Reported as a characterization result; **not** a production-readiness sign, and no lease value or fencing rule was chosen or changed.

### 12.4 Controlled shutdown (FACT, per owner brief and verified at recording time)
The B7/B8 orchestrator (pid 29495) was stopped and its surviving child was also terminated; that is why B7-typescript-dense has only `.partial`/`.phase`. At recording time no T007 benchmark process was found running (`ps` check). M-L3 was **not** started.

### 12.5 External reference-repository workspace-change observation (UNATTRIBUTED — not caused by T007)
Reported by the owner / prior session (**not re-verified by this recording pass; no command was run inside the reference repositories**): sibling read-only references `../repotlas-references/{GitNexus,graphify,codegraph}` show unexpected external working-tree/build/index changes — GitNexus: `.gitnexus` index, build/dist output, `node_modules` changes and an untracked `GITNEXUS_TECHNICAL_IMPLEMENTATION.md`; graphify: newer `.venv/graphify`; codegraph: newer `ui/dist`; all three `.git/index` mtimes changed with unchanged size; HEADs unchanged. **T007 did not make these changes** and they are recorded only as an external workspace-isolation observation, **not** attributed to RepoAtlas. The reference repositories **remain untouched by T007 and must not be cleaned, reset, checked out, deleted, installed into, built, indexed or otherwise modified.** Provenance is preserved: the T007 datasets were extracted with `git archive` at the pinned commits (GitNexus `233ca28`, §5) **before** these observations, so dataset content is unaffected by later working-tree changes (UNVERIFIED beyond that ordering; hashes in `dataset-inventory.json`).

### 12.6 Remaining T007 work (unchanged protocol; not started)
M-L3 SQLite sweeps · M-L7 cold start · R-S and R-L runs (GitNexus JS/TS; iata-one-order Java with the JAXB limitation) · M-L6 incremental · L13 evidence artifact · L14 gate evaluation (G1–G9) · S-L2 owner review. **Open owner decision:** disposition of the B7/B8 partial/stall evidence (accept as-is, or authorize a separately scoped follow-up); nothing is assumed here.

## 13. M-L3 — SQLite characterization (2026-09-26 05:50 +04:00) — MEASURED RESULTS, NO GATE VERDICTS

Authorized by the owner after accepting the §12 checkpoint (B7/B8 evidence accepted as documented; **no B7/B8 follow-up**). Executed exactly as pre-registered in plan §6 M-L3 (batch-insert rows/s for relationships + candidates; indexed resolution-lookup latency; bounded traversal per FR-014 — outgoing/incoming, type-filtered, paginated; WAL vs rollback journal; DB size). **M-L6, M-L7, R-S, R-L and G1–G9 were NOT started/evaluated; thresholds, datasets, schema, job model, parser, lease settings, production code, reference repos and existing evidence untouched; nothing committed.** Harness: `scripts/t007-local/m-l3.ts` (new, PROTOTYPE). Evidence (new files only): `evidence/t007-local/m-l3-sqlite.json` (summary), `m-l3-raw.json` (raw per-query / per-commit samples); scratch DBs in `.cache/t007-local/m-l3/`; console log `.cache/t007-local/m-l3.log`.

**Configuration (recorded in the evidence JSON).** bun:sqlite (SQLite 3.43.2 built into Bun 1.3.14; Apple M3 Max, 36 GiB, SSD, macOS 14.5), reference env hash in JSON; `synchronous=NORMAL`, busy_timeout 15 s, foreign_keys ON, 4 KiB pages; production `data/code-intel-schema.sql` + the existing scratch extension, unchanged; journal modes **WAL** vs **DELETE** (rollback). Data: the real R-M graph (repo-atlas `430e170`; one fresh engine run reproduced graph hash `616ca53f21ca…` = reference: MATCH; 10,755 relationships, 2,139 candidates, 662 symbols). **Larger scales 4×/16×/64× are SYNTHETIC multiplications** of the real rows (source/target/candidate ids offset per copy, fresh sha256 keys; symbols cloned with a name suffix, sharing the original file extractions) — index-depth/size scaling only, **not** R-S/R-L measurements (real R-L row counts are UNKNOWN until R-L runs). Load average 2.0–2.7 during the run. Writes: BEGIN IMMEDIATE…COMMIT batches, prepared statements, relationship insert (`ON CONFLICT DO NOTHING`) then candidates via `lastInsertRowid` (same shape as prototype `persistRows`); every run on a fresh VACUUMed copy with the relationships table emptied, fresh connection; row counts verified after every run (all true). Reads: 500 seeded samples per class per pass; pass 0 = **connection-cold / OS-page-cache-warm** (OS cache not dropped — needs privileges), passes 1–3 = warm; 3 repetitions (each a fresh connection, different sample seed, same seed for both journal modes); page size 100 rows (harness choice, not a threshold); keyset pagination `id > ?`. Stats: median/p95 (nearest-rank)/max.

### 13.1 Batch-insert throughput (relationships + candidates)
| scale (rel+cand rows) | batch | journal | runs | wall ms med/p95/max | rel rows/s (med) | per-commit ms med/p95/max | ckpt ms | WAL MiB pre-ckpt |
|---|---|---|---|---|---|---|---|---|
| 1× (10,755+2,139) | all | WAL | 5 | 222 / 259 / 259 | 48,370 | 222.35 / 258.70 / 258.70 | 4.9 | 3.6 |
| 1× (10,755+2,139) | all | DELETE | 5 | 220 / 223 / 223 | 48,987 | 219.54 / 223.28 / 223.28 | 0.0 | 0.0 |
| 1× (10,755+2,139) | 1000 | WAL | 5 | 255 / 278 / 278 | 42,254 | 22.91 / 27.62 / 37.82 | 2.7 | 1.3 |
| 1× (10,755+2,139) | 1000 | DELETE | 5 | 253 / 285 / 285 | 42,524 | 23.04 / 27.99 / 38.49 | 0.0 | 0.0 |
| 1× (10,755+2,139) | 100 | WAL | 5 | 312 / 335 / 335 | 34,487 | 2.66 / 5.42 / 7.08 | 2.6 | 2.6 |
| 1× (10,755+2,139) | 100 | DELETE | 5 | 392 / 395 / 395 | 27,448 | 3.67 / 4.52 / 7.54 | 0.0 | 0.0 |
| 1× (10,755+2,139) | 1 | WAL | 5 | 1004 / 1026 / 1026 | 10,708 | 0.06 / 0.10 / 7.67 | 2.0 | 1.5 |
| 1× (10,755+2,139) | 1 | DELETE | 5 | 4419 / 5932 / 5932 | 2,434 | 0.34 / 0.58 / 1731.09 | 0.0 | 0.0 |
| 4× (43,020+8,556) | 1000 | WAL | 5 | 1146 / 1157 / 1157 | 37,533 | 24.56 / 34.86 / 38.17 | 10.1 | 3.7 |
| 4× (43,020+8,556) | 1000 | DELETE | 5 | 1269 / 1295 / 1295 | 33,888 | 29.41 / 37.69 / 47.75 | 0.0 | 0.0 |
| 16× (172,080+34,224) | 1000 | WAL | 5 | 6926 / 6932 / 6932 | 24,845 | 42.35 / 52.47 / 64.96 | 5.5 | 0.6 |
| 16× (172,080+34,224) | 1000 | DELETE | 5 | 7682 / 7870 / 7870 | 22,401 | 46.38 / 59.15 / 77.32 | 0.0 | 0.0 |
| 64× (688,320+136,896) | 1000 | WAL | 3 | 39599 / 39847 / 39847 | 17,382 | 61.52 / 69.63 / 98.21 | 17.0 | 2.5 |
| 64× (688,320+136,896) | 1000 | DELETE | 3 | 43629 / 44273 / 44273 | 15,777 | 67.47 / 78.33 / 106.86 | 0.0 | 0.0 |

Insufficient-N: none (min 3 runs; the 64× cells have n=3, where p95 = max by the nearest-rank rule). `countsVerified` true for all cells.

### 13.2 Resolution-lookup and bounded-traversal latency (warm; ms median / p95 / max; 3 reps × 3 warm passes × 500 samples = 4,500 per cell)
| class | 1× WAL | 1× DELETE | 64× WAL | 64× DELETE |
|---|---|---|---|---|
| R1 symbols-by-name (resolver byName, LIMIT 21) | 0.0145 / 0.0206 / 0.073 | 0.0168 / 0.0224 / 0.054 | 0.0165 / 0.0251 / 0.053 | 0.0192 / 0.0275 / 0.048 |
| R2 files-by-6-paths (import candidates) | 0.0099 / 0.0133 / 0.069 | 0.0123 / 0.0161 / 0.070 | 0.0102 / 0.0137 / 0.040 | 0.0126 / 0.0157 / 0.039 |
| R3 symbols-in-file by name (resolver same-file) | 0.0092 / 0.0125 / 0.032 | 0.0115 / 0.0147 / 0.039 | 0.0694 / 0.1529 / 0.285 | 0.0721 / 0.1553 / 0.351 |
| T1 outgoing page (all types, LIMIT 100) | 0.0101 / 0.0287 / 0.223 | 0.0122 / 0.0292 / 0.079 | 0.0150 / 0.0397 / 0.113 | 0.0165 / 0.0405 / 0.097 |
| T2 outgoing page type=CALLS | 0.0050 / 0.0183 / 0.049 | 0.0073 / 0.0206 / 0.037 | 0.0085 / 0.0277 / 0.101 | 0.0106 / 0.0283 / 0.056 |
| T3 incoming page (all types) | 0.0093 / 0.0170 / 0.121 | 0.0115 / 0.0180 / 0.062 | 0.0134 / 0.0273 / 0.184 | 0.0158 / 0.0297 / 2.537 |
| T4 incoming page type=CALLS | 0.0056 / 0.0125 / 0.060 | 0.0078 / 0.0146 / 0.051 | 0.0093 / 0.0279 / 0.124 | 0.0119 / 0.0310 / 0.148 |

Cold-pass (connection-cold) medians equal warm to within noise for every class (e.g. 1× WAL R1 0.0150/0.0223, T1 0.0105/0.0300 ms med/p95). Deep pagination on the graph's highest-degree hubs (356 outgoing / 188 incoming, `file|424` / `symbol|483`): 4 and 2 pages of 100; per-page median 0.056 / 0.065 ms (WAL, 1×), max 0.114 ms across all cells. Warm medians by scale (columns: WAL R1, R3, T1, T2, T4 | DELETE R1, R3, T1, T2, T4):

| scale | WAL R1 | R3 | T1 | T2 | T4 | DEL R1 | R3 | T1 | T2 | T4 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.0145 | 0.0092 | 0.0101 | 0.0050 | 0.0056 | 0.0168 | 0.0115 | 0.0122 | 0.0073 | 0.0078 |
| 4 | 0.0153 | 0.0134 | 0.0119 | 0.0061 | 0.0064 | 0.0179 | 0.0159 | 0.0138 | 0.0084 | 0.0086 |
| 16 | 0.0160 | 0.0256 | 0.0142 | 0.0077 | 0.0087 | 0.0177 | 0.0275 | 0.0157 | 0.0098 | 0.0105 |
| 64 | 0.0165 | 0.0694 | 0.0150 | 0.0085 | 0.0093 | 0.0192 | 0.0721 | 0.0165 | 0.0106 | 0.0119 |

Query plans (`m-l3-sqlite.json` → `queryPlans`, 16×): typed pages use `idx_relationships_snapshot_source|target` with the `id` keyset; **un-typed pages (T1/T3) add `USE TEMP B-TREE FOR ORDER BY`**; R1 uses `idx_symbols_snapshot_name` + `TEMP B-TREE FOR ORDER BY`.

### 13.3 DB size (`dbstat` available; both journal modes give identical bytes)
| scale | rels | cands | symbols | as-built MiB | after VACUUM MiB | B/relationship (all-in) | relationships table / auto-index (MiB) |
|---|---|---|---|---|---|---|---|
| 1× | 10,755 | 2,139 | 662 | 4.4 | 4.2 | 426 | 1.8 / 0.9 |
| 4× | 43,020 | 8,556 | 2,648 | 16.1 | 15.2 | 392 | 7.5 / 3.5 |
| 16× | 172,080 | 34,224 | 10,592 | 63.2 | 59.9 | 385 | 30.0 / 13.9 |
| 64× | 688,320 | 136,896 | 42,368 | 252.5 | 239.3 | 385 | 120.4 / 55.9 |

Total file includes the unchanged symbol/file/scratch tables and 6 relationship-related indexes; per-object bytes for every scale are in the JSON.

### 13.4 Observations, caveats and unexpected behavior (labels per evidence discipline)
- **FACT** — Batch size dominates write throughput: at 1× rel rows/s = 48.4k (single commit) → 42.3k (1000) → 34.5k (100) → 10.7k (1, WAL). **Per-row commits in rollback-journal mode are 4.4× slower than WAL** (4,419 ms vs 1,004 ms, 2,434 vs 10,708 rows/s; one DELETE-mode commit took 1,731 ms). For batches ≥ 1000 the two modes differ by ≤ ~12% (16×: 7,682 vs 6,926 ms; 64×: 43.6 vs 39.6 s). Throughput falls as the table/indexes grow (1000-row batches, WAL: 42.3k → 37.5k → 24.8k → 17.4k rel/s at 1×/4×/16×/64×); per-commit p95 grows 27.6 → 69.6 ms.
- **FACT** — WAL leaves a WAL file until checkpointed (0.6–3.7 MiB before `wal_checkpoint(TRUNCATE)`, which took 2–17 ms); DELETE mode never has a WAL. On-disk size is identical after checkpoint.
- **FACT** — Lookups and pages are microsecond-scale (warm medians 0.005–0.07 ms, p95 ≤ 0.16 ms, max ≤ 2.5 ms; one 2.5 ms T3 outlier at 64× DELETE) and grow only slightly with 64× more rows (T1 0.0101 → 0.0150 ms). Typed pages are faster than un-typed pages (no temp B-tree).
- **UNVERIFIED** — WAL reads look ~10–25% faster than DELETE reads in every class, and WAL writes ~10% faster at ≥1000 batches. **Ordering confound:** for each configuration WAL always ran before DELETE (not interleaved), so this difference is not attributable to the journal mode.
- **Caveat (R1)** — the sampled call-target names mostly match no symbol (median 0 rows returned; consistent with 69% of CALLS being UNKNOWN in R-M), so R1 mostly measures index misses; hit-path latency is only exercised by the minority of names that match. R2 (3 of 6 paths exist) and R3 return rows.
- **Scaling artifact (R3)** — same-file lookup grows 0.0092 → 0.069 ms (1× → 64×) because the cloned symbols share the original file extractions, i.e. the *symbols-per-file* count grows 64×; this is a property of the synthetic construction, not of table size. It is directionally consistent with the earlier M-L4/M-L1/M-L2 finding that same-file resolution cost grows with symbols per file (causal link UNVERIFIED).
- **Limits** — single machine; OS cache not dropped (cold = connection-cold only); `synchronous=NORMAL` only (FULL/power-loss not pre-registered here); no concurrent reader/writer measurement (write-lock contention was measured in M-L4); DB size per **real** tier is measured for R-M only (R-S/R-L not started); traversal is 1-hop pages only; per-node degrees are the real R-M degrees (median 4, max 356 out / 188 in) and do not grow with scale.
- **Not a gate result.** G6 and the other gates are NOT evaluated here; these numbers are inputs to L13/L14 only.

## 14. M-L7 — cold-start characterization (2026-09-26 06:21 +04:00) — MEASURED RESULTS, NO GATE VERDICTS

Owner accepted M-L3 as recorded (1× = real R-M graph with reference hash reproduced; 4×/16×/64× synthetic multiplications, **not** real R-S/R-L; WAL/DELETE non-interleaved so any read advantage is UNVERIFIED; `synchronous=FULL`, reader/writer contention and 2-hop not run because not pre-registered; no insufficient-N/invalid M-L3 cell; all M-L3 caveats preserved). **M-L7 only: R-S, R-L, M-L6 and G1–G9 NOT started/evaluated; thresholds, datasets, parser, DB settings, worker count, production code, reference repos and existing evidence untouched; nothing committed.** Plan LRF-13: cold start is "recorded (informational; no gate number without evidence)".

**Pre-registered definition (plan §6 M-L7):** "fresh process first-file per language vs warm steady state (E6 method reused); cold line items (grammar init, query compile, first parse) vs warm per-file"; unit = process.
**Method (E6, `specs/002-ast-symbol-intelligence/query-cold-start-results.md` §3, re-implemented in `scripts/t007-local/m-l7.ts`; the E6 script was NOT run because it overwrites a Feature 002 results file).** Four modes, each in a FRESH `bun` process: `first` (10 real files in order), `split` (first-file line items), `init` (first vs second-language `getParser`), `warm` (100 files cycling the 10-file set). Sample sizes: **20 fresh processes per language per cold mode** (E6 used 10; 20 chosen so p95 ≠ max and to meet the protocol's ≥20 rule — a sample-size choice, not a protocol change) and **3 warm processes per language** (as E6). Per repetition, languages × modes were interleaved; warm runs last. Every process: single main thread, no DB, production `getParser` + `toIntermediateRepresentation` unmodified, harness `installWasm` (§1 mechanism).
**Cold/warm definitions actually used.** *Cold* = **process-cold**: fresh `bun` process, empty module state, cold JIT, no compiled Query cache, no grammar loaded, fresh `WebAssembly.compile`. **OS page cache was NOT dropped** (needs privileges), so grammar/WASM/source files are OS-cache-warm — no stronger cold definition was measured. *Warm* = inside an already-primed process; files 11–100 of a 100-file cycle pooled as steady state. Cold and warm are never averaged.
**Files.** Real files of 1–16 KiB, sorted, 10 evenly spaced per language (selection rule fixed before running): TS/TSX from the repo-atlas R-M snapshot copy, JS from the GitNexus R-L snapshot copy, Java from the iata-one-order R-L snapshot copy (**JAXB-generated classes — disclosed limitation**; GitNexus has only 9 Java files in range, all tiny test fixtures). Sizes (bytes): java: [15017, 5008, 6940, 3744, 7528, 15039, 5282, 2315, 2753, 2387]; javascript: [9736, 9736, 9592, 2708, 1254, 1056, 1372, 1920, 1038, 1026]; typescript: [1384, 3634, 4094, 5526, 3447, 1607, 2989, 4825, 11042, 6480]; tsx: [1649, 2264, 2765, 4183, 7226, 7360, 2232, 1552, 2820, 11921]. All under `.cache/t007-local/datasets/` (git-archive scratch copies; reference repos not touched). Load average 2.3→2.8, AC power, env in the JSON.
**Evidence (new files):** `evidence/t007-local/m-l7-cold-start.json` (summary, file sets, environment), `m-l7-raw.json` (every process's raw record); console `.cache/t007-local/m-l7.log`; harness `scripts/t007-local/m-l7.ts`.

### 14.1 Cold, fresh process (n = 20 processes per cell; ms)
| item (ms, median / p95 / max) | java | javascript | typescript | tsx |
|---|---|---|---|---|
| process wall, `first` mode (bun start → exit, 10 files) | 53.81 / 54.51 / 54.58 | 87.09 / 91.67 / 93.02 | 64.71 / 69.67 / 70.09 | 62.19 / 64.06 / 78.12 |
| module import of our code | 3.08 / 3.69 / 3.80 | 3.40 / 3.72 / 3.93 | 3.00 / 3.82 / 4.19 | 2.99 / 3.53 / 3.63 |
| WASM compile core + 4 grammars (local-only) | 8.11 / 8.40 / 8.43 | 8.16 / 8.55 / 8.78 | 8.10 / 8.95 / 8.97 | 8.06 / 8.52 / 11.65 |
| first `getParser` (core init + language + Parser()) | 4.31 / 4.77 / 4.85 | 4.45 / 4.99 / 5.15 | 4.68 / 5.14 / 5.37 | 4.90 / 5.29 / 5.38 |
| 2nd-language `getParser` (init mode) | 0.33 / 0.41 / 0.42 | 0.38 / 0.45 / 0.51 | 0.63 / 0.72 / 0.76 | 0.64 / 0.74 / 0.76 |
| first-file parse (split mode) | 3.10 / 3.24 / 3.28 | 4.55 / 4.66 / 4.68 | 2.01 / 2.11 / 2.25 | 2.26 / 2.33 / 2.41 |
| Query compile, cold, standalone | 3.16 / 3.37 / 3.37 | 4.43 / 4.61 / 4.64 | 12.30 / 12.65 / 13.37 | 12.77 / 13.00 / 13.18 |
| Query exec, cold | 1.36 / 1.45 / 1.49 | 1.25 / 1.33 / 1.34 | 0.84 / 0.96 / 0.96 | 0.88 / 0.95 / 0.96 |
| Query exec, warm (same tree, 2nd call) | 0.42 / 0.46 / 0.47 | 0.45 / 0.49 / 0.50 | 0.09 / 0.10 / 0.10 | 0.16 / 0.18 / 0.20 |
| Σ getParser + parse + compile + exec (request-time work) | 12.34 / 12.64 / 12.73 | 14.70 / 15.25 / 15.36 | 19.95 / 20.58 / 20.98 | 20.64 / 21.47 / 21.52 |
| file #1 parse + extraction (`first` mode) | 8.50 / 8.93 / 9.05 | 10.94 / 11.14 / 11.34 | 15.66 / 16.13 / 16.17 | 16.36 / 16.90 / 21.69 |
| file #2 | 0.76 / 0.81 / 0.85 | 2.42 / 2.70 / 2.71 | 1.20 / 1.39 / 1.39 | 1.00 / 1.13 / 2.30 |
| file #3 | 1.04 / 1.15 / 1.22 | 3.29 / 3.60 / 3.67 | 1.34 / 1.49 / 1.50 | 0.90 / 1.01 / 1.97 |
| file #10 | 0.42 / 0.55 / 0.57 | 0.36 / 0.51 / 0.95 | 1.44 / 1.60 / 1.71 | 1.81 / 1.90 / 1.93 |

### 14.2 Warm steady state (3 processes × 100 files; ms; pooled rows: n = 27 (files 2–10), 120 (11–50), 150 (51–100), 270 (11–100); file-#1 and totals n=3 so p95 = max)
| item (ms, median / p95 / max) | java | javascript | typescript | tsx |
|---|---|---|---|---|
| file #1 in a fresh process (n=3) | 8.40 / 8.78 / 8.78 | 10.83 / 10.86 / 10.86 | 16.01 / 16.18 / 16.18 | 16.56 / 16.62 / 16.62 |
| files 2–10 | 0.67 / 1.84 / 2.91 | 0.37 / 3.48 / 3.52 | 1.33 / 2.70 / 2.71 | 0.97 / 2.09 / 2.27 |
| files 11–50 | 0.34 / 0.94 / 1.11 | 0.20 / 1.84 / 2.03 | 0.69 / 1.90 / 2.32 | 0.48 / 1.28 / 1.69 |
| files 51–100 | 0.25 / 0.75 / 0.87 | 0.17 / 1.59 / 1.76 | 0.56 / 1.80 / 2.01 | 0.44 / 1.18 / 1.36 |
| **steady state, files 11–100 (parse + extraction)** | 0.30 / 0.91 / 1.11 | 0.18 / 1.60 / 2.03 | 0.62 / 1.85 / 2.32 | 0.45 / 1.21 / 1.69 |
|   of which parse only | 0.20 / 0.58 / 0.76 | 0.13 / 1.31 / 1.48 | 0.48 / 1.47 / 1.64 | 0.36 / 0.97 / 1.19 |
|   of which extraction (toIR) only | 0.09 / 0.31 / 0.38 | 0.06 / 0.31 / 0.59 | 0.13 / 0.38 / 0.73 | 0.09 / 0.27 / 0.54 |
| total for 100 files (per process, n=3) | 48.18 / 48.60 / 48.60 | 63.83 / 63.94 / 63.94 | 91.16 / 91.51 / 91.51 | 77.58 / 77.96 / 77.96 |

### 14.3 Observations and caveats
- **FACT** — Fixed once-per-process cost before any file: module import ≈3–3.4 ms + WASM compile ≈8.1 ms (local-only) + first `getParser` ≈4.3–4.9 ms; a second language adds only ≈0.3–0.64 ms. Cold **Query compile is the dominant language-specific item: ≈12.3–13.0 ms for TS/TSX vs ≈3.2–4.4 ms for Java/JS**; cold parse 2.0–4.6 ms.
- **FACT** — First file is 8.5–16.4 ms (parse + extraction) vs steady-state 0.18–0.62 ms/file: the cold penalty is one-time per process per language. File #2 is already ≈0.4–2.4 ms.
- **FACT** — Whole-process wall (bun start → exit, 10 files) is 54–87 ms per language.
- **Caveat (not like-for-like across languages)** — file #1 differs in size per language (Java 15,017 B; JS 9,736 B; TS 1,384 B; TSX 1,649 B), so cross-language first-file comparisons are confounded by size; the Query-compile line items are size-independent. JS/Java samples are not repo-atlas code; Java is generated code.
- **Caveat** — small absolute times (sub-ms to ms) at `performance`/`hrtime` resolution; warm p95 is inflated by GC/JIT tail; TSX cold cell max 21.7 ms (one slow process; cv 0.07); warm file-#1 and totals have n=3.
- **Comparison to E6 (informational only, different file sets/date)** — first-file TS 15.7 ms here vs 23.3 ms in E6; `getParser` 4.3–4.9 ms (E6 4.3–4.8); cold TS/TSX compile 12.3–13.0 ms (E6 12.8–13.2). Not used to derive any threshold.
- **Limits** — process-cold only (OS cache warm); WASM Tree-sitter under Bun, not native (Rust-repeat register: cold start YES); local wall-clock, not Cloudflare CPU; no worker-thread cold start (M-L4/M-L5 cover worker init at repository scale — including D7 serialized WASM init); no DB in the path.
- **Not a gate result.** LRF-13 is informational; G1–G9 are NOT evaluated.

## 15. M-L5 — R-S and R-L repository-scale runs (2026-09-27 18:32 +04:00) — MEASURED RESULTS, NO GATE VERDICTS

Continuation instruction executed exactly: **R-S and R-L only.** M-L1–M-L4, M-L7 unchanged/not re-run; **M-L6, L13, L14, S-L2, G1–G9 NOT started/evaluated**; no threshold, dataset, parser/DB setting, worker-count or protocol change; no production code, `src/`, `tests/`, schema, lease/retry setting or reference repo touched; no commit/push; no task checkbox ticked. Harness: existing `scripts/t007-local/run-scale.ts` (unmodified) against the pre-existing, already-qualified dataset templates (`.cache/t007-local/datasets/{repo-atlas-rs,gitnexus-rl,iata-rl}/template.db`, built by `prepare-datasets.ts` in the S-L1 pass; not regenerated). **Basis: LOCAL-RUNTIME (WASM Tree-sitter under Bun) + unmodified production symbols pipeline + PROTOTYPE relationship stage** (same as M-L5 R-M, §7). Harness rev: `revB (sequential worker init; indexed fe join)`, `initMode: sequential` (D7 serialized-init workaround still in force). Environment hash `e2b32efaacbd45bf` for every run below — **identical to the frozen reference environment** (`environment-frozen.json`; same machine as R-M/M-L1–M-L4/M-L7). Protocol as pre-registered (plan §6 M-L5, §2 statistics rule): 3 cold runs per cell (fresh DB copy of the dataset template + fresh child process per run, cold start included in process wall), concurrency 1 and 2 (`ATLAS_MAX_CONCURRENT_ANALYSES`), median/p95/max (n=3 → p95=max by the nearest-rank rule). New evidence files only: `m-l5-repo-atlas-rs-c{1,2}.json`, `m-l5-gitnexus-rl-c{1,2}.json`, `m-l5-iata-rl-c{1,2}.json` (18 runs total). Three untracked timing probes (1 run each, `--tag probe --prefix probe`, used only to bound wall time before committing to the 3-run matrix) were run first and their evidence files deleted; they are not part of the measurement record and their numbers are not cited below.

### 15.1 Datasets used (unchanged from S-L1 qualification, §5; re-verified by this run's own `tier1Files`/graph counts, which match)

| Dataset name | Tier | Commit (pinned, unchanged) | Tier-1 files (this run) | Qualification |
|---|---|---|---|---|
| `repo-atlas-rs` (repo-atlas `src/lib`) | R-S | `430e1703386ebd9264122d54a3ba398d43b363f9` | 83 | QUALIFIES (≤100 Tier-1) — real-repository subset, same commit as R-M |
| `gitnexus-rl` (GitNexus, `../repotlas-references`, read-only) | R-L JS/TS | `233ca28492f5dd8957425e273779f1571cd45035` | 3,174 (91.7% JS/TS of Tier-1) | QUALIFIES on the plan's Tier-1 reading; raw tracked files 5,666 > 5,000 (owner-confirmed flag preserved, §5) |
| `iata-rl` (iata-one-order, owner's local repo, read-only) | R-L Java | `a686149cbd00f8186022030d687aed4d8efdb3be` | 1,304 (100% Java) | QUALIFIES numerically; **JAXB-generated-classes representativeness caveat preserved** (§5) — 1,302/1,304 files are generated model classes, weak CALLS/EXTENDS/IMPLEMENTS exercise |

No repository or dataset substitution occurred. `iata-one-order` was not touched beyond the pre-existing read-only `git archive` snapshot from S-L1; no new `git` command was run against it or against `../repotlas-references/` in this pass.

### 15.2 Run matrix and results (median / p95 / max over 3 runs; n=3 ⇒ p95=max)

| Dataset (tier) | c | engine wall (ms) | process wall (ms) | peak RSS (MiB) | CPU user+sys (ms, run 0) | CPU÷wall (run 0) | files/s (run 0) | rel/s (run 0) | resolutions/s (run 0) | deterministic |
|---|---|---|---|---|---|---|---|---|---|---|
| repo-atlas-rs (R-S) | 1 | 345.6 / 348.5 / 348.5 | 398.9 / 399.4 / 399.4 | 202.7 / 202.9 / 202.9 | 546.5+90.3=636.8 | 1.83 | 238.2 | 6,698 | 5,324 | yes (1 hash) |
| repo-atlas-rs (R-S) | 2 | 324.1 / 387.1 / 387.1 | 383.6 / 443.9 / 443.9 | 267.7 / 275.5 / 275.5 | 753.7+107.2=860.9 | 2.22 | 214.4 | 6,030 | 4,792 | yes (1 hash) |
| gitnexus-rl (R-L JS/TS) | 1 | 39,609.9 / 39,722.4 / 39,722.4 | 39,784.2 / 39,890.6 / 39,890.6 | 755.6 / 760.0 / 760.0 | 22,847.7+11,744.9=34,592.6 | 0.87 | 79.9 | 7,978 | 7,459 | yes (1 hash) |
| gitnexus-rl (R-L JS/TS) | 2 | 29,438.9 / 30,567.8 / 30,567.8 | 29,638.4 / 30,768.4 / 30,768.4 | 1,067.6 / 1,085.2 / 1,085.2 | 24,211.3+13,894.1=38,105.4 | 1.25 | 103.8 | 10,367 | 9,693 | yes (1 hash) |
| iata-rl (R-L Java) | 1 | 3,702.0 / 3,840.1 / 3,840.1 | 3,788.1 / 3,924.1 / 3,924.1 | 418.8 / 421.0 / 421.0 | 2,664.1+1,175.0=3,839.1 | 1.00 | 339.6 | 6,359 | 2,369 | yes (1 hash) |
| iata-rl (R-L Java) | 2 | 3,671.0 / 3,671.7 / 3,671.7 | 3,766.9 / 3,767.7 / 3,767.7 | 601.97 / 615.3 / 615.3 | 3,026.8+1,262.6=4,289.4 | 1.17 | 355.2 | 6,652 | 2,478 | yes (1 hash) |

Speedup c=2 vs c=1 (median engine wall): repo-atlas-rs 1.07× (335→324; small-n noise, run 0 of c=2 was slowest of its 3), gitnexus-rl 1.35× (39,610→29,439), iata-rl 1.008× (3,702→3,671 — effectively no speedup). 0 `attemptsSum`, 0 `reclaimsSum`, 0 `busyErrors`, 0 `retries`, 0 `duplicateKeys`, **0 invariant violations** in every cell.

### 15.3 Correctness / counts (identical across c=1 and c=2 for every dataset — same graph hash both concurrencies)

| Dataset | Graph hash | Symbols | Files (graph) | Relationships | Candidates | DB size (MiB) | Extraction status |
|---|---|---|---|---|---|---|---|
| repo-atlas-rs | `1e80b0c0e6bc20ab…` | 371 | 92 | 2,334 | 103 | 1.2 | extracted 82, failed 1, skipped_unsupported 9 |
| gitnexus-rl | `cd7e50df0857d3f6…` | 12,660 | 5,666 | 316,895 | 300,790 | 127.2–127.4 | extracted 3,056, failed 118, skipped_unsupported 2,492 |
| iata-rl | `2007179fb5109344…` | 13,937 | 1,369 | 24,420 | 0 | 15.0 | extracted 1,304, skipped_unsupported 65 |

Evidence-state distribution (relationship counts by type/state, run 0 of c=1; c=2 identical):
- **repo-atlas-rs**: CALLS RESOLVED 704 / AMBIGUOUS 42 / UNKNOWN 660 (48% UNKNOWN); IMPORTS RESOLVED 170 / UNKNOWN 34; EXPORTS RESOLVED 234; EXTENDS RESOLVED 8 / UNKNOWN 1; IMPLEMENTS RESOLVED 2; CONTAINS EXTRACTED 479.
- **gitnexus-rl**: CALLS RESOLVED 51,824 / AMBIGUOUS 32,057 / UNKNOWN 197,512 (**62% of CALLS UNKNOWN**, higher than R-M's 69%-of-8,294 in absolute count but a comparable rate; AMBIGUOUS rate 10.1% here vs 6.5% on R-M); IMPORTS RESOLVED 6,656 / AMBIGUOUS 37 / UNKNOWN 4,600; EXPORTS RESOLVED 3,433; EXTENDS RESOLVED 78 / AMBIGUOUS 22 / UNKNOWN 55; IMPLEMENTS RESOLVED 22 / AMBIGUOUS 10 / UNKNOWN 2; CONTAINS EXTRACTED 20,587.
- **iata-rl**: only CALLS UNKNOWN 145, IMPORTS UNKNOWN 8,952, CONTAINS EXTRACTED 15,323 — **no RESOLVED, AMBIGUOUS or EXPORTS/EXTENDS/IMPLEMENTS rows at all, and 0 candidates**, consistent with the pre-registered JAXB-generated-classes caveat (§5): generated getter/setter/builder classes exercise almost no cross-file CALLS/EXTENDS/IMPLEMENTS resolution.

### 15.4 Observations (labels per evidence discipline)

- **FACT** — All 18 runs (2 concurrencies × 3 tiers × 3 repetitions) produced exactly one graph hash per dataset across both concurrencies, 0 invariant violations, 0 duplicate keys, 0 job attempts beyond the first, 0 reclaims, 0 busy errors. This is determinism/idempotency evidence at R-S and R-L scale, additive to the existing R-M evidence (§7, §11); **it is not a G1 verdict** (G1–G9 remain unevaluated, and G1 also requires the F-1 resumed-run comparison and M-L6 graph-diff, neither of which was run at R-S/R-L in this pass).
- **FACT** — GitNexus (R-L, 3,174 Tier-1 files, 13.3× R-M's Tier-1 file count) ran in 39.6 s (c=1) / 29.4 s (c=2) wall, well inside the [ENG] G4 R-L bound of 30 min (not evaluated as a gate here, only reported against the number named in the plan). Peak RSS 755.6 MiB (c=1) / 1,067.6 MiB (c=2) — the c=2 figure is 71% of the [ENG] G5 bound of 1.5 GiB (again, reported, not gated).
- **FACT — item 12 of the continuation instruction (M-L1/M-L2 "ordinary large files ~4× per 2× input" finding, captured at repository scale, not reinterpreted).** That finding was about **per-file** cost growth as one file's *symbol density* grows (B7/B8 bands, and the M-L3 §13.4 R3 scaling artifact where cloned symbols share one file's extraction). At repository scale, R-L file counts grew 13.3× (GitNexus) and 5.5× (iata-rl) over R-M's Tier-1 count while median-file size stayed small (S-L1/M-L7 evidence: files are 1–16 KiB typical), and **no super-linear blow-up was observed**: files/s fell only moderately (R-M 151–175 → GitNexus 79.9–103.8, iata-rl 339.6–355.2 — iata-rl is *faster* per file than R-M, consistent with its files being simpler/generated), rel/s and resolutions/s at R-L are *higher* than at R-M (GitNexus 7,978–10,367 rel/s vs R-M's 6,788–7,867). This is consistent with the B7/B8 mechanism being **file-size/density-driven, not repository-file-count-driven**, and no fixture in this R-S/R-L run approached the B7 (4 MiB+) size band. **UNVERIFIED beyond this**: whether a repository containing even a handful of B7/B8-band files would reproduce the stall at repository scale — not tested here (out of scope for R-S/R-L; would need a repository-scale run seeded with an oversized file, not requested).
- **FACT** — iata-rl shows essentially no c=1→c=2 speedup (3,702→3,671 ms, 1.008×) while GitNexus shows 1.35× and repo-atlas-rs shows ~1.07× (noisy at this size). iata-rl's persist share (parsedPersistShare 52%→68% c1→c2) and CPU÷wall (1.00→1.17) pattern resembles repo-atlas-rs more than GitNexus; **cause UNVERIFIED** — plausibly the small per-file work (0 candidates, near-zero relationship resolution) leaves less parallelizable work relative to fixed persist/lock overhead, but no controlled variable was isolated to confirm this (would need a persist-stubbed run, not run here).
- **FACT** — iata-rl produced **zero relationship candidates** and no RESOLVED/AMBIGUOUS rows of any type — a stronger version of the pre-registered representativeness caveat than a rate observation: the dataset exercises the CONTAINS/EXTRACTED and IMPORTS/UNKNOWN paths only. This does not disqualify the dataset (protocol has no non-generated criterion, per §5) but means **iata-rl's R-L evidence characterizes throughput/memory/determinism at file-count scale, not relationship-resolution behavior at scale** — GitNexus is the only R-L data point that exercises resolution at scale.
- **Caveat** — as at R-M, `synchronous=NORMAL` only; single machine; OS page cache not dropped; no concurrent reader/writer measurement; no worker-thread-crash injection in this pass (F-1/F-1c kill/restart tests were run only on R-M and R-S in earlier M-L4 work, §11 — not re-run here); RSS is process-wide peak via the 50 ms sampler (same method as R-M), not per-worker.
- **Not a gate result.** No G1–G9 score is stated or implied. These are M-L5 measurements at the R-S/R-L tiers, extending the existing R-M M-L5 evidence (§7) to complete the plan §5.2/§6 repository-tier matrix.

### 15.5 Failures / retries / reclaims

None. Every cell: `attemptsSum=0`, `reclaimsSum=0`, `busyErrors=0`, `reclaimed=0`, `retries=0`, `duplicateKeys=0`, `invariantViolations=[]`. No F-1…F-6 failure-suite test was run at R-S/R-L in this pass (F-1…F-6 were run at R-M in M-L4, §11, and F-1/F-1c partly reused `repo-atlas-rs` DB files as scratch — see the stray `.cache/t007-local/runs/repo-atlas-rs--crash-*.db` files from that earlier work, untouched here). No deviation from the pre-registered protocol was required or made.

### 15.6 Deviations from protocol

None. Three ad hoc timing probes (§ intro) were run and their evidence deleted before the pre-registered 3-run matrix; this is an operational choice about how many runs to schedule, not a measurement or a protocol change, and no probe number is cited anywhere in §15.1–15.5.

### 15.7 Evidence paths

`specs/004-engineering-relationship-graph/evidence/t007-local/m-l5-repo-atlas-rs-c1.json`, `m-l5-repo-atlas-rs-c2.json`, `m-l5-gitnexus-rl-c1.json`, `m-l5-gitnexus-rl-c2.json`, `m-l5-iata-rl-c1.json`, `m-l5-iata-rl-c2.json` (each: environment, per-run raw record, summary stats, graph hash, invariants, evidence-state distribution, job/CPU/RSS series). Dataset provenance: `dataset-inventory.json` (§5, unchanged). Reference environment: `environment-frozen.json` (unchanged, re-confirmed by envHash match).

### 15.8 Remaining T007 work (unchanged in kind; R-S/R-L scale now done)

**M-L5 is now complete across all three repository tiers (R-M, R-S, R-L).** Still not started: **M-L6** (incremental INC-0…3 on R-M), **L13** (evidence artifact `t007-local-feasibility-results.md`), **L14** (gate evaluation G1–G9), **S-L2** (owner review). This session did not start M-L6 (task instruction explicitly scoped R-S/R-L only and named the next-measurement boundary as clear). **G1–G9 remain NOT EVALUATED.** No commit, no push.

## 16. M-L6 — incremental / no-change measurement (2026-09-27 18:41 +04:00) — MEASURED RESULTS, NO GATE VERDICTS

Continuation instruction executed exactly: **M-L6 only.** M-L1–M-L5, M-L7 unchanged/not re-run; **L13, L14, S-L2, G1–G9 NOT started/evaluated**; no threshold, dataset (for R-M/R-S/R-L), parser/DB setting, worker-count or protocol change; no production code, `src/`, `tests/`, schema, lease/retry setting or reference repo touched; no commit/push; no task checkbox ticked. Dataset: `repo-atlas-rm` (unchanged, commit `430e1703386ebd9264122d54a3ba398d43b363f9`) for INC-0/INC-1; two **new** derived datasets for INC-2/INC-3 (created this pass, §16.1). Basis: LOCAL-RUNTIME (+PROTOTYPE relationship stage), same as all prior M-L5. Environment hash `e2b32efaacbd45bf` (frozen reference environment, unchanged) for every run. Harness: two new scripts, `scripts/t007-local/prepare-inc-datasets.ts` (dataset preparation only) and `scripts/t007-local/m-l6-inc01.ts` (INC-0/INC-1 pairing); INC-2/INC-3 measurement itself reused the **existing, unmodified** `run-scale.ts` against the new dataset names — no new measurement code for INC-2/INC-3, only new dataset templates.

### 16.1 Method — how the "real content edit" was produced (plan §5.3: "committed to a scratch clone… never a fabricated DB state")

A **scratch git clone** of repo-atlas (`git clone` from `REPO_ROOT`, landing in `.cache/t007-local/inc-repo/`, gitignored, never the working checkout) was pinned to the R-M commit (`430e170…`, verified by `rev-parse HEAD`). Two real edits were made and committed there, never in the working repository:
- **INC-2**: one real Tier-1 file (`src/lib/atlas-config.ts`) got one appended line (`// T007-LOCAL M-L6 INC-2 scratch content edit`) → committed → new commit `3411c44…`.
- **INC-3**: scratch clone reset to `430e170…` again, then **24 of the 239 Tier-1 files** (every 10th file by sorted path — a fixed, pre-declared selection rule, not cherry-picked) got the same one-line append → committed → new commit `5cc0542…`. 24/239 = **10.04%** of Tier-1 files, matching the plan's "~10%" INC-3 definition.
- Each commit was `git archive`d and ingested through the **unmodified** `extractTree`/`ingestLocalSnapshot` pipeline (same mechanism as `prepare-datasets.ts`) into its own new dataset template (`repo-atlas-inc2`, `repo-atlas-inc3`), each qualifying identically to R-M (473 raw files, 239 Tier-1 files — unchanged, since only file *content*, not the file set, changed).
- Evidence: `evidence/t007-local/m-l6-inc-dataset-inventory.json` (commits, files changed, inventory).

**Deviation, disclosed, not silent**: this is the ONLY mechanism plan §5.3 could be executed against, because **no cross-snapshot incremental-reuse code exists** in the harness or in the production path under test — `classifyJobs` (`scripts/t007-local/lib/unit.ts:476`) enqueues one job per file for whatever snapshot id it is given, with no reference to any other snapshot. This was already flagged as an open item in an earlier checkpoint ("M-L6 incremental (mechanism unwritten)", `docs/session_handoffs/CURRENT.md` 2026-09-25 22:55 entry) and is **not** a new finding — this pass measures the consequence of that gap directly, rather than inventing a scoped-incremental code path (which would be a production-code change, out of scope and not authorized).

### 16.2 INC-0 (full baseline) and INC-1 (no-change re-run) — 3 reps, workers=2, same DB per rep (`m-l6-inc0-inc1.json`)

| | INC-0 (full, fresh DB) | INC-1 (immediate re-run, same DB/snapshot) |
|---|---|---|
| engine wall ms (median/p95/max) | 1128.5 / 1181.6 / 1181.6 | **0 / 0 / 0** |
| process wall ms (median/p95/max) | 1192.1 / 1249.0 / 1249.0 | 29.9 / 34.6 / 34.6 |
| shortCircuitedRun | false (all 3) | **true (all 3)** |
| graph hash | `616ca53f21ca…` (= the existing R-M reference hash) | `616ca53f21ca…` (identical to INC-0, trivially — INC-1 writes nothing) |
| enqueued jobs | 706 (239 parsed + 239 symbols + 1 dirs + 227 contains… exact count in JSON) | **0** |

**Reduction (INC-1 vs INC-0, engine wall): 100% in all 3 reps** (0 ms vs ~1128 ms). This is the pre-registered FR-009 short-circuit mechanism, which **does** exist in the harness (`engine.ts:65-73`, "guarantee 2") — unlike the cross-snapshot incremental path, the same-snapshot no-change short-circuit was already built and had been exercised once before under M-L4 F-4 ("whole-run re-enqueue spawns no workers, 7 ms", §11); this pass repeats it as its own pre-registered INC-1 measurement, on 3 fresh reps, paired directly with an INC-0 baseline on the same DB. **G7 interpretation (not evaluated, recorded only): 100% reduction clears the pre-registered "≥95% cheaper" bar with large margin.**

### 16.3 INC-2 (1 file changed, new snapshot) and INC-3 (24 files / 10.04% changed, new snapshot) — 3 reps × workers {1,2}

| Dataset | c | engine wall ms (median/p95/max) | process wall ms | peak RSS MiB | graph hash | relationships | deterministic |
|---|---|---|---|---|---|---|---|
| INC-2 | 1 | 1158.6 / 1164.2 / 1164.2 | 1216.4 / 1221.3 / 1221.3 | 262.4 / 265.8 | `616ca53f21ca…` | 10,755 | yes |
| INC-2 | 2 | 1038.5 / 1064.5 / 1064.5 | 1101.2 / 1133.1 / 1133.1 | 330.3 / 339.0 | `616ca53f21ca…` | 10,755 | yes |
| INC-3 | 1 | 1177.0 / 1180.8 / 1180.8 | 1232.3 / 1235.7 / 1235.7 | 260.9 / 264.5 | `616ca53f21ca…` | 10,755 | yes |
| INC-3 | 2 | 1049.4 / 1076.1 / 1076.1 | 1114.6 / 1144.1 / 1144.1 | 336.97 / 353.2 | `616ca53f21ca…` | 10,755 | yes |

**Headline finding (FACT):** INC-2 (1 file changed) and INC-3 (24 files changed) cost **statistically the same as INC-0** (full baseline: 1128.5 ms median at c unspecified-but-comparable / this INC-0 run was c=2 only — compare INC-2/INC-3 c=2 medians 1038.5/1049.4 ms directly to INC-0's 1128.5 ms c=2 median: within ~7–9%, i.e. **no incremental saving of any size**, consistent with §16.1: every job in the new snapshot is enqueued and run regardless of how many files actually changed. **INC-2 ≈ INC-3 ≈ INC-0**, not "cost scales with the change" (the plan's G8 property). This is the direct, expected consequence of the missing cross-snapshot mechanism, not a new or surprising result, and is recorded as a measurement, not a gate verdict.
**Graph hash is identical to the R-M reference hash in every INC-2/INC-3 run** (`616ca53f21ca…`, same as INC-0) — **because the edit was a trailing comment line**, which the parser/symbol/relationship pipeline does not turn into any symbol, relationship or CONTAINS change; relationship/candidate/symbol counts (10,755 / 2,139 / 662) are byte-identical to the unedited R-M graph. This is a **property of the chosen edit type** (comment-only, deliberately non-semantic so as not to introduce a real syntax/behavior change into the fixture), not evidence that the pipeline ignored the file content edit — `snapshot_files`/blob content hashes differ between the R-M template and the INC-2/INC-3 templates (new commit shas, new blobs for the edited files), confirmed by the new dataset inventory (`m-l6-inc-dataset-inventory.json`) recording the new commits.
**"Graph diff against a from-scratch run" (plan §5.3) — adapted, documented as a deviation in method, not in outcome:** because no separate incremental-recompute code path exists to diff against a full recompute, the check reduces to the same determinism check already used for INC-0/R-M/R-S/R-L: 3 independent from-scratch runs of each changed snapshot, all producing the same hash (`deterministic: true` for both INC-2 and INC-3, both concurrencies). **This satisfies the check's intent (verify correctness) under the harness's actual capability, but does not exercise a genuine incremental-vs-full comparison — that comparison does not exist to be checked.**

### 16.4 Failures / retries / reclaims

None. INC-0/INC-1: `attemptsSum`/`reclaimsSum`/`busyErrors` fields not separately re-queried in `m-l6-inc01.ts` (job-sum query was not duplicated from `run-scale.ts` into the new script); `jobsAfter` for every INC-0 rep shows 0 `FAILED`/`RETRYING` beyond the 5 pre-existing R-M syntax-error files (same 5 as every prior R-M run, §7); INC-1 enqueues 0 jobs so no retry/reclaim is possible by construction. INC-2/INC-3 (via unmodified `run-scale.ts`, same job-sum query as M-L5): every cell `attemptsSum=0`, `reclaimsSum=0`, 0 invariant violations, 0 duplicate keys. No F-1…F-6 failure-suite test was run in this pass (those remain R-M-only, from M-L4 §11).

### 16.5 Deviations from protocol

1. **Cross-snapshot incremental-reuse mechanism does not exist** (§16.1) — disclosed, not silently worked around; INC-2/INC-3 measure the full-reprocessing cost the current mechanism actually produces, which is the honest answer to "what does this measurement show," not a fabricated incremental number.
2. **Graph-diff-against-from-scratch check reduced to a determinism check** (§16.3) for the same reason — no second, independently-computed "incremental" graph exists to diff against the full one; they are the same computation.
3. **Edit content was comment-only** (a deliberate choice to avoid introducing a real semantic/syntax change not authorized by the continuation instruction) — this is why INC-2/INC-3 graph hashes equal the unedited reference hash; documented in §16.3 so the identical hash is not misread as "the pipeline didn't see the edit."
4. No threshold, dataset (for the pre-existing R-M/R-S/R-L tiers), parser, DB setting, worker count or lease value was changed. No task checkbox ticked. No commit, no push.

### 16.6 Evidence paths

- `specs/004-engineering-relationship-graph/evidence/t007-local/m-l6-inc-dataset-inventory.json` (scratch-clone commits, files-changed list, dataset qualification for `repo-atlas-inc2`/`repo-atlas-inc3`)
- `specs/004-engineering-relationship-graph/evidence/t007-local/m-l6-inc0-inc1.json` (INC-0/INC-1 raw + summary)
- `specs/004-engineering-relationship-graph/evidence/t007-local/m-l6-repo-atlas-inc2-c1.json`, `-c2.json`; `m-l6-repo-atlas-inc3-c1.json`, `-c2.json`
- Harness: `scripts/t007-local/prepare-inc-datasets.ts` (new), `scripts/t007-local/m-l6-inc01.ts` (new); `scripts/t007-local/run-scale.ts` reused unmodified.
- Scratch clone (not evidence, not committed, gitignored): `.cache/t007-local/inc-repo/`.

### 16.7 Remaining T007 work

M-L1 through M-L7 are now all COMPLETE/characterized. **Remaining: L13 (evidence artifact `t007-local-feasibility-results.md`), L14 (gate evaluation G1–G9), S-L2 (owner review).** **G1–G9 remain NOT EVALUATED.** No commit, no push, T008+ NOT AUTHORIZED. Per the continuation instruction, execution stops here and does not proceed to L13, L14 or S-L2.

## 17. L13 — evidence consolidation (2026-09-27) — NO NEW MEASUREMENT

Continuation instruction executed exactly: **L13 only.** No new benchmark run, no threshold/dataset/parser/DB/protocol change, no production code touched, no task checkbox ticked, no commit/push. **L14, S-L2, G1–G9 NOT started/evaluated.**

Produced the registered artifact at the plan's own path (plan §10): `specs/004-engineering-relationship-graph/t007-local-feasibility-results.md`. It reconciles M-L0 through M-L7 against the plan §2 LRF register with an explicit evidence index (LRF-01…16 → measurement → evidence file → status), preserves every caveat/deviation/mechanism-gap already on record in §1–§16 above without reinterpreting any of them, reproduces the plan §9 gate table verbatim with every verdict left "NOT EVALUATED," and adds an "evidence sufficiency for L14" section naming gaps (B7/B8 partial coverage, G3 open items, no R-L concurrency-4/8 run, no inline baseline at R-S/R-L, degenerate M-L6 graph-diff) without resolving any of them. Full detail, all citations, and the complete text are in that file; this log entry is the pointer, not a duplicate.

**Remaining T007 work: L14 (gate evaluation, G1–G9), then S-L2 (owner review). G1–G9 remain NOT EVALUATED.** No commit, no push, T008+ NOT AUTHORIZED.

## 18. L14 — gate evaluation (2026-09-27) — EVALUATION ONLY, NO NEW MEASUREMENT

Continuation instruction executed exactly: **L14 only.** No production code, threshold, dataset, parser/DB setting, worker count or protocol change; no task checkbox ticked; no commit/push. **S-L2 NOT started; T008+ NOT AUTHORIZED regardless of any determination below.**

Produced two new files (companion documents, plan §9/§10-driven):
- `specs/004-engineering-relationship-graph/t007-local-gate-evaluation.md` — the full G1–G9 gate table with registered criterion/evidence/determination/limitation/follow-up per gate, the overall feasibility conclusion, the mandatory-gate (G1/G2/G3) summary, the file-size default/ceiling recommendation (explicitly separating measured evidence from engineering synthesis), and the follow-up register.
- `specs/004-engineering-relationship-graph/research-amendment-A7-draft.md` — the drafted A7 amendment text for S-L2 review, including proposed (not implemented) contract amendments addressing every G3 open item, a proposed G6 remediation direction, a proposed G8 incremental-mechanism direction, and the still-open G9/B7-B8 disposition choice. `research.md` itself was **not edited**.

**Determinations reached (full reasoning and evidence citations in the gate-evaluation file):** G1 PASS, G2 PASS, G3 CONDITIONAL, G4 PASS, G5 CONDITIONAL, G6 FAIL, G7 PASS, G8 CONDITIONAL, G9 FAIL. Per plan §9's clearance rule (mandatory gates need PASS with no conditionals), **T008+ clearance is not reached by this evidence set** — this is stated plainly, not softened.

**No new benchmark was run.** Three previously-captured-but-not-yet-surfaced evidence fields were read from existing JSON files (not re-measured) to make specific determinations: (a) `rssSlopeBytesPerUnitSecondHalf` / `rssFirstMiB`/`rssMidMiB`/`rssLastMiB` already computed and stored by `run-scale.ts` in every M-L5 evidence file, used for G5's slope check; (b) per-fixture `p95`/`insufficientN` fields inside `m-l12/B*.json` (not previously tabulated in the L13 consolidation, which only carried medians), used for G9's band-completeness check and the file-size recommendation; (c) per-fixture `rssGrowthMiB` in the `m-l12-bands-B1-B6.json` manifest, used for the same. All three are evidence-already-on-disk reads, explicitly permitted by the continuation instruction's rule 20 ("do not run additional measurements unless the existing plan explicitly requires an evaluation-time calculation from already captured evidence") — no child process was spawned, no dataset touched, no timing recorded.

**Notable evaluation-time finding, disclosed rather than buried:** applying the plan's own pre-registered G5 slope rule to the GitNexus R-L c=1 run shows material RSS growth (37.6–40.2% of mid-point RSS in the second half, vs the 15% material threshold) — not flat. Corroborating (not proving) context: even the smallest M-L1/M-L2 fixtures (B1, ≤4 KiB) show 92–199 MiB of RSS growth across 20 in-process iterations in a *different* harness code path, suggesting a measurable per-iteration accumulation exists independent of file size — this is stated as consistent-with, not proof-of, the same mechanism producing the R-L slope result, since the two measurements exercise different code (`m-l12-child.ts` iteration loop vs `worker.ts`/`unit.ts` per-file processing).

**Remaining T007 work: S-L2 (owner review of the gate-evaluation file and the A7 draft).** **G1–G9 are now evaluated as of this checkpoint (§18), but this evaluation is not a clearance decision** — only the owner's S-L2 review, acting on the A7 draft, changes the T007 gate outcome per plan §9. No commit, no push, T008+ NOT AUTHORIZED.

## 19. S-L2 — owner review (2026-09-27) — ANALYSIS ONLY, NO NEW MEASUREMENT

Continuation instruction executed exactly: **S-L2 analysis only.** No production code, `src/`, `tests/`, schema, config, threshold, dataset, evidence JSON or `research.md` change; no new benchmark; no task checkbox ticked; no commit/push. **T008 remains blocked; nothing in this pass authorizes it.**

Produced `specs/004-engineering-relationship-graph/t007-s-l2-owner-review.md`: reconciles the L14 gate table against the plan's own clearance rule (finding three independent blockers — G3 CONDITIONAL, G6 FAIL, G9 FAIL — not one), classifies every `research-amendment-A7-draft.md` item as ACCEPT/REJECT/DEFER/NEEDS-EVIDENCE with reasoning, walks all seven G3 open items individually (evidence/gap/proposed amendment/decision-required/blocks-T008), determines G6's disposition as "remediation required before T008" (not conditional acceptance, given the consistent 62–68% persist share across every tier), determines G8's disposition as "accepted follow-up, not a T008 blocker" (the clearance rule permits owner-accepted CONDITIONAL for non-mandatory gates), determines G9's disposition as "narrow/amend the criterion" (a third option beyond the two the A7 draft offered, since the recommended ceiling sits below where B7/B8 evidence is missing), confirms the file-size recommendation is engineering synthesis not a G9 pass and flags that accepting it requires an explicit ADR-001/D-ARCH-6 amendment (512 KiB moves from proposed-default to ceiling), and names four SpecKit follow-up tracks (ANALYSE→…→AUTHORIZATION) without executing any of them.

**Every determination in this file is stated as a recommendation for the owner's actual sign-off, not an invented decision** — where evidence and the plan's own rules make a disposition clear-cut, it is stated as such; where they do not (e.g., choosing between the PAUSED-state-vs-wording-amendment options), the item is left as NEEDS-EVIDENCE/DEFER rather than resolved by guess.

**T008 remains blocked** on three independent conditions (§H.10 of the review document): G3 resolution, G6 remediation-or-re-threshold, G9 criterion amendment — plus, separately, the A7 amendment itself being written into `research.md` with owner approval, which has not occurred. **Remaining T007 work: the owner's actual review/ratification of this record, then (if accepted) the four SpecKit follow-up tracks named in §K, then A7 written into `research.md`.** No commit, no push.

## 20. T007 remediation SpecKit planning (K.1/K.2/K.3) (2026-09-27) — PLANNING ONLY, NO IMPLEMENTATION

Continuation instruction executed exactly: owner ratified the S-L2 recommendations (§19); this pass runs the SpecKit ANALYSE→CHECKLIST cycle for the three T008-blocking tracks (K.1 G3, K.2 G6, K.3 G9) only. No production code, `src/`, `tests/`, schema, config, threshold, dataset, evidence JSON, `research.md`, or reference repo touched; no benchmark run; no task checkbox ticked; no commit/push. **T008 remains blocked; nothing in this pass authorizes it.**

Produced `specs/004-engineering-relationship-graph/t007-remediation-speckit-plan.md`, a new artifact (per this thread's own established convention of adding a new dated file per T007 phase rather than editing frozen ones). Research phase read actual source (not inferred): `contracts/local-job-engine.md` in full (48 lines — confirmed no fencing token, no CANCELLED state, no numeric lease/retry/backoff defaults anywhere in the document); `scripts/t007-local/lib/unit.ts` (confirmed the exact `tx()` call sites at `runSymbols`/`runContains`/`runParsed` — one `BEGIN IMMEDIATE…COMMIT` per file per job kind, the literal root cause of G6's persist share, now traced to `unit.ts:415` rather than inferred from M-L3's adjacent evidence); `scripts/t007-local/lib/jobs.ts` (confirmed the reclaim `UPDATE` at line ~135 omits `attempts` from its SET clause, and found a *third* cancel-adjacent mechanism — `cancelHalt`/`clearCancelHalt` — not previously distinguished from `cancel()` in prior checkpoints); `scripts/t007-local/lib/rel.ts` (`persistRows` is transaction-agnostic, so K.2's batching change can be made entirely in its callers without touching the insert logic itself — a lower-risk finding than assumed); and three exact document locations that call 512 KiB "the default" (`docs/architecture/ADR-001-local-first-runtime.md:29,135`, `research.md:213`), confirmed by direct search, for K.3.

Produced: 6 proposed requirements for K.1 (SYM-01..06), 4 for K.2 (PERSIST-01..04), 3 for K.3 (FSIZE-01..03), each with ID/rationale/source/acceptance-condition/affected-component; a change-type-separated implementation plan with an explicit dependency graph; 18 numbered tasks (RT-01..RT-18) including three gate-validation tasks (RT-08 for G3, RT-14 for G6, RT-16 for G9); and a 13-item pre-execution checklist, of which 2 items are explicitly flagged **not yet resolved** (the F002-boundary scope for symbol identity, and the batch-axis/scope choice for persist batching) and 2 are **conditional** (durability re-verification against the batched variant; rollback behavior not yet built/tested) — disclosed, not hidden.

**Remaining T007 work: owner resolution of the still-open SPECIFY-level ambiguities (RT-01, RT-09, the PAUSED-state-vs-wording choice), then authorization of the specific RT-tasks by name — this pass does not authorize any of them.** No commit, no push, T008 remains blocked.

## 21. T007 remediation decision resolution (2026-09-27) — DECISIONS RECORDED, NO IMPLEMENTATION

Continuation instruction executed exactly: owner resolves the SPECIFY-level ambiguities left open at §20. No production code, `src/`, `tests/`, schema, config, threshold, dataset, evidence JSON, `research.md`, or reference repo touched; no benchmark run; no task checkbox ticked; no commit/push; **no gate score changed; no implementation authorized.**

Applied a "Decision Resolution Addendum" (D1–D7) to `t007-remediation-speckit-plan.md`, superseding (not deleting) the prior open-ambiguity text:
- **D1 (RT-01)**: symbol-identity-stability stays inside F004's resolver layer; F002 schema not touched; a hard-stop escalation rule recorded (raise a cross-feature amendment, don't silently touch F002, if the existing schema proves insufficient).
- **D2 (PAUSED)**: introduced as an explicit eighth job state (not a guarantee-7 wording workaround), with full semantics specified — meaning, valid transitions in/out, interaction with cancel/cancelHalt/leases/retries-reclaims, terminal=false, and a persistence requirement that **corrects this plan's own earlier classification**: PAUSED is now recorded as a harness-implementation item (job-state model + rewriting `pause()`/`resume()` to move job rows, not just the `t7_control` flag), not documentation-only as Phase 4 originally had it.
- **D3 (RT-09)**: bounded row-count as the primary batching axis, file-count/elapsed-time as safety limits; per-file completion atomicity and per-file containment declared non-negotiable, with an explicit STOP-and-amend rule if they can't be preserved; M-L3's throughput evidence explicitly not treated as proof of G6 sufficiency.
- **D4 (G9)**: FSIZE-01's criterion-narrowing direction approved, scope confirmed as B1–B6 + real-minified (ceiling B5); **G9 remains FAIL** — approving the direction is not the same as the wording being formally written/approved (still RT-15/RT-16).
- **D5 (file-size)**: 64 KiB default / 512 KiB ceiling approved; the three stale-default document locations (ADR-001:29,135; research.md:213) explicitly left unedited in this pass, per instruction — deferred to a later documentation-amendment execution step.
- **D6/D7**: G5, G8 unchanged, confirmed.

Phase 4's change-type table and Phase 6's checklist were corrected in place to reflect PAUSED's reclassification and the now-resolved ambiguity items, with pointers to the addendum rather than silent edits.

**Next execution authorization set (structured, not authorized in this pass):** GROUP A (G3 spec/contract prep: RT-02, RT-05) · GROUP B (G6 implementation prep: RT-09's numeric-bound design work, RT-10) · GROUP C (G9 documentation: RT-15, then RT-17/RT-18 once RT-15 is approved) · GROUP D (G8/K.4 — explicitly NOT authorized). **No group is authorized by this pass.**

**Gates, restated unchanged: G3 = CONDITIONAL, G6 = FAIL, G9 = FAIL. T008 = BLOCKED.** No implementation authorization has been granted by this pass.

## 22. Group A/C execution: RT-02, RT-05, RT-15 (2026-09-27) — SPECIFY OUTPUTS ONLY, NO IMPLEMENTATION

Continuation instruction executed exactly: only RT-02, RT-05, RT-15 authorized (Group A + Group C-prep); Group B (RT-09/RT-10) and Group D (K.4/G8) explicitly NOT touched. No production code, `src/`, `tests/`, schema, config, threshold, dataset, evidence JSON, `research.md`, or F002 file changed; no benchmark run; no checkbox ticked; no commit/push.

Produced `specs/004-engineering-relationship-graph/t007-remediation-group-a-c-execution.md`.

**RT-02 (major finding, changes the problem's framing):** read F002 source directly (`src/lib/code-intel/symbols/symbol-identity.ts`, `to-intermediate-representation.ts`, `persistence/symbol-d1-client.ts`) and found **F002 already computes exactly the stable identity F004 needs** — `computeSymbolKey(snapshotId, filePath, kind, qualifiedNameOrName, startLine, startColumn)` → SHA-256, deterministic, row-id-independent, already persisted as `symbols.symbol_key`. Further found the T007 harness's own resolver (`scripts/t007-local/lib/rel.ts`) **already carries this value through as `Endpoint.ref` at every symbol-endpoint construction site (lines 349, 387, 588, 594)** but `persistRows` discards it, persisting only the volatile row `id` into F004's own `relationships.source_id`/`target_id` (confirmed `INTEGER`-typed in `contracts/d1-schema-additions.sql:13,15`, F004-owned). **This reframes F-4's symbols-stage redelivery break from "F002 lacks a stable identity" to "F004's own persistence layer discards a stable identity it already has in hand."** Hard-stop condition evaluated explicitly: **NOT triggered** — no F002/F004 cross-feature amendment required. Proposed fix: additive `source_symbol_key`/`target_symbol_key` TEXT columns on F004's own `relationships` schema, populated from the already-existing `Endpoint.ref`. Zero F002 files touched or proposed to be touched.

**RT-05:** drafted contract text for all 7 items (CANCELLED, PAUSED per D2's already-specified semantics, lease/retry/backoff defaults, F-4e interim margin, crash-reclaim attempts). **Secondary finding**: the harness's `DEFAULT_POLICY.leaseMs` constant (30,000 ms, `jobs.ts:41-45`) was **never actually exercised by any F-1/F-1c/F-3/F-4e-control test** — every one of those tests explicitly overrode the lease to 1500 ms (`m-l4-failures-c.ts:599,666,689`), which is the number the 56/56 clean durability evidence actually validates. Proposed contract default lease is **1500 ms, not 30,000 ms**, distinguishing measured-and-validated contract defaults from untested implementation constants, exactly as instructed.

**RT-15:** finalized proposed G9 wording (band-completeness scoped to B1–B6 + real-minified; B7/B8 excluded, tracked separately). **CURRENT G9 STATUS = FAIL, unchanged.** PROPOSED AMENDED CRITERION drafted, not applied. RE-SCORING REQUIRED = RT-16, not performed. Reviewed every existing G9-adjacent document reference; confirmed the proposal doesn't alter semantics beyond the approved scope, and confirmed historical L13/L14 records are correctly left un-retouched (amendments are additive, per this repository's convention).

**New open questions surfaced (disclosed, not resolved):** the additive-column vs. replace-column schema-shape choice for RT-02 was not itself pre-decided by D1 (D1 fixed only the ownership boundary); a new `symbols(snapshot_id, symbol_key)` index may be needed for RT-02's repair-lookup to stay fast at R-L scale; RT-05's 1500ms-vs-30000ms lease-default discrepancy is a new finding requiring explicit owner attention.

**Gate status, restated unchanged: G3 = CONDITIONAL, G6 = FAIL, G9 = FAIL. T008 = BLOCKED.** RT-02, RT-05 and RT-15 completed within authorization. No Group B or Group D task was authorized or executed.
