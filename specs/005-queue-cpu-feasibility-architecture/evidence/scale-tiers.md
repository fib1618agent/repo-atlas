# Evidence — Scale tiers (Feature 005 task T007 "scale tiers", resolves R1)

**Not** Feature 004 T007 (the CPU-feasibility gate, which remains STOPPED). **Class**: REPO-BEHAVIOR / LOCAL-WALLCLOCK records read from existing files. **Date read**: 2026-09-24. **Method**: file reads and `grep` only. No script was run, none created, no measurement, no Cloudflare access.

Evidence labels: FACT / INCOMPLETE / UNVERIFIED / CONTRADICTION / UNKNOWN. Working-tree citations (branch `feat/atlas-marble-interaction`).

The four tiers below are four **different quantities**. They must not be merged, and no tier converts into another.

---

## Tier 1 — Measured 300-file run (lifecycle / memory evidence only)

**Sources**: `specs/004-engineering-relationship-graph/single-pass-spike-results.md:140-157` ("Memory / tree-lifecycle test"); `docs/investigations/004-single-pass-architecture-spike.md:71-84` (§6, same numbers); producing code `scripts/relationship-single-pass-spike.ts:284-335` (`runMemoryTest`, `const N = 300` at line 309, `process.memoryUsage()` at line 321). The script was **read, not run**.

**What was measured (FACT)**: 300 sequential single-pass (scenario C) extractions across varied synthetic sources, using the production `getParser` and `toIntermediateRepresentation`; `process.memoryUsage()` sampled every 50 files; `tree.delete()` counted (300 calls, one per file); parser-instance identity check (`getParser("typescript")` twice → same instance, `true`).

| files processed | rss (MB) | heapUsed (MB) | external (MB) | trees deleted |
|---|---|---|---|---|
| 50 | 540.2 | 187.2 | 140.4 | 50 |
| 100 | 540.7 | 187.2 | 140.9 | 100 |
| 150 | 543.6 | 187.2 | 141.4 | 150 |
| 200 | 552.3 | 194.5 | 141.9 | 200 |
| 250 | 552.8 | 194.5 | 142.4 | 250 |
| 300 | 553.4 | 194.5 | 142.9 | 300 |

(values copied from `single-pass-spike-results.md:146-153`; the investigation file lists only the 50/150/300 rows.)

**Recorded limits of the run (FACT, from the source files)**: `global.gc()` only under `--expose-gc` so RSS "should be read as a trend" (`single-pass-spike-results.md:157`); "does not run under Cloudflare's actual isolate memory model"; local Bun runtime; synthetic sources.

**What this run does NOT establish**:
- **CPU time** — no CPU or timing figure exists for the 300-file run. The `runMemoryTest` function (`scripts/relationship-single-pass-spike.ts:284-335`) contains no `hrtime`/`Date.now`/`performance` call (checked by grep of that range; `hrtime` occurs only in the synthetic-sweep code at lines 212-252). **No timing was recorded for this run.** (Other sections of the same results file contain local wall-clock sweeps of single files; they are separate measurements, not this run.)
- **CPU budget compliance** of any kind, **per-invocation CPU**, or **production worst-case CPU**.
- **Cloudflare memory/isolate behaviour** (local Bun process memory only).
- That 300 files is a production size, a worst case, or an upper bound. It is one synthetic count chosen by the script author.

**"300" in the decomposition sweep tables is a symbols count, not a file count (FACT, confirmed)**: in `specs/004-engineering-relationship-graph/combined-single-pass-decomposition-results.md` the table header is `| lines | C1 parse | C2raw symbols(+hash) | C3 relObs | C4 hash (isolated) | C5 total | symbols | C5 classification |` (lines 13, 25, 37, …). The row `| 1500 | 2.802 | 2.489 | 1.107 | 0.130 | 6.372 | 300 | borderline |` (line 21, java) and `| 1500 | 2.596 | 1.434 | 1.052 | 0.119 | 5.062 | 300 | borderline |` (line 213) show **300 symbols in one 1500-line file** (symbols scale 20 per 100 lines in the same tables). It is neither a file count nor a 300-file run. These are single-file local wall-clock medians and, per the file's own header (line 5), "NOT Cloudflare Workers CPU-ms".

**Planned Feature 004 T073 — confirmed unchecked and unrun (FACT)**: `specs/004-engineering-relationship-graph/tasks.md:190` reads `- [ ] T073 [F] Large-scale local simulation: … exactly 300 files …` (unchecked). T070–T076 (lines 187-200) are all `[ ]`. `feasibility-results.md` contains no "Large-Scale Local Simulation (300 files)" section (grep, no match). It was **not run and was not run here**; T073 is a Feature 004 task and is not authorized in Feature 005.

**Statement**: Tier 1 is **not a worst case** and not a CPU result.

---

## Tier 2 — Configured limits (distinct quantities; do not merge)

Cross-reference: `evidence/repo-consumer-mapping.md` (T006). Values below are code constants/config in the working tree; deployed values UNKNOWN (deployed state not read).

