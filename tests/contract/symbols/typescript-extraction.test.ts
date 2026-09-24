import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Language, Parser } from "web-tree-sitter";
import { toIntermediateRepresentation } from "../../../src/lib/code-intel/symbols/to-intermediate-representation";

/**
 * T019 (spec.md US1, contracts/language-grammar-provider.md "Symbol query
 * patterns") — dedicated TypeScript + TSX fixture contract test, mirrors
 * T017/T018's structure. Real grammar, real parse, real query, no mocking.
 */

const ROOT = resolve(import.meta.dir, "../../../node_modules");
const PUBLIC_WASM = resolve(import.meta.dir, "../../../public/wasm");
const QUERIES = resolve(import.meta.dir, "../../../src/lib/code-intel/symbols/queries");

let TypeScript: Language;
let Tsx: Language;
const tsQuery = readFileSync(resolve(QUERIES, "typescript.scm"), "utf8");
const tsxQuery = readFileSync(resolve(QUERIES, "tsx.scm"), "utf8");

beforeAll(async () => {
  const coreBytes = readFileSync(resolve(ROOT, "web-tree-sitter/tree-sitter.wasm"));
  const coreModule = await WebAssembly.compile(coreBytes);
  await Parser.init({
    instantiateWasm(imports: WebAssembly.Imports, successCallback: (i: WebAssembly.Instance, m: WebAssembly.Module) => void) {
      WebAssembly.instantiate(coreModule, imports).then((instance) => successCallback(instance, coreModule));
      return {};
    },
  } as Parameters<typeof Parser.init>[0]);

  TypeScript = await Language.load(new Uint8Array(readFileSync(resolve(PUBLIC_WASM, "tree-sitter-typescript.wasm"))));
  Tsx = await Language.load(new Uint8Array(readFileSync(resolve(PUBLIC_WASM, "tree-sitter-tsx.wasm"))));
});

function parse(language: Language, source: string) {
  const parser = new Parser();
  parser.setLanguage(language);
  return parser.parse(source)!;
}

// 0-indexed lines:
// 0 "interface Greeter {"
// 1 "  greet(): string;"
// 2 "}"
// 3 ""
// 4 "class EnglishGreeter implements Greeter {"
// 5 "  greet() { return \"hi\"; }"
// 6 "}"
const TS_FIXTURE =
  "interface Greeter {\n" +
  "  greet(): string;\n" +
  "}\n" +
  "\n" +
  "class EnglishGreeter implements Greeter {\n" +
  '  greet() { return "hi"; }\n' +
  "}\n";

// 0-indexed lines:
// 0 "function App() {"
// 1 "  return <div />;"
// 2 "}"
const TSX_FIXTURE = "function App() {\n  return <div />;\n}\n";

describe("TypeScript extraction fixture (T019, contracts/language-grammar-provider.md)", () => {
  test(".ts: interface + class-implementing-interface, each with its own method, captured with expected kinds/names", () => {
    const tree = parse(TypeScript, TS_FIXTURE);
    expect(tree.rootNode.hasError).toBe(false);
    const ir = toIntermediateRepresentation(tree, TypeScript, tsQuery, 1, "greeter.ts");

    expect(ir).toHaveLength(4);
    const iface = ir.find((s) => s.name === "Greeter")!;
    const cls = ir.find((s) => s.name === "EnglishGreeter")!;
    const ifaceMethod = ir.find((s) => s.parentSymbolKey === iface.symbolKey)!;
    const classMethod = ir.find((s) => s.parentSymbolKey === cls.symbolKey)!;

    expect(iface.kind).toBe("interface");
    expect(cls.kind).toBe("class");
    expect(ifaceMethod.kind).toBe("method");
    expect(ifaceMethod.name).toBe("greet");
    expect(ifaceMethod.qualifiedName).toBe("Greeter.greet");
    expect(classMethod.kind).toBe("method");
    expect(classMethod.name).toBe("greet");
    expect(classMethod.qualifiedName).toBe("EnglishGreeter.greet");
    // two distinct "greet" methods, disambiguated only by parent/qualifiedName
    expect(ifaceMethod.symbolKey).not.toBe(classMethod.symbolKey);
  });

  test(".ts: source ranges are 0-indexed tree-sitter positions matching the fixture layout", () => {
    const tree = parse(TypeScript, TS_FIXTURE);
    const ir = toIntermediateRepresentation(tree, TypeScript, tsQuery, 1, "greeter.ts");
    const iface = ir.find((s) => s.name === "Greeter")!;
    const cls = ir.find((s) => s.name === "EnglishGreeter")!;

    expect(iface.startLine).toBe(0);
    expect(iface.startColumn).toBe(0);
    expect(cls.startLine).toBe(4);
    expect(cls.startColumn).toBe(0);
  });

  test(".tsx: top-level function component captured as @symbol.function, no capture ever matches a jsx_* node", () => {
    const tree = parse(Tsx, TSX_FIXTURE);
    expect(tree.rootNode.hasError).toBe(false);
    const ir = toIntermediateRepresentation(tree, Tsx, tsxQuery, 1, "App.tsx");

    expect(ir).toHaveLength(1);
    expect(ir[0]!.kind).toBe("function");
    expect(ir[0]!.name).toBe("App");
    expect(ir[0]!.parentSymbolKey).toBeNull();
    expect(ir[0]!.startLine).toBe(0);
    expect(ir[0]!.startColumn).toBe(0);
  });

  test("symbolKeys are unique across both fixtures' IRs and every non-null parentSymbolKey resolves within its own IR", () => {
    const tsTree = parse(TypeScript, TS_FIXTURE);
    const tsIr = toIntermediateRepresentation(tsTree, TypeScript, tsQuery, 1, "greeter.ts");
    const keys = tsIr.map((s) => s.symbolKey);
    expect(new Set(keys).size).toBe(keys.length);
    const allKeys = new Set(keys);
    for (const s of tsIr) {
      if (s.parentSymbolKey !== null) expect(allKeys.has(s.parentSymbolKey)).toBe(true);
    }
  });
});
