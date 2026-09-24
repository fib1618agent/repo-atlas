import { describe, expect, test } from "bun:test";
import {
  isValidName,
  isValidOwner,
  matchesFullName,
  repositoryUrl,
  splitFullName,
  toIdentity,
} from "../../../src/lib/repo-intel/identity";

describe("identity params (SEC-001)", () => {
  test("accepts ordinary GitHub owners and names", () => {
    expect(toIdentity("octo-org", "hello.world_1")).toEqual({
      provider: "github",
      owner: "octo-org",
      name: "hello.world_1",
    });
    expect(isValidOwner("a")).toBe(true);
    expect(isValidName("..config")).toBe(true);
  });

  test("rejects malformed or injection-shaped params", () => {
    for (const owner of [
      "",
      "-x",
      "x y",
      "x/y",
      "x;drop",
      "a".repeat(40),
      "x'--",
    ]) {
      expect(isValidOwner(owner)).toBe(false);
    }
    for (const name of [
      "",
      ".",
      "..",
      "a/b",
      "a b",
      "a".repeat(101),
      "x'; --",
      "%2e",
    ]) {
      expect(isValidName(name)).toBe(false);
    }
    expect(toIdentity("ok", "..")).toBeNull();
    expect(toIdentity("bad owner", "ok")).toBeNull();
  });
});

describe("provider full_name matching (FR-002)", () => {
  test("splitFullName requires exactly owner/name", () => {
    expect(splitFullName("o/n")).toEqual({ owner: "o", name: "n" });
    expect(splitFullName("o")).toBeNull();
    expect(splitFullName("o/n/x")).toBeNull();
    expect(splitFullName("o/..")).toBeNull();
  });

  test("case-insensitive match, mismatch and malformed full names", () => {
    expect(
      matchesFullName({ owner: "OWNER", name: "Repo" }, "owner/repo"),
    ).toBe(true);
    expect(
      matchesFullName({ owner: "owner", name: "repo" }, "owner/other"),
    ).toBe(false);
    expect(matchesFullName({ owner: "owner", name: "repo" }, "nonsense")).toBe(
      false,
    );
  });

  test("repositoryUrl builds the provider source URL", () => {
    expect(repositoryUrl({ owner: "o", name: "n" })).toBe(
      "https://github.com/o/n",
    );
  });
});
