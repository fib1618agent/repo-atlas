import { AtlasError } from "./atlas-errors";
import { ATLAS_DEFAULT_OWNER, ATLAS_MAX_SOURCES } from "./atlas-config";

export type SourceKind = "user" | "org" | "repo";

export type ParsedSource = {
  login: string;
  kind: SourceKind;
  sourceUrl: string;
  raw: string;
};

const BLOCKED_PATH_PREFIXES = ["/settings", "/explore", "/topics", "/marketplace", "/features"];

function normalizeInput(raw: string): string {
  let value = raw.trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  value = value.replace(/^http:\/\//i, "https://");
  value = value.replace(/^https:\/\/www\./i, "https://");
  value = value.replace(/\/+$/, "");
  value = value.replace(/\.git$/i, "");
  return value;
}

export function parseGitHubSource(raw: string): ParsedSource {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AtlasError("VALIDATION_EMPTY", "Add at least one GitHub user, org, or repository URL.");
  }

  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    const login = trimmed.replace(/^@/, "");
    return {
      login,
      kind: "user",
      sourceUrl: `https://github.com/${login}`,
      raw: trimmed,
    };
  }

  const normalized = normalizeInput(trimmed);
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new AtlasError(
      "VALIDATION_INVALID_URL",
      `"${trimmed}" is not a GitHub user, org, or repository URL.`,
      { detail: trimmed },
    );
  }

  if (url.hostname !== "github.com") {
    throw new AtlasError(
      "VALIDATION_INVALID_URL",
      `"${trimmed}" is not a GitHub user, org, or repository URL.`,
      { detail: trimmed },
    );
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new AtlasError(
      "VALIDATION_INVALID_URL",
      `"${trimmed}" is not a GitHub user, org, or repository URL.`,
      { detail: trimmed },
    );
  }

  if (BLOCKED_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    throw new AtlasError(
      "VALIDATION_INVALID_URL",
      `"${trimmed}" is not a GitHub user, org, or repository URL.`,
      { detail: trimmed },
    );
  }

  if (parts[0] === "orgs" && parts[1]) {
    const login = parts[1];
    return {
      login,
      kind: "org",
      sourceUrl: `https://github.com/orgs/${login}`,
      raw: trimmed,
    };
  }

  if (parts.length >= 2) {
    const owner = parts[0];
    const repo = parts[1];
    if (!owner || !repo) {
      throw new AtlasError(
        "VALIDATION_INVALID_URL",
        `"${trimmed}" is not a GitHub user, org, or repository URL.`,
        { detail: trimmed },
      );
    }
    return {
      login: owner,
      kind: "repo",
      sourceUrl: `https://github.com/${owner}/${repo}`,
      raw: trimmed,
    };
  }

  const login = parts[0]!;
  return {
    login,
    kind: "user",
    sourceUrl: `https://github.com/${login}`,
    raw: trimmed,
  };
}

export function dedupeSources(sources: ParsedSource[]): {
  unique: ParsedSource[];
  removed: string[];
} {
  const seen = new Set<string>();
  const unique: ParsedSource[] = [];
  const removed: string[] = [];

  for (const source of sources) {
    const key = source.kind === "repo" ? source.sourceUrl.toLowerCase() : source.login.toLowerCase();
    if (seen.has(key)) {
      removed.push(source.login);
      continue;
    }
    seen.add(key);
    unique.push(source);
  }

  return { unique, removed };
}

export function parseSourceInputs(inputs: string[]): {
  sources: ParsedSource[];
  removedDuplicates: string[];
} {
  const nonEmpty = inputs.map((s) => s.trim()).filter(Boolean);
  if (nonEmpty.length === 0) {
    throw new AtlasError("VALIDATION_EMPTY", "Add at least one GitHub user, org, or repository URL.");
  }

  const parsed = nonEmpty.map(parseGitHubSource);
  const { unique, removed } = dedupeSources(parsed);

  if (unique.length > ATLAS_MAX_SOURCES) {
    throw new AtlasError("TOO_MANY_SOURCES", "You can load at most 5 GitHub sources.");
  }

  return { sources: unique, removedDuplicates: removed };
}

export function deriveSourceKey(logins: string[]): string {
  return [...new Set(logins.map((l) => l.toLowerCase()))].sort().join("+");
}

export function sourceKeyFromParsed(sources: ParsedSource[]): string {
  const keys = sources.map((s) => (s.kind === "repo" ? s.sourceUrl.replace("https://github.com/", "") : s.login));
  return deriveSourceKey(keys);
}

export function includesDefaultOwner(sources: ParsedSource[], defaultOwner = ATLAS_DEFAULT_OWNER): boolean {
  const owner = defaultOwner.toLowerCase();
  return sources.some(
    (s) =>
      s.login.toLowerCase() === owner ||
      (s.kind === "repo" && s.sourceUrl.toLowerCase().startsWith(`https://github.com/${owner}/`)),
  );
}
