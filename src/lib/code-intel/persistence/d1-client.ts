import type {
  CommitSha,
  Provider,
  RepositoryIdentity,
} from "../domain/repository-identity";
import type {
  AcquisitionJobStatus,
  AcquisitionMode,
  Snapshot,
  SnapshotStatus,
} from "../domain/snapshot";
import { getD1, type D1DatabaseLike } from "./cloudflare-env";

/**
 * Thin D1 query layer — no ORM. Every function takes an explicit `db`
 * parameter (defaults to `getD1()`) so tests can inject a SQLite-compatible
 * stand-in without needing a live Cloudflare account (D1 is SQLite-compatible,
 * so `bun:sqlite` wrapped in the same `D1DatabaseLike` shape is a faithful test double).
 */

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// repositories (US1, FR-001, FR-002)
// ---------------------------------------------------------------------------

export async function getOrCreateRepository(
  identity: RepositoryIdentity,
  db: D1DatabaseLike = getD1(),
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO repositories (provider, owner, name, created_at) VALUES (?, ?, ?, ?)
              ON CONFLICT (provider, owner, name) DO NOTHING`,
    )
    .bind(identity.provider, identity.owner, identity.name, nowIso())
    .run();
  const row = await db
    .prepare(
      `SELECT id FROM repositories WHERE provider = ? AND owner = ? AND name = ?`,
    )
    .bind(identity.provider, identity.owner, identity.name)
    .first<{ id: number }>();
  if (!row)
    throw new Error(
      "getOrCreateRepository: row missing immediately after insert",
    );
  return row.id;
}

export async function getRepositoryIdentity(
  repositoryId: number,
  db: D1DatabaseLike = getD1(),
): Promise<RepositoryIdentity> {
  const row = await db
    .prepare(`SELECT provider, owner, name FROM repositories WHERE id = ?`)
    .bind(repositoryId)
    .first<{ provider: Provider; owner: string; name: string }>();
  if (!row)
    throw new Error(
      `getRepositoryIdentity: no repository with id ${repositoryId}`,
    );
  return { provider: row.provider, owner: row.owner, name: row.name };
}

// ---------------------------------------------------------------------------
// repository_refs (US2, FR-005)
// ---------------------------------------------------------------------------

export async function upsertResolvedRef(
  repositoryId: number,
  ref: string,
  sha: CommitSha,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO repository_refs (repository_id, ref, resolved_commit_sha, resolved_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (repository_id, ref) DO UPDATE SET resolved_commit_sha = excluded.resolved_commit_sha, resolved_at = excluded.resolved_at`,
    )
    .bind(repositoryId, ref, sha, nowIso())
    .run();
}

// ---------------------------------------------------------------------------
// snapshots — snapshot acquisition attempts (US3, FR-008, FR-031)
// ---------------------------------------------------------------------------

type SnapshotRow = {
  id: number;
  repository_id: number;
  commit_sha: string;
  attempt_number: number;
  status: SnapshotStatus;
  acquisition_mode: AcquisitionMode;
  provider_endpoint: string | null;
  created_at: string;
  completed_at: string | null;
};

