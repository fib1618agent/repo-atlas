import { Query, type Language, type Node, type Tree } from "web-tree-sitter";
import type { SymbolKind } from "../domain/symbol";
import { computeSymbolKey } from "./symbol-identity";

/**
 * Common Symbol IR (T028, contracts/language-grammar-provider.md "Symbol
 * query patterns", data-model.md "Parent/child resolution (IR → D1)").
 * Pre-persistence shape — distinct from the persisted `Symbol` domain type
 * (T005): no `id`, and `parentSymbolKey` (not `parentSymbolId`) is the
 * parent reference, since no D1 row exists yet for a real FK to point at.
 * T029 resolves `parentSymbolKey` to `symbols.parent_symbol_id` via a
 * two-pass insert/update — not this module's concern.
 */
export type SymbolIR = {
  kind: SymbolKind;
  name: string;
  qualifiedName: string | null;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  /** The `symbolKey` of the nearest matched ancestor in the AST; `null` for a top-level symbol. IR-only — never a persisted D1 column. */
  parentSymbolKey: string | null;
  symbolKey: string;
};

type RawEntry = {
  kind: SymbolKind;
  name: string;
  node: Node;
};

/** `@symbol.<kind>` capture names this feature's `.scm` files use (contracts/language-grammar-provider.md). */
const SYMBOL_KINDS: ReadonlySet<string> = new Set([
  "module",
  "class",
  "interface",
  "function",
  "method",
]);

/**
 * Compiled-`Query` memo, per Worker isolate — same lifetime as
 * `grammar-provider.ts`'s `parserCache`/`languageCache` (module-level, never
 * evicted, re-evaluated fresh on a cold isolate). Keyed by `Language`
 * identity (WeakMap) then query source text, so a different grammar or a
 * different `.scm` body can never reuse another's compiled query. Compiling
 * a query costs ~4-5ms for typescript/tsx, so it must not repeat per file.
 */
const compiledQueryCache = new WeakMap<Language, Map<string, Query>>();

function getCompiledQuery(language: Language, querySource: string): Query {
  let bySource = compiledQueryCache.get(language);
  if (!bySource) {
    bySource = new Map();
    compiledQueryCache.set(language, bySource);
  }
  let query = bySource.get(querySource);
  if (!query) {
    query = new Query(language, querySource);
    bySource.set(querySource, query);
  }
  return query;
}

/**
 * Runs `querySource` (one of the T023–T026 `.scm` files) against `tree`,
 * shared across languages — each `.scm` file emits the same
 * `@symbol.<kind>` + `@symbol.name` capture shape, so one walker suffices.
 */
function collectRawEntries(tree: Tree, language: Language, querySource: string): RawEntry[] {
  const query = getCompiledQuery(language, querySource);
  const matches = query.matches(tree.rootNode);

  const entries: RawEntry[] = [];
  for (const match of matches) {
    let kindCapture: { kind: string; node: Node } | undefined;
    let nameNode: Node | undefined;
    for (const capture of match.captures) {
      if (capture.name === "symbol.name") {
        nameNode = capture.node;
        continue;
      }
      if (!capture.name.startsWith("symbol.")) continue;
      const kind = capture.name.slice("symbol.".length);
      if (SYMBOL_KINDS.has(kind)) kindCapture = { kind, node: capture.node };
    }
    if (kindCapture && nameNode) {
      entries.push({ kind: kindCapture.kind as SymbolKind, name: nameNode.text, node: kindCapture.node });
    }
  }
  return entries;
}

/**
 * Runs a language's `.scm` query against an already-parsed tree and
 * normalizes the captures into the common Symbol IR — parent/child nesting
 * (FR-010) derived from each matched node's real AST ancestor chain (via
 * `Node.parent`, walked up to the nearest node that is *also* a matched
 * symbol), never from the order `query.matches()` happens to return results
 * in. `snapshotId`/`filePath` are required inputs to `computeSymbolKey`
 * (T027) — this module does not read files or know about snapshots beyond
 * threading those two identifiers through.
 */
export function toIntermediateRepresentation(
  tree: Tree,
  language: Language,
  querySource: string,
  snapshotId: number,
  filePath: string,
): SymbolIR[] {
  const rawEntries = collectRawEntries(tree, language, querySource);

  const entryByNodeId = new Map<number, RawEntry>();
  for (const entry of rawEntries) entryByNodeId.set(entry.node.id, entry);

  /** Root-first chain of matched ancestors for `entry` (never includes `entry` itself). */
  function ancestorChain(entry: RawEntry): RawEntry[] {
    const chain: RawEntry[] = [];
    let current = entry.node.parent;
    while (current) {
      const ancestorEntry = entryByNodeId.get(current.id);
      if (ancestorEntry) chain.unshift(ancestorEntry);
      current = current.parent;
    }
    return chain;
  }

  // Pass 1: qualifiedName + symbolKey — depends only on ancestor *names*
  // (plain strings), never on another entry's symbolKey, so every entry can
  // be computed independently, in any order.
  const withKeys = rawEntries.map((entry) => {
    const ancestors = ancestorChain(entry);
    const qualifiedName =
      ancestors.length > 0 ? [...ancestors.map((a) => a.name), entry.name].join(".") : null;
    const startLine = entry.node.startPosition.row;
    const startColumn = entry.node.startPosition.column;
    const endLine = entry.node.endPosition.row;
    const endColumn = entry.node.endPosition.column;
    const symbolKey = computeSymbolKey(
      snapshotId,
      filePath,
      entry.kind,
      qualifiedName ?? entry.name,
      startLine,
      startColumn,
    );
    return { entry, ancestors, qualifiedName, startLine, startColumn, endLine, endColumn, symbolKey };
  });

  const symbolKeyByNodeId = new Map<number, string>();
  for (const w of withKeys) symbolKeyByNodeId.set(w.entry.node.id, w.symbolKey);

  // Pass 2: parentSymbolKey — the nearest ancestor's symbolKey, resolvable
  // now that every entry's own symbolKey (pass 1) is known.
  return withKeys.map((w) => {
    const nearestAncestor = w.ancestors[w.ancestors.length - 1];
    const parentSymbolKey = nearestAncestor
      ? (symbolKeyByNodeId.get(nearestAncestor.node.id) ?? null)
      : null;
    return {
      kind: w.entry.kind,
      name: w.entry.name,
      qualifiedName: w.qualifiedName,
      startLine: w.startLine,
      startColumn: w.startColumn,
      endLine: w.endLine,
      endColumn: w.endColumn,
      parentSymbolKey,
      symbolKey: w.symbolKey,
    };
  });
}
