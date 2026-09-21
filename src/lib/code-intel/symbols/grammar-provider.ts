import { Language, Parser } from "web-tree-sitter";
import coreWasmModule from "web-tree-sitter/tree-sitter.wasm?module";
import javaWasmModule from "../../../../public/wasm/tree-sitter-java.wasm?module";
import javascriptWasmModule from "../../../../public/wasm/tree-sitter-javascript.wasm?module";
import typescriptWasmModule from "../../../../public/wasm/tree-sitter-typescript.wasm?module";
import tsxWasmModule from "../../../../public/wasm/tree-sitter-tsx.wasm?module";
import type { SupportedLanguage } from "./language-detector";

/**
 * WASM tree-sitter execution (research.md §1, §6 risk 4; contracts/language-grammar-provider.md;
 * plan.md's "Architecture Remediation (2026-09-21)" — Phase 9, T066).
 *
 * Both WASM artifacts this module loads (core runtime + the four Tier-1
 * grammars) are now sourced the same way: a genuine build-time `?module` ESM
 * import (Nitro's unwasm-based WASM handling, confirmed in research.md §1),
 * yielding an already-compiled `WebAssembly.Module`. This replaces T022's
 * original runtime `ASSETS.fetch()` grammar-byte path, which research.md §6
 * risk 4 (T064 live validation) found fails on a real deployed Cloudflare
 * Worker with "Wasm code generation disallowed by embedder" — Workers
 * disallows compiling a `WebAssembly.Module` from bytes obtained at runtime;
 * only a build-time-imported module (precompiled ahead of the sandbox's
 * runtime restrictions) may be instantiated.
 *
 * `web-tree-sitter@0.25.10`'s public `Language.load()` only accepts
 * `Uint8Array | string` (no `loadSync(WebAssembly.Module)` at this pinned
 * version — research.md §6 risk 1) and internally still performs its own
 * disallowed bytes-form `WebAssembly.instantiate(bytes, imports)` call. This
 * module works around that without ever compiling WASM from runtime bytes,
 * using the mechanism proven in research.md §6 risk 4's local experiment:
 *
 *  1. `Language.load()` still needs *some* `Uint8Array` to walk, because its
 *     internal `getDylinkMetadata()` parses the grammar's Emscripten
 *     "dylink"/"dylink.0" custom section (library memory/table sizing,
 *     needed-dynlib names) directly from raw bytes before any WASM
 *     compilation happens — this is a plain byte-header parse, not WASM code
 *     generation, so it never hits the Workers restriction. Rather than
 *     embedding each full multi-MB grammar file a second time as bytes, this
 *     module derives a small *synthetic* WASM byte buffer at runtime,
 *     containing only a minimal module header plus the real dylink section's
 *     payload — extracted from the build-time-compiled `WebAssembly.Module`
 *     itself via the standard `WebAssembly.Module.customSections()` API
 *     (also not a compile operation). This synthetic buffer is large enough
 *     for `getDylinkMetadata()` to parse correctly, but is never actually
 *     compiled as WASM.
 *  2. The one call inside `Language.load()`'s internals that *would* compile
 *     WASM from those bytes — `WebAssembly.instantiate(bytes, imports)` — is
 *     intercepted by scoping a monkeypatch of the global `WebAssembly.instantiate`
 *     for the duration of exactly one `Language.load()` call, substituting
 *     `WebAssembly.instantiate(precompiledModule, imports)` (the module-form
 *     call, which only links an already-compiled module — the same operation
 *     the core runtime's `instantiateWasm` below already performs
 *     successfully in production, and which Workers permits).
 *
 * No `web-tree-sitter`/`tree-sitter-wasms` version change (both stay pinned
 * exactly as research.md §6 risk 1 approved). No ASSETS binding, no runtime
 * fetch, no new Cloudflare binding — `grammar-provider.ts`'s only external
 * dependency is the four `?module` imports below, resolved entirely at build
 * time.
 */

