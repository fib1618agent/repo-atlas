# Implementation Plan: AST + Symbol Intelligence

**Branch**: `002-ast-symbol-intelligence` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Transform completed Feature 001 source snapshots into a language-neutral structural symbol layer. For each supported-language file in a completed snapshot, detect its language deterministically, parse it with a WASM tree-sitter grammar, extract Module/Class/Interface/Function/Method symbols (with source ranges and parent/child nesting) via per-language tree-sitter query files feeding one shared intermediate-representation walker, and persist the result in D1 additively to Feature 001's existing schema. Processing is queue-driven (a second, independent Cloudflare Queue), checkpointed, and idempotent by construction, mirroring Feature 001's exact acquisition-pipeline shape one layer up. Every extracted fact carries `EXTRACTED` evidence state and full provenance back to file → snapshot → repository → commit SHA. No relationship resolution (CALLS/IMPORTS/EXPORTS/EXTENDS/IMPLEMENTS), Engineering Graph, retrieval, impact analysis, MCP, or UI work is in scope.

## Technical Context

**Language/Version**: TypeScript 5.8, Bun runtime (dev), Cloudflare Workers runtime (prod) — matches Feature 001 and the existing app, no change.

**Primary Dependencies**: `web-tree-sitter@0.25.10` (WASM tree-sitter bindings — **pinned, not latest**; `0.27.0` was tested first and is binary-incompatible with the installed grammar package, see research.md §6 risk 1 for the verified evidence) + `tree-sitter-wasms@0.1.13` (prebuilt Tier 1 grammar `.wasm` binaries: `tree-sitter-java`, `tree-sitter-javascript`, `tree-sitter-typescript`, `tree-sitter-tsx`) — the only new runtime dependencies this feature introduces, both evidenced by `research/CODEGRAPH_RESEARCH.md` §2 as CodeGraph's own working WASM extraction backend (`ADOPTION_MATRIX.md` item 1: ADAPT the tool choice). Loaded via Nitro's `cloudflare-module` preset's native `wasm: { lazy: false, esmImport: true }` support (confirmed present in `node_modules/nitro/dist/_presets.mjs` in this planning pass — see `research.md` §1) — no new Vite/Rollup WASM plugin, no manual `wrangler.toml` `[[wasm_modules]]` binding. `createServerFn` (`@tanstack/react-start`, reused pattern, zero new dependency) for the RPC surface.

**Storage**: Cloudflare D1 (extended — new tables: `directories`, `file_extractions`, `symbols`, `extraction_jobs`, `snapshot_extractions`, additive-only in `data/code-intel-schema.sql`, Feature 001's existing shared schema file, not a new file) — no new D1/R2 binding, no new database, no dedicated graph database. R2 is read-only for this feature (source bytes are read from Feature 001's existing `SNAPSHOTS` bucket via the existing `getObject` in `persistence/r2-client.ts`; this feature writes no new R2 objects). This feature does introduce one new Cloudflare binding overall: a second Queue, `SYMBOL_QUEUE` (topic `repo-atlas-symbol-extraction`), independent of Feature 001's `SNAPSHOT_QUEUE` — see Queue/Job Boundaries below and research.md §8.

**Testing**: `bun test`, Feature 001's established first-tests-in-repo pattern, extended with `tests/contract/symbols/` and `tests/integration/symbols/`, reusing `tests/support/d1-sqlite-adapter.ts` unchanged (it already loads `data/code-intel-schema.sql` in full, so the new tables are automatically available with zero test-harness changes — confirmed by inspecting that file directly in this planning pass).

**Target Platform**: Cloudflare Workers (`cloudflare-module` Nitro preset, unchanged) for production; Bun/Node + Wrangler local emulation for development — identical to Feature 001.

**Project Type**: Single TanStack Start web app (existing structure) — this feature is additive server-side infrastructure within it, same posture as Feature 001.

**Performance Goals**: No fixed request-latency SLA (developer/operator-triggered infra, matching Feature 001). Per-file parsing must complete within a single Worker invocation's CPU budget (`research/ARCHITECTURE_DECISION_GATE.md` §5 — "sits comfortably within this budget with wide margin" for the typical case; see `research.md` §6 risk 3 for the adversarial-large-file caveat).

