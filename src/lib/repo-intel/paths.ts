/**
 * Snapshot-relative path helpers for the Repository Intelligence read model
 * (Feature 009 FR-006, SEC-001). Pure. Paths never come from the filesystem;
 * they are values compared against `snapshot_files.path` with bound params.
 */

function hasBadChar(segment: string): boolean {
  for (let i = 0; i < segment.length; i++) {
    const code = segment.charCodeAt(i);
    if (code < 0x20 || segment[i] === "\\") return true;
  }
  return false;
}

function cleanSegments(input: string): string[] | null {
  const trimmed = input.replace(/^\/+|\/+$/g, "");
  if (trimmed === "") return [];
  const segments = trimmed.split("/");
  for (const segment of segments) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      hasBadChar(segment)
    ) {
      return null;
    }
  }
  return segments;
}

/** "" for the root, "a/b" for a directory, or `null` when the path is unsafe/malformed. */
export function normalizeDirectoryPath(
  input: string | undefined,
): string | null {
  if (input === undefined) return "";
  const segments = cleanSegments(input);
  return segments === null ? null : segments.join("/");
}

/** Normalized non-empty file path, or `null`. */
export function normalizeFilePath(input: string): string | null {
  const segments = cleanSegments(input);
  if (segments === null || segments.length === 0) return null;
  return segments.join("/");
}

/** The prefix every direct or nested child path of `dir` starts with ("" for the root). */
export function directoryPrefix(dir: string): string {
  return dir === "" ? "" : `${dir}/`;
}

/**
 * Exclusive upper bound for a `path >= prefix AND path < bound` range scan of
 * everything under `prefix` (which ends with "/"): "/" is 0x2F, "0" is 0x30.
 */
export function prefixUpperBound(prefix: string): string {
  return prefix === "" ? "" : `${prefix.slice(0, -1)}0`;
}

/** Text after the last "." of the basename, lower-cased; "" if none. Mirrors the SQL expression in the read model. */
export function extensionOf(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot < 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
