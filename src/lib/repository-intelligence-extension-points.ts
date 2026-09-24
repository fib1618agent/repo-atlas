import type { ParsedSource } from "./github-url";

/**
 * Extension point for future repository intelligence (source analysis,
 * function/class extraction, dependency mapping, call graphs, categorization,
 * AI-generated notes — spec.md User Story 6 / FR-017–FR-019). Defines the
 * hand-off shape only; this feature does not implement any analysis, and
 * nothing here calls or imports Feature 001/002's `code-intel/**` modules.
 *
 * Deliberately shaped to match Feature 001's existing `RepositoryIdentity`
 * (`src/lib/code-intel/domain/repository-identity.ts`: `{ provider, owner,
 * name }`) so a future feature could pass this directly to Feature 001's
 * `acquireSnapshot` without a reshape — but no such call is made here.
 */
export type SelectedRepositoryForAnalysis = {
  provider: "github";
  owner: string;
  name: string;
  /** Never "analyzed"/"queued" from this feature — only "added" until real analysis exists (FR-019). */
  status: "added";
};

/**
 * Pure, no React/store/network access. Only `kind: "repo"` entries (Mode 2
 * selections) produce a `SelectedRepositoryForAnalysis` — user/org entries
 * have no single repository to point at, so they're filtered out.
 */
export function buildSelectedRepositoriesForAnalysis(
  parsedRepoSources: ParsedSource[],
): SelectedRepositoryForAnalysis[] {
  return parsedRepoSources
    .filter((source): source is ParsedSource & { kind: "repo" } => source.kind === "repo")
    .map((source) => ({
      provider: "github",
      owner: source.login,
      name: source.sourceUrl.split("/").pop()!,
      status: "added",
    }));
}
