#!/usr/bin/env bun
/**
 * Calibration check: the decomposition sweep (relationship-cpu-decomposition.ts)
 * uses a deliberately dense synthetic fixture (3 relationship-bearing calls
 * per line) to get a clean, continuous worst-case size sweep. This script
 * measures the SAME parse+query+resolution pipeline against real local
 * TypeScript/TSX source files from this repo (the only real Tier-1 source
 * available locally) to check whether real-world relationship density is
 * anywhere near that synthetic worst case, or much sparser.
 *
 * LOCAL WALL-CLOCK PROXY ONLY. Not Cloudflare CPU-ms.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Language, Parser, Query } from "web-tree-sitter";

const ROOT = resolve(import.meta.dir, "../node_modules");
const PUBLIC_WASM = resolve(import.meta.dir, "../public/wasm");

let parserInitialized = false;
async function ensureParserInit(): Promise<void> {
  if (parserInitialized) return;
  const coreBytes = readFileSync(resolve(ROOT, "web-tree-sitter/tree-sitter.wasm"));
  const coreModule = await WebAssembly.compile(coreBytes);
  await Parser.init({
    instantiateWasm(imports: WebAssembly.Imports, cb: (i: WebAssembly.Instance, m: WebAssembly.Module) => void) {
      WebAssembly.instantiate(coreModule, imports).then((instance) => cb(instance, coreModule));
      return {};
    },
  } as Parameters<typeof Parser.init>[0]);
  parserInitialized = true;
}

const TSX_QUERY = `
(import_statement source: (string (string_fragment) @rel.import.path)) @rel.import
(class_declaration name: (type_identifier) @rel.subject.name (class_heritage (extends_clause value: (identifier) @rel.extends.name))) @rel.extends
(class_declaration name: (type_identifier) @rel.subject.name (class_heritage (implements_clause (type_identifier) @rel.implements.name))) @rel.implements
(interface_declaration name: (type_identifier) @rel.subject.name (extends_type_clause (type_identifier) @rel.extends.name)) @rel.extends
(call_expression function: (identifier) @rel.call.name) @rel.call
(call_expression function: (member_expression property: (property_identifier) @rel.call.name)) @rel.call
`;

const FILES = [
  "src/routes/catalogue.tsx", // 373 lines, ~p95
  "src/components/atlas/AtlasScene.tsx", // 636 lines, ~p99
  "src/components/ui/sidebar.tsx", // 744 lines, max
];

async function main() {
  await ensureParserInit();
  const language = await Language.load(
    new Uint8Array(readFileSync(resolve(PUBLIC_WASM, "tree-sitter-tsx.wasm"))),
  );
  const parser = new Parser();
  parser.setLanguage(language);
  const query = new Query(language, TSX_QUERY);

  console.log("| file | lines | median parse+query (ms, 20 iter, 5 warmup) | relationship-bearing matches |");
  console.log("|---|---|---|---|");
  for (const rel of FILES) {
    const abs = resolve(import.meta.dir, "..", rel);
    const source = readFileSync(abs, "utf8");
    const lines = source.split("\n").length;

    for (let i = 0; i < 5; i++) {
      const t = parser.parse(source);
      if (t) { query.matches(t.rootNode); t.delete(); }
    }
    const samples: number[] = [];
    let matchCount = 0;
    for (let i = 0; i < 20; i++) {
      const start = process.hrtime.bigint();
      const tree = parser.parse(source);
      if (!tree) throw new Error("parse failed");
      const matches = query.matches(tree.rootNode);
      matchCount = matches.length;
      tree.delete();
      const end = process.hrtime.bigint();
      samples.push(Number(end - start) / 1e6);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)]!;
    console.log(`| ${rel} | ${lines} | ${median.toFixed(3)} | ${matchCount} |`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
