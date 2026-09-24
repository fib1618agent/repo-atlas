import type {
  CommitSha,
  RepositoryIdentity,
} from "../domain/repository-identity";
import { toCommitSha } from "../domain/repository-identity";
import { githubContentProvider } from "../providers/github-content-provider";
import { hashContent, deriveR2Key } from "./content-address";
import {
  getMostRecentCompletedSnapshotSha,
  hasSnapshotFile,
  insertSnapshotFile,
  markJobCompleted,
  recomputeJobCounters,
  upsertAcquisitionJob,
} from "../persistence/d1-client";
import { putObject } from "../persistence/r2-client";
import type { D1DatabaseLike } from "../persistence/cloudflare-env";

/**
 * Consumes `compareRefs`'s changed-path list + `fetchPaths` to acquire only
 * changed files under this acquisition attempt (FR-013). Diff computation is
 * delegated entirely to the GitHub Compare API — this is not a generic diff
 * engine (plan.md Incremental Synchronization Foundation: "keeping scope to
 * 'foundation,' not a full sync engine"). Typically completes in one unit.
 */
export async function runIncrementalUnit(params: {
  repository: RepositoryIdentity;
  commitSha: CommitSha;
  snapshotId: number;
  unitIndex: number;
  repositoryId: number;
  db?: D1DatabaseLike | undefined;
}): Promise<{ done: boolean; filesWrittenThisUnit: number }> {
  const { repository, commitSha, snapshotId, unitIndex, repositoryId, db } =
    params;
  await upsertAcquisitionJob(snapshotId, unitIndex, "pending", null, db);

  const baselineSha = await getMostRecentCompletedSnapshotSha(
    repositoryId,
    snapshotId,
    db,
  );
  if (!baselineSha) {
    // No baseline available (shouldn't happen if mode decision was correct) — nothing to diff against.
    await recomputeJobCounters(snapshotId, unitIndex, db);
    await markJobCompleted(snapshotId, unitIndex, db);
    return { done: true, filesWrittenThisUnit: 0 };
  }

  const changedPaths = await githubContentProvider.compareRefs(
    repository,
    toCommitSha(baselineSha),
    commitSha,
  );
  const pathsToFetch = changedPaths
    .filter((c) => c.changeType !== "removed")
    .map((c) => c.path);

  let filesWrittenThisUnit = 0;
  for await (const file of githubContentProvider.fetchPaths(
    repository,
    commitSha,
    pathsToFetch,
  )) {
    const alreadyWritten = await hasSnapshotFile(snapshotId, file.path, db);
    if (alreadyWritten) continue;

    const contentHash = await hashContent(file.content);
    const r2Key = deriveR2Key(repository, commitSha, contentHash);
    await putObject(r2Key, file.content);
    await insertSnapshotFile(
      snapshotId,
      file.path,
      file.size,
      contentHash,
      r2Key,
      db,
    );
    filesWrittenThisUnit++;
  }

  await recomputeJobCounters(snapshotId, unitIndex, db);
  await markJobCompleted(snapshotId, unitIndex, db);
  return { done: true, filesWrittenThisUnit };
}
