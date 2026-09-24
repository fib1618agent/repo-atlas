import { describe, expect, test } from "bun:test";
import { validateRowsForMode } from "../../src/lib/source-input-mode";

describe("validateRowsForMode (T014)", () => {
  describe("users mode", () => {
    test("accepts GitHub user URLs", () => {
      const result = validateRowsForMode(["https://github.com/octocat"], "users");
      expect(result.parsed).toHaveLength(1);
      expect(result.parsed[0]).toMatchObject({ login: "octocat", kind: "user" });
      expect(result.errors).toEqual({});
    });

    test("accepts GitHub org URLs", () => {
      const result = validateRowsForMode(["https://github.com/orgs/github"], "users");
      expect(result.parsed).toHaveLength(1);
      expect(result.parsed[0]).toMatchObject({ login: "github", kind: "org" });
      expect(result.errors).toEqual({});
    });

    test("also accepts repo URLs — preserves today's unrestricted behavior exactly", () => {
      const result = validateRowsForMode(["https://github.com/octocat/Hello-World"], "users");
      expect(result.parsed).toHaveLength(1);
      expect(result.parsed[0]).toMatchObject({ login: "octocat", kind: "repo", sourceUrl: "https://github.com/octocat/Hello-World" });
      expect(result.errors).toEqual({});
    });

    test("bare login (no URL) accepted, same as existing parseGitHubSource behavior", () => {
      const result = validateRowsForMode(["octocat"], "users");
      expect(result.parsed).toHaveLength(1);
      expect(result.parsed[0]).toMatchObject({ login: "octocat", kind: "user" });
    });
  });

  describe("repositories mode", () => {
    test("accepts repository URLs", () => {
      const result = validateRowsForMode(["https://github.com/octocat/Hello-World"], "repositories");
      expect(result.parsed).toHaveLength(1);
      expect(result.parsed[0]).toMatchObject({ login: "octocat", kind: "repo", sourceUrl: "https://github.com/octocat/Hello-World" });
      expect(result.errors).toEqual({});
    });

    test("rejects a user URL with a row-level error, no parsed entry", () => {
      const result = validateRowsForMode(["https://github.com/octocat"], "repositories");
      expect(result.parsed).toHaveLength(0);
      expect(result.errors[0]).toMatch(/not a specific repository URL/);
    });

    test("rejects an org URL with a row-level error", () => {
      const result = validateRowsForMode(["https://github.com/orgs/github"], "repositories");
      expect(result.parsed).toHaveLength(0);
      expect(result.errors[0]).toMatch(/not a specific repository URL/);
    });

    test("rejects a bare login (parses as user kind) in repositories mode", () => {
      const result = validateRowsForMode(["octocat"], "repositories");
      expect(result.parsed).toHaveLength(0);
      expect(Object.keys(result.errors)).toEqual(["0"]);
    });
  });

  describe("multiple rows", () => {
    test("validates each row independently, preserves error indexes, parses only valid rows", () => {
      const result = validateRowsForMode(
        [
          "https://github.com/octocat/Hello-World", // valid repo
          "https://github.com/octocat", // invalid in repositories mode
          "not a url at all!!", // invalid URL
          "https://github.com/torvalds/linux", // valid repo
        ],
        "repositories",
      );

      expect(result.parsed).toHaveLength(2);
      expect(result.parsed[0]).toMatchObject({ login: "octocat", kind: "repo", sourceUrl: "https://github.com/octocat/Hello-World" });
      expect(result.parsed[1]).toMatchObject({ login: "torvalds", kind: "repo", sourceUrl: "https://github.com/torvalds/linux" });
      expect(Object.keys(result.errors).sort()).toEqual(["1", "2"]);
    });

    test("users mode: mixed valid/invalid rows preserve index-to-error mapping", () => {
      const result = validateRowsForMode(
        ["https://github.com/octocat", "https://not-github.com/x", "https://github.com/torvalds"],
        "users",
      );

      expect(result.parsed).toHaveLength(2);
      expect(Object.keys(result.errors)).toEqual(["1"]);
    });
  });

  describe("empty/invalid input", () => {
    test("empty rows array returns empty parsed and empty errors", () => {
      const result = validateRowsForMode([], "users");
      expect(result).toEqual({ parsed: [], errors: {} });
    });

    test("whitespace-only and empty-string rows are silently skipped, not errors", () => {
      const result = validateRowsForMode(["", "   ", "\t"], "users");
      expect(result.parsed).toEqual([]);
      expect(result.errors).toEqual({});
    });

    test("malformed input produces a row error, never throws", () => {
      expect(() => validateRowsForMode(["not a valid url $$$ /// "], "users")).not.toThrow();
      const result = validateRowsForMode(["ht!tp://[[[bad"], "users");
      expect(result.parsed).toHaveLength(0);
      expect(Object.keys(result.errors)).toEqual(["0"]);
    });
  });

  describe("deterministic behavior", () => {
    test("same input produces the same output on repeated calls", () => {
      const input = [
        "https://github.com/octocat/Hello-World",
        "https://github.com/octocat",
        "",
        "https://github.com/torvalds/linux",
      ];

      const first = validateRowsForMode(input, "repositories");
      const second = validateRowsForMode(input, "repositories");

      expect(first).toEqual(second);
    });
  });
});
