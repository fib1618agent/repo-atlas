import type { D1DatabaseLike } from "../persistence/cloudflare-env";
import { getSymbolQueue, type QueueLike } from "../persistence/cloudflare-env";
import { getD1 } from "../persistence/cloudflare-env";
import { getSnapshotFileRow, listSnapshotFilesPage } from "../persistence/d1-client";
import {
  finalizeSnapshotExtraction,
  getJobRetryCount,
  getSnapshotExtractionSummary,
  markJobCompleted,
  markJobFailed,
  recomputeJobCounters,
  recordJobRetry,
  upsertExtractionJob,
} from "../persistence/symbol-d1-client";
import { codeIntelConfig } from "../config";
import { extractFile } from "./extraction-pipeline";
import type { SnapshotFile } from "../domain/snapshot";
import type { ExtractionJobStatus, SnapshotExtractionStatus } from "../domain/symbol";

/**
 * Symbol extraction queue consumer (T030). Pure orchestration — never parses
 * source, never touches the AST/IR, never persists symbols directly:
 *
 *   symbol-worker.ts (this file) — orchestration: which file batch, job
 *                                   lifecycle, checkpoint, retry, finalize
 *        |
 *        v
 *   extraction-pipeline.ts (T029) — extraction: detect, parse, IR, persist
 *        |
 *        v
 *   grammar-provider.ts (T022) — WASM parser loading
 *
 * Structurally mirrors Feature 001's `queue/snapshot-worker.ts` at the
 * orchestration level (load state → check terminal/idempotent-skip →
 * process → enqueue-next-or-finalize → catch → retry-or-fail), adapted to
 * Feature 002's own lifecycle tables (`extraction_jobs`,
 * `snapshot_extractions`) instead of `acquisition_jobs`/`snapshots`. Never
 * writes to any Feature 001 table.
 */

export type SymbolQueueMessage = {
  snapshotId: number;
  unitIndex: number;
  /** Cursor into the snapshot's `snapshot_files` (ordered by id, same ordering `listSnapshotFilesPage` already uses) marking where this unit's batch starts — the last file id covered by all prior units, or 0 for the first unit. */
  fromCursor: number;
};

/**
 * Local, orchestration-only reads of Feature 002's own lifecycle tables —
 * deliberately NOT added to `symbol-d1-client.ts`'s exported API (T008,
 * already closed): these are single-purpose job/extraction *state* reads
 * this worker uses to make control-flow decisions (idempotent-skip, resume,
 * terminal-check), not general-purpose persistence primitives another
 * caller would need. Keeping them local avoids re-opening T008's file for
 * what is squarely this worker's own coordination concern.
 */
async function getSnapshotExtractionState(
  snapshotId: number,
  db: D1DatabaseLike,
): Promise<{ status: SnapshotExtractionStatus; extractorVersion: string } | null> {
  return db
    .prepare(`SELECT status, extractor_version as extractorVersion FROM snapshot_extractions WHERE snapshot_id = ?`)
    .bind(snapshotId)
    .first<{ status: SnapshotExtractionStatus; extractorVersion: string }>();
}

async function getExtractionJobState(
  snapshotId: number,
  unitIndex: number,
  db: D1DatabaseLike,
): Promise<{ status: ExtractionJobStatus; checkpointCursor: string | null } | null> {
  return db
    .prepare(`SELECT status, checkpoint_cursor as checkpointCursor FROM extraction_jobs WHERE snapshot_id = ? AND unit_index = ?`)
    .bind(snapshotId, unitIndex)
    .first<{ status: ExtractionJobStatus; checkpointCursor: string | null }>();
}

/**
 * One `ExtractionJob` unit per invocation (bounded file batch, checkpointed,
 * idempotent by construction — every D1 write this reaches, via
 * `extraction-pipeline.ts`/`symbol-d1-client.ts`, is itself idempotent, so
 * redelivering the same message reproduces identical end state).
 */
