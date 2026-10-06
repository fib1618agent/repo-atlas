import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getParser,
  setTestCoreWasmModule,
  setTestGrammarModules,
} from "../../../src/lib/code-intel/symbols/grammar-provider";
import type { SupportedLanguage } from "../../../src/lib/code-intel/symbols/language-detector";

/** T007 harness: supplies locally compiled WASM modules to the unmodified production grammar provider (same mechanism as tests/support/wasm-test-modules.ts). PROTOTYPE HARNESS. */
const REPO_ROOT = resolve(import.meta.dir, "../../..");
const GRAMMAR_FILE: Record<SupportedLanguage, string> = {
  java: "tree-sitter-java.wasm",
  javascript: "tree-sitter-javascript.wasm",
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
};

export async function installWasm(): Promise<{
  coreMs: number;
  grammarMs: Record<string, number>;
}> {
  let t = performance.now();
  const core = await WebAssembly.compile(
    readFileSync(
      resolve(REPO_ROOT, "node_modules/web-tree-sitter/tree-sitter.wasm"),
    ),
  );
  setTestCoreWasmModule(core);
  const coreMs = performance.now() - t;
  const modules = {} as Record<SupportedLanguage, WebAssembly.Module>;
  const grammarMs: Record<string, number> = {};
  for (const [lang, file] of Object.entries(GRAMMAR_FILE) as [
    SupportedLanguage,
    string,
  ][]) {
    t = performance.now();
    modules[lang] = await WebAssembly.compile(
      readFileSync(resolve(REPO_ROOT, "public/wasm", file)),
    );
    grammarMs[lang] = performance.now() - t;
  }
  setTestGrammarModules(modules);
  return { coreMs, grammarMs };
}

export { getParser };
