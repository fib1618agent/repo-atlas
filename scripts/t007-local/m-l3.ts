/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { arg, now, stats, writeEvidence, SCRATCH, HARNESS_VERSION } from "./lib/common";
import { BLOBS } from "./lib/datasets";
import { openDb, type JournalMode } from "./lib/db";
import { canonicalGraph } from "./lib/graph";
import { freshRunDb } from "./lib/run";
import { captureEnvironment } from "./lib/env";
import { Resolver } from "./lib/rel";
import { loadavg } from "node:os";

/**
 * M-L3 — SQLite characterization (plan §6 M-L3): batch-insert throughput (relationships + candidates),
 * indexed resolution-lookup latency, bounded traversal (FR-014 shapes), WAL vs rollback journal, DB size.
 * PROTOTYPE / LOCAL-RUNTIME. Real R-M rows are the base; larger "scales" multiply real rows synthetically (labelled).
 * No schema/job-model change; synchronous=NORMAL (harness default) for both journal modes.
 */
const OFF = 1_000_000; // id offset per synthetic copy
const SCALES = [1, 4, 16, 64];
const MODES: JournalMode[] = ["WAL", "DELETE"];
const PAGE = 100; // harness page size for FR-014-shaped queries (a choice, not a threshold)
const NSAMPLE = 500;
const REPS_READ = 3;
const dir = resolve(SCRATCH, "m-l3");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const raw: Record<string, unknown> = {};
const la = () => loadavg().map((x) => Math.round(x * 100) / 100);
const fsize = (p: string) => (existsSync(p) ? statSync(p).size : 0);

// ---------- setup (not measured): populated R-M DB from one engine run ----------
const { dbPath: srcRun, snapshotId } = freshRunDb("repo-atlas-rm", "m-l3-src");
{
  const child = Bun.spawn(
    ["bun", resolve(import.meta.dir, "engine.ts"), "--db", srcRun, "--snapshot", String(snapshotId), "--blobs", BLOBS, "--workers", "1", "--out", resolve(dir, "engine.json")],
    { stdout: "pipe", stderr: "pipe" },
  );
  if ((await child.exited) !== 0) throw new Error("engine failed: " + (await new Response(child.stderr).text()));
}
const SRC = resolve(dir, "src.db");
let baseRel: any[] = [];
let baseCand: Map<number, [string, number][]> = new Map();
let graphHash = "";
{
  const db = openDb(srcRun);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  graphHash = canonicalGraph(db, snapshotId).hash;
  baseRel = db
    .query(
      `SELECT id, snapshot_id, relationship_type, source_kind, source_id, target_kind, target_id, evidence_state, evidence_file_extraction_id, evidence_start_line, evidence_start_column, evidence_end_line, evidence_end_column, extraction_method, relationship_extractor_version, symbol_extractor_version, relationship_key, created_at, t7_target_name, t7_import_spec FROM relationships WHERE snapshot_id=? ORDER BY id`,
    )
    .values(snapshotId) as any[];
  for (const c of db.query(`SELECT relationship_id r, candidate_kind k, candidate_id i FROM relationship_candidates ORDER BY id`).all() as any[]) {
    if (!baseCand.has(c.r)) baseCand.set(c.r, []);
    baseCand.get(c.r)!.push([c.k, c.i]);
  }
  db.close();
  copyFileSync(srcRun, SRC);
}
const nBaseCand = [...baseCand.values()].reduce((a, b) => a + b.length, 0);
const REF_HASH = "616ca53f21cabf6935c1b4b8716c8ca9d8e4b875c94e5a18ae14be2b8c47f13b";
console.log(`setup: ${baseRel.length} rels, ${nBaseCand} candidates, graph hash ${graphHash.slice(0, 12)} (reference ${graphHash === REF_HASH ? "MATCH" : "MISMATCH"})`);

const INS = `INSERT INTO relationships (snapshot_id, relationship_type, source_kind, source_id, target_kind, target_id, evidence_state, confidence, evidence_file_extraction_id, evidence_start_line, evidence_start_column, evidence_end_line, evidence_end_column, extraction_method, relationship_extractor_version, symbol_extractor_version, relationship_key, created_at, t7_target_name, t7_import_spec) VALUES (?,?,?,?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (snapshot_id, relationship_key) DO NOTHING`;
const INSC = `INSERT INTO relationship_candidates (relationship_id, candidate_kind, candidate_id) VALUES (?,?,?) ON CONFLICT DO NOTHING`;

