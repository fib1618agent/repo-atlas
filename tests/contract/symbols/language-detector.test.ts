import { describe, expect, test } from "bun:test";
import { detectLanguage } from "../../../src/lib/code-intel/symbols/language-detector";

/**
 * FR-001, FR-002, FR-003 (spec.md) — deterministic, extension-based language
 * detection for the Tier 1 scope only (research.md §4, contracts/language-grammar-provider.md).
 * No content sniffing: detectLanguage takes only a path, never file bytes.
 */
describe("detectLanguage (FR-001, FR-002, FR-003)", () => {
  test.each([
    ["Foo.java", "java"],
    ["src/main/java/com/example/Foo.java", "java"],
    ["index.js", "javascript"],
    ["component.jsx", "javascript"],
    ["esm.mjs", "javascript"],
    ["common.cjs", "javascript"],
    ["src/lib/thing.js", "javascript"],
    ["index.ts", "typescript"],
    ["module.mts", "typescript"],
    ["config.cts", "typescript"],
    ["src/lib/thing.ts", "typescript"],
    ["App.tsx", "tsx"],
    ["src/components/App.tsx", "tsx"],
  ] as const)("%s -> %s", (path, expected) => {
    expect(detectLanguage(path)).toBe(expected);
  });

  test.each([
    ["README.md"],
    ["style.css"],
    ["image.png"],
    ["data.json"],
    ["Makefile"],
    ["script.py"],
    ["lib.rs"],
    ["index.html"],
    ["noextension"],
    [""],
  ] as const)("%s -> null (unsupported, Tier 1 only)", (path) => {
    expect(detectLanguage(path)).toBeNull();
  });

  test("is deterministic: same path always yields the same result across repeated calls", () => {
    const path = "src/lib/code-intel/symbols/language-detector.ts";
    const results = Array.from({ length: 20 }, () => detectLanguage(path));
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe("typescript");
  });

  test("is a pure function of the path only — takes no content/bytes parameter", () => {
    // Structural guarantee, not just a runtime check: detectLanguage's arity is 1
    // (path only). A second (content) parameter would defeat FR-001's "no content
    // sniffing" determinism guarantee (research.md §4).
    expect(detectLanguage.length).toBe(1);
  });

  test("TypeScript and TSX are distinct languages, never conflated", () => {
    expect(detectLanguage("a.ts")).toBe("typescript");
    expect(detectLanguage("a.tsx")).toBe("tsx");
    expect(detectLanguage("a.ts")).not.toBe(detectLanguage("a.tsx"));
  });

  test("detection does not depend on directory depth or path separators", () => {
    expect(detectLanguage("a.java")).toBe(detectLanguage("very/deep/nested/path/a.java"));
  });
});
