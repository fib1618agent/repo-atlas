import type {
  CommitSha,
  RepositoryIdentity,
} from "../domain/repository-identity";

/** SHA-256 content hash of a byte stream, hex-encoded (FR-018). */
export async function hashContent(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * R2 key scheme: `snapshots/{provider}/{owner}/{name}/{commit_sha}/{content_hash}`
 * — derivable purely from (repository, commitSha, contentHash), no separate
 * lookup table required for addressing (FR-022). Content-addressing means
 * identical file content shares one R2 object across snapshots/repositories.
 */
export function deriveR2Key(
  repository: RepositoryIdentity,
  commitSha: CommitSha,
  contentHash: string,
): string {
  return `snapshots/${repository.provider}/${repository.owner}/${repository.name}/${commitSha}/${contentHash}`;
}
