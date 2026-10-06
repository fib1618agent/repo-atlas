/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDb } from "./lib/db";
import { BLOBS } from "./lib/datasets";
import {
  canonicalGraph,
  checkCompleteness,
  checkInvariants,
} from "./lib/graph";
import { freshRunDb, RUNS } from "./lib/run";
import { arg, now, stats, writeEvidence } from "./lib/common";
import { captureEnvironment } from "./lib/env";

/**
 * M-L4 part 1 — G6 job-overhead baseline. PRE-REGISTERED metric (execution log §2): engine at concurrency 1 vs the identical
 * units run inline (main thread, no job table), work loop only, init excluded. M-L4 review (Performance Benchmarker) additions
 * that change measurement mechanics only: (1) a third arm "inline-in-worker" (identical units in ONE worker thread, no job
 * table) so thread effect and job-table effect are separated; (2) memory sampler OFF and --rss OFF in every arm; (3) one
 * discarded warm-up round, then 8 measured rounds with the three arms rotated (Latin-square) to cancel order effects;
 * (4) median + min–max + count of rounds above 15% (descriptive; NO verdict here).
 * usage: bun m-l4-baseline.ts --dataset repo-atlas-rm --rounds 8 [--tag x]
 */
const dataset = arg("dataset", "repo-atlas-rm")!,
  rounds = Number(arg("rounds", "8")),
  tag = arg("tag", "")!;
const engine = resolve(import.meta.dir, "engine.ts"),
  inline = resolve(import.meta.dir, "inline.ts");
type Arm = "inline-main" | "engine-c1" | "inline-worker";
const ARMS: Arm[] = ["inline-main", "engine-c1", "inline-worker"];
const rotate = (i: number) => [0, 1, 2].map((k) => ARMS[(k + i) % 3]!); // rotation of the arm order per round
async function child(arm: Arm, label: string) {
  const { dbPath, snapshotId } = freshRunDb(dataset, label);
  const out = resolve(RUNS, `${dataset}--${label}.json`);
  const base = [
    "--db",
    dbPath,
    "--snapshot",
    String(snapshotId),
    "--out",
    out,
    "--nosample",
  ];
  const args =
    arm === "inline-main"
      ? ["bun", inline, ...base]
      : arm === "engine-c1"
        ? ["bun", engine, ...base, "--blobs", BLOBS, "--workers", "1"]
        : [
            "bun",
            engine,
            ...base,
            "--blobs",
            BLOBS,
            "--workers",
            "1",
            "--inlineworker",
          ];
  const load = captureEnvironment().dynamic.loadAvg;
  const t = now();
  const p = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const code = await p.exited;
  const processWallMs = now() - t;
  if (code !== 0)
    throw new Error(
      `${arm} exit ${code}: ${await new Response(p.stderr).text()}`,
    );
  const res = JSON.parse(readFileSync(out, "utf8"));
  const db = openDb(dbPath);
  const g = canonicalGraph(db, snapshotId);
  const inv = [
    ...checkInvariants(db, snapshotId),
    ...checkCompleteness(db, snapshotId),
  ];
  const counts = db
    .query(
      `SELECT (SELECT COUNT(*) FROM file_extractions) fe, (SELECT COUNT(*) FROM symbols) sy, (SELECT COUNT(*) FROM relationships) re, (SELECT COUNT(*) FROM relationship_candidates) ca`,
    )
    .get();
  db.close();
  const perKind: Record<string, any> = {};
  for (const [k, v] of Object.entries<any>(res.perKind))
    perKind[k] = v.runMsStats
      ? {
          units: v.units,
          unitMsSum: v.runMsStats.mean * v.units,
          claimMs: v.claimMs,
          runningMs: v.runningMs,
          phaseSum: v.phaseSum,
        }
      : { units: v.units, unitMsSum: v.wallMs, phaseSum: v.phaseSum };
  return {
    arm,
    label,
    load,
    processWallMs,
    workWallMs: res.wallMs as number,
    cpuMs: res.cpu.userMs + res.cpu.systemMs,
    perKind,
    graphHash: g.hash,
    invariantViolations: inv,
    tableCounts: counts,
  };
}
const runs: any[] = [];
for (let i = -1; i < rounds; i++) {
  const order = rotate(i + 1);
  const round: any = { round: i, warmup: i < 0, order };
  for (const a of order) round[a] = await child(a, `m-l4-base-${a}-${i + 1}`);
  runs.push(round);
  console.log(
    `round ${i}${i < 0 ? " (warm-up, discarded)" : ""} [${order.join(",")}] inline-main ${Math.round(round["inline-main"].workWallMs)}  inline-worker ${Math.round(round["inline-worker"].workWallMs)}  engine-c1 ${Math.round(round["engine-c1"].workWallMs)}  same graph ${new Set(ARMS.map((a) => round[a].graphHash)).size === 1}`,
  );
}
const kept = runs.filter((r) => !r.warmup);
const ratio = (num: Arm, den: Arm) =>
  kept.map((r) => (r[num].workWallMs - r[den].workWallMs) / r[den].workWallMs);
