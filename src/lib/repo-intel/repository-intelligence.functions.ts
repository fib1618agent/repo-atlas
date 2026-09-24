/**
 * Read-only server functions for the Repository Intelligence view (Feature
 * 009, specs/009-…/contracts/server-functions.md). Plain handlers plus
 * `createServerFn` wrappers (same split as Features 001, 002 and 006). Every
 * handler is SELECT-only, validates input, and returns typed states instead of
 * throwing; no message, path, SQL or identifier text leaves the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { codeIntelConfig } from "../code-intel/config";
import { canUseD1 } from "../code-intel/persistence/cloudflare-env";
import { toIdentity } from "./identity";
import {
  readFileSymbols,
  readOverview,
  readStructureLevel,
} from "./intelligence-read-model";
import { normalizeDirectoryPath, normalizeFilePath } from "./paths";
import type { FileSymbols, OverviewResult, StructureLevel } from "./states";

const positiveInt = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n > 0;

export async function getRepositoryIntelligenceHandler(data: {
  owner: string;
  name: string;
}): Promise<OverviewResult> {
  const identity = toIdentity(
    String(data?.owner ?? ""),
    String(data?.name ?? ""),
  );
  if (!identity) return { status: "invalid_request" };
  if (!canUseD1()) return { status: "unavailable", reason: "no_binding" };
  try {
    return await readOverview(identity.owner, identity.name);
  } catch {
    return { status: "unavailable", reason: "query_failed" };
  }
}

export const getRepositoryIntelligence = createServerFn({ method: "POST" })
  .validator((data: { owner: string; name: string }) => data)
  .handler(({ data }) => getRepositoryIntelligenceHandler(data));

const emptyLevel = (
  directoryPath: string,
  error?: "query_failed",
): StructureLevel => ({
  directoryPath,
  ...(error ? { error } : {}),
  directories: [],
  files: [],
  nextCursor: null,
  truncated: false,
});

export async function listStructureLevelHandler(data: {
  snapshotId: number;
  directoryPath?: string | undefined;
  cursor?: number | undefined;
  limit?: number | undefined;
}): Promise<StructureLevel> {
  const dir = normalizeDirectoryPath(data?.directoryPath);
  if (!positiveInt(data?.snapshotId) || dir === null || !canUseD1()) {
    return emptyLevel(dir ?? "");
  }
  try {
    return await readStructureLevel({
      snapshotId: data.snapshotId,
      directoryPath: dir,
      cursor: data.cursor,
      limit: data.limit,
      maxLimit: codeIntelConfig().listFilesMaxLimit,
    });
  } catch {
    return emptyLevel(dir, "query_failed");
  }
}

export const listStructureLevel = createServerFn({ method: "POST" })
  .validator(
    (data: {
      snapshotId: number;
      directoryPath?: string | undefined;
      cursor?: number | undefined;
      limit?: number | undefined;
    }) => data,
  )
  .handler(({ data }) => listStructureLevelHandler(data));

const emptySymbols = (path: string, error?: "query_failed"): FileSymbols => ({
  path,
  language: null,
  extractionStatus: "not_attempted",
  failureKind: null,
  ...(error ? { error } : {}),
  symbolCount: 0,
  symbols: [],
  truncated: false,
});

export async function listFileSymbolsHandler(data: {
  snapshotId: number;
  path: string;
}): Promise<FileSymbols> {
  const path = normalizeFilePath(String(data?.path ?? ""));
  if (!positiveInt(data?.snapshotId) || path === null || !canUseD1()) {
    return emptySymbols(path ?? "");
  }
  try {
    return await readFileSymbols({ snapshotId: data.snapshotId, path });
  } catch {
    return emptySymbols(path, "query_failed");
  }
}

export const listFileSymbols = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number; path: string }) => data)
  .handler(({ data }) => listFileSymbolsHandler(data));
