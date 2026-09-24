# Data Model: Engineering Relationship Graph

Extends `data/code-intel-schema.sql` additively — no existing table (Feature 001's `repositories`/`snapshots`/`snapshot_files`, or Feature 002's `directories`/`file_extractions`/`symbols`/`extraction_jobs`/`snapshot_extractions`) is altered.

## Entities

### Relationship

The core entity: one typed, directed edge between two entities (a `Directory`, a `File` — i.e. a `file_extractions` row — or a `Symbol`) within one snapshot.

| Field | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `snapshot_id` | INTEGER FK → `snapshots(id)` | Denormalized for snapshot-scoped queries without a join, mirrors `symbols.snapshot_id`'s precedent |
| `relationship_type` | TEXT | One of `CONTAINS` \| `IMPORTS` \| `EXPORTS` \| `CALLS` \| `EXTENDS` \| `IMPLEMENTS` \| `USES` \| `REFERENCES` (FR-002) |
| `source_kind` | TEXT | `directory` \| `file` \| `symbol` — which table `source_id` points into |
| `source_id` | INTEGER | Polymorphic reference (`directories.id` / `file_extractions.id` / `symbols.id`, by `source_kind`); no D1 FK constraint across a polymorphic column, application-enforced instead, same posture SQLite/D1 already requires for any polymorphic reference |
| `target_kind` | TEXT NULL | `directory` \| `file` \| `symbol` \| `NULL` — `NULL` exactly when `evidence_state` is `AMBIGUOUS`/`UNKNOWN` with no single resolved target |
| `target_id` | INTEGER NULL | Polymorphic reference, `NULL` under the same condition as `target_kind` |
| `evidence_state` | TEXT | The single canonical evidence-state field for this relationship — exactly one of `EXTRACTED` \| `RESOLVED` \| `INFERRED` \| `AMBIGUOUS` \| `UNKNOWN` (FR-006, `research/ARCHITECTURE_DECISION_GATE.md` §7). There is no separate/second "resolution state" field anywhere on this row — an unresolvable reference (e.g. an external import) is represented entirely by `evidence_state = 'UNKNOWN'`, not by `'EXTRACTED'` plus something else (research.md §2, closes `/speckit-analyze` H2) |
| `confidence` | REAL NULL | Populated if and only if `evidence_state = 'INFERRED'` (FR-006) — `CHECK` constraint enforces this |
| `evidence_file_extraction_id` | INTEGER NULL FK → `file_extractions(id)` ON DELETE CASCADE | The file the evidence (import statement, call expression, clause) was observed in; `NULL` only for a pure `CONTAINS` edge derived from directory structure with no single-file anchor (directory→subdirectory) |
| `evidence_start_line` / `evidence_start_column` / `evidence_end_line` / `evidence_end_column` | INTEGER NULL | Source range of the evidence (FR-005), `NULL` under the same condition as `evidence_file_extraction_id` |
| `extraction_method` | TEXT | Which resolver/query produced this edge, e.g. `directory-hierarchy`, `symbol-parent`, `import-declaration`, `call-expression`, `extends-clause`, `implements-clause`, `export-flag` (FR-005, required per §7) **[AMENDED 2026-09-24 16:46 +04:00 — R4:** the `export-flag` value no longer describes the EXPORTS mechanism; replacement not chosen; see research.md A2**]** |
| `relationship_extractor_version` | TEXT | This feature's own version constant — FR-004/FR-009 provenance, direct structural analog of `SYMBOL_EXTRACTOR_VERSION` | [AMENDED 2026-09-24 16:58 +04:00 — R6 D-R6-1:** provenance and dataset validity/reuse scope only; NOT an input to `relationship_key`.**]**
| `symbol_extractor_version` | TEXT | The Feature 002 `SYMBOL_EXTRACTOR_VERSION` this relationship was derived against (FR-018) — lets a later Feature 002 re-extraction be detected as invalidating this row |
| `relationship_key` | TEXT | Deterministic identity (see below) |
| `created_at` | TEXT | ISO timestamp |

`UNIQUE(snapshot_id, relationship_key)`.

**Deterministic snapshot-scoped identity (`relationship_key`, FR-004)**: a SHA-256 hex digest of a canonical string `${snapshotId} ${relationshipType} ${sourceKind} ${sourceId} ${targetKind ?? "∅"} ${targetId ?? "∅"} ${evidenceFileExtractionId ?? "∅"} ${evidenceStartLine ?? "∅"} ${evidenceStartColumn ?? "∅"}` — the direct structural analog of Feature 002's `symbol_key`. Two identical facts (same edge, same evidence location) within the same snapshot always produce the same `relationship_key`, making re-extraction idempotent (FR-009) exactly the way `symbol_key` makes Feature 002 re-extraction idempotent. **[AMENDED 2026-09-24 16:46 +04:00 — R6:** the formula above depends on mutable D1 row ids and is superseded by the identity basis in research.md Amendments A3 (symbol endpoints by `symbol_key`, file/directory and evidence file by snapshot-scoped path). The claim that this is "the direct structural analog of `symbol_key`" is incorrect for `sourceId`/`targetId`/`evidenceFileExtractionId`, which are surrogate ids, not content-derived.**]** [AMENDED 2026-09-24 16:58 +04:00 — R6 D-R6-3:** canonical identity is `${snapshotId} ${relationshipType} ${sourceKind} ${sourceRef} ${targetKind ?? "∅"} ${targetRef ?? "∅"} ${evidenceFilePath ?? "∅"} ${evidenceStartLine ?? "∅"} ${evidenceStartColumn ?? "∅"}`, where `*Ref` = `symbol_key` (symbol), snapshot-scoped file path (file), snapshot-scoped directory path (directory); the target remains part of the identity; no D1 `AUTOINCREMENT` id and no `relationship_extractor_version` is an input. This paragraph's own formula (row ids) remains superseded. See research.md A3 Resolution.**]**

