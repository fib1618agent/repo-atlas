#!/usr/bin/env bun
/**
 * CPU decomposition investigation (LOCAL-ONLY, informational — not T006/T007
 * itself, does not overwrite feasibility-results.md).
 *
 * Purpose: T006's spike measured combined parse+query+resolution cost per
 * fixture tier and found large (~2000-line) fixtures classify "likely
 * unsafe" (p95 9.7-12.2ms) across all four Tier-1 languages. Before any
 * architecture decision (file-size ceiling / chunking / family-splitting),
 * this script isolates WHERE that cost comes from: parse vs. query
 * (per relationship-family) vs. resolution — across a size sweep, not just
 * three tiers.
 *
 * Every number is a LOCAL WALL-CLOCK PROXY (process.hrtime.bigint(), this
 * machine, Bun runtime), NOT a Cloudflare Workers CPU-ms measurement. Does
 * not prove Cloudflare CPU-budget compliance.
 *
 * Not part of the app bundle. Run: bun run scripts/relationship-cpu-decomposition.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Language, Parser, Query } from "web-tree-sitter";

const ROOT = resolve(import.meta.dir, "../node_modules");
const PUBLIC_WASM = resolve(import.meta.dir, "../public/wasm");
const OUT_FILE = resolve(
  import.meta.dir,
  "../specs/004-engineering-relationship-graph/cpu-decomposition-results.md",
);

type Lang = "java" | "javascript" | "typescript" | "tsx";
const LANGUAGES: Lang[] = ["java", "javascript", "typescript", "tsx"];
const SIZES = [500, 750, 1000, 1250, 1500, 1750, 2000, 2500];
const ITERATIONS = 20;

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
  return Language.load(new Uint8Array(readFileSync(resolve(PUBLIC_WASM, `tree-sitter-${lang}.wasm`))));
}

// ---------------------------------------------------------------------------
// Fixture generation — single-line-method, 3-calls-per-method shape (same
// worst-case shape as T006's "large" tier), parameterized by target line
// count so the sweep is continuous, not three fixed tiers.
// ---------------------------------------------------------------------------

function javaFixture(n: number): string {
  const header = "import java.util.List;\nimport java.util.Map;\nclass Widget extends BaseWidget implements Renderable {\n";
  const body = Array.from(
    { length: n },
    (_, i) => `  void method${i}() { helper(); other${i % 3}(); System.out.println(${i}); }`,
  ).join("\n");
  return header + body + "\n}\n";
}
function jsFixture(n: number): string {
  const header = "import { Base } from './base.js';\nclass Widget extends Base {\n";
  const body = Array.from(
    { length: n },
    (_, i) => `  method${i}() { helper(); other${i % 3}(); console.log(${i}); }`,
  ).join("\n");
  return header + body + "\n}\nfunction helper() { return 1; }\n";
}
function tsFixture(n: number): string {
  const header = "import { Base } from './base';\ninterface Renderable { render(): void; }\nclass Widget extends Base implements Renderable {\n  render(): void {}\n";
  const body = Array.from(
    { length: n },
    (_, i) => `  method${i}(): void { helper(); other${i % 3}(); console.log(${i}); }`,
  ).join("\n");
  return header + body + "\n}\nfunction helper(): void {}\n";
}
function tsxFixture(n: number): string {
  const header = "import { Base } from './base';\nclass Widget extends Base {\n";
  const body = Array.from(
    { length: n },
    (_, i) => `  method${i}() { return <span>{helper()}{other${i % 3}()}{console.log(${i})}</span>; }`,
  ).join("\n");
  return header + body + "\n}\nfunction helper() { return 1; }\n";
}
const FIXTURE_GEN: Record<Lang, (n: number) => string> = {
  java: javaFixture,
  javascript: jsFixture,
  typescript: tsFixture,
  tsx: tsxFixture,
};

// ---------------------------------------------------------------------------
// Per-family query fragments (subsets of the real relationships/queries/*.scm
// files), to isolate cost by relationship family. CONTAINS and EXPORTS are
// D1-only (never parsed/queried) — excluded here by design, not oversight.
// USES/REFERENCES have no dedicated .scm captures yet (not implemented past
// T007's gate) — excluded, noted in the report, not fabricated.
// ---------------------------------------------------------------------------

const FAMILY_QUERIES: Record<Lang, Record<string, string>> = {
  java: {
    imports: `(import_declaration (scoped_identifier) @rel.import.path) @rel.import`,
    extends: `(class_declaration name: (identifier) @rel.subject.name superclass: (superclass (type_identifier) @rel.extends.name)) @rel.extends
(interface_declaration name: (identifier) @rel.subject.name (extends_interfaces (type_list (type_identifier) @rel.extends.name))) @rel.extends`,
    implements: `(class_declaration name: (identifier) @rel.subject.name interfaces: (super_interfaces (type_list (type_identifier) @rel.implements.name))) @rel.implements`,
    calls: `(method_invocation name: (identifier) @rel.call.name) @rel.call`,
  },
  javascript: {
    imports: `(import_statement source: (string (string_fragment) @rel.import.path)) @rel.import`,
    extends: `(class_declaration name: (identifier) @rel.subject.name (class_heritage (identifier) @rel.extends.name)) @rel.extends`,
    implements: ``,
    calls: `(call_expression function: (identifier) @rel.call.name) @rel.call
(call_expression function: (member_expression property: (property_identifier) @rel.call.name)) @rel.call`,
  },
  typescript: {
    imports: `(import_statement source: (string (string_fragment) @rel.import.path)) @rel.import`,
    extends: `(class_declaration name: (type_identifier) @rel.subject.name (class_heritage (extends_clause value: (identifier) @rel.extends.name))) @rel.extends
(interface_declaration name: (type_identifier) @rel.subject.name (extends_type_clause (type_identifier) @rel.extends.name)) @rel.extends`,
    implements: `(class_declaration name: (type_identifier) @rel.subject.name (class_heritage (implements_clause (type_identifier) @rel.implements.name))) @rel.implements`,
    calls: `(call_expression function: (identifier) @rel.call.name) @rel.call
(call_expression function: (member_expression property: (property_identifier) @rel.call.name)) @rel.call`,
  },
  tsx: {
    imports: `(import_statement source: (string (string_fragment) @rel.import.path)) @rel.import`,
    extends: `(class_declaration name: (type_identifier) @rel.subject.name (class_heritage (extends_clause value: (identifier) @rel.extends.name))) @rel.extends
(interface_declaration name: (type_identifier) @rel.subject.name (extends_type_clause (type_identifier) @rel.extends.name)) @rel.extends`,
    implements: `(class_declaration name: (type_identifier) @rel.subject.name (class_heritage (implements_clause (type_identifier) @rel.implements.name))) @rel.implements`,
    calls: `(call_expression function: (identifier) @rel.call.name) @rel.call
(call_expression function: (member_expression property: (property_identifier) @rel.call.name)) @rel.call`,
  },
};

const FAMILIES = ["imports", "extends", "implements", "calls"] as const;

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
type Stats = { minMs: number; medianMs: number; p95Ms: number; maxMs: number };
function computeStats(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
  return { minMs: sorted[0]!, medianMs: pick(0.5), p95Ms: pick(0.95), maxMs: sorted[sorted.length - 1]! };
}
function fmt(s: Stats): string {
  return `min ${s.minMs.toFixed(3)} / median ${s.medianMs.toFixed(3)} / p95 ${s.p95Ms.toFixed(3)} / max ${s.maxMs.toFixed(3)}`;
}

function stubResolve(names: string[], table: Map<string, number[]>): { resolved: number; ambiguous: number; unknown: number } {
  let resolved = 0, ambiguous = 0, unknown = 0;
  for (const name of names) {
    const candidates = table.get(name);
    if (!candidates || candidates.length === 0) unknown++;
    else if (candidates.length === 1) resolved++;
    else ambiguous++;
  }
  return { resolved, ambiguous, unknown };
}

// ---------------------------------------------------------------------------
// Main measurement: for each (lang, size), one parsed tree per iteration,
// timed in phases: parse | per-family query | combined query | resolution.
// ---------------------------------------------------------------------------

type Row = {
  lang: Lang;
  lines: number;
  parse: Stats;
  families: Record<string, Stats>;
  combinedQuery: Stats;
  resolution: Stats;
  parseAndQuery: Stats; // "complete extraction excluding persistence"
  complete: Stats; // "complete local processing" (== parseAndQuery+resolution; no persistence measured locally)
};

async function measure(lang: Lang, lines: number): Promise<Row> {
  const language = await loadLanguage(lang);
  const parser = new Parser();
  parser.setLanguage(language);

  const familyQueryObjs: Record<string, Query | null> = {};
  for (const fam of FAMILIES) {
    const src = FAMILY_QUERIES[lang][fam];
    familyQueryObjs[fam] = src && src.trim() ? new Query(language, src) : null;
  }
  const combinedSrc = FAMILIES.map((f) => FAMILY_QUERIES[lang][f]).filter((s) => s.trim()).join("\n");
  const combinedQuery = new Query(language, combinedSrc);

  const source = FIXTURE_GEN[lang](lines);
  const symbolTable = new Map<string, number[]>([
    ["helper", [1]],
    ["other0", [10]],
    ["other1", [11]],
    ["other2", [12]],
    // deliberately ambiguous: two candidates
    ["console.log", [20, 21]],
  ]);

  const parseSamples: number[] = [];
  const familySamples: Record<string, number[]> = Object.fromEntries(FAMILIES.map((f) => [f, []]));
  const combinedSamples: number[] = [];
  const resolutionSamples: number[] = [];
  const parseAndQuerySamples: number[] = [];
  const completeSamples: number[] = [];

  // Discard warmup iterations (JIT/cache warmup noise, not representative of
  // either cold or steady-state isolate CPU cost) — steady-state numbers
  // below are the useful comparative signal; cold-start risk is a separate,
  // known-but-unmeasured tail concern noted in the report.
  const WARMUP = 5;
  for (let i = 0; i < WARMUP; i++) {
    const tree = parser.parse(source);
    if (tree) {
      combinedQuery.matches(tree.rootNode);
      tree.delete();
    }
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = process.hrtime.bigint();
    const tree = parser.parse(source);
    if (!tree) throw new Error(`parse failed: ${lang}/${lines}`);
    const t1 = process.hrtime.bigint();
    parseSamples.push(Number(t1 - t0) / 1e6);

    // Real pipeline shape: parse -> ONE combined query -> resolution.
    // (The per-family breakdown below is a separate diagnostic measurement,
    // run against the same tree AFTER the real-pipeline timing is captured,
    // so it never pollutes the parse+query/complete numbers.)
    const cs = process.hrtime.bigint();
    const matches = combinedQuery.matches(tree.rootNode);
    const callNames: string[] = [];
    for (const m of matches) for (const c of m.captures) if (c.name === "rel.call.name") callNames.push(c.node.text);
    const ce = process.hrtime.bigint();
    combinedSamples.push(Number(ce - cs) / 1e6);
    parseAndQuerySamples.push(Number(ce - t0) / 1e6);

    const rs = process.hrtime.bigint();
    stubResolve(callNames, symbolTable);
    const re = process.hrtime.bigint();
    resolutionSamples.push(Number(re - rs) / 1e6);
    completeSamples.push(Number(re - t0) / 1e6);

    // Diagnostic-only: per-family query cost in isolation, same tree, timed
    // separately from the real-pipeline numbers above.
    for (const fam of FAMILIES) {
      const q = familyQueryObjs[fam];
      const fs = process.hrtime.bigint();
      if (q) q.matches(tree.rootNode);
      const fe = process.hrtime.bigint();
      familySamples[fam]!.push(Number(fe - fs) / 1e6);
    }

    tree.delete();
  }

  return {
    lang,
    lines,
    parse: computeStats(parseSamples),
    families: Object.fromEntries(FAMILIES.map((f) => [f, computeStats(familySamples[f]!)])),
    combinedQuery: computeStats(combinedSamples),
    resolution: computeStats(resolutionSamples),
    parseAndQuery: computeStats(parseAndQuerySamples),
    complete: computeStats(completeSamples),
  };
}

async function main() {
  const rows: Row[] = [];
  for (const lang of LANGUAGES) {
    for (const lines of SIZES) {
      rows.push(await measure(lang, lines));
    }
  }

  const lines: string[] = [];
  lines.push("# CPU Decomposition Investigation — supplement to T006/T007");
  lines.push("");
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(
    "**LOCAL WALL-CLOCK PROXY ONLY** (`process.hrtime.bigint()`, this machine, Bun runtime). Not Cloudflare Workers CPU-ms. Does not prove Cloudflare CPU-budget compliance. Informational supplement to T006 — does not modify `feasibility-results.md` or the T007 STOP decision.",
  );
  lines.push("");
  lines.push(
    "CONTAINS and EXPORTS excluded from parse/query measurement by design (both D1-only derivations, zero parse cost — research.md §4 and the EXPORTS 2026-09-22 correction). USES/REFERENCES have no dedicated `.scm` captures yet (implementation has not proceeded past T007's gate) — not measured in isolation here.",
  );
  lines.push("");
  lines.push(
    "**Column semantics**: `parse+query` and `complete` reflect the REAL single-invocation pipeline shape — one parse, one combined query (all families run together in one `Query.matches()` call, exactly what the real `.scm` files do), one resolution pass. The per-family columns (imports/extends/implements/calls) are a SEPARATE diagnostic measurement — each family's query re-run in isolation against the same already-parsed tree, timed after the real-pipeline numbers are captured, purely to attribute query cost across families. Family costs are not additive into `parse+query`/`complete` (running 4 isolated queries costs more than 1 combined query over the same patterns, due to per-call overhead) — use them only for relative attribution, not as a second route to the pipeline total.",
  );
  lines.push("");
  lines.push(
    "**Warmup**: 5 untimed parse+query iterations discarded before the 20 timed iterations per fixture, to remove JIT/module-cache warmup noise from the first call. These are STEADY-STATE numbers (repeated invocations of the same parser/query object) — a genuinely cold Worker isolate's first invocation could run slower than steady-state; that cold-start tail is a separate, real, unmeasured risk this script does not quantify.",
  );
  lines.push("");
  lines.push("## Per-language, per-size decomposition (20 iterations each; all times ms)");
  lines.push("");
  for (const lang of LANGUAGES) {
    lines.push(`### ${lang}`);
    lines.push("");
    lines.push(
      "| lines | parse (p95) | imports (p95) | extends (p95) | implements (p95) | calls (p95) | combined query (p95) | resolution (p95) | parse+query (p95) | complete (p95) |",
    );
    lines.push("|---|---|---|---|---|---|---|---|---|---|");
    for (const r of rows.filter((r) => r.lang === lang)) {
      lines.push(
        `| ${r.lines} | ${r.parse.p95Ms.toFixed(3)} | ${r.families.imports!.p95Ms.toFixed(3)} | ${r.families.extends!.p95Ms.toFixed(3)} | ${r.families.implements!.p95Ms.toFixed(3)} | ${r.families.calls!.p95Ms.toFixed(3)} | ${r.combinedQuery.p95Ms.toFixed(3)} | ${r.resolution.p95Ms.toFixed(3)} | ${r.parseAndQuery.p95Ms.toFixed(3)} | ${r.complete.p95Ms.toFixed(3)} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Full stats (min/median/p95/max) — complete pipeline only, all lang/size cells");
  lines.push("");
  lines.push("| lang | lines | parse | combined query | resolution | complete |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(
      `| ${r.lang} | ${r.lines} | ${fmt(r.parse)} | ${fmt(r.combinedQuery)} | ${fmt(r.resolution)} | ${fmt(r.complete)} |`,
    );
  }
  lines.push("");

  // Bottleneck attribution: for the largest size, what fraction of "complete" is parse vs query vs resolution?
  lines.push("## Bottleneck attribution at largest measured size (2500 lines)");
  lines.push("");
  lines.push("| lang | parse % of complete | query % of complete | resolution % of complete |");
  lines.push("|---|---|---|---|");
  for (const lang of LANGUAGES) {
    const r = rows.find((r) => r.lang === lang && r.lines === 2500)!;
    const total = r.complete.medianMs || 1;
    const parsePct = (r.parse.medianMs / total) * 100;
    const queryPct = (r.combinedQuery.medianMs / total) * 100;
    const resPct = (r.resolution.medianMs / total) * 100;
    lines.push(`| ${lang} | ${parsePct.toFixed(1)}% | ${queryPct.toFixed(1)}% | ${resPct.toFixed(1)}% |`);
  }
  lines.push("");

  writeFileSync(OUT_FILE, lines.join("\n"));
  console.log(lines.join("\n"));
  console.log(`\nWritten to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
