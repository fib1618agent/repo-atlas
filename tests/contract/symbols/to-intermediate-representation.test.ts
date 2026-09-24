import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Language, Parser } from "web-tree-sitter";
import { toIntermediateRepresentation } from "../../../src/lib/code-intel/symbols/to-intermediate-representation";

/**
 * T028 — real parsing, real queries, real grammars (no mocking). Reuses the
 * same instantiateWasm mechanism T012/T022 validated; independent of
 * grammar-provider.ts's ASSETS-binding path (not exercised here — this test
 * loads grammar bytes directly from `public/wasm/`, same files, different
 * transport, exactly like grammar-provider.test.ts's own local test path).
 */

const ROOT = resolve(import.meta.dir, "../../../node_modules");
const PUBLIC_WASM = resolve(import.meta.dir, "../../../public/wasm");
const QUERIES = resolve(import.meta.dir, "../../../src/lib/code-intel/symbols/queries");

let JavaScript: Language;
let Java: Language;
const jsQuery = readFileSync(resolve(QUERIES, "javascript.scm"), "utf8");
const javaQuery = readFileSync(resolve(QUERIES, "java.scm"), "utf8");

beforeAll(async () => {
  const coreBytes = readFileSync(resolve(ROOT, "web-tree-sitter/tree-sitter.wasm"));
  const coreModule = await WebAssembly.compile(coreBytes);
  await Parser.init({
    instantiateWasm(imports: WebAssembly.Imports, successCallback: (i: WebAssembly.Instance, m: WebAssembly.Module) => void) {
      WebAssembly.instantiate(coreModule, imports).then((instance) => successCallback(instance, coreModule));
      return {};
    },
  } as Parameters<typeof Parser.init>[0]);

  JavaScript = await Language.load(new Uint8Array(readFileSync(resolve(PUBLIC_WASM, "tree-sitter-javascript.wasm"))));
  Java = await Language.load(new Uint8Array(readFileSync(resolve(PUBLIC_WASM, "tree-sitter-java.wasm"))));
});

function parse(language: Language, source: string) {
  const parser = new Parser();
  parser.setLanguage(language);
  return parser.parse(source)!;
}

describe("toIntermediateRepresentation (T028, FR-009, FR-010, FR-013)", () => {
  test("top-level symbol has parentSymbolKey = null", () => {
    const tree = parse(JavaScript, "function topLevel() { return 1; }\n");
    const ir = toIntermediateRepresentation(tree, JavaScript, jsQuery, 1, "a.js");
    expect(ir).toHaveLength(1);
    expect(ir[0]!.kind).toBe("function");
    expect(ir[0]!.name).toBe("topLevel");
    expect(ir[0]!.parentSymbolKey).toBeNull();
    expect(ir[0]!.qualifiedName).toBeNull();
  });

  test("nested symbol's parentSymbolKey equals its parent's symbolKey (JavaScript: class -> method)", () => {
    const tree = parse(JavaScript, "class Widget {\n  render() { return 1; }\n}\n");
    const ir = toIntermediateRepresentation(tree, JavaScript, jsQuery, 1, "b.js");
    const cls = ir.find((s) => s.kind === "class")!;
    const method = ir.find((s) => s.kind === "method")!;
    expect(cls.parentSymbolKey).toBeNull();
    expect(method.parentSymbolKey).toBe(cls.symbolKey);
    expect(method.qualifiedName).toBe("Widget.render");
  });

  test("multi-level nesting (Java: interface + method) derives ancestor chain by real AST structure, not capture order", () => {
    const tree = parse(Java, "interface Bar {\n  int qux();\n}\n");
    const ir = toIntermediateRepresentation(tree, Java, javaQuery, 1, "Bar.java");
    const iface = ir.find((s) => s.kind === "interface")!;
    const method = ir.find((s) => s.kind === "method")!;
    expect(iface.parentSymbolKey).toBeNull();
    expect(method.parentSymbolKey).toBe(iface.symbolKey);
    expect(method.qualifiedName).toBe("Bar.qux");
  });

  test("source ranges are 0-indexed tree-sitter positions, recorded verbatim", () => {
    const source = "class Foo {\n  bar() { return 1; }\n}\n";
    const tree = parse(JavaScript, source);
    const ir = toIntermediateRepresentation(tree, JavaScript, jsQuery, 1, "c.js");
    const method = ir.find((s) => s.kind === "method")!;
    // "  bar() { return 1; }" starts on line 1 (0-indexed), column 2.
    expect(method.startLine).toBe(1);
    expect(method.startColumn).toBe(2);
    expect(method.endLine).toBeGreaterThanOrEqual(method.startLine);
  });

  test("symbolKey is deterministic: identical source parsed twice yields identical keys", () => {
    const source = "class Foo {\n  bar() { return 1; }\n}\nfunction baz() {}\n";
    const tree1 = parse(JavaScript, source);
    const tree2 = parse(JavaScript, source);
    const ir1 = toIntermediateRepresentation(tree1, JavaScript, jsQuery, 42, "d.js");
    const ir2 = toIntermediateRepresentation(tree2, JavaScript, jsQuery, 42, "d.js");
    expect(ir1.map((s) => s.symbolKey).sort()).toEqual(ir2.map((s) => s.symbolKey).sort());
  });

  test("symbolKey changes when snapshotId changes (same source, different snapshot)", () => {
    const source = "function baz() {}\n";
    const tree1 = parse(JavaScript, source);
    const tree2 = parse(JavaScript, source);
    const ir1 = toIntermediateRepresentation(tree1, JavaScript, jsQuery, 1, "e.js");
    const ir2 = toIntermediateRepresentation(tree2, JavaScript, jsQuery, 2, "e.js");
    expect(ir1[0]!.symbolKey).not.toBe(ir2[0]!.symbolKey);
  });

  test("sibling symbols under the same parent never share a symbolKey, and every non-null parentSymbolKey resolves to a real symbolKey in the IR", () => {
    const tree = parse(JavaScript, "class Widget {\n  a() { return 1; }\n  b() { return 2; }\n}\n");
    const ir = toIntermediateRepresentation(tree, JavaScript, jsQuery, 1, "f.js");
    const keys = ir.map((s) => s.symbolKey);
    expect(new Set(keys).size).toBe(keys.length);
    const allKeys = new Set(keys);
    for (const s of ir) {
      if (s.parentSymbolKey !== null) expect(allKeys.has(s.parentSymbolKey)).toBe(true);
    }
  });

  test("compiled-query cache is keyed by query source: same language, different .scm body, different results", () => {
    const tree = parse(JavaScript, "class Foo { bar() {} }\nfunction baz() {}\n");
    const full = toIntermediateRepresentation(tree, JavaScript, jsQuery, 1, "a.js");
    const fullAgain = toIntermediateRepresentation(tree, JavaScript, jsQuery, 1, "a.js");
    const classOnlyQuery = "(class_declaration name: (identifier) @symbol.name) @symbol.class";
    const classOnly = toIntermediateRepresentation(tree, JavaScript, classOnlyQuery, 1, "a.js");
    expect(fullAgain).toEqual(full);
    expect(full.length).toBeGreaterThan(classOnly.length);
    expect(classOnly.map((s) => s.name)).toEqual(["Foo"]);
  });

  test("empty file (no matches) produces an empty IR, not an error", () => {
    const tree = parse(JavaScript, "const x = 1;\n");
    const ir = toIntermediateRepresentation(tree, JavaScript, jsQuery, 1, "g.js");
    expect(ir).toEqual([]);
  });
});
