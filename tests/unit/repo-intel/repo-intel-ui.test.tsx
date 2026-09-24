import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CompositionBar } from "../../../src/components/repo-intel/CompositionBar";
import { IntelligenceStatePanel } from "../../../src/components/repo-intel/IntelligenceStatePanel";
import { RelationshipLayerNotice } from "../../../src/components/repo-intel/RelationshipLayerNotice";
import { StructureMap } from "../../../src/components/repo-intel/StructureMap";
import {
  fileStateMessage,
  overviewCopy,
} from "../../../src/lib/repo-intel/copy";
import { buildMapItems } from "../../../src/lib/repo-intel/level-items";
import { MAX_VISIBLE_NODES } from "../../../src/lib/repo-intel/limits";
import { UNAVAILABLE_RELATIONSHIP_STATE } from "../../../src/lib/repo-intel/relationship-layer";
import { validateRepositorySearch } from "../../../src/lib/repo-intel/search";
import {
  buildSymbolTree,
  countNodes,
} from "../../../src/lib/repo-intel/symbol-tree";
import type {
  ExtractionSummary,
  FileSymbol,
  FileSymbols,
  OverviewResult,
  StructureDirectory,
  StructureFile,
} from "../../../src/lib/repo-intel/states";

const extraction = (
  over: Partial<ExtractionSummary> = {},
): ExtractionSummary => ({
  status: "completed",
  extractorVersion: "v2",
  filesTotal: 3,
  filesExtracted: 3,
  filesSkippedUnsupported: 0,
  filesFailed: 0,
  symbolsExtracted: 7,
  ...over,
});

const ready = (over: Partial<ExtractionSummary> = {}): OverviewResult => ({
  status: "ready",
  snapshot: {
    snapshotId: 1,
    commitSha: "abcdef1234567890",
    completedAt: "2026-01-01T00:00:00Z",
  },
  extraction: extraction(over),
  composition: {
    buckets: [
      { key: "typescript", label: "typescript", fileCount: 3, bytes: 3000 },
    ],
    otherFileCount: 0,
    otherBytes: 0,
  },
  totals: { files: 3, bytes: 3000, directories: 2 },
});

const render = (o: OverviewResult | undefined) =>
  renderToStaticMarkup(<IntelligenceStatePanel overview={o} />);

describe("state rendering (FR-011, SC-004)", () => {
  const cases: [string, OverviewResult | undefined][] = [
    ["loading", undefined],
    ["no_binding", { status: "unavailable", reason: "no_binding" }],
    ["query_failed", { status: "unavailable", reason: "query_failed" }],
    ["no_snapshot", { status: "no_snapshot" }],
    [
      "in_progress",
      { status: "snapshot_in_progress", latestAttemptStatus: "in_progress" },
    ],
    ["invalid", { status: "invalid_request" }],
  ];

  test("every non-ready state has distinct, tested copy", () => {
    const titles = cases.map(([, o]) => overviewCopy(o)?.title);
    expect(titles.every(Boolean)).toBe(true);
    expect(new Set(titles).size).toBe(cases.length);
    for (const [, o] of cases) {
      const html = render(o);
      expect(html).toContain(overviewCopy(o)!.title);
      expect(html).toContain("data-intel-state");
    }
  });

  test("ready variants render distinct symbol-state text and never fake numbers", () => {
    const notExtracted = render(
      ready({ status: "not_started", symbolsExtracted: 0 }),
    );
    expect(notExtracted).toContain('data-symbols-state="not_extracted"');
    expect(notExtracted).toContain("—");
    expect(
      render(ready({ status: "completed_partial", filesFailed: 2 })),
    ).toContain('data-symbols-state="partial"');
    expect(render(ready({ symbolsExtracted: 0 }))).toContain(
      'data-symbols-state="empty"',
    );
    const ok = render(ready());
    expect(ok).toContain('data-symbols-state="available"');
    expect(ok).toContain("abcdef1");
    expect(ok).not.toContain("abcdef1234567890");
  });

  test("file symbol messages cover every extraction state", () => {
    const base: FileSymbols = {
      path: "a.ts",
      language: "typescript",
      extractionStatus: "extracted",
      failureKind: null,
      symbolCount: 2,
      symbols: [],
      truncated: false,
    };
    expect(fileStateMessage(base)).toBeNull();
    expect(fileStateMessage({ ...base, symbolCount: 0 })).toContain(
      "no symbols",
    );
    expect(
      fileStateMessage({ ...base, extractionStatus: "not_attempted" }),
    ).toContain("not been extracted");
    expect(
      fileStateMessage({ ...base, extractionStatus: "skipped_unsupported" }),
    ).toContain("not supported");
    expect(
      fileStateMessage({
        ...base,
        extractionStatus: "failed",
        failureKind: "syntax_errors",
      }),
    ).toContain("syntax errors");
    expect(fileStateMessage({ ...base, error: "query_failed" })).toContain(
      "could not be read",
    );
  });
});

describe("relationship boundary rendering (FR-009, SC-002)", () => {
  test("the notice says not connected and never claims there are none", () => {
    const html = renderToStaticMarkup(
      <RelationshipLayerNotice state={UNAVAILABLE_RELATIONSHIP_STATE} />,
    );
    expect(html).toContain("Not yet connected");
    expect(html).toContain("not a statement that none exist");
    expect(html).not.toMatch(/no relationships/i);
  });
});

