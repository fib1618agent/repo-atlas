import { createServerFn } from "@tanstack/react-start";
import {
  AtlasError,
  atlasErrorMessage,
  isAtlasError,
  serializeAtlasError,
} from "../atlas-errors";
import type { RepositoryIdentity } from "./domain/repository-identity";
import { githubContentProvider } from "./providers/github-content-provider";
import {
  createAcquisitionAttempt,
  getOrCreateRepository,
  getRepositoryHistoryRows,
  getSnapshotById,
  getSnapshotFileRow,
  getSnapshotJobsSummary,
  hasCompletedSnapshot,
  insertAcquisitionAttemptLog,
  listSnapshotFilesPage,
  markSnapshotInProgress,
  resolveLogicalSnapshot,
  upsertResolvedRef,
} from "./persistence/d1-client";
import { getObject } from "./persistence/r2-client";
import { getSnapshotQueue } from "./persistence/cloudflare-env";
import { codeIntelConfig } from "./config";
import type { AcquisitionMode, SnapshotStatus } from "./domain/snapshot";

/**
 * Plain, directly-callable handler functions (business logic) + thin
 * `createServerFn` wrappers around them (the real RPC surface, mirroring
 * `repositories.functions.ts`'s pattern). Split this way because
 * `createServerFn`-wrapped functions require the TanStack Start
 * AsyncLocalStorage request context to invoke — unavailable under plain
 * `bun test` — so tests call the handler functions directly; the app itself
 * only ever calls the exported `createServerFn` instances below, whose
 * external contract is unchanged.
 */

export type AcquireSnapshotResponse = {
  snapshotId: number;
  repository: RepositoryIdentity;
  commitSha: string;
  status: SnapshotStatus;
  acquisitionMode: AcquisitionMode;
  reused: boolean;
};

function rethrowSerialized(error: AtlasError): never {
  throw new Error(JSON.stringify(serializeAtlasError(error)));
}

export async function acquireSnapshotHandler(data: {
  repository: RepositoryIdentity;
  ref: string;
}): Promise<AcquireSnapshotResponse> {
  const { repository, ref } = data;

  let commitSha: Awaited<ReturnType<typeof githubContentProvider.resolveRef>>;
  try {
    commitSha = await githubContentProvider.resolveRef(repository, ref);
  } catch (error) {
    if (isAtlasError(error)) rethrowSerialized(error);
    rethrowSerialized(new AtlasError("NETWORK", atlasErrorMessage("NETWORK")));
  }

  const repositoryId = await getOrCreateRepository(repository);
  // Cache the ref→SHA resolution (repository_refs) — overwritten, not appended,
  // on each fresh resolution (User Story 2 Acceptance Scenario 3); never
  // trusted as authoritative for the logical-snapshot resolve step below.
  await upsertResolvedRef(repositoryId, ref, commitSha);

  // Resolve the logical snapshot (repository, commitSha) across every attempt.
  const existing = await resolveLogicalSnapshot(repositoryId, commitSha);
  if (existing) {
    return {
      snapshotId: existing.id,
      repository,
      commitSha,
      status: existing.status,
      acquisitionMode: existing.acquisition_mode,
      reused: true,
    };
  }

  // No reusable attempt — create a new snapshot acquisition attempt.
  const acquisitionMode: AcquisitionMode = (await hasCompletedSnapshot(
    repositoryId,
  ))
    ? "incremental_api"
    : "bulk_archive";
  const snapshotId = await createAcquisitionAttempt(
    repositoryId,
    commitSha,
    acquisitionMode,
  );
  await insertAcquisitionAttemptLog(
    repositoryId,
    commitSha,
    repository.provider,
    acquisitionMode,
  );
  await markSnapshotInProgress(snapshotId);

  try {
    await getSnapshotQueue().send({ snapshotId, unitIndex: 0 });
  } catch {
    rethrowSerialized(
      new AtlasError(
        "ARCHIVE_UNAVAILABLE",
        atlasErrorMessage("ARCHIVE_UNAVAILABLE"),
      ),
    );
  }

  return {
    snapshotId,
    repository,
    commitSha,
    status: "in_progress",
    acquisitionMode,
    reused: false,
  };
}

export const acquireSnapshot = createServerFn({ method: "POST" })
  .validator((data: { repository: RepositoryIdentity; ref: string }) => data)
  .handler(({ data }) => acquireSnapshotHandler(data));

