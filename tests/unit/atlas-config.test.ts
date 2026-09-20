import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { serverAtlasConfig, ATLAS_DEFAULT_OWNER } from "../../src/lib/atlas-config";

const ENV_KEYS = ["ATLAS_LOAD_INITIAL_SOURCES", "ATLAS_INITIAL_SOURCES", "ATLAS_DEFAULT_OWNER"] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("serverAtlasConfig — StartupSourceConfig parsing (T021)", () => {
  test("default behavior: no ATLAS_INITIAL_SOURCES configured, default owner entry present", () => {
    const config = serverAtlasConfig();
    expect(config.loadInitialSources).toBe(true);
    expect(config.initialSources).toEqual([{ type: "github", owner: ATLAS_DEFAULT_OWNER }]);
  });

  test("default owner entry reflects ATLAS_DEFAULT_OWNER override when ATLAS_INITIAL_SOURCES is unset", () => {
    process.env["ATLAS_DEFAULT_OWNER"] = "someone-else";
    const config = serverAtlasConfig();
    expect(config.initialSources).toEqual([{ type: "github", owner: "someone-else" }]);
  });

  test("configuration override: single configured GitHub source", () => {
    process.env["ATLAS_INITIAL_SOURCES"] = JSON.stringify([{ type: "github", owner: "octocat" }]);
    const config = serverAtlasConfig();
    expect(config.initialSources).toEqual([{ type: "github", owner: "octocat" }]);
  });

  test("configuration override: multiple configured GitHub sources", () => {
    process.env["ATLAS_INITIAL_SOURCES"] = JSON.stringify([
      { type: "github", owner: "octocat" },
      { type: "github", owner: "torvalds" },
    ]);
    const config = serverAtlasConfig();
    expect(config.initialSources).toEqual([
      { type: "github", owner: "octocat" },
      { type: "github", owner: "torvalds" },
    ]);
  });

  test("disabled loading: ATLAS_LOAD_INITIAL_SOURCES=false", () => {
    process.env["ATLAS_LOAD_INITIAL_SOURCES"] = "false";
    const config = serverAtlasConfig();
    expect(config.loadInitialSources).toBe(false);
  });

  test("any value other than the literal string 'false' is treated as enabled", () => {
    process.env["ATLAS_LOAD_INITIAL_SOURCES"] = "true";
    expect(serverAtlasConfig().loadInitialSources).toBe(true);
    process.env["ATLAS_LOAD_INITIAL_SOURCES"] = "0";
    expect(serverAtlasConfig().loadInitialSources).toBe(true);
  });

  test("invalid configuration: malformed JSON falls back to the default single-entry list, no crash", () => {
    process.env["ATLAS_INITIAL_SOURCES"] = "{not valid json";
    expect(() => serverAtlasConfig()).not.toThrow();
    const config = serverAtlasConfig();
    expect(config.initialSources).toEqual([{ type: "github", owner: ATLAS_DEFAULT_OWNER }]);
  });

  test("invalid configuration: non-array JSON falls back to the default single-entry list, no crash", () => {
    process.env["ATLAS_INITIAL_SOURCES"] = JSON.stringify({ type: "github", owner: "octocat" });
    expect(() => serverAtlasConfig()).not.toThrow();
    const config = serverAtlasConfig();
    expect(config.initialSources).toEqual([{ type: "github", owner: ATLAS_DEFAULT_OWNER }]);
  });

  test("invalid configuration: an unrecognized type is skipped, valid entries still load, no crash", () => {
    process.env["ATLAS_INITIAL_SOURCES"] = JSON.stringify([
      { type: "gitlab", owner: "someone" },
      { type: "github", owner: "octocat" },
    ]);
    expect(() => serverAtlasConfig()).not.toThrow();
    const config = serverAtlasConfig();
    expect(config.initialSources).toEqual([{ type: "github", owner: "octocat" }]);
  });

  test("invalid configuration: malformed entries (missing owner, wrong types) are skipped, no crash", () => {
    process.env["ATLAS_INITIAL_SOURCES"] = JSON.stringify([
      { type: "github" }, // missing owner
      { type: "github", owner: 42 }, // wrong type
      null,
      "not an object",
      { type: "github", owner: "octocat" }, // valid
    ]);
    expect(() => serverAtlasConfig()).not.toThrow();
    const config = serverAtlasConfig();
    expect(config.initialSources).toEqual([{ type: "github", owner: "octocat" }]);
  });

  test("invalid configuration: all entries invalid produces an empty list, not a crash and not a fallback substitution", () => {
    process.env["ATLAS_INITIAL_SOURCES"] = JSON.stringify([
      { type: "gitlab", owner: "someone" },
      { type: "bitbucket", owner: "someone-else" },
    ]);
    expect(() => serverAtlasConfig()).not.toThrow();
    const config = serverAtlasConfig();
    expect(config.initialSources).toEqual([]);
  });
});