function rowToSnapshot(
  row: SnapshotRow,
  repository: RepositoryIdentity,
): Snapshot {
  return {
    id: row.id,
    repository,
    repositoryId: row.repository_id,
    commitSha: row.commit_sha as CommitSha,
    attemptNumber: row.attempt_number,
    status: row.status,
    acquisitionMode: row.acquisition_mode,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

/**
 * Resolve the logical snapshot (repository, commitSha) across every attempt
 * (plan.md Acquisition Workflow step 3): return the completed attempt if one
 * exists, else the most recent in-progress/pending attempt, else null
 * (caller must create a new attempt — never inferred here).
 */
export async function resolveLogicalSnapshot(
  repositoryId: number,
  commitSha: CommitSha,
  db: D1DatabaseLike = getD1(),
): Promise<SnapshotRow | null> {
  const completed = await db
    .prepare(
      `SELECT * FROM snapshots WHERE repository_id = ? AND commit_sha = ? AND status = 'completed' LIMIT 1`,
    )
    .bind(repositoryId, commitSha)
    .first<SnapshotRow>();
  if (completed) return completed;

  const inProgress = await db
    .prepare(
      `SELECT * FROM snapshots WHERE repository_id = ? AND commit_sha = ? AND status IN ('pending','in_progress')
       ORDER BY attempt_number DESC LIMIT 1`,
    )
    .bind(repositoryId, commitSha)
    .first<SnapshotRow>();
  return inProgress ?? null;
}

/** Creates a new snapshot acquisition attempt with the already-determined mode persisted immediately (FR-031, U1). `providerEndpoint` intentionally left NULL — no established writer in this feature (accepted partial-by-design). */
export async function createAcquisitionAttempt(
  repositoryId: number,
  commitSha: CommitSha,
  acquisitionMode: AcquisitionMode,
  db: D1DatabaseLike = getD1(),
): Promise<number> {
  const maxRow = await db
    .prepare(
      `SELECT MAX(attempt_number) as maxAttempt FROM snapshots WHERE repository_id = ? AND commit_sha = ?`,
    )
    .bind(repositoryId, commitSha)
    .first<{ maxAttempt: number | null }>();
  const attemptNumber = (maxRow?.maxAttempt ?? 0) + 1;

  const result = await db
    .prepare(
      `INSERT INTO snapshots (repository_id, commit_sha, attempt_number, status, acquisition_mode, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
    )
    .bind(repositoryId, commitSha, attemptNumber, acquisitionMode, nowIso())
    .run();
  const id = result.meta.last_row_id;
  if (id === undefined)
    throw new Error("createAcquisitionAttempt: no last_row_id returned");
  return id;
}

export async function markSnapshotInProgress(
  snapshotId: number,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  await db
    .prepare(
      `UPDATE snapshots SET status = 'in_progress' WHERE id = ? AND status = 'pending'`,
    )
    .bind(snapshotId)
    .run();
}

export async function getSnapshotById(
  snapshotId: number,
  db: D1DatabaseLike = getD1(),
): Promise<Snapshot | null> {
  const row = await db
    .prepare(`SELECT * FROM snapshots WHERE id = ?`)
    .bind(snapshotId)
    .first<SnapshotRow>();
  if (!row) return null;
  const repository = await getRepositoryIdentity(row.repository_id, db);
  return rowToSnapshot(row, repository);
}

/**
 * Finalize an attempt as completed only if (a) all its jobs are completed and
 * (b) no sibling attempt for the same logical snapshot already holds
 * status='completed' (FR-010, FR-027, requirement 4/5). Returns true if this
 * call performed the transition (false = already completed / guard blocked —
 * a safe no-op for a retried/duplicated finalization call).
 */
export async function finalizeSnapshotCompleted(
  snapshotId: number,
  db: D1DatabaseLike = getD1(),
): Promise<boolean> {
  const snapshot = await db
    .prepare(`SELECT * FROM snapshots WHERE id = ?`)
    .bind(snapshotId)
    .first<SnapshotRow>();
  if (!snapshot)
    throw new Error(`finalizeSnapshotCompleted: no snapshot ${snapshotId}`);
  if (snapshot.status === "completed") return false;

  const incompleteJobs = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM acquisition_jobs WHERE snapshot_id = ? AND status != 'completed'`,
    )
    .bind(snapshotId)
    .first<{ cnt: number }>();
  if (!incompleteJobs || incompleteJobs.cnt > 0) return false;

  const anyCompletedJob = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM acquisition_jobs WHERE snapshot_id = ? AND status = 'completed'`,
    )
    .bind(snapshotId)
    .first<{ cnt: number }>();
  if (!anyCompletedJob || anyCompletedJob.cnt === 0) return false;

  const siblingCompleted = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM snapshots WHERE repository_id = ? AND commit_sha = ? AND status = 'completed' AND id != ?`,
    )
    .bind(snapshot.repository_id, snapshot.commit_sha, snapshotId)
    .first<{ cnt: number }>();
  if (siblingCompleted && siblingCompleted.cnt > 0) return false;

  const result = await db
    .prepare(
      `UPDATE snapshots SET status = 'completed', completed_at = ? WHERE id = ? AND status != 'completed'`,
    )
    .bind(nowIso(), snapshotId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function markSnapshotFailed(
  snapshotId: number,
  db: D1DatabaseLike = getD1(),
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE snapshots SET status = 'failed' WHERE id = ? AND status NOT IN ('completed','failed')`,
    )
    .bind(snapshotId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// snapshot_files (US3/US4, FR-018, FR-019, FR-020, FR-024)
// ---------------------------------------------------------------------------

export async function insertSnapshotFile(
  snapshotId: number,
  path: string,
  sizeBytes: number,
  contentHash: string,
  r2Key: string,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO snapshot_files (snapshot_id, path, size_bytes, content_hash, r2_key) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (snapshot_id, path) DO NOTHING`,
    )
    .bind(snapshotId, path, sizeBytes, contentHash, r2Key)
    .run();
}

export async function hasSnapshotFile(
  snapshotId: number,
  path: string,
  db: D1DatabaseLike = getD1(),
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 as present FROM snapshot_files WHERE snapshot_id = ? AND path = ?`,
    )
    .bind(snapshotId, path)
    .first<{ present: number }>();
  return row !== null;
}

export async function getSnapshotFileRow(
  snapshotId: number,
  path: string,
  db: D1DatabaseLike = getD1(),
): Promise<{
  path: string;
  sizeBytes: number;
  contentHash: string;
  r2Key: string;
} | null> {
  const row = await db
    .prepare(
      `SELECT path, size_bytes as sizeBytes, content_hash as contentHash, r2_key as r2Key FROM snapshot_files WHERE snapshot_id = ? AND path = ?`,
    )
    .bind(snapshotId, path)
    .first<{
      path: string;
      sizeBytes: number;
      contentHash: string;
      r2Key: string;
    }>();
  return row;
}

export async function listSnapshotFilesPage(
  snapshotId: number,
  cursor: number | undefined,
  limit: number,
  db: D1DatabaseLike = getD1(),
): Promise<{
  files: { id: number; path: string; sizeBytes: number; contentHash: string }[];
  nextCursor: number | null;
}> {
  const result = await db
    .prepare(
      `SELECT id, path, size_bytes as sizeBytes, content_hash as contentHash FROM snapshot_files
       WHERE snapshot_id = ? AND id > ? ORDER BY id ASC LIMIT ?`,
    )
    .bind(snapshotId, cursor ?? 0, limit + 1)
    .all<{
      id: number;
      path: string;
      sizeBytes: number;
      contentHash: string;
    }>();
  const rows = result.results ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    files: page,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

// ---------------------------------------------------------------------------
// acquisition_jobs (US3/US6, FR-023–FR-027, FR-036, FR-037)
// ---------------------------------------------------------------------------

export async function upsertAcquisitionJob(
  snapshotId: number,
  unitIndex: number,
  status: AcquisitionJobStatus,
  checkpointCursor: string | null,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO acquisition_jobs (snapshot_id, unit_index, status, checkpoint_cursor, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (snapshot_id, unit_index) DO UPDATE SET
         status = CASE WHEN acquisition_jobs.status = 'completed' THEN acquisition_jobs.status ELSE excluded.status END,
         checkpoint_cursor = excluded.checkpoint_cursor,
         updated_at = excluded.updated_at`,
    )
    .bind(snapshotId, unitIndex, status, checkpointCursor, nowIso())
    .run();
}

/** Recomputes files_processed/bytes_processed from `snapshot_files` (retry-safe: set, not incremented — FR-036, G2). */
export async function recomputeJobCounters(
  snapshotId: number,
  unitIndex: number,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  const agg = await db
    .prepare(
      `SELECT COUNT(*) as filesProcessed, COALESCE(SUM(size_bytes),0) as bytesProcessed FROM snapshot_files WHERE snapshot_id = ?`,
    )
    .bind(snapshotId)
    .first<{ filesProcessed: number; bytesProcessed: number }>();
  await db
    .prepare(
      `UPDATE acquisition_jobs SET files_processed = ?, bytes_processed = ?, updated_at = ? WHERE snapshot_id = ? AND unit_index = ?`,
    )
    .bind(
      agg?.filesProcessed ?? 0,
      agg?.bytesProcessed ?? 0,
      nowIso(),
      snapshotId,
      unitIndex,
    )
    .run();
}

export async function isAcquisitionJobCompleted(
  snapshotId: number,
  unitIndex: number,
  db: D1DatabaseLike = getD1(),
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT status FROM acquisition_jobs WHERE snapshot_id = ? AND unit_index = ?`,
    )
    .bind(snapshotId, unitIndex)
    .first<{ status: AcquisitionJobStatus }>();
  return row?.status === "completed";
}

export async function markJobCompleted(
  snapshotId: number,
  unitIndex: number,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  await db
    .prepare(
      `UPDATE acquisition_jobs SET status = 'completed', updated_at = ? WHERE snapshot_id = ? AND unit_index = ?`,
    )
    .bind(nowIso(), snapshotId, unitIndex)
    .run();
}

export async function recordJobRetry(
  snapshotId: number,
  unitIndex: number,
  failureReason: string,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  await db
    .prepare(
      `UPDATE acquisition_jobs SET status = 'retrying', retry_count = retry_count + 1, failure_reason = ?, updated_at = ?
       WHERE snapshot_id = ? AND unit_index = ? AND status != 'completed'`,
    )
    .bind(failureReason, nowIso(), snapshotId, unitIndex)
    .run();
}

export async function markJobFailed(
  snapshotId: number,
  unitIndex: number,
  failureReason: string,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  await db
    .prepare(
      `UPDATE acquisition_jobs SET status = 'failed', failure_reason = ?, updated_at = ?
       WHERE snapshot_id = ? AND unit_index = ? AND status != 'completed'`,
    )
    .bind(failureReason, nowIso(), snapshotId, unitIndex)
    .run();
}

export async function getJobRetryCount(
  snapshotId: number,
  unitIndex: number,
  db: D1DatabaseLike = getD1(),
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT retry_count as retryCount FROM acquisition_jobs WHERE snapshot_id = ? AND unit_index = ?`,
    )
    .bind(snapshotId, unitIndex)
    .first<{ retryCount: number }>();
  return row?.retryCount ?? 0;
}

