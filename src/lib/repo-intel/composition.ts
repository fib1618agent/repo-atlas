/**
 * Pure language/extension composition helpers (Feature 009 FR-005). Buckets
 * come from Feature 002's detected `file_extractions.language` when present,
 * else from the file extension. Nothing here is inferred beyond that.
 */
import { MAX_COMPOSITION_BUCKETS } from "./limits";
import { extensionOf } from "./paths";
import type { Composition, CompositionBucket } from "./states";

/** Bucket key: detected language, else ".ext", else "(no extension)". `ext` is lower-cased, without the dot ("" if none). */
export function bucketKey(language: string | null, ext: string): string {
  if (language) return language;
  return ext ? `.${ext}` : "(no extension)";
}

/** Bucket key for a file path (same rule the read model applies in SQL). */
export function bucketKeyFor(language: string | null, path: string): string {
  return bucketKey(language, extensionOf(path));
}

/**
 * Keeps the largest `max` buckets (by bytes, then file count, then key) and
 * folds the rest into `other*`. Totals are preserved exactly.
 */
export function topBuckets(
  rows: CompositionBucket[],
  max: number = MAX_COMPOSITION_BUCKETS,
): Composition {
  const sorted = [...rows].sort(
    (a, b) =>
      b.bytes - a.bytes ||
      b.fileCount - a.fileCount ||
      a.key.localeCompare(b.key),
  );
  const kept = sorted.slice(0, max);
  const rest = sorted.slice(max);
  return {
    buckets: kept,
    otherFileCount: rest.reduce((n, r) => n + r.fileCount, 0),
    otherBytes: rest.reduce((n, r) => n + r.bytes, 0),
  };
}
