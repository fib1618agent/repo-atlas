import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  bucketKeyFor,
  topBuckets,
} from "../../../src/lib/repo-intel/composition";
import {
  layoutLevel,
  type LevelItem,
} from "../../../src/lib/repo-intel/layout";
import {
  MAX_COMPOSITION_BUCKETS,
  MAX_VISIBLE_NODES,
} from "../../../src/lib/repo-intel/limits";

const items = (n: number): LevelItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    kind: i % 5 === 0 ? ("directory" as const) : ("file" as const),
    label: `name-${(i * 7919) % 1000}`,
    weight: (i * 104729) % 100000,
    group: i % 3 === 0 ? "TypeScript" : null,
  }));

describe("layoutLevel determinism and bounds (NFR-001, NFR-002, SC-003)", () => {
  test("same input, same output; input order does not matter", () => {
    const a = layoutLevel(items(40));
    const b = layoutLevel([...items(40)].reverse());
    expect(a).toEqual(b);
    expect(layoutLevel(items(40))).toEqual(a);
  });

  test("small levels are not aggregated", () => {
    const r = layoutLevel(items(10));
    expect(r.nodes).toHaveLength(10);
    expect(r.overflow).toHaveLength(0);
  });

  test("5,000 children stay within the node budget and overflow counts are exact", () => {
    const all = items(5000);
    const r = layoutLevel(all);
    expect(r.nodes.length + r.overflow.length).toBeLessThanOrEqual(
      MAX_VISIBLE_NODES,
    );
    const hidden = r.overflow.reduce((n, o) => n + o.count, 0);
    expect(r.nodes.length + hidden).toBe(5000);
    for (const kind of ["directory", "file"] as const) {
      const shown = r.nodes.filter((n) => n.kind === kind).length;
      const total = all.filter((i) => i.kind === kind).length;
      const over = r.overflow.find((o) => o.kind === kind)?.count ?? 0;
      expect(shown + over).toBe(total);
    }
  });

  test("single-kind overflow uses one overflow node", () => {
    const only = Array.from({ length: 200 }, (_, i) => ({
      id: `f${i}`,
      kind: "file" as const,
      label: `f${i}`,
      weight: i,
    }));
    const r = layoutLevel(only);
    expect(r.overflow).toHaveLength(1);
    expect(r.nodes.length + r.overflow[0]!.count).toBe(200);
    expect(r.nodes.length + r.overflow.length).toBeLessThanOrEqual(
      MAX_VISIBLE_NODES,
    );
  });

  test("all shapes fit inside the viewport", () => {
    const r = layoutLevel(items(200), { width: 800, height: 600 });
    for (const n of [...r.nodes, ...r.overflow]) {
      expect(n.x - n.r).toBeGreaterThanOrEqual(0);
      expect(n.x + n.r).toBeLessThanOrEqual(800);
      expect(n.y - n.r).toBeGreaterThanOrEqual(0);
      expect(n.y + n.r).toBeLessThanOrEqual(600);
    }
  });

  test("empty input yields an empty layout", () => {
    expect(layoutLevel([])).toEqual({ nodes: [], overflow: [] });
  });

  test("layout module is free of randomness and clocks", () => {
    const src = readFileSync(
      new URL("../../../src/lib/repo-intel/layout.ts", import.meta.url),
      "utf8",
    );
    expect(src).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now/);
  });
});

describe("composition (FR-005)", () => {
  test("bucketKeyFor prefers language then extension", () => {
    expect(bucketKeyFor("TypeScript", "a/b.ts")).toBe("TypeScript");
    expect(bucketKeyFor(null, "docs/README.MD")).toBe(".md");
    expect(bucketKeyFor(null, "Makefile")).toBe("(no extension)");
    expect(bucketKeyFor(null, "dir/.gitignore")).toBe(".gitignore");
  });

  test("topBuckets keeps at most N, preserves totals and is stable on ties", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      key: `k${i}`,
      label: `k${i}`,
      fileCount: i + 1,
      bytes: 100,
    }));
    const c = topBuckets(rows);
    expect(c.buckets).toHaveLength(MAX_COMPOSITION_BUCKETS);
    const filesIn =
      c.buckets.reduce((n, b) => n + b.fileCount, 0) + c.otherFileCount;
    expect(filesIn).toBe(rows.reduce((n, r) => n + r.fileCount, 0));
    expect(c.otherBytes).toBe(400);
    expect(topBuckets(rows)).toEqual(topBuckets([...rows].reverse()));
  });
});
