import type {
  ExtractionJobStatus,
  FileExtractionStatus,
  SnapshotExtractionStatus,
  SymbolKind,
} from "../domain/symbol";
import type { SymbolIR } from "../symbols/to-intermediate-representation";
import { getD1, type D1DatabaseLike } from "./cloudflare-env";

/**
 * Thin D1 query layer for Feature 002's own tables (directories,
 * file_extractions, symbols, extraction_jobs, snapshot_extractions) — same
 * `D1DatabaseLike` pattern as Feature 001's `persistence/d1-client.ts`,
 * unmodified. Every function takes an explicit `db` parameter (defaults to
 * `getD1()`) for the same reason Feature 001's does: tests inject a
 * `bun:sqlite`-backed double without a live Cloudflare account.
 */

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// directories (FR-006)
// ---------------------------------------------------------------------------

export async function getOrCreateDirectory(
  snapshotId: number,
  path: string,
  parentPath: string | null,
  db: D1DatabaseLike = getD1(),
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO directories (snapshot_id, path, parent_path) VALUES (?, ?, ?)
       ON CONFLICT (snapshot_id, path) DO NOTHING`,
    )
    .bind(snapshotId, path, parentPath)
    .run();
  const row = await db
    .prepare(`SELECT id FROM directories WHERE snapshot_id = ? AND path = ?`)
    .bind(snapshotId, path)
    .first<{ id: number }>();
  if (!row) throw new Error("getOrCreateDirectory: row missing immediately after insert");
  return row.id;
}

// ---------------------------------------------------------------------------
// file_extractions (FR-016, FR-017)
// ---------------------------------------------------------------------------

export type UpsertFileExtractionParams = {
  snapshotId: number;
  snapshotFileId: number;
  directoryPath: string;
  language: string | null;
  status: FileExtractionStatus;
  failureReason: string | null;
  extractorVersion: string;
};

/** One current row per (snapshot, file) — re-extraction REPLACES it (data-model.md), never creates a second row. */
export async function upsertFileExtraction(
  params: UpsertFileExtractionParams,
  db: D1DatabaseLike = getD1(),
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO file_extractions (snapshot_id, snapshot_file_id, directory_path, language, status, failure_reason, extractor_version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (snapshot_id, snapshot_file_id) DO UPDATE SET
         directory_path = excluded.directory_path,
         language = excluded.language,
         status = excluded.status,
         failure_reason = excluded.failure_reason,
         extractor_version = excluded.extractor_version,
         updated_at = excluded.updated_at`,
    )
    .bind(
      params.snapshotId,
      params.snapshotFileId,
      params.directoryPath,
      params.language,
      params.status,
      params.failureReason,
      params.extractorVersion,
      nowIso(),
    )
    .run();
  const row = await db
    .prepare(`SELECT id FROM file_extractions WHERE snapshot_id = ? AND snapshot_file_id = ?`)
    .bind(params.snapshotId, params.snapshotFileId)
    .first<{ id: number }>();
  if (!row) throw new Error("upsertFileExtraction: row missing immediately after upsert");
  return row.id;
}