**Constraints**: Same 128 MB isolate memory ceiling and 64 MiB Worker bundle-size limit as Feature 001, now additionally shared with four grammar `.wasm` files plus `web-tree-sitter`'s core runtime WASM (aggregate size unmeasured in this planning pass — `research.md` §6 risk 2, flagged not resolved); WASM/JS execution only, no native tree-sitter binary, no git binary (unchanged from Feature 001); queue delivery is at-least-once (every `ExtractionJob` unit must be idempotent, mirroring Feature 001's FR-024).

**Scale/Scope**: Bounded to exactly Tier 1 languages (Java, JavaScript, TypeScript, TSX) and exactly five symbol kinds (Module, Class, Interface, Function, Method) per spec FR-002/FR-005 — no fixed snapshot-size ceiling (checkpointed multi-unit processing per US4), no fixed nesting-depth limit on parent/child hierarchy (FR-010).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Data Fidelity | Symbol data is only ever written from a real tree-sitter parse of real Feature 001 snapshot file bytes; nothing invented. No existing atlas dataset touched (separate D1 tables, separate server-fn module). | PASS |
| II. Visualization-First, Data-Driven | No UI, feeds no data into `AtlasScene`/catalogue/categories/insights. | PASS (not applicable — same as Feature 001) |
| III. Server-Side Secrets & Resilience | No new secret is introduced (grammar `.wasm` files are bundled build artifacts, not credentials). Local/prod parity follows Feature 001's established D1/R2/Queues Miniflare-emulation precedent, unchanged. | PASS |
| IV. Performance Budgets | No per-frame/3D impact. New cap introduced: bounded per-unit file-batch extraction (mirrors Feature 001's checkpoint-unit sizing), justified by the same Workers CPU-budget constraint Feature 001 already established, not speculative. | PASS |
| V. Simplicity & Minimal Scope | Strictly bounded to `sdd/03-ast-symbols` per spec's Out of Scope section; explicitly excludes CALLS/IMPORTS/EXPORTS-beyond-declaration-attribute/EXTENDS/IMPLEMENTS/Engineering Graph/retrieval/impact-analysis/MCP/UI. Two new npm dependencies (`web-tree-sitter`, `tree-sitter-wasms`) are the minimum evidenced set for the ratified WASM tree-sitter mechanism — not a speculative addition. Symbol identity reuses Feature 001's content-hash-style determinism pattern rather than inventing a new one. | PASS |

No violations. **Complexity Tracking is not needed.**

## Project Structure

### Documentation (this feature)

```text
specs/002-ast-symbol-intelligence/
├── plan.md                          # This file
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   ├── d1-schema-additions.sql
│   ├── extract-symbols.functions.md
│   ├── symbol-query.functions.md
│   └── language-grammar-provider.md
└── tasks.md                         # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── code-intel/
│   │   ├── domain/
│   │   │   └── symbol.ts                       # NEW — Symbol/Directory/FileExtraction/ExtractionJob domain types + status enums (mirrors domain/snapshot.ts's shape)
│   │   ├── symbols/
│   │   │   ├── language-detector.ts            # NEW — deterministic extension → SupportedLanguage mapping (FR-001, FR-002, FR-003)
│   │   │   ├── grammar-provider.ts              # NEW — web-tree-sitter init + per-isolate memoized grammar loading (FR-004)
│   │   │   ├── queries/
│   │   │   │   ├── java.scm                    # NEW — per-language tree-sitter query files (FR-005)
│   │   │   │   ├── javascript.scm               # NEW
│   │   │   │   ├── typescript.scm               # NEW
│   │   │   │   └── tsx.scm                      # NEW
│   │   │   ├── to-intermediate-representation.ts # NEW — query captures → common Symbol IR, incl. parent/child derivation (FR-010, sdd/03-ast-symbols/PHASE.md requirement 5)
│   │   │   ├── symbol-identity.ts                # NEW — deterministic symbol_key hashing (FR-008, FR-013)
│   │   │   └── extraction-pipeline.ts            # NEW — per-file parse → extract → persist, file-scoped failure containment (FR-007, FR-017, FR-018)
│   │   ├── queue/
│   │   │   └── symbol-worker.ts                  # NEW — Cloudflare Queue consumer for repo-atlas-symbol-extraction, one ExtractionJob unit per invocation (FR-019, FR-020, FR-021), structurally mirrors queue/snapshot-worker.ts
│   │   ├── persistence/
│   │   │   ├── symbol-d1-client.ts               # NEW — thin D1 query layer for directories/file_extractions/symbols/extraction_jobs/snapshot_extractions, same D1DatabaseLike pattern as persistence/d1-client.ts
│   │   │   └── cloudflare-env.ts                 # EXTENDED (additive only) — CloudflareEnv.SYMBOL_QUEUE + getSymbolQueue(), mirroring the existing SNAPSHOT_QUEUE/getSnapshotQueue() accessor; no existing field/function removed or renamed
│   │   ├── symbol.functions.ts                   # NEW — createServerFn RPC surface: extractSnapshotSymbols, getExtractionStatus, listSymbols, getSymbol, getFileExtraction (FR-015–FR-025)
│   │   └── feature-002-server-fn-registration.tsx # NEW — mirrors feature-001-server-fn-registration.tsx, registers ALL five functions above (research.md §9 — closes Feature 001's observed registration gap), mounted in src/routes/__root.tsx alongside Feature001ServerFnRegistration
│   └── atlas-errors.ts                           # EXTENDED (additive only) — SNAPSHOT_NOT_EXTRACTABLE, SYMBOL_NOT_FOUND; existing codes/messages untouched
├── routes/                                        # __root.tsx gets one new mount line (Feature002ServerFnRegistration); no new route
└── components/                                    # UNCHANGED

wrangler.toml                                      # EXTENDED — new [[queues.producers]]/[[queues.consumers]] entries for repo-atlas-symbol-extraction, additive alongside existing repo-atlas-snapshot-acquisition entries
nitro.config.ts                                     # EXTENDED — plugins array gains ./plugins/cloudflare-symbol-queue.ts alongside the existing cloudflare-queue.ts entry
plugins/
└── cloudflare-symbol-queue.ts                      # NEW — cloudflare:queue hook listener filtering on batch.queue === "repo-atlas-symbol-extraction" (research.md §8), does not modify plugins/cloudflare-queue.ts
data/
└── code-intel-schema.sql                           # EXTENDED (additive only) — contracts/d1-schema-additions.sql's CREATE TABLE statements appended
tests/
├── contract/
│   └── symbols/                                    # NEW — language detection, symbol-identity determinism, per-language fixture extraction, idempotent-insert behavior
└── integration/
    └── symbols/                                    # NEW — end-to-end extract→persist→query against small real fixture repos per Tier 1 language (quickstart.md scenarios)
```

**Structure Decision**: Single-project TanStack Start app (existing layout, unchanged) — same posture as Feature 001. All new code lives under `src/lib/code-intel/`, the namespace Feature 001 already established, adding a `symbols/` subdirectory parallel to (not replacing) `acquisition/`, `providers/`, `persistence/`, `queue/`. No existing Feature 001 file is modified except the additive schema file and the two config files (`wrangler.toml`, `nitro.config.ts`) that must list the new queue/plugin — both are pure additions (new array entries), not edits to Feature 001's own entries.

## Existing Code Reused

| Existing asset | Reused as | Notes |
|---|---|---|
| `createServerFn` RPC pattern + plain-handler/wrapper split (`snapshot.functions.ts`) | Template for `symbol.functions.ts` | Same `.validator().handler()` shape, same testability rationale |
| `D1DatabaseLike` / `persistence/d1-client.ts`'s thin-query-layer pattern | Template for `persistence/symbol-d1-client.ts` | New module, zero change to the existing one |
| `tests/support/d1-sqlite-adapter.ts` | Reused **unchanged** | Already loads `data/code-intel-schema.sql` in full; new tables available to tests with zero test-harness changes |
| `getObject` (`persistence/r2-client.ts`) | Reused directly, unmodified | This feature's only R2 interaction is reading Feature 001's existing file bytes — no new R2 client code |
| `listSnapshotFilesPage`'s id-ordered cursor pagination (`persistence/d1-client.ts`) | File-batch ordering for `ExtractionJob` checkpointing | Reuses the exact same stable ordering rather than inventing a second file-ordering concept (data-model.md, Checkpoint/Resume) |
| `mapWithConcurrency` (`persistence/r2-client.ts`) | Available if a unit needs bounded-concurrency R2 reads for its file batch | Imported, not duplicated |
| `AtlasError`/`atlasErrorMessage`/`serializeAtlasError` (`atlas-errors.ts`) | Extended with `SNAPSHOT_NOT_EXTRACTABLE`, `SYMBOL_NOT_FOUND` | Additive union members only |
| `codeIntelConfig()` two-tier tunable pattern (`config.ts`) | Template for extraction-specific tunables (batch size, `SYMBOL_EXTRACTOR_VERSION`) | New constants in the same module or a sibling one, same style |
| `plugins/cloudflare-queue.ts` + `nitro.config.ts`'s `cloudflare:queue` hook wiring | Pattern reused for a second queue, existing file untouched | `research.md` §8 |
| `persistence/cloudflare-env.ts`'s `CloudflareEnv`/`SNAPSHOT_QUEUE`/`getSnapshotQueue()` pattern | Extended (additive) with `SYMBOL_QUEUE`/`getSymbolQueue()` for the new queue binding | Same file, same shape — no existing field renamed or removed; this is the accessor `symbol-worker.ts` (queue send) and `symbol.functions.ts` (`extractSnapshotSymbols`'s enqueue call) depend on |
| `content_hash`-based file de-duplication (`snapshot_files.content_hash`) | Pattern reused for `symbols.symbol_key` deterministic identity | `data-model.md`, Symbol entity |

