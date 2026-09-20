import { describe, expect, test } from "bun:test";
import { deriveConnectedSources } from "../../src/lib/connected-sources";
import type { Repository } from "../../src/lib/repositories";
import type { SourceFailure } from "../../src/lib/atlas-errors";

function repo(overrides: Partial<Repository> & Pick<Repository, "id" | "name">): Repository {
  return {
    fullName: overrides.name,
    htmlUrl: `https://github.com/${overrides.name}`,
    description: null,
    language: null,
    topics: [],
    stars: 0,
    forks: 0,
    openIssues: 0,
    license: null,
    fork: false,
    archived: false,
    pushedAt: null,
    updatedAt: "2026-01-01T00:00:00Z",
    defaultBranch: "main",
    category: "Other",
    subgroup: "Other",
    importance: 0,
    ...overrides,
  };
}

function failure(login: string): SourceFailure {
  return { login, code: "SOURCE_NOT_FOUND", message: "not found", raw: login };
}

describe("deriveConnectedSources (T009)", () => {
  test("default source path: one entry, correct provider/identity/count/status", () => {
    const result = deriveConnectedSources({
      sourceKey: "imdadareeph",
      isDefault: true,
      urls: [],
      repositories: [repo({ id: 1, name: "a" }), repo({ id: 2, name: "b" })],
      warnings: [],
    });

    expect(result).toEqual([
      {
        type: "github",
        identity: "github.com/imdadareeph",
        repositoryCount: 2,
        status: "connected",
        colorToken: "var(--atlas-web)",
      },
    ]);
  });

  test("multiple custom sources: grouped by sourceLogin, separate entries, correct counts", () => {
    const result = deriveConnectedSources({
      sourceKey: "alice+bob",
      isDefault: false,
      urls: ["https://github.com/alice", "https://github.com/bob"],
      repositories: [
        repo({ id: 1, name: "a1", sourceLogin: "alice" }),
        repo({ id: 2, name: "a2", sourceLogin: "alice" }),
        repo({ id: 3, name: "b1", sourceLogin: "bob" }),
      ],
      warnings: [],
    });

    expect(result).toEqual([
      { type: "github", identity: "github.com/alice", repositoryCount: 2, status: "connected", colorToken: "var(--atlas-web)" },
      { type: "github", identity: "github.com/bob", repositoryCount: 1, status: "connected", colorToken: "var(--atlas-web)" },
    ]);
  });

  test("partial source failure: status is degraded, repository count stays correct", () => {
    const result = deriveConnectedSources({
      sourceKey: "alice+bob",
      isDefault: false,
      urls: ["https://github.com/alice", "https://github.com/bob"],
      repositories: [
        repo({ id: 1, name: "a1", sourceLogin: "alice" }),
        repo({ id: 2, name: "b1", sourceLogin: "bob" }),
        repo({ id: 3, name: "b2", sourceLogin: "bob" }),
      ],
      warnings: [{ code: "PARTIAL_FAILURE", message: "partial" }],
      meta: { sourceFailures: [failure("bob")] },
    });

    const bob = result.find((s) => s.identity === "github.com/bob");
    expect(bob).toEqual({
      type: "github",
      identity: "github.com/bob",
      repositoryCount: 2,
      status: "degraded",
      colorToken: "var(--atlas-data)",
    });
    const alice = result.find((s) => s.identity === "github.com/alice");
    expect(alice?.status).toBe("connected");
  });

  test("complete source failure: source still returned, status error, zero repositories", () => {
    const result = deriveConnectedSources({
      sourceKey: "ghost",
      isDefault: false,
      urls: ["https://github.com/ghost"],
      repositories: [],
      warnings: [],
      meta: { sourceFailures: [failure("ghost")] },
    });

    expect(result).toEqual([
      {
        type: "github",
        identity: "github.com/ghost",
        repositoryCount: 0,
        status: "error",
        colorToken: "var(--destructive)",
      },
    ]);
  });

  test("colorToken values use only existing atlas style tokens (no new palette)", () => {
    const result = deriveConnectedSources({
      sourceKey: "alice+ghost",
      isDefault: false,
      urls: ["https://github.com/alice", "https://github.com/ghost"],
      repositories: [repo({ id: 1, name: "a1", sourceLogin: "alice" })],
      warnings: [],
      meta: { sourceFailures: [failure("ghost")] },
    });

    const allowedTokens = new Set(["var(--atlas-web)", "var(--atlas-data)", "var(--destructive)"]);
    for (const source of result) {
      expect(allowedTokens.has(source.colorToken)).toBe(true);
    }
  });

  test("deterministic output: same input produces same output ordering", () => {
    const input = {
      sourceKey: "alice+bob+carol",
      isDefault: false,
      urls: ["https://github.com/alice", "https://github.com/bob", "https://github.com/carol"],
      repositories: [
        repo({ id: 1, name: "a1", sourceLogin: "alice" }),
        repo({ id: 2, name: "b1", sourceLogin: "bob" }),
        repo({ id: 3, name: "c1", sourceLogin: "carol" }),
      ],
      warnings: [],
    };

    const first = deriveConnectedSources(input);
    const second = deriveConnectedSources(input);

    expect(first.map((s) => s.identity)).toEqual(second.map((s) => s.identity));
    expect(first).toEqual(second);
    expect(first.map((s) => s.identity)).toEqual([
      "github.com/alice",
      "github.com/bob",
      "github.com/carol",
    ]);
  });
});
