import type {
  CommitSha,
  RepositoryIdentity,
} from "../domain/repository-identity";

/**
 * Content-acquisition capability (research/ARCHITECTURE_DECISION_GATE.md §1
 * Option B). Provider-neutral: no method signature below may reference a
 * GitHub-specific response shape (contracts/content-provider.md rule 2) —
 * this is what keeps the interface GitLab-ready without a GitLab
 * implementation shipping in this feature (FR-004).
 */

export type ArchiveEntry = {
  path: string;
  size: number;
  content: ReadableStream<Uint8Array>;
};

export type FileContent = {
  path: string;
  size: number;
  content: Uint8Array;
};

export type ChangedPath = {
  path: string;
  changeType: "added" | "modified" | "removed";
};

export interface ContentProvider {
  /** Resolves `ref` (branch, tag, or already-known SHA) to exactly one immutable commit SHA (FR-005). Throws REF_NOT_FOUND on failure (FR-007). */
  resolveRef(repository: RepositoryIdentity, ref: string): Promise<CommitSha>;

  /** Streams one archive entry at a time — callers MUST NOT buffer the whole archive (FR-015). */
  fetchArchive(
    repository: RepositoryIdentity,
    commitSha: CommitSha,
  ): Promise<ReadableStream<ArchiveEntry>>;

  /** Used only when a prior snapshot exists (incremental mode, FR-013) — never for a repository's first (bulk) acquisition. */
  fetchPaths(
    repository: RepositoryIdentity,
    commitSha: CommitSha,
    paths: string[],
  ): AsyncIterable<FileContent>;

  /** Supplies the changed-path list `fetchPaths` needs for incremental acquisition (FR-013). */
  compareRefs(
    repository: RepositoryIdentity,
    baseSha: CommitSha,
    headSha: CommitSha,
  ): Promise<ChangedPath[]>;
}
