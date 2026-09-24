/**
 * SERVER-ONLY. SELECT-only read model for the Repository Intelligence view
 * (Feature 009 FR-005–FR-007, FR-010, SEC-001–SEC-003). It reads Feature 001
 * (`repositories`, `snapshots`, `snapshot_files`) and Feature 002
 * (`directories`, `file_extractions`, `symbols`, `snapshot_extractions`) data
 * and nothing else. No row is inserted (a missing repository yields
 * `no_snapshot`), no queue is touched, and no snapshot is acquired. Every
 * caller-supplied value is a bound parameter.
 */
import {
  getD1,
  type D1DatabaseLike,
} from "../code-intel/persistence/cloudflare-env";
import {
  getSnapshotExtractionRow,
  getSnapshotExtractionSummary,
} from "../code-intel/persistence/symbol-d1-client";
import { bucketKey, topBuckets } from "./composition";
import { MAX_CHILDREN_PAGE, MAX_SYMBOLS_FETCH } from "./limits";
import {
  baseName,
  directoryPrefix,
  normalizeDirectoryPath,
  normalizeFilePath,
  prefixUpperBound,
} from "./paths";
import { classifyFailure } from "./states";
import type {
  CompositionBucket,
  ExtractionSummary,
  FileExtractionState,
  FileSymbols,
  IntelligenceOverview,
  StructureLevel,
} from "./states";

/** Text after the last "." of the basename, "" if none (mirrors `extensionOf`). */
const BASE_EXPR =
  "substr(sf.path, length(rtrim(sf.path, replace(sf.path, '/', ''))) + 1)";
const EXT_EXPR = `CASE WHEN substr(${BASE_EXPR}, -1) = '.' OR instr(${BASE_EXPR}, '.') = 0 THEN '' ELSE lower(replace(${BASE_EXPR}, rtrim(${BASE_EXPR}, replace(${BASE_EXPR}, '.', '')), '')) END`;

const EXTRACTION_STATES: ExtractionSummary["status"][] = [
  "in_progress",
  "completed",
  "completed_partial",
  "failed",
];

interface CompletedSnapshot {
  id: number;
  commitSha: string;
  completedAt: string;
}

async function findCompletedSnapshot(
  db: D1DatabaseLike,
  owner: string,
  name: string,
): Promise<{
  snapshot: CompletedSnapshot | null;
  latestAttempt: string | null;
}> {
  const repo = await db
    .prepare(
      "SELECT id FROM repositories WHERE provider = 'github' AND owner = ? AND name = ?",
    )
    .bind(owner, name)
    .first<{ id: number }>();
  if (!repo) return { snapshot: null, latestAttempt: null };

  const completed = await db
    .prepare(
      `SELECT id, commit_sha AS commitSha, completed_at AS completedAt
       FROM snapshots WHERE repository_id = ? AND status = 'completed'
       ORDER BY completed_at DESC, id DESC LIMIT 1`,
    )
    .bind(repo.id)
    .first<CompletedSnapshot>();
  if (completed) return { snapshot: completed, latestAttempt: null };

  const latest = await db
    .prepare(
      `SELECT status FROM snapshots WHERE repository_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 1`,
    )
    .bind(repo.id)
    .first<{ status: string }>();
  return { snapshot: null, latestAttempt: latest?.status ?? null };
}

async function isCompleted(
  db: D1DatabaseLike,
  snapshotId: number,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT status FROM snapshots WHERE id = ?")
    .bind(snapshotId)
    .first<{ status: string }>();
  return row?.status === "completed";
}

