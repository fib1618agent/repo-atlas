/**
 * Fixed user-facing copy for every Repository Intelligence state (Feature 009
 * FR-011). Static text only: never server-supplied strings. Pure.
 */
import {
  type FailureKind,
  type FileSymbols,
  type OverviewResult,
  type SymbolsState,
} from "./states";

/** Fixed copy per state (FR-011); never server-supplied text. */
export const STATE_COPY = {
  loading: {
    title: "Loading repository intelligence…",
    body: "Reading the latest analysed snapshot.",
  },
  no_binding: {
    title: "Code intelligence is not available in this environment",
    body: "No code-intelligence database is connected to this instance, so structure and symbols cannot be shown. Repository metadata from the provider is still displayed.",
  },
  query_failed: {
    title: "Code intelligence could not be read",
    body: "The intelligence data could not be loaded. Nothing has been inferred in its place.",
  },
  no_snapshot: {
    title: "No source snapshot yet",
    body: "This repository has not been analysed by this instance. Only provider metadata is shown; no structure or symbols have been inferred.",
  },
  snapshot_in_progress: {
    title: "Source snapshot in progress",
    body: "A snapshot is being acquired. Structure will appear once it completes.",
  },
  invalid_request: {
    title: "Invalid repository address",
    body: "The owner or repository name in the address is not valid.",
  },
} as const;

export const SYMBOLS_COPY: Record<SymbolsState, string> = {
  not_extracted:
    "Structure is available; symbols have not been extracted for this snapshot yet.",
  partial:
    "Symbols are partially available: some files are still being processed, were skipped or failed.",
  empty: "Extraction completed, but no symbols were found in this snapshot.",
  available: "Symbols are available for supported files.",
};

export function overviewCopy(
  overview: OverviewResult | undefined,
): { title: string; body: string } | null {
  if (!overview) return STATE_COPY.loading;
  switch (overview.status) {
    case "unavailable":
      return overview.reason === "no_binding"
        ? STATE_COPY.no_binding
        : STATE_COPY.query_failed;
    case "no_snapshot":
      return STATE_COPY.no_snapshot;
    case "snapshot_in_progress":
      return STATE_COPY.snapshot_in_progress;
    case "invalid_request":
      return STATE_COPY.invalid_request;
    case "ready":
      return null;
  }
}

export const FILE_STATE_COPY = {
  not_attempted:
    "Symbols have not been extracted for this file (extraction has not run for it).",
  skipped_unsupported:
    "This file's language is not supported for symbol extraction, or it exceeds the size limit.",
  failed: "Symbol extraction failed for this file.",
  empty: "Extraction ran but found no symbols in this file.",
} as const;

export const FAILURE_COPY: Record<FailureKind, string> = {
  too_large: "The file is larger than the extraction size limit.",
  syntax_errors: "The file has syntax errors and could not be parsed.",
  unreadable: "The file could not be read as text.",
  extraction_failed: "Extraction did not complete for this file.",
};

export function fileStateMessage(f: FileSymbols): string | null {
  if (f.error) return "Symbols could not be read.";
  switch (f.extractionStatus) {
    case "not_attempted":
      return FILE_STATE_COPY.not_attempted;
    case "skipped_unsupported":
      return FILE_STATE_COPY.skipped_unsupported;
    case "failed":
      return `${FILE_STATE_COPY.failed}${f.failureKind ? ` ${FAILURE_COPY[f.failureKind]}` : ""}`;
    case "extracted":
      return f.symbolCount === 0 ? FILE_STATE_COPY.empty : null;
  }
}