type Row = { v: any[]; c: [string, number][] };
/** k copies of the real rows: copy i>0 gets source/target/candidate ids offset by i*OFF and a fresh sha256 key. */
function makeRows(k: number): Row[] {
  const out: Row[] = [];
  for (let i = 0; i < k; i++)
    for (const r of baseRel) {
      const off = i * OFF;
      out.push({
        v: [
          r[1], r[2], r[3], r[4] + off, r[5], r[6] == null ? null : r[6] + off, r[7],
          r[8], r[9], r[10], r[11], r[12], r[13], r[14], r[15],
          i === 0 ? r[16] : createHash("sha256").update(r[16] + "#" + i).digest("hex"),
          r[17], r[18], r[19],
        ],
        c: (baseCand.get(r[0]) ?? []).map(([kk, id]) => [kk, id + off] as [string, number]),
      });
    }
  return out;
}

/** Fresh compact DB: copy of the populated DB with relationships emptied and VACUUMed (setup, untimed). */
function prepEmpty(path: string) {
  for (const s of ["", "-wal", "-shm", "-journal"]) rmSync(path + s, { force: true });
  copyFileSync(SRC, path);
  const db = openDb(path, { journal: "DELETE" });
  db.exec("DELETE FROM relationships");
  db.exec("VACUUM");
  db.close();
}

function insertRun(path: string, mode: JournalMode, batch: number | "all", rows: Row[]) {
  prepEmpty(path);
  const db = openDb(path, { journal: mode, synchronous: "NORMAL" });
  const ins = db.query(INS), insC = db.query(INSC);
  const size = batch === "all" ? rows.length : batch;
  const batchMs: number[] = [];
  let nRel = 0, nCand = 0;
  const t0 = now();
  for (let i = 0; i < rows.length; i += size) {
    const tb = now();
    db.exec("BEGIN IMMEDIATE");
    const end = Math.min(rows.length, i + size);
    for (let j = i; j < end; j++) {
      const r = rows[j]!;
      const info = ins.run(...r.v);
      if (info.changes === 0) continue;
      nRel++;
      const id = Number(info.lastInsertRowid);
      for (const c of r.c) { insC.run(id, c[0], c[1]); nCand++; }
    }
    db.exec("COMMIT");
    batchMs.push(now() - tb);
  }
  const wallMs = now() - t0;
  const mainBytes = fsize(path), walBytes = fsize(path + "-wal");
  let ckptMs = 0;
  if (mode === "WAL") { const tc = now(); db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); ckptMs = now() - tc; }
  const afterCkptBytes = fsize(path) + fsize(path + "-wal");
  const cntR = (db.query("SELECT COUNT(*) n FROM relationships").get() as any).n;
  const cntC = (db.query("SELECT COUNT(*) n FROM relationship_candidates").get() as any).n;
  db.close();
  return {
    wallMs, relsPerS: nRel / (wallMs / 1000), candsPerS: nCand / (wallMs / 1000), rowsPerS: (nRel + nCand) / (wallMs / 1000),
    nRel, nCand, countsVerified: cntR === nRel && cntC === nCand, commits: batchMs.length,
    batchMs, mainBytes, walBytesBeforeCheckpoint: walBytes, ckptMs, bytesAfterCheckpoint: afterCkptBytes,
  };
}

