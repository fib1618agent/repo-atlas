# T007 — Local Relationship Engine Feasibility: Measurement Plan

**Feature**: 004 — Engineering Relationship Graph · **Created**: 2026-09-25 · **Status**: **DEFINED — EXECUTION NOT AUTHORIZED**
**Authority**: research.md Amendment A6 (D-ARCH-3); `docs/architecture/ADR-001-local-first-runtime.md`. This plan defines the redefined T007 gate. **Nothing in this document was measured; no harness exists; no production code is changed by it. T008+ remain NOT AUTHORIZED.** The gate outcome changes only when a future, separately authorized execution passes the criteria below and a reviewed amendment records it.

---

## 1. Purpose and gate question

Prove (or refute, with evidence) that the local relationship engine is feasible at repository scale on the local-first runtime:

```text
Repository → local snapshot → local durable jobs → AST/symbols → relationships → resolution → graph (SQLite) → queries
```

Storage: SQLite + local filesystem. Nothing required from Cloudflare Workers/Queues/D1/R2, Redis, Kafka, RabbitMQ, hosted graph/vector databases, or remote LLMs. **The old Cloudflare 10 ms CPU limit is not a pass/fail constraint of this gate** (A6); Feature 005's methodology (measurement-record fields, cold/warm separation, inference bans, stop-gate discipline) is reused where it applies.

## 2. Requirements under validation (LRF register)

| ID | Requirement | Measured by | Gate |
|---|---|---|---|
| LRF-01 | Native/local parser throughput | M-L1, M-L2 | G4, G9 |
| LRF-02 | File-size bands | M-L1 | G9 |
| LRF-03 | AST extraction | M-L1, M-L2 (phase attribution) | G4 |
| LRF-04 | Symbol extraction | M-L2 | G4 |
| LRF-05 | Relationship extraction | M-L2 | G1, G4 |
| LRF-06 | Relationship resolution | M-L2, M-L3 | G1, G4 |
| LRF-07 | Memory usage (peak/average/growth) | M-L1, M-L2, M-L5 | G5 |
| LRF-08 | CPU usage/utilization | M-L2, M-L4, M-L5 | G4 (recorded; no external limit) |
| LRF-09 | Worker concurrency | M-L4 | G4 |
| LRF-10 | SQLite throughput (write/read/traversal) | M-L3 | G6 |
| LRF-11 | Durable local job throughput/overhead | M-L4 | G6 (overhead), G2/G3 (semantics) |
| LRF-12 | Incremental indexing | M-L6 | G7, G8 |
| LRF-13 | Cold-start behavior | M-L7 | recorded (informational; no gate number without evidence) |
| LRF-14 | Large-file behavior | M-L1 bands B6–B8 | G9 |
| LRF-15 | Repository-scale graphification | M-L5 | G1, G4, G5 |
| LRF-16 | Failure/retry/recovery | M-L4 tests F-1…F-6 | G2, G3 |

## 3. What exists vs what the harness must stand in for (honest baseline)

- **Exists and is reused unchanged**: Feature 002 grammar provider (`getParser`), symbol extraction pipeline, `tests/support/d1-sqlite-adapter.ts` local persistence path (proven Cloudflare-free by Feature 009 D3(a)), Feature 001 snapshot acquisition, `data/code-intel-schema.sql`, the F004 relationship schema design (`contracts/d1-schema-additions.sql`, data-model.md).
- **Does NOT exist** (T008+ unbuilt; job engine is a documentation contract): relationship `.scm` queries beyond the T006 draft, `to-relationship-facts`, `relationship-resolver`, `relationship-d1-client`, the local durable job engine. T007-CAL-1's review already established the rule: **unbuilt production code is represented by a scratch harness, and every number it produces is labeled PROTOTYPE.**
- **Harness placement**: throwaway-but-promotable scripts under `scripts/t007-local/` (T006 `scripts/relationship-cpu-spike.ts` precedent). No `src/` or `tests/` modification for implementation; the harness imports existing Feature 001/002 modules read-only. The prototype job runner MUST implement the state machine and guarantees of `contracts/local-job-engine.md` exactly (states, claims, lease timeout, retry, checkpoint), because G2/G3 validate that contract, not an easier stand-in.

