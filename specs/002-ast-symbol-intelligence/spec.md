# Feature Specification: AST + Symbol Intelligence

**Feature Branch**: `002-ast-symbol-intelligence`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Transform completed Feature 001 source snapshots into structural code intelligence: given a completed source snapshot, detect supported languages, parse source files using WASM Tree-sitter, extract structural symbols (Repository/Snapshot/Directory/File/Module/Class/Interface/Function/Method), and persist symbol metadata in a deterministic and queryable form — establishing the structural foundation the later Engineering Relationship Graph feature depends on. Reuse the ratified language-tier research and WASM Tree-sitter runtime decision rather than inventing a new language strategy. Explicitly excludes CALLS/IMPORTS/EXPORTS relationship resolution, the Engineering Graph, graph traversal, ranking, retrieval, impact analysis, process discovery, MCP, AI summarization, and any UI."

## Relationship to Prior Research

This feature is grounded in, and must not contradict, the ratified decisions in `research/ARCHITECTURE_DECISION_GATE.md`: the WASM tree-sitter extraction mechanism (§5, "WASM Tree-sitter Runtime"), the Tier 1 initial language scope (§5, "Language Scope" — Java, JavaScript, TypeScript, ratified with constraints), the queue-driven per-file processing model carried forward from §3, the persistence architecture (§4 — D1 + R2, no dedicated graph database), and the five-state evidence vocabulary (§7 — `EXTRACTED`/`RESOLVED`/`INFERRED`/`AMBIGUOUS`/`UNKNOWN`). It also follows `sdd/03-ast-symbols/PHASE.md`'s phase objective and non-goals. This spec covers only `sdd/03-ast-symbols` scope — it builds directly on `specs/001-code-intelligence-foundation`'s immutable source snapshots (Repository → Snapshot → SnapshotFile) and does not touch relationship resolution (`sdd/04-engineering-graph`), which is a later feature.

Per this feature's scope, every fact this feature produces is a directly-observed structural declaration — the evidence state for every symbol this feature persists is `EXTRACTED` (§7's definition: "directly observed in source/AST... with no resolution step involved"). `RESOLVED`, `INFERRED`, and `AMBIGUOUS` all describe relationship-resolution outcomes (following an import, disambiguating a call target) that this feature does not perform — they belong to `sdd/04-engineering-graph`.

## User Scenarios & Testing _(mandatory)_

<!--
  These user stories describe infrastructure outcomes consumed by the later
  Engineering Relationship Graph feature and by operators/developers, not by
  RepoAtlas's public visitors. There is no visitor-facing UI in this feature
  (see Out of Scope), matching Feature 001's precedent.
-->

### User Story 1 - Structural symbol extraction from a completed snapshot (Priority: P1)

A developer working on the later Engineering Relationship Graph feature can request structural extraction for a completed Feature 001 snapshot and receive a language-neutral set of structural symbols (modules, classes, interfaces, functions, methods) with their positions in the source, without writing any language-specific parsing code themselves.

**Why this priority**: This is the entire purpose of the feature — turning byte-addressable source files into structured, queryable facts. Nothing else in this feature is meaningful without it.

**Independent Test**: Trigger extraction for a completed snapshot of a small public repository containing at least one Tier 1 language (Java, JavaScript, or TypeScript) file; confirm the resulting symbol set contains the expected modules/classes/interfaces/functions/methods for that file, each with a source range.

**Acceptance Scenarios**:

1. **Given** a completed snapshot containing a supported-language source file, **When** extraction is requested for that snapshot, **Then** the system MUST detect the file's language and select the matching grammar before attempting to parse it.
2. **Given** a source file whose language is supported, **When** it is parsed, **Then** the system MUST extract every top-level and nested module, class, interface, function, and method declaration present in that file, per the language's own declaration syntax.
3. **Given** a class containing methods, **When** extraction completes, **Then** each method MUST be recorded as a child of its containing class, not as an unrelated top-level symbol.
4. **Given** extraction has completed for a snapshot, **When** the same extraction is requested again for the same snapshot with no change to the extractor, **Then** the resulting symbol set MUST be identical to the first run (deterministic, not merely "similar").

