/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { arg, stats, writeEvidence, HARNESS_VERSION, SCRATCH, REPO_ROOT } from "./lib/common";
import { captureEnvironment } from "./lib/env";
import { loadavg } from "node:os";

/**
 * M-L7 cold start (plan §6 M-L7: "fresh process first-file per language vs warm steady state (E6 method reused)").
 * E6 method (specs/002-…/query-cold-start-results.md §3) re-implemented against the T007 harness pieces; the E6 script itself is NOT run
 * (it overwrites a Feature 002 results file). Modes, each in a FRESH `bun` process: first (10 real files in order), split (first-file
 * line items), init (first vs second-language getParser), warm (100 files cycling a 10-file set).
 * usage (orchestrator): bun m-l7.ts    (worker): bun m-l7.ts --worker <mode> <lang>
 */
type Lang = "java" | "javascript" | "typescript" | "tsx";
const LANGS: Lang[] = ["java", "javascript", "typescript", "tsx"];
const EXT: Record<Lang, string> = { java: ".java", javascript: ".js", typescript: ".ts", tsx: ".tsx" };
const DS = resolve(SCRATCH, "datasets");
const TREE: Record<Lang, string> = {
  java: resolve(DS, "iata-rl/tree"),
  javascript: resolve(DS, "gitnexus-rl/tree"),
  typescript: resolve(DS, "repo-atlas-rm/tree"),
  tsx: resolve(DS, "repo-atlas-rm/tree"),
};
const MIN = 1024, MAX = 16384;

function walk(d: string, out: string[]) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = resolve(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
}
/** Deterministic: sorted real files of the language within 1–16 KiB (excluding .d.ts / .min.js), 10 evenly spaced. */
function fileSet(lang: Lang): { path: string; bytes: number }[] {
  const all: string[] = [];
  walk(TREE[lang], all);
  const c = all
    .filter((p) => p.endsWith(EXT[lang]) && !p.endsWith(".d.ts") && !p.endsWith(".min.js") && !(lang === "typescript" && p.endsWith(".tsx")))
    .filter((p) => { const s = statSync(p).size; return s >= MIN && s <= MAX; })
    .sort();
  if (c.length < 10) throw new Error(`only ${c.length} candidate ${lang} files`);
  return Array.from({ length: 10 }, (_, i) => c[Math.floor((i * c.length) / 10)]!).map((p) => ({ path: p, bytes: statSync(p).size }));
}

// ---------------------------------------------------------------- worker
async function worker(mode: string, lang: Lang) {
  const now = () => Number(process.hrtime.bigint()) / 1e6;
  const files = fileSet(lang).map((f) => ({ name: relative(TREE[lang], f.path), source: readFileSync(f.path, "utf8") }));
  const t0 = now();
  const { installWasm, getParser } = await import("./lib/wasm");
  const { toIntermediateRepresentation } = await import("../../src/lib/code-intel/symbols/to-intermediate-representation");
  const importsMs = now() - t0;
  const q = readFileSync(resolve(REPO_ROOT, `src/lib/code-intel/symbols/queries/${lang}.scm`), "utf8");
  const a0 = now();
  await installWasm(); // local-only: WebAssembly.compile of core + 4 grammars
  const wasmCompileMs = now() - a0;

  if (mode === "init") {
    const primer: Lang = lang === "javascript" ? "java" : "javascript";
    const p0 = now(); await getParser(primer); const firstLangMs = now() - p0;
    const s0 = now(); await getParser(lang); const secondLangMs = now() - s0;
    console.log(JSON.stringify({ importsMs, wasmCompileMs, firstLangMs, secondLangMs, primer }));
    return;
  }
  const b0 = now();
  const parser = await getParser(lang);
  const getParserMs = now() - b0;
  const language = parser.language!;
  if (mode === "split") {
    const { Query } = await import("web-tree-sitter");
    const f = files[0]!;
    const c0 = now(); const tree = parser.parse(f.source)!; const parseMs = now() - c0;
    const d0 = now(); const query = new Query(language, q); const compileMs = now() - d0;
    const e0 = now(); const matches = query.matches(tree.rootNode); const execColdMs = now() - e0;
    const e1 = now(); query.matches(tree.rootNode); const execWarmMs = now() - e1;
    const r0 = now(); const ir = toIntermediateRepresentation(tree, language, q, 1, f.name); const irFirstAfterStandaloneMs = now() - r0;
    const r1 = now(); toIntermediateRepresentation(tree, language, q, 1, f.name); const irWarmMs = now() - r1;
    tree.delete();
    console.log(JSON.stringify({ importsMs, wasmCompileMs, getParserMs, parseMs, compileMs, execColdMs, execWarmMs, irFirstAfterStandaloneMs, irWarmMs, symbols: ir.length, rawMatches: matches.length, file: f.name }));
    return;
  }
  const total = mode === "warm" ? 100 : 10;
  const rows: { parse: number; ir: number; symbols: number }[] = [];
  for (let i = 0; i < total; i++) {
    const f = files[i % files.length]!;
    const p0 = now(); const tree = parser.parse(f.source)!; const parse = now() - p0;
    const r0 = now(); const ir = toIntermediateRepresentation(tree, language, q, 1, f.name); const irMs = now() - r0;
    tree.delete();
    rows.push({ parse, ir: irMs, symbols: ir.length });
  }
  console.log(JSON.stringify({ importsMs, wasmCompileMs, getParserMs, rows }));
}

