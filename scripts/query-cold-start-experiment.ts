#!/usr/bin/env bun
/**
 * LOCAL-ONLY cold-start decomposition of Feature 002 symbol extraction
 * (specs/002-ast-symbol-intelligence/query-cold-start-results.md). Measurement
 * only — no production code changed. Every number is a LOCAL WALL-CLOCK PROXY
 * (process.hrtime.bigint(), this machine, Bun runtime), NOT Cloudflare CPU-ms.
 *
 * Orchestrator mode (default): spawns FRESH `bun` processes per measurement
 * (a fresh process is the closest local analogue of a fresh isolate: empty
 * module state, cold JIT, no compiled Query cache, no loaded grammar).
 * Worker modes (`--worker <mode> <lang>`) run inside one such process:
 *   first  : fresh process, N distinct files in order, per-file parse + real
 *            toIntermediateRepresentation timings (first/second/third/tenth)
 *   split  : fresh process, first-file breakdown: standalone Query compile
 *            vs Query execution vs isolated computeSymbolKey
 *   init   : fresh process, grammar/parser init: first getParser() (core
 *            runtime + language + parser) vs second-language getParser()
 *   warm   : fresh process, 100 files cycling a 10-file set
 *
 * Run: bun run scripts/query-cold-start-experiment.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(import.meta.dir, "..");
type Lang = "java" | "javascript" | "typescript" | "tsx";
const LANGS: Lang[] = ["java", "javascript", "typescript", "tsx"];

function ordinary(lang: Lang, n: number, salt: number): string {
  const h =
    lang === "java"
      ? ["import java.util.List;", `class W${salt} extends Base implements R {`]
      : lang === "javascript"
        ? ["import { Base } from './base.js';", `class W${salt} extends Base {`]
        : ["import { Base } from './base';", `class W${salt} extends Base {`];
  const lines = [...h];
  for (let i = 0; i < n; i++) {
    if (i % 4 === 0) {
      lines.push(
        lang === "java"
          ? `  void m${salt}_${i}() { int x = ${i}; if (x > 0) { helper(); } }`
          : lang === "tsx"
            ? `  m${salt}_${i}() { const x = ${i}; return x > 0 ? <span>{helper()}</span> : null; }`
            : lang === "typescript"
              ? `  m${salt}_${i}(): void { const x = ${i}; if (x > 0) { helper(); } }`
              : `  m${salt}_${i}() { const x = ${i}; if (x > 0) { helper(); } }`,
      );
    } else lines.push(`  // line ${i}`);
  }
  lines.push("}");
  return lines.join("\n") + "\n";
}

const REAL: Record<Lang, string[]> = {
  java: [],
  javascript: ["eslint.config.js"],
  typescript: [
    "src/lib/code-intel/persistence/symbol-d1-client.ts",
    "src/lib/github-fetch.ts",
    "src/lib/code-intel/persistence/d1-client.ts",
    "src/lib/repositories.ts",
    "src/lib/code-intel/providers/github-content-provider.ts",
    "src/lib/code-intel/queue/snapshot-worker.ts",
    "src/lib/code-intel/symbols/symbol-worker.ts",
    "src/lib/code-intel/symbols/extraction-pipeline.ts",
    "src/lib/storage/atlas-store.ts",
    "src/lib/atlas-errors.ts",
  ],
  tsx: [
    "src/routes/catalogue.tsx",
    "src/components/atlas/AtlasScene.tsx",
    "src/components/ui/sidebar.tsx",
    "src/components/ui/sheet.tsx",
    "src/components/ui/command.tsx",
    "src/components/ui/select.tsx",
    "src/components/ui/form.tsx",
    "src/components/ui/calendar.tsx",
    "src/components/ui/carousel.tsx",
    "src/components/atlas/RepositoryPanel.tsx",
  ],
};

function fileSet(lang: Lang): { name: string; source: string }[] {
  const out = REAL[lang].map((p) => ({ name: p, source: readFileSync(resolve(REPO, p), "utf8") }));
  let salt = 0;
  while (out.length < 10) {
    out.push({ name: `synthetic-${lang}-${salt}.src`, source: ordinary(lang, 150 + salt * 40, salt) });
    salt++;
  }
  return out;
}

// ---------------------------------------------------------------- worker side
async function worker(mode: string, lang: Lang) {
  const now = () => Number(process.hrtime.bigint()) / 1e6;
  const t0 = now();
  const { installTestWasmModules } = await import("../tests/support/wasm-test-modules");
  const { getParser } = await import("../src/lib/code-intel/symbols/grammar-provider");
  const { toIntermediateRepresentation } = await import(
    "../src/lib/code-intel/symbols/to-intermediate-representation"
  );
  const importsMs = now() - t0; // module load (parse/eval of our code); Workers pays this at isolate start, build-time bundled

  const q = readFileSync(resolve(REPO, `src/lib/code-intel/symbols/queries/${lang}.scm`), "utf8");

  const a0 = now();
  await installTestWasmModules(); // local-only: WebAssembly.compile of core + 4 grammars (Workers: build-time ?module, not paid at request time)
  const wasmCompileMs = now() - a0;

  if (mode === "init") {
    const primer: Lang = lang === "javascript" ? "java" : "javascript";
    const p0 = now();
    await getParser(primer);
    const firstLangMs = now() - p0; // core Parser.init + primer language load + Parser()
    const s0 = now();
    await getParser(lang);
    const secondLangMs = now() - s0; // target language load + Parser() only
    console.log(JSON.stringify({ importsMs, wasmCompileMs, firstLangMs, secondLangMs, primer }));
    return;
  }

  const b0 = now();
  const parser = await getParser(lang);
  const getParserMs = now() - b0; // core init + language load + parser construct (all, first call)
  const language = parser.language!;
  const files = fileSet(lang);

  if (mode === "split") {
    const { Query } = await import("web-tree-sitter");
    const { computeSymbolKey } = await import("../src/lib/code-intel/symbols/symbol-identity");
    const f = files[0]!;
    const c0 = now();
    const tree = parser.parse(f.source)!;
    const parseMs = now() - c0;
    const d0 = now();
    const query = new Query(language, q); // standalone cold compile
    const compileMs = now() - d0;
    const e0 = now();
    const matches = query.matches(tree.rootNode);
    const execColdMs = now() - e0;
    const e1 = now();
    query.matches(tree.rootNode);
    const execWarmMs = now() - e1;
    // real production call, first time (its own cache is empty -> compiles again, but engine now warm)
    const r0 = now();
    const ir = toIntermediateRepresentation(tree, language, q, 1, f.name);
    const irFirstAfterStandaloneMs = now() - r0;
    const r1 = now();
    toIntermediateRepresentation(tree, language, q, 1, f.name);
    const irWarmMs = now() - r1;
    const g0 = now();
    computeSymbolKey(1, f.name, "method", "x", 1, 1);
    const hashFirstCallMs = now() - g0;
    const g1 = now();
    for (let i = 0; i < ir.length; i++) computeSymbolKey(1, f.name, "method", `m${i}`, i, 1);
    const hashAllMs = now() - g1;
    tree.delete();
    console.log(
      JSON.stringify({
        importsMs, wasmCompileMs, getParserMs, parseMs, compileMs, execColdMs, execWarmMs,
        irFirstAfterStandaloneMs, irWarmMs, hashFirstCallMs, hashAllMs,
        symbols: ir.length, rawMatches: matches.length, file: f.name,
      }),
    );
    return;
  }

  // first / warm: real production toIntermediateRepresentation, per-file timings
  const total = mode === "warm" ? 100 : 10;
  const rows: { parse: number; ir: number; symbols: number }[] = [];
  for (let i = 0; i < total; i++) {
    const f = files[i % files.length]!;
    const p0 = now();
    const tree = parser.parse(f.source)!;
    const parse = now() - p0;
    const r0 = now();
    const ir = toIntermediateRepresentation(tree, language, q, 1, f.name);
    const irMs = now() - r0;
    tree.delete();
    rows.push({ parse, ir: irMs, symbols: ir.length });
  }
  console.log(JSON.stringify({ importsMs, wasmCompileMs, getParserMs, rows }));
}

// ---------------------------------------------------------------- orchestrator
function spawn(mode: string, lang: Lang): any {
  const r = Bun.spawnSync(["bun", "run", import.meta.path, "--worker", mode, lang], { cwd: REPO });
  if (r.exitCode !== 0) throw new Error(`${mode}/${lang} failed: ${r.stderr.toString()}`);
  const lines = r.stdout.toString().trim().split("\n");
  return JSON.parse(lines[lines.length - 1]!);
}
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
const p95 = (a: number[]) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * 0.95))]!;
const mn = (a: number[]) => Math.min(...a);
const mx = (a: number[]) => Math.max(...a);
const f3 = (n: number) => n.toFixed(3);
const stat = (a: number[]) => `${f3(med(a))} (min ${f3(mn(a))} / p95 ${f3(p95(a))} / max ${f3(mx(a))})`;

async function main() {
  const R = 10;
  const md: string[] = [];
  md.push("## Data (generated by scripts/query-cold-start-experiment.ts)\n");
  md.push(
    `Each cold measurement = ${R} independent FRESH \`bun\` processes (fresh process ≈ fresh isolate: empty module state, cold JIT, empty Query cache, no grammar loaded). Values are median (min / p95 / max) across those ${R} processes, in ms. LOCAL WALL-CLOCK PROXY, not Cloudflare CPU-ms. "local-only" rows have no Workers equivalent at request time.\n`,
  );

  const firsts: Record<string, any[]> = {}, splits: Record<string, any[]> = {}, inits: Record<string, any[]> = {}, warms: Record<string, any[]> = {};
  for (const lang of LANGS) {
    firsts[lang] = Array.from({ length: R }, () => spawn("first", lang));
    splits[lang] = Array.from({ length: R }, () => spawn("split", lang));
    inits[lang] = Array.from({ length: R }, () => spawn("init", lang));
    warms[lang] = Array.from({ length: 3 }, () => spawn("warm", lang));
    console.error(`done ${lang}`);
  }

  md.push("### 1. Fresh process — per-file cost by file position (parse + real `toIntermediateRepresentation`, ms)\n");
  md.push("| lang | file # | parse | toIR (symbol extraction incl. Query compile on #1, execution, hashing) | parse+toIR |");
  md.push("|---|---|---|---|---|");
  for (const lang of LANGS) {
    for (const idx of [0, 1, 2, 9]) {
      const parse = firsts[lang]!.map((r) => r.rows[idx].parse);
      const ir = firsts[lang]!.map((r) => r.rows[idx].ir);
      const tot = firsts[lang]!.map((r) => r.rows[idx].parse + r.rows[idx].ir);
      md.push(`| ${lang} | ${idx + 1} | ${stat(parse)} | ${stat(ir)} | ${stat(tot)} |`);
    }
  }
  md.push("");

  md.push("### 2. Fresh process — one-time per-process / per-language setup before the first file (ms)\n");
  md.push("| lang | module import (our code) | WASM compile (local-only) | getParser first call (core init + language load + Parser()) |");
  md.push("|---|---|---|---|");
  for (const lang of LANGS) {
    md.push(`| ${lang} | ${stat(firsts[lang]!.map((r) => r.importsMs))} | ${stat(firsts[lang]!.map((r) => r.wasmCompileMs))} | ${stat(firsts[lang]!.map((r) => r.getParserMs))} |`);
  }
  md.push("");

  md.push("### 3. Grammar/parser init split (production `getParser`, primer language first, then target language, ms)\n");
  md.push("| target lang | primer | 1st getParser (core init + primer lang + Parser) | 2nd getParser (target lang load + Parser only) | est. core runtime init (1st − 2nd) |");
  md.push("|---|---|---|---|---|");
  for (const lang of LANGS) {
    const a = inits[lang]!.map((r) => r.firstLangMs), b = inits[lang]!.map((r) => r.secondLangMs);
    md.push(`| ${lang} | ${inits[lang]![0].primer} | ${stat(a)} | ${stat(b)} | ${f3(med(a) - med(b))} (difference of medians; primer/target grammars differ in size, so this is an estimate) |`);
  }
  md.push("");

  md.push("### 4. First-file breakdown (fresh process, first file only, ms)\n");
  md.push("| lang | file | parse (cold) | Query compile (cold, standalone) | Query exec (cold) | Query exec (warm) | toIR 1st call after standalone compile | toIR warm | computeSymbolKey 1st call | computeSymbolKey ×N total | symbols |");
  md.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const lang of LANGS) {
    const s = splits[lang]!;
    md.push(`| ${lang} | ${s[0].file} | ${stat(s.map((r) => r.parseMs))} | ${stat(s.map((r) => r.compileMs))} | ${stat(s.map((r) => r.execColdMs))} | ${stat(s.map((r) => r.execWarmMs))} | ${stat(s.map((r) => r.irFirstAfterStandaloneMs))} | ${stat(s.map((r) => r.irWarmMs))} | ${stat(s.map((r) => r.hashFirstCallMs))} | ${stat(s.map((r) => r.hashAllMs))} | ${s[0].symbols} |`);
  }
  md.push("");
  md.push("Derived warm symbol-processing (toIR warm − Query exec warm − hashing ×N) is small residual; see per-file toIR warm above.\n");

  md.push("### 5. Warm process — per-file cost over 100 files (10-file set cycled; 3 independent processes pooled, ms)\n");
  md.push("| lang | file #1 (cold) | files 2-10 median | files 11-50 median / p95 | files 51-100 median / p95 | total time, 10 files | total, 50 files | total, 100 files |");
  md.push("|---|---|---|---|---|---|---|---|");
  for (const lang of LANGS) {
    const runs = warms[lang]!;
    const per = (r: any) => r.rows.map((x: any) => x.parse + x.ir) as number[];
    const first = runs.map((r) => per(r)[0]!);
    const seg = (a: number, b: number) => runs.flatMap((r) => per(r).slice(a, b));
    const tot = (n: number) => runs.map((r) => per(r).slice(0, n).reduce((x: number, y: number) => x + y, 0));
    md.push(`| ${lang} | ${stat(first)} | ${f3(med(seg(1, 10)))} | ${f3(med(seg(10, 50)))} / ${f3(p95(seg(10, 50)))} | ${f3(med(seg(50, 100)))} / ${f3(p95(seg(50, 100)))} | ${f3(med(tot(10)))} | ${f3(med(tot(50)))} | ${f3(med(tot(100)))} |`);
  }
  md.push("");

  writeFileSync(resolve(REPO, "specs/002-ast-symbol-intelligence/query-cold-start-results.md"), md.join("\n"));
  console.log(md.join("\n"));
}

const argv = process.argv;
if (argv[2] === "--worker") {
  worker(argv[3]!, argv[4] as Lang).catch((e) => { console.error(e); process.exit(1); });
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}
