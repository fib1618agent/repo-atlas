# Contract: language detection + grammar provider (internal, no HTTP surface)

`src/lib/code-intel/symbols/language-detector.ts` + `src/lib/code-intel/symbols/grammar-provider.ts`. Internal modules consumed only by the extraction pipeline (`symbols/extraction-pipeline.ts`) and the queue worker — not exposed as a `createServerFn`, same non-RPC status as Feature 001's `providers/content-provider.ts` interface.

## `detectLanguage`

```ts
export type SupportedLanguage = "java" | "javascript" | "typescript" | "tsx";

export function detectLanguage(path: string): SupportedLanguage | null;
```

Deterministic, extension-based (research.md §4) — no content sniffing. Returns `null` for any extension not in the Tier 1 set (FR-002, FR-003); `null` is the "unsupported language" signal the pipeline maps to `file_extractions.status = 'skipped_unsupported'`.

| Extension(s) | Result |
|---|---|
| `.java` | `"java"` |
| `.js`, `.jsx`, `.mjs`, `.cjs` | `"javascript"` |
| `.ts`, `.mts`, `.cts` | `"typescript"` |
| `.tsx` | `"tsx"` |
| anything else | `null` |

## `GrammarProvider`

```ts
export interface GrammarProvider {
  /** Lazily initializes web-tree-sitter and loads (memoized per Worker isolate) the grammar for `language`. */
  getParser(language: SupportedLanguage): Promise<TreeSitterParserHandle>;
}
```

- **Given** `getParser` is called for a language whose grammar `.wasm` has already been loaded in this Worker isolate, **When** called again, **Then** the memoized parser instance is reused — a pure performance optimization, never a correctness assumption (a fresh isolate with no memoized state MUST behave identically, just slower on its first call per language).
- **Given** `getParser` is called for a language outside the Tier 1 set, **When** called, **Then** it throws (this path is unreachable in practice, since `detectLanguage` already filters to Tier 1 before any `getParser` call — a defensive assertion, not a new error surface the extraction pipeline's callers need to handle).

**Feasibility note** (see `research.md` §6, risk 1): the exact WASM-instantiation call this contract's implementation makes — whether `web-tree-sitter`'s `Parser.init({ instantiateWasm })` or an equivalent current-version API — is an implementation-phase detail that must be verified against the actually-installed package version before being written; this contract fixes the *shape* callers depend on (`getParser(language) → parser handle`), not the internal instantiation call.

## Symbol query patterns

`src/lib/code-intel/symbols/queries/{java,javascript,typescript,tsx}.scm` — one tree-sitter query file per language, each defining capture names for the five symbol kinds this feature extracts (`@symbol.module`, `@symbol.class`, `@symbol.interface`, `@symbol.function`, `@symbol.method`, plus `@symbol.name` sub-captures for each declaration's identifier). A single shared `runQuery(parser, queryPath, sourceText) → RawCapture[]` walks any language's query results into the same shape, which `symbols/to-intermediate-representation.ts` then normalizes into the common `Symbol` shape (`sdd/03-ast-symbols/PHASE.md` requirement 5) — parent/child nesting (FR-010) is derived from each captured node's ancestor chain in the AST, not from the query captures' emission order, and is represented in the IR as `parentSymbolKey: string | null` (the ancestor's `symbol_key`, IR-only, never a persisted column) — see data-model.md's "Parent/child resolution (IR → D1)" for how this is resolved to the persisted `symbols.parent_symbol_id` D1 row FK.
