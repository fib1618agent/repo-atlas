# Implementation Plan: Code Intelligence Foundation

**Branch**: `001-code-intelligence-foundation` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-code-intelligence-foundation/spec.md`

## Summary

Build the provider-independent source-acquisition foundation (`Provider → Repository → Ref → Commit SHA → Snapshot → SnapshotFile`) that later AST/symbol/graph features will depend on. GitHub ships as the only working `ContentProvider`; the interface stays GitLab-ready. Bulk acquisition streams a `tar.gz` archive from GitHub's `codeload` endpoint through Cloudflare's native `DecompressionStream`, a hand-rolled sequential tar parser, and bounded-concurrency writes to R2; large repos checkpoint across multiple Cloudflare Queue messages. D1 holds all structured metadata (repository identity, refs, commits, snapshots, files, jobs); R2 holds only raw file bytes, content-addressed by hash. Everything is triggered by a new, isolated `createServerFn` (no change to `getRepositories` or any existing atlas route/component). No AST, symbol, graph, search, or UI work is in scope.

## Technical Context

**Language/Version**: TypeScript 5.8, Bun runtime (dev), Cloudflare Workers runtime (prod) — matches existing app, no change.

**Primary Dependencies**: `@tanstack/react-start` (`createServerFn`, reused pattern) · Cloudflare Workers platform primitives only for the new work — `DecompressionStream` (native, no library), D1 client (`env.DB` binding, no ORM), R2 client (`env.SNAPSHOTS` binding), Cloudflare Queues (`env.SNAPSHOT_QUEUE` binding). No new npm dependency is required for streaming/tar/gzip — all three are Workers-native platform APIs, not libraries.

**Storage**: Cloudflare D1 (new — structured metadata: `repositories`, `repository_refs`, `snapshots`, `snapshot_files`, `acquisition_jobs`) + Cloudflare R2 (new — raw file blobs, content-addressed) + local dev emulation via Wrangler/Miniflare (`wrangler d1`, `wrangler r2`, `wrangler queues`, mirroring the existing `FileSqliteAtlasCache`/memory-fallback local/prod parity pattern in `atlas-store.ts`). Existing `data/atlas.sqlite` (`sources`/`repositories`/`ai_notes`/`meta`) is untouched — a fully separate schema/database, no shared tables.

**Testing**: No test framework exists in the repo today (`bunx tsc --noEmit` is the only gate). This feature introduces the first automated tests as `NEEDS CLARIFICATION`-free additive infra: contract-level tests for tar parsing, idempotency, and snapshot lifecycle, run via `bun test` (Bun's built-in test runner — zero new dependency, matches Bun-first tooling already in use). See `quickstart.md` for the runnable acceptance scenarios per user story.

**Target Platform**: Cloudflare Workers (`cloudflare-module` Nitro preset, unchanged) for production; Bun/Node + Wrangler local emulation for development — same local/prod duality the existing cache layer already establishes.

**Project Type**: Single TanStack Start web app (existing structure) — this feature is additive server-side infrastructure within it, not a new project.

**Performance Goals**: No fixed request-latency SLA (this is developer/operator-triggered infra, not a user-facing path). Streaming pipeline must never hold a full decompressed repository in memory (SC-004); each queued unit of work must complete within a single Worker invocation's CPU budget (per `research/ARCHITECTURE_DECISION_GATE.md` §3, §Feasibility Ratification).

**Constraints**: 128 MB Worker isolate memory ceiling (binding constraint on buffering — mandates true streaming, never buffer-then-parse); 6 simultaneous in-flight R2 connections per invocation (write concurrency must be throttled); 64 MiB Worker bundle size (not directly relevant here — no WASM grammars ship in this feature); no git binary/persistent disk in production (rules out git-clone acquisition entirely, FR-014); queue delivery is at-least-once (every processing unit must be idempotent, FR-024).

**Scale/Scope**: Unbounded repository size via checkpointed multi-invocation acquisition (no fixed repo-size ceiling per spec Edge Cases); unbounded snapshot/file retention (no expiry in this feature, per Clarifications).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                             | Check                                                                                                                                                                                                                                                                                                                                                                                      | Status                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| I. Data Fidelity                      | Snapshot/file data is only ever written from a real GitHub archive/API response; nothing invented. Existing default-owner atlas dataset is untouched (separate DB, separate server fn).                                                                                                                                                                                                    | PASS                                                                              |
| II. Visualization-First, Data-Driven  | This feature has no UI and feeds no data into `AtlasScene`, catalogue, categories, or insights. `AtlasScene`/funnel geometry/link math are not touched.                                                                                                                                                                                                                                    | PASS (not applicable — feature is invisible to the visualization layer by design) |
| III. Server-Side Secrets & Resilience | `GITHUB_TOKEN` continues to be read server-side only, in the new content-acquisition server fn, exactly as `github-fetch.ts` does today. New D1/R2/Queue bindings are Wrangler-configured infra credentials, never exposed client-side. Local/prod parity follows the existing `atlas-store.ts` two-tier precedent (Miniflare-emulated D1/R2/Queues locally, real bindings in prod).       | PASS                                                                              |
| IV. Performance Budgets               | No per-frame/3D impact (feature doesn't touch `AtlasScene`). New caps introduced: per-invocation streaming (never full-repo-in-memory), throttled R2 write concurrency (≤6 in flight), queue-based checkpointing for large repos — all directly required by FR-015/FR-016/FR-017/FR-023 and justified in Technical Context above, not speculative.                                         | PASS                                                                              |
| V. Simplicity & Minimal Scope         | Strictly bounded to `sdd/01-foundation` + `sdd/02-source-snapshot` per spec's stated relationship to prior research; explicitly excludes AST/symbols/graph/search/UI (spec Out of Scope, all enforced below). No new npm dependency for the core pipeline (native Workers APIs only). Unbounded retention accepted rather than building a speculative cleanup policy (per Clarifications). | PASS                                                                              |

No violations. **Complexity Tracking is not needed.**

## Project Structure

### Documentation (this feature)

```text
specs/001-code-intelligence-foundation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── content-provider.md
│   ├── acquire-snapshot.functions.md
│   ├── snapshot-query.functions.md
│   └── d1-schema.sql
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── code-intel/                        # NEW — all Code Intelligence foundation code lives under this namespace
│   │   ├── domain/
│   │   │   ├── repository-identity.ts     # NEW — provider-qualified Repository/RepositoryRef/Commit value types (FR-001, FR-002)
│   │   │   └── snapshot.ts                # NEW — Snapshot/SnapshotFile/AcquisitionJob domain types + lifecycle status
│   │   ├── providers/
│   │   │   ├── content-provider.ts        # NEW — ContentProvider interface (FR-003): resolveRef, fetchArchive, fetchPaths
│   │   │   ├── metadata-provider.ts       # NEW — MetadataProvider interface (FR-003), documents existing github-fetch.ts as its GitHub implementation (no behavior change)
│   │   │   └── github-content-provider.ts # NEW — GitHub ContentProvider impl: ref resolution (Git Refs API), tar.gz archive fetch (codeload), incremental path fetch (Contents API) (FR-004, FR-012, FR-013)
│   │   ├── acquisition/
│   │   │   ├── tar-stream.ts              # NEW — dependency-free sequential tar entry parser over a ReadableStream (FR-017)
│   │   │   ├── archive-pipeline.ts        # NEW — fetch → DecompressionStream(gzip) → tar-stream → checkpointed R2 writes (FR-015, FR-016, FR-025)
│   │   │   ├── incremental-pipeline.ts    # NEW — per-path Contents API fetch for changed-files-only acquisition (FR-013)
│   │   │   └── content-address.ts         # NEW — SHA-256 content hashing + R2 key derivation (FR-018, FR-022)
│   │   ├── queue/
│   │   │   └── snapshot-worker.ts         # NEW — Cloudflare Queue consumer: one AcquisitionJob unit per invocation, idempotent by (commit_sha, checkpoint) (FR-023, FR-024, FR-026)
│   │   ├── persistence/
│   │   │   ├── d1-client.ts               # NEW — thin D1 query layer (repositories, refs, commits, snapshots, files, jobs)
│   │   │   └── r2-client.ts               # NEW — thin R2 get/put/head wrapper, throttled to ≤6 concurrent puts
│   │   └── snapshot.functions.ts          # NEW — createServerFn RPC surface: acquireSnapshot, getSnapshotStatus, listSnapshotFiles, getSnapshotFile, getRepositoryHistory (FR-005–FR-029, mirrors repositories.functions.ts pattern)
│   ├── repositories.functions.ts          # UNCHANGED — existing GitHub metadata ingestion, not modified (FR-039/FR-040)
│   ├── github-fetch.ts                    # UNCHANGED — existing metadata fetch, not modified; becomes the de facto MetadataProvider implementation by documentation only
│   ├── github-url.ts                      # UNCHANGED
│   ├── atlas-errors.ts                    # EXTENDED (additive only) — new AtlasErrorCode variants for snapshot/acquisition failures (e.g. REF_NOT_FOUND, ARCHIVE_UNAVAILABLE, SNAPSHOT_FAILED), existing codes/messages untouched
│   └── storage/
│       └── atlas-store.ts                 # UNCHANGED — existing repo-metadata cache untouched; new D1/R2 clients are a fully separate module, not a change to AtlasCache
├── routes/                                 # UNCHANGED — no new routes; this feature has no visitor-facing UI (Assumptions)
└── components/                             # UNCHANGED