const desc = (xs: number[]) => ({
  ...stats(xs),
  roundsAbove15pct: xs.filter((x) => x > 0.15).length,
  rounds: xs.length,
});
const summary = {
  workWallMs: Object.fromEntries(
    ARMS.map((a) => [a, stats(kept.map((r) => r[a].workWallMs))]),
  ),
  engineC1_vs_inlineMain_PREREGISTERED_G6_metric: desc(
    ratio("engine-c1", "inline-main"),
  ),
  engineC1_vs_inlineWorker_jobTableEffect: desc(
    ratio("engine-c1", "inline-worker"),
  ),
  inlineWorker_vs_inlineMain_threadEffect: desc(
    ratio("inline-worker", "inline-main"),
  ),
  overheadOfMedians_engineVsInlineMain:
    (stats(kept.map((r) => r["engine-c1"].workWallMs)).median -
      stats(kept.map((r) => r["inline-main"].workWallMs)).median) /
    stats(kept.map((r) => r["inline-main"].workWallMs)).median,
  allGraphHashesEqual:
    new Set(runs.flatMap((r) => ARMS.map((a) => r[a].graphHash))).size === 1,
  allInvariantsAndCompletenessClean: runs.every((r) =>
    ARMS.every((a) => r[a].invariantViolations.length === 0),
  ),
  tableCountsEqual:
    new Set(
      runs.flatMap((r) => ARMS.map((a) => JSON.stringify(r[a].tableCounts))),
    ).size === 1,
  perKindMedianUnitMsSum: Object.fromEntries(
    ["symbols", "contains", "parsed"].map((k) => [
      k,
      Object.fromEntries(
        ARMS.map((a) => [
          a,
          stats(kept.map((r) => r[a].perKind[k].unitMsSum)).median,
        ]),
      ),
    ]),
  ),
};
writeEvidence(`m-l4-inline-vs-engine${tag ? "-" + tag : ""}.json`, {
  measurement: "M-L4 part 1 (G6 job-overhead baseline)",
  basis: "LOCAL-RUNTIME (+PROTOTYPE relationship stage)",
  warmth: "process-cold (fresh process per arm; page cache/blobs warm)",
  dataset,
  rounds,
  discardedWarmupRounds: 1,
  definition:
    "overhead = (engine c=1 work wall − inline-main work wall) / inline-main work wall; work wall excludes worker/wasm init; MEASURED RESULT — the 15% threshold is NOT applied here",
  equivalenceNotes: [
    "same runUnit code and unit order in all arms",
    "inline arms skip only claim / RUNNING / COMPLETED job-table writes",
    "inline-main runs on the main thread; engine-c1 and inline-worker run in one worker thread",
    "sampler and per-unit RSS are OFF in all arms",
    "identical graph hash, table counts, invariants and completeness required (checked)",
    "arm order rotated per round",
  ],
  environmentHash: captureEnvironment().envHash,
  summary,
  runs,
});
console.log(JSON.stringify(summary, null, 1));
