import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getParser,
  setTestCoreWasmModule,
  setTestGrammarBytesSource,
  type TreeSitterParserHandle,
} from "../../../src/lib/code-intel/symbols/grammar-provider";
import type { SupportedLanguage } from "../../../src/lib/code-intel/symbols/language-detector";

/**
 * FR-004 (spec.md), contracts/language-grammar-provider.md's GrammarProvider.
 * Exercises the real Parser.init/Language.load/setLanguage path (no mocked
 * parsing) with bytes read from the same public/wasm/*.wasm assets the
 * production ASSETS binding serves — only the byte-sourcing transport
 * differs (local fs here vs. env.ASSETS.fetch() in a deployed Worker), never
 * the grammar-loading logic itself.
 */

const ASSET_FILE: Record<SupportedLanguage, string> = {
  java: "tree-sitter-java.wasm",
  javascript: "tree-sitter-javascript.wasm",
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
};

beforeAll(async () => {
  setTestGrammarBytesSource(async (language) => {
    const path = resolve(import.meta.dir, "../../../public/wasm", ASSET_FILE[language]);
    return new Uint8Array(readFileSync(path));
  });

  // Bun's native `.wasm?module` resolution returns a bare path string, not a
  // compiled WebAssembly.Module the way Nitro's unwasm-based ESM import does
  // in production — see grammar-provider.ts's setTestCoreWasmModule doc
  // comment. Compile the real core runtime .wasm here instead.
  const corePath = resolve(
    import.meta.dir,
    "../../../node_modules/web-tree-sitter/tree-sitter.wasm",
  );
  const coreModule = await WebAssembly.compile(readFileSync(corePath));
  setTestCoreWasmModule(coreModule);
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