export async function getFileExtractionRow(
  snapshotId: number,
  path: string,
  db: D1DatabaseLike = getD1(),
): Promise<{
  path: string;
  language: string | null;
  status: FileExtractionStatus;
  failureReason: string | null;
  extractorVersion: string;
  symbolCount: number;
} | null> {
  const snapshotFile = await db
    .prepare(`SELECT id FROM snapshot_files WHERE snapshot_id = ? AND path = ?`)
    .bind(snapshotId, path)
    .first<{ id: number }>();
  if (!snapshotFile) return null;

  const row = await db
    .prepare(
      `SELECT id, language, status, failure_reason as failureReason, extractor_version as extractorVersion
       FROM file_extractions WHERE snapshot_id = ? AND snapshot_file_id = ?`,
    )
    .bind(snapshotId, snapshotFile.id)
    .first<{
      id: number;
      language: string | null;
      status: FileExtractionStatus;
      failureReason: string | null;
      extractorVersion: string;
    }>();
  if (!row) return null;

  const symbolCount = await db
    .prepare(`SELECT COUNT(*) as count FROM symbols WHERE file_extraction_id = ?`)
    .bind(row.id)
    .first<{ count: number }>();

  return {
    path,
    language: row.language,
    status: row.status,
    failureReason: row.failureReason,
    extractorVersion: row.extractorVersion,
    symbolCount: symbolCount?.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// symbols (FR-008, FR-009, FR-010, FR-013 — parent/child resolution, data-model.md
// "Parent/child resolution (IR → D1)")
// ---------------------------------------------------------------------------

/**
 * File-scoped replace: deletes every existing `symbols` row for this
 * `fileExtractionId` (clearing stale symbols/parent relationships from a
 * prior extraction of this file — data-model.md's re-extraction mechanism),
 * then persists `symbols` via a two-pass write:
 *  1. insert every IR symbol with `parent_symbol_id = NULL`, capturing each
 *     row's D1-generated `id` (`meta.last_row_id`) to build a
 *     `symbolKey → id` map (`symbolKey` is IR-only input here, never a D1
 *     column — see data-model.md);
 *  2. resolve each symbol's `parentSymbolKey` through that map and `UPDATE
 *     parent_symbol_id` for the symbols that have one.
 * Deliberately NOT one atomic `db.batch()` across both passes (impossible —
 * pass 2 needs pass 1's generated ids, unknowable before pass 1 runs); the
 * delete + pass-1 inserts ARE one atomic batch, and pass 2 is a second,
 * separate batch, exactly as recorded in data-model.md/plan.md/tasks.md.
 * A zero-symbol file (`symbols.length === 0`) still runs the delete (clearing
 * any stale rows from a prior run) and skips both passes — correct, not an
 * error.
 */
export async function replaceSymbolsForFile(
  fileExtractionId: number,
  snapshotId: number,
  symbols: SymbolIR[],
  extractorVersion: string,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  const deleteStatement = db
    .prepare(`DELETE FROM symbols WHERE file_extraction_id = ?`)
    .bind(fileExtractionId);

  if (symbols.length === 0) {
    await db.batch([deleteStatement]);
    return;
  }

  const createdAt = nowIso();
  const insertStatements = symbols.map((symbol) =>
    db
      .prepare(
        `INSERT INTO symbols (file_extraction_id, snapshot_id, kind, name, qualified_name, start_line, start_column, end_line, end_column, parent_symbol_id, is_exported, symbol_key, evidence_state, extractor_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'EXTRACTED', ?, ?)`,
      )
      .bind(
        fileExtractionId,
        snapshotId,
        symbol.kind,
        symbol.name,
        symbol.qualifiedName,
        symbol.startLine,
        symbol.startColumn,
        symbol.endLine,
        symbol.endColumn,
        symbol.symbolKey,
        extractorVersion,
        createdAt,
      ),
  );

  const insertResults = await db.batch([deleteStatement, ...insertStatements]);
  // insertResults[0] is the DELETE's result; insertResults[i + 1] corresponds
  // to symbols[i], same order the statements were submitted in.
  const symbolKeyToId = new Map<string, number>();
  for (let i = 0; i < symbols.length; i++) {
    const id = insertResults[i + 1]?.meta.last_row_id;
    if (id === undefined) {
      throw new Error(
        `replaceSymbolsForFile: no last_row_id returned for symbol_key "${symbols[i]!.symbolKey}"`,
      );
    }
    symbolKeyToId.set(symbols[i]!.symbolKey, id);
  }

  const updateStatements = symbols
    .filter((symbol) => symbol.parentSymbolKey !== null)
    .map((symbol) => {
      const childId = symbolKeyToId.get(symbol.symbolKey);
      const parentId = symbolKeyToId.get(symbol.parentSymbolKey!);
      if (childId === undefined || parentId === undefined) {
        throw new Error(
          `replaceSymbolsForFile: could not resolve parentSymbolKey "${symbol.parentSymbolKey}" for symbol_key "${symbol.symbolKey}" within this file's own symbol set`,
        );
      }
      return db
        .prepare(`UPDATE symbols SET parent_symbol_id = ? WHERE id = ?`)
        .bind(parentId, childId);
    });

  if (updateStatements.length > 0) await db.batch(updateStatements);
}

export async function listSymbolsPage(
  snapshotId: number,
  cursor: number | undefined,
  limit: number,
  kind?: SymbolKind,
  directoryPath?: string,
  db: D1DatabaseLike = getD1(),
): Promise<{
  symbols: {
    id: number;
    kind: SymbolKind;
    name: string;
    qualifiedName: string | null;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    parentSymbolId: number | null;
  }[];
  nextCursor: number | null;
}> {
  const conditions = ["s.snapshot_id = ?", "s.id > ?"];
  const params: unknown[] = [snapshotId, cursor ?? 0];
  if (kind) {
    conditions.push("s.kind = ?");
    params.push(kind);
  }
  if (directoryPath !== undefined) {
    conditions.push("(fe.directory_path = ? OR fe.directory_path LIKE ?)");
    params.push(directoryPath, `${directoryPath}/%`);
  }
  params.push(limit + 1);

  const result = await db
    .prepare(
      `SELECT s.id, s.kind, s.name, s.qualified_name as qualifiedName, s.start_line as startLine,
              s.start_column as startColumn, s.end_line as endLine, s.end_column as endColumn,
              s.parent_symbol_id as parentSymbolId
       FROM symbols s JOIN file_extractions fe ON fe.id = s.file_extraction_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.id ASC LIMIT ?`,
    )
    .bind(...params)
    .all<{
      id: number;
      kind: SymbolKind;
      name: string;
      qualifiedName: string | null;
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
      parentSymbolId: number | null;
    }>();

  const rows = result.results ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    symbols: page,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

export async function getSymbolWithProvenance(
  symbolId: number,
  db: D1DatabaseLike = getD1(),
): Promise<{
  id: number;
  kind: SymbolKind;
  name: string;
  qualifiedName: string | null;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  parentSymbolId: number | null;
  isExported: boolean | null;
  filePath: string;
  snapshotId: number;
  provider: "github" | "gitlab";
  owner: string;
  repoName: string;
  commitSha: string;
} | null> {
  const row = await db
    .prepare(
      `SELECT s.id, s.kind, s.name, s.qualified_name as qualifiedName, s.start_line as startLine,
              s.start_column as startColumn, s.end_line as endLine, s.end_column as endColumn,
              s.parent_symbol_id as parentSymbolId, s.is_exported as isExported,
              sf.path as filePath, sn.id as snapshotId, sn.commit_sha as commitSha,
              r.provider as provider, r.owner as owner, r.name as repoName
       FROM symbols s
       JOIN file_extractions fe ON fe.id = s.file_extraction_id
       JOIN snapshot_files sf ON sf.id = fe.snapshot_file_id
       JOIN snapshots sn ON sn.id = fe.snapshot_id
       JOIN repositories r ON r.id = sn.repository_id
       WHERE s.id = ?`,
    )
    .bind(symbolId)
    .first<{
      id: number;
      kind: SymbolKind;
      name: string;
      qualifiedName: string | null;
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
      parentSymbolId: number | null;
      isExported: number | null;
      filePath: string;
      snapshotId: number;
      commitSha: string;
      provider: "github" | "gitlab";
      owner: string;
      repoName: string;
    }>();
  if (!row) return null;
  return { ...row, isExported: row.isExported === null ? null : row.isExported === 1 };
}

// ---------------------------------------------------------------------------
// extraction_jobs (mirrors d1-client.ts's acquisition_jobs functions)
// ---------------------------------------------------------------------------

export async function upsertExtractionJob(
  snapshotId: number,
  unitIndex: number,
  status: ExtractionJobStatus,
  checkpointCursor: string | null,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO extraction_jobs (snapshot_id, unit_index, status, checkpoint_cursor, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (snapshot_id, unit_index) DO UPDATE SET
         status = CASE WHEN extraction_jobs.status = 'completed' THEN extraction_jobs.status ELSE excluded.status END,
         checkpoint_cursor = excluded.checkpoint_cursor,
         updated_at = excluded.updated_at`,
    )
    .bind(snapshotId, unitIndex, status, checkpointCursor, nowIso())
    .run();
}

export async function markJobCompleted(
  snapshotId: number,
  unitIndex: number,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  await db
    .prepare(
      `UPDATE extraction_jobs SET status = 'completed', updated_at = ? WHERE snapshot_id = ? AND unit_index = ?`,
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
      `UPDATE extraction_jobs SET status = 'retrying', retry_count = retry_count + 1, failure_reason = ?, updated_at = ?
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
      `UPDATE extraction_jobs SET status = 'failed', failure_reason = ?, updated_at = ?
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
    .prepare(`SELECT retry_count as retryCount FROM extraction_jobs WHERE snapshot_id = ? AND unit_index = ?`)
    .bind(snapshotId, unitIndex)
    .first<{ retryCount: number }>();
  return row?.retryCount ?? 0;
}

/** Recomputed (set, not incremented) from file_extractions/symbols — retry-safe, mirrors d1-client.ts's recomputeJobCounters exactly (whole-snapshot aggregate, not unit-scoped — same established precedent). */
export async function recomputeJobCounters(
  snapshotId: number,
  unitIndex: number,
  db: D1DatabaseLike = getD1(),
): Promise<void> {
  const filesProcessed = await db
    .prepare(`SELECT COUNT(*) as count FROM file_extractions WHERE snapshot_id = ?`)
    .bind(snapshotId)
    .first<{ count: number }>();
  const symbolsExtracted = await db
    .prepare(`SELECT COUNT(*) as count FROM symbols WHERE snapshot_id = ?`)
    .bind(snapshotId)
    .first<{ count: number }>();
  await db
    .prepare(
      `UPDATE extraction_jobs SET files_processed = ?, symbols_extracted = ?, updated_at = ? WHERE snapshot_id = ? AND unit_index = ?`,
    )
    .bind(filesProcessed?.count ?? 0, symbolsExtracted?.count ?? 0, nowIso(), snapshotId, unitIndex)
    .run();
}

// ---------------------------------------------------------------------------
// snapshot_extractions (FR-015, FR-016)
// ---------------------------------------------------------------------------

export type SnapshotExtractionRow = {
  snapshotId: number;
  status: SnapshotExtractionStatus;
  extractorVersion: string;
  startedAt: string;
  completedAt: string | null;
};

/** Ensures a row exists, creating one (status='in_progress') if absent; never mutates an already-existing row (the reuse-vs-restart decision belongs to the caller, e.g. a future extractSnapshotSymbols handler). */
export async function getOrCreateSnapshotExtraction(
  snapshotId: number,
  extractorVersion: string,
  db: D1DatabaseLike = getD1(),
): Promise<SnapshotExtractionRow> {
  await db
    .prepare(
      `INSERT INTO snapshot_extractions (snapshot_id, status, extractor_version, started_at, completed_at)
       VALUES (?, 'in_progress', ?, ?, NULL)
       ON CONFLICT (snapshot_id) DO NOTHING`,
    )
    .bind(snapshotId, extractorVersion, nowIso())
    .run();
  const row = await db
    .prepare(
      `SELECT snapshot_id as snapshotId, status, extractor_version as extractorVersion, started_at as startedAt, completed_at as completedAt
       FROM snapshot_extractions WHERE snapshot_id = ?`,
    )
    .bind(snapshotId)
    .first<SnapshotExtractionRow>();
  if (!row) throw new Error("getOrCreateSnapshotExtraction: row missing immediately after upsert");
  return row;
}

/** Read-only peek at a snapshot's extraction state, never creates a row — for callers (e.g. `extractSnapshotSymbols`, T032) that must inspect existing state before deciding whether to reuse/restart/no-op, unlike `getOrCreateSnapshotExtraction`'s create-on-absence contract. */
export async function getSnapshotExtractionRow(
  snapshotId: number,
  db: D1DatabaseLike = getD1(),
): Promise<SnapshotExtractionRow | null> {
  return db
    .prepare(
      `SELECT snapshot_id as snapshotId, status, extractor_version as extractorVersion, started_at as startedAt, completed_at as completedAt
       FROM snapshot_extractions WHERE snapshot_id = ?`,
    )
    .bind(snapshotId)
    .first<SnapshotExtractionRow>();
}

/** Resets a snapshot to a fresh in-progress extraction under `extractorVersion` — used both to create a first-ever row and to restart after an extractor/grammar version bump (FR-014). Clears `extraction_jobs` for this snapshot so a stale `unit_index = 0` row from a prior run's `status = 'completed'` can't cause the new run's first unit to be skipped as already-done (`upsertExtractionJob`'s ON CONFLICT preserves 'completed' status, which would otherwise block re-processing under the new version). */
export async function restartSnapshotExtraction(
  snapshotId: number,
  extractorVersion: string,
  db: D1DatabaseLike = getD1(),
): Promise<SnapshotExtractionRow> {
  await db
    .prepare(`DELETE FROM extraction_jobs WHERE snapshot_id = ?`)
    .bind(snapshotId)
    .run();
  await db
    .prepare(
      `INSERT INTO snapshot_extractions (snapshot_id, status, extractor_version, started_at, completed_at)
       VALUES (?, 'in_progress', ?, ?, NULL)
       ON CONFLICT (snapshot_id) DO UPDATE SET
         status = 'in_progress', extractor_version = excluded.extractor_version,
         started_at = excluded.started_at, completed_at = NULL`,
    )
    .bind(snapshotId, extractorVersion, nowIso())
    .run();
  const row = await getSnapshotExtractionRow(snapshotId, db);
  if (!row) throw new Error("restartSnapshotExtraction: row missing immediately after upsert");
  return row;
}

/** Guarded, idempotent finalization — a redelivered/retried call after the row is already terminal is a safe no-op, mirroring Feature 001's finalizeSnapshotCompleted guard pattern. */
export async function finalizeSnapshotExtraction(
  snapshotId: number,
  status: "completed" | "completed_partial" | "failed",
  db: D1DatabaseLike = getD1(),
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE snapshot_extractions SET status = ?, completed_at = ?
       WHERE snapshot_id = ? AND status NOT IN ('completed', 'completed_partial', 'failed')`,
    )
    .bind(status, nowIso(), snapshotId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function getSnapshotExtractionSummary(
  snapshotId: number,
  db: D1DatabaseLike = getD1(),
): Promise<{
  filesTotal: number;
  filesExtracted: number;
  filesSkippedUnsupported: number;
  filesFailed: number;
  symbolsExtracted: number;
}> {
  const files = await db
    .prepare(
      `SELECT
         COUNT(*) as filesTotal,
         SUM(CASE WHEN status = 'extracted' THEN 1 ELSE 0 END) as filesExtracted,
         SUM(CASE WHEN status = 'skipped_unsupported' THEN 1 ELSE 0 END) as filesSkippedUnsupported,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as filesFailed
       FROM file_extractions WHERE snapshot_id = ?`,
    )
    .bind(snapshotId)
    .first<{
      filesTotal: number;
      filesExtracted: number;
      filesSkippedUnsupported: number;
      filesFailed: number;
    }>();
  const symbols = await db
    .prepare(`SELECT COUNT(*) as count FROM symbols WHERE snapshot_id = ?`)
    .bind(snapshotId)
    .first<{ count: number }>();
  return {
    filesTotal: files?.filesTotal ?? 0,
    filesExtracted: files?.filesExtracted ?? 0,
    filesSkippedUnsupported: files?.filesSkippedUnsupported ?? 0,
    filesFailed: files?.filesFailed ?? 0,
    symbolsExtracted: symbols?.count ?? 0,
  };
}
