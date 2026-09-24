import { createServerFn } from "@tanstack/react-start";
import { AtlasError, atlasErrorMessage, serializeAtlasError } from "../atlas-errors";
import { getSnapshotById } from "./persistence/d1-client";
import {
  getFileExtractionRow,
  getSnapshotExtractionRow,
  getSnapshotExtractionSummary,
  getSymbolWithProvenance,
  listSymbolsPage,
  restartSnapshotExtraction,
} from "./persistence/symbol-d1-client";
import { getSymbolQueue } from "./persistence/cloudflare-env";
import { codeIntelConfig, SYMBOL_EXTRACTOR_VERSION } from "./config";
import type { SymbolQueueMessage } from "./symbols/symbol-worker";
import type { SnapshotExtractionStatus, SymbolKind } from "./domain/symbol";

/**
 * Plain, directly-callable handler functions (business logic) + thin
 * `createServerFn` wrappers around them — same split as Feature 001's
 * `snapshot.functions.ts` (AsyncLocalStorage request context unavailable
 * under plain `bun test`, so tests call the handler directly).
 */

function rethrowSerialized(error: AtlasError): never {
  throw new Error(JSON.stringify(serializeAtlasError(error)));
}

export type ExtractSnapshotSymbolsResponse = {
  snapshotId: number;
  status: SnapshotExtractionStatus;
  extractorVersion: string;
  /** true when an existing extraction for the current extractorVersion was returned instead of starting a new one */
  reused: boolean;
};

export async function extractSnapshotSymbolsHandler(data: {
  snapshotId: number;
}): Promise<ExtractSnapshotSymbolsResponse> {
  const { snapshotId } = data;

  const snapshot = await getSnapshotById(snapshotId);
  if (!snapshot || snapshot.status !== "completed") {
    rethrowSerialized(
      new AtlasError("SNAPSHOT_NOT_EXTRACTABLE", atlasErrorMessage("SNAPSHOT_NOT_EXTRACTABLE")),
    );
  }

  const existing = await getSnapshotExtractionRow(snapshotId);

  if (existing?.status === "in_progress") {
    // Concurrent request — return as-is, no duplicate ExtractionJob sequence.
    return {
      snapshotId,
      status: existing.status,
      extractorVersion: existing.extractorVersion,
      reused: true,
    };
  }

  if (
    existing &&
    existing.extractorVersion === SYMBOL_EXTRACTOR_VERSION &&
    (existing.status === "completed" || existing.status === "completed_partial")
  ) {
    return {
      snapshotId,
      status: existing.status,
      extractorVersion: existing.extractorVersion,
      reused: true,
    };
  }

  // No row, an extractor/grammar version bump, or a prior 'failed' attempt
  // under the current version — all start a fresh run (FR-014).
  const restarted = await restartSnapshotExtraction(snapshotId, SYMBOL_EXTRACTOR_VERSION);

  await getSymbolQueue().send({
    snapshotId,
    unitIndex: 0,
    fromCursor: 0,
  } satisfies SymbolQueueMessage);

  return {
    snapshotId,
    status: restarted.status,
    extractorVersion: restarted.extractorVersion,
    reused: false,
  };
}

export const extractSnapshotSymbols = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number }) => data)
  .handler(({ data }) => extractSnapshotSymbolsHandler(data));

export type SymbolDetail = {
  id: number;
  kind: string;
  name: string;
  qualifiedName: string | null;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  parentSymbolId: number | null;
  isExported: boolean | null;
  provenance: {
    filePath: string;
    snapshotId: number;
    repository: { provider: "github" | "gitlab"; owner: string; name: string };
    commitSha: string;
  };
};

export async function getSymbolHandler(data: { symbolId: number }): Promise<SymbolDetail> {
  const row = await getSymbolWithProvenance(data.symbolId);
  if (!row) {
    rethrowSerialized(new AtlasError("SYMBOL_NOT_FOUND", atlasErrorMessage("SYMBOL_NOT_FOUND")));
  }
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    qualifiedName: row.qualifiedName,
    startLine: row.startLine,
    startColumn: row.startColumn,
    endLine: row.endLine,
    endColumn: row.endColumn,
    parentSymbolId: row.parentSymbolId,
    isExported: row.isExported,
    provenance: {
      filePath: row.filePath,
      snapshotId: row.snapshotId,
      repository: { provider: row.provider, owner: row.owner, name: row.repoName },
      commitSha: row.commitSha,
    },
  };
}

