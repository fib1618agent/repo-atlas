import { AtlasError, atlasErrorMessage } from "./atlas-errors";
import { parseGitHubSource, type ParsedSource } from "./github-url";

/**
 * Supported Add Sources input modes (data-model.md SourceInputMode).
 * "users": load every public repository for one or more GitHub users/orgs.
 * "repositories": load only the explicitly listed repositories.
 * A string union (not an enum) so a future provider mode can be added
 * without redesigning this type or validateRowsForMode's signature.
 */
export type SourceInputMode = "users" | "repositories";

export type RowValidationResult = {
  /** Successfully parsed, mode-accepted rows, in input order. */
  parsed: ParsedSource[];
  /** Row index -> error message, same shape as SourcesDialog's existing `rowErrors` state. */
  errors: Record<number, string>;
};

/**
 * UI-independent, no React/store/network access, deterministic (same input
 * always produces the same output). Reuses the existing `parseGitHubSource`
 * classification — this function only adds a mode-appropriate acceptance
 * gate on top of it, it does not reimplement URL parsing.
 *
 * "users" mode preserves today's SourcesDialog behavior exactly: any
 * user/org/repo kind is accepted (no new restriction). "repositories" mode
 * additionally requires each row to classify as kind "repo".
 *
 * Empty/whitespace-only rows are silently skipped (not an error), matching
 * SourcesDialog's existing `handleLoad` behavior.
 */
export function validateRowsForMode(rows: string[], mode: SourceInputMode): RowValidationResult {
  const parsed: ParsedSource[] = [];
  const errors: Record<number, string> = {};

  rows.forEach((row, index) => {
    const trimmed = row.trim();
    if (!trimmed) return;

    let source: ParsedSource;
    try {
      source = parseGitHubSource(trimmed);
    } catch (error) {
      errors[index] =
        error instanceof AtlasError
          ? error.message
          : atlasErrorMessage("VALIDATION_INVALID_URL", { input: trimmed });
      return;
    }

    if (mode === "repositories" && source.kind !== "repo") {
      errors[index] = `"${trimmed}" is not a specific repository URL (owner/repo).`;
      return;
    }

    parsed.push(source);
  });

  return { parsed, errors };
}
