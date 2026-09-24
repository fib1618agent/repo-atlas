# Feature Specification: Engineering Relationship Graph

**Feature Branch**: `004-engineering-relationship-graph`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "Engineering Relationship Graph (Feature 004). Build on Feature 002's completed, production-validated symbol intelligence layer and Feature 001's immutable snapshot model. Derive and persist structural relationships between existing Feature 002 Symbol/Directory/File entities within a snapshot: CONTAINS, IMPORTS, EXPORTS, CALLS, EXTENDS, IMPLEMENTS, USES, REFERENCES. Explicit non-goals: impact analysis, blast-radius analysis, process/event discovery, MCP, AI/RAG, vector search, UI redesign, Settings, unrelated provider work. The spec must determine relationship data model, identity, evidence/provenance, deterministic extraction, ambiguity handling, persistence, idempotent processing, snapshot scoping, extractor versioning, queue/worker requirements, query contracts, failure handling, language scope, incremental/reprocessing behavior, and compatibility with the existing Feature 002 symbol layer."

## Relationship to Prior Research

This feature is grounded in, and must not contradict, the ratified decisions in `research/ARCHITECTURE_DECISION_GATE.md`: the core structural graph node/edge set (§6 — nodes `Repository`/`Snapshot`/`Directory`/`File`/`Module`/`Class`/`Interface`/`Function`/`Method`; relationships `CONTAINS`/`IMPORTS`/`EXPORTS`/`CALLS`/`EXTENDS`/`IMPLEMENTS`/`USES`/`REFERENCES` — exactly the eight relationship types this feature scopes to), the five-state evidence vocabulary (§7 — `EXTRACTED`/`RESOLVED`/`INFERRED`/`AMBIGUOUS`/`UNKNOWN`), the required per-edge evidence metadata (§7 — repository, commit SHA, file, line range, extraction method, analyzer version, confidence, relationship type), the queue-driven per-unit processing model carried forward from §3, and the persistence architecture (§4 — D1 + R2, no dedicated graph database). It also follows `sdd/04-engineering-graph/PHASE.md`'s phase objective, initial relationship subset, and non-goals (graph visualization, MCP, autonomous changes — all out of scope here).

This spec builds directly on `specs/001-code-intelligence-foundation` (immutable `Repository` → `Snapshot` → `SnapshotFile`) and `specs/002-ast-symbol-intelligence` (`Directory`/`FileExtraction`/`Symbol`, all `evidence_state = EXTRACTED`, Tier-1 languages Java/JavaScript/TypeScript/TSX). Every relationship this feature produces is derived from those existing entities — no independent re-parsing of source files, no new snapshot model, no change to Feature 001 or Feature 002's own tables or public functions.

**Deferred, not in this feature's scope** (per §6's explicit core/deferred split and `sdd/04-engineering-graph/PHASE.md`'s broader relationship list): `Package`, `Variable` nodes; `DECORATED_BY`, `ANNOTATED_WITH`, `ROUTES`, `PUBLISHES`, `CONSUMES`, `READS`, `WRITES` relationships; impact/blast-radius analysis; process/event discovery; graph visualization; MCP; AI/RAG; vector search.

## User Scenarios & Testing *(mandatory)*

<!--
  These user stories describe infrastructure outcomes consumed by later
  features (impact analysis, knowledge retrieval, a future graph UI) and by
  operators/developers, not by RepoAtlas's public visitors — there is no
  visitor-facing UI in this feature, matching Feature 001/002's precedent.
-->

### User Story 1 - Structural relationships derived from extracted symbols (Priority: P1)

A developer working on a later feature (impact analysis, knowledge retrieval, or a future graph UI) can request relationship extraction for a snapshot that already has completed Feature 002 symbol extraction, and receive a set of typed, directed relationships between that snapshot's directories, files, and symbols — without writing any language-specific resolution code themselves.