describe("composition bar (FR-005)", () => {
  test("text values accompany colours; empty snapshots say so", () => {
    const html = renderToStaticMarkup(
      <CompositionBar
        composition={{
          buckets: [
            {
              key: "typescript",
              label: "typescript",
              fileCount: 3,
              bytes: 3000,
            },
          ],
          otherFileCount: 1,
          otherBytes: 10,
        }}
        totalFiles={4}
      />,
    );
    expect(html).toContain("3 files");
    expect(html).toContain("Other");
    expect(html).toContain('role="img"');
    expect(
      renderToStaticMarkup(
        <CompositionBar
          composition={{ buckets: [], otherFileCount: 0, otherBytes: 0 }}
          totalFiles={0}
        />,
      ),
    ).toContain("No files in this snapshot");
  });
});

describe("structure map bounds and semantics (FR-012, FR-014, NFR-002, SC-003)", () => {
  const dirs: StructureDirectory[] = Array.from({ length: 2000 }, (_, i) => ({
    path: `d${i}`,
    name: `d${i}`,
    fileCount: (i % 17) + 1,
    symbolCount: i % 3 === 0 ? null : i % 11,
  }));
  const files: StructureFile[] = Array.from({ length: 3000 }, (_, i) => ({
    path: `f${i}.ts`,
    name: `f${i}.ts`,
    sizeBytes: (i * 37) % 9000,
    language: i % 2 ? "typescript" : null,
    extractionStatus: "extracted",
    symbolCount: i % 5,
  }));
  const items = buildMapItems(dirs, files, { text: "", kind: "all" });
  const html = renderToStaticMarkup(
    <StructureMap
      items={items}
      currentFile={undefined}
      onActivate={() => {}}
      onOverflow={() => {}}
      onUp={() => {}}
      onFocusFilter={() => {}}
    />,
  );

  test("5,000 children render at most MAX_VISIBLE_NODES nodes", () => {
    const nodes = html.match(/data-node-id=/g)?.length ?? 0;
    expect(nodes).toBeGreaterThan(0);
    expect(nodes).toBeLessThanOrEqual(MAX_VISIBLE_NODES);
    expect(html).toContain('data-node-kind="overflow"');
  });

  test("every node is a labelled button and exactly one is tabbable", () => {
    const groups = html.match(/<g [^>]*data-node-id=[^>]*>/g) ?? [];
    for (const g of groups) {
      expect(g).toContain('role="button"');
      expect(g).toContain("aria-label=");
    }
    expect(groups.filter((g) => g.includes('tabindex="0"')).length).toBe(1);
    expect(html).toContain("Use arrow keys to move");
  });

  test("no edge elements are drawn (no relationship or ownership threads)", () => {
    const mapSvg = html.slice(html.indexOf('viewBox="0 0 800 600"'));
    expect(mapSvg.length).toBeGreaterThan(100);
    expect(mapSvg).not.toMatch(/<line\b|<polyline\b|<path\b|<polygon\b/);
  });

  test("filter narrows items by name and kind", () => {
    expect(
      buildMapItems(dirs, files, { text: "d19", kind: "directory" }).every(
        (i) => i.kind === "directory" && i.label.includes("d19"),
      ),
    ).toBe(true);
    expect(
      buildMapItems(dirs, files, { text: "", kind: "file" }).every(
        (i) => i.kind === "file",
      ),
    ).toBe(true);
  });
});

describe("symbol hierarchy (FR-007, FR-008)", () => {
  const sym = (id: number, parent: number | null): FileSymbol => ({
    id,
    kind: "function",
    name: `s${id}`,
    qualifiedName: null,
    startLine: id,
    startColumn: 0,
    endLine: id,
    endColumn: 1,
    parentSymbolId: parent,
  });

  test("nests only by stored parent ids; orphans and cycles become roots", () => {
    const tree = buildSymbolTree([
      sym(1, null),
      sym(2, 1),
      sym(3, 2),
      sym(4, 99),
      sym(5, 5),
    ]);
    expect(tree.map((n) => n.symbol.id)).toEqual([1, 4, 5]);
    expect(tree[0]!.children[0]!.children[0]!.symbol.id).toBe(3);
    expect(countNodes(tree)).toBe(5);
  });
});

describe("route search validation and navigation state (FR-001, FR-016)", () => {
  test("valid values round-trip; unsafe or invalid values are dropped", () => {
    expect(
      validateRepositorySearch({
        path: "src/lib",
        file: "src/lib/a.ts",
        symbol: "7",
      }),
    ).toEqual({
      path: "src/lib",
      file: "src/lib/a.ts",
      symbol: 7,
    });
    expect(
      validateRepositorySearch({ path: "../x", file: "a/../b", symbol: "abc" }),
    ).toEqual({
      path: undefined,
      file: undefined,
      symbol: undefined,
    });
    expect(validateRepositorySearch({ path: "/src/", symbol: 3 })).toEqual({
      path: "src",
      file: undefined,
      symbol: undefined,
    });
    expect(validateRepositorySearch({})).toEqual({
      path: undefined,
      file: undefined,
      symbol: undefined,
    });
  });
});