export type TreeSitterParserHandle = Parser;

export interface GrammarProvider {
  getParser(language: SupportedLanguage): Promise<TreeSitterParserHandle>;
}

const PRODUCTION_GRAMMAR_MODULES: Record<SupportedLanguage, WebAssembly.Module> = {
  java: javaWasmModule,
  javascript: javascriptWasmModule,
  typescript: typescriptWasmModule,
  tsx: tsxWasmModule,
};

/**
 * Test-only override for the four grammar `WebAssembly.Module`s. Production
 * always uses the `?module`-imported modules above — but (mirroring
 * `setTestCoreWasmModule`'s existing rationale) Bun's own native `.wasm`
 * import resolver does not understand the `?module` query suffix the way
 * Nitro's unwasm-based ESM WASM handling does (it returns a bare file-path
 * string, not a compiled `Module`), so `bun test` must supply its own
 * `WebAssembly.compile`d modules here. Every downstream mechanism (dylink
 * extraction, synthetic-bytes construction, the scoped `instantiate`
 * substitution) is identical in both cases; only where the `Module` comes
 * from differs.
 */
let grammarModuleOverride: Partial<Record<SupportedLanguage, WebAssembly.Module>> | undefined;

export function setTestGrammarModules(
  modules: Partial<Record<SupportedLanguage, WebAssembly.Module>> | undefined,
): void {
  grammarModuleOverride = modules;
}

function resolveGrammarModule(language: SupportedLanguage): WebAssembly.Module {
  return grammarModuleOverride?.[language] ?? PRODUCTION_GRAMMAR_MODULES[language];
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

/** Minimal unsigned-LEB128 encoder (WASM binary format's own varuint encoding). */
function encodeUnsignedLEB128(valueIn: number): Uint8Array {
  let value = valueIn >>> 0;
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return new Uint8Array(bytes);
}

/**
 * Builds a minimal, synthetic WASM byte buffer containing only a module
 * header plus the real dylink/dylink.0 custom section extracted from the
 * already-compiled grammar `Module` — enough for `Language.load()`'s
 * internal `getDylinkMetadata()` byte-walk to parse correctly, without ever
 * embedding (or compiling) the full multi-MB grammar file a second time.
 * `WebAssembly.Module.customSections()` is a standard, compile-free WASM JS
 * API — extracting a custom section's payload from an already-compiled
 * Module never triggers WASM code generation.
 */
function buildSyntheticDylinkBytes(module: WebAssembly.Module): Uint8Array {
  let sectionName = "dylink.0";
  let sections = WebAssembly.Module.customSections(module, sectionName);
  if (sections.length === 0) {
    sectionName = "dylink";
    sections = WebAssembly.Module.customSections(module, sectionName);
  }
  if (sections.length === 0) {
    throw new Error(
      "grammar-provider: grammar module has no dylink/dylink.0 custom section — cannot derive link metadata",
    );
  }

  const payload = new Uint8Array(sections[0]!);
  const nameBytes = new TextEncoder().encode(sectionName);
  const nameLenBytes = encodeUnsignedLEB128(nameBytes.length);
  const sectionContentLength = nameLenBytes.length + nameBytes.length + payload.length;
  const sectionSizeBytes = encodeUnsignedLEB128(sectionContentLength);

  // WASM magic ("\0asm") + version 1 + a single custom-section id byte (0x00).
  const header = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x00]);

  const totalLength =
    header.length + sectionSizeBytes.length + nameLenBytes.length + nameBytes.length + payload.length;
  // getDylinkMetadata's magic-number check reads the first 24 bytes as a
  // Uint32Array view, which requires a length that's a multiple of 4 —
  // padding (never read past the real section's computed `end`) keeps that
  // check safe even for a very small dylink payload.
  const out = new Uint8Array(Math.max(totalLength, 24));
  let offset = 0;
  out.set(header, offset);
  offset += header.length;
  out.set(sectionSizeBytes, offset);
  offset += sectionSizeBytes.length;
  out.set(nameLenBytes, offset);
  offset += nameLenBytes.length;
  out.set(nameBytes, offset);
  offset += nameBytes.length;
  out.set(payload, offset);
  return out;
}