export async function getSnapshotJobsSummary(
  snapshotId: number,
  db: D1DatabaseLike = getD1(),
): Promise<{
  unitsCompleted: number;
  unitsTotal: number;
  filesProcessed: number;
  bytesProcessed: number;
}> {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) as unitsTotal,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as unitsCompleted,
         COALESCE(SUM(files_processed),0) as filesProcessed,
         COALESCE(SUM(bytes_processed),0) as bytesProcessed
       FROM acquisition_jobs WHERE snapshot_id = ?`,
    )
    .bind(snapshotId)
    .first<{
      unitsTotal: number;
      unitsCompleted: number;
      filesProcessed: number;
      bytesProcessed: number;
    }>();
  return {
    unitsCompleted: row?.unitsCompleted ?? 0,
    unitsTotal: row?.unitsTotal ?? 0,
    filesProcessed: row?.filesProcessed ?? 0,
    bytesProcessed: row?.bytesProcessed ?? 0,
  };
}

// ---------------------------------------------------------------------------
// acquisition_attempts — acquisition attempt log (operational observability
// only, FR-035; A1: never repository history, see getRepositoryHistory below)
// ---------------------------------------------------------------------------

export async function insertAcquisitionAttemptLog(
  repositoryId: number,
  commitSha: CommitSha,
  provider: Provider,
  acquisitionMode: AcquisitionMode,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO acquisition_attempts (repository_id, commit_sha, provider, acquisition_mode, started_at, status)
       VALUES (?, ?, ?, ?, ?, 'in_progress')`,
    )
    .bind(repositoryId, commitSha, provider, acquisitionMode, nowIso())
    .run();
}