// ---------------------------------------------------------------- orchestrator
function spawn(mode: string, lang: Lang) {
  const t = performance.now();
  const r = Bun.spawnSync(["bun", "run", import.meta.path, "--worker", mode, lang], { cwd: REPO_ROOT });
  const processWallMs = performance.now() - t;
  if (r.exitCode !== 0) throw new Error(`${mode}/${lang} failed: ${r.stderr.toString()}`);
  const lines = r.stdout.toString().trim().split("\n");
  return { ...JSON.parse(lines[lines.length - 1]!), processWallMs };
}
const S = (a: number[]) => { const s = stats(a); return { n: s.n, min: s.min, median: s.median, p95: s.p95, max: s.max, cv: s.cv }; };

async function main() {
  const R = Number(arg("cold-runs", "20")), W = Number(arg("warm-runs", "3"));
  const env = captureEnvironment();
  const load0 = loadavg().map((x) => Math.round(x * 100) / 100);
  const sets: any = Object.fromEntries(LANGS.map((l) => [l, fileSet(l).map((f) => ({ file: relative(TREE[l], f.path), bytes: f.bytes }))]));
  const raw: Record<string, Record<string, any[]>> = {};
  for (const l of LANGS) raw[l] = { first: [], split: [], init: [], warm: [] };
  // interleave languages and modes per repetition so drift is spread evenly
  for (let rep = 0; rep < R; rep++)
    for (const l of LANGS) for (const m of ["first", "split", "init"]) raw[l]![m]!.push(spawn(m, l));
  for (let rep = 0; rep < W; rep++) for (const l of LANGS) raw[l]!["warm"]!.push(spawn("warm", l));
  const load1 = loadavg().map((x) => Math.round(x * 100) / 100);

  const perLang: any = {};
  for (const l of LANGS) {
    const F = raw[l]!["first"]!, Sp = raw[l]!["split"]!, I = raw[l]!["init"]!, Wm = raw[l]!["warm"]!;
    const pos = (i: number) => ({ parse: S(F.map((r) => r.rows[i].parse)), toIR: S(F.map((r) => r.rows[i].ir)), parsePlusToIR: S(F.map((r) => r.rows[i].parse + r.rows[i].ir)) });
    const per = (r: any) => r.rows.map((x: any) => x.parse + x.ir) as number[];
    const seg = (a: number, b: number) => Wm.flatMap((r) => per(r).slice(a, b));
    perLang[l] = {
      cold: {
        processWallMs_firstMode: S(F.map((r) => r.processWallMs)),
        setup: {
          moduleImportMs: S(F.map((r) => r.importsMs)),
          wasmCompileMs_localOnly: S(F.map((r) => r.wasmCompileMs)),
          getParserFirstCallMs: S(F.map((r) => r.getParserMs)),
        },
        filePosition: { file1: pos(0), file2: pos(1), file3: pos(2), file10: pos(9) },
        firstFileLineItems: {
          file: Sp[0].file, symbols: Sp[0].symbols,
          parseColdMs: S(Sp.map((r) => r.parseMs)), queryCompileColdMs: S(Sp.map((r) => r.compileMs)),
          queryExecColdMs: S(Sp.map((r) => r.execColdMs)), queryExecWarmMs: S(Sp.map((r) => r.execWarmMs)),
          toIRFirstAfterStandaloneMs: S(Sp.map((r) => r.irFirstAfterStandaloneMs)), toIRWarmMs: S(Sp.map((r) => r.irWarmMs)),
          sumGetParserParseCompileExecMs: S(Sp.map((r) => r.getParserMs + r.parseMs + r.compileMs + r.execColdMs)),
        },
        initSplit: {
          primer: I[0].primer, firstGetParserMs: S(I.map((r) => r.firstLangMs)), secondGetParserMs: S(I.map((r) => r.secondLangMs)),
          estCoreInitMs_diffOfMedians: S(I.map((r) => r.firstLangMs)).median - S(I.map((r) => r.secondLangMs)).median,
        },
        processes: { first: F.length, split: Sp.length, init: I.length },
      },
      warm: {
        processes: Wm.length, filesPerProcess: 100,
        file1_coldInWarmProcess: S(Wm.map((r) => per(r)[0]!)),
        files2to10: S(seg(1, 10)), files11to50: S(seg(10, 50)), files51to100: S(seg(50, 100)), files11to100_steadyState: S(seg(10, 100)),
        parseOnly_files11to100: S(Wm.flatMap((r) => r.rows.slice(10).map((x: any) => x.parse))),
        toIROnly_files11to100: S(Wm.flatMap((r) => r.rows.slice(10).map((x: any) => x.ir))),
        totalMs: { first10: S(Wm.map((r) => per(r).slice(0, 10).reduce((a: number, b: number) => a + b, 0))), first100: S(Wm.map((r) => per(r).reduce((a: number, b: number) => a + b, 0))) },
      },
    };
  }
  writeEvidence("m-l7-cold-start.json", {
    measurement: "M-L7 cold start",
    basis: "LOCAL-RUNTIME (WASM Tree-sitter under Bun) + unmodified production getParser / toIntermediateRepresentation; local wall-clock (process.hrtime), NOT native parser",
    harnessVersion: HARNESS_VERSION, environment: env, loadAvg: { start: load0, end: load1 },
    method: "E6 (specs/002-…/query-cold-start-results.md §3) re-implemented in scripts/t007-local/m-l7.ts; E6 script not executed",
    definitions: {
      cold: "fresh `bun` process per measurement: empty module state, cold JIT, no compiled Query cache, no grammar loaded, fresh WASM compile. PROCESS-COLD only; OS page cache NOT dropped (needs privileges) so the WASM/grammar/source files are OS-cache-warm",
      warm: "steady state inside an already-primed process: 100 files cycling a 10-file set; files 11–100 pooled as steady state; 3 independent processes",
      units: "ms; parse = parser.parse(); toIR = production toIntermediateRepresentation (query compile on first call for that language + execution + symbol build); importsMs = dynamic import of harness wasm.ts + toIR module; wasmCompileMs = WebAssembly.compile of core + 4 grammars (local-only, Workers uses build-time modules)",
    },
    config: { coldProcessesPerLangPerMode: R, warmProcessesPerLang: W, modes: ["first (10 files)", "split", "init"], interleaving: "per repetition, languages × modes interleaved; warm runs last", fileSelection: `real files ${MIN}–${MAX} bytes, sorted, 10 evenly spaced; TS/TSX from repo-atlas R-M snapshot copy, JS from GitNexus R-L snapshot copy, Java from iata-one-order R-L snapshot copy (JAXB-generated classes, disclosed limitation; GitNexus has only 9 Java files in range, all tiny test fixtures) (both git-archive scratch copies under .cache/t007-local/datasets; reference repos not touched)`, workers: "single main thread (no worker threads)", database: "none (parse + extraction only)" },
    fileSets: sets, perLanguage: perLang,
  });
  writeEvidence("m-l7-raw.json", raw);
  console.log("done");
}
const argv = process.argv;
if (argv[2] === "--worker") worker(argv[3]!, argv[4] as Lang).catch((e) => { console.error(e); process.exit(1); });
else main().catch((e) => { console.error(e); process.exit(1); });
