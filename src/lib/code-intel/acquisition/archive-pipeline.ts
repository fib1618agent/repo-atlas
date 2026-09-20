import type {
  CommitSha,
  RepositoryIdentity,
} from "../domain/repository-identity";
import { githubContentProvider } from "../providers/github-content-provider";
import { hashContent, deriveR2Key } from "./content-address";
import {
  hasSnapshotFile,
  insertSnapshotFile,
  upsertAcquisitionJob,
  recomputeJobCounters,
  markJobCompleted,
} from "../persistence/d1-client";
import { putObject } from "../persistence/r2-client";
import { codeIntelConfig } from "../config";
import type { D1DatabaseLike } from "../persistence/cloudflare-env";
import { readAllStreamBytes } from "./stream-utils";
import {
  githubArchiveRootPrefix,
  normalizeGithubArchivePath,
} from "./archive-path";

/**
 * fetch → DecompressionStream(gzip) → tar-stream → per-entry hash → throttled
 * R2 put, never buffering the full decompressed archive (FR-015, FR-016;
 * SC-004 — only one entry is buffered at a time, see tar-stream.ts's
 * documented per-entry-buffering trade-off).
 *
 * Checkpointing (FR-025) + resume (re-fetch-and-fast-forward, plan.md
 * Streaming Archive Processing): each call re-fetches the archive from the
 * start (content is immutable per commit SHA) and skips entries already
 * present in `snapshot_files` for this attempt (idempotent D1 lookup) —
 * cheap, since skipping only discards already-decoded tar entries, never
 * re-uploads them to R2. Stops after `checkpointFileCount` *new* files
 * written in this invocation and reports `done: false`, so the caller
 * (snapshot-worker.ts) can enqueue a follow-up unit for the same attempt.
 */
export async function runArchiveUnit(params: {
  repository: RepositoryIdentity;
  commitSha: CommitSha;
  snapshotId: number;
  unitIndex: number;
  db?: D1DatabaseLike | undefined;
}): Promise<{ done: boolean; filesWrittenThisUnit: number }> {
  const { repository, commitSha, snapshotId, unitIndex, db } = params;
  const config = codeIntelConfig();

  // Ensure this unit's job row exists before doing any work, so a crash
  // mid-unit still leaves a `pending` (not missing) row for retry to find.
  await upsertAcquisitionJob(snapshotId, unitIndex, "pending", null, db);

  const entryStream = await githubContentProvider.fetchArchive(
    repository,
    commitSha,
  );
  const reader = entryStream.getReader();
  const archiveRootPrefix = githubArchiveRootPrefix(repository, commitSha);
  let filesWrittenThisUnit = 0;
  let lastPath: string | null = null;

  async function finishUnit(archiveFullyConsumed: boolean) {
    await upsertAcquisitionJob(snapshotId, unitIndex, "pending", lastPath, db);
    await recomputeJobCounters(snapshotId, unitIndex, db);
    await markJobCompleted(snapshotId, unitIndex, db);
    return { done: archiveFullyConsumed, filesWrittenThisUnit };
  }

  for (;;) {
    const { value: entry, done: streamDone } = await reader.read();
    if (streamDone) {
      return finishUnit(true);
    }

    const path = normalizeGithubArchivePath(entry.path, archiveRootPrefix);
    const alreadyWritten = await hasSnapshotFile(snapshotId, path, db);
    if (alreadyWritten) continue; // fast-forward past work a prior unit already did

    const bytes = await readAllStreamBytes(entry.content);
    const contentHash = await hashContent(bytes);
    const r2Key = deriveR2Key(repository, commitSha, contentHash);
    await putObject(r2Key, bytes);
    await insertSnapshotFile(
      snapshotId,
      path,
      entry.size,
      contentHash,
      r2Key,
      db,
    );

    filesWrittenThisUnit++;
    lastPath = path;

    if (filesWrittenThisUnit >= config.checkpointFileCount) {
      return finishUnit(false);
    }
  }
}
