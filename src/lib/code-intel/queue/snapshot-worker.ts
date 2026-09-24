import type { D1DatabaseLike } from "../persistence/cloudflare-env";
import {
  finalizeSnapshotCompleted,
  getRepositoryIdentity,
  getSnapshotById,
  getJobRetryCount,
  isAcquisitionJobCompleted,
  markJobFailed,
  markSnapshotFailed,
  recordJobRetry,
  terminateAcquisitionAttemptLog,
} from "../persistence/d1-client";
import { runArchiveUnit } from "../acquisition/archive-pipeline";
import { runIncrementalUnit } from "../acquisition/incremental-pipeline";
import {
  getSnapshotQueue,
  type QueueLike,
} from "../persistence/cloudflare-env";
import { toCommitSha } from "../domain/repository-identity";
import { codeIntelConfig } from "../config";

export type SnapshotQueueMessage = {
  snapshotId: number;
  unitIndex: number;
};

/**
 * One `AcquisitionJob` unit per invocation (FR-023). Idempotent by
 * construction (FR-024): every D1 write this reaches is itself idempotent
 * (archive-pipeline.ts / d1-client.ts's ON CONFLICT / WHERE-guarded updates),
 * so redelivering the same message reproduces identical end state.
 *
 * Only writer of `snapshots.status` and `acquisition_jobs.status` — keeps
 * the finalization invariant (FR-027) enforceable in one place (plan.md
 * Queue/Job Boundaries).
 */
export async function processSnapshotQueueMessage(
  message: SnapshotQueueMessage,
  db?: D1DatabaseLike,
): Promise<void> {
  const snapshot = await getSnapshotById(message.snapshotId, db);
  if (!snapshot)
    throw new Error(
      `processSnapshotQueueMessage: no snapshot ${message.snapshotId}`,
    );
  if (snapshot.status === "completed" || snapshot.status === "failed") return; // already terminal — no-op
  if (await isAcquisitionJobCompleted(snapshot.id, message.unitIndex, db)) {
    return; // at-least-once redelivery after this unit already finished (FR-024)
  }

  const repository = await getRepositoryIdentity(snapshot.repositoryId, db);
  const commitSha = toCommitSha(snapshot.commitSha);

  try {
    const result =
      snapshot.acquisitionMode === "bulk_archive"
        ? await runArchiveUnit({
            repository,
            commitSha,
            snapshotId: snapshot.id,
            unitIndex: message.unitIndex,
            db,
          })
        : await runIncrementalUnit({
            repository,
            commitSha,
            snapshotId: snapshot.id,
            unitIndex: message.unitIndex,
            repositoryId: snapshot.repositoryId,
            db,
          });

    if (result.done) {
      const finalized = await finalizeSnapshotCompleted(snapshot.id, db);
      if (finalized) {
        await terminateAcquisitionAttemptLog(
          snapshot.repositoryId,
          commitSha,
          "completed",
          db,
        );
      }
    } else {
      await enqueueNextUnit(snapshot.id, message.unitIndex + 1);
    }
  } catch (error) {
    await handleUnitFailure(
      snapshot.id,
      snapshot.repositoryId,
      commitSha,
      message.unitIndex,
      error,
      db,
    );
    throw error; // rethrow so the queue's native at-least-once redelivery can retry
  }
}

async function handleUnitFailure(
  snapshotId: number,
  repositoryId: number,
  commitSha: import("../domain/repository-identity").CommitSha,
  unitIndex: number,
  error: unknown,
  db?: D1DatabaseLike,
): Promise<void> {
  const reason = error instanceof Error ? error.message : String(error);
  const retryCount = await getJobRetryCount(snapshotId, unitIndex, db);
  const maxAttempts = codeIntelConfig().maxRetryAttempts;

  if (retryCount + 1 >= maxAttempts) {
    await markJobFailed(snapshotId, unitIndex, reason, db);
    const failed = await markSnapshotFailed(snapshotId, db);
    if (failed) {
      await terminateAcquisitionAttemptLog(
        repositoryId,
        commitSha,
        "failed",
        db,
      );
    }
  } else {
    await recordJobRetry(snapshotId, unitIndex, reason, db);
  }
}

async function enqueueNextUnit(
  snapshotId: number,
  unitIndex: number,
  queue: QueueLike = getSnapshotQueue(),
): Promise<void> {
  await queue.send({ snapshotId, unitIndex } satisfies SnapshotQueueMessage);
}