export type SnapshotStatusResponse = {
  snapshotId: number;
  status: SnapshotStatus;
  unitsCompleted: number;
  unitsTotalKnown: number | null;
  filesProcessed: number;
  bytesProcessed: number;
};

export async function getSnapshotStatusHandler(data: {
  snapshotId: number;
}): Promise<SnapshotStatusResponse> {
  const snapshot = await getSnapshotById(data.snapshotId);
  if (!snapshot) {
    rethrowSerialized(
      new AtlasError(
        "SNAPSHOT_NOT_FOUND",
        atlasErrorMessage("SNAPSHOT_NOT_FOUND"),
      ),
    );
  }
  const summary = await getSnapshotJobsSummary(data.snapshotId);
  return {
    snapshotId: data.snapshotId,
    status: snapshot.status,
    unitsCompleted: summary.unitsCompleted,
    unitsTotalKnown:
      snapshot.status === "completed" || snapshot.status === "failed"
        ? summary.unitsTotal
        : null,
    filesProcessed: summary.filesProcessed,
    bytesProcessed: summary.bytesProcessed,
  };
}

export const getSnapshotStatus = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number }) => data)
  .handler(({ data }) => getSnapshotStatusHandler(data));

export type SnapshotFilesPage = {
  files: { path: string; sizeBytes: number; contentHash: string }[];
  nextCursor: number | null;
};

export async function listSnapshotFilesHandler(data: {
  snapshotId: number;
  cursor?: number | undefined;
  limit?: number | undefined;
}): Promise<SnapshotFilesPage> {
  const config = codeIntelConfig();
  const snapshot = await getSnapshotById(data.snapshotId);
  if (!snapshot || snapshot.status !== "completed") {
    return { files: [], nextCursor: null }; // not ready — never throws (FR-009)
  }
  const limit = Math.min(
    data.limit ?? config.listFilesDefaultLimit,
    config.listFilesMaxLimit,
  );
  const page = await listSnapshotFilesPage(data.snapshotId, data.cursor, limit);
  return {
    files: page.files.map((f) => ({
      path: f.path,
      sizeBytes: f.sizeBytes,
      contentHash: f.contentHash,
    })),
    nextCursor: page.nextCursor,
  };
}

export const listSnapshotFiles = createServerFn({ method: "POST" })
  .validator(
    (data: {
      snapshotId: number;
      cursor?: number | undefined;
      limit?: number | undefined;
    }) => data,
  )
  .handler(({ data }) => listSnapshotFilesHandler(data));

export type SnapshotFileContent = {
  path: string;
  sizeBytes: number;
  contentHash: string;
  content: Uint8Array;
};

export async function getSnapshotFileHandler(data: {
  snapshotId: number;
  path: string;
}): Promise<SnapshotFileContent> {
  const row = await getSnapshotFileRow(data.snapshotId, data.path);
  if (!row) {
    rethrowSerialized(
      new AtlasError(
        "SNAPSHOT_NOT_FOUND",
        atlasErrorMessage("SNAPSHOT_NOT_FOUND"),
      ),
    );
  }
  const content = await getObject(row.r2Key);
  if (!content) {
    rethrowSerialized(
      new AtlasError(
        "SNAPSHOT_NOT_FOUND",
        atlasErrorMessage("SNAPSHOT_NOT_FOUND"),
      ),
    );
  }
  return {
    path: row.path,
    sizeBytes: row.sizeBytes,
    contentHash: row.contentHash,
    content,
  };
}

export const getSnapshotFile = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number; path: string }) => data)
  .handler(({ data }) => getSnapshotFileHandler(data));

export type RepositoryHistoryEntry = {
  snapshotId: number;
  commitSha: string;
  completedAt: string;
};

/** Completed snapshot history only (I1) — never a failed/in_progress attempt, never the acquisition attempt log. */
export async function getRepositoryHistoryHandler(data: {
  repository: RepositoryIdentity;
}): Promise<RepositoryHistoryEntry[]> {
  const repositoryId = await getOrCreateRepository(data.repository);
  const rows = await getRepositoryHistoryRows(repositoryId);
  return rows.map((r) => ({
    snapshotId: r.snapshotId,
    commitSha: r.commitSha,
    completedAt: r.completedAt,
  }));
}

export const getRepositoryHistory = createServerFn({ method: "POST" })
  .validator((data: { repository: RepositoryIdentity }) => data)
  .handler(({ data }) => getRepositoryHistoryHandler(data));