wrangler.toml                               # NEW — first Cloudflare bindings config in this repo: [[d1_databases]], [[r2_buckets]], [[queues.producers/consumers]] (none exist today)
data/
└── code-intel-schema.sql                   # NEW — D1 schema (repositories, repository_refs, commits, snapshots, snapshot_files, acquisition_jobs), fully separate from data/schema.sql
tests/
├── contract/
│   └── code-intel/                         # NEW — tar-stream parsing, idempotent queue replay, ref-resolution failure shape
└── integration/
    └── code-intel/                         # NEW — end-to-end acquire→persist→retrieve against a small real public repo (quickstart.md scenarios)
```

**Structure Decision**: Single-project TanStack Start app (existing layout, unchanged). All new code is additive under `src/lib/code-intel/`, a new namespace parallel to (not replacing) the existing `src/lib/*` server-function modules. No existing file's behavior changes; `atlas-errors.ts` gets additive new error codes only. This directly follows the constitution's Principle V guidance to extend existing primitives (`createServerFn`, the `AtlasCache`-style pluggable-backend pattern) rather than introduce a parallel architecture style.

## Existing Code Reused

| Existing asset                                                                                                      | Reused as                                                                                                                                         | Notes                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createServerFn` RPC pattern (`repositories.functions.ts`)                                                          | Template for `snapshot.functions.ts`'s `acquireSnapshot`/`getSnapshotStatus`/etc.                                                                 | Same `.validator().handler()` shape; new module, zero change to the existing one (research §11 seam)                                                               |
| `mapWithConcurrency` (`github-fetch.ts:234-253`)                                                                    | Bounded-concurrency primitive for incremental per-path fetches and throttled R2 writes (≤6 in flight)                                             | Imported, not duplicated                                                                                                                                           |
| `AtlasError`/`atlasErrorMessage`/`SourceFailure` (`atlas-errors.ts`)                                                | Extended with new error codes for ref-not-found, archive-unavailable, snapshot-failed, checkpoint-stalled                                         | Additive union members only; existing codes/messages untouched                                                                                                     |
| `serverAtlasConfig()` two-tier env-var-with-default pattern (`atlas-config.ts`)                                     | Template for a new `codeIntelConfig()` (max concurrent R2 writes, checkpoint unit size, queue batch size)                                         | New function, same style, no shared state with existing config                                                                                                     |
| `AtlasCache`'s memory/SQLite dual-backend + `canUseSqlite()`-style environment detection (`storage/atlas-store.ts`) | Pattern (not code) reused for a `canUseD1()`/`canUseR2()`-equivalent local/prod capability check in `persistence/d1-client.ts` and `r2-client.ts` | D1/R2 have official Wrangler/Miniflare local emulation, so local dev talks to the same D1/R2 API shape as prod (closer parity than today's memory-vs-SQLite split) |
| `source_key` addressing concept (`data/schema.sql`)                                                                 | Informs (not reused directly) the `(provider, owner, name)` composite key on the new `repositories` D1 table                                      | New schema is intentionally decoupled from `data/atlas.sqlite`; no FK or shared table between the two databases                                                    |

## Architectural Integration Points

1. **No shared runtime state with the existing atlas.** The only integration point between this feature and the existing app is "both are TanStack Start server functions in the same deployed Worker" — there is no shared cache, no shared database, no shared React Query key (constitution Principle II's "one React Query key" requirement applies to atlas _views_, which this feature has none of).
2. **`snapshot.functions.ts` is the sole entry point.** All later features (a future AST-extraction trigger, per spec Clarifications) call `acquireSnapshot`/`getSnapshotStatus`/etc.; nothing calls into `code-intel/` internals directly.
3. **`wrangler.toml` is new.** Today's `vite.config.ts` configures the Nitro `cloudflare-module` preset but the repo has no `wrangler.toml` at all (verified: no file matching `wrangler*` at repo root) — D1/R2/Queues bindings must be declared for both local (`wrangler dev`/Miniflare) and deployed environments. This is new deployment-config surface, called out explicitly since it's the one part of this feature that isn't purely additive TypeScript.
4. **Two independent databases.** `data/atlas.sqlite` (existing, repo-metadata cache) and the new D1 database (`code-intel-schema.sql`) never join or share a connection; a repository known to both is linked only by matching `(provider, owner, name)` values a caller supplies, per spec User Story 1 Acceptance Scenario 3 ("without requiring the existing atlas code to change").

## Provider Abstraction Changes

- Two new interfaces per `research/ARCHITECTURE_DECISION_GATE.md` §1 Option B (ratified): `MetadataProvider` (documents the existing `github-fetch.ts` capability retroactively, zero code change) and `ContentProvider` (new — `resolveRef(repo, ref): Promise<CommitSha>`, `fetchArchive(repo, sha): ReadableStream<ArchiveEntry>`, `fetchPaths(repo, sha, paths): AsyncIterable<FileContent>`).
- `github-content-provider.ts` is the only concrete `ContentProvider` in this feature (FR-004). A `gitlab-content-provider.ts` is explicitly **not** created — the interface is validated for GitLab-readiness by construction (no GitHub-specific field — e.g. no raw GitHub API response shape — leaks into `ContentProvider`'s method signatures or return types) but no second implementation ships.
- Code Intelligence components (the queue worker, the snapshot server functions) depend only on `ContentProvider`, never on `github-content-provider.ts` directly or on any raw GitHub REST/archive response shape (FR-002, FR-003).

## Repository/Ref/Commit Domain Model

`src/lib/code-intel/domain/repository-identity.ts`:

- `RepositoryIdentity = { provider: "github" | "gitlab"; owner: string; name: string }` — provider-qualified per FR-001; two repos with identical `owner`/`name` but different `provider` are distinct values with no shared key.
- `RepositoryRef = { repository: RepositoryIdentity; ref: string }` — a mutable pointer (branch/tag/already-known-SHA) as submitted by a caller; never persisted as a snapshot key.
- `CommitSha = string & { readonly __brand: "CommitSha" }` — a nominal/branded type so a bare ref string can never be passed where a resolved SHA is required at the type level, directly enforcing FR-006 ("MUST NOT treat a branch/tag name as a substitute for a commit SHA anywhere... in storage").
- Ref resolution (`ContentProvider.resolveRef`) is the only function permitted to produce a `CommitSha` value.

## Snapshot Model

`src/lib/code-intel/domain/snapshot.ts`. Three distinct identities, per `data-model.md`/`contracts/d1-schema.sql` (authoritative — restated here, not altered):

- **Logical snapshot identity** = `(repository, commitSha)`. Not a row of its own — the thing a caller means by "the snapshot for this repo at this SHA." FR-008 ("requesting a snapshot for a repository+SHA pair that already has a completed snapshot returns the existing snapshot rather than creating a duplicate") is a statement about _this_ identity, not about the `snapshots` table's row key.
- **Acquisition attempt identity** = `(repository, commitSha, attemptNumber)`. This is the actual `snapshots` row key (`UNIQUE(repository_id, commit_sha, attempt_number)` in `contracts/d1-schema.sql`). Multiple attempts MAY exist for the same logical snapshot — e.g. one `failed` attempt followed by one `completed` attempt (requirement 3, 9).
- **Completed snapshot identity** = the unique attempt, if any, for a given logical snapshot whose `status = "completed"`. At most one such attempt may exist per `(repository, commitSha)` at any time (requirement 4) — enforced by application logic in the resolve step below (D1's `UNIQUE` constraint alone permits multiple `failed`/`in_progress` attempts plus one `completed` one for the same key; it does not by itself forbid two `completed` attempts, so the resolve-or-create step, not the schema, is what guarantees requirement 4).

**Terminology (used precisely, throughout this plan and tasks.md)**:

- **"Snapshot acquisition attempt"** — a `snapshots` row, identified by `(repository, commitSha, attemptNumber)`. This is the entity described in the three bullets above.
- **"Acquisition attempt log"** — a row in the separate `acquisition_attempts` observability table (FR-035; see D1 Persistence Requirements and Observability below). Relationship: **one snapshot acquisition attempt has at most one acquisition attempt log row**, created at the same moment as the attempt and updated (never duplicated) at that attempt's terminal state. A request that reuses an existing completed snapshot creates **neither** a new attempt **nor** a new log row. A retry/resume of an in-progress attempt updates that attempt's existing log row, never inserts a second one. The log is purely operational/observability data — it is never read as evidence and never appears in `getRepositoryHistory` (see Incremental Synchronization Foundation below).

Fields:

- `Snapshot = { repository: RepositoryIdentity; commitSha: CommitSha; attemptNumber: number; status: "pending" | "in_progress" | "completed" | "failed"; acquisitionMode: "bulk_archive" | "incremental_api"; createdAt; completedAt? }` — one row per snapshot acquisition attempt; `status` gates whether _this attempt_ is consumable as evidence (FR-009).
- `SnapshotFile = { snapshotId; path: string; sizeBytes: number; contentHash: string; r2Key: string }` — scoped to one attempt's `snapshotId` (the D1 row id of that attempt), retrievable independently by `(snapshotId, path)` or `(snapshotId, contentHash)` (FR-018, FR-019). Files belonging to a non-completed attempt are never surfaced under the logical snapshot's identity (see Acquisition Workflow).
- `AcquisitionJob = { snapshotId; unitIndex: number; status: "pending" | "retrying" | "failed" | "completed"; checkpointCursor: string | null; retryCount: number; failureReason?: string }` — one row per queued unit of work, scoped to one attempt's `snapshotId`; `checkpointCursor` (tar-stream byte offset or last-written path) is what makes a retry of _that attempt_ resumable without restarting (FR-025).
- Finalization rule (FR-010, FR-027, requirement 5): an attempt's `Snapshot.status` transitions to `completed` only inside a single D1 transaction that (a) verifies every `AcquisitionJob` for that attempt is `completed`, and (b) verifies no other attempt for the same `(repository, commitSha)` is already `completed` — enforced in `snapshot-worker.ts`'s last-unit handler, never inferred client-side. Once set, `completed` is terminal for that attempt's row: no code path updates a `completed` attempt's `status`, `snapshot_files`, or `acquisition_jobs` rows again (requirement 5, 8).

## D1 Persistence Requirements

Full DDL in `contracts/d1-schema.sql`. Summary:

| Table                  | Purpose                                                                                                                                                                                                                   | Key constraints                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repositories`         | Provider-qualified repository identity                                                                                                                                                                                    | `UNIQUE(provider, owner, name)` — FR-001, FR-033                                                                                                                                                                                                                                                                                                                                                                       |
| `repository_refs`      | Last-known ref→SHA resolution (cache, not authoritative)                                                                                                                                                                  | `(repository_id, ref)`; always re-resolved live, never trusted stale for a new acquisition — FR-005                                                                                                                                                                                                                                                                                                                    |
| `snapshots`            | One row per acquisition attempt                                                                                                                                                                                           | `UNIQUE(repository_id, commit_sha, attempt_number)` per `data-model.md`/`contracts/d1-schema.sql` — a logical snapshot (`repository_id, commit_sha`) MAY have multiple attempt rows (failed/in-progress), but application logic (Acquisition Workflow, below) guarantees at most one `completed` attempt per logical snapshot (FR-008); `status` CHECK constraint enumerates the 4 states; `acquisition_mode` — FR-031 |
| `snapshot_files`       | File inventory                                                                                                                                                                                                            | `UNIQUE(snapshot_id, path)`; index on `content_hash` for cross-snapshot de-dup lookup — FR-018, FR-022                                                                                                                                                                                                                                                                                                                 |
| `acquisition_jobs`     | Queue unit tracking                                                                                                                                                                                                       | `UNIQUE(snapshot_id, unit_index)`; `status` distinguishes retrying/failed/completed — FR-026; `checkpoint_cursor`, `retry_count`, `failure_reason` — FR-025, FR-037, FR-038                                                                                                                                                                                                                                            |
| `acquisition_attempts` | **Acquisition attempt log** (operational observability only — distinct from a snapshot acquisition attempt; see Snapshot Model terminology above), at most one row per snapshot acquisition attempt, never per queue unit | repository, provider, commit_sha, acquisition_mode, started_at, ended_at, status, duration_ms — FR-035. No unique constraint in the schema (see Observability below for the idempotent-write pattern this requires)                                                                                                                                                                                                    |

All tables are new; none modify or reference `data/schema.sql`'s tables. Idempotency is enforced at the D1 layer via `INSERT ... ON CONFLICT DO NOTHING`/`DO UPDATE` keyed by the `UNIQUE` constraints above, not application-level pre-checks (closes the FR-024 duplicate-delivery requirement even under concurrent duplicate queue messages).

## R2 Object Organization

- Key scheme: `snapshots/{provider}/{owner}/{name}/{commit_sha}/{content_hash}` — derivable purely from `(repository, commitSha, contentHash)` with no separate lookup table required for addressing (FR-022), while still namespacing by snapshot so per-snapshot listing/cleanup (a future feature) stays possible.
- Content-addressing by `content_hash` (SHA-256 of file bytes) means two files with identical content, even across different snapshots or repositories, share one R2 object — the DB row's `r2_key` column points at it, achieving de-duplication as an explicit FR-022 "MAY" without any extra bookkeeping table.
- Writes are `put()`-only, never overwritten (content-addressing makes any two writes to the same key byte-identical by construction); reads are single-key `get()`s, satisfying FR-019's "independent of the rest of the snapshot" requirement directly (no multi-object read needed to serve one file).
- Write concurrency throttled to ≤6 simultaneous in-flight `put()`s per invocation via `mapWithConcurrency` (research Feasibility Ratification's documented R2 connection limit).

## Acquisition Workflow

1. Caller invokes `acquireSnapshot({ repository, ref })` (`snapshot.functions.ts`).
2. `ContentProvider.resolveRef` resolves `ref` → `CommitSha` (FR-005); on failure, a distinguishable `REF_NOT_FOUND` `AtlasError` is thrown, no `snapshots` row (no acquisition attempt) is created (FR-007). `resolveRef` additionally validates its own return value against a 40-character-hex SHA shape before returning it — a runtime check, not just the compile-time `CommitSha` brand (SC-002 defense-in-depth). This yields the **logical snapshot identity** `(repository, commitSha)` that every following step resolves against.
3. **Resolve the logical snapshot** — query all `snapshots` rows for `(repository_id, commit_sha)` across every `attempt_number`:
   - If a `completed` attempt exists, return it immediately as the **completed snapshot** (requirement 4, 6; FR-008; idempotent re-request, no re-acquisition, no new attempt row created — spec Edge Cases "same commit SHA requested a second time").
   - Else if an `in_progress` (or `pending`) attempt exists, join it — return that attempt's id/status rather than starting a second one (spec Edge Cases, concurrent-request case). This is still attempt-scoped, not a new attempt.
   - Else (no attempt exists, or every existing attempt is `failed`): **select or create the acquisition attempt** — proceed to step 4.
4. Determine `acquisitionMode` for the new attempt **first** — `bulk_archive` if no prior _completed_ snapshot exists for this repository (any commit SHA), `incremental_api` if one does and changed paths can be identified (FR-012, FR-013) — then create the new attempt row in one call that takes the determined mode as an explicit parameter: `createAcquisitionAttempt(repositoryId, commitSha, acquisitionMode)`, computing `attempt_number = (MAX(attempt_number) for this repository_id+commit_sha) + 1` (or `1` if none exist) and persisting `acquisition_mode` on the new row immediately (FR-031 — mode is never added after the fact). At the same step, insert one **acquisition attempt log** row (`acquisition_attempts`: `repository_id`, `commit_sha`, `provider`, `acquisition_mode`, `started_at`, `status="in_progress"`) — see Observability below for the full writer lifecycle. Enqueue the first `AcquisitionJob` unit scoped to this attempt's `snapshotId`, transition the attempt to `in_progress`. Requirement 7 and 9: this is the mechanism by which a later attempt may become the completed snapshot after earlier attempts for the same logical snapshot failed — each attempt is independent, and only one may ever reach `completed` (enforced at finalization, step 6).
5. Cloudflare Queue delivers unit(s) to `snapshot-worker.ts`, each message scoped to one attempt's `snapshotId`; each unit processes a bounded slice (see Streaming Archive Processing below), writes files to R2 + rows to D1 under that attempt, records/advances its `checkpoint_cursor`, and either completes or enqueues the next unit for the same attempt. Retrying an incomplete attempt only ever writes to that attempt's own rows — it cannot reach or mutate a different, already-`completed` attempt's rows for the same logical snapshot (requirement 8).
6. When the last unit for an attempt reports completion, the worker finalizes: in a single D1 transaction, verify all `AcquisitionJob`s for that attempt are `completed` **and** verify no other attempt for the same `(repository_id, commit_sha)` already holds `status = "completed"`, then set this attempt's `snapshots.status = "completed"` (FR-027, requirement 4, 5). Immediately after, update this attempt's **acquisition attempt log** row (`status="completed"`, `ended_at`, `duration_ms`) — see Observability for the idempotent lookup pattern. Any unit reporting permanent failure instead sets this attempt's `snapshots.status = "failed"`, updates the log row to `status="failed"`/`ended_at`/`duration_ms` the same way, and stops further units for this attempt (FR-009; edge case: never observable as complete after a real failure) — the logical snapshot remains eligible for a future new attempt (step 4).
7. `getSnapshotStatus`/`listSnapshotFiles`/`getSnapshotFile` take an attempt's `snapshotId` (obtained from step 3's resolve or step 4's create) and read that attempt's D1/R2 data directly; a non-`completed` attempt's files are not exposed as retrievable evidence (FR-009).

## Streaming Archive Processing

- `archive-pipeline.ts`: `fetch(codeload tar.gz URL)` → pipe through `DecompressionStream("gzip")` (native, per Feasibility Ratification) → `tar-stream.ts`'s sequential 512-byte-header reader, which emits one `ArchiveEntry {path, size, contentStream}` at a time without buffering the whole archive (FR-015, FR-016, FR-017).
- Each `ArchiveEntry`'s content is hashed (`content-address.ts`) and `put()` to R2 as it streams, never fully materialized in the Worker's heap beyond one entry at a time — directly satisfies SC-004 ("never requiring the full decompressed repository to be held in memory").
- **Checkpointing**: the pipeline tracks a cursor (byte offset into the decompressed tar stream, or equivalently "last fully-written entry index") and, when either a configurable file-count or elapsed-CPU-time budget is reached (the exact threshold is explicitly flagged `SPIKE REQUIRED` by research and left as an implementation-phase tuning constant, not hardcoded here), stops, persists the cursor into `acquisition_jobs.checkpoint_cursor`, and enqueues a follow-up `AcquisitionJob` unit rather than continuing past the invocation's CPU budget.
- **Resumption**: a follow-up unit cannot literally "seek" into a live HTTP stream from a byte offset (tar/gzip streaming doesn't support arbitrary resume mid-decompression); the pragmatic approach ratified here is **re-fetch-and-fast-forward** — the retried/continuation unit re-requests the same archive URL (content is immutable, addressed by `commit_sha`) and skips already-`completed` entries (tracked by path in `snapshot_files`, checked via the D1 idempotent-insert) until it reaches the checkpoint, then continues writing new entries. Resumption is always scoped to the same **acquisition attempt** (`snapshotId`, i.e. the same `attempt_number`) that owns the checkpoint — a retried unit re-fetches and fast-forwards its own attempt's already-written `snapshot_files` rows, never another attempt's rows, and never a `completed` attempt's rows (requirement 8: retrying an incomplete attempt cannot mutate a completed snapshot, since a completed attempt has no pending/retrying `AcquisitionJob` left to retry). This is CPU-cheap (skipping is just discarding already-decoded tar entries, not re-uploading them to R2) and keeps every unit idempotent by construction (FR-024) rather than relying on precise byte-offset resume. This detail is called out explicitly since it's a concrete implementation decision the plan makes that the research left open.

## Queue/Job Boundaries

- One `AcquisitionJob` row = one Cloudflare Queue message = one Worker invocation's worth of bounded archive-processing work (a checkpoint-to-checkpoint slice), per FR-023.
- `incremental_api` mode acquisitions (small, changed-paths-only) typically complete in a single unit; `bulk_archive` mode for a large repository may span many units, each a separate queue message referencing the same `snapshot_id` and an incrementing `unit_index`.
- Queue consumer (`snapshot-worker.ts`) is the only writer of `snapshots.status` and `acquisition_jobs.status` — no other code path mutates snapshot lifecycle state, keeping the finalization invariant (FR-027) enforceable in one place.

## Idempotency and Retry Strategy

Three distinct levels of retry, corresponding to the three identities in Snapshot Model above:

- **Message-level idempotency** (FR-024, `snapshot_id` = one acquisition attempt's D1 row id): every D1 write in the queue worker uses `INSERT ... ON CONFLICT (unique key) DO NOTHING` (for `snapshot_files`, keyed on `(snapshot_id, path)`) or `DO UPDATE` guarded by a monotonic check (for `acquisition_jobs.status`, never regressing `completed` → `retrying`). A duplicate-delivered message reprocesses the same archive slice _for the same attempt_ and re-attempts the same R2 `put()`s (safe — content-addressed, byte-identical) and the same D1 inserts (safe — conflict-ignored), producing identical end state for that attempt (SC-005).
- **Unit-level retry** (FR-011, FR-026, within one attempt): a unit that throws (network failure, transient R2/D1 error) is retried by the Cloudflare Queue's native at-least-once redelivery, up to a configured max attempt count; that attempt's `acquisition_jobs.retry_count`/`status="retrying"` is updated on each try. Exceeding the max marks that attempt's job `status="failed"` and the failure is not silently retried forever (FR-026's "no ambiguity between still-trying and given-up"). This never touches a different attempt's rows, and can never touch a `completed` attempt's rows (requirement 8), since a completed attempt has no outstanding `pending`/`retrying` job left to redeliver.
- **Attempt-level retry** (FR-011, requirement 7, 9): re-invoking `acquireSnapshot` for a logical snapshot `(repository, commit_sha)` whose only existing attempt(s) are `failed` runs the resolve step (Acquisition Workflow step 3) again, finds no `completed`/`in_progress` attempt, and creates a **new** acquisition attempt row (`attempt_number` incremented — not a mutation of the failed one) plus its own new acquisition attempt log row (Observability), whose acquisition starts a fresh job sequence. The failed attempt's partial `snapshot_files`/`acquisition_jobs` rows — and its now-terminal `acquisition_attempts` log row — are left as historical/diagnostic records (not deleted — consistent with the feature's unbounded-retention posture) but are never referenced by the new attempt's finalization check (Snapshot Finalization, above) except to confirm they are not `completed`. If this new attempt succeeds, it becomes the completed snapshot for the logical `(repository, commit_sha)` (requirement 9); if a `completed` attempt already exists by the time this new attempt would finalize (a concurrent attempt got there first), the finalization guard (requirement 4) prevents this attempt from also completing.

## Checkpoint/Resume Strategy

Covered in detail under Streaming Archive Processing above (re-fetch-and-fast-forward against the immutable, SHA-addressed archive URL, skip-already-written-entries via idempotent D1 lookups, advance `checkpoint_cursor` per unit). Restated here as a boundary: checkpoint granularity (file-count vs. CPU-time budget, and the exact threshold) is explicitly deferred to implementation/tasks phase per research's `SPIKE REQUIRED` flag — this plan fixes the _mechanism_, not the _constant_.

## Snapshot Finalization

An **acquisition attempt** becomes the **completed snapshot** for its logical `(repository, commitSha)` **only** when: (a) every enqueued `AcquisitionJob` unit for that attempt reports `status="completed"`, (b) no unit for that attempt is in `pending`/`retrying`/`failed`, and (c) no other attempt for the same `(repository_id, commit_sha)` already holds `status="completed"` (requirement 4). This check runs inside a single D1 transaction in the unit that believes it is the last one for its attempt, re-querying all sibling job rows for that attempt _and_ all sibling attempt rows for the same logical snapshot before flipping this attempt's `snapshots.status` — preventing two races: two units of the same attempt each thinking they're "last" (guarded by `WHERE status != 'completed'` on the update, making a second attempt a no-op), and two different attempts of the same logical snapshot both finalizing concurrently (guarded by the same-transaction check against sibling attempts' status). Once an attempt is `completed`, it is immutable — no later step updates its `status`, `snapshot_files`, or `acquisition_jobs` rows (requirement 5). Partial/failed attempts are never exposed by `getSnapshotStatus` as anything other than their true `pending`/`in_progress`/`failed` state (FR-010, SC-006).

## Incremental Synchronization Foundation

- `getRepositoryHistory(repository)` (in `snapshot.functions.ts`) queries `snapshots` **filtered to `status = "completed"`** (i.e. one row per logical snapshot that has a completed attempt — never a `failed`/`in_progress` attempt, and never more than one row per `commit_sha` by construction of the finalization guard), ordered by `completed_at DESC` for a given `repository_id`, returning `(commit_sha, completed_at)` pairs — directly satisfies FR-028/FR-029 and User Story 7 without this feature computing any diff itself. Failed/abandoned attempts are attempt-identity noise, not part of a repository's snapshot _history_ as this query defines it.
- `acquireSnapshot` internally calls this same completed-only query to decide `bulk_archive` vs `incremental_api` mode (step 4 of Acquisition Workflow) — the _decision_ lives in this feature (required for FR-013 to be usable at all), but the _diff computation_ for incremental mode is delegated to the GitHub Compare API (`ContentProvider.fetchPaths` is fed a changed-path list obtained via GitHub's `compare/{base}...{head}` endpoint), not built as a generic diff engine — keeping scope to "foundation," not a full sync engine. Because the prior-snapshot lookup only ever considers completed attempts, an in-progress or failed attempt at a newer commit can never be mistaken for the sync baseline.

## Security Boundaries

- `GITHUB_TOKEN` stays server-side only, read inside `github-content-provider.ts` exactly as `github-fetch.ts` does today (Principle III, FR-032). No snapshot/file/job D1 row ever stores a credential.
- Cross-provider isolation (FR-033): `repositories.UNIQUE(provider, owner, name)` at the schema level makes a GitHub/GitLab collision structurally impossible, not just a convention; every downstream FK (`snapshots.repository_id`, etc.) inherits this isolation transitively.
- Scope restriction (FR-034): `github-content-provider.ts` only calls public, unauthenticated-scope GitHub endpoints (public repo archive/contents/refs) — no private-repo or OAuth code path is introduced, matching the existing app's public-only posture.
- New Wrangler bindings (D1/R2/Queues) are declared in `wrangler.toml` and provisioned via Cloudflare account credentials outside the app; no binding identifier or secret is ever sent to the client bundle (same boundary the existing `VITE_*` prohibition already enforces).

## Observability

**Acquisition attempt log writer lifecycle** (FR-035, resolves G1 from the `/speckit-analyze` findings):

- **Created**: exactly once, inside `acquireSnapshot`, at the same moment a new snapshot acquisition attempt is created (plan.md Acquisition Workflow step 4) — `INSERT INTO acquisition_attempts (repository_id, commit_sha, provider, acquisition_mode, started_at, status) VALUES (..., 'in_progress')`. Never inserted on the reuse-of-completed-snapshot path (step 3) — no new attempt, no new log row, per the Snapshot Model terminology section's 1:1 relationship.
- **Updated at terminal state**: inside `snapshot-worker.ts`'s finalization (success, step 6) or permanent-failure handling (step 6), immediately after the owning attempt's `snapshots.status` is set. Because this table has no `attempt_number`/FK column back to `snapshots` (schema fixed by `contracts/d1-schema.sql`), the row is located by `UPDATE acquisition_attempts SET status = ?, ended_at = ?, duration_ms = ? WHERE repository_id = ? AND commit_sha = ? AND status NOT IN ('completed', 'failed')`. At most one such row can match at a time — the same invariant that guarantees at most one non-terminal `snapshots` attempt per logical snapshot (`resolveLogicalSnapshot`) guarantees at most one non-terminal log row. `duration_ms` is computed (`ended_at - started_at`) and persisted at this write, not left for a caller to derive.
- **Idempotent under retry**: a redelivered/retried finalization or failure-handling unit re-runs the same guarded `UPDATE`; the first execution flips the row to a terminal status, so every subsequent execution's `WHERE status NOT IN (...)` matches zero rows and is a no-op — no duplicate log rows, no double-counted duration, matching the same guard pattern already used for `snapshots.status` finalization (FR-027).
- **Duplicate top-level requests**: a second concurrent `acquireSnapshot` call for a logical snapshot that already has an `in_progress` attempt joins that attempt (step 3) rather than creating a new one — so it never creates a second log row either.

**Processing counters** (FR-036, resolves G2):

- `acquisition_jobs.files_processed`/`bytes_processed` are **set, not incremented**, at the end of each unit: `files_processed = COUNT(*)` and `bytes_processed = SUM(size_bytes)` over this attempt's `snapshot_files` rows. Recomputing from the already-idempotent `snapshot_files` table (rather than an incrementing counter) makes this inherently retry-safe — a redelivered unit recomputes the same correct total regardless of how many times it re-executed, and a file whose R2 `put()` failed (so no `snapshot_files` row was ever inserted for it) never contributes to the count.
- `acquisition_jobs.retry_count` + `failure_reason` (free-text, populated from the caught error's `AtlasErrorCode` where applicable) — FR-037.
- `acquisition_jobs.checkpoint_cursor` plus a derived "units completed / units required (if known)" read via `getSnapshotStatus` — FR-038. ("units required" is only known once bulk acquisition completes deciding its own unit count, since checkpointing is dynamic; `getSnapshotStatus` reports "units completed so far" unconditionally and "estimated total" only when determinable.)

No new logging/metrics _service_ is introduced (no Sentry/Datadog wiring) — this is out of scope; observability here means "queryable via D1," matching the feature's server-fn-only, no-new-infra-beyond-Cloudflare posture.

## Testing Strategy

- **First automated tests in this repository.** `bun test` (Bun's built-in runner, zero new dependency) is adopted for this feature only; existing app code remains covered solely by `bunx tsc --noEmit` as before (no retroactive test-writing for unrelated existing code, per Principle V minimal scope).
- **Contract tests** (`tests/contract/code-intel/`): `tar-stream.ts` against fixture tar.gz byte sequences (including entries split across chunk boundaries — the specific correctness risk research flags); D1 idempotent-insert behavior for duplicate `snapshot_files`/`acquisition_jobs` writes (SC-005); ref-resolution failure shape (FR-007); `resolveRef`'s runtime SHA-shape guard rejecting a non-SHA return value before it reaches any D1 write (SC-002, resolves G3 from `/speckit-analyze`).
- **Integration tests** (`tests/integration/code-intel/`): the seven `quickstart.md` scenarios, run against Wrangler's local D1/R2/Queues emulation and one small real public GitHub repository (matching SC-003's "at least one real public repository" requirement) — acquire twice → byte-identical (SC-003); query mid-acquisition → non-complete status (SC-006); simulate duplicate queue delivery → identical resulting state (SC-005); separate-invocation retrieval → unchanged metadata/content (SC-008).
- **Regression protection for the existing atlas** (FR-039/FR-040, SC-009): no new test rewrites or is expected to touch `specs/001-dynamic-github-sources`' existing acceptance criteria; `bunx tsc --noEmit` continues to be run across the whole repo so a type-level break in shared files (there should be none — only `atlas-errors.ts` gains additive types) would still be caught.
- **Polish-phase audit checks** (folded into the existing diff-review task, not new test infrastructure — resolves G4/G5): confirm no `child_process` usage, no git-binary invocation, and no production git-clone path anywhere under `src/lib/code-intel/` (FR-014); confirm no D1 table/row stores a credential/token value (FR-032); confirm every `snapshot_files` row carries provenance back to provider/repository/commit/snapshot (FR-030); confirm `github-content-provider.ts` calls only public, unauthenticated-scope GitHub endpoints (FR-034).

## Migration/Backward Compatibility

- **No migration.** This is entirely new schema (`code-intel-schema.sql`) and new storage (D1, R2) — nothing existing is altered, renamed, or backfilled. `data/schema.sql` and `data/atlas.sqlite` are untouched.
- **No behavior change** to `getRepositories`, `AtlasScene`, catalogue/categories/insights routes, or the existing error catalog's existing codes (FR-039, FR-040) — verified by this plan touching zero files those paths depend on except an additive-only extension to `atlas-errors.ts`'s discriminated union (new variants, no existing variant removed/renamed).
- **Deployment prerequisite, not a migration**: `wrangler.toml` must be created and a D1 database / R2 bucket / Queue must be provisioned in the Cloudflare account before this feature can run in any environment (local emulation still requires `wrangler.toml` to exist, even though it needs no real Cloudflare account). This is a one-time setup step captured in `quickstart.md`, not a data migration.

## Risks and Mitigations

| Risk                                                                                                                                              | Mitigation                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exact checkpoint threshold (file count / CPU time) unknown until implementation                                                                   | Mechanism (checkpoint + re-fetch-and-fast-forward resume) is fixed now; the numeric constant is a tunable, tested against a real repo in the integration test, not hardcoded speculatively                                                                               |
| Tar entries split across `DecompressionStream` chunk boundaries — a real streaming-correctness hazard                                             | Dedicated contract test fixtures specifically constructed to split headers/content across chunk boundaries (flagged directly in research as the correctness risk to guard)                                                                                               |
| No `wrangler.toml` exists yet — first Cloudflare-infra-as-config in this repo                                                                     | Scoped explicitly as a Project Structure / Migration deliverable, not left implicit; local Miniflare emulation validated in quickstart before relying on a real Cloudflare account                                                                                       |
| R2/D1 local emulation drifting from production semantics                                                                                          | Both have official Wrangler-native local emulation (unlike today's memory-only-in-prod SQLite split, this is _closer_ parity, not worse) — flagged and reused rather than re-derived                                                                                     |
| Two "last unit" queue messages racing to finalize a snapshot (within one attempt, or across two concurrent attempts of the same logical snapshot) | D1 transactional finalization with a `WHERE status != 'completed'` guard, checked both against the attempt's own prior status and against sibling attempts for the same `(repository_id, commit_sha)`, makes both races safe by construction, not by ordering assumption |
| Bloating `atlas-errors.ts`'s shared error catalog with snapshot-specific codes affecting the existing UI's error handling                         | New codes are additive union members; existing UI components pattern-match on specific codes they know about and fall through for unknown ones today (existing behavior, unchanged) — verified by not modifying any UI component in this feature                         |

## Complexity Tracking

Not applicable — no Constitution Check violations.