### RelationshipCandidate

Populated only for `AMBIGUOUS` relationships, so the candidate set FR-007 requires is queryable without re-deriving it.

| Field | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `relationship_id` | INTEGER FK → `relationships(id)` ON DELETE CASCADE | |
| `candidate_kind` | TEXT | `symbol` \| `file` |
| `candidate_id` | INTEGER | The candidate's row id in `symbols`/`file_extractions` |

`UNIQUE(relationship_id, candidate_kind, candidate_id)`.

### RelationshipExtractionJob

Snapshot-scoped, per-unit extraction bookkeeping — direct structural mirror of Feature 002's `ExtractionJob`, extended with `unit_type` to distinguish the two extraction phases research.md §4 requires.

| Field | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `snapshot_id` | INTEGER FK → `snapshots(id)` | |
| `unit_index` | INTEGER | |
| `unit_type` | TEXT | `contains` \| `parsed` (research.md §4/§1) — `contains` units run first, cheap, no parse; `parsed` units are one-file-per-unit (research.md §1) |
| `status` | TEXT | `pending` \| `retrying` \| `failed` \| `completed` |
| `checkpoint_cursor` | TEXT NULL | For `contains`: last-covered `directories.id`/`symbols.id`. For `parsed`: last-covered `snapshot_files.id` — same cursor shape Feature 002 already uses |
| `retry_count` | INTEGER DEFAULT 0 | |
| `failure_reason` | TEXT NULL | |
| `files_processed` | INTEGER DEFAULT 0 | |
| `relationships_extracted` | INTEGER DEFAULT 0 | |
| `updated_at` | TEXT | |

`UNIQUE(snapshot_id, unit_index)`.

### SnapshotRelationshipExtraction

Snapshot-level status rollup — direct structural mirror of Feature 002's `SnapshotExtraction`.

| Field | Type | Notes |
|---|---|---|
| `snapshot_id` | INTEGER PK FK → `snapshots(id)` | |
| `status` | TEXT | `in_progress` \| `completed` \| `completed_partial` \| `failed` (FR-013) |
| `relationship_extractor_version` | TEXT | |
| `symbol_extractor_version` | TEXT | The `SYMBOL_EXTRACTOR_VERSION` this whole run was derived against (FR-018) — recorded once at the snapshot-extraction level in addition to per-row on `relationships`, so a version-mismatch check (Edge Cases) doesn't require scanning every relationship row |
| `started_at` | TEXT | |
| `completed_at` | TEXT NULL | |

## Re-extraction Mechanism (mirrors Feature 002's, FR-009)

Same-version re-extraction (unchanged `relationship_extractor_version` **and** unchanged `symbol_extractor_version`) is idempotent by delete-then-reinsert per file/directory unit — functionally identical end state. A `relationship_extractor_version` bump, or a detected `symbol_extractor_version` mismatch against the snapshot's current Feature 002 state (Edge Cases in spec.md), invalidates the prior run and requires a fresh one; no cross-version history table is kept (same deliberate simplification Feature 002's `data-model.md` already made and justified — no spec requirement to query a superseded version's results). [AMENDED 2026-09-24 16:58 +04:00 — R6 D-R6-2:** "unchanged `symbol_extractor_version`" is not sufficient to treat the prior run as valid: Any F002 re-extraction affecting a file with existing relationships must invalidate or otherwise make stale the affected relationship dataset before those relationships are considered valid again. Stored `source_id`/`target_id` and `relationship_candidates.candidate_id` are D1 row ids and are stale after an F002 re-extraction; the dataset must be rebuilt (delete-then-reinsert) before it is trusted. Mechanism left to implementation. See research.md A3 Resolution.**]**

## Checkpoint/Resume Strategy

Two independent cursors, one per `unit_type`, both reusing Feature 002's exact "ordered id, `id > cursor` resumption, idempotent per-item skip-if-already-done" shape:

- `contains` units: ordered by `directories.id` then `symbols.id`; a directory/symbol already having its `CONTAINS` edge (checked by `relationship_key` existence) is skipped on resume.
- `parsed` units: ordered by `snapshot_files.id` (same ordering `listSnapshotFilesPage`/Feature 002's own checkpointing already uses); a file already having relationship rows at the current version pair is skipped on resume.

## Query Access Patterns (backing FR-014)

- **Outgoing from an entity**: `WHERE snapshot_id = ? AND source_kind = ? AND source_id = ?`, optional `AND relationship_type = ?`, ordered by `id`, cursor-paginated.
- **Incoming to an entity**: same shape against `target_kind`/`target_id`.
- Both require a composite index; see `contracts/d1-schema-additions.sql`.
