import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  setTestCoreWasmModule,
  setTestGrammarModules,
} from "../../src/lib/code-intel/symbols/grammar-provider";
import type { SupportedLanguage } from "../../src/lib/code-intel/symbols/language-detector";

/**
 * Shared `bun test` bootstrap for grammar-provider's WASM modules (T066
 * remediation). Bun's own native `.wasm?module` resolver does not behave
 * like Nitro's unwasm-based ESM WASM handling (it returns a bare file-path
 * string, not a compiled `WebAssembly.Module`), so every suite exercising
 * `getParser` must supply real, locally `WebAssembly.compile`d modules via
 * `setTestCoreWasmModule`/`setTestGrammarModules` — this was previously
 * duplicated per-file; centralized here after T066's rewrite.
 */
export async function installTestWasmModules(): Promise<void> {
  const REPO_ROOT = resolve(import.meta.dir, "../..");

  const coreModule = await WebAssembly.compile(
    readFileSync(resolve(REPO_ROOT, "node_modules/web-tree-sitter/tree-sitter.wasm")),
  );
  setTestCoreWasmModule(coreModule);

  const GRAMMAR_ASSET_FILE: Record<SupportedLanguage, string> = {
    java: "tree-sitter-java.wasm",
    javascript: "tree-sitter-javascript.wasm",
    typescript: "tree-sitter-typescript.wasm",
    tsx: "tree-sitter-tsx.wasm",
  };
  const grammarModules = {} as Record<SupportedLanguage, WebAssembly.Module>;
  for (const [language, fileName] of Object.entries(GRAMMAR_ASSET_FILE) as [
    SupportedLanguage,
    string,
  ][]) {
    grammarModules[language] = await WebAssembly.compile(
      readFileSync(resolve(REPO_ROOT, "public/wasm", fileName)),
    );
  }
  setTestGrammarModules(grammarModules);
}