## Extraction Workflow

1. Caller invokes `extractSnapshotSymbols({ snapshotId })` (`symbol.functions.ts`).
2. The handler verifies the target Feature 001 `snapshots` row has `status = "completed"` (FR-015); if not, throws `SNAPSHOT_NOT_EXTRACTABLE` — no `snapshot_extractions` row is created (mirrors Feature 001's `REF_NOT_FOUND` "no row on failure" precedent).
3. **Resolve extraction state** — query `snapshot_extractions` for this `snapshot_id`:
   - No row: proceed to step 4 (fresh extraction).
   - Row exists, `status` is `completed`/`completed_partial`, `extractor_version` matches current `SYMBOL_EXTRACTOR_VERSION`: return immediately, `reused: true` (FR-013).
   - Row exists, `status` is `in_progress`: return the in-progress status, `reused: false`, no new units enqueued (Edge Cases, concurrent-request case).
   - Row exists, `extractor_version` differs from current: proceed to step 4 (re-extraction under a new version, FR-014) — this run's writes will supersede the prior version's `file_extractions`/`symbols` rows per file, per data-model.md's delete-then-insert mechanism.
4. Insert/update the `snapshot_extractions` row (`status = "in_progress"`, current `extractor_version`). Enqueue the first `ExtractionJob` unit (`unit_index = 0`) to `SYMBOL_QUEUE`, covering the first bounded batch of the snapshot's `snapshot_files` (ordered by `id`, same ordering `listSnapshotFilesPage` already uses).
5. Cloudflare Queue delivers unit(s) to `symbol-worker.ts`. Each unit, for each file in its assigned batch: (a) skips the file if a `file_extractions` row already exists for it at the current `extractor_version` (idempotent redelivery/resume, FR-020); (b) otherwise reads the file's bytes via `getObject` (Feature 001's existing R2 client), runs `detectLanguage`, and either records `skipped_unsupported` (language not in Tier 1) or attempts a parse. A parse failure records `failed` with a reason, scoped to that file only (FR-007, FR-018) — no partial symbol rows for a failed file, no effect on any other file's processing. A successful parse runs the per-language query, derives the common `Symbol` IR (with `symbol_key`, source ranges, and `parentSymbolKey` — the ancestor's `symbol_key`, IR-only — via AST ancestor walk), updates the `file_extractions` row, and persists `symbols` in two passes, not one atomic `db.batch()` (data-model.md's "Parent/child resolution (IR → D1)"): (i) insert every IR symbol with `parent_symbol_id = NULL`, capturing each row's `meta.last_row_id` to build a `symbolKey → id` map; (ii) resolve each non-null `parentSymbolKey` through that map and `UPDATE symbols SET parent_symbol_id = ?` for the nested symbols.
6. When a unit finishes its batch, it either enqueues the next unit (more files remain) or — if it processed the snapshot's last file batch — finalizes: recomputes the snapshot-wide status from `file_extractions` (`completed` if every file is `extracted`, `completed_partial` if at least one is `skipped_unsupported`/`failed`, per FR-016) and updates `snapshot_extractions` accordingly, in a guarded update mirroring Feature 001's `finalizeSnapshotCompleted`'s `WHERE status != 'completed'`-style idempotent-finalization guard.
7. `getExtractionStatus`/`listSymbols`/`getSymbol`/`getFileExtraction` read this feature's D1 tables directly; an extraction that has not reached a terminal status never reports as `completed`/`completed_partial` (FR-016, mirrors Feature 001's SC-006 precedent).

