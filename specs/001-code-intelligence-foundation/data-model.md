# Data Model: Code Intelligence Foundation

Entities as introduced by spec.md's Key Entities section, expressed as concrete D1 tables + TypeScript domain types. Fully separate from `data/schema.sql` (existing `sources`/`repositories`/`ai_notes`/`meta`) — no shared table, no foreign key across the two databases.

## Entities

### Provider

Not a persisted table — a closed TypeScript union (`"github" | "gitlab"`) used as a field value elsewhere. Adding a new provider is a type-level change, not a schema migration, until a second `ContentProvider` implementation actually ships (out of scope here).

### Repository

Provider-qualified stable identity. Distinct from `data/schema.sql`'s `repositories` table (which stores GitHub metadata _payload_, keyed by `source_key`).

| Column       | Type          | Notes                                       |
| ------------ | ------------- | ------------------------------------------- |
| `id`         | INTEGER PK    |                                             |
| `provider`   | TEXT NOT NULL | `'github'` \| `'gitlab'` (CHECK constraint) |
| `owner`      | TEXT NOT NULL | provider-native owner/org login             |
| `name`       | TEXT NOT NULL | provider-native repository name             |
| `created_at` | TEXT NOT NULL | ISO-8601                                    |

**Constraint**: `UNIQUE(provider, owner, name)` — FR-001, FR-033. No collision possible between a GitHub and GitLab repo sharing `owner`/`name`.

**Relationships**: one-to-many → `repository_refs`, `snapshots`.

### RepositoryRef

A named pointer (branch/tag), mutable over time. Stored only as a resolution cache/log — never trusted as current without a live re-resolution.

| Column                | Type                                  | Notes                         |
| --------------------- | ------------------------------------- | ----------------------------- |
| `id`                  | INTEGER PK                            |                               |
| `repository_id`       | INTEGER NOT NULL FK → repositories.id |                               |
| `ref`                 | TEXT NOT NULL                         | branch/tag name as submitted  |
| `resolved_commit_sha` | TEXT NOT NULL                         | most recent resolution result |
| `resolved_at`         | TEXT NOT NULL                         | ISO-8601                      |

**Constraint**: `UNIQUE(repository_id, ref)` — one row per ref name, overwritten (not appended) on each fresh resolution (User Story 2 Acceptance Scenario 3: "always current-in-time").

### Commit

Not a separate table — a commit SHA is represented as a plain `TEXT` column (`snapshots.commit_sha`), validated at the domain-type level (`CommitSha` branded type) rather than as its own entity, since it carries no attributes beyond the SHA itself in this feature's scope.

### Snapshot

| Column              | Type                                  | Notes                                                                          |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| `id`                | INTEGER PK                            |                                                                                |
| `repository_id`     | INTEGER NOT NULL FK → repositories.id |                                                                                |
| `commit_sha`        | TEXT NOT NULL                         | immutable, resolved (FR-006)                                                   |
| `status`            | TEXT NOT NULL                         | `'pending'` \| `'in_progress'` \| `'completed'` \| `'failed'` (CHECK) — FR-009 |
| `acquisition_mode`  | TEXT NOT NULL                         | `'bulk_archive'` \| `'incremental_api'` — FR-031                               |
| `provider_endpoint` | TEXT                                  | which archive/API endpoint version served this snapshot — FR-031               |
| `created_at`        | TEXT NOT NULL                         |                                                                                |
| `completed_at`      | TEXT                                  | NULL until `status='completed'`                                                |

**Terminology** (see plan.md Snapshot Model for the full definition): each row in this table is a **snapshot acquisition attempt**, identified by `(repository_id, commit_sha, attempt_number)` — not by `(repository_id, commit_sha)` alone. The **logical snapshot** is `(repository, commit_sha)`; the **completed snapshot** is the ≤1 attempt row per logical snapshot with `status='completed'`.

**Constraint**: `UNIQUE(repository_id, commit_sha, attempt_number)` — matches `contracts/d1-schema.sql` exactly. Multiple attempt rows MAY exist per logical snapshot (e.g. one `failed` followed by one `completed`); application logic (plan.md Acquisition Workflow step 3, `resolveLogicalSnapshot`), not this constraint alone, guarantees at most one `completed` attempt per `(repository_id, commit_sha)` (FR-008). Requesting an existing logical snapshot that already has a `completed` attempt returns that attempt, never inserts a new one.

**State transitions**: `pending → in_progress → completed` or `pending → in_progress → failed`, per attempt row. No transition ever leaves `completed`/`failed` back to an earlier state. A retry after a `failed` attempt creates a **new** attempt row (`attempt_number` incremented) for the same `(repository_id, commit_sha)`, per FR-011 — it never mutates the failed row.

### SnapshotFile

| Column         | Type                               | Notes                                          |
| -------------- | ---------------------------------- | ---------------------------------------------- |
| `id`           | INTEGER PK                         |                                                |
| `snapshot_id`  | INTEGER NOT NULL FK → snapshots.id |                                                |
| `path`         | TEXT NOT NULL                      | repository-relative path                       |
| `size_bytes`   | INTEGER NOT NULL                   |                                                |
| `content_hash` | TEXT NOT NULL                      | SHA-256 hex                                    |
| `r2_key`       | TEXT NOT NULL                      | derived, see R2 Object Organization in plan.md |

