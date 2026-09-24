export type AtlasErrorCode =
  | "VALIDATION_EMPTY"
  | "VALIDATION_INVALID_URL"
  | "TOO_MANY_SOURCES"
  | "SOURCE_NOT_FOUND"
  | "SOURCE_FORBIDDEN"
  | "RATE_LIMITED"
  | "NETWORK"
  | "GITHUB_5XX"
  | "PARTIAL_FAILURE"
  | "DEFAULT_FALLBACK"
  | "EXPORT_EMPTY"
  | "SQLITE_UNAVAILABLE"
  | "SQLITE_OPEN_FAILED"
  | "AI_NOT_CONFIGURED"
  | "AI_PROVIDER_UNIMPLEMENTED"
  | "AI_UPSTREAM"
  | "REF_NOT_FOUND"
  | "ARCHIVE_UNAVAILABLE"
  | "SNAPSHOT_FAILED"
  | "SNAPSHOT_NOT_FOUND"
  | "SNAPSHOT_REPOSITORY_UNAUTHORIZED"
  | "SNAPSHOT_NOT_EXTRACTABLE"
  | "SYMBOL_NOT_FOUND"
  | "SETTINGS_UNAVAILABLE";

export type SourceFailure = {
  login: string;
  code: AtlasErrorCode;
  message: string;
  raw: string;
};

export type SerializedAtlasError = {
  code: AtlasErrorCode;
  message: string;
  login?: string;
  detail?: string;
  sourceFailures?: SourceFailure[];
};

const ERROR_MESSAGES: Record<AtlasErrorCode, string> = {
  VALIDATION_EMPTY: "Add at least one GitHub user, org, or repository URL.",
  VALIDATION_INVALID_URL: '"{input}" is not a GitHub user, org, or repository URL.',
  TOO_MANY_SOURCES: "You can load at most 5 GitHub sources.",
  SOURCE_NOT_FOUND: 'GitHub could not find "{login}". Check the URL.',
  SOURCE_FORBIDDEN:
    'GitHub refused "{login}". If this is a private org, it cannot be loaded.',
  RATE_LIMITED: "GitHub rate limit reached. Try again later or set GITHUB_TOKEN in .env.",
  NETWORK: "Could not reach GitHub. Check your connection and try again.",
  GITHUB_5XX: "GitHub is unavailable ({status}). Try again shortly.",
  PARTIAL_FAILURE: "Loaded {ok} source(s). {fail} failed.",
  DEFAULT_FALLBACK: "GitHub is unavailable. Showing the bundled default dataset.",
  EXPORT_EMPTY: "Nothing to export yet.",
  SQLITE_UNAVAILABLE: "(dev only) Local SQLite cache is off (no filesystem). Using memory cache.",
  SQLITE_OPEN_FAILED: "Could not open SQLite at {path}. Using memory cache.",
  AI_NOT_CONFIGURED: "No API key for {provider}. Add it to .env (see .env.example).",
  AI_PROVIDER_UNIMPLEMENTED: "{provider} is not wired yet. Using the metadata summary.",
  AI_UPSTREAM: "AI summary is unavailable. Showing a metadata summary instead.",
  REF_NOT_FOUND: 'Ref "{ref}" was not found on the provider.',
  ARCHIVE_UNAVAILABLE: "Provider archive endpoint is unavailable or rate-limited.",
  SNAPSHOT_FAILED: "Snapshot acquisition failed.",
  SNAPSHOT_NOT_FOUND: "No snapshot found for that id.",
  SNAPSHOT_REPOSITORY_UNAUTHORIZED: "Repository is private or inaccessible to configured credentials.",
  SNAPSHOT_NOT_EXTRACTABLE: "Snapshot is not completed and cannot be extracted yet.",
  SYMBOL_NOT_FOUND: "No symbol found for that id.",
  SETTINGS_UNAVAILABLE: "Settings could not be loaded. Try again.",
};

export function atlasErrorMessage(
  code: AtlasErrorCode,
  params?: Record<string, string | number>,
): string {
  let message = ERROR_MESSAGES[code];
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      message = message.replaceAll(`{${key}}`, String(value));
    }
  }
  return message;
}

export class AtlasError extends Error {
  readonly code: AtlasErrorCode;
  readonly detail?: string | undefined;
  readonly login?: string | undefined;
  readonly sourceFailures?: SourceFailure[] | undefined;

  constructor(
    code: AtlasErrorCode,
    message: string,
    options?: { detail?: string; login?: string; sourceFailures?: SourceFailure[] },
  ) {
    super(message);
    this.name = "AtlasError";
    this.code = code;
    if (options?.detail !== undefined) this.detail = options.detail;
    if (options?.login !== undefined) this.login = options.login;
    if (options?.sourceFailures !== undefined) this.sourceFailures = options.sourceFailures;
  }
}

export function isAtlasError(error: unknown): error is AtlasError {
  return error instanceof AtlasError;
}

export function exportEmptyError(): AtlasError {
  return new AtlasError("EXPORT_EMPTY", atlasErrorMessage("EXPORT_EMPTY"));
}

function isAtlasErrorCode(value: unknown): value is AtlasErrorCode {
  return typeof value === "string" && value in ERROR_MESSAGES;
}

function isSerializedAtlasError(value: unknown): value is SerializedAtlasError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return isAtlasErrorCode(candidate["code"]) && typeof candidate["message"] === "string";
}

export function serializeAtlasError(error: AtlasError): SerializedAtlasError {
  const serialized: SerializedAtlasError = {
    code: error.code,
    message: error.message,
  };
  if (error.login !== undefined) serialized.login = error.login;
  if (error.detail !== undefined) serialized.detail = error.detail;
  if (error.sourceFailures !== undefined && error.sourceFailures.length > 0) {
    serialized.sourceFailures = error.sourceFailures;
  }
  return serialized;
}

export function parseAtlasError(error: unknown): SerializedAtlasError | null {
  if (error instanceof AtlasError) {
    return serializeAtlasError(error);
  }

  if (error instanceof Error) {
    try {
      const parsed: unknown = JSON.parse(error.message);
      if (isSerializedAtlasError(parsed)) {
        return parsed;
      }
    } catch {
      // not JSON — fall through
    }
  }

  if (isSerializedAtlasError(error)) {
    return error;
  }

  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    if (isAtlasErrorCode(candidate["code"]) && typeof candidate["message"] === "string") {
      const serialized: SerializedAtlasError = {
        code: candidate["code"],
        message: candidate["message"],
      };
      if (typeof candidate["login"] === "string") serialized.login = candidate["login"];
      if (typeof candidate["detail"] === "string") serialized.detail = candidate["detail"];
      if (Array.isArray(candidate["sourceFailures"])) {
        serialized.sourceFailures = candidate["sourceFailures"] as SourceFailure[];
      }
      return serialized;
    }
  }

  return null;
}