---

### User Story 2 - Symbol identity, source ranges, and provenance (Priority: P1)

A later feature (starting with the Engineering Relationship Graph) can reference any extracted symbol by a stable identity and trace it back through its file, snapshot, and commit SHA, so that every structural fact remains anchored to reproducible, immutable evidence.

**Why this priority**: Feature 001 exists specifically so every downstream fact can be anchored to a reproducible commit-addressed source of truth (`research/ARCHITECTURE_DECISION_GATE.md` §7). A symbol with no stable identity or no provenance chain back to a commit SHA cannot be safely referenced by a graph edge, cited in a report, or trusted across re-indexing — this is a direct continuation of Feature 001's US1–US2 guarantees into the symbol layer.

**Independent Test**: Extract symbols for a snapshot; confirm each symbol's identity is stable across repeated reads, confirm each symbol carries its exact source range (start/end line and column, or equivalent), and confirm each symbol can be traced, without an extra lookup outside this feature's own data, to its file path, snapshot, repository, and commit SHA.

**Acceptance Scenarios**:

1. **Given** an extracted symbol, **When** it is read back, **Then** the system MUST return the same symbol identity every time, for as long as that snapshot's extraction result remains at the `extractor_version` that produced it (a version upgrade is permitted to re-identify symbols under FR-014 — see Assumptions).
2. **Given** an extracted symbol, **When** its declaration is inspected, **Then** the system MUST report the exact source range (start and end position) the declaration occupies in the file.
3. **Given** an extracted symbol, **When** its provenance is queried, **Then** the system MUST resolve it to exactly one file, one snapshot, one repository, and one commit SHA, with no ambiguity.
4. **Given** two symbols from different snapshots (even of the same repository), **When** compared, **Then** they MUST NOT share an identity, even if they represent "the same" logical declaration unchanged across commits — each snapshot's symbols are scoped to that snapshot.

---

### User Story 3 - Graceful handling of unsupported languages and malformed source (Priority: P2)

An operator triggering extraction on a real-world, heterogeneous repository gets a complete, honest picture of what was and wasn't extracted, rather than the whole snapshot's extraction silently failing or silently omitting problem files.

**Why this priority**: Real repositories mix supported and unsupported languages and occasionally contain malformed or partially-generated source. This is independently testable and critical for trustworthiness: a system that silently drops a file's symbols (or crashes the whole run) is worse than one that is transparent about partial coverage, matching Feature 001's "no silent partial state" precedent (its US3, US6).

**Independent Test**: Run extraction against a snapshot containing a supported-language file, an unsupported-language file, and a syntactically-malformed supported-language file; confirm the supported file's symbols are extracted, the unsupported file is recorded as skipped (not attempted, not an error), and the malformed file is recorded as a parse failure — with the overall snapshot-level extraction status reflecting "completed with partial coverage" rather than either silently succeeding as if nothing was wrong, or failing as if nothing was extracted.

**Acceptance Scenarios**:

1. **Given** a file whose language has no supported grammar, **When** extraction runs over the snapshot, **Then** the system MUST record that file as not attempted (unsupported language) and MUST NOT treat this as a parse failure or abort extraction for the rest of the snapshot.
2. **Given** a file whose language is supported but whose content is malformed or fails to parse, **When** extraction runs, **Then** the failure MUST be scoped to that file — no symbols are recorded for it, and no other file's extraction is blocked or invalidated.
3. **Given** a snapshot where every file extracted without error, **When** its extraction status is queried, **Then** the system MUST report it as fully extracted.
4. **Given** a snapshot where at least one file was skipped (unsupported) or failed (malformed), **When** its extraction status is queried, **Then** the system MUST report it as completed-with-partial-coverage, distinguishing skipped files from failed files.

