import { afterEach, describe, expect, test } from "bun:test";
import { githubContentProvider } from "../../../src/lib/code-intel/providers/github-content-provider";
import { isAtlasError } from "../../../src/lib/atlas-errors";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("ref resolution (FR-005, FR-006, FR-007)", () => {
  test("a valid branch resolves to exactly one 40-char SHA", async () => {
    const sha = "b".repeat(40);
    globalThis.fetch = (async () =>
      new Response(sha, { status: 200 })) as unknown as typeof fetch;

    const resolved = await githubContentProvider.resolveRef(
      { provider: "github", owner: "o", name: "r" },
      "main",
    );
    expect(resolved).toBe(sha as never);
  });

  test("a nonexistent ref throws REF_NOT_FOUND", async () => {
    globalThis.fetch = (async () =>
      new Response("Not Found", { status: 404 })) as unknown as typeof fetch;

    try {
      await githubContentProvider.resolveRef(
        { provider: "github", owner: "o", name: "r" },
        "does-not-exist",
      );
      throw new Error("expected resolveRef to throw");
    } catch (error) {
      expect(isAtlasError(error)).toBe(true);
      if (isAtlasError(error)) expect(error.code).toBe("REF_NOT_FOUND");
    }
  });
});