// ---------- W: insert throughput ----------
const env = captureEnvironment();
const startLoad = la();
const writeCfg: { scale: number; batch: number | "all"; runs: number }[] = [
  ...(["all", 1000, 100, 1] as const).map((b) => ({ scale: 1, batch: b as number | "all", runs: 5 })),
  { scale: 4, batch: 1000, runs: 5 },
  { scale: 16, batch: 1000, runs: 5 },
  { scale: 64, batch: 1000, runs: 3 },
];
const writeResults: any[] = [];
const rowsCache = new Map<number, Row[]>();
for (const cfg of writeCfg) {
  if (!rowsCache.has(cfg.scale)) { rowsCache.clear(); rowsCache.set(cfg.scale, makeRows(cfg.scale)); }
  const rows = rowsCache.get(cfg.scale)!;
  for (const mode of MODES) {
    const runs: any[] = [];
    // alternate order across runs is not needed: each run is a fresh file/connection; modes interleave per config
    for (let r = 0; r < cfg.runs; r++) runs.push(insertRun(resolve(dir, `w-${cfg.scale}-${cfg.batch}-${mode}.db`), mode, cfg.batch, rows));
    const rec = {
      scale: cfg.scale, batch: cfg.batch, journal: mode, synchronous: "NORMAL", runs: cfg.runs,
      relationshipRows: runs[0].nRel, candidateRows: runs[0].nCand, countsVerified: runs.every((x) => x.countsVerified),
      wallMs: stats(runs.map((x) => x.wallMs)), relsPerS: stats(runs.map((x) => x.relsPerS)), rowsPerS: stats(runs.map((x) => x.rowsPerS)),
      perCommitMs: stats(runs.flatMap((x) => x.batchMs)), commitsPerRun: runs[0].commits,
      mainBytes: stats(runs.map((x) => x.mainBytes)), walBytesBeforeCheckpoint: stats(runs.map((x) => x.walBytesBeforeCheckpoint)),
      ckptMs: stats(runs.map((x) => x.ckptMs)), bytesAfterCheckpoint: stats(runs.map((x) => x.bytesAfterCheckpoint)),
      insufficientN: cfg.runs < 3,
    };
    writeResults.push(rec);
    console.log(`W scale=${cfg.scale} batch=${cfg.batch} ${mode}: median ${rec.wallMs.median.toFixed(0)} ms, ${rec.relsPerS.median.toFixed(0)} rel/s, commit p95 ${rec.perCommitMs.p95.toFixed(2)} ms`);
    raw[`write:${cfg.scale}:${cfg.batch}:${mode}`] = runs.map((x) => ({ wallMs: x.wallMs, batchMs: x.batchMs }));
  }
}
rowsCache.clear();
const midLoad = la();

// ---------- R: build read DBs per scale (setup), then measure ----------
function buildReadDb(k: number) {
  const walPath = resolve(dir, `read-s${k}-WAL.db`);
  prepEmpty(walPath);
  const rows = makeRows(k);
  const db = openDb(walPath, { journal: "WAL" });
  const ins = db.query(INS), insC = db.query(INSC);
  db.exec("BEGIN IMMEDIATE");
  for (const r of rows) {
    const info = ins.run(...r.v);
    const id = Number(info.lastInsertRowid);
    for (const c of r.c) insC.run(id, c[0], c[1]);
  }
  const maxSym = (db.query("SELECT MAX(id) m FROM symbols").get() as any).m;
  for (let i = 1; i < k; i++)
    db.exec(
      `INSERT INTO symbols (file_extraction_id, snapshot_id, kind, name, qualified_name, start_line, start_column, end_line, end_column, parent_symbol_id, is_exported, symbol_key, evidence_state, extractor_version, created_at) SELECT file_extraction_id, snapshot_id, kind, name||'_c${i}', qualified_name, start_line, start_column, end_line, end_column, NULL, is_exported, symbol_key||'#${i}', evidence_state, extractor_version, created_at FROM symbols WHERE id<=${maxSym}`,
    );
  db.exec("COMMIT");
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  const delPath = resolve(dir, `read-s${k}-DELETE.db`);
  for (const s of ["", "-wal", "-shm", "-journal"]) rmSync(delPath + s, { force: true });
  copyFileSync(walPath, delPath);
  const d2 = openDb(delPath, { journal: "DELETE" });
  d2.close();
  return { walPath, delPath };
}

function objectBytes(path: string) {
  const db = openDb(path, { journal: path.includes("WAL") ? "WAL" : "DELETE" });
  try {
    const rows = db.query("SELECT name, SUM(pgsize) b, COUNT(*) pages FROM dbstat GROUP BY name ORDER BY b DESC").all() as any[];
    db.close();
    return { source: "dbstat", objects: rows };
  } catch (e: any) {
    db.close();
    return { source: "UNAVAILABLE", error: String(e.message ?? e) };
  }
}

// PRNG
function rng(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// base samples (from real rows)
const callNames = [...new Set(baseRel.filter((r) => r[2] === "CALLS" && r[18]).map((r) => r[18] as string))].sort();
const outDeg = new Map<string, number>(), inDeg = new Map<string, number>(), outCalls = new Map<string, number>(), inCalls = new Map<string, number>();
for (const r of baseRel) {
  const so = `${r[3]}|${r[4]}`; outDeg.set(so, (outDeg.get(so) ?? 0) + 1);
  if (r[2] === "CALLS") outCalls.set(so, (outCalls.get(so) ?? 0) + 1);
  if (r[5] != null) { const ti = `${r[5]}|${r[6]}`; inDeg.set(ti, (inDeg.get(ti) ?? 0) + 1); if (r[2] === "CALLS") inCalls.set(ti, (inCalls.get(ti) ?? 0) + 1); }
}
const degStats = (m: Map<string, number>) => stats([...m.values()]);
const hub = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]!;
const ident = (s: string, off: number) => { const [k, id] = s.split("|"); return [k!, Number(id) + off] as const; };

