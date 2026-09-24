#!/usr/bin/env bun
/**
 * LOCAL-ONLY, standalone experimental spike — NOT wired into the app,
 * NOT a production code change. Tests the single-pass hypothesis raised by
 * the graphify/codegraph reference-architecture investigation
 * (docs/investigations/004-relationship-graph-cpu-and-reference-architecture.md
 * §3): can symbol extraction (Feature 002-style) and relationship
 * observation (Feature 004-style) run against ONE Tree-sitter parse instead
 * of two separate parses, and does that change the CPU-feasibility picture?
 *
 * Uses the REAL production grammar provider (getParser,
 * src/lib/code-intel/symbols/grammar-provider.ts — same parser cache, same
 * WASM modules, same dylink-substitution mechanism T066 validated) and the
 * REAL production symbol-IR extractor (toIntermediateRepresentation,
 * src/lib/code-intel/symbols/to-intermediate-representation.ts) — not a
 * reimplementation. Relationship observation reuses the real
 * relationships/queries/*.scm files T014+ already produced. No production
 * file is modified. No D1/R2/network/Cloudflare access.
 *
 * Every timing number is a LOCAL WALL-CLOCK PROXY (process.hrtime.bigint(),
 * this machine, Bun runtime), NOT Cloudflare Workers CPU-ms. Does not prove
 * Cloudflare CPU-budget compliance.
 *
 * Run: bun run scripts/relationship-single-pass-spike.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Query, type Tree } from "web-tree-sitter";
import { getParser } from "../src/lib/code-intel/symbols/grammar-provider";
import { toIntermediateRepresentation } from "../src/lib/code-intel/symbols/to-intermediate-representation";
import { installTestWasmModules } from "../tests/support/wasm-test-modules";
import type { SupportedLanguage } from "../src/lib/code-intel/symbols/language-detector";

const REPO_ROOT = resolve(import.meta.dir, "..");
const SYMBOL_QUERIES_DIR = resolve(REPO_ROOT, "src/lib/code-intel/symbols/queries");
const REL_QUERIES_DIR = resolve(REPO_ROOT, "src/lib/code-intel/relationships/queries");
const OUT_FILE = resolve(REPO_ROOT, "specs/004-engineering-relationship-graph/single-pass-spike-results.md");

type Lang = "java" | "javascript" | "typescript" | "tsx";
const LANGUAGES: Lang[] = ["java", "javascript", "typescript", "tsx"];
const SIZES = [100, 250, 500, 750, 1000, 1250, 1500, 2000, 2500];
const ITERATIONS = 20;
const WARMUP = 5;

const symbolQuerySource: Record<Lang, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l, readFileSync(resolve(SYMBOL_QUERIES_DIR, `${l}.scm`), "utf8")]),
) as Record<Lang, string>;
const relQuerySource: Record<Lang, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l, readFileSync(resolve(REL_QUERIES_DIR, `${l}.scm`), "utf8")]),
) as Record<Lang, string>;

// ---------------------------------------------------------------------------
// Fixture generation — same worst-case dense shape used in the prior
// decomposition spike, parameterized by target line count, plus a
// CALLS-heavy and a relationship-dense (imports+extends+implements+calls all
// deliberately maximized) variant.
// ---------------------------------------------------------------------------
function javaFixture(n: number): string {
  return (
    "import java.util.List;\nimport java.util.Map;\nclass Widget extends BaseWidget implements Renderable {\n" +
    Array.from({ length: n }, (_, i) => `  void method${i}() { helper(); other${i % 3}(); System.out.println(${i}); }`).join("\n") +
    "\n}\n"
  );
}
function jsFixture(n: number): string {
  return (
    "import { Base } from './base.js';\nclass Widget extends Base {\n" +
    Array.from({ length: n }, (_, i) => `  method${i}() { helper(); other${i % 3}(); console.log(${i}); }`).join("\n") +
    "\n}\nfunction helper() { return 1; }\n"
  );
}
function tsFixture(n: number): string {
  return (
    "import { Base } from './base';\ninterface Renderable { render(): void; }\nclass Widget extends Base implements Renderable {\n  render(): void {}\n" +
    Array.from({ length: n }, (_, i) => `  method${i}(): void { helper(); other${i % 3}(); console.log(${i}); }`).join("\n") +
    "\n}\nfunction helper(): void {}\n"
  );
}
function tsxFixture(n: number): string {
  return (
    "import { Base } from './base';\nclass Widget extends Base {\n" +
    Array.from({ length: n }, (_, i) => `  method${i}() { return <span>{helper()}{other${i % 3}()}{console.log(${i})}</span>; }`).join("\n") +
    "\n}\nfunction helper() { return 1; }\n"
  );
}
const SWEEP_FIXTURE: Record<Lang, (n: number) => string> = {
  java: javaFixture,
  javascript: jsFixture,
  typescript: tsFixture,
  tsx: tsxFixture,
};

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

// Relationship-dense: maximize imports + extends + implements + calls together, ~300 lines.
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
  const implementsClause = lang === "java" ? "" : lang === "typescript" || lang === "tsx" ? " implements Renderable, Serializable" : "";
  const iface = lang === "typescript" || lang === "tsx" ? "interface Renderable { render(): void; }\ninterface Serializable { serialize(): string; }\n" : "";
  return (
    imports +
    "\n" + iface +
    `class Widget extends BaseWidget${implementsClause} {\n` +
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
  if (p95Ms <= 8) return "borderline"; // conservative: values close to 10ms are NEVER "comfortably bounded"
  return "likely unsafe";
}
function stubResolve(names: string[], table: Map<string, number[]>): void {
  for (const name of names) void table.get(name);
}

const SYMBOL_TABLE = new Map<string, number[]>([
  ["helper", [1]],
  ["other0", [10]],
  ["other1", [11]],
  ["other2", [12]],
  ["target0", [20]],
  ["target1", [21]],
  ["target2", [22]],
]);

// ---------------------------------------------------------------------------
// Experiment runner: given one language and one source string, run A/B/C
// experiments per iteration, return per-phase samples.
// ---------------------------------------------------------------------------
type Cell = {
  lang: Lang;
  fixture: string;
  lines: number;
  // A: Feature-002-style (parse -> symbol extraction -> delete)
  a_parse: Stats;
  a_symbols: Stats;
  a_total: Stats;
  // B: Feature-004-style (second parse -> relationship query -> resolution -> delete)
  b_parse: Stats;
  b_relQuery: Stats;
  b_resolution: Stats;
  b_total: Stats;
  // current two-pass architecture total = A + B
  twoPass_total: Stats;
  // C: combined single-pass (one parse -> symbols -> relationships -> resolution -> delete)
  c_parse: Stats;
  c_symbols: Stats;
  c_relQuery: Stats;
  c_resolution: Stats;
  c_total: Stats;
};

async function runCell(lang: Lang, fixtureName: string, source: string, lines: number): Promise<Cell> {
  const parser = await getParser(lang);
  const language = parser.language!;
  const symQuery = new Query(language, symbolQuerySource[lang]);
  const relQuery = new Query(language, relQuerySource[lang]);

  const aParse: number[] = [], aSymbols: number[] = [], aTotal: number[] = [];
  const bParse: number[] = [], bRelQuery: number[] = [], bResolution: number[] = [], bTotal: number[] = [];
  const cParse: number[] = [], cSymbols: number[] = [], cRelQuery: number[] = [], cResolution: number[] = [], cTotal: number[] = [];

  // Warmup (untimed) for all three paths.
  for (let i = 0; i < WARMUP; i++) {
    const t1 = parser.parse(source);
    if (t1) { toIntermediateRepresentation(t1, language, symbolQuerySource[lang], 1, "warmup.ts"); t1.delete(); }
    const t2 = parser.parse(source);
    if (t2) { relQuery.matches(t2.rootNode); t2.delete(); }
  }

  for (let i = 0; i < ITERATIONS; i++) {
    // --- A: Feature-002-style parse + symbol extraction ---
    const a0 = process.hrtime.bigint();
    const treeA = parser.parse(source);
    if (!treeA) throw new Error("A: parse failed");
    const a1 = process.hrtime.bigint();
    toIntermediateRepresentation(treeA, language, symbolQuerySource[lang], 1, `${fixtureName}.ts`);
    const a2 = process.hrtime.bigint();
    treeA.delete(); // exactly one delete for this tree, mirrors production extraction-pipeline.ts
    aParse.push(Number(a1 - a0) / 1e6);
    aSymbols.push(Number(a2 - a1) / 1e6);
    aTotal.push(Number(a2 - a0) / 1e6);

    // --- B: Feature-004-style SECOND parse + relationship query + resolution ---
    const b0 = process.hrtime.bigint();
    const treeB = parser.parse(source);
    if (!treeB) throw new Error("B: parse failed");
    const b1 = process.hrtime.bigint();
    const matchesB = relQuery.matches(treeB.rootNode);
    const callNamesB: string[] = [];
    for (const m of matchesB) for (const c of m.captures) if (c.name === "rel.call.name") callNamesB.push(c.node.text);
    const b2 = process.hrtime.bigint();
    stubResolve(callNamesB, SYMBOL_TABLE);
    const b3 = process.hrtime.bigint();
    treeB.delete(); // exactly one delete for this tree
    bParse.push(Number(b1 - b0) / 1e6);
    bRelQuery.push(Number(b2 - b1) / 1e6);
    bResolution.push(Number(b3 - b2) / 1e6);
    bTotal.push(Number(b3 - b0) / 1e6);

    // --- C: combined single-pass — ONE parse, symbols + relationships + resolution, ONE delete ---
    const c0 = process.hrtime.bigint();
    const treeC = parser.parse(source);
    if (!treeC) throw new Error("C: parse failed");
    const c1 = process.hrtime.bigint();
    toIntermediateRepresentation(treeC, language, symbolQuerySource[lang], 1, `${fixtureName}.ts`);
    const c2 = process.hrtime.bigint();
    const matchesC = relQuery.matches(treeC.rootNode);
    const callNamesC: string[] = [];
    for (const m of matchesC) for (const c of m.captures) if (c.name === "rel.call.name") callNamesC.push(c.node.text);
    const c3 = process.hrtime.bigint();
    stubResolve(callNamesC, SYMBOL_TABLE);
    const c4 = process.hrtime.bigint();
    treeC.delete(); // exactly ONE delete total for both concerns — the hypothesis under test
    cParse.push(Number(c1 - c0) / 1e6);
    cSymbols.push(Number(c2 - c1) / 1e6);
    cRelQuery.push(Number(c3 - c2) / 1e6);
    cResolution.push(Number(c4 - c3) / 1e6);
    cTotal.push(Number(c4 - c0) / 1e6);
  }

  const twoPassTotal = aTotal.map((v, i) => v + bTotal[i]!);

  return {
    lang,
    fixture: fixtureName,
    lines,
    a_parse: stats(aParse),
    a_symbols: stats(aSymbols),
    a_total: stats(aTotal),
    b_parse: stats(bParse),
    b_relQuery: stats(bRelQuery),
    b_resolution: stats(bResolution),
    b_total: stats(bTotal),
    twoPass_total: stats(twoPassTotal),
    c_parse: stats(cParse),
    c_symbols: stats(cSymbols),
    c_relQuery: stats(cRelQuery),
    c_resolution: stats(cResolution),
    c_total: stats(cTotal),
  };
}

// ---------------------------------------------------------------------------
// Memory / tree-lifecycle test
// ---------------------------------------------------------------------------
async function runMemoryTest(): Promise<string[]> {
  const out: string[] = [];
  out.push("## Memory / tree-lifecycle test");
  out.push("");
  out.push(
    "Runs 300 sequential single-pass (scenario C) extractions across varied synthetic sources (different content per file, avoiding any identical-source shortcut), sampling `process.memoryUsage()` every 50 files. Verifies: parser identity is stable (production `getParser`'s module-level cache is reused, not re-instantiated per file — confirms an existing ADOPT-classified technique from the reference-architecture investigation is already production behavior), tree.delete() called exactly once per file, and RSS/external memory does not grow unboundedly.",
  );
  out.push("");

  const lang: Lang = "typescript";
  const parser1 = await getParser(lang);
  const parser2 = await getParser(lang);
  out.push(`**Parser reuse check**: \`getParser("${lang}")\` called twice — same instance returned: **${parser1 === parser2}** (production \`grammar-provider.ts\`'s module-level \`parserCache\` Map).`);
  out.push("");

  const language = parser1.language!;
  const symQ = symbolQuerySource[lang];
  const relQ = new Query(language, relQuerySource[lang]);

  out.push("| files processed | rss (MB) | heapUsed (MB) | external (MB) | trees deleted (cumulative) |");
  out.push("|---|---|---|---|---|");

  let deletedCount = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    const source = tsFixture(50 + (i % 20)); // vary size slightly to avoid any accidental memoization shortcuts
    const tree = parser1.parse(source);
    if (!tree) throw new Error(`memory test: parse failed at file ${i}`);
    toIntermediateRepresentation(tree, language, symQ, 1, `mem-${i}.ts`);
    relQ.matches(tree.rootNode);
    tree.delete();
    deletedCount++;

    if ((i + 1) % 50 === 0) {
      if (global.gc) global.gc();
      const mem = process.memoryUsage();
      out.push(
        `| ${i + 1} | ${(mem.rss / 1e6).toFixed(1)} | ${(mem.heapUsed / 1e6).toFixed(1)} | ${(mem.external / 1e6).toFixed(1)} | ${deletedCount} |`,
      );
    }
  }
  out.push("");
  out.push(`Total files processed: ${N}. Total \`tree.delete()\` calls: ${deletedCount} (exactly one per file — no leaked, undeleted trees by construction of this loop).`);
  out.push("");
  out.push(
    "**Caveat**: `global.gc()` is only invoked if the script was run with `--expose-gc`; if unavailable, RSS numbers include normal GC-deferred garbage and should be read as a trend across the row, not an exact per-file figure. This test does not run under Cloudflare's actual isolate memory model — it only verifies THIS script's own tree lifecycle (no leaked `Tree` handles) and reproduces the parser-reuse pattern production already uses.",
  );
  return out;
}

// ---------------------------------------------------------------------------
// Real-file calibration
// ---------------------------------------------------------------------------
const REAL_FILES: { path: string; lang: Lang }[] = [
  { path: "src/routes/catalogue.tsx", lang: "tsx" },
  { path: "src/components/atlas/AtlasScene.tsx", lang: "tsx" },
  { path: "src/components/ui/sidebar.tsx", lang: "tsx" },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  await installTestWasmModules();

  const cells: Cell[] = [];

  for (const lang of LANGUAGES) {
    for (const lines of SIZES) {
      cells.push(await runCell(lang, `sweep-${lines}`, SWEEP_FIXTURE[lang](lines), lines));
    }
    const chSource = CALLS_HEAVY[lang];
    cells.push(await runCell(lang, "calls-heavy", chSource, chSource.split("\n").length));
    const rdSource = relationshipDense(lang);
    cells.push(await runCell(lang, "relationship-dense", rdSource, rdSource.split("\n").length));
  }

  const realCells: Cell[] = [];
  for (const { path, lang } of REAL_FILES) {
    const source = readFileSync(resolve(REPO_ROOT, path), "utf8");
    realCells.push(await runCell(lang, path, source, source.split("\n").length));
  }

  const md: string[] = [];
  md.push("# Single-Pass Architecture Spike — A vs B vs C");
  md.push("");
  md.push(`**Generated**: ${new Date().toISOString()}`);
  md.push("");
  md.push(
    "**LOCAL WALL-CLOCK PROXY ONLY** (`process.hrtime.bigint()`, this machine, Bun runtime). NOT Cloudflare Workers CPU-ms. Does not prove Cloudflare CPU-budget compliance. Standalone experimental spike — no production file modified, no D1/R2/network/Cloudflare access. Uses the REAL production `getParser` (grammar-provider.ts) and REAL production `toIntermediateRepresentation` (symbol IR extractor) — not a reimplementation. Relationship observation reuses the real `relationships/queries/*.scm` files.",
  );
  md.push("");
  md.push(
    "**Scenarios**: **A** = Feature-002-style (parse → symbol extraction → delete). **B** = Feature-004-style (a SECOND, separate parse → relationship query → resolution → delete) — `twoPass_total` = A + B, modeling the CURRENT two-invocation architecture. **C** = hypothetical combined single-pass (ONE parse → symbol extraction → relationship query → resolution → ONE delete).",
  );
  md.push("");
  md.push(
    "**Conservative classification**: comfortably bounded (p95 < 3ms) / borderline (3–8ms) / likely unsafe (>8ms). A result close to 10ms is NEVER classified comfortably bounded, per explicit instruction.",
  );
  md.push("");

  md.push("## A vs B vs C — synthetic sweep, median ms, by language and size");
  md.push("");
  for (const lang of LANGUAGES) {
    md.push(`### ${lang}`);
    md.push("");
    md.push("| lines | A: parse+symbols | B: parse+relQuery+resolve | two-pass total (A+B) | C: single-pass total | C classification | two-pass classification |");
    md.push("|---|---|---|---|---|---|---|");
    for (const cell of cells.filter((c) => c.lang === lang && c.fixture.startsWith("sweep-"))) {
      md.push(
        `| ${cell.lines} | ${cell.a_total.medianMs.toFixed(3)} | ${cell.b_total.medianMs.toFixed(3)} | ${cell.twoPass_total.medianMs.toFixed(3)} | ${cell.c_total.medianMs.toFixed(3)} | ${classify(cell.c_total.p95Ms)} | ${classify(cell.twoPass_total.p95Ms)} |`,
      );
    }
    md.push("");
  }

  md.push("## CALLS-heavy and relationship-dense fixtures");
  md.push("");
  md.push("| lang | fixture | lines | A total | B total | two-pass total | C total | C classification | two-pass classification |");
  md.push("|---|---|---|---|---|---|---|---|---|");
  for (const cell of cells.filter((c) => c.fixture === "calls-heavy" || c.fixture === "relationship-dense")) {
    md.push(
      `| ${cell.lang} | ${cell.fixture} | ${cell.lines} | ${cell.a_total.medianMs.toFixed(3)} | ${cell.b_total.medianMs.toFixed(3)} | ${cell.twoPass_total.medianMs.toFixed(3)} | ${cell.c_total.medianMs.toFixed(3)} | ${classify(cell.c_total.p95Ms)} | ${classify(cell.twoPass_total.p95Ms)} |`,
    );
  }
  md.push("");

  md.push("## Real-file calibration (repo-atlas's own TSX source, at/near local p95/p99/max)");
  md.push("");
  md.push("| file | lines | A total | B total | two-pass total | C total | C classification | two-pass classification |");
  md.push("|---|---|---|---|---|---|---|---|");
  for (const cell of realCells) {
    md.push(
      `| ${cell.fixture} | ${cell.lines} | ${cell.a_total.medianMs.toFixed(3)} | ${cell.b_total.medianMs.toFixed(3)} | ${cell.twoPass_total.medianMs.toFixed(3)} | ${cell.c_total.medianMs.toFixed(3)} | ${classify(cell.c_total.p95Ms)} | ${classify(cell.twoPass_total.p95Ms)} |`,
    );
  }
  md.push("");

  md.push("## Phase breakdown at 2500 lines (median ms) — full detail");
  md.push("");
  md.push("| lang | a.parse | a.symbols | b.parse | b.relQuery | b.resolution | c.parse | c.symbols | c.relQuery | c.resolution | two-pass total | C total | savings (two-pass − C) | savings % |");
  md.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const lang of LANGUAGES) {
    const cell = cells.find((c) => c.lang === lang && c.lines === 2500)!;
    const savings = cell.twoPass_total.medianMs - cell.c_total.medianMs;
    const savingsPct = (savings / cell.twoPass_total.medianMs) * 100;
    md.push(
      `| ${lang} | ${cell.a_parse.medianMs.toFixed(3)} | ${cell.a_symbols.medianMs.toFixed(3)} | ${cell.b_parse.medianMs.toFixed(3)} | ${cell.b_relQuery.medianMs.toFixed(3)} | ${cell.b_resolution.medianMs.toFixed(3)} | ${cell.c_parse.medianMs.toFixed(3)} | ${cell.c_symbols.medianMs.toFixed(3)} | ${cell.c_relQuery.medianMs.toFixed(3)} | ${cell.c_resolution.medianMs.toFixed(3)} | ${cell.twoPass_total.medianMs.toFixed(3)} | ${cell.c_total.medianMs.toFixed(3)} | ${savings.toFixed(3)} | ${savingsPct.toFixed(1)}% |`,
    );
  }
  md.push("");

  md.push("## Full stats (min/median/p95/max) — all cells, synthetic sweep");
  md.push("");
  md.push("| lang | lines | two-pass total | C total |");
  md.push("|---|---|---|---|");
  for (const cell of cells.filter((c) => c.fixture.startsWith("sweep-"))) {
    const fmt = (s: Stats) => `min ${s.minMs.toFixed(3)} / median ${s.medianMs.toFixed(3)} / p95 ${s.p95Ms.toFixed(3)} / max ${s.maxMs.toFixed(3)}`;
    md.push(`| ${cell.lang} | ${cell.lines} | ${fmt(cell.twoPass_total)} | ${fmt(cell.c_total)} |`);
  }
  md.push("");

  const memLines = await runMemoryTest();
  md.push(...memLines);
  md.push("");

  writeFileSync(OUT_FILE, md.join("\n"));
  console.log(md.join("\n"));
  console.log(`\nWritten to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
