/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { toIntermediateRepresentation } from "../../src/lib/code-intel/symbols/to-intermediate-representation";
import { detectLanguage } from "../../src/lib/code-intel/symbols/language-detector";
import { setTestCloudflareEnv } from "../../src/lib/code-intel/persistence/cloudflare-env";
import {
  hashContent,
  deriveR2Key,
} from "../../src/lib/code-intel/acquisition/content-address";
import { toCommitSha } from "../../src/lib/code-intel/domain/repository-identity";
import { getParser, installWasm } from "./lib/wasm";
import { createScratchDb } from "./lib/db";
import { createFsR2 } from "./lib/fsr2";
import { newUnitCtx, runUnit } from "./lib/unit";
import { KIND_ORDER, type Job } from "./lib/jobs";
import { BLOBS } from "./lib/datasets";
import {
  SCRATCH,
  arg,
  ensureDir,
  startMemSampler,
  stats,
  writeEvidence,
} from "./lib/common";
import { checkInvariants } from "./lib/graph";

/**
 * M-L1 (parse → AST → symbols, in-process, no DB) + M-L2 (full per-file pipeline with phase attribution through the real units) for ONE fixture
 * file in a fresh process (clean RSS baseline). usage: bun m-l12-child.ts --file <path> --id <fixtureId> --out <json> [--budget-s 120]
 * Iterations: 20 when affordable; otherwise as many as fit the per-stage budget (min 3) and the result is flagged INSUFFICIENT_N (no p95 reported).
 */
process.env["T7_TRACE_RESOLVE"] = "1";
const file = arg("file")!,
  id = arg("id")!,
  out = arg("out")!,
  budgetMs = Number(arg("budget-s", "120")) * 1000;
const hb = `${out}.phase`;
const partial = (r: unknown) =>
  writeFileSync(`${out}.partial`, JSON.stringify(r));
const beat = (phase: string, iter = 0) =>
  writeFileSync(hb, JSON.stringify({ phase, iter, at: Date.now() }));
const lang = detectLanguage(file)!;
const text = readFileSync(file, "utf8");
const bytes = new TextEncoder().encode(text);
const lines = text.split("\n").length;
await installWasm();
setTestCloudflareEnv({ SNAPSHOTS: createFsR2(BLOBS) });
const parser = await getParser(lang);
const querySrc = readFileSync(
  resolve(
    import.meta.dir,
    `../../src/lib/code-intel/symbols/queries/${lang}.scm`,
  ),
  "utf8",
);
const sampler = startMemSampler(20);
const rssBase = process.memoryUsage().rss;
const nIters = (firstMs: number) =>
  Math.max(3, Math.min(20, Math.floor(budgetMs / Math.max(firstMs, 1))));
