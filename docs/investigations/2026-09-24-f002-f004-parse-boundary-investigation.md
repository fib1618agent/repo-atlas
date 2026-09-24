# F002 → F004 Parse-Boundary Investigation

**Record type:** historical investigation evidence. It is **not** current project state (see `docs/progress/PROGRESS.md` "Current State").
**Date:** 2026-09-24 · **Branch:** `feat/atlas-marble-interaction` · **HEAD:** `c576310` (working tree dirty; pre-existing changes)
**Nature:** architecture investigation only. No file was changed by it, no live experiment was run, no Cloudflare access, no commit. Feature 004 T007 remained STOPPED and was not touched.
**Companion record:** `docs/investigations/2026-09-24-f004-t007-evidence-reconciliation.md` (later the same day; it refines the measurement findings in §9 and adds R1–R6).
**Labels:** FACT (read directly from a source or code) · INFERENCE · UNKNOWN · INCOMPLETE · CONTRADICTION. Timings are local wall-clock (Bun, one machine) and are comparative only; they are not Cloudflare CPU.

---

## 1. Question

Can RepoAtlas avoid reparsing the same source file for Feature 004 while preserving Feature 002's memory-safety behavior, snapshot immutability, deterministic extraction, retry/idempotency semantics and Cloudflare/WASM constraints? Alternatives analyzed, none assumed correct:

- **A** Current design: F002 parses → extracts symbols → `tree.delete()`; F004 parses the same file again.
- **B** Shared AST lifetime: symbols and relationship facts extracted during one parse/AST lifetime.
- **C** Minimal intermediate representation: F002 emits only the structural facts F004 needs after traversal, no persisted AST.
- **D** Persisted intermediate representation: F002 persists an IR that F004 consumes later.

## 2. Sources read