---

### User Story 4 - Asynchronous, checkpointed, idempotent processing (Priority: P2)

A large snapshot with many files is processed through bounded, queue-driven units of work, and a duplicate or retried unit of work never produces duplicate or corrupted symbol data.

**Why this priority**: This is what makes User Story 1 actually work for real-world repositories under the same Cloudflare Workers per-invocation CPU and memory limits Feature 001 already established (`research/ARCHITECTURE_DECISION_GATE.md` §3, §5 "WASM Tree-sitter Runtime"). It mirrors Feature 001's US6 at the symbol-extraction layer and is independently testable without needing an especially large repository.

**Independent Test**: Simulate a queued extraction unit being delivered twice (duplicate delivery); confirm the resulting symbol data is identical to what a single delivery would have produced, with no duplicated symbol rows.

**Acceptance Scenarios**:

1. **Given** a snapshot with more files than fit in one bounded unit of work, **When** extraction runs, **Then** the system MUST complete it as a sequence of bounded units, none of which is required to parse the entire snapshot's files in one invocation.
2. **Given** a queued extraction unit is delivered more than once, **When** both deliveries are processed, **Then** the resulting symbol data MUST be identical to processing it exactly once (no duplicate symbols, no duplicate file-extraction records).
3. **Given** a queued extraction unit fails partway through, **When** it is retried, **Then** the retry MUST be able to complete extraction for its assigned files without corrupting or duplicating any already-recorded symbols from other units.
4. **Given** a snapshot's extraction is re-requested after it has already completed, **When** re-extraction runs with the same extractor/grammar versions, **Then** the resulting symbol data MUST be identical to the existing data (idempotent reprocessing), and the system MUST NOT require re-parsing to be treated as if it were extracting a different, newer snapshot.

---

### User Story 5 - Queryable symbol retrieval (Priority: P3)

A later feature (or an operator) can list and page through a snapshot's extracted symbols, filter by file or symbol kind, and retrieve full details for one symbol, without needing to re-run extraction or hold the entire symbol set in memory.

**Why this priority**: Extraction that cannot be efficiently queried is not yet "structural foundation" for anything downstream — this is the access pattern the Engineering Relationship Graph feature will build its node lookups on, directly analogous to Feature 001's US4 (file inventory) one layer up.

**Independent Test**: For a snapshot with completed extraction, list its symbols filtered by kind (e.g., only classes) and confirm the list is returned in bounded pages; retrieve one symbol's full detail (source range, parent, provenance) directly by its identity.

**Acceptance Scenarios**:

1. **Given** a snapshot with completed extraction, **When** its symbol list is requested, **Then** the system MUST support filtering by symbol kind and by file, without requiring the full symbol set in one unbounded response.
2. **Given** a symbol's identity, **When** its detail is requested, **Then** the system MUST return its kind, name, source range, parent symbol (if any), and full provenance chain in one lookup.
3. **Given** a snapshot with a very large number of symbols, **When** the symbol list is requested, **Then** the response mechanism MUST support retrieval in bounded pages/batches rather than requiring the full list in one unbounded response.

---

### Edge Cases

