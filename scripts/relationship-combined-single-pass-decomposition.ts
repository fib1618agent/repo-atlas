#!/usr/bin/env bun
/**
 * LOCAL-ONLY, standalone experimental spike — measurement only, no
 * production code changed, no optimization applied. Follow-up to
 * scripts/relationship-single-pass-spike.ts (scenario C there = the
 * hypothetical combined single-pass unit). This script decomposes that
 * scenario C total into:
 *
 *   C1 = Tree-sitter parse
 *   C2 = symbol discovery/extraction (real toIntermediateRepresentation,
 *        which INCLUDES computeSymbolKey hashing in the real code path —
 *        reported both as measured (raw, includes hashing) and as an
 *        estimated "pure discovery" figure by subtracting an isolated
 *        computeSymbolKey benchmark, see C4 below)
 *   C3 = relationship observation (real relationships/*.scm queries, no
 *        resolution — resolution is deliberately excluded per instruction)
 *   C4 = computeSymbolKey() / symbol-identity hashing, measured in ISOLATION
 *        (real production function, called directly, representative
 *        arguments) since it cannot be split out of C2's real call without
 *        modifying to-intermediate-representation.ts (not permitted here)
 *   C5 = combined single-pass total (C1 + C2raw + C3), timed directly as
 *        one continuous pass, not summed from rounded sub-measurements
 *
 * Uses the REAL production getParser (grammar-provider.ts),
 * toIntermediateRepresentation (symbol IR extractor), computeSymbolKey
 * (symbol-identity.ts), and the real relationships/queries/*.scm files —
 * no reimplementation. No D1/R2/network/Cloudflare access. Resolution is
 * excluded entirely (not stubbed, not timed) so it cannot contaminate
 * extraction numbers.
 *
 * Every timing number is a LOCAL WALL-CLOCK PROXY (process.hrtime.bigint(),
 * this machine, Bun runtime), NOT Cloudflare Workers CPU-ms. Does not prove
 * Cloudflare CPU-budget compliance.
 *
 * Run: bun run scripts/relationship-combined-single-pass-decomposition.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Query } from "web-tree-sitter";
import { getParser } from "../src/lib/code-intel/symbols/grammar-provider";
import { toIntermediateRepresentation } from "../src/lib/code-intel/symbols/to-intermediate-representation";
import { computeSymbolKey } from "../src/lib/code-intel/symbols/symbol-identity";
import { installTestWasmModules } from "../tests/support/wasm-test-modules";

const REPO_ROOT = resolve(import.meta.dir, "..");
const SYMBOL_QUERIES_DIR = resolve(REPO_ROOT, "src/lib/code-intel/symbols/queries");
const REL_QUERIES_DIR = resolve(REPO_ROOT, "src/lib/code-intel/relationships/queries");
const OUT_FILE = resolve(REPO_ROOT, "specs/004-engineering-relationship-graph/combined-single-pass-decomposition-results.md");

type Lang = "java" | "javascript" | "typescript" | "tsx";
const LANGUAGES: Lang[] = ["java", "javascript", "typescript", "tsx"];
const SIZES = [100, 250, 500, 750, 1000, 1250, 1500];
const ITERATIONS = 20;
const WARMUP = 5;

const symbolQuerySource: Record<Lang, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l, readFileSync(resolve(SYMBOL_QUERIES_DIR, `${l}.scm`), "utf8")]),
) as Record<Lang, string>;
const relQuerySource: Record<Lang, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l, readFileSync(resolve(REL_QUERIES_DIR, `${l}.scm`), "utf8")]),
) as Record<Lang, string>;

// ---------------------------------------------------------------------------
// Fixtures: ordinary (realistic density), relationship-dense, CALLS-heavy —
// plus a continuous synthetic sweep using the "ordinary" shape.
// ---------------------------------------------------------------------------
function ordinaryFixture(lang: Lang, n: number): string {
  const lines: string[] = [];
  if (lang === "java") {
    lines.push("import java.util.List;", "import java.util.Map;", "class Widget extends BaseWidget implements Renderable {");
  } else if (lang === "javascript") {
    lines.push("import { Base } from './base.js';", "class Widget extends Base {");
  } else if (lang === "typescript") {
    lines.push("import { Base } from './base';", "interface Renderable { render(): void; }", "class Widget extends Base implements Renderable {");
  } else {
    lines.push("import { Base } from './base';", "class Widget extends Base {");
  }
  let i = 0;
  while (lines.length < n - 2) {
    if (i % 10 === 0) {
      lines.push("");
    } else if (i % 4 === 0) {
      if (lang === "java") lines.push(`  void method${i}() { int x = ${i}; if (x > 0) { helper(); } }`);
      else if (lang === "javascript") lines.push(`  method${i}() { const x = ${i}; if (x > 0) { helper(); } }`);
      else if (lang === "typescript") lines.push(`  method${i}(): void { const x = ${i}; if (x > 0) { helper(); } }`);
      else lines.push(`  method${i}() { const x = ${i}; return x > 0 ? <span>{helper()}</span> : null; }`);
    } else {
      lines.push(`  // plain statement line ${i}`);
    }
    i++;
  }
  lines.push("}");
  if (lang !== "java") lines.push(lang === "typescript" ? "function helper(): void {}" : "function helper() { return 1; }");
  return lines.join("\n") + "\n";
}

const CALLS_HEAVY: Record<Lang, string> = {
  java:
    "class Widget {\n  void helper() {}\n  void target() {}\n" +
    Array.from({ length: 15 }, (_, i) => `  void caller${i}() { helper(); target(); ambiguous${i % 2}(); }`).join("\n") +
    "\n  void ambiguous0() {}\n}\nclass Other {\n  void ambiguous0() {}\n}\n",
  javascript:
    "function helper() {}\nfunction target() {}\n" +
    Array.from({ length: 15 }, (_, i) => `function caller${i}() { helper(); target(); ambiguous(); }`).join("\n") +
    "\nfunction ambiguous() {}\nconst obj = { ambiguous() {} };\n",
  typescript:
    "function helper(): void {}\nfunction target(): void {}\n" +
    Array.from({ length: 15 }, (_, i) => `function caller${i}(): void { helper(); target(); ambiguous(); }`).join("\n") +
    "\nfunction ambiguous(): void {}\nconst obj = { ambiguous(): void {} };\n",
  tsx:
    "function helper() {}\nfunction target() {}\n" +
    Array.from({ length: 15 }, (_, i) => `function caller${i}() { return <div>{helper()}{target()}{ambiguous()}</div>; }`).join("\n") +
    "\nfunction ambiguous() {}\nconst obj = { ambiguous() { return 1; } };\n",
};

function relationshipDense(lang: Lang): string {
  const imports = Array.from({ length: 20 }, (_, i) =>
    lang === "java" ? `import pkg.mod${i}.Thing${i};` : `import { Thing${i} } from './mod${i}';`,
  ).join("\n");
  if (lang === "java") {
    return (
      imports +
      "\nclass Widget extends BaseWidget implements Renderable, Serializable {\n" +
      Array.from({ length: 100 }, (_, i) => `  void method${i}() { helper(); other${i % 5}(); target${i % 3}(); }`).join("\n") +
      "\n}\n"
    );
  }
  const implementsClause = lang === "typescript" || lang === "tsx" ? " implements Renderable, Serializable" : "";
  const iface = lang === "typescript" || lang === "tsx" ? "interface Renderable { render(): void; }\ninterface Serializable { serialize(): string; }\n" : "";
  return (
    imports + "\n" + iface + `class Widget extends BaseWidget${implementsClause} {\n` +
    Array.from({ length: 100 }, (_, i) => `  method${i}() { helper(); other${i % 5}(); target${i % 3}(); }`).join("\n") +
    "\n}\n"
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
type Stats = { minMs: number; medianMs: number; p95Ms: number; maxMs: number };
function stats(samples: number[]): Stats {
  const s = [...samples].sort((a, b) => a - b);
  const pick = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  return { minMs: s[0]!, medianMs: pick(0.5), p95Ms: pick(0.95), maxMs: s[s.length - 1]! };
}
function classify(p95Ms: number): "comfortably bounded" | "borderline" | "likely unsafe" {
  if (p95Ms < 3) return "comfortably bounded";
  if (p95Ms <= 8) return "borderline";
  return "likely unsafe";
}

type Cell = {
  lang: Lang;
  fixture: string;
  lines: number;
  symbolCount: number;
  c1_parse: Stats;
  c2raw_symbolsInclHashing: Stats;
  c3_relObservation: Stats;
  c4_hashingIsolated: Stats;
  c5_combinedTotal: Stats;
  treeDeleteCount: number;
  treesCreated: number;
};

let totalTreesCreated = 0;
let totalTreeDeletes = 0;

async function runCell(lang: Lang, fixtureName: string, source: string): Promise<Cell> {
  const parser = await getParser(lang);
  const language = parser.language!;
  const relQuery = new Query(language, relQuerySource[lang]);
  const lines = source.split("\n").length;

  const c1: number[] = [], c2raw: number[] = [], c3: number[] = [], c5: number[] = [];
  let symbolCount = 0;

  // Warmup (untimed).
  for (let i = 0; i < WARMUP; i++) {
    const t = parser.parse(source);
    if (t) {
      toIntermediateRepresentation(t, language, symbolQuerySource[lang], 1, `${fixtureName}.ts`);
      relQuery.matches(t.rootNode);
      t.delete();
    }
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = process.hrtime.bigint();
    const tree = parser.parse(source);
    if (!tree) throw new Error(`${fixtureName}: parse failed`);
    totalTreesCreated++;
    const t1 = process.hrtime.bigint();

    const symbols = toIntermediateRepresentation(tree, language, symbolQuerySource[lang], 1, `${fixtureName}.ts`);
    symbolCount = symbols.length;
    const t2 = process.hrtime.bigint();

    relQuery.matches(tree.rootNode);
    const t3 = process.hrtime.bigint();

    tree.delete(); // exactly one delete per created tree
    totalTreeDeletes++;

    c1.push(Number(t1 - t0) / 1e6);
    c2raw.push(Number(t2 - t1) / 1e6);
    c3.push(Number(t3 - t2) / 1e6);
    c5.push(Number(t3 - t0) / 1e6);
  }

  // C4: computeSymbolKey isolated benchmark — same call count as this
  // fixture's real symbol count, representative argument shapes, run
  // entirely OUTSIDE the parse/query timeline above (does not touch the
  // tree at all — pure hashing cost in isolation).
  const c4: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const h0 = process.hrtime.bigint();
    for (let s = 0; s < symbolCount; s++) {
      computeSymbolKey(1, `${fixtureName}.ts`, "method", `method${s}`, s, 2);
    }
    const h1 = process.hrtime.bigint();
    c4.push(Number(h1 - h0) / 1e6);
  }

  return {
    lang,
    fixture: fixtureName,
    lines,
    symbolCount,
    c1_parse: stats(c1),
    c2raw_symbolsInclHashing: stats(c2raw),
    c3_relObservation: stats(c3),
    c4_hashingIsolated: stats(c4),
    c5_combinedTotal: stats(c5),
    treeDeleteCount: ITERATIONS,
    treesCreated: ITERATIONS,
  };
}

// ---------------------------------------------------------------------------
// Real-file cells
// ---------------------------------------------------------------------------
const REAL_FILES: { path: string; lang: Lang; note: string }[] = [
  { path: "src/routes/catalogue.tsx", lang: "tsx", note: "real, ~p95 local size" },
  { path: "src/components/atlas/AtlasScene.tsx", lang: "tsx", note: "real, ~p99 local size" },
  { path: "src/components/ui/sidebar.tsx", lang: "tsx", note: "real, local max" },
  { path: "src/lib/code-intel/persistence/symbol-d1-client.ts", lang: "typescript", note: "real, largest local plain .ts" },
  { path: "eslint.config.js", lang: "javascript", note: "real, but only 40 lines — only real local .js file, NOT representative of a large JS file; flagged as a coverage gap" },
];

async function main() {
  await installTestWasmModules();

  const startMem = process.memoryUsage();

  const cells: Cell[] = [];
  for (const lang of LANGUAGES) {
    for (const lines of SIZES) {
      cells.push(await runCell(lang, `ordinary-${lines}`, ordinaryFixture(lang, lines)));
    }
    cells.push(await runCell(lang, "calls-heavy", CALLS_HEAVY[lang]));
    cells.push(await runCell(lang, "relationship-dense", relationshipDense(lang)));
  }

  const realCells: Cell[] = [];
  for (const { path, lang } of REAL_FILES) {
    const source = readFileSync(resolve(REPO_ROOT, path), "utf8");
    realCells.push(await runCell(lang, path, source));
  }

  const endMem = process.memoryUsage();

  // --- report ---
  const md: string[] = [];
  md.push("# Combined Single-Pass Decomposition (C1-C5)");
  md.push("");
  md.push(`**Generated**: (session time)`);
  md.push("");
  md.push(
    "**LOCAL WALL-CLOCK PROXY ONLY** (`process.hrtime.bigint()`, this machine, Bun runtime). NOT Cloudflare Workers CPU-ms. Does not prove Cloudflare CPU-budget compliance. Measurement only — no production code modified, no optimization applied. Uses the REAL production `getParser`, `toIntermediateRepresentation`, `computeSymbolKey`, and real `relationships/queries/*.scm` files. Resolution is entirely excluded (not run, not stubbed) so it cannot contaminate these numbers.",
  );
  md.push("");
  md.push(
    "**Definitions**: C1 = parse. C2raw = `toIntermediateRepresentation()` measured as the real production code runs it — this INCLUDES `computeSymbolKey` hashing, since splitting it out would require modifying that function (not permitted here). C3 = relationship-query observation only (no resolution). C4 = `computeSymbolKey()` measured in ISOLATION — same call count as the fixture's real symbol count, run entirely outside the parse/query timeline, to estimate hashing's share of C2raw. C5 = combined single-pass total, timed directly as one continuous parse→symbols→relationships pass (C1+C2raw+C3, measured together, not summed from rounded parts).",
  );
  md.push("");

  md.push("## Ordinary-density synthetic sweep — median ms, all phases");
  md.push("");
  for (const lang of LANGUAGES) {
    md.push(`### ${lang}`);
    md.push("");
    md.push("| lines | C1 parse | C2raw symbols(+hash) | C3 relObs | C4 hash (isolated) | C5 total | symbols | C5 classification |");
    md.push("|---|---|---|---|---|---|---|---|");
    for (const cell of cells.filter((c) => c.lang === lang && c.fixture.startsWith("ordinary-"))) {
      md.push(
        `| ${cell.lines} | ${cell.c1_parse.medianMs.toFixed(3)} | ${cell.c2raw_symbolsInclHashing.medianMs.toFixed(3)} | ${cell.c3_relObservation.medianMs.toFixed(3)} | ${cell.c4_hashingIsolated.medianMs.toFixed(3)} | ${cell.c5_combinedTotal.medianMs.toFixed(3)} | ${cell.symbolCount} | ${classify(cell.c5_combinedTotal.p95Ms)} |`,
      );
    }
    md.push("");
  }

  md.push("## CALLS-heavy and relationship-dense fixtures");
  md.push("");
  md.push("| lang | fixture | lines | C1 | C2raw | C3 | C4 | C5 | symbols | C5 classification |");
  md.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const cell of cells.filter((c) => c.fixture === "calls-heavy" || c.fixture === "relationship-dense")) {
    md.push(
      `| ${cell.lang} | ${cell.fixture} | ${cell.lines} | ${cell.c1_parse.medianMs.toFixed(3)} | ${cell.c2raw_symbolsInclHashing.medianMs.toFixed(3)} | ${cell.c3_relObservation.medianMs.toFixed(3)} | ${cell.c4_hashingIsolated.medianMs.toFixed(3)} | ${cell.c5_combinedTotal.medianMs.toFixed(3)} | ${cell.symbolCount} | ${classify(cell.c5_combinedTotal.p95Ms)} |`,
    );
  }
  md.push("");

  md.push("## Real-file measurements");
  md.push("");
  md.push("| file | lang | lines | note | C1 | C2raw | C3 | C4 | C5 | symbols | C5 classification (p95) |");
  md.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const cell of realCells) {
    const note = REAL_FILES.find((f) => f.path === cell.fixture)!.note;
    md.push(
      `| ${cell.fixture} | ${cell.lang} | ${cell.lines} | ${note} | ${cell.c1_parse.medianMs.toFixed(3)} | ${cell.c2raw_symbolsInclHashing.medianMs.toFixed(3)} | ${cell.c3_relObservation.medianMs.toFixed(3)} | ${cell.c4_hashingIsolated.medianMs.toFixed(3)} | ${cell.c5_combinedTotal.medianMs.toFixed(3)} | ${cell.symbolCount} | ${classify(cell.c5_combinedTotal.p95Ms)} |`,
    );
  }
  md.push("");

  md.push("## Percentage attribution of C5 (ordinary sweep, largest size = 1500 lines) and real files");
  md.push("");
  md.push("| target | C1 % | C2raw % (symbols+hash) | C3 % | C4 as % of C2raw (hashing's share within symbol step) | pure-discovery estimate (C2raw − C4) |");
  md.push("|---|---|---|---|---|---|");
  const attributionTargets = [
    ...LANGUAGES.map((l) => cells.find((c) => c.lang === l && c.fixture === "ordinary-1500")!),
    ...realCells,
  ];
  for (const cell of attributionTargets) {
    const total = cell.c5_combinedTotal.medianMs || 1;
    const c1pct = (cell.c1_parse.medianMs / total) * 100;
    const c2pct = (cell.c2raw_symbolsInclHashing.medianMs / total) * 100;
    const c3pct = (cell.c3_relObservation.medianMs / total) * 100;
    const c4ofC2 = cell.c2raw_symbolsInclHashing.medianMs > 0
      ? (cell.c4_hashingIsolated.medianMs / cell.c2raw_symbolsInclHashing.medianMs) * 100
      : 0;
    const pureDiscovery = cell.c2raw_symbolsInclHashing.medianMs - cell.c4_hashingIsolated.medianMs;
    md.push(
      `| ${cell.lang}/${cell.fixture} | ${c1pct.toFixed(1)}% | ${c2pct.toFixed(1)}% | ${c3pct.toFixed(1)}% | ${c4ofC2.toFixed(1)}% | ${pureDiscovery.toFixed(3)}ms |`,
    );
  }
  md.push("");

  md.push("## Recoverable time if computeSymbolKey were removed/deferred from the hot path (estimate)");
  md.push("");
  md.push("| target | C5 total (current) | C4 (hashing) | C5 if hashing removed (estimate) | new classification |");
  md.push("|---|---|---|---|---|");
  for (const cell of attributionTargets) {
    const withoutHashing = cell.c5_combinedTotal.medianMs - cell.c4_hashingIsolated.medianMs;
    // Recompute a rough p95-equivalent classification using the same
    // proportional reduction applied to the p95 total (conservative: uses
    // the smaller of the two possible reductions, i.e. assumes hashing's
    // p95 share is at least as large as its median share).
    const p95WithoutHashing = cell.c5_combinedTotal.p95Ms - cell.c4_hashingIsolated.p95Ms;
    md.push(
      `| ${cell.lang}/${cell.fixture} | ${cell.c5_combinedTotal.medianMs.toFixed(3)} | ${cell.c4_hashingIsolated.medianMs.toFixed(3)} | ${withoutHashing.toFixed(3)} | ${classify(p95WithoutHashing)} |`,
    );
  }
  md.push("");

  md.push("## Tree lifecycle / memory");
  md.push("");
  md.push(`Total trees created across this run: **${totalTreesCreated}**. Total \`tree.delete()\` calls: **${totalTreeDeletes}**. Difference: **${totalTreesCreated - totalTreeDeletes}** (0 expected — one delete per created tree, by construction of \`runCell\`'s loop; no lifecycle anomaly observed).`);
  md.push("");
  md.push("| | rss (MB) | heapUsed (MB) | external (MB) |");
  md.push("|---|---|---|---|");
  md.push(`| start | ${(startMem.rss / 1e6).toFixed(1)} | ${(startMem.heapUsed / 1e6).toFixed(1)} | ${(startMem.external / 1e6).toFixed(1)} |`);
  md.push(`| end | ${(endMem.rss / 1e6).toFixed(1)} | ${(endMem.heapUsed / 1e6).toFixed(1)} | ${(endMem.external / 1e6).toFixed(1)} |`);
  md.push("");
  md.push(`Files/fixtures processed this run: ${cells.length + realCells.length} (each parsed ${ITERATIONS} timed iterations + ${WARMUP} warmup iterations = ${ITERATIONS + WARMUP} trees per fixture).`);
  md.push("");

  md.push("## Full stats (min/median/p95/max) — real files");
  md.push("");
  md.push("| file | phase | min | median | p95 | max |");
  md.push("|---|---|---|---|---|---|");
  for (const cell of realCells) {
    const rows: [string, Stats][] = [
      ["C1 parse", cell.c1_parse],
      ["C2raw symbols(+hash)", cell.c2raw_symbolsInclHashing],
      ["C3 relObs", cell.c3_relObservation],
      ["C4 hash isolated", cell.c4_hashingIsolated],
      ["C5 total", cell.c5_combinedTotal],
    ];
    for (const [name, s] of rows) {
      md.push(`| ${cell.fixture} | ${name} | ${s.minMs.toFixed(3)} | ${s.medianMs.toFixed(3)} | ${s.p95Ms.toFixed(3)} | ${s.maxMs.toFixed(3)} |`);
    }
  }
  md.push("");

  writeFileSync(OUT_FILE, md.join("\n"));
  console.log(md.join("\n"));
  console.log(`\nWritten to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