export async function readOverview(
  owner: string,
  name: string,
  db: D1DatabaseLike = getD1(),
): Promise<IntelligenceOverview> {
  const { snapshot, latestAttempt } = await findCompletedSnapshot(
    db,
    owner,
    name,
  );
  if (!snapshot) {
    return latestAttempt === "pending" || latestAttempt === "in_progress"
      ? { status: "snapshot_in_progress", latestAttemptStatus: latestAttempt }
      : { status: "no_snapshot" };
  }

  const extractionRow = await getSnapshotExtractionRow(snapshot.id, db);
  const summary = extractionRow
    ? await getSnapshotExtractionSummary(snapshot.id, db)
    : null;
  const extraction: ExtractionSummary = {
    status:
      extractionRow && EXTRACTION_STATES.includes(extractionRow.status as never)
        ? (extractionRow.status as ExtractionSummary["status"])
        : "not_started",
    extractorVersion: extractionRow?.extractorVersion ?? null,
    filesTotal: summary?.filesTotal ?? 0,
    filesExtracted: summary?.filesExtracted ?? 0,
    filesSkippedUnsupported: summary?.filesSkippedUnsupported ?? 0,
    filesFailed: summary?.filesFailed ?? 0,
    symbolsExtracted: summary?.symbolsExtracted ?? 0,
  };

  const rows =
    (
      await db
        .prepare(
          `SELECT fe.language AS language, ${EXT_EXPR} AS ext,
                  COUNT(*) AS fileCount, COALESCE(SUM(sf.size_bytes), 0) AS bytes
           FROM snapshot_files sf
           LEFT JOIN file_extractions fe
             ON fe.snapshot_file_id = sf.id AND fe.snapshot_id = sf.snapshot_id
           WHERE sf.snapshot_id = ?
           GROUP BY fe.language, ext`,
        )
        .bind(snapshot.id)
        .all<{
          language: string | null;
          ext: string;
          fileCount: number;
          bytes: number;
        }>()
    ).results ?? [];

  const merged = new Map<string, CompositionBucket>();
  let files = 0;
  let bytes = 0;
  for (const row of rows) {
    const key = bucketKey(row.language, row.ext);
    const prev = merged.get(key) ?? { key, label: key, fileCount: 0, bytes: 0 };
    prev.fileCount += Number(row.fileCount);
    prev.bytes += Number(row.bytes);
    merged.set(key, prev);
    files += Number(row.fileCount);
    bytes += Number(row.bytes);
  }

  const dirCount = await db
    .prepare("SELECT COUNT(*) AS n FROM directories WHERE snapshot_id = ?")
    .bind(snapshot.id)
    .first<{ n: number }>();

  return {
    status: "ready",
    snapshot: {
      snapshotId: snapshot.id,
      commitSha: snapshot.commitSha,
      completedAt: snapshot.completedAt,
    },
    extraction,
    composition: topBuckets([...merged.values()]),
    totals: {
      files,
      bytes,
      directories:
        dirCount && Number(dirCount.n) > 0 ? Number(dirCount.n) : null,
    },
  };
}

const EMPTY_LEVEL = (directoryPath: string): StructureLevel => ({
  directoryPath,
  directories: [],
  files: [],
  nextCursor: null,
  truncated: false,
});

export async function readStructureLevel(
  input: {
    snapshotId: number;
    directoryPath?: string | undefined;
    cursor?: number | undefined;
    limit?: number | undefined;
    maxLimit?: number | undefined;
  },
  db: D1DatabaseLike = getD1(),
): Promise<StructureLevel> {
  const dir = normalizeDirectoryPath(input.directoryPath);
  if (dir === null) return EMPTY_LEVEL("");
  if (!(await isCompleted(db, input.snapshotId))) return EMPTY_LEVEL(dir);

  const cap = input.maxLimit ?? MAX_CHILDREN_PAGE;
  const limit = Math.max(1, Math.min(input.limit ?? MAX_CHILDREN_PAGE, cap));
  const offset = Math.max(0, Math.floor(input.cursor ?? 0));

  const prefix = directoryPrefix(dir);
  const upper = prefixUpperBound(prefix);
  const len = prefix.length;
  const range = prefix === "" ? "" : "AND sf.path >= ? AND sf.path < ?";
  const rangeParams = prefix === "" ? [] : [prefix, upper];
  const rest = `substr(sf.path, ${len + 1})`;

  // Child directories: distinct next path segment under the prefix, with file counts.
  const dirTotalRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT substr(${rest}, 1, instr(${rest}, '/') - 1) AS child
         FROM snapshot_files sf
         WHERE sf.snapshot_id = ? ${range} AND instr(${rest}, '/') > 0
         GROUP BY child)`,
    )
    .bind(input.snapshotId, ...rangeParams)
    .first<{ n: number }>();
  const dirTotal = Number(dirTotalRow?.n ?? 0);

  const dirRows =
    offset < dirTotal
      ? ((
          await db
            .prepare(
              `SELECT substr(${rest}, 1, instr(${rest}, '/') - 1) AS child,
                      COUNT(*) AS fileCount
               FROM snapshot_files sf
               WHERE sf.snapshot_id = ? ${range} AND instr(${rest}, '/') > 0
               GROUP BY child ORDER BY child LIMIT ? OFFSET ?`,
            )
            .bind(input.snapshotId, ...rangeParams, limit, offset)
            .all<{ child: string; fileCount: number }>()
        ).results ?? [])
      : [];

  const hasExtraction = Boolean(
    await getSnapshotExtractionRow(input.snapshotId, db),
  );
  const symbolCounts = new Map<string, number>();
  if (hasExtraction && dirRows.length > 0) {
    const rows =
      (
        await db
          .prepare(
            `SELECT substr(${rest}, 1, instr(${rest}, '/') - 1) AS child, COUNT(s.id) AS symbolCount
             FROM snapshot_files sf
             JOIN file_extractions fe
               ON fe.snapshot_file_id = sf.id AND fe.snapshot_id = sf.snapshot_id
             JOIN symbols s ON s.file_extraction_id = fe.id
             WHERE sf.snapshot_id = ? ${range} AND instr(${rest}, '/') > 0
             GROUP BY child`,
          )
          .bind(input.snapshotId, ...rangeParams)
          .all<{ child: string; symbolCount: number }>()
      ).results ?? [];
    for (const row of rows)
      symbolCounts.set(row.child, Number(row.symbolCount));
  }

  const dirsShown = dirRows.length;
  const fileOffset = Math.max(0, offset - dirTotal);
  const fileLimit = limit - dirsShown;

  // Files directly inside the directory.
  const fileTotalRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM snapshot_files sf
       WHERE sf.snapshot_id = ? ${range} AND instr(${rest}, '/') = 0`,
    )
    .bind(input.snapshotId, ...rangeParams)
    .first<{ n: number }>();
  const fileTotal = Number(fileTotalRow?.n ?? 0);

  const fileRows =
    fileLimit > 0
      ? ((
          await db
            .prepare(
              `SELECT sf.path AS path, sf.size_bytes AS sizeBytes,
                      fe.language AS language, fe.status AS status,
                      (SELECT COUNT(*) FROM symbols s WHERE s.file_extraction_id = fe.id) AS symbolCount
               FROM snapshot_files sf
               LEFT JOIN file_extractions fe
                 ON fe.snapshot_file_id = sf.id AND fe.snapshot_id = sf.snapshot_id
               WHERE sf.snapshot_id = ? ${range} AND instr(${rest}, '/') = 0
               ORDER BY sf.path LIMIT ? OFFSET ?`,
            )
            .bind(input.snapshotId, ...rangeParams, fileLimit, fileOffset)
            .all<{
              path: string;
              sizeBytes: number;
              language: string | null;
              status: string | null;
              symbolCount: number | null;
            }>()
        ).results ?? [])
      : [];

  const consumed = offset + dirsShown + fileRows.length;
  const total = dirTotal + fileTotal;
  const nextCursor = consumed < total ? consumed : null;

  return {
    directoryPath: dir,
    directories: dirRows.map((row) => ({
      path: prefix + row.child,
      name: row.child,
      fileCount: Number(row.fileCount),
      symbolCount: hasExtraction ? (symbolCounts.get(row.child) ?? 0) : null,
    })),
    files: fileRows.map((row) => ({
      path: row.path,
      name: baseName(row.path),
      sizeBytes: Number(row.sizeBytes),
      language: row.language,
      extractionStatus: (row.status ?? "not_attempted") as FileExtractionState,
      symbolCount: Number(row.symbolCount ?? 0),
    })),
    nextCursor,
    truncated: nextCursor !== null,
  };
}

