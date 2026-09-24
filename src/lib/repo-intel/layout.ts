/**
 * Pure, deterministic, bounded level layout (Feature 009 FR-012, NFR-001,
 * NFR-002). No React, DOM, randomness or clock. Children are ordered
 * (directories first, then weight descending, then label, then id), packed on
 * a phyllotaxis spiral, and anything beyond the node budget is aggregated into
 * one overflow node per kind carrying the true hidden count.
 */
import { MAX_VISIBLE_NODES } from "./limits";

export type LevelKind = "directory" | "file";

export interface LevelItem {
  id: string;
  kind: LevelKind;
  label: string;
  /** Size in bytes or a count; only its relative magnitude matters. */
  weight: number;
  /** Optional colour/grouping key (for example a language). */
  group?: string | null;
}

export interface LayoutNode {
  id: string;
  kind: LevelKind;
  label: string;
  group: string | null;
  x: number;
  y: number;
  r: number;
}

export interface OverflowNode {
  kind: LevelKind;
  count: number;
  x: number;
  y: number;
  r: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  overflow: OverflowNode[];
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  maxNodes?: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const KIND_ORDER: Record<LevelKind, number> = { directory: 0, file: 1 };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function orderItems(items: LevelItem[]): LevelItem[] {
  return [...items].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      b.weight - a.weight ||
      a.label.localeCompare(b.label) ||
      a.id.localeCompare(b.id),
  );
}

export function layoutLevel(
  items: LevelItem[],
  options: LayoutOptions = {},
): LayoutResult {
  const width = options.width ?? 800;
  const height = options.height ?? 600;
  const maxNodes = Math.max(2, options.maxNodes ?? MAX_VISIBLE_NODES);

  const ordered = orderItems(items);
  let visible = ordered;
  const hidden: Record<LevelKind, number> = { directory: 0, file: 0 };

  if (ordered.length > maxNodes) {
    // Reserve one slot per kind that will overflow; recompute until stable.
    let keep = maxNodes - 2;
    visible = ordered.slice(0, keep);
    for (const item of ordered.slice(keep)) hidden[item.kind] += 1;
    const overflowKinds =
      (hidden.directory > 0 ? 1 : 0) + (hidden.file > 0 ? 1 : 0);
    if (overflowKinds === 1) {
      keep = maxNodes - 1;
      visible = ordered.slice(0, keep);
      hidden.directory = 0;
      hidden.file = 0;
      for (const item of ordered.slice(keep)) hidden[item.kind] += 1;
    }
  }

  const overflowKindList = (["directory", "file"] as const).filter(
    (k) => hidden[k] > 0,
  );
  const slots = visible.length + overflowKindList.length;
  const cx = width / 2;
  const cy = height / 2;
  const extent = Math.min(width, height) / 2;
  const spacing = slots > 0 ? (extent * 0.92) / Math.sqrt(slots) : extent;
  const rMax = Math.min(28, spacing * 0.45);
  const rMin = Math.max(4, rMax * 0.35);
  // Weights are normalised per kind: directory counts and file byte sizes are
  // different quantities and must not be compared with each other.
  const maxWeight: Record<LevelKind, number> = { directory: 0, file: 0 };
  for (const i of visible) {
    maxWeight[i.kind] = Math.max(maxWeight[i.kind], i.weight);
  }

  const place = (index: number) => {
    const radius = spacing * Math.sqrt(index + 0.5);
    const angle = index * GOLDEN_ANGLE;
    return {
      x: round2(cx + radius * Math.cos(angle)),
      y: round2(cy + radius * Math.sin(angle)),
    };
  };

  const nodes: LayoutNode[] = visible.map((item, index) => {
    const max = maxWeight[item.kind];
    const share =
      max > 0 ? Math.log1p(Math.max(0, item.weight)) / Math.log1p(max) : 0;
    const base = rMin + (rMax - rMin) * share;
    const r = round2(item.kind === "file" ? Math.max(3, base * 0.75) : base);
    return {
      id: item.id,
      kind: item.kind,
      label: item.label,
      group: item.group ?? null,
      r,
      ...place(index),
    };
  });

  const overflow: OverflowNode[] = overflowKindList.map((kind, k) => ({
    kind,
    count: hidden[kind],
    r: round2(rMax),
    ...place(visible.length + k),
  }));

  return { nodes, overflow };
}