| Quantity | Value | Source | What it bounds | Note |
|---|---|---|---|---|
| Queue `max_batch_size` | 10 (both consumers) | `wrangler.toml:33` (snapshot), `:42` (symbol) | Maximum messages the platform may deliver in one batch | A maximum, not a delivered count |
| Queue `max_retries` | 5 | `wrangler.toml:34`, `:43` | Platform redelivery attempts | Distinct from app `CODE_INTEL_MAX_RETRY_ATTEMPTS = 5` (`config.ts:7`) |
| `CODE_INTEL_EXTRACTION_BATCH_SIZE` | 50 (env-overridable) | `config.ts:10`, `:69-72`; used `symbol-worker.ts:113` | Files per symbol-extraction message (D1 page `LIMIT`) | Per message, not per invocation |
| `CODE_INTEL_MAX_FILE_SIZE_BYTES` | 10 MiB (env-overridable) | `config.ts:12`, `:73-76`; gate `extraction-pipeline.ts:101-117` | Per-file size above which a file is skipped before R2 read/parse | Per file; not a file-count cap |
| `CODE_INTEL_CHECKPOINT_FILE_COUNT` | 200 | `config.ts:4`, `:46-49`; used `acquisition/archive-pipeline.ts:94` | New files written per **acquisition** unit (Feature 001) | Acquisition-side unit size, not an extraction or snapshot cap |
| `CODE_INTEL_LIST_FILES_MAX_LIMIT` / `_DEFAULT_LIMIT` | 500 / 100 | `config.ts:8-9`; used `snapshot.functions.ts:186`, `symbol.functions.ts:244` | Page size of file/symbol listing APIs | API paging, not a processing cap |
| `CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET` | 20_000 | `config.ts:5` | Not traced here | Its meaning/usage was not investigated in T007; do not read it as a Cloudflare CPU budget. UNVERIFIED as to use. |
| `CODE_INTEL_QUEUE_BATCH_SIZE` | 10 | `config.ts:6` | No consumer found (T006) | Not investigated further (per user instruction) |
| Feature 004 scaffolding `CODE_INTEL_RELATIONSHIP_CONTAINS_BATCH_SIZE` | 200 | `config.ts:36` (working tree, uncommitted) | Not a consumer quantity | Recorded separately per T006 |

None of these is a limit on files per snapshot or per invocation; they are unit/page/size quantities. The product of any two is **not** computed or asserted here.

---

## Tier 3 — Established production upper bound (files per snapshot/source)

**Searched**: `src/`, `plugins/`, `data/*.sql`, `specs/001*`, `specs/003*` (grep for max/limit/ceiling/too-large/truncat/`CHECK`, plus reads of the acquisition pipeline, the D1 schema and the GitHub-fetch code).

**Result: NOT ESTABLISHED.** No enforced maximum number of files per snapshot or per source was found.

Evidence of absence *in the searched locations* (repository text, so this is a code/spec search result, not a WebFetch extraction):
- `data/code-intel-schema.sql:41-49`: `snapshot_files` has `UNIQUE (snapshot_id, path)` and no row-count constraint; the `CHECK`s in the file constrain status/kind enumerations only (lines 9, 30-31, 58, 99, 113, 121, 123, 142, 154, 169-179, 208, 217-218, 230).
- `specs/001-code-intelligence-foundation/spec.md:154`: "there is no fixed repository-size ceiling in this specification, only a bounded-per-unit processing requirement." `specs/001-…/plan.md:29`: "Unbounded repository size via checkpointed multi-invocation acquisition (no fixed repo-size ceiling per spec Edge Cases)".
- `src/lib/code-intel/acquisition/archive-pipeline.ts:94`: the only file-count comparison found is per acquisition unit (`filesWrittenThisUnit >= config.checkpointFileCount`), which ends a unit, not the snapshot.
- Caps that exist but bound **other things**: `ATLAS_MAX_SOURCES = 5`, `ATLAS_MAX_SPIRAL_REPOS = 800`, `ATLAS_MAX_STORED_REPOS = 2000` (`src/lib/atlas-config.ts:3-5`, `:51-53`; truncation warnings `src/lib/github-fetch.ts:327-345`) limit **sources and repositories in the catalogue**, not files inside a snapshot. `specs/003-*` was searched for a file cap; none found (its config mention is `spec.md:25`, about source settings).
- Only scope of the search is the listed locations; other spec directories and deployed provider/API limits (GitHub archive size, R2 limits) were not searched and are not evidence here.

Consequence: no repository size is bounded from above by the code; **tier 3 provides no upper bound**, so nothing derived from tier 1 or tier 2 can be presented as covering production.

---

## Tier 4 — Unknown / unbounded

- Files per snapshot in production: unbounded by any found constraint (tier 3) and no real-repository file-count distribution is recorded in the repository evidence read here → UNKNOWN.
- Distribution of file sizes/lines/languages in real snapshots beyond the calibration files noted in `single-pass-spike-results.md` (Tier 1 file, real-file calibration section) → UNKNOWN for production.
- Delivered queue batch size and page fill per message (see `repo-consumer-mapping.md` rows 2 and 4) → UNKNOWN.
- Cloudflare CPU/accounting for a queue-consumer invocation on Workers Free (T004/T005 evidence: UNRESOLVED; the 5-vs-15-minute Workers Pricing wording discrepancy remains open) → UNKNOWN.
- Isolate reuse across invocations → UNKNOWN (not documented; T004).
- The number of files, if any, processed by the deployed system before an isolate is recycled → UNKNOWN.

---

## Required statements

1. **Tier 1 is not a worst case.** It is one synthetic 300-file lifecycle/memory run with no timing, on a local Bun process.
2. **No CPU conclusion follows from any tier.** A CPU conclusion, if one is needed, must come from a **separately identified local measurement (comparative only)** or **authoritative platform evidence**. This file defines and runs neither.
3. Local wall-clock records elsewhere in the Feature 004 results (single-file sweeps) remain LOCAL-WALLCLOCK, relative-comparison-only, and are not used in this file for any limit or safety claim.
4. No numeric Free-plan Queue Consumer CPU budget is asserted or implied. Feature 004 T007 remains STOPPED and is unaffected by this file.

## Boundary confirmation

Read-only. No script run or created; no measurement; no Cloudflare/live operation; no WebFetch used in this task; no production source, Feature 001–004 artifact, baseline, T004/T005/T006 evidence or `tasks.md` modified. Feature 004 T073 not run.