const OUT_SQL = (typed: boolean) => `SELECT id, relationship_type, target_kind, target_id, evidence_state FROM relationships WHERE snapshot_id=? AND source_kind=? AND source_id=? ${typed ? "AND relationship_type=?" : ""} AND id>? ORDER BY id LIMIT ${PAGE}`;
const IN_SQL = (typed: boolean) => `SELECT id, relationship_type, source_kind, source_id, evidence_state FROM relationships WHERE snapshot_id=? AND target_kind=? AND target_id=? ${typed ? "AND relationship_type=?" : ""} AND id>? ORDER BY id LIMIT ${PAGE}`;
const SYM_ID_SQL = `SELECT file_extraction_id fe, name FROM symbols WHERE id=?`;

function readRun(path: string, mode: JournalMode, k: number, rep: number) {
  const rnd = rng(1000 + rep); // sampling differs per repetition, same for both modes (paired)
  const db = openDb(path, { journal: mode });
  const R = new Resolver(db, snapshotId);
  const symRows = db.query("SELECT id FROM symbols WHERE snapshot_id=?").all(snapshotId) as any[];
  const filePaths = (db.query("SELECT path FROM snapshot_files WHERE snapshot_id=?").all(snapshotId) as any[]).map((x) => x.path as string);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
  const copyOff = () => Math.floor(rnd() * k);
  const outNodes = [...outDeg.keys()].sort(), inNodes = [...inDeg.keys()].sort(), outCallNodes = [...outCalls.keys()].sort(), inCallNodes = [...inCalls.keys()].sort();
  const symInFile = (R as any).symInFile;
  const q = {
    outAll: db.query(OUT_SQL(false)), outTyped: db.query(OUT_SQL(true)), inAll: db.query(IN_SQL(false)), inTyped: db.query(IN_SQL(true)),
  };
  // sample sets (fixed per run, reused by every pass)
  const S = {
    byName: Array.from({ length: NSAMPLE }, () => { const i = copyOff(); return i === 0 ? pick(callNames) : pick(callNames) + `_c${i}`; }),
    files: Array.from({ length: NSAMPLE }, () => Array.from({ length: 6 }, (_, j) => (j % 2 === 0 ? pick(filePaths) : `nonexistent/${Math.floor(rnd() * 1e6)}.ts`))),
    inFile: Array.from({ length: NSAMPLE }, () => { const s = db.query(SYM_ID_SQL).get(pick(symRows).id) as any; return [s.fe as number, s.name as string] as const; }),
    outAll: Array.from({ length: NSAMPLE }, () => ident(pick(outNodes), copyOff() * OFF)),
    outTyped: Array.from({ length: NSAMPLE }, () => ident(pick(outCallNodes), copyOff() * OFF)),
    inAll: Array.from({ length: NSAMPLE }, () => ident(pick(inNodes), copyOff() * OFF)),
    inTyped: Array.from({ length: NSAMPLE }, () => ident(pick(inCallNodes), copyOff() * OFF)),
  };
  const kinds = ["function", "method"];
  const cls: Record<string, (i: number) => number> = {
    "R1 symbols-by-name (resolver byName, LIMIT 21)": (i) => R.symbols(S.byName[i]!, kinds, "typescript").length,
    "R2 files-by-6-paths (import candidates)": (i) => R.files(S.files[i]!).length,
    "R3 symbols-in-file by name (resolver same-file)": (i) => (symInFile.all(S.inFile[i]![0], S.inFile[i]![1], JSON.stringify(kinds)) as any[]).length,
    "T1 outgoing page (all types, LIMIT 100)": (i) => (q.outAll.all(snapshotId, S.outAll[i]![0], S.outAll[i]![1], 0) as any[]).length,
    "T2 outgoing page type=CALLS": (i) => (q.outTyped.all(snapshotId, S.outTyped[i]![0], S.outTyped[i]![1], "CALLS", 0) as any[]).length,
    "T3 incoming page (all types)": (i) => (q.inAll.all(snapshotId, S.inAll[i]![0], S.inAll[i]![1], 0) as any[]).length,
    "T4 incoming page type=CALLS": (i) => (q.inTyped.all(snapshotId, S.inTyped[i]![0], S.inTyped[i]![1], "CALLS", 0) as any[]).length,
  };
  const out: Record<string, { cold: number[]; warm: number[]; rows: number[] }> = {};
  for (const name of Object.keys(cls)) out[name] = { cold: [], warm: [], rows: [] };
  // pass 0 = connection-cold (fresh connection, statements/page-cache cold; OS page cache NOT dropped); passes 1..3 = warm
  for (let pass = 0; pass < 4; pass++)
    for (const [name, fn] of Object.entries(cls))
      for (let i = 0; i < NSAMPLE; i++) {
        const t = now(); const n = fn(i); const d = now() - t;
        (pass === 0 ? out[name]!.cold : out[name]!.warm).push(d);
        if (pass === 0) out[name]!.rows.push(n);
      }
  // T5 deep pagination on the highest-degree hub (copy 0)
  const deep: Record<string, { pages: number[]; rows: number }> = {};
  for (const [label, sql, h] of [["T5a outgoing hub", OUT_SQL(false), hub(outDeg)], ["T5b incoming hub", IN_SQL(false), hub(inDeg)]] as const) {
    const st = db.query(sql);
    const [kind, id] = ident(h[0], 0);
    let cursor = 0, total = 0; const pages: number[] = [];
    for (;;) { const t = now(); const rs = st.all(snapshotId, kind, id, cursor) as any[]; pages.push(now() - t); if (!rs.length) break; total += rs.length; cursor = rs[rs.length - 1].id; if (rs.length < PAGE) break; }
    deep[label] = { pages, rows: total };
  }
  db.close();
  return { out, deep };
}

