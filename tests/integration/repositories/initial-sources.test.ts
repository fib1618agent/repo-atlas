import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Repository } from "../../../src/lib/repositories";
import type { FetchResult } from "../../../src/lib/github-fetch";

/**
 * T028 — closes analysis finding E1: the config-driven default-path
 * extension (T019/T020, FR-024/FR-025) had implementation but no dedicated
 * automated test. `github-fetch.ts`'s real functions hit the live GitHub
 * REST API, so they're mocked at the module boundary (bun:test's
 * `mock.module`) — everything else (atlas-config.ts's real env-var parsing,
 * repositories.functions.ts's real branching/caching logic, atlas-store.ts's
 * real in-memory cache) runs for real, unmocked.
 */

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

const fetchDefaultOwnerRepositories = mock(async (_owner: string): Promise<Repository[]> => []);
const fetchCustomRepositories = mock(
  async (_inputs: string[]): Promise<FetchResult> => ({
    repositories: [],
    sourceKey: "",
    isDefault: false,
    warnings: [],
    meta: { requested: 0, fetched: 0, spiralCap: 800, storedCap: 2000 },
  }),
);

mock.module("../../../src/lib/github-fetch", () => ({
  fetchDefaultOwnerRepositories,
  fetchCustomRepositories,
}));

const { getRepositoriesHandler } = await import("../../../src/lib/repositories.functions");

const ENV_KEYS = ["ATLAS_LOAD_INITIAL_SOURCES", "ATLAS_INITIAL_SOURCES", "ATLAS_DEFAULT_OWNER"] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  fetchDefaultOwnerRepositories.mockClear();
  fetchCustomRepositories.mockClear();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("getRepositories — config-driven initial sources (T028)", () => {
  test("default path: no persisted sources, initialSources enabled, loads through the default-owner fast path", async () => {
    process.env["ATLAS_DEFAULT_OWNER"] = "t028-default-owner";
    fetchDefaultOwnerRepositories.mockImplementationOnce(async () => [repo({ id: 1, name: "a" })]);

    const response = await getRepositoriesHandler({});

    expect(fetchDefaultOwnerRepositories).toHaveBeenCalledTimes(1);
    expect(fetchDefaultOwnerRepositories).toHaveBeenCalledWith("t028-default-owner");
    expect(fetchCustomRepositories).not.toHaveBeenCalled();
    expect(response.isDefault).toBe(true);
    expect(response.source).toBe("live");
    expect(response.repositories.map((r) => r.name)).toEqual(["a"]);
  });

  test("multiple initial sources: combined via the same multi-source pipeline as custom sources", async () => {
    process.env["ATLAS_DEFAULT_OWNER"] = "t028-default-owner-2";
    process.env["ATLAS_INITIAL_SOURCES"] = JSON.stringify([
      { type: "github", owner: "t028-user-a" },
      { type: "github", owner: "t028-user-b" },
    ]);
    fetchCustomRepositories.mockImplementationOnce(async () => ({
      repositories: [repo({ id: 1, name: "a" }), repo({ id: 2, name: "b" })],
      sourceKey: "t028-user-a+t028-user-b",
      isDefault: false,
      warnings: [],
      meta: { requested: 2, fetched: 2, spiralCap: 800, storedCap: 2000 },
    }));

    const response = await getRepositoriesHandler({});

    expect(fetchDefaultOwnerRepositories).not.toHaveBeenCalled();
    expect(fetchCustomRepositories).toHaveBeenCalledTimes(1);
    expect(fetchCustomRepositories).toHaveBeenCalledWith([
      "https://github.com/t028-user-a",
      "https://github.com/t028-user-b",
    ]);
    expect(response.repositories.map((r) => r.name)).toEqual(["a", "b"]);
    expect(response.isDefault).toBe(true); // still the unconfigured-by-visitor startup path
    expect(response.source).toBe("live");
  });

  test("disabled initial loading: loadInitialSources=false, no fetch is made, explicit not_loaded response", async () => {
    process.env["ATLAS_LOAD_INITIAL_SOURCES"] = "false";

    const response = await getRepositoriesHandler({});

    expect(fetchDefaultOwnerRepositories).not.toHaveBeenCalled();
    expect(fetchCustomRepositories).not.toHaveBeenCalled();
    expect(response.source).toBe("not_loaded");
    expect(response.repositories).toEqual([]);
  });

  test("invalid source entries: unsupported type is skipped, the valid entry still loads", async () => {
    process.env["ATLAS_DEFAULT_OWNER"] = "t028-default-owner-3";
    process.env["ATLAS_INITIAL_SOURCES"] = JSON.stringify([
      { type: "gitlab", owner: "t028-unsupported" },
      { type: "github", owner: "t028-valid-owner" },
    ]);
    fetchCustomRepositories.mockImplementationOnce(async () => ({
      repositories: [repo({ id: 1, name: "only-valid-repo" })],
      sourceKey: "t028-valid-owner",
      isDefault: false,
      warnings: [],
      meta: { requested: 1, fetched: 1, spiralCap: 800, storedCap: 2000 },
    }));

    const response = await getRepositoriesHandler({});

    // Only the valid entry reaches the fetch call — the gitlab entry never
    // makes it past atlas-config.ts's parseInitialSources (T019), and
    // repositories.functions.ts (T020) never sees it at all.
    expect(fetchCustomRepositories).toHaveBeenCalledWith(["https://github.com/t028-valid-owner"]);
    expect(response.repositories.map((r) => r.name)).toEqual(["only-valid-repo"]);
  });

  test("all configured entries invalid: no crash, explicit not_loaded response, no fetch made", async () => {
    process.env["ATLAS_DEFAULT_OWNER"] = "t028-default-owner-4";
    process.env["ATLAS_INITIAL_SOURCES"] = JSON.stringify([
      { type: "gitlab", owner: "t028-a" },
      { type: "bitbucket", owner: "t028-b" },
    ]);

    const response = await getRepositoriesHandler({});

    expect(fetchDefaultOwnerRepositories).not.toHaveBeenCalled();
    expect(fetchCustomRepositories).not.toHaveBeenCalled();
    expect(response.source).toBe("not_loaded");
    expect(response.repositories).toEqual([]);
  });

  test("existing behavior: persisted/custom sources bypass initialSources entirely, unaffected by config", async () => {
    process.env["ATLAS_LOAD_INITIAL_SOURCES"] = "false"; // would block initial-sources loading, but must not affect this path
    fetchCustomRepositories.mockImplementationOnce(async () => ({
      repositories: [repo({ id: 1, name: "custom-repo" })],
      sourceKey: "some-custom-user",
      isDefault: false,
      warnings: [],
      meta: { requested: 1, fetched: 1, spiralCap: 800, storedCap: 2000 },
    }));

    const response = await getRepositoriesHandler({ sources: ["https://github.com/some-custom-user"] });

    expect(fetchCustomRepositories).toHaveBeenCalledTimes(1);
    expect(fetchCustomRepositories).toHaveBeenCalledWith(["https://github.com/some-custom-user"]);
    expect(response.isDefault).toBe(false);
    expect(response.repositories.map((r) => r.name)).toEqual(["custom-repo"]);
  });
});
