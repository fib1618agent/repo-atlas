#!/usr/bin/env bun
/**
 * T006 — Engineering Relationship Graph CPU feasibility spike
 * (specs/004-engineering-relationship-graph/tasks.md).
 *
 * Measures LOCAL WALL-CLOCK TIME (process.hrtime.bigint()) for one
 * "parsed"-phase relationship-extraction unit: re-parse one file (via the
 * same web-tree-sitter grammar Feature 002 uses) + run a relationship .scm
 * query + a stubbed bounded-lookup resolution step (an in-memory Map
 * standing in for the real indexed D1 lookup, since D1 read latency is
 * I/O-bound and excluded from Cloudflare's own CPU-time definition).
 *
 * IMPORTANT: every number this script produces is a LOCAL WALL-CLOCK PROXY,
 * NOT a Cloudflare Workers CPU-ms measurement. It does not and cannot prove
 * Cloudflare CPU-budget compliance — it only gives a comparative signal for
 * the one-file-per-unit granularity decision (research.md §1). Real
 * confirmation requires live Cloudflare validation, a separate, later,
 * explicitly-authorized phase (not run here).
 *
 * Not part of the app bundle — run via `bun run scripts/relationship-cpu-spike.ts`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Language, Parser, Query } from "web-tree-sitter";

const ROOT = resolve(import.meta.dir, "../node_modules");
const PUBLIC_WASM = resolve(import.meta.dir, "../public/wasm");
const QUERIES = resolve(import.meta.dir, "../src/lib/code-intel/relationships/queries");
const OUT_FILE = resolve(
  import.meta.dir,
  "../specs/004-engineering-relationship-graph/feasibility-results.md",
);

type Lang = "java" | "javascript" | "typescript" | "tsx";
const LANGUAGES: Lang[] = ["java", "javascript", "typescript", "tsx"];

let parserInitialized = false;

async function ensureParserInit(): Promise<void> {
  if (parserInitialized) return;
  const coreBytes = readFileSync(resolve(ROOT, "web-tree-sitter/tree-sitter.wasm"));
  const coreModule = await WebAssembly.compile(coreBytes);
  await Parser.init({
    instantiateWasm(
      imports: WebAssembly.Imports,
      successCallback: (i: WebAssembly.Instance, m: WebAssembly.Module) => void,
    ) {
      WebAssembly.instantiate(coreModule, imports).then((instance) => successCallback(instance, coreModule));
      return {};
    },
  } as Parameters<typeof Parser.init>[0]);
  parserInitialized = true;
}

async function loadLanguage(lang: Lang): Promise<Language> {
  await ensureParserInit();
  return Language.load(
    new Uint8Array(readFileSync(resolve(PUBLIC_WASM, `tree-sitter-${lang}.wasm`))),
  );
}

// ---------------------------------------------------------------------------
// Fixture generation: small (~20 lines), medium (~200 lines), large (~2000
// lines, near CODE_INTEL_MAX_FILE_SIZE_BYTES's ceiling), plus one dedicated
// CALLS-heavy/resolution-heavy fixture per language (10+ call sites, several
// deliberately ambiguous same-named targets).
// ---------------------------------------------------------------------------

function repeatBlock(block: (i: number) => string, count: number): string {
  return Array.from({ length: count }, (_, i) => block(i)).join("\n");
}

const FIXTURES: Record<Lang, Record<string, string>> = {
  java: {
    small:
      "import java.util.List;\n" +
      "class Widget extends BaseWidget implements Renderable {\n" +
      "  void render() { helper(); }\n" +
      "  void helper() { System.out.println(1); }\n" +
      "}\n",
    medium:
      "import java.util.List;\nimport java.util.Map;\n" +
      "class Widget extends BaseWidget implements Renderable {\n" +
      repeatBlock(
        (i) => `  void method${i}() { helper(); other${i % 3}(); }\n  void other${i % 3}() { helper(); }`,
        60,
      ) +
      "\n}\n",
    large:
      "import java.util.List;\nimport java.util.Map;\n" +
      "class Widget extends BaseWidget implements Renderable {\n" +
      repeatBlock(
        (i) => `  void method${i}() { helper(); other${i % 3}(); System.out.println(${i}); }`,
        700,
      ) +
      "\n}\n",
    callsHeavy:
      "class Widget {\n" +
      "  void helper() {}\n" +
      "  void target() {}\n" +
      repeatBlock((i) => `  void caller${i}() { helper(); target(); ambiguous${i % 2}(); }`, 15) +
      "\n" +
      "  void ambiguous0() {}\n" +
      "}\n" +
      "class Other {\n" +
      "  void ambiguous0() {}\n" + // duplicate name -> ambiguous target across classes
      "}\n",
  },
  javascript: {
    small:
      "import { Base } from './base.js';\n" +
      "class Widget extends Base {\n" +
      "  render() { this.helper(); }\n" +
      "  helper() { return 1; }\n" +
      "}\n",
    medium:
      "import { Base } from './base.js';\n" +
      "class Widget extends Base {\n" +
      repeatBlock((i) => `  method${i}() { helper(); other${i % 3}(); }`, 60) +
      "\n}\nfunction helper() { return 1; }\n" +
      repeatBlock((i) => `function other${i % 3}() { return ${i}; }`, 3),
    large:
      "import { Base } from './base.js';\n" +
      "class Widget extends Base {\n" +
      repeatBlock((i) => `  method${i}() { helper(); other${i % 3}(); console.log(${i}); }`, 700) +
      "\n}\nfunction helper() { return 1; }\n",
    callsHeavy:
      "function helper() {}\nfunction target() {}\n" +
      repeatBlock((i) => `function caller${i}() { helper(); target(); ambiguous(); }`, 15) +
      "\nfunction ambiguous() {}\n" +
      "const obj = { ambiguous() {} };\n", // duplicate name -> ambiguous
  },
  typescript: {
    small:
      "import { Base } from './base';\n" +
      "interface Renderable { render(): void; }\n" +
      "class Widget extends Base implements Renderable {\n" +
      "  render(): void { this.helper(); }\n" +
      "  helper(): void {}\n" +
      "}\n",
    medium:
      "import { Base } from './base';\n" +
      "class Widget extends Base {\n" +
      repeatBlock((i) => `  method${i}(): void { helper(); other${i % 3}(); }`, 60) +
      "\n}\nfunction helper(): void {}\n" +
      repeatBlock((i) => `function other${i % 3}(): void {}`, 3),
    large:
      "import { Base } from './base';\n" +
      "class Widget extends Base {\n" +
      repeatBlock((i) => `  method${i}(): void { helper(); other${i % 3}(); console.log(${i}); }`, 700) +
      "\n}\nfunction helper(): void {}\n",
    callsHeavy:
      "function helper(): void {}\nfunction target(): void {}\n" +
      repeatBlock((i) => `function caller${i}(): void { helper(); target(); ambiguous(); }`, 15) +
      "\nfunction ambiguous(): void {}\n" +
      "const obj = { ambiguous(): void {} };\n",
  },
  tsx: {
    small:
      "import { Base } from './base';\n" +
      "class Widget extends Base {\n" +
      "  render() { return <div>{this.helper()}</div>; }\n" +
      "  helper() { return 1; }\n" +
      "}\n",
    medium:
      "import { Base } from './base';\n" +
      "class Widget extends Base {\n" +
      repeatBlock((i) => `  method${i}() { return <span>{helper()}{other${i % 3}()}</span>; }`, 60) +
      "\n}\nfunction helper() { return 1; }\n" +
      repeatBlock((i) => `function other${i % 3}() { return ${i}; }`, 3),
    large:
      "import { Base } from './base';\n" +
      "class Widget extends Base {\n" +
      repeatBlock((i) => `  method${i}() { return <span>{helper()}{other${i % 3}()}</span>; }`, 700) +
      "\n}\nfunction helper() { return 1; }\n",
    callsHeavy:
      "function helper() {}\nfunction target() {}\n" +
      repeatBlock((i) => `function caller${i}() { return <div>{helper()}{target()}{ambiguous()}</div>; }`, 15) +
      "\nfunction ambiguous() {}\n" +
      "const obj = { ambiguous() { return 1; } };\n",
  },
};

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

type Stats = { minMs: number; medianMs: number; p95Ms: number; maxMs: number };

function computeStats(samplesMs: number[]): Stats {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
  return {
    minMs: sorted[0]!,
    medianMs: pick(0.5),
    p95Ms: pick(0.95),
    maxMs: sorted[sorted.length - 1]!,
  };
}

function classify(p95Ms: number): "comfortably bounded" | "borderline" | "likely unsafe" {
  if (p95Ms < 3) return "comfortably bounded";
  if (p95Ms <= 8) return "borderline";
  return "likely unsafe";
}

// Stub bounded-lookup resolution: an in-memory Map standing in for the real
// indexed D1 lookup (relationship-d1-client.ts's findSymbolCandidates), so
// this spike measures parse+query CPU cost plus a representative resolution
// loop shape, without a real D1 round-trip (I/O-bound, excluded from CPU
// time per Cloudflare's own definition — research.md §1).
function stubResolve(names: string[], symbolTable: Map<string, number>): void {
  for (const name of names) {
    // simulate a bounded point-lookup: exact-name match only, no scan
    void symbolTable.get(name);
  }
}

async function measureFixture(
  parser: Parser,
  query: Query,
  source: string,
  iterations: number,
): Promise<number[]> {
  const symbolTable = new Map<string, number>([
    ["helper", 1],
    ["target", 2],
  ]);
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    const tree = parser.parse(source);
    if (!tree) throw new Error("parse failed");
    const matches = query.matches(tree.rootNode);
    const callNames: string[] = [];
    for (const match of matches) {
      for (const capture of match.captures) {
        if (capture.name === "rel.call.name") callNames.push(capture.node.text);
      }
    }
    stubResolve(callNames, symbolTable);
    tree.delete();
    const end = process.hrtime.bigint();
    samples.push(Number(end - start) / 1e6);
  }
  return samples;
}

async function main() {
  const results: { lang: Lang; tier: string; stats: Stats; classification: string }[] = [];

  for (const lang of LANGUAGES) {
    const language = await loadLanguage(lang);
    const parser = new Parser();
    parser.setLanguage(language);
    const querySource = readFileSync(resolve(QUERIES, `${lang}.scm`), "utf8");
    const query = new Query(language, querySource);

    for (const [tier, source] of Object.entries(FIXTURES[lang])) {
      const samples = await measureFixture(parser, query, source, 20);
      const stats = computeStats(samples);
      results.push({ lang, tier, stats, classification: classify(stats.p95Ms) });
    }
  }

  const rows = results
    .map(
      (r) =>
        `| ${r.lang} | ${r.tier} | ${r.stats.minMs.toFixed(3)} | ${r.stats.medianMs.toFixed(3)} | ${r.stats.p95Ms.toFixed(3)} | ${r.stats.maxMs.toFixed(3)} | ${r.classification} |`,
    )
    .join("\n");

  const worst = results.reduce((a, b) => (a.stats.p95Ms > b.stats.p95Ms ? a : b));
  const anyUnsafe = results.some((r) => r.classification === "likely unsafe");

  const doc = `# T006 — CPU Feasibility Spike Results

**Generated**: ${new Date().toISOString()}

**IMPORTANT**: All timings below are **local wall-clock measurements** (\`process.hrtime.bigint()\`, this machine, Bun runtime), **not Cloudflare Workers CPU-ms**. They do not prove Cloudflare CPU-budget compliance — they provide a comparative local signal only. Real confirmation requires a separate, later, explicitly-authorized live Cloudflare validation phase.

Each row = 20 iterations of: re-parse one fixture (via \`web-tree-sitter\`, the same grammar Feature 002 uses) → run the relationship \`.scm\` query for that language → a stubbed bounded-lookup resolution step (in-memory \`Map\`, standing in for a real indexed D1 lookup — D1 read latency is I/O-bound and excluded from Cloudflare's own CPU-time definition).

Classification: **comfortably bounded** (p95 < 3ms) / **borderline** (3–8ms) / **likely unsafe** (>8ms).

| Language | Fixture tier | min (ms) | median (ms) | p95 (ms) | max (ms) | Classification |
|---|---|---|---|---|---|---|
${rows}

**Worst-case fixture**: ${worst.lang}/${worst.tier} — p95 ${worst.stats.p95Ms.toFixed(3)}ms, classified **${worst.classification}**.

**Overall go/no-go input**: ${anyUnsafe ? "At least one fixture classified **likely unsafe** — T007 MUST stop the workflow per tasks.md's gating rule." : "No fixture classified likely unsafe. One-file-per-unit granularity (research.md §1) is supported by this local evidence — T007 may proceed."}
`;

  writeFileSync(OUT_FILE, doc);
  console.log(doc);
  console.log(`\nWritten to ${OUT_FILE}`);
  if (anyUnsafe) {
    console.error("\nFEASIBILITY GATE: likely unsafe fixture(s) found. STOP per T007.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