const summ = (xs: number[]) => {
  const s = stats(xs);
  return {
    n: s.n,
    min: s.min,
    median: s.median,
    max: s.max,
    ...(s.n >= 20 ? { p95: s.p95 } : {}),
    insufficientN: s.n < 20,
  };
};
const result: any = {
  id,
  file: file.replace(/^.*\/\.cache\//, ".cache/"),
  lang,
  bytes: bytes.length,
  lines,
  budgetMs,
};

// ------------------------------------------------------------------ M-L1
{
  beat("m-l1:cold-first-parse");
  let t = performance.now();
  const tree0 = parser.parse(text)!;
  const coldFirstParseMs = performance.now() - t;
  const nodes = tree0.rootNode.descendantCount,
    hasError = tree0.rootNode.hasError;
  tree0.delete();
  const parse: number[] = [],
    ir: number[] = [];
  let symbolsN = 0,
    first = 0;
  for (let i = 0; ; i++) {
    beat("m-l1:parse+symbols", i);
    t = performance.now();
    const tree = parser.parse(text)!;
    const pm = performance.now() - t;
    t = performance.now();
    const syms = toIntermediateRepresentation(
      tree,
      parser.language!,
      querySrc,
      1,
      file,
    );
    const im = performance.now() - t;
    tree.delete();
    parse.push(pm);
    ir.push(im);
    symbolsN = syms.length;
    if (i === 0) first = pm + im;
    if (parse.length >= nIters(first)) break;
  }
  result.mL1 = {
    coldFirstParseMs,
    astNodes: nodes,
    nodesPerLine: nodes / lines,
    nodesPerByte: nodes / bytes.length,
    hasError,
    symbols: symbolsN,
    parseMs: summ(parse),
    symbolsIrMs: summ(ir),
    nodesPerMsMedian: nodes / stats(parse).median,
  };
  partial(result);
}

// ------------------------------------------------------------------ M-L2 (real units, one-file snapshot)
{
  const dbPath = resolve(SCRATCH, "m-l12", `${id}.db`);
  ensureDir(resolve(SCRATCH, "m-l12"));
  for (const suf of ["", "-wal", "-shm"]) rmSync(dbPath + suf, { force: true });
  const db = createScratchDb(dbPath);
  const hash = await hashContent(bytes);
  writeFileSync(resolve(BLOBS, hash), bytes);
  const nowIso = new Date().toISOString();
  db.query(
    "INSERT INTO repositories (provider, owner, name, created_at) VALUES ('github','local','m-l12',?)",
  ).run(nowIso);
  const sha = "0".repeat(39) + "2";
  const sid = Number(
    db
      .query(
        "INSERT INTO snapshots (repository_id, commit_sha, attempt_number, status, acquisition_mode, created_at, completed_at) VALUES (1,?,1,'completed','bulk_archive',?,?)",
      )
      .run(sha, nowIso, nowIso).lastInsertRowid,
  );
  const rel = `src/${id}.${file.split(".").pop()}`;
  db.query(
    "INSERT INTO snapshot_files (snapshot_id, path, size_bytes, content_hash, r2_key) VALUES (?,?,?,?,?)",
  ).run(
    sid,
    rel,
    bytes.length,
    hash,
    deriveR2Key(
      { provider: "github", owner: "local", name: "m-l12" },
      toCommitSha(sha),
      hash,
    ),
  );
  const ctx = newUnitCtx(db, sid, BLOBS, {}, 3);
  ctx.inline = true;
  const mk = (kind: string, ref: string): Job => ({
    id: 0,
    snapshot_id: sid,
    kind,
    kind_order: KIND_ORDER[kind]!,
    unit_ref: ref,
    state: "RUNNING",
    attempts: 0,
    reclaims: 0,
    checkpoint: null,
    claimed_by: null,
    claimed_at: null,
    error: null,
  });
  const stages: any = {};
  for (const [kind, ref] of [
    ["symbols", "1"],
    ["contains", "*dirs"],
    ["contains", "1"],
    ["parsed", "1"],
  ] as [string, string][]) {
    partial({ ...result, mL2: { stages } });
    const name = ref === "*dirs" ? "contains-dirs" : kind;
    const walls: number[] = [],
      cpu: number[] = [],
      phases: Record<string, number[]> = {},
      counts: Record<string, number> = {};
    const states: string[] = [];
    for (let i = 0; ; i++) {
      ctx.onPhase = (p) => beat(`m-l2:${p}`, i);
      beat(`m-l2:${name}:start`, i);
      const c0 = process.cpuUsage(),
        t = performance.now();
      const o = await runUnit(ctx, mk(kind, ref));
      const wall = performance.now() - t,
        c = process.cpuUsage(c0);
      walls.push(wall);
      cpu.push((c.user + c.system) / 1000);
      states.push(o.state);
      for (const [k, v] of Object.entries(o.phases)) (phases[k] ??= []).push(v);
      Object.assign(counts, o.counts);
      if (walls.length >= (kind === "contains" ? 20 : nIters(wall))) break;
    }
    const P = Object.fromEntries(
      Object.entries(phases).map(([k, v]) => [k, summ(v)]),
    );
    const parts = [
      "classify",
      "read",
      "parse",
      "facts",
      "resolve",
      "keys",
      "persist",
    ].reduce((a, k) => a + (phases[k] ? stats(phases[k]!).median : 0), 0);
    stages[name] = {
      iterations: walls.length,
      insufficientN: walls.length < 20,
      unitWallMs: summ(walls),
      cpuMs: summ(cpu),
      phases: P,
      counts,
      states: [...new Set(states)],
      ...(kind === "parsed"
        ? {
            sumOfPhaseMediansMs: parts,
            unitTotalMedianMs: stats(phases["total"]!).median,
            phaseSumError:
              Math.abs(parts - stats(phases["total"]!).median) /
              stats(phases["total"]!).median,
          }
        : {}),
    };
  }
  const fe = db
    .query("SELECT status, language, failure_reason r FROM file_extractions")
    .get() as any;
  result.mL2 = {
    extraction: fe,
    stages,
    tables: db
      .query(
        "SELECT (SELECT COUNT(*) FROM symbols) symbols, (SELECT COUNT(*) FROM relationships) relationships, (SELECT COUNT(*) FROM relationship_candidates) candidates",
      )
      .get(),
    invariantViolations: checkInvariants(db, sid),
    dbBytes: Bun.file(dbPath).size,
  };
  db.close();
}
const mem = sampler.stop();
result.memory = {
  rssBaselineMiB: rssBase / 1048576,
  peakRssMiB: mem.peakRss / 1048576,
  rssGrowthMiB: (mem.peakRss - rssBase) / 1048576,
  peakExternalMiB: mem.peakExternal / 1048576,
  samples: mem.sampleCount,
};
writeFileSync(out, JSON.stringify(result, null, 2));
beat("done");
process.exit(0);
