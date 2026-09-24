import { createHash } from "node:crypto";

/**
 * Deterministic snapshot-scoped symbol identity (FR-008, FR-013,
 * data-model.md "Deterministic snapshot-scoped identity"). SHA-256 hex of the
 * exact canonical string `${snapshotId} ${filePath} ${kind}
 * ${qualifiedNameOrName} ${startLine} ${startColumn}` — field order and
 * single-space separators are significant, no other normalization is
 * applied. `extractor_version` is deliberately not part of this identity
 * (it is a sibling column on the `symbols` row, not folded into the key).
 *
 * Synchronous by contract (`: string`, not `Promise<string>`) — uses
 * `node:crypto`, available via this project's `nodejs_compat` compatibility
 * flag (already enabled in `wrangler.toml` for Feature 001), rather than the
 * async-only `crypto.subtle` Feature 001 uses for its (naturally async)
 * streaming file-content hash.
 */
export function computeSymbolKey(
  snapshotId: number,
  filePath: string,
  kind: string,
  qualifiedNameOrName: string,
  startLine: number,
  startColumn: number,
): string {
  const canonical = `${snapshotId} ${filePath} ${kind} ${qualifiedNameOrName} ${startLine} ${startColumn}`;
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
