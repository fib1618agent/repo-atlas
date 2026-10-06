/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { openDb } from "./lib/db";
import { BLOBS } from "./lib/datasets";
import { canonicalGraph, checkInvariants } from "./lib/graph";
import { dbBytes, freshRunDb, RUNS } from "./lib/run";
import { arg, mib, now, stats, writeEvidence, slope } from "./lib/common";
import { captureEnvironment } from "./lib/env";

/**
 * M-L5 repository-scale graphification. Each run: fresh DB copy of the dataset's snapshot template → child process
 * (`bun engine.ts`, cold start included in processWallMs) → post-run canonical graph hash + invariants.
 * usage: bun run-scale.ts --dataset repo-atlas-rm --workers 2 --runs 3 [--tag name]
 */
const claimMode = process.argv.includes("--precheck")
  ? "precheck-variant"
  : "primary";
const dataset = arg("dataset")!,
  workers = Number(arg("workers", "2")),
  runs = Number(arg("runs", "3")),
  tag = arg("tag", ""),
  prefix = arg("prefix", "m-l5");
const engine = resolve(import.meta.dir, "engine.ts");
const out: any[] = [];
const envStatic = captureEnvironment();
for (let i = 0; i < runs; i++) {
  const { dbPath, snapshotId } = freshRunDb(dataset, `scale-c${workers}-r${i}`);
  const jsonOut = resolve(RUNS, `${dataset}--scale-c${workers}-r${i}.json`);
  const dyn = captureEnvironment().dynamic;
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
      ...(process.argv.includes("--precheck") ? ["--precheck"] : []),
      "--out",
      jsonOut,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const code = await child.exited;
  const processWallMs = now() - t;
  if (code !== 0)
    throw new Error(
      `engine exited ${code}: ${await new Response(child.stderr).text()}`,
    );
  const res = JSON.parse(readFileSync(jsonOut, "utf8"));
  const db = openDb(dbPath);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  const g = canonicalGraph(db, snapshotId);
  const inv = checkInvariants(db, snapshotId);
  const jobSums = db
    .query(
      `SELECT COALESCE(SUM(attempts),0) a, COALESCE(SUM(reclaims),0) r, COUNT(*) n FROM t7_jobs WHERE snapshot_id=?`,
    )
    .get(snapshotId) as { a: number; r: number; n: number };
  const rel = db
    .query(
      `SELECT relationship_type t, evidence_state s, COUNT(*) n FROM relationships WHERE snapshot_id=? GROUP BY 1,2`,
    )
    .all(snapshotId) as { t: string; s: string; n: number }[];
  const fx = db
    .query(
      `SELECT status, COUNT(*) n FROM file_extractions WHERE snapshot_id=? GROUP BY 1`,
    )
    .all(snapshotId) as { status: string; n: number }[];
  db.close();
  const rss: number[] = res.rssSeries ?? [];
  const half = Math.floor(rss.length / 2);
  const idx = rss.map((_, k) => k);
  const P = res.perKind.parsed,
    S = res.perKind.symbols,
    C = res.perKind.contains;
  const parsedUnitMs = P.phaseSum.total;
  const jobOverheadMs = Object.values(
    res.perKind as Record<string, any>,
  ).reduce(
    (a: number, k: any) =>
      a + k.claimMs + k.runningMs + (k.phaseSum.complete ?? 0),
    0,
  );
  const unitTotalMs = Object.values(res.perKind as Record<string, any>).reduce(
    (a: number, k: any) => a + k.runMsStats.mean * k.units,
    0,
  );
  // claim + RUNNING writes happen OUTSIDE runMs; the COMPLETED write happens INSIDE runMs (M-L4 review: earlier revisions double-counted it in the denominator)
  const outsideMs = Object.values(res.perKind as Record<string, any>).reduce(
    (a: number, k: any) => a + k.claimMs + k.runningMs,
    0,
  );
  out.push({
    run: i,
    loadAvgAtStart: dyn.loadAvg,
    power: dyn.power,
    processWallMs,
    engine: {
      wallMs: res.wallMs,
      initWallMs: res.initWallMs,
      enqueueMs: res.enqueueMs,
      workerInit: res.workerInit,
    },
    cpu: res.cpu,
    memory: {
      ...res.memory,
      peakRssMiB: mib(res.memory.peakRss),
      avgRssMiB: mib(res.memory.avgRss),
      rssFirstMiB: mib(rss[0] ?? 0),
      rssMidMiB: mib(rss[half] ?? 0),
      rssLastMiB: mib(rss[rss.length - 1] ?? 0),
      rssSlopeBytesPerUnitSecondHalf: slope(idx.slice(half), rss.slice(half)),
    },
    jobs: {
      after: res.jobsAfter,
      snapshotStatus: res.snapshotStatus,
      claimAttempts: res.claimAttempts,
      attemptsSum: jobSums.a,
      reclaimsSum: jobSums.r,
      jobRows: jobSums.n,
      idleMs: res.idleMs,
      busyErrors: res.busyErrors,
      reclaimed: res.reclaimed,
      retries: res.retries.length,
    },
    perKind: res.perKind,
    derived: {
      tier1Files: P.units,
      symbols: S.counts.symbols,
      relationshipsParsed: P.counts.relationships,
      relationshipsTotal: g.counts.relationships,
      candidates: g.counts.candidates,
      facts: P.counts.facts,
      duplicateKeys: P.counts.duplicateKeys,
      filesPerSecWall: P.units / (res.wallMs / 1000),
      symbolsPerSecWall: S.counts.symbols / (res.wallMs / 1000),
      relationshipsPerSecWall: g.counts.relationships / (res.wallMs / 1000),
      resolutionsPerSecWall: P.counts.facts / (res.wallMs / 1000),
      parsedPersistShare: P.phaseSum.persist / parsedUnitMs,
      symbolsPersistShare: S.phaseSum.persist / S.phaseSum.total,
      containsPersistShare: C.phaseSum.persist / C.phaseSum.total,
      jobOverheadShareOfUnitTime: jobOverheadMs / (unitTotalMs + outsideMs),
      parsedPersistShareNet:
        (P.phaseSum.persist - (P.phaseSum.complete ?? 0)) / parsedUnitMs,
      parsedWriteOnlyShareNet:
        ((P.phaseSum.persistBody ?? 0) +
          (P.phaseSum.persistCommit ?? 0) -
          (P.phaseSum.complete ?? 0)) /
        parsedUnitMs,
      parsedLockShare: (P.phaseSum.persistLock ?? 0) / parsedUnitMs,
      claimMsTotal: Object.values(res.perKind as Record<string, any>).reduce(
        (a: number, k: any) => a + k.claimMs,
        0,
      ),
      runningMsTotal: Object.values(res.perKind as Record<string, any>).reduce(
        (a: number, k: any) => a + k.runningMs,
        0,
      ),
      idlePollMs: res.idleMs,
      evidenceStates: rel,
      fileExtractionStatus: fx,
      astNodes: P.counts.astNodes,
      parsedBytes: P.counts.bytes,
    },
    db: { bytes: dbBytes(dbPath), mib: mib(dbBytes(dbPath)) },
    graphHash: g.hash,
    relHash: g.relHash,
    counts: g.counts,
    invariantViolations: inv,
  });
  console.log(
    `run ${i}: wall=${Math.round(res.wallMs)}ms process=${Math.round(processWallMs)}ms peakRSS=${mib(res.memory.peakRss)}MiB rel=${g.counts.relationships} hash=${g.hash.slice(0, 12)} inv=${inv.length}`,
  );
}
const summary = {
  engineWallMs: stats(out.map((r) => r.engine.wallMs)),
  processWallMs: stats(out.map((r) => r.processWallMs)),
  peakRssMiB: stats(out.map((r) => r.memory.peakRssMiB)),
  deterministic: new Set(out.map((r) => r.graphHash)).size === 1,
};
writeEvidence(`${prefix}-${dataset}-c${workers}${tag ? "-" + tag : ""}.json`, {
  measurement: "M-L5",
  basis: "LOCAL-RUNTIME (+PROTOTYPE relationship stage)",
  warmth: "cold (fresh process per run)",
  dataset,
  workers,
  runs,
  environmentHash: envStatic.envHash,
  claimMode,
  harnessRev:
    process.env["T7_HARNESS_REV"] ??
    "revB (sequential worker init; indexed fe join)",
  initMode: process.env["T7_PARALLEL_INIT"] ? "parallel" : "sequential",
  environment: envStatic.static,
  summary,
  runsData: out,
});
console.log(JSON.stringify(summary));