- What happens when extraction is requested for a snapshot that has not yet completed acquisition (Feature 001 status other than `completed`)? Extraction MUST refuse to start and MUST report a clear, distinguishable failure — it MUST NOT attempt to parse a partial or in-progress file set.
- What happens when a file's detected language matches a supported grammar, but the file is binary or non-text content misclassified by extension? This is treated as a malformed-source parse failure for that file (User Story 3), scoped to the file, not a system-level error.
- What happens when two extraction requests for the same snapshot are triggered concurrently? The second request MUST NOT create duplicate extraction work; it MUST either join the in-progress extraction or return the already-completed result, mirroring Feature 001's concurrent-acquisition-request handling.
- What happens when a file is renamed or moved between two snapshots of the same repository? Each snapshot's symbols are independently extracted and independently identified (User Story 2, Acceptance Scenario 4) — this feature does not attempt to track "the same" symbol across snapshots; that is a later feature's concern (see Out of Scope).
- What happens when a class or function is deeply nested (e.g., a function inside a function inside a class)? The parent/child hierarchy MUST represent the actual nesting depth found in the source, with no fixed depth limit imposed by this feature.
- What happens when a source file is empty or contains no recognizable structural declarations? The file is recorded as successfully parsed with zero symbols — this is a valid, non-error outcome, not a parse failure.
- What happens when a snapshot mixes multiple Tier 1 languages across files (e.g., a repository with both Java and TypeScript files)? Each file is parsed independently using its own detected language's grammar; there is no cross-file, cross-language symbol resolution in this feature.

## Requirements _(mandatory)_

### Functional Requirements

**Language detection & grammar selection**

- **FR-001**: System MUST detect a source file's language from its file extension and/or path, sufficient to select a matching parsing grammar, before attempting to parse its content.
- **FR-002**: System MUST support, at minimum, the Tier 1 language set ratified in `research/ARCHITECTURE_DECISION_GATE.md` §5 (Java, JavaScript, TypeScript/TSX) as this feature's initial supported-language scope; expanding to Tier 2/3 languages is explicitly deferred (see Out of Scope) and MUST NOT be silently added without a ratifying spec update.
- **FR-003**: System MUST treat a file whose detected language has no supported grammar as an explicit "unsupported language, not attempted" outcome (User Story 3), distinguishable from a parse failure.

**Parsing & structural extraction**

- **FR-004**: System MUST parse each supported-language source file using a deterministic, grammar-based parser (per `research/ARCHITECTURE_DECISION_GATE.md` §5, WASM tree-sitter), not a heuristic or LLM-based extraction method, consistent with `sdd/03-ast-symbols/PHASE.md`'s deterministic-extraction requirement.
- **FR-005**: System MUST extract, where present in a file's language, at minimum the following structural symbol kinds: Module, Class, Interface, Function, and Method, matching the initial symbol model this feature establishes.
- **FR-006**: System MUST record each file and each directory implied by a snapshot's file paths as addressable structural nodes, so that Module/Class/Interface/Function/Method symbols can be organized under the file and directory hierarchy they were declared in.
- **FR-007**: System MUST process each file's parsing and extraction independently of every other file — a failure or unsupported-language outcome for one file MUST NOT prevent extraction from proceeding for any other file in the same snapshot (per `sdd/03-ast-symbols/PHASE.md` requirement 6, "parser failures SHALL be file-scoped").

**Symbol identity, ranges, and hierarchy**

- **FR-008**: System MUST assign every extracted symbol a stable identity, scoped to the snapshot it was extracted from, that does not change between repeated reads of the same extraction result.
- **FR-009**: System MUST record, for every extracted symbol, its exact source range (start and end position within the file) as declared in the source.
- **FR-010**: System MUST record, for every extracted symbol that is nested within another (e.g., a method within a class, a function within a module), an explicit parent/child relationship reflecting the actual declaration nesting, with no fixed nesting-depth limit imposed by this feature.
- **FR-011**: System MUST treat every extracted symbol's evidence state as `EXTRACTED` (per `research/ARCHITECTURE_DECISION_GATE.md` §7) — this feature MUST NOT produce or persist a `RESOLVED`, `INFERRED`, or `AMBIGUOUS` fact, since those require relationship resolution this feature does not perform.

**Persistence & determinism**