/** Idempotent under retry — `WHERE status NOT IN (...)` guard makes a second call a no-op (G1). */
export async function terminateAcquisitionAttemptLog(
  repositoryId: number,
  commitSha: CommitSha,
  status: "completed" | "failed",
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  const row = await db
    .prepare(
      `SELECT id, started_at as startedAt FROM acquisition_attempts
       WHERE repository_id = ? AND commit_sha = ? AND status NOT IN ('completed','failed')
       ORDER BY started_at DESC LIMIT 1`,
    )
    .bind(repositoryId, commitSha)
    .first<{ id: number; startedAt: string }>();
  if (!row) return; // already terminal — idempotent no-op

  const endedAt = nowIso();
  const durationMs =
    new Date(endedAt).getTime() - new Date(row.startedAt).getTime();
  await db
    .prepare(
      `UPDATE acquisition_attempts SET status = ?, ended_at = ?, duration_ms = ?
       WHERE id = ? AND status NOT IN ('completed','failed')`,
    )
    .bind(status, endedAt, durationMs, row.id)
    .run();
}

// ---------------------------------------------------------------------------
// Repository history — completed snapshots only (US7, FR-028, FR-029; I1: never
// includes a failed/in_progress attempt or the acquisition attempt log)
// ---------------------------------------------------------------------------

export async function getRepositoryHistoryRows(
  repositoryId: number,
  db: D1DatabaseLike = getD1(),
): Promise<{ snapshotId: number; commitSha: string; completedAt: string }[]> {
  const result = await db
    .prepare(
      `SELECT id as snapshotId, commit_sha as commitSha, completed_at as completedAt
       FROM snapshots WHERE repository_id = ? AND status = 'completed' ORDER BY completed_at DESC`,
    )
    .bind(repositoryId)
    .all<{ snapshotId: number; commitSha: string; completedAt: string }>();
  return result.results ?? [];
}

/** Most recent *other* completed snapshot for this repository — the incremental-mode diff baseline (US7). */
export async function getMostRecentCompletedSnapshotSha(
  repositoryId: number,
  excludeSnapshotId: number,
  db: D1DatabaseLike = getD1(),
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT commit_sha as commitSha FROM snapshots WHERE repository_id = ? AND status = 'completed' AND id != ?
       ORDER BY completed_at DESC LIMIT 1`,
    )
    .bind(repositoryId, excludeSnapshotId)
    .first<{ commitSha: string }>();
  return row?.commitSha ?? null;
}

export async function hasCompletedSnapshot(
  repositoryId: number,
  db: D1DatabaseLike = getD1(),
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 as present FROM snapshots WHERE repository_id = ? AND status = 'completed' LIMIT 1`,
    )
    .bind(repositoryId)
    .first<{ present: number }>();
  return row !== null;
}
