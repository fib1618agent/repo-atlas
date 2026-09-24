# Contract: `ContentProvider` interface

`src/lib/code-intel/providers/content-provider.ts`. Implemented by `github-content-provider.ts` in this feature; GitLab-ready by shape, no GitLab implementation ships (FR-004).

```ts
interface ContentProvider {
  resolveRef(repository: RepositoryIdentity, ref: string): Promise<CommitSha>;

  fetchArchive(
    repository: RepositoryIdentity,
    commitSha: CommitSha,
  ): ReadableStream<ArchiveEntry>;

  fetchPaths(
    repository: RepositoryIdentity,
    commitSha: CommitSha,
    paths: string[],
  ): AsyncIterable<FileContent>;

  compareRefs(
    repository: RepositoryIdentity,
    baseSha: CommitSha,
    headSha: CommitSha,
  ): Promise<{ path: string; changeType: "added" | "modified" | "removed" }[]>;
}

type ArchiveEntry = {
  path: string;
  size: number;
  content: ReadableStream<Uint8Array>;
};

type FileContent = {
  path: string;
  size: number;
  content: Uint8Array;
};
```

## Contract rules

1. `resolveRef` MUST return exactly one `CommitSha` or throw an `AtlasError` with code `REF_NOT_FOUND` (FR-005, FR-007). It MUST NOT return a value for a ref that does not exist.
2. No method's parameter or return type MAY contain a GitHub-specific shape (e.g. a raw GitHub API response object). `RepositoryIdentity`, `CommitSha`, `ArchiveEntry`, `FileContent` are provider-neutral (FR-002).
3. `fetchArchive`'s returned stream MUST be consumable without the caller buffering the whole archive — one `ArchiveEntry` at a time, each entry's `content` itself a stream (FR-015).
4. `fetchPaths` is used only when a prior snapshot exists for the repository (incremental mode) — callers determine this via `getRepositoryHistory`, not this interface (FR-013).
5. `compareRefs` supplies the changed-path list `fetchPaths` needs for incremental acquisition; it MUST NOT be called for a repository's first (bulk) acquisition.

## GitHub implementation notes (informative, not part of the contract)

- `resolveRef` → GitHub Git Refs API (`GET /repos/{owner}/{repo}/git/ref/{ref}` or a HEAD-based lookup for branch/tag ambiguity).
- `fetchArchive` → `codeload.github.com/{owner}/{repo}/tar.gz/{sha}`, piped through `DecompressionStream("gzip")` + `tar-stream.ts`.
- `fetchPaths` → GitHub Contents API (`GET /repos/{owner}/{repo}/contents/{path}?ref={sha}`), bounded concurrency via reused `mapWithConcurrency`.
- `compareRefs` → GitHub Compare API (`GET /repos/{owner}/{repo}/compare/{base}...{head}`).