**Why this priority**: This is the entire purpose of the feature — turning isolated structural facts (Feature 002's symbols) into a connected graph. Nothing else in this feature is meaningful without it.

**Independent Test**: Trigger relationship extraction for a snapshot that has already completed Feature 002 symbol extraction with at least one Tier-1 language file containing an import and a class/interface with a method; confirm the resulting relationship set contains at least one `CONTAINS` edge (directory→file, file→symbol, or class→method) and, where the source demonstrates it, an `IMPORTS`/`EXTENDS`/`IMPLEMENTS` edge, each referencing real Feature 002 entities.

**Acceptance Scenarios**:

1. **Given** a snapshot with a completed Feature 002 extraction, **When** relationship extraction is requested for that snapshot, **Then** the system MUST derive `CONTAINS` edges for every directory→subdirectory, directory→file, and class/interface→method containment already implied by Feature 002's own hierarchy (`directories.parent_path`, `symbols.parent_symbol_id`).
2. **Given** a source file with an import/include statement resolvable to another file in the same snapshot, **When** relationship extraction runs, **Then** the system MUST record an `IMPORTS` edge from the importing file to the resolved target file, `evidenceState: RESOLVED`. **Given** an import statement whose target cannot be resolved within the snapshot (e.g., an external package), **When** relationship extraction runs, **Then** the system MUST still record the `IMPORTS` edge, `evidenceState: UNKNOWN` (a single canonical evidence value — FR-006), `targetKind`/`targetId` null — never silently dropped, never a second, separate "resolution state" field.
3. **Given** a class declared with an `extends`/`implements` clause naming a class/interface also present in the snapshot's extracted symbols, **When** relationship extraction runs, **Then** the system MUST record an `EXTENDS`/`IMPLEMENTS` edge from the subclass/implementor symbol to the resolved parent/interface symbol.
4. **Given** relationship extraction has completed for a snapshot, **When** the same extraction is requested again for the same snapshot with no change to the relationship extractor version, **Then** the resulting relationship set MUST be identical to the first run (deterministic, not merely "similar"), mirroring Feature 002's FR-013 idempotency precedent.

---

### User Story 2 - Relationship identity, evidence, and provenance (Priority: P1)

A later feature can reference any derived relationship by a stable identity and trace it back through its evidence state, source location, and the snapshot/commit it was derived from, so downstream consumers (impact analysis, ranking, a future UI) never mistake a deterministic fact for a heuristic guess.

**Why this priority**: `research/ARCHITECTURE_DECISION_GATE.md` §7's evidence model exists specifically to prevent inferred/ambiguous relationships from being silently presented or consumed as if they were directly observed or deterministically resolved. Without a stable identity and an honest evidence state on every edge, no downstream consumer can trust the graph.

**Independent Test**: Extract relationships for a snapshot; confirm each relationship's identity is stable across repeated reads at the same extractor version, confirm each relationship carries an explicit evidence state (`EXTRACTED`/`RESOLVED`/`INFERRED`/`AMBIGUOUS`/`UNKNOWN`) and, when `INFERRED`, a confidence score; confirm each relationship can be traced, without an extra lookup outside this feature's own data, to its source symbol/file, target symbol/file (when resolved), snapshot, repository, and commit SHA.

**Acceptance Scenarios**:

1. **Given** a derived relationship, **When** it is read back, **Then** the system MUST return the same relationship identity every time, for as long as that snapshot's relationship extraction result remains at the `relationship_extractor_version` that produced it.
2. **Given** a derived relationship, **When** its evidence is inspected, **Then** the system MUST report exactly one of `EXTRACTED`/`RESOLVED`/`INFERRED`/`AMBIGUOUS`/`UNKNOWN`, with a confidence score present if and only if the state is `INFERRED` (FR-006).
3. **Given** a derived relationship, **When** its provenance is queried, **Then** the system MUST resolve it to its source entity, its target entity (or an explicit unresolved-target marker when the state is `AMBIGUOUS`/`UNKNOWN`), the snapshot, the repository, and the commit SHA, with no ambiguity about which snapshot it belongs to.
4. **Given** two relationships from different snapshots, **When** compared, **Then** they MUST NOT share an identity, even if they represent "the same" logical relationship unchanged across commits — each snapshot's relationships are scoped to that snapshot, mirroring Feature 002's per-snapshot symbol scoping.

---

### User Story 3 - Graceful handling of unresolved and ambiguous relationships (Priority: P2)

A developer extracting relationships for a real-world snapshot — which will contain imports the resolver cannot follow (external packages, dynamic requires) and call sites with multiple possible targets — needs the system to record what it can determine and flag what it cannot, rather than failing the whole extraction or fabricating a single guessed target.

**Why this priority**: Real source trees are not fully self-contained (external dependencies, dynamic dispatch, reflection). A relationship extractor that only handles the fully-resolvable case is unusable on real repositories; this mirrors Feature 002's US3 (unsupported-language/malformed-file handling) applied to relationship resolution instead of parsing.

**Independent Test**: Run relationship extraction against a snapshot containing (a) an import of an external package not present in the snapshot, (b) a call site with a single deterministic target, and (c) a call site whose target cannot be disambiguated among multiple same-named candidates; confirm the external import yields an `UNKNOWN`-target edge (not a failure, not a fabricated target), the deterministic call yields a `RESOLVED` edge, and the ambiguous call yields an `AMBIGUOUS` edge listing candidates without picking one.

**Acceptance Scenarios**:

1. **Given** an import referencing a package/module not present in the snapshot's own files, **When** relationship extraction runs, **Then** the system MUST record the import relationship with `evidenceState: UNKNOWN` (the single canonical `relationships.evidence_state` value for "resolution attempted, zero candidates found" — FR-006; not a compound "EXTRACTED-plus-a-separate-resolution-state," there is exactly one evidence-state field per relationship), not omit it and not fail the extraction.
2. **Given** a call expression whose target resolves to exactly one candidate symbol via deterministic static analysis, **When** relationship extraction runs, **Then** the system MUST record a `CALLS` edge in `RESOLVED` state pointing to that one symbol.
3. **Given** a call expression whose target resolves to more than one non-disambiguable candidate symbol, **When** relationship extraction runs, **Then** the system MUST record the relationship in `AMBIGUOUS` state, MUST NOT silently pick one candidate, and MUST retain enough information to list the candidates on query.
4. **Given** one file within a snapshot fails relationship extraction (e.g., a parse artifact from Feature 002 is malformed), **When** relationship extraction runs for the rest of the snapshot, **Then** that file's failure MUST be scoped to itself and MUST NOT block relationship extraction for the snapshot's other files, mirroring Feature 002's FR-018 file-scoped failure containment.

---

### User Story 4 - Bounded relationship queries for downstream consumers (Priority: P2)

A later feature can query a snapshot's relationships filtered by relationship type, direction, and a starting symbol/file/directory, with results bounded and paginated, so it can build features like "what does this file import" or "what calls this method" without pulling an entire snapshot's graph into memory.

**Why this priority**: `sdd/04-engineering-graph/PHASE.md`'s acceptance criteria require bounded traversal (depth, direction, relationship-type filters); without a query contract, the persisted relationships are not actually usable by any consumer, mirroring why Feature 002's `listSymbols`/`getSymbol` query surface (not just extraction) was required for it to be usable.

**Independent Test**: Query relationships for a known symbol/file in both directions (outgoing and incoming), filtered to a single relationship type, and confirm the result set is exactly the expected edges, bounded by a page size, with a working pagination cursor for a snapshot with enough edges to require more than one page.

**Acceptance Scenarios**:

1. **Given** a snapshot with completed relationship extraction, **When** a caller requests outgoing relationships for a given symbol/file/directory, **Then** the system MUST return exactly the edges where that entity is the source, optionally filtered by relationship type.
2. **Given** the same snapshot, **When** a caller requests incoming relationships for a given symbol/file, **Then** the system MUST return exactly the edges where that entity is the target.
3. **Given** a result set larger than the default page size, **When** a caller requests the next page via the returned cursor, **Then** the system MUST return the next bounded page with no duplicate or skipped edges relative to the first page.
4. **Given** a snapshot that has never had relationship extraction requested, **When** its relationship status or relationships are queried, **Then** the system MUST report a `not_started` status (or empty result, consistent with Feature 002's `getExtractionStatus` `not_started` precedent) rather than throwing.

---

### Edge Cases

- What happens when relationship extraction is requested for a snapshot whose Feature 002 symbol extraction has not completed (`not_started`/`in_progress`/`failed`)? → System MUST reject with a clear error identifying the prerequisite state, mirroring Feature 002's own `SNAPSHOT_NOT_EXTRACTABLE`-style guard against Feature 001.
- What happens when relationship extraction is requested twice concurrently for the same snapshot? → Second request MUST observe the in-progress state and not enqueue a duplicate run, mirroring Feature 002's FR-013/concurrent-request precedent.
- What happens when Feature 002 re-extracts a snapshot under a new `SYMBOL_EXTRACTOR_VERSION` (invalidating prior symbol identities)? → Existing relationships anchored to the old symbol identities become stale; relationship extraction for that snapshot MUST be re-run under a new `relationship_extractor_version` before its relationships are trusted again — this feature does not attempt to migrate relationships across a symbol re-extraction. [AMENDED 2026-09-24 16:58 +04:00 — R6 D-R6-2:** the same staleness rule applies to a same-version F002 re-extraction that renumbers symbol row ids; see FR-018 and research.md A3 Resolution.**]**
- What happens when a snapshot has zero relationships to derive (e.g., a single file with no imports, no inheritance, no calls)? → System MUST report a terminal `completed` status with an empty relationship set, not `failed`.
- What happens when a relationship's source or target symbol is later deleted (e.g., by a hypothetical future symbol-pruning feature)? → Out of scope for this feature; Feature 002 has no delete path today, so relationships anchored to symbols within an immutable, already-extracted snapshot cannot dangle under current system behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST derive relationships from a snapshot's existing Feature 002 entities (`directories`, `file_extractions`, `symbols`) and MUST NOT introduce a second, independent AST extraction pipeline or a second grammar-loading/language-detection mechanism. Because Feature 002 does not retain parsed ASTs for later reuse (by design — see research.md §3), deriving relationship types that require inspecting syntax Feature 002's own symbol rows don't capture (import declarations, `extends`/`implements` clauses, call expressions) requires re-parsing the relevant file's bytes once per relationship-extraction unit; this re-parse MUST go exclusively through Feature 002's existing, unmodified grammar provider (`getParser`/`grammar-provider.ts`) using new relationship-focused Tree-sitter queries — never a new or duplicate grammar/parser system. `CONTAINS` requires no parse at all (FR-003). All resolution MUST remain bounded to indexed D1 lookups against already-persisted Feature 002 data (FR-007) — re-parsing is permitted only to observe relationship-bearing syntax, never to perform additional symbol resolution beyond what Feature 002 already extracted. **[AMENDED 2026-09-24 16:46 +04:00 — R4:** the syntax that requires re-parsing also includes export declarations, because persisted `symbols.is_exported` is NULL; see research.md Amendments A2. FR-001's boundary is otherwise unchanged.**]**
- **FR-002**: System MUST support deriving all eight core relationship types ratified in `research/ARCHITECTURE_DECISION_GATE.md` §6: `CONTAINS`, `IMPORTS`, `EXPORTS`, `CALLS`, `EXTENDS`, `IMPLEMENTS`, `USES`, `REFERENCES`.
- **FR-003**: System MUST derive `CONTAINS` relationships directly from Feature 002's existing hierarchy (`directories.parent_path`, `file_extractions.directory_path`, `symbols.parent_symbol_id`) rather than re-deriving containment from scratch.
- **FR-004**: Every persisted relationship MUST carry a deterministic, stable identity scoped to the snapshot and the `relationship_extractor_version` that produced it, analogous to Feature 002's `symbol_key` (FR-008/FR-013 precedent). **[AMENDED 2026-09-24 16:46 +04:00 — R6:** identity MUST NOT depend on mutable D1 row ids; symbol endpoints use `symbol_key`. Recorded CONTRADICTION: this FR says the identity is scoped to `relationship_extractor_version` but the canonical string has no version term (unresolved). See research.md Amendments A3.**]** [AMENDED 2026-09-24 16:58 +04:00 — R6 D-R6-1/3:** relationship_extractor_version scopes the validity and provenance of a relationship extraction dataset; it is not an input to relationship_key. It is stored as provenance, defines the validity scope of the relationship dataset, and determines whether an existing extraction is reusable (FR-009); it is not a term of the identity. Identity is snapshot-scoped and natural-key/content-derived, analogous to `symbol_key`, which likewise excludes its extractor version. This resolves the FR-004 wording contradiction recorded in research.md A3; see A3 Resolution.**]**
- **FR-005**: Every persisted relationship MUST record: source entity reference, target entity reference (or explicit unresolved marker), relationship type, evidence state, confidence score (when `INFERRED`), source location (file + line range of the evidence, when applicable), extraction method, `relationship_extractor_version`, snapshot ID, and (transitively, via the snapshot) repository and commit SHA — per `research/ARCHITECTURE_DECISION_GATE.md` §7's required evidence metadata.
- **FR-006**: System MUST classify every derived relationship's evidence into exactly one of five states — `EXTRACTED`, `RESOLVED`, `INFERRED`, `AMBIGUOUS`, `UNKNOWN` — using the definitions ratified in §7; `INFERRED` MUST always carry a confidence score, and `AMBIGUOUS`/`UNKNOWN` MUST NOT be silently upgraded to `RESOLVED`/`EXTRACTED` without a genuine new resolution event.
- **FR-007**: System MUST NOT fabricate a single resolved target when multiple non-disambiguable candidates exist — such cases MUST be persisted as `AMBIGUOUS` with the candidate set retrievable, not silently collapsed to one guess.
- **FR-008**: A file- or symbol-scoped relationship-resolution failure MUST be contained to that file/symbol and MUST NOT abort relationship extraction for the rest of the snapshot, mirroring Feature 002's FR-018.
- **FR-009**: Relationship extraction for a snapshot MUST be idempotent: re-running it at an unchanged `relationship_extractor_version` against an unchanged Feature 002 symbol set MUST produce an identical relationship set, and MUST short-circuit (reuse, not re-derive) when already completed at the current version, mirroring Feature 002's FR-013. **[AMENDED 2026-09-24 16:46 +04:00 — R6:** idempotency must hold across an F002 re-extraction, which renumbers symbol ids; see research.md Amendments A3.**]**
- **FR-010**: System MUST reject relationship extraction requests for a snapshot whose Feature 002 symbol extraction has not reached a terminal `completed`/`completed_partial` status, with a clear, typed error.
- **FR-011**: System MUST reject or no-op a relationship extraction request for a snapshot that already has an in-progress relationship extraction run, without enqueuing a duplicate.
- **FR-012**: System MUST process relationship extraction asynchronously via a queue-driven, per-unit worker model, consistent with Feature 001's `SNAPSHOT_QUEUE` and Feature 002's `SYMBOL_QUEUE` precedent, and MUST NOT block a synchronous request handler on full-snapshot extraction.
- **FR-013**: System MUST expose a relationship-extraction status query (`not_started`/`in_progress`/`completed`/`completed_partial`/`failed`) that never reports a non-terminal run as complete, mirroring Feature 002's FR-016.
- **FR-014**: System MUST expose a query contract for reading relationships scoped to a snapshot, filterable by relationship type and direction (outgoing/incoming from a given source/target entity), and bounded/paginated — no unbounded full-graph read.
- **FR-015**: System MUST support Tier-1 languages only (Java, JavaScript, TypeScript, TSX), matching Feature 002's ratified language scope — no new language support is introduced by this feature.
- **FR-016**: System MUST scope every relationship strictly to the snapshot it was derived from; relationships from different snapshots (even of the same repository) MUST NOT share identity or be merged, mirroring Feature 002's per-snapshot symbol scoping.
- **FR-017**: System MUST NOT modify any Feature 001 or Feature 002 table, source file, or public function signature — this feature is additive-only (new tables, new queue, new server functions), matching Feature 002's own precedent relative to Feature 001.
- **FR-018**: System MUST record which `SYMBOL_EXTRACTOR_VERSION` (Feature 002) the relationships were derived against, so a later Feature 002 re-extraction under a new version can be detected as invalidating prior relationships for that snapshot (Edge Cases). [AMENDED 2026-09-24 16:58 +04:00 — R6 D-R6-2:** FR-018's version-mismatch detection alone is NOT sufficient. Feature 002 supports same-version re-extraction of a completed snapshot (F002 spec Acceptance 4) and `replaceSymbolsForFile` renumbers D1 symbol row ids on it without any version change. F004 contract: "Any F002 re-extraction affecting a file with existing relationships must invalidate or otherwise make stale the affected relationship dataset before those relationships are considered valid again." Feature 002 is not modified and is not responsible for relationship persistence; the invalidation and rebuild boundary is defined in Feature 004. The concrete signaling and orchestration mechanism (per-file or per-snapshot, how the re-extraction is detected) is NOT defined by the current documents and is left to Feature 004 implementation. See research.md A3 Resolution.**]**

### Key Entities *(include if feature involves data)*

- **Relationship**: A typed, directed edge between two entities (Directory, File, or Symbol) within one snapshot. Carries: relationship type (one of the eight core types), source entity reference, target entity reference (nullable/marker when unresolved), evidence state, confidence (when `INFERRED`), source location, extraction method, `relationship_extractor_version`, `snapshot_id`, and a deterministic `relationship_key` identity. Analogous in role to Feature 002's `Symbol`, but connects two entities instead of describing one.
- **RelationshipExtractionJob / SnapshotRelationshipExtraction**: Snapshot-scoped extraction-run bookkeeping (status, checkpoint, unit sequencing), directly mirroring Feature 002's `ExtractionJob`/`SnapshotExtraction` shape, so the queue-driven, resumable, idempotent processing model is reused rather than reinvented.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a snapshot with N import statements resolvable within the same snapshot, relationship extraction derives an `IMPORTS` edge for 100% of them in `RESOLVED` state, with zero silently dropped.
- **SC-002**: Re-running relationship extraction for an unchanged snapshot at an unchanged `relationship_extractor_version` produces a byte-identical relationship set (same count, same `relationship_key`s) on every run. **[AMENDED 2026-09-24 16:46 +04:00 — R6:** "same `relationship_key`s" requires the amended identity basis; see research.md Amendments A3.**]**
- **SC-003**: Zero relationships are ever returned to a caller with a fabricated single target where the extractor actually found multiple non-disambiguable candidates — every such case is queryable as `AMBIGUOUS` with its candidate set intact.
- **SC-004**: A caller can retrieve "everything a given file imports" or "everything that calls a given method" in a single bounded, paginated query, with no client-side full-graph traversal required.
- **SC-005**: A relationship-resolution failure on one file/symbol never prevents relationship extraction from completing (`completed`/`completed_partial`) for the remainder of a snapshot's files.

## Assumptions

- Relationship extraction operates strictly within one snapshot; cross-snapshot or cross-repository relationships (e.g., "this file imports a package published by another indexed repository") are out of scope for this feature and deferred, consistent with Feature 002's per-snapshot symbol scoping and this feature's own FR-016.
- `CALLS`/`USES`/`REFERENCES` resolution for dynamically-dispatched or reflection-based call sites is expected to frequently land in `AMBIGUOUS` or `UNKNOWN` rather than `RESOLVED` — this is treated as correct, honest output, not a defect, per the evidence model (FR-006/FR-007).
- The relationship data model persists to D1 (extending `data/code-intel-schema.sql` additively, no new database), reusing R2/D1 architecture already ratified for Feature 001/002 — no new storage technology is introduced.
- A new Cloudflare Queue (or reuse of the existing `SYMBOL_QUEUE` topic with a distinct message shape) is required for relationship-extraction units; the exact choice is a planning-phase decision, not fixed by this spec.
- "Symbol" in this spec always refers to Feature 002's persisted `symbols` table rows (`evidence_state = EXTRACTED`), never to a new independently-parsed representation.
