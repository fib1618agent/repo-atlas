import { describe, expect, test } from "bun:test";
import {
  isCommitShaShape,
  toCommitSha,
} from "../../../src/lib/code-intel/domain/repository-identity";

describe("commit SHA runtime shape guard (SC-002)", () => {
  test("accepts a 40-char-hex value", () => {
    const sha = "a".repeat(40);
    expect(isCommitShaShape(sha)).toBe(true);
    expect(toCommitSha(sha)).toBe(sha as never);
  });

  test("rejects a branch-name-shaped value even if 40 chars long by coincidence", () => {
    expect(isCommitShaShape("main")).toBe(false);
    expect(() => toCommitSha("main")).toThrow();
  });

  test("rejects a non-hex 40-char value", () => {
    const notHex = "z".repeat(40);
    expect(isCommitShaShape(notHex)).toBe(false);
    expect(() => toCommitSha(notHex)).toThrow();
  });

  test("rejects wrong-length hex strings", () => {
    expect(isCommitShaShape("abc123")).toBe(false);
    expect(isCommitShaShape("a".repeat(41))).toBe(false);
  });
});