export const getSymbol = createServerFn({ method: "POST" })
  .validator((data: { symbolId: number }) => data)
  .handler(({ data }) => getSymbolHandler(data));

export type ExtractionStatusResponse = {
  snapshotId: number;
  status: "not_started" | SnapshotExtractionStatus;
  extractorVersion: string | null;
  filesTotal: number;
  filesExtracted: number;
  filesSkippedUnsupported: number;
  filesFailed: number;
  symbolsExtracted: number;
};

/** `status: "not_started"` (never an error) when no `snapshot_extractions` row exists yet — mirrors Feature 001's `listSnapshotFiles` "never throws" precedent (contracts/extract-symbols.functions.md). */
export async function getExtractionStatusHandler(data: {
  snapshotId: number;
}): Promise<ExtractionStatusResponse> {
  const { snapshotId } = data;
  const row = await getSnapshotExtractionRow(snapshotId);
  if (!row) {
    return {
      snapshotId,
      status: "not_started",
      extractorVersion: null,
      filesTotal: 0,
      filesExtracted: 0,
      filesSkippedUnsupported: 0,
      filesFailed: 0,
      symbolsExtracted: 0,
    };
  }
  const summary = await getSnapshotExtractionSummary(snapshotId);
  return {
    snapshotId,
    status: row.status,
    extractorVersion: row.extractorVersion,
    ...summary,
  };
}

export const getExtractionStatus = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number }) => data)
  .handler(({ data }) => getExtractionStatusHandler(data));

export type FileExtractionDetail = {
  path: string;
  language: string | null;
  status: "not_attempted" | "extracted" | "skipped_unsupported" | "failed";
  failureReason: string | null;
  extractorVersion: string | null;
  symbolCount: number;
};

/** `status: "not_attempted"` (never throws) when no `file_extractions` row exists yet — unit not yet processed, or extraction never run (contracts/symbol-query.functions.md). */
export async function getFileExtractionHandler(data: {
  snapshotId: number;
  path: string;
}): Promise<FileExtractionDetail> {
  const row = await getFileExtractionRow(data.snapshotId, data.path);
  if (!row) {
    return {
      path: data.path,
      language: null,
      status: "not_attempted",
      failureReason: null,
      extractorVersion: null,
      symbolCount: 0,
    };
  }
  return row;
}

export const getFileExtraction = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number; path: string }) => data)
  .handler(({ data }) => getFileExtractionHandler(data));

export type SymbolsPage = {
  symbols: {
    id: number;
    kind: string;
    name: string;
    qualifiedName: string | null;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    parentSymbolId: number | null;
  }[];
  nextCursor: number | null;
};

/** Empty page (never throws) for a snapshot with no `snapshot_extractions` row — mirrors Feature 001's `listSnapshotFiles` FR-009 precedent (contracts/symbol-query.functions.md). */
export async function listSymbolsHandler(data: {
  snapshotId: number;
  kind?: SymbolKind | undefined;
  directoryPath?: string | undefined;
  cursor?: number | undefined;
  limit?: number | undefined;
}): Promise<SymbolsPage> {
  const extraction = await getSnapshotExtractionRow(data.snapshotId);
  if (!extraction) return { symbols: [], nextCursor: null };

  const config = codeIntelConfig();
  const limit = Math.min(data.limit ?? config.listFilesDefaultLimit, config.listFilesMaxLimit);
  return listSymbolsPage(data.snapshotId, data.cursor, limit, data.kind, data.directoryPath);
}

export const listSymbols = createServerFn({ method: "POST" })
  .validator(
    (data: {
      snapshotId: number;
      kind?: SymbolKind | undefined;
      directoryPath?: string | undefined;
      cursor?: number | undefined;
      limit?: number | undefined;
    }) => data,
  )
  .handler(({ data }) => listSymbolsHandler(data));
