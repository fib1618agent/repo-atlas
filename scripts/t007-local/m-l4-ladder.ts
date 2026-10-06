/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDb } from "./lib/db";
import { canonicalGraph } from "./lib/graph";
import { freshRunDb } from "./lib/run";
import { arg, EVIDENCE_DIR, mib, stats, writeEvidence } from "./lib/common";
import { captureEnvironment } from "./lib/env";
import { runEngine } from "./engine";
import { BLOBS } from "./lib/datasets";

/**
 * M-L4 part 2 — concurrency ladder 1/2/4/8 (c=2 primary). M-L4 review changes (mechanics only): COLD levels are INTERLEAVED round-robin
 * (c1,c2,c4,c8 × N rounds) so drift/load is not confounded with concurrency; each cell is a fresh process + fresh DB (process-cold).
 * WARM = 4 consecutive in-process runs per level, level order interleaved; only MAIN-THREAD state (JIT/page cache) is warm because every
 * run creates new worker threads (worker VMs/WASM/grammars start cold each time) — labelled accordingly, never averaged with cold.
 * usage: bun m-l4-ladder.ts --dataset repo-atlas-rm --rounds 5 [--precheck]   (--precheck = labelled claim-precheck VARIANT)
 */
const dataset = arg("dataset", "repo-atlas-rm")!,
  rounds = Number(arg("rounds", "5")),
  precheck = process.argv.includes("--precheck");
const variant = precheck ? "precheck-variant" : "primary";
const ladder = [1, 2, 4, 8];
const sfx = precheck ? "-precheck" : "";
for (let r = 0; r < rounds; r++)
  for (const c of ladder) {
    const p = Bun.spawn(
      [
        "bun",
        resolve(import.meta.dir, "run-scale.ts"),
        "--dataset",
        dataset,
        "--workers",
        String(c),
        "--runs",
        "1",
        "--prefix",
        "m-l4",
        "--tag",
        `cold${sfx}-r${r}`,
        ...(precheck ? ["--precheck"] : []),
      ],
      { stdout: "ignore", stderr: "inherit" },
    );
    if ((await p.exited) !== 0)
      throw new Error(`cold ladder c=${c} round ${r} failed`);
  }
const cold: Record<string, any> = {};
for (const c of ladder) {
  const cells = Array.from(
    { length: rounds },
    (_, r) =>
      JSON.parse(
        readFileSync(
          resolve(EVIDENCE_DIR, `m-l4-${dataset}-c${c}-cold${sfx}-r${r}.json`),
          "utf8",
        ),
      ).runsData[0],
  );
  const f = (fn: (x: any) => number) => stats(cells.map(fn));
  cold[`c${c}`] = {
    engineWallMs: f((x) => x.engine.wallMs),
    processWallMs: f((x) => x.processWallMs),
    initWallMs: f((x) => x.engine.initWallMs),
    cpuMs: f((x) => x.cpu.userMs + x.cpu.systemMs),
    cpuWallRatio: f((x) => x.cpu.cpuWallRatio),
    peakRssMiB: f((x) => x.memory.peakRssMiB),
    avgRssMiB: f((x) => x.memory.avgRssMiB),
    filesPerSecWall: f((x) => x.derived.filesPerSecWall),
    relationshipsPerSecWall: f((x) => x.derived.relationshipsPerSecWall),
    parsedPersistShare: f((x) => x.derived.parsedPersistShare),
    parsedPersistShareNet: f((x) => x.derived.parsedPersistShareNet),
    parsedWriteOnlyShareNet: f((x) => x.derived.parsedWriteOnlyShareNet),
    parsedLockShare: f((x) => x.derived.parsedLockShare),
    jobBookkeepingShare: f((x) => x.derived.jobOverheadShareOfUnitTime),
    claimMsTotal: f((x) => x.derived.claimMsTotal),
    idlePollMs: f((x) => x.derived.idlePollMs),
    busyErrors: f((x) => x.jobs.busyErrors),
    attemptsSumPerRun: cells.map((x) => x.jobs.attemptsSum),
    reclaimsSumPerRun: cells.map((x) => x.jobs.reclaimsSum),
    retriesPerRun: cells.map((x) => x.jobs.retries),
    graphHashes: [...new Set(cells.map((x) => x.graphHash))],
    invariantViolations: cells.map((x) => x.invariantViolations.length),
    loadAvgAtStart: cells.map((x) => x.loadAvgAtStart),
    rawFiles: cells.map(
      (_, r) => `m-l4-${dataset}-c${c}-cold${sfx}-r${r}.json`,
    ),
  };
}
const c1 = cold["c1"].engineWallMs.median;
const scaling = Object.fromEntries(
  ladder.map((c) => [
    `c${c}`,
    {
      speedupVsC1: c1 / cold[`c${c}`].engineWallMs.median,
      note: "descriptive ratio of medians over rounds — not a fitted scaling law",
    },
  ]),
);
writeEvidence(`m-l4-ladder-cold${sfx}.json`, {
  measurement: "M-L4 part 2 (cold, interleaved)",
  claimMode: variant,
  dataset,
  rounds,
  warmth: "process-cold (fresh process + DB per cell); page cache/blobs warm",
  environmentHash: captureEnvironment().envHash,
  cold,
  scaling,
});
console.log(
  JSON.stringify(
    Object.fromEntries(
      ladder.map((c) => [
        `c${c}`,
        Math.round(cold[`c${c}`].engineWallMs.median),
      ]),
    ),
    null,
    1,
  ),
);

const warm: Record<string, any> = Object.fromEntries(
  ladder.map((c) => [`c${c}`, { iterations: [] as any[] }]),
);
for (let i = 0; i < 4; i++)
  for (const c of ladder) {
    const { dbPath, snapshotId } = freshRunDb(dataset, `m-l4-warm-c${c}-${i}`);
    const r = await runEngine({
      dbPath,
      snapshotId,
      blobsDir: BLOBS,
      workers: c,
      claimPrecheck: precheck,
    });
    const db = openDb(dbPath);
    const g = canonicalGraph(db, snapshotId);
    db.close();
    warm[`c${c}`].iterations.push({
      iteration: i,
      kept: i > 0,
      engineWallMs: r.wallMs,
      cpuMs: r.cpu.userMs + r.cpu.systemMs,
      peakRssMiB: mib(r.memory.peakRss),
      graphHash: g.hash,
      busyErrors: r.busyErrors,
    });
  }
for (const c of ladder) {
  const w = warm[`c${c}`];
  w.warmWallMs = stats(
    w.iterations.filter((x: any) => x.kept).map((x: any) => x.engineWallMs),
  );
  w.graphHashesEqual =
    new Set(w.iterations.map((x: any) => x.graphHash)).size === 1;
}
writeEvidence(`m-l4-warm-ladder${sfx}.json`, {
  measurement: "M-L4 part 2 (main-thread-warm, worker-cold)",
  claimMode: variant,
  dataset,
  note: "iteration 0 discarded; new worker threads every run → worker VM/WASM/grammar are cold each time; peakRss is process-wide and monotonic across iterations",
  environmentHash: captureEnvironment().envHash,
  warm,
});
console.log(
  JSON.stringify(
    Object.fromEntries(
      ladder.map((c) => [`c${c}`, Math.round(warm[`c${c}`].warmWallMs.median)]),
    ),
    null,
    1,
  ),
);