- **FR-012**: System MUST persist symbol metadata in Cloudflare D1, reusing the structured-metadata persistence approach established in `specs/001-code-intelligence-foundation` — this feature MUST NOT introduce a dedicated graph database.
- **FR-013**: System MUST make symbol extraction deterministic: re-running extraction for an unchanged snapshot with unchanged extractor/grammar versions MUST produce an identical symbol set to the prior run (User Story 1, Acceptance Scenario 4).
- **FR-014**: System MUST record, per extraction, which extractor/grammar version produced each result, sufficient to distinguish a future re-extraction caused by an extractor upgrade from one that would otherwise appear identical, mirroring the `analyzer_version` provenance field the evidence model (`research/ARCHITECTURE_DECISION_GATE.md` §7) requires for later facts.

**Extraction status & failure handling**

- **FR-015**: System MUST refuse to start extraction for a snapshot that has not reached Feature 001's `completed` status, and MUST report a clear, distinguishable failure for that case (Edge Cases).
- **FR-016**: System MUST track snapshot-level extraction status distinguishing at minimum: not started, in progress, fully extracted (every file supported and successfully parsed), and completed-with-partial-coverage (at least one file skipped as unsupported or failed as malformed), per User Story 3.
- **FR-017**: System MUST record, per file within a snapshot's extraction, one of: successfully extracted, skipped (unsupported language), or failed (malformed/unparseable source) — never silently omitting a file from this accounting.
- **FR-018**: System MUST ensure a file-level parse failure never corrupts or partially records symbols for that file — a failed file contributes zero symbol rows, not a partial set.

**Asynchronous processing & queue semantics**

- **FR-019**: System MUST process snapshot extraction as a sequence of bounded, independently-executable units of work (at minimum, one file or a bounded batch of files per unit), not as a single synchronous, unbounded operation, mirroring Feature 001's FR-023.
- **FR-020**: System MUST make every unit of queued extraction work idempotent: processing the same unit more than once (duplicate delivery) MUST NOT produce duplicate symbol rows or duplicate file-extraction status records, mirroring Feature 001's FR-024.
- **FR-021**: System MUST prevent two concurrent extraction requests for the same snapshot from producing duplicate extraction work (Edge Cases), mirroring Feature 001's concurrent-acquisition handling (its US3 Edge Cases).

**Snapshot immutability & provenance**

- **FR-022**: System MUST treat the source snapshot (and its files) as read-only input — extraction MUST NOT modify, re-acquire, or otherwise alter any Feature 001 snapshot or file record.
- **FR-023**: System MUST make every extracted symbol traceable, in one lookup within this feature's own data, to its file, snapshot, repository, and commit SHA (per `research/ARCHITECTURE_DECISION_GATE.md` §7's required evidence metadata), directly extending Feature 001's FR-030 file-level provenance guarantee up to the symbol level.

**Queryability**

- **FR-024**: System MUST allow a snapshot's extracted symbols to be listed with filtering by symbol kind and by file, in bounded pages/batches rather than one unbounded response, mirroring Feature 001's FR-020.
- **FR-025**: System MUST allow retrieval of a single symbol's full detail (kind, name, source range, parent, provenance) by its identity in one lookup.

**Protection of existing functionality**

- **FR-026**: System MUST NOT modify or degrade any Feature 001 capability (repository identity, ref resolution, snapshot acquisition, file inventory, persistence, or queue processing) — this feature is additive, read-only with respect to Feature 001's data.
- **FR-027**: System MUST NOT modify or degrade the existing GitHub repository metadata ingestion, catalogue, categories, or 3D visualization behavior — matching Feature 001's FR-039/FR-040 precedent.

### Key Entities _(this feature is entirely data/infrastructure-oriented)_

