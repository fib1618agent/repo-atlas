import { beforeAll, describe, expect, test } from "bun:test";
import {
  getParser,
  type TreeSitterParserHandle,
} from "../../../src/lib/code-intel/symbols/grammar-provider";
import { installTestWasmModules } from "../../support/wasm-test-modules";
import type { SupportedLanguage } from "../../../src/lib/code-intel/symbols/language-detector";

/**
 * FR-004 (spec.md), contracts/language-grammar-provider.md's GrammarProvider.
 * Exercises the real Parser.init/Language.load/setLanguage path (no mocked
 * parsing) against real, locally `WebAssembly.compile`d modules of the same
 * public/wasm/*.wasm assets the production build's `?module` imports embed
 * at build time (T066) — only how the Module is obtained differs (local
 * compile here vs. Nitro's unwasm ESM WASM handling in the real build),
 * never the grammar-loading logic itself.
 */

beforeAll(async () => {
  await installTestWasmModules();
});

function assertRealParse(parser: TreeSitterParserHandle, source: string, expectRootType: string) {
  const tree = parser.parse(source);
  expect(tree).not.toBeNull();
  expect(tree!.rootNode.type).toBe(expectRootType);
  expect(tree!.rootNode.hasError).toBe(false);
  tree!.delete();
}

describe("GrammarProvider.getParser (contracts/language-grammar-provider.md)", () => {
  test("Java: loads a real parser and produces a real, error-free AST", async () => {
    const parser = await getParser("java");
    assertRealParse(parser, "class Foo { int bar() { return 1; } }\n", "program");
  });

  test("JavaScript: loads a real parser and produces a real, error-free AST", async () => {
    const parser = await getParser("javascript");
    assertRealParse(parser, "function foo() { return 1; }\n", "program");
  });

  test("TypeScript: loads a real parser and produces a real, error-free AST", async () => {
    const parser = await getParser("typescript");
    assertRealParse(parser, "interface Foo { bar(): number; }\n", "program");
  });

  test("TSX: loads a real parser and produces a real, error-free AST", async () => {
    const parser = await getParser("tsx");
    assertRealParse(parser, "function App() { return <div />; }\n", "program");
  });

  test("repeated getParser(language) calls reuse the memoized parser instance", async () => {
    const first = await getParser("javascript");
    const second = await getParser("javascript");
    expect(second).toBe(first);
  });

  test("different languages get distinct, independently memoized parser instances", async () => {
    const js = await getParser("javascript");
    const ts = await getParser("typescript");
    expect(js).not.toBe(ts);
  });

  test("unsupported language is rejected defensively", async () => {
    await expect(getParser("python" as SupportedLanguage)).rejects.toThrow(/unsupported language/i);
  });

  test("getParser is independent of detectLanguage — takes a SupportedLanguage value, never a path", () => {
    expect(getParser.length).toBe(1);
  });
});