/**
 * Scopes a substitution of the global `WebAssembly.instantiate` for the
 * duration of `fn`, redirecting the disallowed bytes-form compile call
 * (`WebAssembly.instantiate(bytes, imports)`) to the module-form call
 * (`WebAssembly.instantiate(precompiledModule, imports)`) instead — the same
 * class of operation the core runtime's `instantiateWasm` below already
 * performs successfully in production. Always restores the original
 * `WebAssembly.instantiate`, success or failure.
 */
async function withPrecompiledInstantiate<T>(
  module: WebAssembly.Module,
  fn: () => Promise<T>,
): Promise<T> {
  const original = WebAssembly.instantiate;
  (WebAssembly as { instantiate: unknown }).instantiate = async (
    _source: unknown,
    imports?: WebAssembly.Imports,
  ) => {
    const instance = await original(module, imports ?? {});
    return { module, instance };
  };
  try {
    return await fn();
  } finally {
    (WebAssembly as { instantiate: unknown }).instantiate = original;
  }
}

// Module-level state — memoized per Worker isolate, re-evaluated fresh on a cold isolate.
let initPromise: Promise<void> | undefined;
const languageCache = new Map<SupportedLanguage, Language>();
const parserCache = new Map<SupportedLanguage, Parser>();

/**
 * Fix for a real, live-validated defect (T064, 2026-09-21): `web-tree-sitter`'s
 * vendored Emscripten glue detects `ENVIRONMENT_IS_WORKER =
 * typeof WorkerGlobalScope != "undefined"` (true in Cloudflare Workers) and,
 * inside `Parser.init()`'s deferred module factory, unconditionally reads
 * `self.location.href` before ever consulting our `instantiateWasm` option —
 * Cloudflare Workers implements `WorkerGlobalScope`-style globals but not
 * `self.location` (there is no "page"), so every real parse attempt crashed
 * in production with "Cannot read properties of undefined (reading 'href')",
 * confirmed via live D1 queries against two independently deployed snapshots.
 * Still required after the T066 remediation — this fix is orthogonal to how
 * grammar bytes/modules are sourced, only backfilling a missing environment
 * global the vendored dependency's own code assumes exists.
 */
function ensureWorkerLocationPolyfill(): void {
  if (typeof self !== "undefined" && !("location" in self)) {
    Object.defineProperty(self, "location", {
      value: { href: "https://workers.internal/" },
      configurable: true,
    });
  }
}

function ensureCoreInitialized(): Promise<void> {
  if (!initPromise) {
    ensureWorkerLocationPolyfill();
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

async function loadGrammarLanguage(language: SupportedLanguage): Promise<Language> {
  const module = resolveGrammarModule(language);
  const syntheticBytes = buildSyntheticDylinkBytes(module);
  return withPrecompiledInstantiate(module, () => Language.load(syntheticBytes));
}

/** Contract implementation (contracts/language-grammar-provider.md). */
export async function getParser(language: SupportedLanguage): Promise<TreeSitterParserHandle> {
  if (!(language in PRODUCTION_GRAMMAR_MODULES)) {
    throw new Error(
      `grammar-provider: unsupported language "${language}" (Tier 1 only: java, javascript, typescript, tsx)`,
    );
  }

  const cachedParser = parserCache.get(language);
  if (cachedParser) return cachedParser;

  await ensureCoreInitialized();

  let language_ = languageCache.get(language);
  if (!language_) {
    language_ = await loadGrammarLanguage(language);
    languageCache.set(language, language_);
  }

  const parser = new Parser();
  parser.setLanguage(language_);
  parserCache.set(language, parser);
  return parser;
}

export const grammarProvider: GrammarProvider = { getParser };
