import type { SnapshotFile } from "../domain/snapshot";
import { getObject } from "../persistence/r2-client";
import { getD1, type D1DatabaseLike } from "../persistence/cloudflare-env";
import {
  getOrCreateDirectory,
  replaceSymbolsForFile,
  upsertFileExtraction,
} from "../persistence/symbol-d1-client";
import { detectLanguage, type SupportedLanguage } from "./language-detector";
import { getParser } from "./grammar-provider";
import { toIntermediateRepresentation } from "./to-intermediate-representation";
import { codeIntelConfig } from "../config";
import javaQuery from "./queries/java.scm?raw";
import javascriptQuery from "./queries/javascript.scm?raw";
import typescriptQuery from "./queries/typescript.scm?raw";
import tsxQuery from "./queries/tsx.scm?raw";

/**
 * Per-file extraction pipeline (T029): detect language → parse → extract IR
 * → persist, for one Feature 001 `SnapshotFile`. Self-contained file-scoped
 * failure containment (FR-007, FR-018) — this function never throws; any
 * failure from R2 read onward is caught and recorded as a `failed`
 * `file_extractions` row instead of propagating, so a caller iterating a
 * batch of files (T030, not implemented here) can call it once per file with
 * no try/catch of its own required.
 */

const QUERY_SOURCE_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  java: javaQuery,
  javascript: javascriptQuery,
  typescript: typescriptQuery,
  tsx: tsxQuery,
};

/** Every directory path segment from the snapshot root down to (not including) the file itself, root-first. `''` is always the first (root) segment, per data-model.md. */
function directoryChainSegments(filePath: string): { path: string; parentPath: string | null }[] {
  const dirParts = filePath.split("/").slice(0, -1);
  const segments: { path: string; parentPath: string | null }[] = [{ path: "", parentPath: null }];
  let current = "";
  for (const part of dirParts) {
    const parentPath = current;
    current = current === "" ? part : `${current}/${part}`;
    segments.push({ path: current, parentPath });
  }
  return segments;
}

/** Upserts every directory segment for `filePath` (FR-006 — runs regardless of this file's eventual extraction outcome, since directory layout is independent of extraction success). Returns the file's own immediate parent directory path. */
async function ensureDirectoryChain(
  snapshotId: number,
  filePath: string,
  db: D1DatabaseLike,
): Promise<string> {
  const segments = directoryChainSegments(filePath);
  for (const segment of segments) {
    await getOrCreateDirectory(snapshotId, segment.path, segment.parentPath, db);
  }
  return segments[segments.length - 1]!.path;
}

export type ExtractFileParams = {
  snapshotId: number;
  snapshotFile: SnapshotFile;
  extractorVersion: string;
  db?: D1DatabaseLike;
};

export async function extractFile(params: ExtractFileParams): Promise<void> {
  const db = params.db ?? getD1();
  const { snapshotId, snapshotFile, extractorVersion } = params;

  // Step 1: directory chain — always runs, independent of extraction outcome (FR-006).
  const directoryPath = await ensureDirectoryChain(snapshotId, snapshotFile.path, db);

  // Step 2: language detection — cheap, path-only, no R2 read needed for an
  // unsupported file at all.
  const language = detectLanguage(snapshotFile.path);
  if (!language) {
    const fileExtractionId = await upsertFileExtraction(
      {
        snapshotId,
        snapshotFileId: snapshotFile.id,
        directoryPath,
        language: null,
        status: "skipped_unsupported",
        failureReason: null,
        extractorVersion,
      },
      db,
    );
    await replaceSymbolsForFile(fileExtractionId, snapshotId, [], extractorVersion, db);
    return;
  }

  // Step 2b: oversized-file fallback (T041, T014's spike-derived circuit
  // breaker) — skip before ever attempting a parse, same "cheap, path-only
  // gate before any real work" placement as language detection. `sizeBytes`
  // is Feature 001's own recorded `SnapshotFile.sizeBytes` (file-inventory
  // metadata already captured at acquisition time), so this never requires
  // an R2 read just to make the size decision.
  const maxFileSizeBytes = codeIntelConfig().maxFileSizeBytes;
  if (snapshotFile.sizeBytes > maxFileSizeBytes) {
    const fileExtractionId = await upsertFileExtraction(
      {
        snapshotId,
        snapshotFileId: snapshotFile.id,
        directoryPath,
        language,
        status: "skipped_unsupported",
        failureReason: `exceeds size ceiling (${snapshotFile.sizeBytes} > ${maxFileSizeBytes} bytes)`,
        extractorVersion,
      },
      db,
    );
    await replaceSymbolsForFile(fileExtractionId, snapshotId, [], extractorVersion, db);
    return;
  }

  // Steps 3–6: read → parse → extract → persist. Every failure from here on
  // is file-scoped (FR-007, FR-018) — caught, recorded, never thrown.
  try {
    const bytes = await getObject(snapshotFile.r2Key);
    if (!bytes) {
      throw new Error(`R2 object missing for key "${snapshotFile.r2Key}"`);
    }

    // Malformed/non-text content (spec Edge Cases: binary content
    // misclassified by extension) surfaces as a decode failure here.
    const sourceText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);

    const parser = await getParser(language);
    const tree = parser.parse(sourceText);
    if (!tree) {
      throw new Error("parser produced no tree");
    }
    if (tree.rootNode.hasError) {
      tree.delete();
      throw new Error("parse produced syntax errors (malformed source)");
    }

    const symbols = toIntermediateRepresentation(
      tree,
      parser.language!,
      QUERY_SOURCE_BY_LANGUAGE[language],
      snapshotId,
      snapshotFile.path,
    );
    // Free the tree immediately after use (T014's finding: leaving parsed
    // trees undeleted across many files/iterations is what caused the WASM
    // runtime abort observed during the large-file CPU spike, not a
    // per-file engine limit).
    tree.delete();

    const fileExtractionId = await upsertFileExtraction(
      {
        snapshotId,
        snapshotFileId: snapshotFile.id,
        directoryPath,
        language,
        status: "extracted",
        failureReason: null,
        extractorVersion,
      },
      db,
    );
    await replaceSymbolsForFile(fileExtractionId, snapshotId, symbols, extractorVersion, db);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const fileExtractionId = await upsertFileExtraction(
      {
        snapshotId,
        snapshotFileId: snapshotFile.id,
        directoryPath,
        language,
        status: "failed",
        failureReason: reason,
        extractorVersion,
      },
      db,
    );
    await replaceSymbolsForFile(fileExtractionId, snapshotId, [], extractorVersion, db);
  }
}