## 4. Environment strategy

- Runtime: Bun + TypeScript on the developer's machine — the currently available local path (per instruction: Rust is a preferred direction, not a dependency of this T007).
- SQLite: via the existing sqlite adapter; WAL on/off is a recorded variable in M-L3.
- Every run records (in the evidence JSON, §10): OS + version, CPU model, physical/logical cores, RAM, storage type (SSD/NVMe), Bun version, repository commit SHA, harness version, worker configuration, SQLite journal mode. One machine is the **reference environment**; its spec is frozen in the first evidence record and every gate number is relative to it. Results from other machines are recorded but never mixed into gate statistics.
- **Rust-repeat register** (recorded per measurement, §11): which numbers must later be re-measured against the Rust Atlas Engine and which are engine-independent.

## 5. Dataset / fixture strategy

### 5.1 File-size bands (LRF-02/14; feeds the D-ARCH-6 decision)

Synthetic fixtures, neutral domains only (car rental, payment, notification, fleet management, customer, pricing, inventory services). Per band × per Tier-1 language (Java, JavaScript, TypeScript, TSX) × two AST-density shapes — **ordinary** (~8 nodes/line) and **dense** (~36 nodes/line), per the R3/A1 finding that density, not line count, drives cost. Fixture generator records actual bytes, lines and AST node counts (the R3 lesson: never label a fixture by intended size).

| Band | Target size | Role |
|---|---|---|
| B1 | ≤ 4 KiB | floor / overhead-dominated |
| B2 | 16 KiB | typical small file |
| B3 | 64 KiB | typical large hand-written file |
| B4 | 256 KiB | below proposed default |
| B5 | **512 KiB** | the ADR-001 §2 D-ARCH-6 *proposed* default — judged from this data, not assumed |
| B6 | 1 MiB | above proposed default; candidate ceiling region |
| B7 | 4 MiB | generated/minified territory |
| B8 | 10 MiB | current `CODE_INTEL_MAX_FILE_SIZE_BYTES` ceiling |