**Constraints**: `UNIQUE(snapshot_id, path)` — FR-018, idempotent re-insert safety (FR-024). Index on `content_hash` for cross-snapshot de-dup lookups (FR-022's "MAY allow de-duplication").

**Retrieval**: by `(snapshot_id, path)` independent of any other file in the snapshot (FR-019); paginated listing by `snapshot_id` with `LIMIT`/`OFFSET` or keyset pagination on `id` (FR-020).

### AcquisitionJob

| Column              | Type                               | Notes                                                                                                                                                                                                          |
| ------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | INTEGER PK                         |                                                                                                                                                                                                                |
| `snapshot_id`       | INTEGER NOT NULL FK → snapshots.id |                                                                                                                                                                                                                |
| `unit_index`        | INTEGER NOT NULL                   | 0-based sequence within this snapshot's acquisition                                                                                                                                                            |
| `status`            | TEXT NOT NULL                      | `'pending'` \| `'retrying'` \| `'failed'` \| `'completed'` (CHECK) — FR-026                                                                                                                                    |
| `checkpoint_cursor` | TEXT                               | opaque resume marker (last-written path or tar-stream position) — FR-025                                                                                                                                       |
| `retry_count`       | INTEGER NOT NULL DEFAULT 0         | — FR-037                                                                                                                                                                                                       |
| `failure_reason`    | TEXT                               | populated on `status='failed'`/`'retrying'` — FR-037                                                                                                                                                           |
| `files_processed`   | INTEGER NOT NULL DEFAULT 0         | — FR-036. Set (not incremented) from `COUNT(*)` over this attempt's `snapshot_files` rows at the end of each unit — recomputing from already-idempotent rows keeps this retry-safe (see plan.md Observability) |
| `bytes_processed`   | INTEGER NOT NULL DEFAULT 0         | — FR-036. Same recompute pattern, `SUM(size_bytes)`                                                                                                                                                            |
| `updated_at`        | TEXT NOT NULL                      |                                                                                                                                                                                                                |

**Constraint**: `UNIQUE(snapshot_id, unit_index)`.

**Finalization query** (used by `snapshot-worker.ts`, see plan.md Snapshot Finalization): `SELECT COUNT(*) FROM acquisition_jobs WHERE snapshot_id = ? AND status != 'completed'` — a zero result (with at least one `completed` row existing) is the sole trigger for flipping `snapshots.status = 'completed'`.

### AcquisitionAttemptLog (observability; not in spec's Key Entities list, added for FR-035)

Table name remains `acquisition_attempts` (unchanged from `contracts/d1-schema.sql`); the **entity name here is `AcquisitionAttemptLog`**, deliberately distinct from the `Snapshot` entity above, to avoid the two different "attempt" concepts sharing one name (see plan.md Snapshot Model's terminology section). This table is the **operational observability log**; it is never read as evidence and never appears in `getRepositoryHistory` (that function reads only `snapshots` rows with `status='completed'` — see plan.md Incremental Synchronization Foundation).

| Column             | Type                | Notes                                                                                                |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------------------------- |
| `id`               | INTEGER PK          |                                                                                                      |
| `repository_id`    | INTEGER NOT NULL FK |                                                                                                      |
| `commit_sha`       | TEXT NOT NULL       |                                                                                                      |
| `provider`         | TEXT NOT NULL       |                                                                                                      |
| `acquisition_mode` | TEXT NOT NULL       |                                                                                                      |
| `started_at`       | TEXT NOT NULL       |                                                                                                      |
| `ended_at`         | TEXT                |                                                                                                      |
| `status`           | TEXT NOT NULL       | mirrors the owning snapshot acquisition attempt's terminal status                                    |
| `duration_ms`      | INTEGER             | computed as `ended_at - started_at` and persisted at terminal update, not left for callers to derive |

**Relationship to `Snapshot`**: one **snapshot acquisition attempt** (one `snapshots` row) has **at most one** `AcquisitionAttemptLog` row, created at the same moment a new attempt row is created — never on the reuse-of-an-existing-completed-snapshot path (no new attempt ⇒ no new log). This table has no `attempt_number`/FK column back to `snapshots` (schema is fixed by `contracts/d1-schema.sql`), so the owning row is located by `(repository_id, commit_sha, status NOT IN ('completed','failed'))` — at most one such row can exist at a time for a given logical snapshot, by the same invariant that guarantees at most one non-terminal `snapshots` attempt at a time (plan.md `resolveLogicalSnapshot`). This makes the terminal `UPDATE` idempotent under retried finalization: a second finalization attempt matches zero rows and is a no-op, never creating or updating a second log row (FR-035; see plan.md Observability for the full writer lifecycle).

## Validation Rules (cross-cutting)

- `commit_sha` is never written to any table except via `ContentProvider.resolveRef`'s return value (enforced at the TypeScript type level via the `CommitSha` branded type, not just convention) — FR-006. This is a compile-time guarantee only; `resolveRef`'s implementation additionally runtime-validates its own return value against a 40-character-hex SHA shape before returning (SC-002 defense-in-depth, see plan.md Testing Strategy) so a provider-response bug can't smuggle a non-SHA string past the type system.
- `snapshots.status` only readable as `completed` by any query used as "evidence" by another feature; `pending`/`in_progress`/`failed` are all treated as not-yet-usable by callers (FR-009, FR-010).
- No table in this schema stores a credential/token value (FR-032) — verified by schema review, not runtime validation, since no column in any table above is credential-shaped.
- Every `snapshot_files` row carries `repository_id` (via its owning `snapshots` row), `commit_sha`, and `snapshot_id` — sufficient provenance per file back to provider/repository/commit/snapshot (FR-030) without a dedicated provenance table.

## No Graph Model

Explicitly, this data model has no `nodes`/`edges` table and no adjacency structure — Out of Scope per spec ("Engineering Graph construction... beyond the Repository/Snapshot/SnapshotFile entities defined in this spec"). `repository_id`/`snapshot_id` foreign keys are ordinary relational references, not graph edges with evidence-state metadata (that model is `research/ARCHITECTURE_DECISION_GATE.md` §7, a future feature).
