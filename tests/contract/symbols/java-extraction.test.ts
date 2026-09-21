import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Language, Parser } from "web-tree-sitter";
import { toIntermediateRepresentation } from "../../../src/lib/code-intel/symbols/to-intermediate-representation";

/**
 * T017 (spec.md US1, contracts/language-grammar-provider.md "Symbol query
 * patterns") — dedicated Java fixture contract test. Real grammar, real
 * parse, real query (same instantiateWasm mechanism as
 * to-intermediate-representation.test.ts / grammar-provider.test.ts, no
 * mocking). Exercises java.scm's three capture kinds (class, interface,
 * method) together in one fixture, including a nested interface-in-class
 * shape, and asserts both the produced symbols and their source ranges.
 */

const ROOT = resolve(import.meta.dir, "../../../node_modules");
const PUBLIC_WASM = resolve(import.meta.dir, "../../../public/wasm");
const QUERIES = resolve(import.meta.dir, "../../../src/lib/code-intel/symbols/queries");

let Java: Language;
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

  Java = await Language.load(new Uint8Array(readFileSync(resolve(PUBLIC_WASM, "tree-sitter-java.wasm"))));
});

function parse(source: string) {
  const parser = new Parser();
  parser.setLanguage(Java);
  return parser.parse(source)!;
}

// 0-indexed lines:
// 0 "class Greeter {"
// 1 "  interface Loud {"
// 2 "    void shout();"
// 3 "  }"
// 4 ""
// 5 "  int greet() { return 1; }"
// 6 "}"
const FIXTURE =
  "class Greeter {\n" +
  "  interface Loud {\n" +
  "    void shout();\n" +
  "  }\n" +
  "\n" +
  "  int greet() { return 1; }\n" +
  "}\n";

describe("Java extraction fixture (T017, contracts/language-grammar-provider.md)", () => {
  test("class + interface + method all captured with expected kinds and names", () => {
    const tree = parse(FIXTURE);
    expect(tree.rootNode.hasError).toBe(false);
    const ir = toIntermediateRepresentation(tree, Java, javaQuery, 1, "Greeter.java");

    expect(ir).toHaveLength(4);
    const byName = Object.fromEntries(ir.map((s) => [s.name, s]));
    expect(byName["Greeter"]!.kind).toBe("class");
    expect(byName["Loud"]!.kind).toBe("interface");
    expect(byName["shout"]!.kind).toBe("method");
    expect(byName["greet"]!.kind).toBe("method");
  });

  test("nesting: interface is a child of the class, methods are children of their declaring type", () => {
    const tree = parse(FIXTURE);
    const ir = toIntermediateRepresentation(tree, Java, javaQuery, 1, "Greeter.java");
    const byName = Object.fromEntries(ir.map((s) => [s.name, s]));

    expect(byName["Greeter"]!.parentSymbolKey).toBeNull();
    expect(byName["Loud"]!.parentSymbolKey).toBe(byName["Greeter"]!.symbolKey);
    expect(byName["shout"]!.parentSymbolKey).toBe(byName["Loud"]!.symbolKey);
    expect(byName["greet"]!.parentSymbolKey).toBe(byName["Greeter"]!.symbolKey);
    expect(byName["shout"]!.qualifiedName).toBe("Greeter.Loud.shout");
    expect(byName["greet"]!.qualifiedName).toBe("Greeter.greet");
  });

  test("source ranges are 0-indexed tree-sitter positions matching the fixture layout", () => {
    const tree = parse(FIXTURE);
    const ir = toIntermediateRepresentation(tree, Java, javaQuery, 1, "Greeter.java");
    const byName = Object.fromEntries(ir.map((s) => [s.name, s]));

    expect(byName["Greeter"]!.startLine).toBe(0);
    expect(byName["Greeter"]!.startColumn).toBe(0);
    expect(byName["Greeter"]!.endLine).toBe(6);

    expect(byName["Loud"]!.startLine).toBe(1);
    expect(byName["Loud"]!.startColumn).toBe(2);
    expect(byName["Loud"]!.endLine).toBe(3);

    expect(byName["shout"]!.startLine).toBe(2);
    expect(byName["shout"]!.startColumn).toBe(4);

    expect(byName["greet"]!.startLine).toBe(5);
    expect(byName["greet"]!.startColumn).toBe(2);
    expect(byName["greet"]!.endLine).toBe(5);
  });

  test("symbolKeys are unique and every non-null parentSymbolKey resolves to a real symbolKey in the IR", () => {
    const tree = parse(FIXTURE);
    const ir = toIntermediateRepresentation(tree, Java, javaQuery, 1, "Greeter.java");
    const keys = ir.map((s) => s.symbolKey);
    expect(new Set(keys).size).toBe(keys.length);
    const allKeys = new Set(keys);
    for (const s of ir) {
      if (s.parentSymbolKey !== null) expect(allKeys.has(s.parentSymbolKey)).toBe(true);
    }
  });
});
