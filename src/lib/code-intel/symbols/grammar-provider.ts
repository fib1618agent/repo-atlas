import { Language, Parser } from "web-tree-sitter";
import coreWasmModule from "web-tree-sitter/tree-sitter.wasm?module";
import type { SupportedLanguage } from "./language-detector";

/**
 * WASM tree-sitter execution (research.md §1, §6 risk 1; contracts/language-grammar-provider.md).
 * Two distinct byte-sourcing paths for the two distinct WASM artifacts this
 * module loads, both Workers-compatible (no fs, no external fetch):
 *  - core runtime: Nitro's `?module` ESM import yields a compiled
 *    `WebAssembly.Module` directly, fed to `Parser.init({ instantiateWasm })`.
 *  - grammars: `Language.load()` on the pinned web-tree-sitter@0.25.10 needs
 *    raw bytes, not a Module (no `loadSync(WebAssembly.Module)` at this
 *    version) — sourced via Cloudflare's ASSETS binding (public/wasm/*.wasm),
 *    the only bytes-yielding mechanism already available without new
 *    infrastructure, read from `globalThis.__env__` — the same per-request
 *    binding stash Nitro's cloudflare-module preset populates and
 *    persistence/cloudflare-env.ts already reads DB/SNAPSHOTS/SNAPSHOT_QUEUE
 *    from (contract is single-argument `getParser(language)`, so this reads
 *    the binding itself rather than taking it as a parameter).
 */

export type TreeSitterParserHandle = Parser;

export interface GrammarProvider {
  getParser(language: SupportedLanguage): Promise<TreeSitterParserHandle>;
}

/** Minimal shape of the Cloudflare Workers ASSETS binding this module needs. */
export interface AssetsBindingLike {
  fetch(request: Request): Promise<Response>;
}

const GRAMMAR_ASSET_PATH: Record<SupportedLanguage, string> = {
  java: "/wasm/tree-sitter-java.wasm",
  javascript: "/wasm/tree-sitter-javascript.wasm",
  typescript: "/wasm/tree-sitter-typescript.wasm",
  tsx: "/wasm/tree-sitter-tsx.wasm",
};

function getAssetsBinding(): AssetsBindingLike | undefined {
  return (globalThis as { __env__?: { ASSETS?: AssetsBindingLike } }).__env__?.ASSETS;
}

async function fetchGrammarBytes(
  assets: AssetsBindingLike,
  language: SupportedLanguage,
): Promise<Uint8Array> {
  const response = await assets.fetch(
    new Request(`https://assets.internal${GRAMMAR_ASSET_PATH[language]}`),
  );
  if (!response.ok) {
    throw new Error(
      `grammar-provider: failed to fetch grammar asset for "${language}" (status ${response.status})`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Injectable byte source, so this module's grammar-loading logic (the part
 * that actually matters for correctness — Parser.init/setLanguage behavior)
 * is exercised with real bytes in tests, without requiring a live Workers
 * runtime. Production always resolves the ASSETS-backed source via
 * `globalThis.__env__`; this override exists only for `bun test`, where that
 * global is never populated (mirrors setTestCloudflareEnv).
 */
export type GrammarBytesSource = (language: SupportedLanguage) => Promise<Uint8Array>;

let bytesSourceOverride: GrammarBytesSource | undefined;

export function setTestGrammarBytesSource(source: GrammarBytesSource | undefined): void {
  bytesSourceOverride = source;
}

function resolveBytesSource(): GrammarBytesSource {
  if (bytesSourceOverride) return bytesSourceOverride;
  const assets = getAssetsBinding();
  if (!assets) {
    throw new Error(
      "grammar-provider: ASSETS binding (env.ASSETS) unavailable — getParser requires running under a deployed Worker or `wrangler dev` (not plain `bun test`; use setTestGrammarBytesSource there).",
    );
  }
  return (language) => fetchGrammarBytes(assets, language);
}

/**
 * Test-only override for the core runtime `WebAssembly.Module`. Production
 * always uses the `?module`-imported `coreWasmModule` above (Nitro's
 * unwasm-based ESM WASM handling, confirmed in research.md §1) — but Bun's
 * own native `.wasm` import resolver does not understand that query-suffixed
 * specifier the same way (it returns a bare file-path string, not a compiled
 * Module, confirmed by direct inspection), so `bun test` must supply its own
 * `WebAssembly.compile`d module here. The `instantiateWasm` wiring itself
 * (the part that actually matters — zero fetch/fs in the Worker path) is
 * identical in both cases; only where the Module comes from differs.
 */
let coreModuleOverride: WebAssembly.Module | undefined;

export function setTestCoreWasmModule(module: WebAssembly.Module | undefined): void {
  coreModuleOverride = module;
}

// Module-level state — memoized per Worker isolate, re-evaluated fresh on a cold isolate.
let initPromise: Promise<void> | undefined;
const languageCache = new Map<SupportedLanguage, Language>();
const parserCache = new Map<SupportedLanguage, Parser>();

function ensureCoreInitialized(): Promise<void> {
  if (!initPromise) {
    const module = coreModuleOverride ?? coreWasmModule;
    initPromise = Parser.init({
      instantiateWasm(
        imports: WebAssembly.Imports,
        successCallback: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
      ) {
        WebAssembly.instantiate(module, imports).then((instance) => {
          successCallback(instance, module);
        });
        return {};
      },
    } as Parameters<typeof Parser.init>[0]);
  }
  return initPromise;
}

/** Contract implementation (contracts/language-grammar-provider.md). */
export async function getParser(language: SupportedLanguage): Promise<TreeSitterParserHandle> {
  if (!(language in GRAMMAR_ASSET_PATH)) {
    throw new Error(
      `grammar-provider: unsupported language "${language}" (Tier 1 only: java, javascript, typescript, tsx)`,
    );
  }

  const cachedParser = parserCache.get(language);
  if (cachedParser) return cachedParser;

  await ensureCoreInitialized();

  let language_ = languageCache.get(language);
  if (!language_) {
    const bytesSource = resolveBytesSource();
    const bytes = await bytesSource(language);
    language_ = await Language.load(bytes);
    languageCache.set(language, language_);
  }

  const parser = new Parser();
  parser.setLanguage(language_);
  parserCache.set(language, parser);
  return parser;
}

export const grammarProvider: GrammarProvider = { getParser };
