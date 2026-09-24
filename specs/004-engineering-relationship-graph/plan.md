# Implementation Plan: Engineering Relationship Graph

**Branch**: `004-engineering-relationship-graph` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-engineering-relationship-graph/spec.md`

## Summary

Derive and persist eight typed, directed relationships (`CONTAINS`, `IMPORTS`, `EXPORTS`, `CALLS`, `EXTENDS`, `IMPLEMENTS`, `USES`, `REFERENCES`) between existing Feature 002 entities (`directories`, `file_extractions`, `symbols`) within a snapshot, each carrying the five-state evidence model (`EXTRACTED`/`RESOLVED`/`INFERRED`/`AMBIGUOUS`/`UNKNOWN`) and full provenance already ratified in `research/ARCHITECTURE_DECISION_GATE.md` §6/§7. Split into two cheap, queue-driven, checkpointed unit types: a parse-free `contains` phase (pure D1 reads over already-persisted Feature 002 hierarchy) and a `parsed` phase (exactly one file re-parsed per unit, reusing Feature 002's unchanged `grammar-provider.ts`, new relationship-focused `.scm` queries, resolution limited to cheap indexed D1 lookups). Unit granularity is deliberately conservative — **one file per unit, no batching of the parse step** — because this account is on the **Workers Free** plan (confirmed directly against the dashboard during planning, research.md §1, not assumed). **[AMENDED 2026-09-24 20:07 +04:00 — the Queue-Consumer-specific value "10 ms CPU per invocation, no paid exception" that this sentence originally paired with the plan is NOT CONFIRMED by authoritative Cloudflare documentation: X = CONTRADICTORY, Y = PARTIAL, T007 STOPPED; see research.md Amendments A4 (Cloudflare documentation review, 2026-09-24 17:09 +04:00). The original wording is retained in git history.]** Additive-only to Feature 001/002 (new D1 tables, new queue, new server functions) — no existing table, source file, or function signature is modified.

## Technical Context

**Language/Version**: TypeScript 5.8, Bun runtime (dev), Cloudflare Workers runtime (prod) — unchanged, matches Feature 001/002.

**Primary Dependencies**: None new. Reuses `web-tree-sitter@0.25.10` + `tree-sitter-wasms@0.1.13` via Feature 002's existing, unchanged `grammar-provider.ts`/`getParser` (the T066-validated build-time `?module` + scoped `WebAssembly.instantiate` mechanism) — no new grammar-loading code, no new npm dependency. New relationship-focused `.scm` query files per Tier-1 language, same pattern as `symbols/queries/*.scm`. `createServerFn` (reused pattern, zero new dependency).

**Storage**: Cloudflare D1 (extended — new tables: `relationships`, `relationship_candidates`, `relationship_extraction_jobs`, `snapshot_relationship_extractions`, additive-only in `data/code-intel-schema.sql`). No new D1/R2 binding, no new database, no dedicated graph database (research.md §6, carrying forward `research/ARCHITECTURE_DECISION_GATE.md` §4 unchanged). R2 is read-only (existing `getObject`, re-reading Feature 001 file bytes for the `parsed` phase's re-parse; zero new R2 writes). One new Cloudflare binding: a third Queue, `RELATIONSHIP_QUEUE` (topic `repo-atlas-relationship-extraction`), independent of `SNAPSHOT_QUEUE`/`SYMBOL_QUEUE` (research.md §5).

**Testing**: `bun test`, extended with `tests/contract/relationships/` and `tests/integration/relationships/`, reusing `tests/support/d1-sqlite-adapter.ts` unchanged (already loads `data/code-intel-schema.sql` in full).

**Target Platform**: Cloudflare Workers (`cloudflare-module` Nitro preset, unchanged) for production — **confirmed Workers Free plan** (research.md §1); Bun/Node + Wrangler local emulation for development.

**Project Type**: Single TanStack Start web app (existing structure) — additive server-side infrastructure, same posture as Feature 001/002.

**Performance Goals**: No fixed request-latency SLA (developer/operator-triggered infra). Per-unit CPU budget is the binding constraint, not latency: each `parsed`-phase unit (one file: re-parse + relationship-query + bounded indexed-lookup resolution + D1 writes) must stay within Workers Free's ~10 ms CPU/invocation ceiling, using Feature 002's own live-validated per-file parse cost as the evidence base (research.md §1) — explicitly narrower than Feature 002's own 50-file `CODE_INTEL_EXTRACTION_BATCH_SIZE`, which governed a cheaper (parse + insert only, no resolution) workload. **[AMENDED 2026-09-24 17:09 +04:00 — Cloudflare documentation review: the Free Queue Consumer CPU limit is NOT confirmed; X = CONTRADICTORY, Y = PARTIAL, T007 STOPPED; see research.md Amendments A4.]**

**Constraints**: **Workers Free — 10 ms CPU per invocation, hard cap, no paid exception** (confirmed live, research.md §1) — this is the dominant constraint for this feature's design, stronger than Feature 002's (which assumed, and per `research/ARCHITECTURE_DECISION_GATE.md` §3 recommended, a paid plan that turns out not to exist). Same 128 MB isolate memory ceiling and 64 MiB Worker bundle-size limit as Feature 001/002, now shared with the same WASM grammars (no new WASM added — `.scm` query files are plain text, negligible bundle impact). Queue delivery is at-least-once (every `RelationshipExtractionJob` unit must be idempotent). Cloudflare Free-plan Queues: 10,000 operations/day; D1 Free-plan: 5 GB storage, 5M row reads/day, 100k row writes/day — both comfortably within budget at Feature 002's already-demonstrated live scale (research.md §5/§6), flagged as a Risk only for much larger future snapshots. **[AMENDED 2026-09-24 17:09 +04:00 — Cloudflare documentation review: the Free Queue Consumer CPU limit is NOT confirmed; X = CONTRADICTORY, Y = PARTIAL, T007 STOPPED; see research.md Amendments A4.]**

**Scale/Scope**: Bounded to exactly Tier-1 languages (Java, JavaScript, TypeScript, TSX) and exactly the eight relationship types ratified in `research/ARCHITECTURE_DECISION_GATE.md` §6 — matches Feature 002's language scope exactly, no new language support. Deterministic resolution is deliberately narrow (research.md §2): indexed point-lookups only, no scope-aware type resolution, no cross-snapshot/cross-repository relationships (spec Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Data Fidelity | Relationships are only ever derived from real, already-persisted Feature 001/002 data (D1 reads) or a real re-parse of real snapshot file bytes; nothing invented. `AMBIGUOUS`/`UNKNOWN` states exist specifically to prevent a fabricated single target (FR-007) — a direct extension of Data Fidelity into relationship evidence. | PASS |
| II. Visualization-First, Data-Driven | No UI, feeds no data into `AtlasScene`/catalogue/categories/insights. | PASS (not applicable — same as Feature 001/002) |
| III. Server-Side Secrets & Resilience | No new secret. Local/prod parity follows Feature 001/002's established D1/R2/Queues Miniflare-emulation precedent, unchanged. | PASS |
| IV. Performance Budgets | New cap introduced and *tightened* relative to Feature 002: one-file-per-unit `parsed` phase, justified directly by the newly-confirmed Workers Free 10 ms/invocation ceiling (research.md §1) — not speculative, evidence-based and more conservative than Feature 002's own batch size specifically because this workload is heavier per file. | PASS | **[AMENDED 2026-09-24 17:09 +04:00 — Cloudflare documentation review: the Free Queue Consumer CPU limit is NOT confirmed; X = CONTRADICTORY, Y = PARTIAL, T007 STOPPED; see research.md Amendments A4.]**
| V. Simplicity & Minimal Scope | Strictly bounded to the eight relationship types ratified in `research/ARCHITECTURE_DECISION_GATE.md` §6 and `sdd/04-engineering-graph/PHASE.md`'s v1 subset; explicitly excludes `Package`/`Variable` nodes, `DECORATED_BY`/`ANNOTATED_WITH`/`ROUTES`/`PUBLISHES`/`CONSUMES`/`READS`/`WRITES` edges, impact analysis, process discovery, MCP, AI/RAG, vector search, UI, Settings (spec Non-Goals). Zero new npm dependencies. Reuses Feature 002's grammar-loading mechanism unchanged rather than inventing a second one (research.md §3). | PASS |

No violations. **Complexity Tracking is not needed.**

## Project Structure

### Documentation (this feature)

```text
specs/004-engineering-relationship-graph/
├── plan.md                          # This file
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   ├── d1-schema-additions.sql
│   ├── extract-relationships.functions.md
│   └── relationship-query.functions.md
└── tasks.md                         # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── code-intel/
│   │   ├── domain/
│   │   │   └── relationship.ts                       # NEW — Relationship/RelationshipCandidate/RelationshipExtractionJob/SnapshotRelationshipExtraction domain types + status enums (mirrors domain/symbol.ts's shape)
│   │   ├── relationships/
│   │   │   ├── queries/
│   │   │   │   ├── java.scm                          # NEW — per-language relationship-bearing-syntax queries (imports, extends/implements clauses, call expressions) — FR-002
│   │   │   │   ├── javascript.scm                     # NEW
│   │   │   │   ├── typescript.scm                     # NEW
│   │   │   │   └── tsx.scm                             # NEW
│   │   │   ├── to-relationship-facts.ts                # NEW — query captures → raw relationship facts (unresolved, EXTRACTED-only), reuses parser.language!/tree shape exactly like symbols/to-intermediate-representation.ts
│   │   │   ├── relationship-resolver.ts                # NEW — bounded indexed-lookup resolution (research.md §2): raw fact → RESOLVED/AMBIGUOUS/UNKNOWN against already-persisted symbols/file_extractions
│   │   │   ├── contains-derivation.ts                  # NEW — pure-D1 CONTAINS + EXPORTS derivation from directories.parent_path/file_extractions.directory_path/symbols.parent_symbol_id/symbols.is_exported (research.md §4), no parse, no indexed lookup — EXPORTS reuses this module because Feature 002 already persists is_exported, so it needs no relationship-resolver involvement **[AMENDED 2026-09-24 16:46 +04:00 — R4:** EXPORTS no longer derived here; see research.md A2**]**
│   │   │   ├── relationship-identity.ts                 # NEW — deterministic relationship_key hashing (FR-004), direct analog of symbols/symbol-identity.ts **[AMENDED 2026-09-24 16:46 +04:00 — R6:** key must not use row ids; see research.md A3**]**
│   │   │   └── extraction-pipeline.ts                   # NEW — per-file parse → relationship-facts → resolve → persist, file-scoped failure containment (FR-008), one file per invocation (research.md §1)
│   │   ├── queue/
│   │   │   └── relationship-worker.ts                   # NEW — Cloudflare Queue consumer for repo-atlas-relationship-extraction, one RelationshipExtractionJob unit (contains or parsed) per invocation, structurally mirrors symbols/symbol-worker.ts
│   │   ├── persistence/
│   │   │   ├── relationship-d1-client.ts                # NEW — thin D1 query layer for relationships/relationship_candidates/relationship_extraction_jobs/snapshot_relationship_extractions, same D1DatabaseLike pattern as persistence/symbol-d1-client.ts
│   │   │   └── cloudflare-env.ts                        # EXTENDED (additive only) — CloudflareEnv.RELATIONSHIP_QUEUE + getRelationshipQueue(), mirroring getSymbolQueue(); no existing field/function removed or renamed
│   │   ├── relationship.functions.ts                     # NEW — createServerFn RPC surface: extractSnapshotRelationships, getRelationshipExtractionStatus, listRelationships, getRelationship (FR-010–FR-014)
│   │   └── feature-004-server-fn-registration.tsx        # NEW — mirrors feature-002-server-fn-registration.tsx, registers all four functions above, mounted in src/routes/__root.tsx alongside Feature001/002ServerFnRegistration
│   └── atlas-errors.ts                                   # EXTENDED (additive only) — SNAPSHOT_NOT_RELATIONSHIP_EXTRACTABLE; existing codes/messages untouched
├── routes/                                                # __root.tsx gets one new mount line (Feature004ServerFnRegistration); no new route
└── components/                                            # UNCHANGED

wrangler.toml                                              # EXTENDED — new [[queues.producers]]/[[queues.consumers]] entries for repo-atlas-relationship-extraction, additive alongside the existing two queues' entries
nitro.config.ts                                             # EXTENDED — plugins array gains ./plugins/cloudflare-relationship-queue.ts alongside the existing two queue-plugin entries
plugins/
└── cloudflare-relationship-queue.ts                        # NEW — cloudflare:queue hook listener filtering on batch.queue === "repo-atlas-relationship-extraction" (research.md §5), does not modify the other two queue plugins
data/
└── code-intel-schema.sql                                   # EXTENDED (additive only) — contracts/d1-schema-additions.sql's CREATE TABLE statements appended
tests/
├── contract/
│   └── relationships/                                      # NEW — relationship_key determinism, per-language relationship-fact-extraction fixture correctness, bounded-resolution correctness (RESOLVED vs AMBIGUOUS vs UNKNOWN), idempotent-insert behavior
└── integration/
    └── relationships/                                      # NEW — end-to-end derive→persist→query against small real fixture repos per Tier-1 language (quickstart.md's 8 scenarios)
```

**Structure Decision**: Single-project TanStack Start app (existing layout, unchanged) — same posture as Feature 001/002. All new code lives under `src/lib/code-intel/`, adding a `relationships/` subdirectory parallel to (not replacing) `symbols/`, `acquisition/`, `providers/`, `persistence/`, `queue/`. No existing Feature 001 or Feature 002 file is modified except the additive schema file and the two config files (`wrangler.toml`, `nitro.config.ts`), which are pure additions (new array entries).

## Existing Code Reused

| Existing asset | Reused as | Notes |
|---|---|---|
| `createServerFn` RPC pattern + plain-handler/wrapper split (`symbol.functions.ts`) | Template for `relationship.functions.ts` | Same `.validator().handler()` shape |
| `D1DatabaseLike` / `persistence/symbol-d1-client.ts`'s thin-query-layer pattern | Template for `persistence/relationship-d1-client.ts` | New module, zero change to the existing one |
| `tests/support/d1-sqlite-adapter.ts` | Reused **unchanged** | New tables available to tests with zero test-harness changes |
| `getObject` (`persistence/r2-client.ts`) | Reused directly, unmodified | This feature's only R2 interaction is re-reading Feature 001's existing file bytes for the `parsed` phase |
| `getParser`/`grammar-provider.ts` (Feature 002, T066-validated) | Reused directly, **unmodified** | No new grammar-loading mechanism — the exact WASM-instantiation-substitution mechanism proven live in T068 (research.md §3) |
| `listSnapshotFilesPage`'s id-ordered cursor pagination (`persistence/d1-client.ts`) | File-batch ordering for the `parsed` phase's checkpointing | Same stable ordering, not a second concept (data-model.md, Checkpoint/Resume) |
| `AtlasError`/`atlasErrorMessage`/`serializeAtlasError` (`atlas-errors.ts`) | Extended with `SNAPSHOT_NOT_RELATIONSHIP_EXTRACTABLE` | Additive union member only |
| `codeIntelConfig()` two-tier tunable pattern (`config.ts`) | Template for `RELATIONSHIP_EXTRACTOR_VERSION` + relationship-specific tunables (e.g. `CODE_INTEL_RELATIONSHIP_CONTAINS_BATCH_SIZE`) | New constants in the same module or a sibling one, same style |
| `plugins/cloudflare-symbol-queue.ts` + `nitro.config.ts`'s `cloudflare:queue` hook wiring | Pattern reused for a third queue, existing files untouched | research.md §5 |
| `persistence/cloudflare-env.ts`'s `CloudflareEnv`/`SYMBOL_QUEUE`/`getSymbolQueue()` pattern | Extended (additive) with `RELATIONSHIP_QUEUE`/`getRelationshipQueue()` | Same file, same shape — no existing field renamed or removed |
| `symbols/symbol-identity.ts`'s `symbol_key` hashing pattern | Template for `relationship-identity.ts`'s `relationship_key` | data-model.md's Relationship entity |
| `symbols/to-intermediate-representation.ts`'s query-capture-to-IR walk | Template for `relationships/to-relationship-facts.ts` | Same tree-sitter query-capture consumption shape, different target shape (facts, not symbols) |

## Extraction Workflow

1. Caller invokes `extractSnapshotRelationships({ snapshotId })` (`relationship.functions.ts`).
2. The handler verifies the target Feature 002 `snapshot_extractions` row has `status` in `completed`/`completed_partial` (FR-010); if not, throws `SNAPSHOT_NOT_RELATIONSHIP_EXTRACTABLE` — no `snapshot_relationship_extractions` row is created.
3. **Resolve extraction state** — query `snapshot_relationship_extractions` for this `snapshot_id`:
   - No row: proceed to step 4.
   - Row exists, `status` is `completed`/`completed_partial`, `relationship_extractor_version` matches current AND `symbol_extractor_version` matches the snapshot's current Feature 002 version: return immediately, `reused: true` (FR-009).
   - Row exists, `status` is `in_progress`: return the in-progress status, `reused: false`, no new units enqueued (FR-011).
   - Row exists, either version differs: proceed to step 4 (fresh run; supersedes prior rows per data-model.md's delete-then-insert mechanism).
4. Insert/update the `snapshot_relationship_extractions` row (`status = "in_progress"`). Enqueue the first `unit_type = 'contains'` `RelationshipExtractionJob` unit to `RELATIONSHIP_QUEUE`.
5. **`contains` phase** (research.md §4): `contains-derivation.ts` reads `directories`/`file_extractions`/`symbols` for the snapshot in bounded batches (no parse, cheap), inserts `CONTAINS` relationships (`evidenceState: "EXTRACTED"`, `extractionMethod: "directory-hierarchy"` or `"symbol-parent"`) **and** `EXPORTS` relationships (`evidenceState: "EXTRACTED"`, `extractionMethod: "export-flag"`, one edge per top-level symbol with `is_exported = 1`, already-persisted Feature 002 data — no parse, no resolver involvement), each idempotent via `relationship_key`. When the `contains` phase's last batch finishes, the worker enqueues the first `unit_type = 'parsed'` unit. **[AMENDED 2026-09-24 16:46 +04:00 — R4:** the EXPORTS part of this step is superseded; EXPORTS is parse-derived in the `parsed` phase; see research.md Amendments A2.**]**
6. **`parsed` phase** (research.md §1): `relationship-worker.ts` delivers one unit per Tier-1 file. `extraction-pipeline.ts`, for that one file: (a) skips if relationship rows already exist for this file at the current version pair (idempotent redelivery/resume); (b) otherwise reads the file's bytes via `getObject`, re-parses with `getParser` (unchanged from Feature 002), runs the relationship `.scm` query for that language, derives raw relationship facts via `to-relationship-facts.ts`; (c) `relationship-resolver.ts` attempts a single bounded indexed D1 lookup per fact (research.md §2) — `RESOLVED` on exactly one candidate, `AMBIGUOUS` with the candidate set on multiple, `UNKNOWN` on zero (e.g. external import); (d) persists relationships (and `relationship_candidates` for `AMBIGUOUS` rows) via `relationship-d1-client.ts`. A file-level failure is caught and scoped to that file only (FR-008) — no partial relationship rows for a failed file, no effect on any other file.
7. When the `parsed` phase's last unit finishes, finalize: recompute the snapshot-wide status (`completed` if every file's `parsed`-phase unit succeeded, `completed_partial` if at least one failed, per FR-013's mirror of Feature 002's FR-016) and update `snapshot_relationship_extractions` in a guarded update (same idempotent-finalization guard shape as Feature 001/002).
8. `getRelationshipExtractionStatus`/`listRelationships`/`getRelationship` read this feature's D1 tables directly; a non-terminal run never reports as `completed`/`completed_partial` (FR-013).

## Per-Invocation CPU Budget (the feature's central design constraint)

See research.md §1 in full. This account is confirmed **Workers Free** (10 ms CPU/invocation, no paid exception) — verified live during planning, not assumed. Design response: `contains` phase units do pure D1 reads/writes only (no parse, cheapest possible operation); `parsed` phase units process exactly one file each, reusing Feature 002's already-live-validated per-file parse cost as the evidence baseline, with resolution work capped to bounded indexed D1 lookups only (research.md §2) — no full-snapshot scans, no O(n²) candidate search, no scope-aware type resolution. Real per-unit CPU-ms is not yet measured (flagged as a `/speckit-tasks` prerequisite: instrument and log it during implementation) — this plan's unit granularity is deliberately conservative pending that measurement, not tuned to a number that doesn't exist yet. **[AMENDED 2026-09-24 17:09 +04:00 — Cloudflare documentation review: the Free Queue Consumer CPU limit is NOT confirmed; X = CONTRADICTORY, Y = PARTIAL, T007 STOPPED; see research.md Amendments A4.]**

## Deterministic Resolution Scope

See research.md §2. `IMPORTS`/`EXTENDS`/`IMPLEMENTS` are resolvable via one indexed lookup each (parse-dependent, `parsed` phase). `CALLS`/`USES`/`REFERENCES` resolve to `RESOLVED` only on exactly one candidate under the same bounded lookup; more than one candidate is `AMBIGUOUS` (candidate set retained, FR-007); zero candidates (e.g., external/dynamic) is `UNKNOWN`, never omitted (FR-005/FR-006). `EXPORTS` is **not** a resolution-dependent type at all — Feature 002 already persists each symbol's `is_exported` flag directly, so `EXPORTS` edges (`file → symbol`) are derived by a pure D1 read in the `contains` phase, exactly like `CONTAINS`, with zero parse and zero indexed lookup (research.md §2/§4). **[AMENDED 2026-09-24 16:46 +04:00 — R4:** `EXPORTS` is also parse-dependent; see research.md Amendments A2.**]**

## D1 Persistence & Schema

See `data-model.md` and `contracts/d1-schema-additions.sql` in full. Four new tables (`relationships`, `relationship_candidates`, `relationship_extraction_jobs`, `snapshot_relationship_extractions`), all additive to `data/code-intel-schema.sql`, none altering an existing Feature 001/002 table.

## Extraction Status & Failure Handling

Per-file (`parsed` phase): success (relationship rows written, possibly zero if the file has no relationship-bearing syntax) \| failure (scoped to that file, FR-008). Snapshot-level: `not_started` (row absent) \| `in_progress` \| `completed` \| `completed_partial` \| `failed` (`snapshot_relationship_extractions.status`, FR-013). A file-level failure never escalates to a whole-snapshot `failed` status by itself, mirroring Feature 001/002's identical distinction.

## Idempotent Re-extraction & Dual-Version Provenance

See data-model.md's "Re-extraction Mechanism" and research.md §1/§6. A `RELATIONSHIP_EXTRACTOR_VERSION` constant (new tunable, same style as `SYMBOL_EXTRACTOR_VERSION`) plus the recorded `symbol_extractor_version` (FR-018) together gate reuse — either changing invalidates a prior run. Same-version-pair re-extraction is idempotent by `relationship_key`-based delete-then-reinsert (FR-009); no cross-version history table, same deliberate simplification Feature 002 already made and justified for the identical reason (no spec requirement to query a superseded version's results). [AMENDED 2026-09-24 16:58 +04:00 — R6 D-R6-1/2:** `RELATIONSHIP_EXTRACTOR_VERSION` scopes dataset validity and reuse and is not part of `relationship_key`; the two-version gate above is necessary but not sufficient, because a same-version F002 re-extraction also invalidates affected relationships (research.md A3 Resolution). Signaling mechanism not defined here.**]**

## Checkpoint/Resume Strategy

See data-model.md's "Checkpoint/Resume Strategy": two independent id-ordered cursors, one per `unit_type`, reusing Feature 001/002's exact resumption shape (`id > cursor`, idempotent per-item skip-if-already-done).

## `createServerFn` Trigger & Queue Processing Model

`relationship.functions.ts` exposes four `createServerFn`-wrapped functions (contracts in `contracts/extract-relationships.functions.md` and `contracts/relationship-query.functions.md`), all registered via `Feature004ServerFnRegistration`. A third, independent Cloudflare Queue (`repo-atlas-relationship-extraction`) carries `RelationshipExtractionJob` unit messages (both `unit_type`s), consumed by `relationship-worker.ts` via a third `cloudflare:queue` Nitro hook listener (`plugins/cloudflare-relationship-queue.ts`) filtering on `batch.queue`, registered alongside (not replacing) the other two queue plugins.

## Consuming Feature 001/002 Without Modifying Them

This feature only ever **reads** Feature 001/002 data: Feature 002's `snapshot_extractions`/`file_extractions`/`symbols`/`directories` status and content, `getObject` for file bytes, joins through `snapshots`/`repositories` for provenance. No Feature 001 or Feature 002 source file is edited. The only touches to their *configuration surface* are additive: new tables appended to the shared schema file, new array entries in `wrangler.toml`/`nitro.config.ts` alongside existing entries (FR-017).

## Tests

Mirrors Feature 002's test-shape decisions: contract tests (`tests/contract/relationships/`) for `relationship_key` hashing determinism and per-language relationship-fact-extraction fixture correctness (one fixture per Tier-1 language covering at least one import, one extends/implements clause, and both an exported and non-exported declaration); integration tests (`tests/integration/relationships/`) for all 8 `quickstart.md` scenarios plus **dedicated per-type resolution-behavior tests for every one of the eight relationship types** (2026-09-22 remediation, closes `/speckit-analyze` H3) — `CONTAINS` derivation, `IMPORTS` both `RESOLVED` (cross-file) and `UNKNOWN` (external) paths, `EXTENDS`/`IMPLEMENTS` resolution, `EXPORTS` derivation (no resolution step), `CALLS` across all three reachable states (`RESOLVED` on a single candidate, `AMBIGUOUS` on multiple with the correct candidate set, `UNKNOWN` on zero), `USES` and `REFERENCES` resolution behavior (same bounded-lookup rule as `CALLS`, each with its own dedicated fixture, not merely asserted to "appear" in a generic loop) — plus file-scoped failure containment, idempotent re-extraction, symbol-re-extraction invalidation, duplicate delivery, retry, concurrent-request, and bounded pagination. See `tasks.md` Phase 3/5 (T018, T032, T035, T036) for the specific dedicated tasks.

## Migration/Backward Compatibility

**No migration.** All new D1 tables, no altered table. `data/schema.sql`/`data/atlas.sqlite` and Feature 001/002's own tables are untouched. **No behavior change** to any existing route, component, or server function, including all nine of Feature 001's and Feature 002's own functions — verified by this plan touching zero Feature 001/002 source files except the shared additive schema file and the two additive config files. **Deployment prerequisite, not a migration**: the new queue must be provisioned and the schema additions applied, mirroring Feature 001/002's own precedent — all within Workers Free's confirmed Queues/D1 free-tier allotments at current scale (research.md §5/§6).

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Real per-unit CPU-ms for the `parsed` phase (parse + query + resolve + write) is not yet measured against the confirmed 10 ms Workers Free ceiling — one-file-per-unit is evidence-based but not yet proven at this feature's own, heavier workload | Explicit `/speckit-tasks` prerequisite: instrument and log observed CPU time per unit during implementation before declaring the granularity final; if a file's relationship extraction alone exceeds budget, the fallback is splitting `parsed` work per relationship-type-family within one file (e.g., imports/exports in one invocation, calls in another) rather than batching multiple files — narrows further, never widens | **[AMENDED 2026-09-24 17:09 +04:00 — Cloudflare documentation review: the Free Queue Consumer CPU limit is NOT confirmed; X = CONTRADICTORY, Y = PARTIAL, T007 STOPPED; see research.md Amendments A4.]**
| A snapshot with several thousand Tier-1 files could approach the Free-plan Queues 10,000-ops/day cap under one-file-per-unit granularity (research.md §5) | Not a blocking risk at any scale exercised so far (Feature 002's live validation: 33 files); documented explicitly rather than silently ignored, revisit only if real usage approaches it |
| Feature 002 itself may already be operating close to or occasionally over the 10 ms Free-plan ceiling for its own batched parse step, relying on Cloudflare's "infrequent overage" isolate flexibility (research.md §1) — this is a pre-existing condition, not introduced by this feature | Out of scope to fix here (Feature 002 is production-complete and this plan must not modify it, FR-017); noted so a future hardening pass on Feature 002 has this plan's evidence trail to start from | **[AMENDED 2026-09-24 17:09 +04:00 — Cloudflare documentation review: the Free Queue Consumer CPU limit is NOT confirmed; X = CONTRADICTORY, Y = PARTIAL, T007 STOPPED; see research.md Amendments A4.]**
| Bounded indexed-lookup resolution (research.md §2) will under-resolve compared to a full type-aware analysis — many real `CALLS`/`USES` will land in `AMBIGUOUS`/`UNKNOWN` rather than `RESOLVED` | Treated as correct, honest output per the evidence model (FR-006/FR-007), not a defect — matches spec Assumptions explicitly |
| Re-parsing every file a second time (once for Feature 002's symbols, once for this feature's relationships) doubles WASM parse invocations per snapshot | Accepted deliberately (research.md §3) — Feature 002 discards its tree by design (T014's memory-safety fix) and modifying that to cache a tree for a future feature would violate FR-017 and constitution Principle V; re-parsing is the honest cost of true additive-only integration |
