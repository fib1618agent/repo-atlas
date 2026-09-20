import type { CommitSha, RepositoryIdentity } from "./repository-identity";

/**
 * Three distinct identities (plan.md Snapshot Model — do not conflate):
 *  - Logical snapshot   = (repository, commitSha). Not a row of its own.
 *  - Snapshot acquisition attempt = (repository, commitSha, attemptNumber).
 *    This is the `snapshots` table row (`Snapshot` below).
 *  - Completed snapshot = the ≤1 attempt per logical snapshot with status="completed".
 *
 * Separately, `acquisition_attempts` is the **acquisition attempt log** — an
 * operational observability table, at most one row per snapshot acquisition
 * attempt, never modeled by these domain types. See AcquisitionAttemptLog
 * types in persistence/d1-client.ts.
 */

export type SnapshotStatus = "pending" | "in_progress" | "completed" | "failed";
export type AcquisitionMode = "bulk_archive" | "incremental_api";

export type Snapshot = {
  id: number;
  repository: RepositoryIdentity;
  repositoryId: number;
  commitSha: CommitSha;
  attemptNumber: number;
  status: SnapshotStatus;
  acquisitionMode: AcquisitionMode;
  createdAt: string;
  completedAt: string | null;
};

export type SnapshotFile = {
  id: number;
  snapshotId: number;
  path: string;
  sizeBytes: number;
  contentHash: string;
  r2Key: string;
};

export type AcquisitionJobStatus =
  "pending" | "retrying" | "failed" | "completed";

export type AcquisitionJob = {
  id: number;
  snapshotId: number;
  unitIndex: number;
  status: AcquisitionJobStatus;
  checkpointCursor: string | null;
  retryCount: number;
  failureReason: string | null;
  filesProcessed: number;
  bytesProcessed: number;
  updatedAt: string;
};