const readResults: any[] = [];
const plans: any = {};
const sizeResults: any[] = [];
for (const k of SCALES) {
  const { walPath, delPath } = buildReadDb(k);
  const paths = { WAL: walPath, DELETE: delPath } as const;
  // sizes (as built, then compact after VACUUM copy)
  for (const mode of MODES) {
    const p = paths[mode];
    const asBuilt = fsize(p);
    const objs = objectBytes(p);
    const vac = resolve(dir, `vac-s${k}-${mode}.db`);
    for (const s of ["", "-wal", "-shm", "-journal"]) rmSync(vac + s, { force: true });
    copyFileSync(p, vac);
    const vdb = openDb(vac, { journal: mode }); vdb.exec("VACUUM"); if (mode === "WAL") vdb.exec("PRAGMA wal_checkpoint(TRUNCATE)"); vdb.close();
    const cnt = openDb(p, { journal: mode });
    const c = { rels: (cnt.query("SELECT COUNT(*) n FROM relationships").get() as any).n, cands: (cnt.query("SELECT COUNT(*) n FROM relationship_candidates").get() as any).n, syms: (cnt.query("SELECT COUNT(*) n FROM symbols").get() as any).n, pageSize: (cnt.query("PRAGMA page_size").get() as any).page_size, pageCount: (cnt.query("PRAGMA page_count").get() as any).page_count };
    cnt.close();
    sizeResults.push({ scale: k, journal: mode, ...c, asBuiltBytes: asBuilt, afterVacuumBytes: fsize(vac) + fsize(vac + "-wal"), bytesPerRelationshipAsBuilt: asBuilt / c.rels, objectBytes: objs });
    console.log(`SIZE scale=${k} ${mode}: ${c.rels} rels, as-built ${(asBuilt / 1048576).toFixed(1)} MiB, vacuumed ${(fsize(vac) / 1048576).toFixed(1)} MiB`);
  }
  if (k === 16) {
    const d = openDb(walPath, { journal: "WAL" });
    const ep = (sql: string, ...a: any[]) => (d.query("EXPLAIN QUERY PLAN " + sql).all(...a) as any[]).map((r) => r.detail);
    plans["T1 outgoing"] = ep(OUT_SQL(false), 1, "symbol", 1, 0); plans["T2 outgoing typed"] = ep(OUT_SQL(true), 1, "symbol", 1, "CALLS", 0);
    plans["T3 incoming"] = ep(IN_SQL(false), 1, "symbol", 1, 0); plans["T4 incoming typed"] = ep(IN_SQL(true), 1, "symbol", 1, "CALLS", 0);
    plans["R1 byName"] = ep(`SELECT s.id FROM symbols s JOIN file_extractions fe ON fe.id=s.file_extraction_id JOIN snapshot_files sf ON sf.id=fe.snapshot_file_id WHERE s.snapshot_id=? AND s.name=? AND s.kind IN (?,?) AND fe.language IN (?,?,?) ORDER BY sf.path, s.start_line, s.start_column LIMIT 21`, 1, "x", "function", "method", "javascript", "typescript", "tsx");
    d.close();
  }
  for (const mode of MODES) {
    const reps: any[] = [];
    for (let rep = 0; rep < REPS_READ; rep++) reps.push(readRun(paths[mode], mode, k, rep));
    const classes: any = {};
    for (const name of Object.keys(reps[0].out)) {
      const cold = reps.flatMap((r) => r.out[name].cold), warm = reps.flatMap((r) => r.out[name].warm);
      classes[name] = { coldMs: stats(cold), warmMs: stats(warm), rowsReturned: stats(reps.flatMap((r) => r.out[name].rows)), perRepWarmMedianMs: reps.map((r) => stats(r.out[name].warm).median) };
      raw[`read:${k}:${mode}:${name}`] = { cold, warm };
    }
    const deep: any = {};
    for (const label of Object.keys(reps[0].deep)) {
      const pages = reps.flatMap((r) => r.deep[label].pages);
      deep[label] = { rowsInHub: reps[0].deep[label].rows, pagesPerWalk: reps[0].deep[label].pages.length, perPageMs: stats(pages), walks: REPS_READ };
      raw[`deep:${k}:${mode}:${label}`] = reps.map((r) => r.deep[label].pages);
    }
    readResults.push({ scale: k, journal: mode, reps: REPS_READ, samplesPerClassPerPass: NSAMPLE, classes, deepPagination: deep });
    const c1 = classes["R1 symbols-by-name (resolver byName, LIMIT 21)"].warmMs, t1 = classes["T1 outgoing page (all types, LIMIT 100)"].warmMs;
    console.log(`R scale=${k} ${mode}: R1 warm med ${c1.median.toFixed(4)} p95 ${c1.p95.toFixed(4)} ms | T1 warm med ${t1.median.toFixed(4)} p95 ${t1.p95.toFixed(4)}`);
  }
}
const endLoad = la();