Plus one real minified-JS fixture (the T007-CAL-1 review's addition, carried over): synthetic repetition under-represents minified density.

**Output**: per-band cost curves (parse, symbols, relationships, resolution, persist; memory) → an evidence-backed recommendation for (a) the default max parse size and (b) a hard ceiling, each labeled a RepoAtlas engineering decision. Oversized-policy check: bands above the chosen default exercise the SKIPPED-with-structural-metadata path (F-6).

### 5.2 Repository tiers (LRF-15)

| Tier | Shape | Source |
|---|---|---|
| R-FILE | individual files | §5.1 bands |
| R-S | small, ≤ 100 Tier-1 files | real repository |
| R-M | medium, 100–1,000 Tier-1 files | real repository — primary gate tier |
| R-L | large, 1,000–5,000 Tier-1 files | real repository |

Real repositories over synthetic where possible (instruction). Confirmed candidate: **repo-atlas itself** (TypeScript/TSX, R-M range). Remaining candidates (one Java-dominant, one JS/TS mixed at R-L) are **selected at execution-authorization time with owner approval** (public, Tier-1-language-dominant, no licensing concern; named in the authorization). Acquisition path: the existing Feature 001 snapshot pipeline into the sqlite adapter (Feature 009 D3(a) precedent) — public GitHub read-only, no Cloudflare, no other live operation.

### 5.3 Incremental scenarios (LRF-12)

On R-M: **INC-0** full graphification (baseline) · **INC-1** no-change re-run (must short-circuit, FR-009) · **INC-2** one changed file (new snapshot) · **INC-3** ~10% of files changed. Change = a real content edit committed to a scratch clone, snapshotted through the normal path — never a fabricated DB state. Correctness of the incremental result is verified by graph diff against a from-scratch run of the changed snapshot (identical relationship sets required, G1).

## 6. Measurement protocol

Adopted from Feature 005 §4b with one inversion, stated explicitly: **LOCAL-RUNTIME measurements are first-class evidence for this gate**, because the runtime under validation *is* the local runtime. The Cloudflare-era inference bans that remain in force: no single sample supports a gate conclusion; cold and warm are reported separately and never averaged; a statement about one environment is not carried to another (this machine ≠ all machines — hence the frozen reference environment, §4); a prototype number is not a production number (PROTOTYPE label, §3).

**Required fields per measurement record**: basis (`LOCAL-RUNTIME` | `PROTOTYPE-BEHAVIOR` | `REPO-BEHAVIOR`); warmth (`cold`|`warm`); unit (file | unit-job | snapshot | query); what it includes (init, parse, extraction, resolution, persist — or `UNKNOWN`); sample size (≥ 20 iterations for file-level, ≥ 3 full runs for repository-level); statistics (median **and** p95 **and** max); variability; environment reference; harness/commit version.

### Measurement matrix

| ID | What | Unit | Key metrics |
|---|---|---|---|
| **M-L0** | Environment capture + harness smoke (1 known fixture through the full path) | — | environment record; harness correctness vs hand-checked expected relationships |
| **M-L1** | File bands (§5.1): parse → AST → symbols per band/language/density | file | ms (median/p95/max), MB peak, AST nodes, nodes/ms |
| **M-L2** | Full per-file pipeline with phase attribution: classification → parse → symbol read → relationship fact extraction → resolution (indexed SQLite lookups) → persist | file | per-phase ms; relationships/s; resolutions/s; evidence-state distribution (RESOLVED/AMBIGUOUS/UNKNOWN rates — an honesty check, not a target) |
| **M-L3** | SQLite: batch-insert throughput (relationships + candidates), indexed resolution-lookup latency, bounded traversal queries (outgoing/incoming, type-filtered, paginated per FR-014), WAL vs rollback journal, DB size per tier | rows / query | rows/s; ms/query (median/p95); bytes on disk |
| **M-L4** | Prototype durable job engine (contract §): claim/execute/complete overhead vs inline; concurrency 1/2/4/8 workers; failure suite F-1…F-6 (§8) | unit-job | jobs/s; overhead %; scaling curve; recovery time; correctness booleans |
| **M-L5** | Repository-scale graphification R-S/R-M/R-L end to end (snapshot → … → queryable graph), at concurrency 1 and `ATLAS_MAX_CONCURRENT_ANALYSES` (2) | snapshot | wall time; process CPU time (`process.cpuUsage()`); peak/average RSS; RSS slope across files (leak check — the R5 tree-lifecycle lesson); totals (files, symbols, relationships) |
| **M-L6** | Incremental scenarios INC-0…INC-3 (§5.3) | snapshot | wall time and work units vs INC-0; graph-diff correctness |
| **M-L7** | Cold start: fresh process first-file per language vs warm steady state (E6 method reused) | process | cold line items (grammar init, query compile, first parse) vs warm per-file |

## 7. Metrics (defined; no numbers invented here)

- **Performance**: files/s parsed; symbols/s; relationships/s extracted; resolutions/s; end-to-end minutes per tier.
- **Memory**: peak RSS, average RSS, heapUsed, external (WASM), RSS-vs-file-index slope.
- **CPU**: process user+system CPU time; utilization per worker count; CPU-vs-wall ratio (I/O share).
- **SQLite**: insert rows/s; lookup and traversal latency; DB file size; WAL effect.
- **Jobs**: enqueue-to-complete overhead vs inline execution; jobs/s at each concurrency; recovery time after kill; retry counts.
- **Incremental**: absolute and relative cost of INC-1/2/3 vs INC-0; work-unit counts.

## 8. Failure / recovery tests (LRF-16 — validate `contracts/local-job-engine.md` guarantees)

| ID | Test | Required behavior | Contract guarantee |
|---|---|---|---|
| F-1 | `kill -9` mid-R-M run, restart harness | resumes from persisted state; zero completed units lost or re-persisted as duplicates; DB consistent; **STOP/START must not destroy local intelligence** | 1 (durability) |
| F-2 | Injected deterministic per-file failure | that unit FAILED/RETRYING; snapshot completes `completed_partial`; other files unaffected | 6 (containment) |
| F-3 | Repeated transient failure | bounded retries with backoff → FAILED after policy limit; attempts recorded | 1 (retry) |
| F-4 | Re-execute a COMPLETED unit | short-circuits; persisted result byte-identical | 2 (idempotency) |
| F-5 | Pause mid-snapshot, then resume; cancel mid-snapshot | RUNNING units finish or checkpoint; nothing new claimed; resume continues; cancel leaves consistent partial state | 4 (pause/cancel) |
| F-6 | Oversized file (above configured cap) | SKIPPED with structural metadata retained, never a silent disappearance | 8 / file-size policy |

F-1 additionally runs the **determinism cross-check**: the resumed run's final relationship set must be byte-identical to an uninterrupted run (G1).

## 9. Acceptance gates

Thresholds marked **[ENG]** are **RepoAtlas engineering acceptance criteria, not externally sourced limits**; each [ENG] number requires owner approval **by name in the execution authorization** and may be revised there. A gate is never cleared on a single sample or a small fixture alone — G1/G2/G4/G5 require R-M (repository-scale) evidence.

| Gate | Criterion | PASS | CONDITIONAL | FAIL |
|---|---|---|---|---|
| **G1 Determinism** (mandatory) | Identical snapshot + versions → byte-identical relationship set (count + `relationship_key`s + evidence states), ≥ 3 runs, including the F-1 resumed run and the M-L6 graph-diff checks | all identical | — (no conditional) | any diff |
| **G2 Durability** (mandatory) | F-1 passes | zero loss/duplication | — | any loss, duplication or corruption |
| **G3 Failure semantics** (mandatory) | F-2…F-6 behave per contract | all | minor deviations with documented contract amendment proposal | containment or idempotency broken |
| **G4 Throughput** | R-M end-to-end ≤ 5 min wall; R-L ≤ 30 min, at concurrency 2 on the reference environment **[ENG]** | within | exceeded but cost scales ~linearly with files/bytes and a bottleneck is identified with a mitigation path | super-linear blow-up or R-M > 3× the [ENG] bound |
| **G5 Memory** | Peak RSS ≤ 1.5 GiB during R-M at concurrency 2 **[ENG]**; RSS slope across sequential files ≈ flat (no leak) | within, flat | above bound but flat, with identified cause | unbounded growth |
| **G6 Persistence/job overhead** | SQLite persist ≤ 30% of pipeline wall; job-engine overhead ≤ 15% vs inline **[ENG]** | within | above, with a concrete batching/tuning proposal measured at least once | overhead dominates (> 50%) |
| **G7 No-change re-run** | INC-1 short-circuits (FR-009): ≥ 95% cheaper than INC-0 **[ENG]** | within | — | re-derives work |
| **G8 Incremental scaling** | INC-2 cost scales with the change, not the repository (≤ 10% of INC-0 on R-M) **[ENG]** | within | mechanism partly future: cost recorded, viability argued from measured per-file costs, follow-up task named | incremental cost ≈ full cost with no identified path |
| **G9 File-size evidence** | Complete band table (§5.1) exists; default + hard-ceiling recommendation derived from the curves; 512 KiB explicitly judged | complete | — | bands missing or default asserted without data |

**Clearance rule for T008+**: G1, G2, G3 = PASS (mandatory, no conditionals); each of G4–G9 = PASS, or CONDITIONAL explicitly accepted by the owner; evidence artifact (§10) complete; then a **reviewed amendment** (research.md A7) records the outcome and, only then, T008+ may be authorized. Any mandatory FAIL → T007 outcome = NOT FEASIBLE AS DESIGNED, with the bottleneck evidence feeding a re-design decision (including whether the Rust core moves from preference to requirement).

## 10. Evidence artifact (durable, local-only)

- `specs/004-engineering-relationship-graph/t007-local-feasibility-results.md` — human-readable: outcome per gate, tables, conclusions, limitations.
- `specs/004-engineering-relationship-graph/evidence/t007-local/*.json` — machine-readable per run: environment (§4), commit/harness versions, dataset (repositories, file counts, language mix, file-size distribution), worker configuration, timings, CPU, memory, SQLite metrics, job metrics, failures, retries, incremental results.
- **No cloud telemetry dependency anywhere.** Limitations section is mandatory (single-machine scope, prototype-vs-production divergences, anything NOT RECORDED).

## 11. Rust-repeat register

| Measurement | Repeat on Rust Atlas Engine? |
|---|---|
| M-L1/M-L2 parse + extraction throughput, M-L7 cold start | **YES** — engine-bound |
| M-L5 memory/CPU at repository scale, M-L4 concurrency scaling | **YES** — runtime-bound |
| M-L3 SQLite schema throughput characteristics | Partially — schema/indexes portable; driver overhead re-measured |
| F-1…F-6 semantics, G1 determinism definition, gate framework, datasets, bands | **NO** — engine-independent contract tests; re-run as regression, not re-designed |

TypeScript-path results that PASS validate the architecture; the register keeps honest which numbers are engine-specific.

## 12. Reference-implementation inputs (read-only; `../repotlas-references/`)

| Idea | 1. Reference behavior | 2. RepoAtlas applicability | 3. Adaptation | 4. Limitation/avoidance |
|---|---|---|---|---|
| Byte-identical verification (codegraph) | Every language shipped only after graphs proved byte-for-byte identical to a reference engine on real repositories | Directly usable as G1's method and later as the TS↔Rust equivalence check | Diff is snapshot-scoped over relationship rows (`relationship_key`, evidence state), not a whole-DB compare | Their live-tree scope; RepoAtlas compares snapshot-scoped immutable outputs |
| Change-scoped incremental sync (codegraph) | Watcher syncs exactly what changed; cost grows with the change, not the repository | The G8 criterion is this property, measured between snapshots | INC-2/INC-3 via new snapshots through Feature 001, not FS events | No watcher daemon; graphification starts from explicit selection (ADR-001 §9 non-goals) |
| Phase DAG with typed per-phase outputs (GitNexus) | 19 pipeline phases with explicit deps and typed outputs | M-L2's per-phase attribution mirrors this so bottlenecks are named per phase | Phases here are durable job units with persisted checkpoints, not one in-memory run | Avoid in-memory whole-graph build and the dedicated graph DB it feeds |
| `graph_diff` (graphify) | Diffs two graph versions | INC correctness check: incremental result vs from-scratch result must diff empty | Implemented as the G1 byte-identity comparator reused across snapshots | Avoid confidence-only labels; five evidence states stand |

## 13. Non-goals of this T007

No Rust implementation; no MCP; no UI; no process/impact analysis measurement (layers 10–11 come later); no semantic indexing; no Cloudflare operation of any kind; no production schema application; no adoption of harness code into `src/` without its own reviewed task; no change to `CODE_INTEL_MAX_FILE_SIZE_BYTES` or any config default before the evidence exists.

## 14. Authorization status

**DEFINED ONLY.** Execution requires explicit user authorization naming: (a) this plan (`T007-LOCAL`), (b) the [ENG] threshold numbers in §9 (or revisions), (c) the real-repository list (§5.2), (d) the reference environment. Until then: no measurement, no harness creation, no fixture generation, no snapshot acquisition runs. T008+ NOT AUTHORIZED. Task breakdown: `t007-local-feasibility-tasks.md`. Planning checklist: `checklists/t007-local-feasibility.md`.