export async function readFileSymbols(
  input: { snapshotId: number; path: string },
  db: D1DatabaseLike = getD1(),
): Promise<FileSymbols> {
  const path = normalizeFilePath(input.path);
  const notAttempted = (p: string): FileSymbols => ({
    path: p,
    language: null,
    extractionStatus: "not_attempted",
    failureKind: null,
    symbolCount: 0,
    symbols: [],
    truncated: false,
  });
  if (path === null) return notAttempted("");
  if (!(await isCompleted(db, input.snapshotId))) return notAttempted(path);

  const file = await db
    .prepare(
      `SELECT sf.id AS fileId, fe.id AS extractionId, fe.language AS language,
              fe.status AS status, fe.failure_reason AS failureReason
       FROM snapshot_files sf
       LEFT JOIN file_extractions fe
         ON fe.snapshot_file_id = sf.id AND fe.snapshot_id = sf.snapshot_id
       WHERE sf.snapshot_id = ? AND sf.path = ?`,
    )
    .bind(input.snapshotId, path)
    .first<{
      fileId: number;
      extractionId: number | null;
      language: string | null;
      status: string | null;
      failureReason: string | null;
    }>();
  if (!file) return notAttempted(path);
  if (file.extractionId === null) {
    return { ...notAttempted(path), extractionStatus: "not_attempted" };
  }

  const count = await db
    .prepare("SELECT COUNT(*) AS n FROM symbols WHERE file_extraction_id = ?")
    .bind(file.extractionId)
    .first<{ n: number }>();
  const symbolCount = Number(count?.n ?? 0);

  const symbols =
    (
      await db
        .prepare(
          `SELECT id, kind, name, qualified_name AS qualifiedName,
                  start_line AS startLine, start_column AS startColumn,
                  end_line AS endLine, end_column AS endColumn,
                  parent_symbol_id AS parentSymbolId
           FROM symbols WHERE file_extraction_id = ?
           ORDER BY start_line, start_column, id LIMIT ?`,
        )
        .bind(file.extractionId, MAX_SYMBOLS_FETCH)
        .all<{
          id: number;
          kind: string;
          name: string;
          qualifiedName: string | null;
          startLine: number;
          startColumn: number;
          endLine: number;
          endColumn: number;
          parentSymbolId: number | null;
        }>()
    ).results ?? [];

  return {
    path,
    language: file.language,
    extractionStatus: (file.status ?? "not_attempted") as FileExtractionState,
    failureKind: classifyFailure(file.failureReason),
    symbolCount,
    symbols,
    truncated: symbolCount > symbols.length,
  };
}
