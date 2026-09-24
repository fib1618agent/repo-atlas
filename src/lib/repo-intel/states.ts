/**
 * DTO and state types for the Repository Intelligence view (Feature 009,
 * specs/009-…/data-model.md). JSON-serializable only.
 */

export type ExtractionStatus =
  "not_started" | "in_progress" | "completed" | "completed_partial" | "failed";

export interface ExtractionSummary {
  status: ExtractionStatus;
  extractorVersion: string | null;
  filesTotal: number;
  filesExtracted: number;
  filesSkippedUnsupported: number;
  filesFailed: number;
  symbolsExtracted: number;
}

export interface CompositionBucket {
  key: string;
  label: string;
  fileCount: number;
  bytes: number;
}

export interface Composition {
  buckets: CompositionBucket[];
  otherFileCount: number;
  otherBytes: number;
}

export interface SnapshotSummary {
  snapshotId: number;
  commitSha: string;
  completedAt: string;
}

export type IntelligenceOverview =
  | { status: "unavailable"; reason: "no_binding" | "query_failed" }
  | { status: "no_snapshot" }
  | { status: "snapshot_in_progress"; latestAttemptStatus: string }
  | {
      status: "ready";
      snapshot: SnapshotSummary;
      extraction: ExtractionSummary;
      composition: Composition;
      totals: { files: number; bytes: number; directories: number | null };
    };

export type OverviewResult =
  IntelligenceOverview | { status: "invalid_request" };

export type FileExtractionState =
  "not_attempted" | "extracted" | "skipped_unsupported" | "failed";

export interface StructureDirectory {
  path: string;
  name: string;
  fileCount: number;
  /** `null` when the snapshot has no extraction. */
  symbolCount: number | null;
}

export interface StructureFile {
  path: string;
  name: string;
  sizeBytes: number;
  language: string | null;
  extractionStatus: FileExtractionState;
  symbolCount: number;
}

/** Fixed classes only: Feature 002 failure text can contain identifiers and is never returned (SEC-002). */
export type FailureKind =
  "too_large" | "syntax_errors" | "unreadable" | "extraction_failed";

export function classifyFailure(reason: string | null): FailureKind | null {
  if (reason === null) return null;
  if (/exceeds size ceiling/i.test(reason)) return "too_large";
  if (/syntax errors|malformed source/i.test(reason)) return "syntax_errors";
  if (/decode|invalid utf|not valid utf|R2 object missing/i.test(reason)) {
    return "unreadable";
  }
  return "extraction_failed";
}

export interface StructureLevel {
  directoryPath: string;
  /** Present only when the read failed; the level is then empty. */
  error?: "query_failed";
  directories: StructureDirectory[];
  files: StructureFile[];
  nextCursor: number | null;
  truncated: boolean;
}

export interface FileSymbol {
  id: number;
  kind: string;
  name: string;
  qualifiedName: string | null;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  parentSymbolId: number | null;
}

export interface FileSymbols {
  path: string;
  language: string | null;
  extractionStatus: FileExtractionState;
  failureKind: FailureKind | null;
  /** Present only when the read failed; the symbol list is then empty. */
  error?: "query_failed";
  symbolCount: number;
  symbols: FileSymbol[];
  truncated: boolean;
}

export type SymbolsState = "not_extracted" | "partial" | "empty" | "available";

/** How much symbol intelligence a snapshot has, derived from its extraction summary. */
export function deriveSymbolsState(
  extraction: ExtractionSummary,
): SymbolsState {
  switch (extraction.status) {
    case "not_started":
      return "not_extracted";
    case "in_progress":
    case "completed_partial":
    case "failed":
      return "partial";
    case "completed":
      return extraction.symbolsExtracted > 0 ? "available" : "empty";
  }
}