## Language Detection & Grammar Selection

See `research.md` §4, §1 and `contracts/language-grammar-provider.md`. Deterministic extension mapping (no heuristics); grammar `.wasm` files loaded once per Worker isolate via Nitro's confirmed native WASM-import support, memoized for the isolate's lifetime as a pure optimization (never assumed persistent — a cold isolate re-initializes correctly).

## Symbol Identity, Source Ranges, Hierarchy

See `data-model.md`'s Symbol entity. `symbol_key` = SHA-256 of `(snapshotId, filePath, kind, qualifiedNameOrName, startLine, startColumn)`, the direct structural analog of Feature 001's `content_hash`. Source ranges are tree-sitter's own node start/end positions, persisted verbatim. Parent/child nesting is derived from each matched declaration node's nearest matched ancestor in the AST (not from query-capture emission order), with no depth limit (FR-010).

## D1 Persistence & Schema

See `data-model.md` and `contracts/d1-schema-additions.sql` in full. Five new tables (`directories`, `file_extractions`, `symbols`, `extraction_jobs`, `snapshot_extractions`), all additive to `data/code-intel-schema.sql`, none altering an existing Feature 001 table.

## Extraction Status & Failure Handling

Per-file: `extracted` \| `skipped_unsupported` \| `failed` (`file_extractions.status`, FR-017). Snapshot-level: `not_started` (row absent) \| `in_progress` \| `completed` \| `completed_partial` \| `failed` (`snapshot_extractions.status`, FR-016). A file-level failure is always scoped to that file (FR-018) and never escalates to a whole-snapshot `failed` status by itself — `snapshot_extractions.status = "failed"` is reserved for a genuine pipeline-level failure (e.g., every `ExtractionJob` unit for the snapshot exhausting its retry budget), mirroring the same "file-scoped vs. attempt-scoped failure" distinction Feature 001 draws between a single failed R2 write and a fully failed snapshot.

