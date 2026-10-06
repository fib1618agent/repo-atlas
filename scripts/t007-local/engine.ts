/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { openDb } from "./lib/db";
import {
  DEFAULT_POLICY,
  enqueueJobs,
  jobCounts,
  type Policy,
} from "./lib/jobs";
import { classifyJobs, type Faults } from "./lib/unit";
import {
  RELATIONSHIP_EXTRACTOR_VERSION,
  SYMBOL_EXTRACTOR_VERSION,
} from "./lib/rel";
import { now, startMemSampler, stats } from "./lib/common";

export type EngineOpts = {
  dbPath: string;
  snapshotId: number;
  blobsDir: string;
  workers: number;
  policy?: Partial<Policy>;
  faults?: Faults;
  journal?: "WAL" | "DELETE";
  synchronous?: "NORMAL" | "FULL" | "OFF";
  idlePollMs?: number;
  recordRss?: boolean;
  enqueue?: boolean;
  sample?: boolean;
  label?: string;
  /** VARIANT: idle workers use a read-only pre-check before the write-lock claim (not the pre-registered primary configuration) */
  claimPrecheck?: boolean;
  /** baseline arm: run the identical units in ONE worker thread without the job table */
  inlineWorker?: boolean;
};

/** Coordinator: spawns N worker threads, barrier-starts them after init (so init cost is excluded from work wall), collects per-unit metrics. */
export async function runEngine(o: EngineOpts) {
  const policy: Policy = { ...DEFAULT_POLICY, ...o.policy };
  const db = openDb(o.dbPath, {
    journal: o.journal ?? "WAL",
    synchronous: o.synchronous ?? "NORMAL",
  });
  const tEnq = now();
  const enqueued =
    o.enqueue === false || o.inlineWorker
      ? 0
      : enqueueJobs(db, o.snapshotId, classifyJobs(db, o.snapshotId));
  const enqueueMs = now() - tEnq;
  const before = jobCounts(db, o.snapshotId);
  const open = ["PENDING", "CLAIMED", "RUNNING", "RETRYING"].reduce(
    (a, s) => a + (before[s] ?? 0),
    0,
  );
  const result: any = {
    label: o.label ?? null,
    workers: o.workers,
    enqueued,
    enqueueMs,
    jobsBefore: before,
    shortCircuitedRun: false,
  };
  if (open === 0 && !o.inlineWorker) {
    // FR-009 / guarantee 2: nothing to do → no workers spawned
    result.shortCircuitedRun = true;
    result.wallMs = 0;
    result.engineTotalMs = now() - tEnq;
    result.jobsAfter = before;
    db.close();
    return result;
  }
  const sampler = o.sample === false ? null : startMemSampler(50);
  const cpu0 = process.cpuUsage();
  const tSpawn = now();
  const workerPath = resolve(import.meta.dir, "worker.ts");
  const ws = Array.from(
    { length: o.workers },
    () =>
      new Worker(workerPath, {
        env: { ...process.env } as Record<string, string>,
      }),
  );
  const readyInfo: any[] = [];
  const done: any[] = [];
  let go!: () => void;
  const sendInit: (() => void)[] = [];
  const allReady = new Promise<void>((res) => {
    let n = 0;
    ws.forEach((w, i) => {
      w.onmessage = (ev: MessageEvent) => {
        const m = ev.data;
        if (m.type === "ready") {
          readyInfo.push(m);
          // Workers are initialised one at a time: concurrent WebAssembly.compile/instantiate across Bun worker threads crashed the process intermittently (SIGTRAP, see execution log D7)
          if (!process.env["T7_PARALLEL_INIT"]) sendInit[i + 1]?.();
          if (++n === ws.length) res();
        } else if (m.type === "done") {
          done.push(m);
          if (done.length === ws.length) go();
        }
      };
      sendInit[i] = () =>
        w.postMessage({
          type: "init",
          workerId: `w${i}-${process.pid}`,
          dbPath: o.dbPath,
          snapshotId: o.snapshotId,
          blobsDir: o.blobsDir,
          policy,
          faults: o.faults ?? {},
          journal: o.journal ?? "WAL",
          synchronous: o.synchronous ?? "NORMAL",
          idlePollMs: o.idlePollMs ?? 3,
          recordRss: o.recordRss ?? false,
          claimPrecheck: o.claimPrecheck ?? false,
          inline: o.inlineWorker ?? false,
        });
    });
    if (process.env["T7_PARALLEL_INIT"]) sendInit.forEach((f) => f());
    else sendInit[0]?.();
  });
  await allReady;
  const initWallMs = now() - tSpawn;
  const finished = new Promise<void>((res) => {
    go = res;
  });
  const tGo = now();
  const cpuGo = process.cpuUsage();
  ws.forEach((w) => w.postMessage({ type: "go" }));
  await finished;
  const wallMs = now() - tGo;
  const cpuEnd = process.cpuUsage(cpuGo);
  ws.forEach((w) => w.terminate());
  const mem = sampler?.stop();
  // roll up snapshot status (F004 SnapshotRelationshipExtraction)
  const after = jobCounts(db, o.snapshotId);
  const openJobs = ["PENDING", "CLAIMED", "RUNNING", "RETRYING"].reduce(
    (a, k) => a + (after[k] ?? 0),
    0,
  );
  // F-5 finding (M-L4): the rollup used to report "completed" for a cancel-halted run with PENDING jobs left; a snapshot with open jobs is in_progress
  const status =
    openJobs > 0
      ? "in_progress"
      : (after["FAILED"] ?? 0) > 0
        ? "completed_partial"
        : "completed";
  db.query(
    `INSERT INTO snapshot_relationship_extractions (snapshot_id, status, relationship_extractor_version, symbol_extractor_version, started_at, completed_at) VALUES (?,?,?,?,?,?) ON CONFLICT(snapshot_id) DO UPDATE SET status=excluded.status, completed_at=excluded.completed_at`,
  ).run(
    o.snapshotId,
    status,
    RELATIONSHIP_EXTRACTOR_VERSION,
    SYMBOL_EXTRACTOR_VERSION,
    new Date().toISOString(),
    new Date().toISOString(),
  );
  db.close();
  const units = done.flatMap((d) => d.units as any[]);
  const perKind: Record<string, any> = {};
  for (const u of units) {
    const k = (perKind[u.kind] ??= {
      units: 0,
      states: {},
      runMs: [] as number[],
      claimMs: 0,
      runningMs: 0,
      phaseSum: {} as Record<string, number>,
      counts: {} as Record<string, number>,
      shortCircuits: 0,
    });
    k.units++;
    k.states[u.state] = (k.states[u.state] ?? 0) + 1;
    k.runMs.push(u.runMs);
    k.claimMs += u.claimMs;
    k.runningMs += u.runningMs;
    if (u.shortCircuit) k.shortCircuits++;
    for (const [p, v] of Object.entries(u.phases as Record<string, number>))
      k.phaseSum[p] = (k.phaseSum[p] ?? 0) + v;
    for (const [c, v] of Object.entries(u.counts as Record<string, number>))
      k.counts[c] = (k.counts[c] ?? 0) + v;
  }
  for (const k of Object.values(perKind)) {
    k.runMsStats = stats(k.runMs);
    delete k.runMs;
  }
  Object.assign(result, {
    initWallMs,
    wallMs,
    cpu: {
      userMs: cpuEnd.user / 1000,
      systemMs: cpuEnd.system / 1000,
      cpuWallRatio: (cpuEnd.user + cpuEnd.system) / 1000 / wallMs,
    },
    workerInit: readyInfo.map((r) => ({ id: r.workerId, initMs: r.initMs })),
    memory: mem,
    jobsAfter: after,
    snapshotStatus: status,
    perKind,
    retries: done.flatMap((d) => d.retries),
    reclaimed: done.reduce((a, d) => a + d.reclaimed, 0),
    claimAttempts: done.reduce((a, d) => a + d.claimAttempts, 0),
    idleMs: done.reduce((a, d) => a + d.idleMs, 0),
    workerLoopMs: done.map((d) => d.loopMs),
    busyErrors: done.reduce((a, d) => a + d.busyErrors, 0),
    rssSeries: o.recordRss
      ? units.map((u) => u.rss).filter((x) => x !== undefined)
      : undefined,
  });
  return result;
}

/** CLI: bun engine.ts --db <path> --snapshot <id> --blobs <dir> --workers N [--out file.json] (used as a killable child process). */
if (import.meta.main) {
  const a = (n: string, d?: string) => {
    const i = process.argv.indexOf(`--${n}`);
    return i >= 0 ? process.argv[i + 1] : d;
  };
  const res = await runEngine({
    dbPath: a("db")!,
    snapshotId: Number(a("snapshot")),
    blobsDir: a("blobs")!,
    workers: Number(a("workers", "2")),
    ...(a("lease") ? { policy: { leaseMs: Number(a("lease")) } } : {}),
    recordRss: process.argv.includes("--rss"),
    sample: !process.argv.includes("--nosample"),
    claimPrecheck: process.argv.includes("--precheck"),
    inlineWorker: process.argv.includes("--inlineworker"),
    label: a("label") ?? null!,
  });
  if (a("out")) await Bun.write(a("out")!, JSON.stringify(res, null, 2));
  console.log(
    JSON.stringify({
      wallMs: res.wallMs,
      jobsAfter: res.jobsAfter,
      snapshotStatus: res.snapshotStatus,
    }),
  );
  process.exit(0);
}
