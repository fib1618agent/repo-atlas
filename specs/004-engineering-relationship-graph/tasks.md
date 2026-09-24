# Tasks: Engineering Relationship Graph

**Input**: Design documents from `specs/004-engineering-relationship-graph/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included — Feature 001/002 both established a tested-first-in-repo precedent, and spec.md's own acceptance scenarios require executable verification (idempotency, ambiguity handling, evidence states).

**Local-first validation policy (user directive, 2026-09-22)**: Nothing in this task list pushes to the remote repository, deploys to Cloudflare, or touches remote D1/Queues/a live Worker. Everything through Phase 10 is local-only (`bun test`, `bunx tsc --noEmit`, `bun run build`, local Wrangler emulation at most). Phase 11 is an explicit STOP gate — Cloudflare live validation is a separate, later, explicitly-authorized phase not covered by this file.

**Format**: `[ID] [P?] [Story] Description with file path`

**2026-09-22 remediation note**: This revision closes `/speckit-analyze` findings H1 (FR-001 re-parse wording — resolved in spec.md itself, no task change needed), H2 (evidence-state single-canonical-field wording — resolved in spec.md/research.md/data-model.md/quickstart.md, no task change needed), and H3 (missing dedicated tests for `EXPORTS`, `CALLS`→`RESOLVED`, `USES`, `REFERENCES` — **new tasks T018, T032, T035, T036 added below**, shifting all subsequent task IDs). Task count: 72 → 76.

---

## Phase 1: Setup

**Purpose**: Project-structure scaffolding only — no relationship logic yet.

- [X] T001 Create empty directory structure: `src/lib/code-intel/relationships/queries/`, `tests/contract/relationships/`, `tests/integration/relationships/` per plan.md's Project Structure.
- [X] T002 [P] Add `RELATIONSHIP_EXTRACTOR_VERSION` constant and relationship-specific tunables (`CODE_INTEL_RELATIONSHIP_CONTAINS_BATCH_SIZE`, `CODE_INTEL_RELATIONSHIP_MAX_CANDIDATES`) to `src/lib/code-intel/config.ts`, following the exact style of the existing `SYMBOL_EXTRACTOR_VERSION`/`codeIntelConfig()` pattern already in that file (additive only — no existing constant touched).

**Checkpoint**: Directories exist, config tunables exist. No behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, domain types, and — critically — the CPU-feasibility spike that the proposed one-file-per-unit granularity depends on. **No user-story implementation may begin until T006's feasibility classification is `comfortably bounded` or `borderline` (with an accepted mitigation). If T006 classifies `likely unsafe`, STOP — do not proceed past this phase; re-open plan.md's unit-granularity decision instead.**

- [X] T003 Append `contracts/d1-schema-additions.sql`'s four `CREATE TABLE` statements (`relationships`, `relationship_candidates`, `relationship_extraction_jobs`, `snapshot_relationship_extractions`) verbatim to `data/code-intel-schema.sql`, after Feature 002's existing additions, with the same "additive, no existing statement altered" comment header Feature 002 used.
- [X] T004 [P] Create `src/lib/code-intel/domain/relationship.ts` — `Relationship`, `RelationshipCandidate`, `RelationshipExtractionJob`, `SnapshotRelationshipExtraction` domain types plus `RelationshipType` (8-member union), `EvidenceState` (5-member union — the single canonical evidence field, per research.md §2's H2 clarification), `RelationshipUnitType` (`'contains' | 'parsed'`), `RelationshipExtractionStatus` enums, per data-model.md — mirrors `domain/symbol.ts`'s shape exactly.
- [X] T005 [P] Create `src/lib/code-intel/relationships/relationship-identity.ts` — deterministic `relationship_key` SHA-256 hashing per data-model.md's canonical-string definition, direct structural port of `symbols/symbol-identity.ts`. **[AMENDED 2026-09-24 16:46 +04:00 — R6:** the identity formula MUST NOT use D1 row ids; the existing code implements the old formula and is not modified here; see research.md Amendments A3.**]** [AMENDED 2026-09-24 16:58 +04:00 — R6 D-R6-1/3:** code is not modified here; when revisited the implemented formula must follow research.md A3 Resolution (symbol_key / paths; no row ids; no `relationship_extractor_version`; target retained).**]**
- [X] T006 **[CPU FEASIBILITY SPIKE — GATING, must complete before T009+]** Build a throwaway-but-promotable local measurement script (`scripts/relationship-cpu-spike.ts`, run via `bun run scripts/relationship-cpu-spike.ts`, not part of the app bundle) that: (a) reuses Feature 002's unchanged `getParser`/`grammar-provider.ts` unmodified (per FR-001's clarified wording — no second grammar system); (b) parses a representative fixture matrix — small (~20 lines), medium (~200 lines), large (~2,000 lines, near `CODE_INTEL_MAX_FILE_SIZE_BYTES`'s ceiling) × {Java, JavaScript, TypeScript, TSX} — reusing/extending the inline fixture sources already present in `tests/contract/symbols/*-extraction.test.ts`, generating larger synthetic variants by repetition for the medium/large tiers; (c) for each fixture, runs a first-draft relationship `.scm` query (import/extends/implements/call-expression captures only — `EXPORTS` is D1-only, not parse-derived, per T021 — this becomes T019's starting point, not wasted work) and a stubbed bounded-lookup resolution step (an in-memory `Map` standing in for the real indexed D1 lookup, since D1 read latency is I/O-bound and explicitly excluded from CPU time per Cloudflare's own definition — research.md §1); (d) measures wall-clock time per fixture via `process.hrtime.bigint()`, run 20 iterations per fixture, records min/median/p95/max; (e) explicitly labels every number as a **local wall-clock proxy, not a Cloudflare CPU-time measurement** (per the user's own instruction — this does not "prove" Cloudflare compliance); (f) classifies each fixture as `comfortably bounded` (p95 well under 10 ms with a working margin — e.g. adopt <3 ms as the "comfortable" line given local wall-clock will underrepresent isolate overhead), `borderline` (3–8 ms), or `likely unsafe` (>8 ms or highly variable/tail-heavy); (g) writes the full results table to `specs/004-engineering-relationship-graph/feasibility-results.md`. **CALLS/USES resolution-heavy fixtures get their own row** (a file with 10+ call sites, several ambiguous) since the spec explicitly flags this as the expensive case. **[AMENDED 2026-09-24 16:46 +04:00 — R3:** the "large (~2,000 lines…)" tier as built is a dense worst-case AST-shape fixture of about 705 lines; text above preserved; see research.md Amendments A1.**]** **[AMENDED 2026-09-24 17:11 +04:00 — Cloudflare documentation review:** the "10 ms" figures in this task (the "p95 well under 10 ms" comfort line and the 3–8 ms / >8 ms classification bands) were an earlier working assumption and local-label framing, not a confirmed Free Queue Consumer CPU limit. The authoritative Free Queue Consumer CPU limit remains unresolved (X = CONTRADICTORY) and the CPU accounting unit is only partly defined (Y = PARTIAL); neither 10 ms nor 30 seconds is confirmed for it. T007 remains STOPPED. See research.md Amendments A4.**]**
- [X] T007 Review T006's `feasibility-results.md` and record the **explicit go/no-go decision** as a new "CPU Feasibility — Empirical Result" section appended to `specs/004-engineering-relationship-graph/research.md` §1 (do not delete or rewrite the existing pre-measurement analysis — append the real numbers alongside it, dated). If any fixture classifies `likely unsafe`, this task's output MUST say so plainly and the workflow STOPS here (do not proceed to T008+) until the architecture is reconsidered (e.g., splitting `parsed`-unit work further per relationship-type-family, per plan.md's Risks table mitigation) and re-validated.
- [ ] T008 [P] Extend `src/lib/code-intel/persistence/cloudflare-env.ts` (additive only) with `CloudflareEnv.RELATIONSHIP_QUEUE` and `getRelationshipQueue()`, mirroring `getSymbolQueue()` exactly — no existing field/function removed or renamed.
- [ ] T009 [P] Create `src/lib/code-intel/persistence/relationship-d1-client.ts` — thin D1 query layer (`getOrInsertRelationship`, `insertRelationshipCandidates`, `upsertRelationshipExtractionJob`, `getSnapshotRelationshipExtraction`, `upsertSnapshotRelationshipExtraction`, indexed lookup helpers `findSymbolCandidates(snapshotId, kind, name)` / `findFileByImportPath(snapshotId, path)`), same `D1DatabaseLike` pattern as `persistence/symbol-d1-client.ts`. **[AMENDED 2026-09-24 16:46 +04:00 — R6:** lookup helpers must also return each candidate's `symbol_key` (identity basis); see research.md Amendments A3.**]**
- [ ] T010 [P] Extend `src/lib/code-intel/atlas-errors.ts` (additive only) with `SNAPSHOT_NOT_RELATIONSHIP_EXTRACTABLE`.
- [ ] T011 Add `plugins/cloudflare-relationship-queue.ts` (new file, filters on `batch.queue === "repo-atlas-relationship-extraction"`) and register it in `nitro.config.ts`'s `plugins` array alongside the existing two entries (additive line only). Add `[[queues.producers]]`/`[[queues.consumers]]` entries for `repo-atlas-relationship-extraction` to `wrangler.toml`, additive alongside the existing two queues' entries — **local-only at this point**: these entries make local `wrangler dev --local` emulation possible; they are not applied to any remote Cloudflare account by this task.
- [ ] T012 [P] Extend `tests/support/d1-sqlite-adapter.ts` only if it does not already load the full `data/code-intel-schema.sql` verbatim (it should, per Feature 002's precedent — verify by running one existing Feature 002 test after T003, no code change expected; if a change IS needed, make it the minimum diff and note why in a comment).

**Checkpoint**: Schema, domain types, identity hashing, D1 client, queue plumbing, and — most importantly — **a data-backed, documented CPU-feasibility classification** all exist. User-story implementation may begin only if T007's classification is not `likely unsafe`.

---

## Phase 3: User Story 1 - Structural relationships derived from extracted symbols (Priority: P1) 🎯 MVP

**Goal**: Given a snapshot with completed Feature 002 extraction, derive and persist `CONTAINS`, `IMPORTS`, `EXTENDS`, `IMPLEMENTS`, `EXPORTS` relationships (the spec.md US1 acceptance scenarios plus the no-resolution-required `EXPORTS` type, which shares this story's "direct derivation" character per research.md §2) end-to-end.

**Independent Test**: quickstart.md Scenarios 1–3, run locally against `tests/support/d1-sqlite-adapter.ts` + `tests/support/memory-r2.ts` (no Cloudflare).

### Tests for User Story 1

- [ ] T013 [P] [US1] Contract test: `relationship_key` determinism (same inputs → same hash, different inputs → different hash) in `tests/contract/relationships/relationship-identity.test.ts`. **[AMENDED 2026-09-24 16:46 +04:00 — R6:** the test must also prove key stability across a Feature 002 re-extraction (symbol row ids change, `symbol_key` does not), not only same-input determinism; see research.md Amendments A3.**]** [AMENDED 2026-09-24 16:58 +04:00 — R6 D-R6-1/3:** the test must also assert that changing `relationship_extractor_version` does not change the key.**]**
- [ ] T014 [P] [US1] Contract test: per-language relationship-fact-extraction fixture correctness (one fixture per Tier-1 language, each containing at least one import, one extends/implements clause) in `tests/contract/relationships/{java,javascript,typescript,tsx}-relationships.test.ts` — promotes T006's spike queries into the real `relationships/queries/*.scm` files (import/extends/implements/call captures only — `EXPORTS` is out of scope for this test, see T018), real parse, no mocking (mirrors `tests/contract/symbols/*-extraction.test.ts`'s own precedent exactly). **[AMENDED 2026-09-24 16:46 +04:00 — R4:** "EXPORTS is out of scope for this test" no longer means EXPORTS is not parse-derived; export captures become part of the relationship queries; see research.md Amendments A2.**]**
- [ ] T015 [US1] Integration test: quickstart.md Scenario 1 (`CONTAINS` derives with zero parsing) in `tests/integration/relationships/contains-derivation.test.ts`.
- [ ] T016 [US1] Integration test: quickstart.md Scenario 2 (`IMPORTS` resolves within-snapshot → `RESOLVED`; external import → `UNKNOWN`, single canonical evidence-state value per spec.md's H2-remediated wording) in `tests/integration/relationships/imports-resolution.test.ts`.
- [ ] T017 [US1] Integration test: quickstart.md Scenario 3 (`EXTENDS`/`IMPLEMENTS` resolve to same-snapshot symbols) in `tests/integration/relationships/inheritance-resolution.test.ts`.
- [ ] T018 **[NEW — closes `/speckit-analyze` H3]** [US1] Integration test: `EXPORTS` relationships derive correctly from already-persisted Feature 002 data — a file's top-level `is_exported = 1` symbols each produce an `EXPORTS` edge (`file → symbol`, `evidenceState: "EXTRACTED"`, `extractionMethod: "export-flag"`) via `contains-derivation.ts` (pure D1 read of `symbols.is_exported`, **no parse, no relationship-resolver involvement** — corrected mechanism, 2026-09-22: `EXPORTS` is not resolution-dependent, unlike the other non-`CONTAINS` types, because Feature 002 already captured this flag), and top-level symbols with `is_exported = 0`/`NULL` produce none, in `tests/integration/relationships/exports-derivation.test.ts`. Exercises real derivation behavior (not a generic "assert type appears" loop) against a real fixture with both exported and non-exported declarations, for at least two Tier-1 languages (JS/TS `export`, Java's implicit-public-is-not-the-same-signal — assert Java correctly has zero `EXPORTS` edges unless Feature 002's own `is_exported` population already defines an equivalent explicit-visibility signal for Java; if it does not, assert that explicitly and document why in the test, per spec.md's FR-005/FR-002 scope). Depends on T021 (`contains-derivation.ts`'s `EXPORTS` handling), not on T019/T020/T022. **[AMENDED 2026-09-24 16:46 +04:00 — R4:** the "pure D1 read of `symbols.is_exported`" mechanism is superseded (persisted `is_exported` is NULL); EXPORTS is parse-derived within Feature 004; the Java clause stays; see research.md Amendments A2.**]**

### Implementation for User Story 1

- [ ] T019 [P] [US1] Create `src/lib/code-intel/relationships/queries/java.scm`, `javascript.scm`, `typescript.scm`, `tsx.scm` — relationship-bearing-syntax captures for the five parse-dependent types only (import declarations for `IMPORTS`, `extends`/`implements` clauses, call expressions for `CALLS`/`USES`/`REFERENCES`) — **no export-flag capture** (corrected mechanism, 2026-09-22: `EXPORTS` is D1-only via `contains-derivation.ts`/T021, not parse-derived, since Feature 002 already persists `symbols.is_exported`), promoted/finalized from T006's spike drafts. **[AMENDED 2026-09-24 16:46 +04:00 — R4:** "no export-flag capture" is superseded; export declarations become relationship-query captures; see research.md Amendments A2.**]**
- [ ] T020 [US1] Create `src/lib/code-intel/relationships/to-relationship-facts.ts` — query captures → raw, unresolved relationship facts (`EXTRACTED`-only, no D1 lookups), same query-capture-consumption shape as `symbols/to-intermediate-representation.ts` (depends on T019). **[AMENDED 2026-09-24 16:46 +04:00 — R4:** raw facts include export facts; see research.md Amendments A2.**]**
- [ ] T021 [US1] Create `src/lib/code-intel/relationships/contains-derivation.ts` — pure-D1 derivation, no parse, no indexed lookup (research.md §4): (a) `CONTAINS` from `directories.parent_path`/`file_extractions.directory_path`/`symbols.parent_symbol_id`; (b) `EXPORTS` from `symbols.is_exported = 1` (one `file → symbol` edge per exported top-level symbol, `evidenceState: "EXTRACTED"`, `extractionMethod: "export-flag"` — corrected mechanism, 2026-09-22: reuses this module, not the parse/resolver path, since Feature 002 already persists this flag) (depends on T009). **[AMENDED 2026-09-24 16:46 +04:00 — R4:** the EXPORTS branch (b) is superseded; CONTAINS branch (a) is unchanged; see research.md Amendments A2.**]**
- [ ] T022 [US1] Create `src/lib/code-intel/relationships/relationship-resolver.ts` — bounded indexed-lookup resolution (research.md §2) for the five parse-dependent, resolution-requiring types only (`IMPORTS`, `EXTENDS`, `IMPLEMENTS`, `CALLS`, `USES`, `REFERENCES`): one fact → `RESOLVED` (exactly one candidate) / `AMBIGUOUS` (>1) / `UNKNOWN` (0) — a single canonical `evidence_state` value per relationship, never a compound state (H2) — using `relationship-d1-client.ts`'s indexed lookup helpers only, no full-snapshot scan (depends on T009, T020). `CONTAINS`/`EXPORTS` never reach this module at all — they're produced entirely by T021. **[AMENDED 2026-09-24 16:46 +04:00 — R4:** "CONTAINS/EXPORTS never reach this module" holds for CONTAINS; for EXPORTS it is an open design point (how an export fact attaches to a symbol); see research.md Amendments A2.**]** **[AMENDED 2026-09-24 16:46 +04:00 — R6:** resolver output must carry `symbol_key`s for source and target; see research.md Amendments A3.**]**
- [ ] T023 [US1] Create `src/lib/code-intel/relationships/extraction-pipeline.ts` — per-file: re-parse (via unchanged `getParser`, FR-001) → `to-relationship-facts` → `relationship-resolver` → persist via `relationship-d1-client.ts`, one file per invocation per T007's confirmed granularity, file-scoped failure containment (depends on T020, T021, T022). **[AMENDED 2026-09-24 16:46 +04:00 — R4/R6:** the pipeline also handles parse-derived EXPORTS facts (A2) and computes `relationship_key` from `symbol_key`/paths, not row ids (A3); the phrase "per T007's confirmed granularity" is not a claim that T007 is cleared (T007 is STOPPED).**]**
- [ ] T024 [US1] Create `src/lib/code-intel/queue/relationship-worker.ts` — Cloudflare Queue consumer, one `RelationshipExtractionJob` unit (`contains` or `parsed`) per invocation, enqueues the next unit or the `parsed` phase's first unit on `contains` completion, structurally mirrors `symbols/symbol-worker.ts` (depends on T021, T023).
- [ ] T025 [US1] Create `src/lib/code-intel/relationship.functions.ts` — `extractSnapshotRelationships` (plain handler + `createServerFn` wrapper) per `contracts/extract-relationships.functions.md`'s behavior contract items 1–2 only for this story (rows 3–5 land in US3) (depends on T024).

**Checkpoint**: `CONTAINS`/`IMPORTS`/`EXTENDS`/`IMPLEMENTS`/`EXPORTS` derive and persist end-to-end for a real fixture snapshot, entirely local. This is the MVP slice.

---

## Phase 4: User Story 2 - Relationship identity, evidence, and provenance (Priority: P1)

**Goal**: Every relationship carries a stable identity, an honest single-valued evidence state, and full provenance back to file/snapshot/repository/commit SHA.

**Independent Test**: Extract relationships for a snapshot; read them back twice; confirm identical ids/evidence/provenance both times.

### Tests for User Story 2

- [ ] T026 [P] [US2] Integration test: relationship identity stability across repeated reads at unchanged version pair in `tests/integration/relationships/identity-stability.test.ts` (spec US2 Acceptance Scenario 1).
- [ ] T027 [P] [US2] Integration test: every relationship reports exactly one evidence state (the single canonical `evidence_state` field, H2), `confidence` present iff `INFERRED` in `tests/integration/relationships/evidence-state.test.ts` (Acceptance Scenario 2, FR-006).
- [ ] T028 [P] [US2] Integration test: provenance resolves to source/target entity + snapshot + repository + commit SHA with no ambiguity in `tests/integration/relationships/provenance.test.ts` (Acceptance Scenario 3).
- [ ] T029 [P] [US2] Integration test: relationships from different snapshots never share identity, even for "the same" logical edge in `tests/integration/relationships/snapshot-scoping.test.ts` (Acceptance Scenario 4, FR-016).

### Implementation for User Story 2

- [ ] T030 [US2] Implement `getRelationship` in `relationship.functions.ts` per `contracts/relationship-query.functions.md` — resolves full provenance via the standard `snapshots`/`repositories` join chain, returns `null` (never throws) on not-found (depends on T025).
- [ ] T031 [US2] Add `relationship_extractor_version` + `symbol_extractor_version` stamping to every write path in `relationship-d1-client.ts` (if not already covered by T009/T023) — verify via T026/T029, no new module (depends on T023).

**Checkpoint**: Identity, evidence, and provenance are independently verifiable — this story is mostly a verification pass over Phase 3's writes plus the single-relationship read endpoint.

---

## Phase 5: User Story 3 - Graceful handling of unresolved and ambiguous relationships (Priority: P2)

**Goal**: Deterministic single-candidate resolution → `RESOLVED`, external imports/zero-candidate calls → `UNKNOWN`, ambiguous calls → `AMBIGUOUS` with candidates retained, file-level failures stay file-scoped, idempotent/duplicate/retry behavior all correct — for **all** resolution-dependent relationship types, not only `IMPORTS`/`EXTENDS`/`IMPLEMENTS`.

**Independent Test**: quickstart.md Scenarios 4–7, plus duplicate-delivery and retry simulations, entirely local.

### Tests for User Story 3

- [ ] T032 **[NEW — closes `/speckit-analyze` H3]** [US3] Integration test: `CALLS` resolves to exactly one candidate → `evidenceState: "RESOLVED"`, `targetKind: "symbol"` pointing at the correct method/function symbol, in `tests/integration/relationships/calls-resolved.test.ts` (spec US3 Acceptance Scenario 2 — previously untested; T033/T034 below only covered the ambiguous/unknown paths). Real fixture with an unambiguous single-target call site, real resolution through `relationship-resolver.ts`, not a stub.
- [ ] T033 [P] [US3] Integration test: quickstart.md Scenario 4 (ambiguous `CALLS` → `AMBIGUOUS` + candidate set, never a fabricated target) in `tests/integration/relationships/ambiguous-calls.test.ts` (FR-007).
- [ ] T034 [P] [US3] Integration test: zero-candidate `CALLS`/external `IMPORTS` → `evidenceState: "UNKNOWN"` (the single canonical evidence value, H2 — not a compound "EXTRACTED-plus-resolution-state"), not omitted, not thrown in `tests/integration/relationships/unknown-target.test.ts`.
- [ ] T035 **[NEW — closes `/speckit-analyze` H3]** [US3] Integration test: `USES` relationship extraction/resolution behavior — a real fixture with a variable/field reference to an already-declared symbol produces a `USES` edge with the correct evidence state (`RESOLVED` on a single candidate, `AMBIGUOUS`/`UNKNOWN` under the same rules as `CALLS`, per research.md §2's identical bounded-lookup treatment for `CALLS`/`USES`/`REFERENCES`) in `tests/integration/relationships/uses-resolution.test.ts`. Tests actual `relationship-resolver.ts` behavior for this type specifically, not an assertion that `USES` merely appears in a coverage list.
- [ ] T036 **[NEW — closes `/speckit-analyze` H3]** [US3] Integration test: `REFERENCES` relationship extraction/resolution behavior — a real fixture exercising the catch-all reference case (per research.md §2/§7, the same bounded-lookup rule as `USES`/`CALLS`) produces a `REFERENCES` edge with correct evidence state (`RESOLVED`/`AMBIGUOUS`/`UNKNOWN` as applicable) in `tests/integration/relationships/references-resolution.test.ts`. Tests actual resolution behavior for this type specifically.
- [ ] T037 [US3] Integration test: quickstart.md Scenario 5 (one malformed/failed file doesn't block the rest of the snapshot) in `tests/integration/relationships/file-scoped-failure.test.ts` (FR-008).
- [ ] T038 [US3] Integration test: unsupported (non-Tier-1) files in the `parsed` phase are skipped, not attempted, don't affect status in `tests/integration/relationships/unsupported-files.test.ts`.
- [ ] T039 [US3] Integration test: quickstart.md Scenario 6 (same-version re-extraction is idempotent, `reused: true`, identical relationship set) in `tests/integration/relationships/idempotent-reextraction.test.ts` (FR-009).
- [ ] T040 [US3] Integration test: quickstart.md Scenario 7 (Feature 002 symbol re-extraction under a new `SYMBOL_EXTRACTOR_VERSION` invalidates prior relationships, `reused: false` on next call) in `tests/integration/relationships/symbol-version-invalidation.test.ts` (FR-018). [AMENDED 2026-09-24 16:58 +04:00 — R6 D-R6-2:** the FR-018 contract now also covers a same-version F002 re-extraction that renumbers symbol row ids (research.md A3 Resolution); whether this test or another existing task covers it is a task-planning question, no task added here.**]**
- [ ] T041 [US3] Integration test: duplicate queue-message delivery for the same unit is a no-op (no duplicate relationship rows, `relationship_key` UNIQUE constraint holds) in `tests/integration/relationships/duplicate-delivery.test.ts`.
- [ ] T042 [US3] Integration test: a unit that fails and retries (simulated via the worker's retry path, mirroring `symbol-worker.test.ts`'s retry-simulation precedent) eventually succeeds or reaches `failed` with `retry_count`/`failure_reason` recorded, never silently drops the unit in `tests/integration/relationships/retry-behavior.test.ts`.
- [ ] T043 [US3] Integration test: concurrent `extractSnapshotRelationships` calls for the same in-progress snapshot don't enqueue duplicate job sequences in `tests/integration/relationships/concurrent-request.test.ts` (FR-011).
- [ ] T044 [US3] Integration test: a snapshot whose Feature 002 status is not `completed`/`completed_partial` is rejected with `SNAPSHOT_NOT_RELATIONSHIP_EXTRACTABLE`, no row created in `tests/integration/relationships/prerequisite-guard.test.ts` (FR-010).
- [ ] T045 [US3] Integration test: partial coverage — snapshot-wide status reaches `completed_partial` (not `failed`) when some but not all files succeed in `tests/integration/relationships/partial-coverage.test.ts` (mirrors Feature 002's `partial-coverage.test.ts`).

### Implementation for User Story 3

- [ ] T046 [US3] Implement `extractSnapshotRelationships`'s remaining behavior-contract items 3–5 (reuse on matching version pair, in-progress no-op, version-mismatch fresh run) in `relationship.functions.ts` per `contracts/extract-relationships.functions.md` (depends on T025, T031).
- [ ] T047 [US3] Implement retry/failure bookkeeping (`retry_count`, `failure_reason`, `status` transitions) in `relationship-worker.ts`, mirroring `symbol-worker.ts`'s existing retry-handling shape exactly (depends on T024).
- [ ] T048 [US3] Implement `getRelationshipExtractionStatus` in `relationship.functions.ts` per `contracts/extract-relationships.functions.md` — `not_started`/`in_progress`/`completed`/`completed_partial`/`failed`, `relationshipsByType`, `relationshipsByEvidenceState` breakdowns (depends on T009, T025).

**Checkpoint**: All 8 relationship types' evidence handling — including dedicated `RESOLVED`/`AMBIGUOUS`/`UNKNOWN` coverage for every resolution-dependent type (`IMPORTS`, `EXTENDS`, `IMPLEMENTS`, `CALLS`, `USES`, `REFERENCES`) and dedicated derivation coverage for the two parse-free/no-resolution types (`CONTAINS`, `EXPORTS`) — and all queue-reliability edge cases are covered, entirely local.

---

## Phase 6: User Story 4 - Bounded relationship queries for downstream consumers (Priority: P2)

**Goal**: `listRelationships` supports outgoing/incoming, type-filtered, paginated queries.

**Independent Test**: quickstart.md Scenario 8, plus outgoing/incoming direction tests.

### Tests for User Story 4

- [ ] T049 [P] [US4] Integration test: outgoing relationships for a symbol/file/directory return exactly the edges where it's the source, optional type filter in `tests/integration/relationships/query-outgoing.test.ts` (Acceptance Scenario 1).
- [ ] T050 [P] [US4] Integration test: incoming relationships return exactly the edges where the entity is the target in `tests/integration/relationships/query-incoming.test.ts` (Acceptance Scenario 2).
- [ ] T051 [P] [US4] Integration test: quickstart.md Scenario 8 (bounded pagination, no duplicate/skipped rows across pages) in `tests/integration/relationships/query-pagination.test.ts` (Acceptance Scenario 3).
- [ ] T052 [P] [US4] Integration test: a snapshot with no relationship extraction ever requested reports `not_started`/empty result, never throws in `tests/integration/relationships/query-not-started.test.ts` (Acceptance Scenario 4).

### Implementation for User Story 4

- [ ] T053 [US4] Implement `listRelationships` in `relationship.functions.ts` per `contracts/relationship-query.functions.md` — direction/type filter, id-ordered cursor pagination reusing `listSnapshotFilesPage`'s exact shape (depends on T009, T025).
- [ ] T054 [US4] Create `src/lib/code-intel/feature-004-server-fn-registration.tsx` — mirrors `feature-002-server-fn-registration.tsx`, registers all four functions (`extractSnapshotRelationships`, `getRelationshipExtractionStatus`, `listRelationships`, `getRelationship`); mount it in `src/routes/__root.tsx` alongside `Feature002ServerFnRegistration` (one additive line, depends on T048, T053).

**Checkpoint**: All four user stories functionally complete and independently testable, entirely local.

---

## Phase 7: Static Validation (Local Gate A)

- [ ] T055 Run `bunx tsc --noEmit` clean across the whole repo (not just touched files — catches cross-module type breaks).
- [ ] T056 [P] Lint every touched file (`src/lib/code-intel/relationships/**`, `src/lib/code-intel/relationship.functions.ts`, `src/lib/code-intel/queue/relationship-worker.ts`, `src/lib/code-intel/domain/relationship.ts`, `src/lib/code-intel/feature-004-server-fn-registration.tsx`, `plugins/cloudflare-relationship-queue.ts`) with the project's configured linter/formatter.
- [ ] T057 [P] Validate `data/code-intel-schema.sql` loads cleanly end-to-end (all four new tables + existing Feature 001/002 tables) via `tests/support/d1-sqlite-adapter.ts`'s existing full-schema load path — no separate schema-only test needed if T012 already confirmed this, otherwise add one.
- [ ] T058 [P] Validate every function signature in `contracts/extract-relationships.functions.md` and `contracts/relationship-query.functions.md` matches the actual implementation exactly (parameter names/types, response shape) — manual diff, flag and fix any drift.

---

## Phase 8: Complete Regression Testing (Local Gate B)

- [ ] T059 Run full `bun test` suite (all features) and confirm 0 unexpected failures — the full suite's known pre-existing flake (`tests/integration/code-intel/repository-history.test.ts`'s timestamp-tie ordering, confirmed 2026-09-21, unrelated to any feature) is the only acceptable non-deterministic failure; rerun once if it appears to confirm it's that specific flake and not a real regression.
- [ ] T060 [P] Run `tests/contract/relationships/` + `tests/integration/relationships/` in isolation, confirm 100% pass (Feature 004 focused).
- [ ] T061 [P] Run `tests/contract/repositories/` + `tests/integration/repositories/` + `tests/integration/code-intel/` in isolation, confirm 100% pass (Feature 001 regression — snapshot acquisition, persistence unaffected).
- [ ] T062 [P] Run `tests/contract/symbols/` + `tests/integration/symbols/` in isolation, confirm 100% pass (Feature 002 regression — symbol extraction, grammar loading via the still-unmodified `grammar-provider.ts`, symbol queries all unaffected).
- [ ] T063 [P] Run whatever Feature 003 (GitHub source enhancement) test coverage exists (`tests/integration/repositories/initial-sources.test.ts` and related) in isolation, confirm 100% pass.

---

## Phase 9: Production Build & Build Inspection (Local Gate C)

- [ ] T064 Run `bun run build`, confirm it succeeds with no new errors/warnings beyond Feature 002's existing baseline.
- [ ] T065 [P] Inspect `.output/server/` for unexpected new dependencies — confirm no new npm package appears in the bundle beyond what Feature 002 already contributes (`web-tree-sitter`, `tree-sitter-wasms`-sourced `.wasm` chunks) — Feature 004 introduces zero new npm dependencies per plan.md, so any new dependency chunk is a red flag to investigate.
- [ ] T066 [P] Compare `.output/server` aggregate size against Feature 002's T067-recorded baseline (~10.52 MB / 16.44% of the 64 MiB cap) — flag if Feature 004's four new `.scm` query files (plain text, expected negligible) cause disproportionate growth.
- [ ] T067 [P] Grep the built output for accidental runtime Cloudflare-account assumptions (hardcoded queue names/bindings outside the config/wrangler.toml path, hardcoded account IDs, anything that would only work against this specific dev's account) — confirm none exist, matching Feature 002's own T067 inspection precedent.
- [ ] T068 Remove `.output/` after inspection (gitignored, not committed) — matches Feature 002's own precedent of not committing build artifacts.

---

## Phase 10: Functional, Resource-Simulation & Large-Scale Local Validation (Local Gate D/E/F)

**All of this phase runs against local D1-SQLite/memory-R2/in-process queue emulation — no remote Cloudflare resource is touched.**

- [ ] T069 [D] **Confirm** (not "fill any gap" — Phase 3/5's T018/T032/T035/T036 already provide dedicated upfront coverage, per the H3 remediation) that all 8 relationship types have at least one passing test producing a real row from real extraction/resolution behavior: `CONTAINS` (T015), `IMPORTS` `RESOLVED`+`UNKNOWN` (T016), `EXTENDS`/`IMPLEMENTS` (T017), `EXPORTS` (T018), `CALLS` `RESOLVED`/`AMBIGUOUS`/`UNKNOWN` (T032/T033/T034), `USES` (T035), `REFERENCES` (T036). If any is still missing at this point, that is a process failure to flag loudly, not a gap to quietly fill here.
- [ ] T070 [D] Confirm all 5 evidence states (`EXTRACTED`, `RESOLVED`, `INFERRED`, `AMBIGUOUS`, `UNKNOWN`) appear in at least one test's assertions as the single canonical `evidence_state` value (H2) — note that this v1 resolver (research.md §2) never produces `INFERRED` (no confidence-scored heuristic resolution in scope); confirm one explicit test asserts `INFERRED` is **never** emitted by the current resolver (a real, if negative, coverage point) rather than silently having zero coverage of that state.
- [ ] T071 [E] Resource-simulation script (`scripts/relationship-resource-estimate.ts`, reuses T006's harness): for a snapshot at Feature 002's already-demonstrated live scale (33 files, 77 symbols, per T068's [Feature 002] production evidence) and a synthetic 10×/100× scale-up, estimate: queue operations (enqueue + consume, both unit types), D1 reads (indexed lookups per fact), D1 writes (relationship + candidate rows), relationship-count amplification ratio (relationships per symbol/file). Document the baseline per-file assumption set used (e.g., assumed average imports/exports/call-sites per file, derived from T014/T018's real fixtures, not invented) explicitly in the output so the estimate is reproducible. Output a table to `specs/004-engineering-relationship-graph/resource-estimate.md`.
- [ ] T072 [E] Compare T071's estimates against confirmed Free-plan daily caps (Queues 10,000 ops/day, D1 5M reads/100K writes/day) at each scale tier; explicitly flag the file-count threshold (if any, within the simulated range) where the 33-file baseline's linear extrapolation would approach either cap — record in `resource-estimate.md`, cross-reference plan.md's existing Risks table entry (don't duplicate the risk, just attach real numbers to it).
- [ ] T073 [F] Large-scale local simulation: generate a synthetic fixture set of **exactly 300 files** (repeated/templated small-to-medium files evenly across the four Tier-1 languages, ~75 files/language) and run the full local extraction pipeline (`contains` phase + `parsed` phase) against it end-to-end via local D1-SQLite, no Cloudflare. Measure and record: queue-unit count, total relationship volume (broken down by type), wall-clock processing time, peak process memory (`process.memoryUsage()`), and the single worst-case (slowest) individual unit's timing — append to `feasibility-results.md` as a "Large-Scale Local Simulation (300 files)" section.
- [ ] T074 [F] Review T073's worst-case unit timing against T007's feasibility classification — confirm the worst-case unit observed at 300-file scale still falls within the classification's bound (or explicitly note if scale reveals a worse case than T006's fixture matrix predicted, and re-triage per T007's same stop-if-unsafe rule).

---

## Phase 11: STOP — Local Validation Complete, Cloudflare Gate Not Started

**This phase is a checkpoint, not an implementation phase. No task here touches Cloudflare.**

- [ ] T075 Compile a single local-validation summary (`specs/004-engineering-relationship-graph/local-validation-summary.md`) consolidating: T007's feasibility classification, Phase 7–9's gate results (A/B/C), Phase 10's functional/resource/large-scale results (D/E/F), and explicit confirmation that Feature 001/002/003 regression suites (T061–T063) all pass unchanged.
- [ ] T076 **Explicitly report to the user and WAIT.** Do not run `git push`, `wrangler deploy`, `nitro deploy`, any `--remote` D1/Queues command, or any live Worker invocation. Cloudflare live validation (remote D1 inspection, real queue delivery, real Worker CPU measurement under the actual Free-plan isolate) is a separate, later phase requiring the user's explicit authorization after they review T075's summary — it is intentionally **not** a task in this file, matching the user's own instruction that this workflow must not "create tasks that imply Feature 004 is production-complete before the later live validation."

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **T006/T007 (CPU feasibility spike + go/no-go) gate everything from T008 onward that depends on unit granularity** — T003/T004/T005 (schema, domain types, identity hashing) don't depend on the granularity decision and may run alongside T006, but T008–T012 (queue plumbing, D1 client, error codes) and every later phase assume T007 did not return `likely unsafe`.
- **User Stories (Phase 3–6)**: All depend on Foundational (Phase 2) completion, specifically T007's non-blocking classification. US1 (Phase 3) is the MVP and has no dependency on US2/US3/US4. US2 (Phase 4) depends on US1's write paths existing (reads what US1 writes). US3 (Phase 5) depends on US1's extraction pipeline existing (tests its edge cases, including the newly dedicated `CALLS`/`USES`/`REFERENCES` resolution tests T032/T035/T036, which exercise T022's resolver built in US1) and partially on US2 (version stamping, T031). US4 (Phase 6) depends on US1's persisted data existing to query; its `Feature004ServerFnRegistration` (T054) is the natural integration point after US1–US3's functions all exist.
- **Local validation (Phase 7–10)**: Depends on all four user stories (Phase 3–6) being complete.
- **STOP gate (Phase 11)**: Depends on Phase 7–10 all passing.

### Critical Path

T001 → T002 → T003/T004/T005 (parallel) → **T006 → T007 (GATE)** → T008–T012 (parallel where marked) → T013–T025 (US1/MVP, incl. new T018 EXPORTS) → T026–T031 (US2) → T032–T048 (US3, incl. new T032/T035/T036) → T049–T054 (US4) → T055–T058 (Gate A) → T059–T063 (Gate B) → T064–T068 (Gate C) → T069–T074 (Gate D/E/F) → T075–T076 (STOP).

### Parallel Opportunities

- T004, T005 in Foundational (different files, no interdependency).
- T008, T009, T010, T012 in Foundational, once T007 clears the gate.
- All four language `.scm` files (T019) can be authored in parallel.
- T013, T014 (US1 tests) parallel with each other; T018 (EXPORTS) can run parallel with T015–T017 once T014's shared fixtures exist.
- T026–T029 (US2 tests) fully parallel — independent assertions over the same already-written data.
- T032–T036 (the five newly-explicit + pre-existing US3 resolution-behavior tests: `CALLS`-resolved, ambiguous, unknown, `USES`, `REFERENCES`) are independent files and fully parallel with each other; T037–T045 (failure/idempotency/queue-reliability tests) are independent files, mostly parallel.
- T049–T052 (US4 tests) fully parallel.
- T060–T063 (Gate B regression suites) fully parallel — different test directories, no shared state.
- T065–T067 (Gate C build inspection) fully parallel — independent inspections of the same build output.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational — **T006/T007's feasibility gate is the single most important checkpoint in this entire file.** Do not proceed past it without an explicit classification.
3. Complete Phase 3: User Story 1 (`CONTAINS`/`IMPORTS`/`EXTENDS`/`IMPLEMENTS`/`EXPORTS` end-to-end, local only).
4. **STOP and VALIDATE** independently (quickstart.md Scenarios 1–3) before continuing.

### Incremental Delivery

1. Setup + Foundational (with feasibility gate) → foundation ready, granularity decision confirmed or escalated.
2. US1 → MVP relationship graph exists locally, including the two parse-free/no-resolution types.
3. US2 → identity/evidence/provenance verified.
4. US3 → ambiguity, failure containment, idempotency, queue reliability, and **every resolution-dependent relationship type's `RESOLVED`/`AMBIGUOUS`/`UNKNOWN` behavior** all verified with dedicated tests (H3 remediation).
5. US4 → query surface complete.
6. Phases 7–10 → full local validation gate (static, regression, build, functional/resource/scale).
7. Phase 11 → stop, report, wait for explicit push/deploy authorization. **Nothing beyond this file is authorized by its completion.**