- **Repository / Snapshot**: Reused, unchanged, from `specs/001-code-intelligence-foundation` — the provider-qualified repository identity and the immutable, commit-addressed source snapshot this feature's extraction is anchored to. This feature does not redefine either entity; it only reads them.
- **Directory**: A path-segment grouping node, derived from a snapshot's file paths, that organizes File and Module symbols into the hierarchy they were declared under. Scoped to one snapshot, like every other entity below.
- **File**: A structural extraction record for one `SnapshotFile` (Feature 001) — its detected language, extraction status (successfully extracted / skipped / failed), and the top-level symbols declared in it. Distinct from `SnapshotFile` itself (which is Feature 001's byte-content record); this entity is this feature's parse/extraction result for that same underlying file.
- **Module**: A file-scoped or namespace-scoped logical grouping symbol, where the source language expresses one (e.g., a JavaScript/TypeScript module, a Java package-level file grouping) — the top of the declaration hierarchy within a File.
- **Class**: A class declaration, with its nested members represented as child symbols (Interface implementations noted as an attribute, not a resolved relationship — see Out of Scope).
- **Interface**: An interface (or equivalent language construct, e.g., a TypeScript `interface`) declaration.
- **Function**: A top-level or nested function declaration not bound to a class as a method.
- **Method**: A function declaration bound to a Class or Interface as a member, recorded as that Class/Interface's child symbol.
- **Symbol** _(umbrella term)_: Any of Module/Class/Interface/Function/Method — the common structural fact this feature persists, always carrying: kind, name, source range, snapshot-scoped identity, parent (if nested), and full provenance (file → snapshot → repository → commit SHA).
- **ExtractionJob**: A unit (or the overall coordinating record) of asynchronous, queue-driven work that parses and extracts symbols for one file or a bounded batch of files — carries status, retry count, and failure/completion state, directly analogous to Feature 001's `AcquisitionJob`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For a representative fixture in each Tier 1 language (Java, JavaScript, TypeScript), extraction produces the expected Module/Class/Interface/Function/Method symbols and source ranges with zero missing or spuriously-added top-level declarations, verified in acceptance testing (matching `sdd/03-ast-symbols/PHASE.md`'s acceptance criterion).
- **SC-002**: 100% of extracted symbols in acceptance testing carry a complete provenance chain (file, snapshot, repository, commit SHA) resolvable in a single lookup.
- **SC-003**: Extraction run twice against the same unchanged snapshot with unchanged extractor/grammar versions produces an identical symbol set both times, verified in acceptance testing (determinism).
- **SC-004**: A snapshot containing a mix of supported, unsupported, and malformed files completes extraction with the supported file's symbols present, the unsupported file recorded as skipped, and the malformed file recorded as failed — with zero symbols incorrectly attributed to the unsupported or malformed files, verified in acceptance testing.
- **SC-005**: A duplicated delivery of any queued extraction unit (simulated) produces identical resulting symbol data to a single delivery, verified in acceptance testing (idempotency), mirroring Feature 001's SC-005.
- **SC-006**: Extraction for a snapshot large enough to require multiple queued units completes without any single unit requiring the entire snapshot's files to be parsed in one invocation, verified by the extraction being implemented as a bounded, queue-driven pipeline rather than a single unbounded operation.
- **SC-007**: All existing RepoAtlas and Feature 001 acceptance criteria (`specs/001-dynamic-github-sources/spec.md`, `specs/001-code-intelligence-foundation/spec.md`) continue to pass unmodified after this feature is implemented — zero regressions.
- **SC-008**: Zero CALLS/IMPORTS/EXPORTS relationship resolution, Engineering Graph construction, graph traversal, ranking, retrieval-index (BM25/vector), impact analysis, process discovery, MCP-tool, or Code Intelligence UI functionality is required to exist for this feature's acceptance criteria to be met (non-goal boundary is provable by the test suite not needing any of it), mirroring Feature 001's SC-010.

## Assumptions

