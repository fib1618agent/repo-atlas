---
description: "Task list for Code Intelligence Foundation implementation"
---

# Tasks: Code Intelligence Foundation

**Input**: Design documents from `/specs/001-code-intelligence-foundation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — plan.md's own Testing Strategy section commits this feature to `bun test` contract and integration tests (the first automated tests in this repository), so test tasks are generated per story, not left optional.

**Organization**: Tasks are grouped by user story (spec.md P1/P2 priorities) to enable independent implementation and testing of each story. Every task preserves: the logical-snapshot vs. acquisition-attempt distinction, completed-snapshot immutability, at-most-one-completed-attempt-per-(repository,commit_sha), streaming archive processing, queue idempotency/retry, D1/R2 separation, GitHub-only implementation with a GitLab-ready abstraction, and all Feature 001 non-goals (no AST/symbol/graph/BM25/vector-search/impact-analysis/process-discovery/MCP/UI).

**Terminology** (per plan.md Snapshot Model, resolves `/speckit-analyze` finding A1): **"snapshot acquisition attempt"** = a `snapshots` row, identified by `(repository, commitSha, attemptNumber)`. **"acquisition attempt log"** = a row in the separate `acquisition_attempts` observability table — at most one per snapshot acquisition attempt, never created on the reuse-of-completed-snapshot path, never duplicated on retry. These two terms are used precisely below; "attempt" alone always means the former unless a task explicitly says "log."

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US7, per spec.md)
- Every task includes an exact file path

## Path Conventions

Single-project TanStack Start app (plan.md Structure Decision — existing layout, unchanged). All new code is additive under `src/lib/code-intel/`; new tests under `tests/contract/code-intel/` and `tests/integration/code-intel/`; new schema at `data/code-intel-schema.sql`; new deployment config at `wrangler.toml` (repo root). No path below touches `src/lib/repositories.functions.ts`, `src/lib/github-fetch.ts`, `src/lib/github-url.ts`, `src/lib/storage/atlas-store.ts`, `data/schema.sql`, any `src/routes/*`, any `src/components/*`, or anything under `specs/001-dynamic-github-sources/` or `.specify/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New deployment config and schema this feature's D1/R2/Queues persistence needs, per plan.md Architectural Integration Points #3 and Migration/Backward Compatibility.

- [x] T001 Create `wrangler.toml` at repo root with `[[d1_databases]]`, `[[r2_buckets]]`, `[[queues.producers]]`/`[[queues.consumers]]` bindings for local (Miniflare) and deployed environments — first Cloudflare-infra-as-config file in this repo (plan.md confirms none exists today); do not alter `vite.config.ts`'s existing `cloudflare-module` Nitro preset.
- [x] T002 [P] Create `data/code-intel-schema.sql` containing the DDL from `specs/001-code-intelligence-foundation/contracts/d1-schema.sql` verbatim (repositories, repository_refs, snapshots, snapshot_files, acquisition_jobs, acquisition_attempts); apply to local D1 emulation via `wrangler d1 execute <DB_NAME> --local --file=data/code-intel-schema.sql`. Do not modify `data/schema.sql`.
- [x] T003 [P] Add `src/lib/code-intel/config.ts` exporting `codeIntelConfig()` (max concurrent R2 writes, checkpoint unit size, queue batch size, retry max-attempt count), styled after `serverAtlasConfig()` in `src/lib/atlas-config.ts` — new function, no shared state with existing config, `atlas-config.ts` itself unchanged.
- [x] T004 [P] Add a `"test": "bun test"` script entry to `package.json` (additive script only — no new dependency, no existing script changed).

**Checkpoint**: Deployment config and schema exist; no user story work depends on anything beyond this.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain types, provider interfaces, error catalog extension, and thin D1/R2 client layers every user story below builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Create `src/lib/code-intel/domain/repository-identity.ts` — `RepositoryIdentity = { provider: "github" | "gitlab"; owner: string; name: string }`, `RepositoryRef`, and a branded `CommitSha` type such that a bare ref string can never satisfy a `CommitSha`-typed parameter (FR-001, FR-002, FR-006).
- [x] T006 Create `src/lib/code-intel/domain/snapshot.ts` — `Snapshot` (including `attemptNumber`), `SnapshotFile`, `AcquisitionJob` types, with the three distinct identities from plan.md's Snapshot Model documented in a leading comment: logical snapshot `(repository, commitSha)`, snapshot acquisition attempt `(repository, commitSha, attemptNumber)`, completed snapshot (the ≤1 attempt per logical snapshot with `status="completed"`). Also note, per the same section, that the separate `acquisition_attempts` table is a distinct "acquisition attempt log" concept, not modeled by these types.
- [x] T007 [P] Create `src/lib/code-intel/providers/content-provider.ts` — the `ContentProvider` interface (`resolveRef`, `fetchArchive`, `fetchPaths`, `compareRefs`) exactly per `specs/001-code-intelligence-foundation/contracts/content-provider.md`; no method signature may reference a GitHub-specific response shape (contract rule 2, GitLab-readiness).
- [x] T008 [P] Create `src/lib/code-intel/providers/metadata-provider.ts` — the `MetadataProvider` interface documenting the existing `src/lib/github-fetch.ts` capability retroactively; zero changes to `github-fetch.ts` itself.
- [x] T009 Extend `src/lib/atlas-errors.ts` additively: add new `AtlasErrorCode` union members `REF_NOT_FOUND`, `ARCHIVE_UNAVAILABLE`, `SNAPSHOT_FAILED`, `SNAPSHOT_NOT_FOUND`, `SNAPSHOT_REPOSITORY_UNAUTHORIZED` with matching `ERROR_MESSAGES` entries; do not remove, rename, or reword any existing code or message.
- [x] T010 [P] Create `src/lib/code-intel/persistence/d1-client.ts` — thin query layer over the `repositories`, `repository_refs`, `snapshots`, `snapshot_files`, `acquisition_jobs`, `acquisition_attempts` tables (schema from T002); no ORM.
- [x] T011 [P] Create `src/lib/code-intel/persistence/r2-client.ts` — thin `get`/`put`/`head` wrapper using the key scheme `snapshots/{provider}/{owner}/{name}/{commit_sha}/{content_hash}`, writes throttled to ≤6 simultaneous in-flight `put()`s via the existing `mapWithConcurrency` (`src/lib/github-fetch.ts:234-253`, imported not duplicated).
- [x] T012 Create `src/lib/code-intel/acquisition/content-address.ts` — SHA-256 content hashing of a byte stream + R2 key derivation from `(repository, commitSha, contentHash)` (FR-018, FR-022).

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Provider-independent repository identity (Priority: P1) 🎯 MVP groundwork

**Goal**: Represent repository identity as provider-qualified so GitHub and GitLab repositories sharing an owner/name string never collide.

**Independent Test**: Register a repository identity originating from a GitHub source and one from a GitLab source; confirm both are represented through the same identity shape with no code path inspecting a provider-specific field to determine identity, and no collision in D1.

### Tests for User Story 1

- [x] T013 [P] [US1] Contract test in `tests/contract/code-intel/repository-identity.test.ts`: assert `(provider:"github", owner:"x", name:"y")` and `(provider:"gitlab", owner:"x", name:"y")` resolve to two distinct D1 `repositories` rows (`UNIQUE(provider, owner, name)`), never one.

### Implementation for User Story 1

- [x] T014 [US1] Implement `getOrCreateRepository(identity: RepositoryIdentity)` in `src/lib/code-intel/persistence/d1-client.ts` (extends T010) — `INSERT ... ON CONFLICT (provider, owner, name) DO NOTHING` then `SELECT`, returning the D1 row id; no code path outside this function determines repository identity from a provider-specific field (FR-002).

**Checkpoint**: Repository identity is provider-qualified and collision-free in D1, independently verifiable via T013.

---

## Phase 4: User Story 2 - Deterministic ref resolution (Priority: P1)

**Goal**: Resolve a branch/tag/SHA to exactly one immutable commit SHA before any acquisition step.

**Independent Test**: Submit a repository identity plus a branch name; confirm the system returns a single immutable commit SHA and that no acquisition step accepts a bare ref in place of a resolved SHA.

### Tests for User Story 2

- [x] T015 [P] [US2] Contract test in `tests/contract/code-intel/ref-resolution.test.ts`: a valid branch resolves to exactly one 40-char SHA; a nonexistent ref throws a serialized `AtlasError` with code `REF_NOT_FOUND` and creates no `snapshots` row (FR-005, FR-007).
- [x] T016 [P] [US2] Contract test in `tests/contract/code-intel/commit-sha-shape.test.ts`: assert `resolveRef`'s return value always matches a 40-character-hex SHA shape before it is allowed to reach any D1 write path; assert the runtime guard added in T017 rejects a non-SHA-shaped value even if the `CommitSha` compile-time brand were bypassed (SC-002 runtime defense-in-depth, resolves `/speckit-analyze` finding G3 — lightweight boundary check, not a new validation subsystem).

### Implementation for User Story 2

- [x] T017 [US2] Implement `resolveRef(repository, ref)` in `src/lib/code-intel/providers/github-content-provider.ts` via the GitHub Git Refs API, returning a branded `CommitSha` or throwing `REF_NOT_FOUND` (FR-005, FR-006, FR-007). Before returning, validate the resolved value against a 40-character-hex regex and throw (rather than return a malformed `CommitSha`) if it doesn't match — a one-line runtime guard at the provider boundary, not a new subsystem (SC-002; depends on T005, T007, T009).
- [x] T018 [US2] Implement `upsertResolvedRef(repositoryId, ref, sha)` in `src/lib/code-intel/persistence/d1-client.ts` (extends T010) — `UNIQUE(repository_id, ref)`, overwritten (not appended) on each fresh resolution, never trusted stale for a new acquisition (User Story 2 Acceptance Scenario 3).
- [x] T019 [US2] Create `src/lib/code-intel/snapshot.functions.ts` with the `acquireSnapshot` server fn's ref-resolution step only (plan.md Acquisition Workflow step 2): call `resolveRef`, rethrow serialized `REF_NOT_FOUND` on failure, create no `snapshots` row on failure (depends on T014, T017, T018).

**Checkpoint**: Ref resolution is deterministic, SHA-shape-validated at runtime, and independently testable via T015/T016; `acquireSnapshot` exists as a stub entry point for later stories to extend.

---

## Phase 5: User Story 3 - Reproducible source snapshot (Priority: P1) 🎯 MVP

**Goal**: A repository's contents at a specific commit SHA can be represented as a snapshot any later feature can depend on as authoritative, reproducible evidence.

**Independent Test**: Trigger snapshot creation for a small public repository at a known commit SHA twice; confirm both runs produce identical file content for that SHA, and the snapshot is never observable in a partially-created state.

### Tests for User Story 3

- [x] T020 [P] [US3] Contract test in `tests/contract/code-intel/tar-stream.test.ts`: parse fixture tar.gz byte sequences, including entries whose headers or content are split across stream chunk boundaries (plan.md Risks: "Tar entries split across `DecompressionStream` chunk boundaries").
- [x] T021 [P] [US3] Contract test in `tests/contract/code-intel/idempotent-insert.test.ts`: re-running the same `snapshot_files`/`acquisition_jobs` insert twice (same unique key) produces one row, not two (FR-024 groundwork for SC-005).
- [x] T022 [US3] Integration test in `tests/integration/code-intel/reproducible-snapshot.test.ts`: acquire the same `(repository, commitSha)` twice against one small real public repository; assert byte-identical file content both times (SC-003); depends on T020, T021 and the implementation tasks below.

### Implementation for User Story 3

- [x] T023 [US3] Implement `src/lib/code-intel/acquisition/tar-stream.ts` — dependency-free sequential 512-byte-header tar entry parser over a `ReadableStream`, emitting one `ArchiveEntry {path, size, contentStream}` at a time, correct across chunk boundaries (FR-017).
- [x] T024 [US3] Implement `fetchArchive(repository, sha)` in `src/lib/code-intel/providers/github-content-provider.ts` — `codeload.github.com/{owner}/{repo}/tar.gz/{sha}` fetch returning a `ReadableStream<ArchiveEntry>` (FR-004, FR-012; depends on T007, T023).
- [x] T025 [US3] Implement `src/lib/code-intel/acquisition/archive-pipeline.ts` — `fetch` → `DecompressionStream("gzip")` (native) → `tar-stream.ts` → per-entry `content-address.ts` hash → throttled `r2-client.ts` `put()`, never buffering the full decompressed archive (FR-015, FR-016; SC-004; depends on T011, T012, T023, T024).
- [x] T026 [US3] Implement attempt-scoped write functions in `src/lib/code-intel/persistence/d1-client.ts` (extends T010): `createAcquisitionAttempt(repositoryId, commitSha, acquisitionMode)` — takes the already-determined `acquisitionMode` as an explicit parameter and persists it on the new row immediately (computes `attempt_number = MAX(existing)+1` or `1`; FR-031; resolves `/speckit-analyze` finding U1 — do not invent a `providerEndpoint` parameter here, that field has no established writer in this feature and is left `NULL`, per the schema in `contracts/d1-schema.sql`), `insertSnapshotFile` (idempotent, `UNIQUE(snapshot_id, path)`), `upsertAcquisitionJob` (idempotent, `UNIQUE(snapshot_id, unit_index)`) (depends on T021).
- [x] T027 [US3] Implement `src/lib/code-intel/queue/snapshot-worker.ts` — Cloudflare Queue consumer processing one `AcquisitionJob` unit per invocation via `archive-pipeline.ts`, writing D1 rows via T026. At the end of each unit, set (not increment) `acquisition_jobs.files_processed = COUNT(*)` and `bytes_processed = SUM(size_bytes)` recomputed from this attempt's `snapshot_files` rows — recomputing from already-idempotent rows keeps this retry-safe and ensures a failed R2 write (no `snapshot_files` row inserted) never inflates the count (FR-036, resolves `/speckit-analyze` finding G2; depends on T025, T026).
- [x] T028 [US3] Implement snapshot finalization in `snapshot-worker.ts`: single D1 transaction verifying (a) every `AcquisitionJob` for this attempt is `completed`, and (b) no sibling attempt for the same `(repository_id, commit_sha)` is already `completed`, before flipping this attempt's `snapshots.status = "completed"`; second-finalization attempts are a no-op via a `WHERE status != 'completed'` guard (FR-010, FR-027; depends on T027).
- [x] T029 [US3] Implement `resolveLogicalSnapshot(repositoryId, commitSha)` in `src/lib/code-intel/persistence/d1-client.ts` (extends T010, plan.md Acquisition Workflow step 3): query all attempts for `(repository_id, commit_sha)`; return the `completed` attempt if one exists, else the `in_progress`/`pending` attempt if one exists, else signal "no reusable attempt" (depends on T014, T026).
- [x] T030 [US3] Complete `acquireSnapshot` in `src/lib/code-intel/snapshot.functions.ts` (extends T019) wiring plan.md Acquisition Workflow steps 3–6: call `resolveLogicalSnapshot`; if none reusable, determine `acquisitionMode` and call `createAcquisitionAttempt(repositoryId, commitSha, acquisitionMode)`, then enqueue the first `AcquisitionJob` unit; return `AcquireSnapshotResponse` (with `reused` flag) per `specs/001-code-intelligence-foundation/contracts/acquire-snapshot.functions.md` (depends on T027, T028, T029).
- [x] T031 [US3] Implement the acquisition attempt log writer lifecycle in `src/lib/code-intel/persistence/d1-client.ts` (extends T010) and wire it into `acquireSnapshot` (T030) and `snapshot-worker.ts`'s finalization (T028): **(1)** insert one `acquisition_attempts` row (`repository_id`, `commit_sha`, `provider`, `acquisition_mode`, `started_at`, `status="in_progress"`) at the exact moment `createAcquisitionAttempt` (T026) creates a new snapshot acquisition attempt — never on the reuse-of-completed-snapshot path (T030's resolve step); **(2)** on successful finalization (T028), `UPDATE acquisition_attempts SET status='completed', ended_at=?, duration_ms=? WHERE repository_id=? AND commit_sha=? AND status NOT IN ('completed','failed')`, computing `duration_ms` from `started_at`/`ended_at` and persisting it explicitly; **(3)** this guarded `WHERE status NOT IN (...)` makes the update idempotent under retried/duplicated finalization calls (a second call matches zero rows, is a no-op — same pattern as T028's `snapshots` finalization guard); **(4)** never mutates or duplicates a row for an already-terminal attempt. Resolves `/speckit-analyze` finding G1 (FR-035: repository, provider, commit SHA, acquisition mode, start/end status, duration all recorded; safe under queue retries and duplicate top-level acquisition requests) (depends on T026, T028, T030).

**Checkpoint**: Snapshot acquisition is reproducible, attempt-scoped, and never observable partially-complete — independently testable via T022. Acquisition attempt logging (FR-035) is live. This is the feature's MVP core.

---

## Phase 6: User Story 5 - Persistent snapshot storage (Priority: P1)

**Goal**: Snapshot metadata and file content persist beyond any single Worker invocation and remain retrievable on demand.

**Independent Test**: Create a snapshot in one request/invocation; in a separate later invocation, query for it by identity and confirm both metadata and file content are retrievable unchanged.

### Tests for User Story 5

- [x] T032 [P] [US5] Integration test in `tests/integration/code-intel/persistence-across-invocations.test.ts`: create+complete a snapshot in one process, query `getSnapshotStatus`/`getSnapshotFile` from a separate later invocation (fresh `wrangler dev` process or cold client), assert byte-identical metadata and content (SC-008).

### Implementation for User Story 5

- [x] T033 [US5] Implement `getSnapshotStatus` in `src/lib/code-intel/snapshot.functions.ts` per `specs/001-code-intelligence-foundation/contracts/snapshot-query.functions.md` (`unitsCompleted`, `unitsTotalKnown`, `filesProcessed`, `bytesProcessed`; throws `SNAPSHOT_NOT_FOUND` for an unknown id) (depends on T026, T030).
- [x] T034 [US5] Implement `getSnapshotFile` in `snapshot.functions.ts` — single R2 `get()` by `(snapshotId, path)`, independent of any other file's retrieval (FR-019) (depends on T011, T026).
- [x] T035 [US5] Implement a `canUseD1()`/`canUseR2()`-equivalent local/prod capability check in `d1-client.ts` and `r2-client.ts`, following the `canUseSqlite()` pattern in `src/lib/storage/atlas-store.ts` (pattern reuse only — `atlas-store.ts` itself is not modified) (depends on T010, T011).

**Checkpoint**: Metadata and content persistence across invocations is independently testable via T032.

---

## Phase 7: User Story 4 - Source file inventory (Priority: P2)

**Goal**: Enumerate a completed snapshot's files and retrieve any individual file's content without loading the entire repository into memory.

**Independent Test**: For a completed snapshot, list files in bounded pages rather than one unbounded response; fetch one file's content directly by its snapshot-scoped identity without touching any other file.

### Tests for User Story 4

- [x] T036 [P] [US4] Integration test in `tests/integration/code-intel/file-inventory.test.ts`: paginated `listSnapshotFiles` never returns more than `limit` entries per page; `getSnapshotFile` content hash matches a fresh SHA-256 recompute of the returned bytes.

### Implementation for User Story 4

- [x] T037 [US4] Implement `listSnapshotFiles` in `src/lib/code-intel/snapshot.functions.ts` per `specs/001-code-intelligence-foundation/contracts/snapshot-query.functions.md` — cursor/limit pagination, default and max page size enforced server-side (FR-020), returns an empty page (not an error) when the target attempt's `status !== "completed"` (FR-009) (depends on T026, T033).

**Checkpoint**: File inventory is independently testable via T036.

---

## Phase 8: User Story 6 - Asynchronous, checkpointed processing (Priority: P2)

**Goal**: Large acquisitions process as bounded, queue-driven units; a failed or duplicated unit never corrupts or duplicates a completed snapshot.

**Independent Test**: Simulate a queued processing unit delivered twice; confirm the resulting snapshot state is identical to a single delivery, with no duplicated files and no corrupted metadata.

### Tests for User Story 6

- [x] T038 [P] [US6] Integration test in `tests/integration/code-intel/duplicate-delivery.test.ts`: re-deliver one already-processed queue message to `snapshot-worker.ts`; assert `snapshot_files` row count and `acquisition_jobs` status for that attempt are unchanged (SC-005).
- [x] T039 [P] [US6] Integration test in `tests/integration/code-intel/partial-failure.test.ts`: force a unit failure mid-processing; assert `getSnapshotStatus` never reports `"completed"` for that attempt until a genuinely full run finishes (SC-006).

### Implementation for User Story 6

- [x] T040 [US6] Implement checkpoint tracking in `src/lib/code-intel/acquisition/archive-pipeline.ts` (extends T025): track a cursor (byte offset / last-written entry), stop at a configurable file-count or elapsed-CPU-time budget (tunable via `codeIntelConfig()`, T003), persist to `acquisition_jobs.checkpoint_cursor`, enqueue a follow-up `AcquisitionJob` unit for the same attempt (FR-025).
- [x] T041 [US6] Implement re-fetch-and-fast-forward resume in `archive-pipeline.ts` (extends T040): a continuation unit re-requests the same archive URL (content is immutable per `commit_sha`) and skips already-written entries via the idempotent D1 lookup from T026, scoped strictly to its own attempt's `snapshotId` — never reading or writing a different attempt's rows, and never a `completed` attempt's rows (FR-024; plan.md requirement 8).
- [x] T042 [US6] Implement `retry_count`/`status="retrying"` tracking and max-attempt-exceeded → `status="failed"` transition in `snapshot-worker.ts` (extends T027, T028) — no ambiguity between still-retrying and permanently failed (FR-026, FR-011). When a unit's job transitions to permanent `status="failed"`, also update the owning attempt's acquisition attempt log row (T031's guarded `UPDATE ... WHERE status NOT IN ('completed','failed')`, with `status='failed'`) — the same idempotent-guard pattern, applied to the failure path.
- [x] T043 [US6] Implement attempt-level retry in `acquireSnapshot` (`snapshot.functions.ts`, extends T030): when `resolveLogicalSnapshot` (T029) finds only `failed` attempts for a `(repository, commit_sha)`, create a new attempt via `createAcquisitionAttempt` (T026) with an incremented `attempt_number` and a fresh job sequence, and a new acquisition attempt log row (T031) for this new attempt; the prior failed attempt's `snapshot_files`/`acquisition_jobs` rows — and its now-terminal log row — are left untouched as historical records, never referenced by the new attempt's finalization check (FR-011; plan.md requirement 7, 9).

**Checkpoint**: Checkpointed, idempotent, retry-safe processing — including acquisition attempt log terminal updates — is independently testable via T038/T039.

---

## Phase 9: User Story 7 - Incremental synchronization foundation (Priority: P2)

**Goal**: A later analyzer can identify a repository's most recent prior snapshot and determine, for a new commit SHA, whether a full or incremental acquisition is appropriate.

**Independent Test**: Create two snapshots for the same repository at two different commit SHAs; confirm a query identifies the more recent snapshot and retrieves both commit SHAs.

### Tests for User Story 7

- [x] T044 [P] [US7] Integration test in `tests/integration/code-intel/repository-history.test.ts`: `getRepositoryHistory` returns completed snapshots ordered most-recent-first; returns `[]` for a repository with no prior completed snapshot; asserts a `failed`/`in_progress` attempt for a newer commit SHA never appears in the result (contract rule 5, resolves `/speckit-analyze` finding I1).

### Implementation for User Story 7

- [x] T045 [US7] Implement `getRepositoryHistory` in `src/lib/code-intel/snapshot.functions.ts` per `specs/001-code-intelligence-foundation/contracts/snapshot-query.functions.md` — query `snapshots` **filtered to `status = "completed"`** only (never a `failed`/`in_progress` attempt, and never the `acquisition_attempts` log table), ordered `completed_at DESC` (FR-028, FR-029) (depends on T026, T033).
- [x] T046 [US7] Implement `compareRefs(repository, baseSha, headSha)` in `src/lib/code-intel/providers/github-content-provider.ts` via the GitHub Compare API, returning a changed-path list (FR-013) (depends on T007, T017).
- [x] T047 [US7] Implement `fetchPaths(repository, sha, paths)` in `github-content-provider.ts` via the GitHub Contents API, bounded concurrency via `mapWithConcurrency` (FR-013) (depends on T007).
- [x] T048 [US7] Implement `src/lib/code-intel/acquisition/incremental-pipeline.ts` — consumes `compareRefs`'s changed-path list and `fetchPaths` to acquire only changed files under a new acquisition attempt (FR-013) (depends on T026, T046, T047).
- [x] T049 [US7] Wire the `bulk_archive` vs. `incremental_api` mode decision into `acquireSnapshot` (`snapshot.functions.ts`, extends T030, plan.md Acquisition Workflow step 4): `bulk_archive` if `getRepositoryHistory` (T045) returns no prior completed snapshot for the repository, `incremental_api` otherwise, routing to `incremental-pipeline.ts` (T048) instead of `archive-pipeline.ts` (depends on T045, T048).

**Checkpoint**: Incremental-sync foundation is independently testable via T044; all seven user stories are now complete.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Verify the feature-wide invariants explicitly required alongside the user stories.

- [x] T050 [P] Run all `specs/001-code-intelligence-foundation/quickstart.md` scenarios end-to-end against local Wrangler/Miniflare D1/R2/Queues emulation.
- [x] T051 [P] Run `bunx tsc --noEmit` across the whole repository; confirm zero type errors introduced outside the additive `atlas-errors.ts` extension (FR-039, FR-040, SC-009).
- [x] T052 [P] Diff-review confirming: **(a)** zero modification to `src/lib/repositories.functions.ts`, `src/lib/github-fetch.ts`, `src/lib/github-url.ts`, `src/lib/storage/atlas-store.ts`, `data/schema.sql`, any `src/routes/*`, any `src/components/*`, and no file under `specs/001-dynamic-github-sources/` (plan.md Migration/Backward Compatibility; existing-feature preservation); **(b)** no `child_process` usage, no git-binary invocation, and no production git-clone path anywhere under `src/lib/code-intel/` (FR-014, resolves `/speckit-analyze` finding G4); **(c)** no D1 table or row anywhere in `data/code-intel-schema.sql`/`d1-client.ts` stores a credential or token value (FR-032); **(d)** every `snapshot_files` row is reachable back to provider/repository/commit/snapshot via its FK chain (FR-030); **(e)** `github-content-provider.ts` calls only public, unauthenticated-scope GitHub endpoints, no private-repo or OAuth code path (FR-034) (resolves `/speckit-analyze` findings G5).
- [x] T053 [P] Verify `src/lib/code-intel/providers/content-provider.ts` (T007) contains no GitHub-specific field in any method signature or return type, and confirm no `gitlab-content-provider.ts` file was created — GitLab-ready abstraction, GitHub-only implementation (FR-004; contracts/content-provider.md rule 2).
- [x] T054 [P] Verify no file under `src/lib/code-intel/` implements AST parsing, symbol extraction, relationship/graph construction, BM25/lexical search, vector/embedding search, impact analysis, process discovery, MCP tooling, or any Code Intelligence UI (spec Out of Scope; SC-010).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T002's schema must exist before T010's client is meaningfully testable) — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational + US1 (T014, repository identity lookup).
- **User Story 3 (Phase 5)**: Depends on Foundational + US2 (T019, ref-resolution step; T014, repository lookup).
- **User Story 5 (Phase 6)**: Depends on US3 (queries the attempt rows US3 creates).
- **User Story 4 (Phase 7)**: Depends on US3 + US5 (T026 file rows, T033 status pattern).
- **User Story 6 (Phase 8)**: Depends on US3 (extends `archive-pipeline.ts`, `snapshot-worker.ts`, and the T031 acquisition attempt log writer directly).
- **User Story 7 (Phase 9)**: Depends on US3 + US5 (T026 attempt creation, T033 status pattern) and US2 (T017, ref resolution reused by `compareRefs`).
- **Polish (Phase 10)**: Depends on all desired user stories being complete.

Unlike a fully-independent-stories template, US2 through US7 here have genuine sequential data dependencies (each builds on the acquisition-attempt machinery US3 establishes) — this reflects the spec's own "Why this priority" ordering (US1→US2→US3 must be right before anything else is built), not an artificial constraint.

### Within Each User Story

- Tests written before implementation, expected to fail first.
- Domain/provider/persistence functions before the `snapshot.functions.ts` wiring that calls them.
- Attempt-scoped writes (T026) before finalization (T028) before workflow wiring (T030) before the acquisition attempt log writer that hooks both (T031).

### Parallel Opportunities

- T001–T004 (Setup) can run in parallel except T001 before T002 (schema apply needs bindings declared).
- T007, T008, T010, T011 (Foundational) can run in parallel once T005/T006 land.
- T013, T015, T016, T020, T021, T032, T036, T038, T039, T044 (test tasks marked [P]) can run in parallel with each other within their own story.
- T050–T054 (Polish) can all run in parallel.

---

## Parallel Example: User Story 3

```bash
# Launch US3's independent contract tests together:
Task: "Contract test tar-stream chunk-boundary parsing in tests/contract/code-intel/tar-stream.test.ts"
Task: "Contract test D1 idempotent-insert in tests/contract/code-intel/idempotent-insert.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 → 2 → 3)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3), in that order — this sequence is spec.md's own stated MVP path ("Every later capability... addresses 'a repository' as its root concept... This must be right before anything else is built").
4. **STOP and VALIDATE**: run T013, T015, T016, T020–T022 independently.
5. This is the feature's usable core: provider-qualified identity, deterministic (and runtime-validated) ref resolution, reproducible snapshot acquisition, acquisition attempt observability.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → US2 → US3 → validate → MVP.
3. US5 (persistence verification) → validate.
4. US4 (file inventory) → validate.
5. US6 (checkpointing/idempotency hardening) → validate.
6. US7 (incremental sync foundation) → validate.
7. Polish (Phase 10) → confirm all cross-cutting invariants.

Each increment adds value without altering the acquisition-attempt/completed-snapshot invariants established in US3.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Every acquisition-attempt-mutating task (T026–T031, T040–T043, T048–T049) must preserve: completed attempts are immutable (no task writes to a `completed` attempt's rows), and at most one attempt per `(repository, commit_sha)` may ever hold `status="completed"` (enforced by T028's transactional guard). The acquisition attempt log (T031, extended by T042) is a separate, non-authoritative observability record — writing to it never substitutes for, races with, or bypasses the `snapshots`-table finalization guard.
- `getRepositoryHistory` (T045) and its contract (`contracts/snapshot-query.functions.md`) return completed snapshots only — operational acquisition state (in-progress/failed attempts, and the acquisition attempt log) is never repository history.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- No task in this file touches `.specify/`, `specs/001-dynamic-github-sources/`, or introduces AST/symbol/graph/search/impact-analysis/process-discovery/MCP/UI scope.