## Idempotent Re-extraction & Extractor/Grammar Version Provenance

See `data-model.md`'s "Re-extraction mechanism" and `research.md` §10. A single `SYMBOL_EXTRACTOR_VERSION` constant (new tunable alongside `codeIntelConfig()`'s existing constants) is recorded on every `file_extractions`/`symbols`/`snapshot_extractions` row it produces. Same-version re-extraction is idempotent by delete-then-reinsert (functionally identical end state, FR-013); a version bump produces a distinguishable new result superseding the prior version's rows for that snapshot (FR-014) — no cross-version history table, a deliberate simplification justified in `data-model.md` (no spec requirement to query prior-version results once superseded).

## Checkpoint/Resume Strategy

Covered in detail in `data-model.md`'s Checkpoint/Resume section: bounded file batches ordered by `snapshot_files.id`, `extraction_jobs.checkpoint_cursor` recording the last-covered file id, resumption via `id > cursor` plus an idempotent per-file skip-if-already-extracted check — reusing Feature 001's exact "skip already-written work" resumption shape (its own re-fetch-and-fast-forward strategy), not a new mechanism. Exact batch-size tunable is left to implementation (mirrors Feature 001's own explicit checkpoint-threshold deferral).

## `createServerFn` Trigger & Queue Processing Model

`symbol.functions.ts` exposes five `createServerFn`-wrapped functions (contracts in `contracts/extract-symbols.functions.md` and `contracts/symbol-query.functions.md`), all registered via `Feature002ServerFnRegistration` (research.md §9 — every function reachable over HTTP, correcting Feature 001's observed gap). A second, independent Cloudflare Queue (`repo-atlas-symbol-extraction`) carries `ExtractionJob` unit messages, consumed by `symbol-worker.ts` via a second `cloudflare:queue` Nitro hook listener (`plugins/cloudflare-symbol-queue.ts`) that filters on `batch.queue`, registered alongside (not replacing) Feature 001's existing queue plugin.

## Consuming Feature 001 Without Modifying It

This feature only ever **reads** Feature 001 data: `getSnapshotById`-equivalent status checks, `getObject` for file bytes, and joins through `snapshots`/`repositories` for provenance (FR-022, FR-026). No Feature 001 file (`domain/`, `persistence/d1-client.ts`, `persistence/r2-client.ts`, `snapshot.functions.ts`, `queue/snapshot-worker.ts`, `acquisition/`, `providers/`) is edited. The only touches to Feature 001's *configuration surface* (not its code) are additive: new tables appended to the schema file it already owns, and new array entries in `wrangler.toml`/`nitro.config.ts` alongside its existing entries.

## Tests

Mirrors Feature 001's test-shape decisions directly: contract tests (`tests/contract/symbols/`) for language detection determinism, `symbol_key` hashing determinism, per-language fixture extraction correctness (one fixture per Tier 1 language, matching `sdd/03-ast-symbols/PHASE.md`'s acceptance criterion), and D1 idempotent-insert behavior for duplicate `symbols`/`file_extractions`/`extraction_jobs` writes; integration tests (`tests/integration/symbols/`) for the quickstart.md scenarios — malformed source, unsupported languages, parser failures (all US3), duplicate delivery and mid-unit failure/retry (US4), and same-version re-extraction determinism (US1 Acceptance Scenario 4, SC-003).

## Migration/Backward Compatibility

**No migration.** All new D1 tables, no altered table. `data/schema.sql`/`data/atlas.sqlite` and Feature 001's own tables are untouched. **No behavior change** to any existing route, component, or server function, including Feature 001's own five (`acquireSnapshot`, `getSnapshotStatus`, `listSnapshotFiles`, `getSnapshotFile`, `getRepositoryHistory`) — verified by this plan touching zero Feature 001 source files except the shared, additive schema file and the two additive config files. **Deployment prerequisite, not a migration**: the new queue must be provisioned in the Cloudflare account and the schema additions applied, mirroring Feature 001's own `wrangler.toml`-creation precedent.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `web-tree-sitter`'s exact WASM-instantiation API for the installed version is unverified under Workers (research.md §6, risk 1) | Named explicitly as a pre-implementation spike, not assumed; the contract (`language-grammar-provider.md`) fixes the caller-facing shape independent of this internal detail, so resolving it doesn't ripple into the rest of the design |
| **INVALIDATED then remediated**: T022's approved runtime `ASSETS.fetch()` → `Language.load(bytes)` grammar path fails live with "Wasm code generation disallowed by embedder" — Cloudflare Workers disallows compiling WASM from runtime-fetched bytes (research.md §6 risk 4, T064 live validation) | See "Architecture Remediation (2026-09-21)" above and tasks.md T066–T068: static build-time `?module` grammar imports + scoped `WebAssembly.instantiate` substitution, gated by local validation (Gate 1) then a separate live Cloudflare validation (Gate 2) before being declared complete |
| Aggregate grammar + runtime WASM bundle size vs. the 64 MiB Worker limit is unmeasured (research.md §6, risk 2) | Measurement deferred to implementation (`bun run build` after adding the dependency); documented escape hatch (lazy R2-loaded grammars) exists but is explicitly not adopted now, matching the Tier-1-only, no-speculative-infra posture |
| An adversarially large single file could exceed one invocation's CPU budget despite per-file unit sizing (research.md §6, risk 3) | A file-size ceiling → `skipped_unsupported`-analogous outcome is recommended; exact threshold left to implementation, mirroring Feature 001's own checkpoint-threshold deferral pattern |
| Repeating Feature 001's HTTP-registration gap (only 2 of 5 functions reachable) | Directly corrected by design: all five functions registered via `Feature002ServerFnRegistration` (research.md §9) |
| A second Cloudflare Queue sharing one `cloudflare:queue` Nitro hook could mis-dispatch batches between features | `batch.queue`-based filtering in each plugin listener, confirmed as the correct discriminator by inspecting Cloudflare's `MessageBatch` shape via `_module-handler.mjs` in this planning pass, not assumed |

## Complexity Tracking

Not applicable — no Constitution Check violations.

## Architecture Remediation (2026-09-21) — T022 grammar-loading rewrite

**Status**: Implemented and production-validated — T066, T067, and T068 all passed. This section amends (not replaces) "Language Detection & Grammar Selection" above and the Risks table's risk 1/4 rows. Full evidence trail: `research.md` §6 risk 4 (both 2026-09-21 updates).

**Invalidating finding (live Cloudflare, T064)**: the approved T022 design —

```
ASSETS.fetch() → Uint8Array → Language.load(bytes)
```

— fails on a real deployed Worker with `WebAssembly.instantiate(): Wasm code generation disallowed by embedder`. This is a documented Cloudflare Workers platform restriction: a `WebAssembly.Module` may only be compiled from bytes obtained via a **static, build-time** import (which the platform pre-compiles ahead of the sandbox's runtime restrictions); a `WebAssembly.Module` compiled/instantiated from bytes obtained **at runtime** (an `ASSETS.fetch()` response body, in T022's case) is disallowed outright. All 129 local tests passed because they inject bytes/modules directly (`setTestGrammarBytesSource`), a path that structurally never exercises real Worker-sandboxed compilation — this is why the defect was invisible until T064's live validation. The core runtime WASM (`tree-sitter.wasm`, loaded via a genuine build-time `?module` import) is unaffected; only the four **grammar** WASMs, which T022 sourced from `ASSETS` at runtime specifically because `Language.load()` at the pinned `web-tree-sitter@0.25.10` accepts only `Uint8Array | string` (no `loadSync(Module)`), hit this wall.

**Architecture decision**: replace the runtime `ASSETS`-fetch grammar path with four static build-time `?module` imports (one per Tier-1 grammar, mirroring the already-working `coreWasmModule` pattern exactly) plus a scoped `WebAssembly.instantiate` substitution during `Language.load()`, so the precompiled `Module` is used instead of the disallowed bytes-form compile. This is not speculative — it was proven in a real local experiment (research.md §6 risk 4, item 3): `Language.load(bytes)`'s internal `loadWebAssemblyModule` already contains a `WebAssembly.Module`-shortcut branch (`if (binary instanceof WebAssembly.Module) { new WebAssembly.Instance(binary, info); ... }`); the public `Language.load()` wrapper just never exercises it because it always passes bytes. Monkeypatching `WebAssembly.instantiate` for the duration of one `Language.load()` call (restored immediately after) redirects that internal call to the precompiled Module instead. All four Tier-1 grammars parsed correctly (`hasError: false`) under this substitution in the local experiment. A separate real `bun run build` confirmed Nitro's `?module` mechanism is not `node_modules`-special-cased — it produces the same build-time-compiled chunk class for our own `public/wasm/*.wasm` files that the core module already gets.

**Dependency changes**: none. `web-tree-sitter@0.25.10` and `tree-sitter-wasms@0.1.13` stay pinned exactly as approved (research.md §6 risk 1) — upgrading `web-tree-sitter` to `0.26.x`/`0.27.0` was re-confirmed dead (still no `dylink.0`-format `tree-sitter-wasms` release exists). No new npm dependency. No new Cloudflare binding — the `ASSETS`-binding runtime-fetch path (`fetchGrammarBytes`/`resolveBytesSource`/`GrammarBytesSource`) is *removed*, not replaced by a different binding.

**Interface preserved**: `GrammarProvider.getParser(language): Promise<TreeSitterParserHandle>` (`contracts/language-grammar-provider.md`) is unchanged — this fix is internal to `grammar-provider.ts`'s loading mechanism only. No caller (`extraction-pipeline.ts`, `symbol-worker.ts`) requires any change.

**Bundle-size impact**: none material. The four grammar `.wasm` files (≈5.8 MB) move from "static asset fetched via `ASSETS` at runtime" to "build-time-compiled-and-embedded chunk" — the same artifact class the core module already is. Risk 2's measured ~8% Worker-bundle-cap headroom (T063) is unaffected.

**Revised T022 scope** (superseding, not deleting, the original T022 entry in tasks.md — the original stays as the historical record of what was implemented and later invalidated):

1. Add four `?module` imports (`java`, `javascript`, `typescript`, `tsx`) of `public/wasm/tree-sitter-*.wasm`, mirroring `coreWasmModule`.
2. Remove `fetchGrammarBytes`, `resolveBytesSource`, `AssetsBindingLike`, `getAssetsBinding`, `GrammarBytesSource`, `setTestGrammarBytesSource` — the runtime `ASSETS`-fetch path in its entirety.
3. Add a scoped `Language.load()` substitution helper that monkeypatches `WebAssembly.instantiate` for the duration of exactly one call, redirecting to the precompiled per-language `Module`, then restores the original.
4. Replace `setTestGrammarBytesSource` with an equivalent test-injection hook for a precompiled test `Module` (mechanical test-harness change — same rationale `setTestCoreWasmModule` already established for the core runtime).
5. No change to `getParser`'s public signature, memoization behavior, or the unsupported-language defensive throw.

**Validation gates** (both required; neither may be skipped or merged):

- **Gate 1 — local**: `bunx tsc --noEmit` clean; full `bun test` suite green (no regression to the existing 198); `bun run build` succeeds and the four grammar chunks appear as build-time-compiled `.output/server/wasm/*.wasm` (not `.output/public/wasm/*.wasm` static assets); re-measure aggregate bundle size against the 64 MiB cap (risk 2 follow-up). This gate must pass **before** any deployment is attempted.
- **Gate 2 — live Cloudflare**: only after Gate 1 passes, deploy (explicit user authorization required, per this session's operating rules — not implied by Gate 1 passing) and re-run `extractSnapshotSymbols` against a real snapshot for all four Tier-1 languages; confirm `file_extractions.status = 'extracted'` (not `failed`) with real, non-empty `symbols` rows, via direct `wrangler d1 execute --remote` inspection (not just `getExtractionStatus`'s summary, per T064's own established diagnostic method). The remediation is not "complete" until this gate passes — Gate 1 alone (as T012/T022's original local-test pass already demonstrated) is not sufficient evidence for this class of Workers-sandbox defect.

**Existing tasks reopened**: none in the completed sense — T022, T063, T064 remain historically accurate records of what was built and what live validation found; they are not edited or unchecked. The remediation is new work (tasks.md T066–T068), not a reopening of prior checked-off tasks. `research.md` §6 risk 4 already carries both the live finding and the investigation update this decision formalizes — no contradiction between plan.md and research.md is introduced.

**Explicitly out of scope for this remediation** (per this task's own constraints): Feature 001, Feature 003, Tier-1 language scope, MCP, Settings, Engineering Graph/future graph functionality — none touched.
