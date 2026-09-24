import { describe, expect, test } from "bun:test";
import { toCommitSha } from "../../../src/lib/code-intel/domain/repository-identity";
import {
  githubArchiveRootPrefix,
  normalizeGithubArchivePath,
} from "../../../src/lib/code-intel/acquisition/archive-path";

describe("normalizeGithubArchivePath (codeload root prefix)", () => {
  const repository = {
    provider: "github" as const,
    owner: "octocat",
    name: "hello",
  };
  const sha = toCommitSha("a".repeat(40));

  test("strips GitHub's {repo}-{commitSha}/ tarball wrapper", () => {
    const root = githubArchiveRootPrefix(repository, sha);
    expect(root).toBe(`hello-${sha}`);
    expect(normalizeGithubArchivePath(`${root}/README.md`, root)).toBe(
      "README.md",
    );
    expect(normalizeGithubArchivePath(`${root}/src/index.ts`, root)).toBe(
      "src/index.ts",
    );
  });

  test("leaves repository-relative paths unchanged when no wrapper is present", () => {
    const root = githubArchiveRootPrefix(repository, sha);
    expect(normalizeGithubArchivePath("src/index.ts", root)).toBe(
      "src/index.ts",
    );
  });
});