const graphStats = { outDegree: degStats(outDeg), inDegree: degStats(inDeg), hubOut: hub(outDeg), hubIn: hub(inDeg) };
const p = writeEvidence("m-l3-sqlite.json", {
  measurement: "M-L3 SQLite characterization",
  basis: "LOCAL-RUNTIME (bun:sqlite) + PROTOTYPE relationship rows; real R-M rows as base, larger scales are SYNTHETIC multiplications (ids offset, fresh keys; symbols cloned with name suffix) — NOT R-S/R-L measurements",
  harnessVersion: HARNESS_VERSION,
  environment: env,
  loadAvg: { start: startLoad, afterWrites: midLoad, end: endLoad },
  config: {
    journalModes: MODES, synchronous: "NORMAL", busyTimeoutMs: 15000, foreignKeys: "ON", schema: "production data/code-intel-schema.sql + harness scratch extension (unchanged)",
    pageSizeQueries: PAGE, samplesPerClassPerPass: NSAMPLE, readRepetitions: REPS_READ, scales: SCALES, idOffsetPerCopy: OFF,
    coldDefinition: "fresh connection, first pass; SQLite page cache + prepared statements cold; OS page cache NOT dropped (needs privileges) — 'connection-cold / OS-warm'",
    warmDefinition: "passes 2–4 on the same connection",
    writeMethod: "BEGIN IMMEDIATE … COMMIT batches; prepared statements; INSERT relationships ON CONFLICT DO NOTHING then candidates via lastInsertRowid (same as prototype persistRows); fresh VACUUMed empty-relationships DB copy + fresh connection per run",
    notPreRegistered_notRun: ["synchronous=FULL", "concurrent reader/writer contention (M-L4 covers write-lock wait)", "2-hop traversal", "R-S/R-L real-tier DB sizes"],
  },
  baseGraph: { snapshotId, relationships: baseRel.length, candidates: nBaseCand, graphHash, referenceHashMatch: graphHash === REF_HASH, ...graphStats },
  writes: writeResults,
  reads: readResults,
  queryPlans: plans,
  sizes: sizeResults,
});
console.log("evidence:", p);
writeEvidence("m-l3-raw.json", raw);