export async function processSymbolQueueMessage(
  message: SymbolQueueMessage,
  db?: D1DatabaseLike,
): Promise<void> {
  const database = db ?? getD1();
  const { snapshotId, unitIndex, fromCursor } = message;

  const extraction = await getSnapshotExtractionState(snapshotId, database);
  if (!extraction || extraction.status !== "in_progress") {
    return; // no-op: extraction never started, or already terminal (completed/completed_partial/failed)
  }

  const existingJob = await getExtractionJobState(snapshotId, unitIndex, database);
  if (existingJob?.status === "completed") {
    return; // at-least-once redelivery after this unit already finished
  }

  const config = codeIntelConfig();
  const extractorVersion = extraction.extractorVersion;

  try {
    // Resume within this unit past any files it already recorded progress
    // for (crash-resume, data-model.md "Checkpoint/Resume mechanism") —
    // never before fromCursor, which is this unit's own assigned start.
    const existingCursor = existingJob?.checkpointCursor ? Number(existingJob.checkpointCursor) : null;
    const resumeCursor = existingCursor !== null ? Math.max(fromCursor, existingCursor) : fromCursor;

    await upsertExtractionJob(snapshotId, unitIndex, "pending", existingJob?.checkpointCursor ?? null, database);

    const page = await listSnapshotFilesPage(snapshotId, resumeCursor, config.extractionBatchSize, database);

    for (const file of page.files) {
      const fullRow = await getSnapshotFileRow(snapshotId, file.path, database);
      if (fullRow) {
        const snapshotFile: SnapshotFile = {
          id: file.id,
          snapshotId,
          path: fullRow.path,
          sizeBytes: fullRow.sizeBytes,
          contentHash: fullRow.contentHash,
          r2Key: fullRow.r2Key,
        };
        // extraction-pipeline.ts owns everything from here — language
        // detection, parsing, IR, symbol persistence. Never re-implemented
        // here (this worker only decides WHICH file to hand it next).
        await extractFile({ snapshotId, snapshotFile, extractorVersion, db: database });
      }
      await upsertExtractionJob(snapshotId, unitIndex, "pending", String(file.id), database);
    }

    await recomputeJobCounters(snapshotId, unitIndex, database);
    await markJobCompleted(snapshotId, unitIndex, database);

    if (page.nextCursor === null) {
      // No more files anywhere after this point in the snapshot — this
      // unit's batch reached the end; finalize the whole extraction.
      const summary = await getSnapshotExtractionSummary(snapshotId, database);
      const finalStatus: "completed" | "completed_partial" =
        summary.filesSkippedUnsupported > 0 || summary.filesFailed > 0 ? "completed_partial" : "completed";
      await finalizeSnapshotExtraction(snapshotId, finalStatus, database);
    } else {
      await enqueueNextUnit(snapshotId, unitIndex + 1, page.nextCursor);
    }
  } catch (error) {
    await handleUnitFailure(snapshotId, unitIndex, error, database);
    throw error; // rethrow so the queue's native at-least-once redelivery can retry, mirrors Feature 001
  }
}

async function handleUnitFailure(
  snapshotId: number,
  unitIndex: number,
  error: unknown,
  db: D1DatabaseLike,
): Promise<void> {
  const reason = error instanceof Error ? error.message : String(error);
  const retryCount = await getJobRetryCount(snapshotId, unitIndex, db);
  const maxAttempts = codeIntelConfig().maxRetryAttempts;

  if (retryCount + 1 >= maxAttempts) {
    await markJobFailed(snapshotId, unitIndex, reason, db);
    await finalizeSnapshotExtraction(snapshotId, "failed", db);
  } else {
    await recordJobRetry(snapshotId, unitIndex, reason, db);
  }
}

async function enqueueNextUnit(
  snapshotId: number,
  unitIndex: number,
  fromCursor: number,
  queue: QueueLike = getSymbolQueue(),
): Promise<void> {
  await queue.send({ snapshotId, unitIndex, fromCursor } satisfies SymbolQueueMessage);
}
