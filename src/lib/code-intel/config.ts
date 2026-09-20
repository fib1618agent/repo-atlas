/** Code Intelligence Foundation config — tunables, safe on the server only (no secrets). */

export const CODE_INTEL_MAX_R2_CONCURRENCY = 6;
export const CODE_INTEL_CHECKPOINT_FILE_COUNT = 200;
export const CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET = 20_000;
export const CODE_INTEL_QUEUE_BATCH_SIZE = 10;
export const CODE_INTEL_MAX_RETRY_ATTEMPTS = 5;
export const CODE_INTEL_LIST_FILES_DEFAULT_LIMIT = 100;
export const CODE_INTEL_LIST_FILES_MAX_LIMIT = 500;
export const CODE_INTEL_EXTRACTION_BATCH_SIZE = 50;

/**
 * AST + Symbol Intelligence (specs/002-ast-symbol-intelligence) — deliberately
 * NOT part of `codeIntelConfig()`'s env-var-overridable tunables below, unlike
 * everything else in this file. This identifies which version of *this
 * repository's own* extraction logic (the `.scm` query files, symbol-identity
 * hashing, IR construction) produced a result — per research.md §10 and
 * data-model.md's "Re-extraction mechanism," it is meant to be bumped by a
 * code change whenever that logic changes, not overridden per-deployment by
 * an operator (doing so would desynchronize the recorded version from what
 * the deployed code actually does, defeating FR-014's purpose).
 */
export const SYMBOL_EXTRACTOR_VERSION = "v1";

export function codeIntelConfig() {
  return {
    maxR2Concurrency: Number(
      process.env["CODE_INTEL_MAX_R2_CONCURRENCY"] ??
        CODE_INTEL_MAX_R2_CONCURRENCY,
    ),
    checkpointFileCount: Number(
      process.env["CODE_INTEL_CHECKPOINT_FILE_COUNT"] ??
        CODE_INTEL_CHECKPOINT_FILE_COUNT,
    ),
    checkpointCpuMsBudget: Number(
      process.env["CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET"] ??
        CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET,
    ),
    queueBatchSize: Number(
      process.env["CODE_INTEL_QUEUE_BATCH_SIZE"] ?? CODE_INTEL_QUEUE_BATCH_SIZE,
    ),
    maxRetryAttempts: Number(
      process.env["CODE_INTEL_MAX_RETRY_ATTEMPTS"] ??
        CODE_INTEL_MAX_RETRY_ATTEMPTS,
    ),
    listFilesDefaultLimit: Number(
      process.env["CODE_INTEL_LIST_FILES_DEFAULT_LIMIT"] ??
        CODE_INTEL_LIST_FILES_DEFAULT_LIMIT,
    ),
    listFilesMaxLimit: Number(
      process.env["CODE_INTEL_LIST_FILES_MAX_LIMIT"] ??
        CODE_INTEL_LIST_FILES_MAX_LIMIT,
    ),
    extractionBatchSize: Number(
      process.env["CODE_INTEL_EXTRACTION_BATCH_SIZE"] ??
        CODE_INTEL_EXTRACTION_BATCH_SIZE,
    ),
  };
}
