import type {
  CommitSha,
  RepositoryIdentity,
} from "../domain/repository-identity";

/**
 * GitHub `codeload` tarballs wrap every path in `{repo}-{commitSha}/...`.
 * The Contents API uses repository-relative paths without that prefix.
 */
export function githubArchiveRootPrefix(
  repository: RepositoryIdentity,
  commitSha: CommitSha,
): string {
  return `${repository.name}-${commitSha}`;
}

export function normalizeGithubArchivePath(
  path: string,
  rootPrefix: string,
): string {
  const needle = `${rootPrefix}/`;
  if (path.startsWith(needle)) {
    return path.slice(needle.length);
  }
  return path;
}
