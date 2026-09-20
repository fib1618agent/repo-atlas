import { AtlasError, atlasErrorMessage } from "../../atlas-errors";
import {
  isCommitShaShape,
  toCommitSha,
  type CommitSha,
  type RepositoryIdentity,
} from "../domain/repository-identity";
import { mapWithConcurrency } from "../persistence/r2-client";
import { parseTarEntries } from "../acquisition/tar-stream";
import type {
  ArchiveEntry,
  ChangedPath,
  ContentProvider,
  FileContent,
} from "./content-provider";

/**
 * GitHub `ContentProvider` implementation (FR-004). Only concrete provider in
 * this feature — the `ContentProvider` interface itself stays GitLab-ready
 * (see content-provider.ts); no `gitlab-content-provider.ts` is created.
 * Only public, unauthenticated-scope GitHub endpoints are called (FR-034) —
 * `GITHUB_TOKEN` is used only for rate-limit headroom, server-side only,
 * exactly as `github-fetch.ts` already does (FR-032).
 */

function authHeaders(): Record<string, string> {
  const token = process.env["GITHUB_TOKEN"] ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function githubHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "RepoAtlas-CodeIntel",
    ...authHeaders(),
    ...extra,
  };
}

async function githubFetch(
  url: string,
  headers?: Record<string, string>,
): Promise<Response> {
  try {
    return await fetch(url, { headers: githubHeaders(headers) });
  } catch {
    throw new AtlasError("NETWORK", atlasErrorMessage("NETWORK"));
  }
}

export const githubContentProvider: ContentProvider = {
  async resolveRef(
    repository: RepositoryIdentity,
    ref: string,
  ): Promise<CommitSha> {
    const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/commits/${encodeURIComponent(ref)}`;
    const response = await githubFetch(url, {
      Accept: "application/vnd.github.sha",
    });
    if (response.status === 404) {
      throw new AtlasError(
        "REF_NOT_FOUND",
        atlasErrorMessage("REF_NOT_FOUND", { ref }),
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new AtlasError(
        "SNAPSHOT_REPOSITORY_UNAUTHORIZED",
        atlasErrorMessage("SNAPSHOT_REPOSITORY_UNAUTHORIZED"),
      );
    }
    if (!response.ok) {
      throw new AtlasError("NETWORK", atlasErrorMessage("NETWORK"));
    }
    const sha = (await response.text()).trim();
    // Runtime SHA-shape guard (SC-002 defense-in-depth) — a provider-response
    // bug can't smuggle a non-SHA string past the type system's brand alone.
    if (!isCommitShaShape(sha)) {
      throw new Error(
        `GitHub returned a non-SHA-shaped value for ref resolution: "${sha}"`,
      );
    }
    return toCommitSha(sha);
  },

  async fetchArchive(
    repository: RepositoryIdentity,
    commitSha: CommitSha,
  ): Promise<ReadableStream<ArchiveEntry>> {
    const url = `https://codeload.github.com/${repository.owner}/${repository.name}/tar.gz/${commitSha}`;
    const response = await githubFetch(url);
    if (!response.ok || !response.body) {
      throw new AtlasError(
        "ARCHIVE_UNAVAILABLE",
        atlasErrorMessage("ARCHIVE_UNAVAILABLE"),
      );
    }
    const decompressed = response.body.pipeThrough(
      new DecompressionStream("gzip"),
    );
    return parseTarEntries(decompressed);
  },

  async *fetchPaths(
    repository: RepositoryIdentity,
    commitSha: CommitSha,
    paths: string[],
  ): AsyncIterable<FileContent> {
    const results = await mapWithConcurrency(
      paths,
      6,
      async (path): Promise<FileContent | null> => {
        const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${path}?ref=${commitSha}`;
        const response = await githubFetch(url);
        if (!response.ok) return null; // path removed/inaccessible at this SHA — skip
        const body = (await response.json()) as {
          content?: string;
          encoding?: string;
          size?: number;
        };
        if (!body.content || body.encoding !== "base64") return null; // e.g. a directory listing
        const content = Uint8Array.from(
          atob(body.content.replace(/\n/g, "")),
          (c) => c.charCodeAt(0),
        );
        return { path, size: content.length, content };
      },
    );
    for (const result of results) {
      if (result) yield result;
    }
  },

  async compareRefs(
    repository: RepositoryIdentity,
    baseSha: CommitSha,
    headSha: CommitSha,
  ): Promise<ChangedPath[]> {
    const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/compare/${baseSha}...${headSha}`;
    const response = await githubFetch(url);
    if (!response.ok) {
      throw new AtlasError(
        "ARCHIVE_UNAVAILABLE",
        atlasErrorMessage("ARCHIVE_UNAVAILABLE"),
      );
    }
    const body = (await response.json()) as {
      files?: { filename: string; status: string }[];
    };
    return (body.files ?? []).map((file) => ({
      path: file.filename,
      changeType:
        file.status === "removed"
          ? "removed"
          : file.status === "added"
            ? "added"
            : "modified",
    }));
  },
};
