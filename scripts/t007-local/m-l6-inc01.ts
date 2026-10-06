/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDb } from "./lib/db";
import { BLOBS } from "./lib/datasets";
import { canonicalGraph, checkInvariants } from "./lib/graph";
import { dbBytes, freshRunDb, RUNS } from "./lib/run";
import { arg, mib, now, stats, writeEvidence } from "./lib/common";
import { captureEnvironment } from "./lib/env";

/**
 * M-L6 INC-0 (full baseline) + INC-1 (no-change re-run, FR-009 short-circuit) on repo-atlas-rm, same DB per rep.
 * usage: bun m-l6-inc01.ts --workers 2 --runs 3
 */
const dataset = "repo-atlas-rm";
const workers = Number(arg("workers", "2")),
  runs = Number(arg("runs", "3"));
const engine = resolve(import.meta.dir, "engine.ts");
const envStatic = captureEnvironment();
const out: any[] = [];

async function runChild(dbPath: string, snapshotId: number, jsonOut: string) {
  const t = now();
  const child = Bun.spawn(
    [
      "bun",
      engine,
      "--db",
      dbPath,
      "--snapshot",
      String(snapshotId),
      "--blobs",
      BLOBS,
      "--workers",
      String(workers),
      "--rss",
      "--out",
      jsonOut,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const code = await child.exited;
  const processWallMs = now() - t;
  if (code !== 0)
    throw new Error(`engine exited ${code}: ${await new Response(child.stderr).text()}`);
  return { res: JSON.parse(readFileSync(jsonOut, "utf8")), processWallMs };
}

function graphSnapshot(dbPath: string, snapshotId: number) {
  const db = openDb(dbPath);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  const g = canonicalGraph(db, snapshotId);
  const inv = checkInvariants(db, snapshotId);
  db.close();
  return { hash: g.hash, counts: g.counts, invariantViolations: inv };
}

for (let i = 0; i < runs; i++) {
  const { dbPath, snapshotId } = freshRunDb(dataset, `inc01-r${i}`);
  const jsonA = resolve(RUNS, `${dataset}--inc0-r${i}.json`);
  const jsonB = resolve(RUNS, `${dataset}--inc1-r${i}.json`);

  // INC-0: full baseline (fresh DB, all jobs pending)
  const a = await runChild(dbPath, snapshotId, jsonA);
  const gA = graphSnapshot(dbPath, snapshotId);

  // INC-1: no-change re-run on the SAME db/snapshot (FR-009 short-circuit expected: 0 open jobs)
  const b = await runChild(dbPath, snapshotId, jsonB);
  const gB = graphSnapshot(dbPath, snapshotId);

  out.push({
    run: i,
    inc0: {
      processWallMs: a.processWallMs,
      engineWallMs: a.res.wallMs,
      shortCircuited: a.res.shortCircuitedRun ?? false,
      cpu: a.res.cpu,
      peakRssMiB: mib(a.res.memory?.peakRss ?? 0),
      jobsAfter: a.res.jobsAfter,
      graphHash: gA.hash,
      counts: gA.counts,
      invariantViolations: gA.invariantViolations,
    },
    inc1: {
      processWallMs: b.processWallMs,
      engineWallMs: b.res.wallMs,
      shortCircuited: b.res.shortCircuitedRun ?? false,
      enqueued: b.res.enqueued,
      jobsBefore: b.res.jobsBefore,
      jobsAfter: b.res.jobsAfter,
      graphHash: gB.hash,
      counts: gB.counts,
      invariantViolations: gB.invariantViolations,
    },
    dbBytesAfterInc1: dbBytes(dbPath),
    reduction:
      a.res.wallMs > 0
        ? 1 - (b.res.shortCircuitedRun ? 0 : b.res.wallMs) / a.res.wallMs
        : null,
  });
  console.log(
    `run ${i}: INC0 wall=${Math.round(a.res.wallMs)}ms hash=${gA.hash.slice(0, 12)} | INC1 wall=${Math.round(b.res.wallMs ?? 0)}ms shortCircuit=${b.res.shortCircuitedRun} hash=${gB.hash.slice(0, 12)} identical=${gA.hash === gB.hash}`,
  );
}

const summary = {
  inc0EngineWallMs: stats(out.map((r) => r.inc0.engineWallMs)),
  inc0ProcessWallMs: stats(out.map((r) => r.inc0.processWallMs)),
  inc1EngineWallMs: stats(out.map((r) => r.inc1.engineWallMs ?? 0)),
  inc1ProcessWallMs: stats(out.map((r) => r.inc1.processWallMs)),
  allInc1ShortCircuited: out.every((r) => r.inc1.shortCircuited === true),
  reductionPct: stats(out.map((r) => (r.reduction ?? 0) * 100)),
  graphIdenticalInc0VsInc1: out.every((r) => r.inc0.graphHash === r.inc1.graphHash),
  deterministicInc0: new Set(out.map((r) => r.inc0.graphHash)).size === 1,
};
writeEvidence("m-l6-inc0-inc1.json", {
  measurement: "M-L6 (INC-0 baseline + INC-1 no-change rerun)",
  basis: "LOCAL-RUNTIME (+PROTOTYPE relationship stage)",
  warmth: "cold (fresh process per run; INC-1 immediately follows INC-0 on the same DB, in-process-cache-cold, DB-warm)",
  dataset,
  workers,
  runs,
  environmentHash: envStatic.envHash,
  harnessRev: "revB (sequential worker init; indexed fe join)",
  environment: envStatic.static,
  summary,
  runsData: out,
});
console.log(JSON.stringify(summary));
