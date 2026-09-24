import type { SupportedLanguage } from "../symbols/language-detector";

/**
 * Domain types for the AST + Symbol Intelligence feature's five D1 entities
 * (data-model.md). These model the *persisted* row shapes exactly — e.g.
 * `Symbol.id`/`Symbol.parentSymbolId` are D1 autoincrement ids, only
 * meaningful once a row exists. They are not the pre-persistence
 * intermediate representation `to-intermediate-representation.ts` (T028)
 * produces — that IR's shape (and how it threads a parent reference through
 * to a real `symbols.id` at insert time, T029) is a separate, not-yet-
 * decided design question, deliberately out of scope here.
 */

export type SymbolKind = "module" | "class" | "interface" | "function" | "method";

export type FileExtractionStatus = "extracted" | "skipped_unsupported" | "failed";

export type SnapshotExtractionStatus =
  "in_progress" | "completed" | "completed_partial" | "failed";

export type ExtractionJobStatus = "pending" | "retrying" | "failed" | "completed";

export type Directory = {
  id: number;
  snapshotId: number;
  path: string;
  parentPath: string | null;
};

export type FileExtraction = {
  id: number;
  snapshotId: number;
  snapshotFileId: number;
  directoryPath: string;
  language: SupportedLanguage | null;
  status: FileExtractionStatus;
  failureReason: string | null;
  extractorVersion: string;
  updatedAt: string;
};

export type Symbol = {
  id: number;
  fileExtractionId: number;
  snapshotId: number;
  kind: SymbolKind;
  name: string;
  qualifiedName: string | null;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  parentSymbolId: number | null;
  isExported: boolean | null;
  symbolKey: string;
  evidenceState: "EXTRACTED";
  extractorVersion: string;
  createdAt: string;
};

export type ExtractionJob = {
  id: number;
  snapshotId: number;
  unitIndex: number;
  status: ExtractionJobStatus;
  checkpointCursor: string | null;
  retryCount: number;
  failureReason: string | null;
  filesProcessed: number;
  symbolsExtracted: number;
  updatedAt: string;
};

export type SnapshotExtraction = {
  snapshotId: number;
  status: SnapshotExtractionStatus;
  extractorVersion: string;
  startedAt: string;
  completedAt: string | null;
};