- This feature has no visitor-facing UI; extraction is triggered by an internal, developer/operator-facing server function, following the same `createServerFn` RPC pattern Feature 001 established (`snapshot.functions.ts`) — it is not wired automatically into snapshot acquisition completion in this feature; a future feature may choose to trigger it automatically.
- The initial supported-language set is exactly Tier 1 from `research/ARCHITECTURE_DECISION_GATE.md` §5 — Java, JavaScript, and TypeScript (including TSX) — grounded in that document's ratified repository-language-distribution analysis; Tier 2 (HTML, Rust) and Tier 3 languages are explicitly deferred, not silently included.
- A symbol's "exported" or visibility status (e.g., a JavaScript `export` keyword, a Java `public` modifier), where directly observable as part of the declaration syntax itself, MAY be recorded as an attribute of the symbol. This is a directly-observed (`EXTRACTED`) syntactic fact, not a resolved EXPORTS relationship (which requires module-resolution reasoning and is out of scope) — the distinction is: recording "this declaration is marked exported" is in scope; determining "which other modules can see it as a result" is not.
- Symbol identity is scoped to one snapshot; this feature does not attempt to track "the same" logical symbol as stable across different snapshots/commits of the same repository (e.g., detecting that a function was merely moved or renamed between commits) — that cross-snapshot correlation, if ever needed, is a later feature's concern, not this one's.
- Re-extraction after an extractor/grammar version upgrade is expected to produce a new, distinguishable extraction result (per FR-014) rather than silently overwriting prior results as if nothing changed; consistent with Feature 001's unbounded-retention posture, this feature does not require deleting or pruning prior extraction results — a retention/cleanup policy remains a future feature's concern, matching Feature 001's Assumptions. FR-008's identity-stability guarantee is scoped to one `extractor_version`'s result: a version upgrade is explicitly permitted to mint new symbol identities for the same snapshot, and this is not a violation of FR-008.
- Cloudflare D1 remains available for this feature's metadata persistence, consistent with Feature 001's established local/production parity pattern; this feature introduces no new D1 or R2 binding beyond what Feature 001 already provisioned. R2 is read-only for this feature (source bytes are read from Feature 001's existing objects; no new R2 writes are introduced by symbol extraction itself). This feature does introduce one new Cloudflare binding: a second Queue (`SYMBOL_QUEUE`, topic `repo-atlas-symbol-extraction`) for asynchronous extraction processing, independent of Feature 001's `SNAPSHOT_QUEUE` (see Requirements — Asynchronous processing & queue semantics).
- The specific unit-of-work granularity for queued extraction (one file per unit vs. a bounded batch of files) is an implementation detail left to the plan phase, mirroring Feature 001's explicit "SPIKE REQUIRED"-style deferral of its own checkpointing granularity — this spec requires bounded, queue-driven, idempotent processing to exist, not a specific numeric threshold.

## Out of Scope

- CALLS relationship resolution (which symbol invokes which).
- IMPORTS relationship resolution (which file/module depends on which).
- EXPORTS relationship resolution beyond a directly-observed, in-declaration visibility/export attribute (see Assumptions) — determining what a module resolution system would actually make visible to another file is out of scope.
- EXTENDS/IMPLEMENTS or any other type-relationship resolution.
- The Engineering Relationship Graph (nodes/edges beyond the Repository/Snapshot/Directory/File/Module/Class/Interface/Function/Method entities this feature defines).
- Graph traversal of any kind (BFS/DFS, shortest-path, or otherwise).
- PageRank or any graph-structural ranking.
- BM25/full-text or vector/embedding retrieval.
- Impact analysis / blast-radius computation.
- Process discovery.
- MCP tool implementation of any kind.
- AI/LLM-based summarization of source or symbol content.
- Any Code Intelligence user interface (visualization, browsing, or search UI for symbol-level data).
- Support for any language outside the Tier 1 set (Java, JavaScript, TypeScript/TSX) — Tier 2/3 languages are deferred to a future feature per the ratified language-tier research.
- Cross-snapshot symbol correlation ("the same" symbol tracked across commits) — see Assumptions.
- Any change to Feature 001's snapshot acquisition, file inventory, or persistence behavior, or to the existing GitHub repository metadata ingestion, 3D atlas, catalogue, categories, or insights views.
