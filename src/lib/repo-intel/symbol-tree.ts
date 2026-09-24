/**
 * Pure symbol hierarchy for one file (Feature 009 FR-007, FR-008): nests
 * symbols under their stored `parent_symbol_id` only. A symbol whose parent is
 * not in the fetched list (for example beyond the fetch cap) becomes a root;
 * nothing is inferred beyond what Feature 002 stored.
 */
import type { FileSymbol } from "./states";

export interface SymbolTreeNode {
  symbol: FileSymbol;
  children: SymbolTreeNode[];
}

export function buildSymbolTree(symbols: FileSymbol[]): SymbolTreeNode[] {
  const nodes = new Map<number, SymbolTreeNode>();
  for (const symbol of symbols) nodes.set(symbol.id, { symbol, children: [] });
  const roots: SymbolTreeNode[] = [];
  for (const symbol of symbols) {
    const node = nodes.get(symbol.id)!;
    const parent =
      symbol.parentSymbolId !== null && symbol.parentSymbolId !== symbol.id
        ? nodes.get(symbol.parentSymbolId)
        : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Number of nodes in a forest (used to bound rendering). */
export function countNodes(nodes: SymbolTreeNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0);
}
