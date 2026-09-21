import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Language, Parser } from "web-tree-sitter";
import { toIntermediateRepresentation } from "../../../src/lib/code-intel/symbols/to-intermediate-representation";

/**
 * T018 (spec.md US1, contracts/language-grammar-provider.md "Symbol query
 * patterns") — dedicated JavaScript fixture contract test, mirrors T017's
 * java-extraction.test.ts structure. Real grammar, real parse, real query
 * (same instantiateWasm mechanism, no mocking). Exercises javascript.scm's
 * two capture kinds relevant to a top-level-function + class-with-method
 * shape (function, class, method — javascript.scm has no interface capture,
 * confirmed in the query file's own header comment).
 */

const ROOT = resolve(import.meta.dir, "../../../node_modules");
const PUBLIC_WASM = resolve(import.meta.dir, "../../../public/wasm");
const QUERIES = resolve(import.meta.dir, "../../../src/lib/code-intel/symbols/queries");

let JavaScript: Language;
const jsQuery = readFileSync(resolve(QUERIES, "javascript.scm"), "utf8");

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
});

function parse(source: string) {
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  return parser.parse(source)!;
}

// 0-indexed lines:
// 0 "function topLevel() { return 1; }"
// 1 ""
// 2 "class Widget {"
// 3 "  render() { return 1; }"
// 4 "}"
const FIXTURE =
  "function topLevel() { return 1; }\n" +
  "\n" +
  "class Widget {\n" +
  "  render() { return 1; }\n" +
  "}\n";

describe("JavaScript extraction fixture (T018, contracts/language-grammar-provider.md)", () => {
  test("top-level function + class + method all captured with expected kinds and names", () => {
    const tree = parse(FIXTURE);
    expect(tree.rootNode.hasError).toBe(false);
    const ir = toIntermediateRepresentation(tree, JavaScript, jsQuery, 1, "widget.js");

    expect(ir).toHaveLength(3);
    const byName = Object.fromEntries(ir.map((s) => [s.name, s]));
    expect(byName["topLevel"]!.kind).toBe("function");
    expect(byName["Widget"]!.kind).toBe("class");
    expect(byName["render"]!.kind).toBe("method");
  });

  test("nesting: top-level function has no parent, method's parent is the class", () => {
    const tree = parse(FIXTURE);
    const ir = toIntermediateRepresentation(tree, JavaScript, jsQuery, 1, "widget.js");
    const byName = Object.fromEntries(ir.map((s) => [s.name, s]));

    expect(byName["topLevel"]!.parentSymbolKey).toBeNull();
    expect(byName["topLevel"]!.qualifiedName).toBeNull();
    expect(byName["Widget"]!.parentSymbolKey).toBeNull();
    expect(byName["render"]!.parentSymbolKey).toBe(byName["Widget"]!.symbolKey);
    expect(byName["render"]!.qualifiedName).toBe("Widget.render");
  });

  test("source ranges are 0-indexed tree-sitter positions matching the fixture layout", () => {
    const tree = parse(FIXTURE);
    const ir = toIntermediateRepresentation(tree, JavaScript, jsQuery, 1, "widget.js");
    const byName = Object.fromEntries(ir.map((s) => [s.name, s]));

    expect(byName["topLevel"]!.startLine).toBe(0);
    expect(byName["topLevel"]!.startColumn).toBe(0);
    expect(byName["topLevel"]!.endLine).toBe(0);

    expect(byName["Widget"]!.startLine).toBe(2);
    expect(byName["Widget"]!.startColumn).toBe(0);
    expect(byName["Widget"]!.endLine).toBe(4);

    expect(byName["render"]!.startLine).toBe(3);
    expect(byName["render"]!.startColumn).toBe(2);
    expect(byName["render"]!.endLine).toBe(3);
  });

  test("symbolKeys are unique and every non-null parentSymbolKey resolves to a real symbolKey in the IR", () => {
    const tree = parse(FIXTURE);
    const ir = toIntermediateRepresentation(tree, JavaScript, jsQuery, 1, "widget.js");
    const keys = ir.map((s) => s.symbolKey);
    expect(new Set(keys).size).toBe(keys.length);
    const allKeys = new Set(keys);
    for (const s of ir) {
      if (s.parentSymbolKey !== null) expect(allKeys.has(s.parentSymbolKey)).toBe(true);
    }
  });
});