`CLAUDE.md`, `AGENTS.md`, `docs/AGENT-GOVERNANCE.md`, `docs/ROADMAP.md`, `docs/claude_report/reports.md` (Stage 3); `specs/004-engineering-relationship-graph/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `tasks.md`, `feasibility-results.md`, `cpu-decomposition-results.md`, `single-pass-spike-results.md`, `combined-single-pass-decomposition-results.md`, contracts); `specs/005-queue-cpu-feasibility-architecture/decision-record.md` (§3, §4, §6, §8–§10, §12–§16); F002 code: `src/lib/code-intel/symbols/{grammar-provider,to-intermediate-representation,extraction-pipeline,symbol-worker,symbol-identity}.ts`, `persistence/symbol-d1-client.ts`, `symbol.functions.ts`, `plugins/cloudflare-symbol-queue.ts`, `wrangler.toml`, `data/code-intel-schema.sql`; F004 scaffolding `relationships/relationship-identity.ts`, `relationships/queries/*.scm`; spike scripts under `scripts/relationship-*.ts`; F002 `research.md` (T014 memory finding) and `spec.md:208`.

## 3. Executive finding

1. **Reparse can be avoided only if per-file facts are persisted (option D in effect).** B and C cannot avoid it alone: cross-file resolution needs other files' symbols, which are not in D1 while F002 is still running, and F004 must start only after F002 is terminal (its own FR-010). B and C therefore reduce to "observe facts in the F002 parse, persist them, resolve later".
2. **D does not remove reparse permanently.** Any relationship-query change, and every snapshot already extracted (production has some), still needs a reparse or backfill.
3. **T007 is not evidence that A is wrong.** T007 concerns the large-file unit. Its evidence also indicts the shared parse baseline, so F002 carries the same unmeasured exposure on large files.
4. **Findings independent of the option chosen:** F002 never populates `is_exported`; `tree.delete()` is not exception-safe; `relationship_key` depends on D1 row ids (§7).
5. **This investigation did not justify reopening F002's architecture** (§10).

## 4. Current F002 extraction lifecycle (FACT, from code)

1. `symbol-worker.ts:84-151` handles one queue message: a cursor page of up to `extractionBatchSize` files (default 50). It resumes from a per-file checkpoint, calls `extractFile` per file, then finalizes or enqueues the next unit. On error it records a retry and rethrows so the queue redelivers.
2. `plugins/cloudflare-symbol-queue.ts:34-41` loops over every message of a delivered batch (`max_batch_size = 10`, `max_retries = 5`, `wrangler.toml:40-43`) in one invocation, with `ack()` per success and `retry()` per failure.
3. `extractFile` (`extraction-pipeline.ts:68-183`): ensure the directory chain; detect language from the path; skip a file over `maxFileSizeBytes` (default 10 MiB, from recorded `sizeBytes`, before any R2 read); read R2 bytes; `TextDecoder` with `fatal: true`; `getParser(language)`; `parser.parse()`; reject if `rootNode.hasError`; `toIntermediateRepresentation`; **`tree.delete()` at `:152`**; `upsertFileExtraction`; `replaceSymbolsForFile`. Any thrown error is caught and stored as a `failed` row.
4. `getParser` (`grammar-provider.ts:262-284`) memoizes one `Language` and one `Parser` per language at module scope (per isolate). WASM comes from build-time `?module` imports; a scoped `WebAssembly.instantiate` substitution avoids runtime WASM compilation, which Workers disallows.
5. `toIntermediateRepresentation` returns plain `SymbolIR` objects (no AST handles). In the committed code it runs `new Query(language, querySource)` on **every** file. An uncommitted working-tree experiment memoizes compiled queries (005 §9: unadopted, retained).
6. `replaceSymbolsForFile` (`symbol-d1-client.ts:170-239`): one batch that deletes the file's symbols and re-inserts them, then a second batch that sets `parent_symbol_id`. `symbols.id` is `AUTOINCREMENT`, so every re-extraction of a file assigns new ids.
7. Identity: `symbol_key` is SHA-256 of `snapshotId filePath kind qualifiedNameOrName startLine startColumn` (`symbol-identity.ts`). `extractor_version` is deliberately excluded.
8. Idempotency: a completed unit is a no-op on redelivery; per-file writes are upsert/replace; job upserts never regress `completed` (005 §10.1). `extractSnapshotSymbolsHandler` (`symbol.functions.ts:36-89`) returns `reused: true` for a completed snapshot at the current `SYMBOL_EXTRACTOR_VERSION` and restarts only on a version change or a prior `failed` run.

## 5. Planned F004 boundary (FACT, from specs)

Per `research.md` §1–§4, `plan.md` and `tasks.md` T019–T024: one file re-parsed per unit through the unchanged `getParser`; new relationship `.scm` queries; observation then resolution by bounded indexed D1 lookups into one of five evidence states (`EXTRACTED`, `RESOLVED`, `INFERRED`, `AMBIGUOUS`, `UNKNOWN`; v1 never emits `INFERRED`); `CONTAINS` and `EXPORTS` are pure D1 derivations; FR-017 forbids any Feature 001/002 table, source or signature change; FR-018 records the `SYMBOL_EXTRACTOR_VERSION` used. F004 `research.md` §3 rejected caching F002's tree because that would change the memory behavior T014 fixed.

## 6. Options compared

| Dimension | A: reparse in F004 | B: shared AST lifetime | C: minimal fact IR (F002-owned) | D: persisted IR |
|---|---|---|---|---|
| CPU | Two parses; second is parse + relationship query | One parse plus relationship query; about 31–33% lower than A locally (E2, 2,500 lines) and about 42–44% (E3 post-cache tables, java/tsx at 1,500 lines, my computation) | Same as B | As B plus fact serialization and write; resolution later with no parse |
| Memory | Two sequential trees, each deleted | One tree alive slightly longer; relationship matches on the JS heap | Same as B; facts are plain JS before delete | As C; facts persist after |
| WASM / Tree-sitter | Existing pattern; `getParser` unchanged | F004 code touches F002's tree; lifetime discipline shared | Tree private to F002 | As C |
| Queue model | Second stream; one-file messages cost about 3N queue operations against a 10,000/day Free quota shared across queues (005 §6.3, undetermined) | No extra messages; more CPU per F002 page | As B | Adds a resolution stream sized by fact count (UNKNOWN volume) |
| Retry / idempotency | Independent per pass; existing mechanisms reused | Coupled failure domains: an F004-side failure would fail the file and drop its symbols unless isolated | As B | Facts replace-per-file; resolution retries without a parse |
| Snapshot provenance | Clean; F004 versions independently | Facts stamped by F002 version; versions couple | As B | Needs its own `fact_version` |
| Deterministic identity | Ids exist only after F002 persists | Ids do not exist at observation time; needs `symbol_key` or a post-insert map | As B | Facts reference `symbol_key`; identity redesign required |
| Evidence states | Unchanged | Observation is `EXTRACTED`; resolution still later | As B | `EXTRACTED` facts then resolution; key semantics must change |
| D1 / storage | Relationship rows only | Same unless facts persisted | Same | Extra fact rows or R2 objects; volume UNKNOWN |
| F002 production impact | None | Higher per-file CPU; needs `finally`, a partial-success status | As B | As B plus schema addition |
| F004 impact | Unit design still open | Rework of T020/T023 and spec | As B | Largest rework |
| Fixes the T007 bottleneck? | No | Partly: removes F004's own parse, but the large file's cost lands inside F002 | As B | As B; parse leaves F004's resolution unit |
| Spec changes | None | F002 and F004 (FR-001, FR-017, `research.md` §3) | As B | As B plus data model and identity |

B versus C differ in who touches the tree (B exposes it to F004 code; C keeps it private to F002 and exports plain data). CPU is the same. The consumption question, not the option letter, decides the outcome (§3 finding 1).

## 7. Findings independent of the parse-sharing choice

- **O-1 (CONTRADICTION, F004 premise vs F002 as built).** F004 `research.md` §2 line 40, `plan.md:78`, T018 and T021 say EXPORTS is a zero-parse D1 read of `symbols.is_exported`. `replaceSymbolsForFile` inserts `is_exported` as a literal `NULL` (`symbol-d1-client.ts:191`); `SymbolIR` has no such field; none of the four symbol `.scm` files matches "export"; `symbol-provenance.test.ts:48` expects `isExported: null`. F002 is conformant to its own spec (`spec.md:208`: export status "MAY be recorded" where directly observable).
- **O-2 (FACT structure; reachability UNKNOWN).** `tree.delete()` is not in a `try/finally`. Only the `hasError` branch deletes before throwing; the `catch` at `:167` cannot reach the tree. If `toIntermediateRepresentation` throws, the tree leaks. F002 T014 found that undeleted trees caused a WASM `RuntimeError: Aborted()`. No test was found that asserts deletion on a throw.
- **O-3 (FACT dependency).** `relationship_key` hashes `sourceId`, `targetId` and `evidenceFileExtractionId` (`relationship-identity.ts`, `data-model.md`), which are D1 row ids, while F002's `symbol_key` is content-derived. F002 re-extraction renumbers symbol ids. In shipped code, re-extraction of a completed snapshot happens only on a `SYMBOL_EXTRACTOR_VERSION` change, which FR-018 already detects. Two independent F002 runs of the same content yield different ids but identical `symbol_key`s (005 §10.1 O1, O4).
- **O-4 (FACT).** The Query-cache memoization is an uncommitted experiment; production F002 still compiles a query per file.

## 8. Structural constraints that shape the choice

- **Resolution is cross-file.** Imports, extends, implements and calls resolve against other files' persisted symbols. Only same-file targets could resolve inside F002's per-file pass.
- **Backfill.** Production snapshots already extracted have no persisted facts. A reparse path (A) must exist for them regardless.
- **Version coupling.** Under B/C/D a relationship-query change becomes an F002 code change; regenerating facts means reparsing inside F002's re-extraction, which renumbers ids (O-3). D needs its own fact version and a facts-only regeneration path, which is again a second parse.
- **Failure domains.** Today a per-file error marks the file `failed` and its symbols are lost. F002 has only `extracted`, `failed`, `skipped_unsupported`; isolating F004-side failure needs a new partial status (schema and semantics change).
- **Identity under D.** `relationship_key` includes the target, so a key changes when a fact resolves (unresolved facts have a null target). D needs the key defined over source and evidence location.

## 9. CPU evidence and what T007 does and does not prove

**What T007 proves (local, comparative):** the large fixtures classified "likely unsafe" (p95 9.7–12.2 ms) against the local <3 / 3–8 / >8 ms thresholds; the second parse is 67–70% of the unit at 2,500 lines (parse 66.9–70.4%, query about 29–32%, resolution about 0.5%).

**What it does not prove:**

- Any Cloudflare CPU figure. X (the Free-plan Queue Consumer CPU limit) and Y (the accounting unit) are UNKNOWN (005 U1/U2).
- That a strict 10 ms applies to a queue consumer. F002 T068 succeeded live on 33 files with zero failed extractions; the batch size is 50, so this was likely one unit (INFERENCE; the unit count was not verified). The CPU of that run was never measured, so it cannot bound X.
- That A is the problem. Parse cost is shared: if a large file is unsafe for F004 it is exposed in F002 too. F002's live run had no file near 2,000 lines (F004 `research.md` §1).
- That B/C/D would clear the gate. They shrink F004's unit but relocate the large-file cost into F002.

**Numbers at the time of the investigation** (all local; shape and scope matter, see §10): java, 1,500 lines, post-cache E3 tables: parse 2.596 ms, symbols 1.434, relationship observation 1.052; single-pass total 5.062; two-pass about 8.7; F002-only about 4.0; standalone F004 about 3.65 plus resolution.

## 10. Measurement contradiction (as found at the time)

Four local sets disagree on the cost of the same phase:

| Set | Java parse, 1,500–2,500 lines |
|---|---|
| Decomposition (`cpu-decomposition-results.md`) | 15–28 ms |
| Single-pass spike (E2) | about 21 ms at 2,500 lines |
| T006 feasibility (`feasibility-results.md`) | 9.5 ms for the full unit at "~2,000 lines" |
| Combined decomposition E3, pre- and post-cache | about 2.6–2.8 ms at 1,500 lines |

T006 had no warm-up; the other scripts used 5. Fixture density and machine state were not recorded (INCOMPLETE). Absolute values differ 4–8x for the same phase; the A-versus-B savings ratio is consistent across sets. **Superseded in part:** the reconciliation record shows the T006 "large" fixture is about 705 lines, not ~2,000, and that three of the four sets agree on the call-dense shape once line counts are corrected; the E3 disagreement remains. See the companion record §R3.

## 11. Why this did not justify reopening F002's architecture

- The gate is not the parse count. X and Y are UNKNOWN and the local numbers contradict each other, so a reopening would rest on untrustworthy numbers.
- Every B/C/D variant adds F002 risk: breaks FR-017, couples failure domains, needs a partial-success status and version handling. F002 is production-validated and its large-file exposure is untested.
- The independent findings (O-1, O-2, O-3) need resolution whatever the option.
- What would change this: platform-reported CPU showing the second parse dominates, or the parse cost proven to be the binding constraint on real corpus files.

## 12. Additional evidence required

1. X and Y on Free (005 U1/U2): an official statement, an FR-038 waiver, or authorized live telemetry.
2. A reconciled local measurement on one fixture set with recorded density, warm-up and Bun version (design in the companion record).
3. Real-corpus distribution: file sizes and line counts, large-file share, facts per file. This sizes D's storage and the large-file population.
4. Relationship-query compile cost for the four languages, cold and warm.
5. A cold single-pass versus two-pass comparison with initialization included.
6. An F002 partial-success design for isolating relationship failures.
7. The EXPORTS decision (O-1).
8. An identity redesign for D (O-3).
9. Live evidence for large files on the existing F002 path.

## 13. Recommendation at the time (not implemented)

Do not touch F002 now. Settle the evidence gap first: choose a route for X and Y (documentation-only raw-text re-read, `LX-1`, an FR-038 waiver, or a reviewed in-place F004 amendment). The lowest-risk change stays inside F004, such as a large-file ceiling or a narrower unit. Keep C/D as candidates only if platform evidence shows the second parse is the bottleneck; if so, D needs a facts-table design, an identity redesign and a legacy backfill path. Record O-1, O-2 and O-3 as separate findings at the next spec review. Feature 004 T007 remains STOPPED.

## 14. Limits of this record

Local wall-clock is not Cloudflare CPU. No experiment was run. Documentation statements about Cloudflare were not re-fetched. The 33-file unit-count inference is unverified. Line numbers cited are from the working tree at HEAD `c576310` on 2026-09-24 and may drift.
