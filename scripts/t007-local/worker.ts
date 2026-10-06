/// <reference lib="webworker" />
import type { Database } from "bun:sqlite";
import { setTestCloudflareEnv } from "../../src/lib/code-intel/persistence/cloudflare-env";
import { installWasm } from "./lib/wasm";
import { openDb } from "./lib/db";
import { createFsR2 } from "./lib/fsr2";
import {
  claim,
  failJob,
  KIND_ORDER,
  markRunning,
  type Job,
  type Policy,
} from "./lib/jobs";
import {
  classifyJobs,
  newUnitCtx,
  runUnit,
  type Faults,
  type UnitCtx,
} from "./lib/unit";

/** Engine worker thread: one WASM instance + one SQLite connection; claims, executes, completes units (contract: local-job-engine.md). */
export type WorkerInit = {
  type: "init";
  workerId: string;
  dbPath: string;
  snapshotId: number;
  blobsDir: string;
  policy: Policy;
  faults: Faults;
  journal: "WAL" | "DELETE";
  synchronous: "NORMAL" | "FULL" | "OFF";
  idlePollMs: number;
  recordRss: boolean;
  claimPrecheck?: boolean;
  inline?: boolean;
  simulateKillAfter?: number;
};
let db: Database;
let ctx: UnitCtx;
let init: WorkerInit;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function loop() {
  const units: {
    kind: string;
    state: string;
    claimMs: number;
    runningMs: number;
    runMs: number;
    phases: Record<string, number>;
    counts: Record<string, number>;
    rss?: number;
    shortCircuit?: boolean;
  }[] = [];
  const retries: { kind: string; unitRef: string; state: string }[] = [];
  let idleMs = 0,
    reclaimed = 0,
    claimAttempts = 0,
    busyErrors = 0;
  const tStart = performance.now();
  if (init.inline) {
    // inline-in-worker arm (M-L4 baseline review): identical unit code and order, in a worker thread, NO job-table interaction
    ctx.inline = true;
    const list = classifyJobs(db, init.snapshotId);
    list.sort((a, b) => KIND_ORDER[a.kind]! - KIND_ORDER[b.kind]!);
    for (const j of list) {
      const job: Job = {
        id: 0,
        snapshot_id: init.snapshotId,
        kind: j.kind,
        kind_order: KIND_ORDER[j.kind]!,
        unit_ref: j.unitRef,
        state: "RUNNING",
        attempts: 0,
        reclaims: 0,
        checkpoint: null,
        claimed_by: null,
        claimed_at: null,
        error: null,
      };
      const tu = performance.now();
      const out = await runUnit(ctx, job);
      units.push({
        kind: j.kind,
        state: out.state,
        claimMs: 0,
        runningMs: 0,
        runMs: performance.now() - tu,
        phases: out.phases,
        counts: out.counts,
      });
    }
    return {
      units,
      retries,
      idleMs,
      reclaimed,
      claimAttempts,
      busyErrors,
      loopMs: performance.now() - tStart,
    };
  }
  for (;;) {
    const tc = performance.now();
    let c;
    try {
      c = claim(
        db,
        init.snapshotId,
        init.workerId,
        init.policy,
        Date.now(),
        init.claimPrecheck ?? false,
      );
    } catch (e) {
      busyErrors++;
      if (String(e).includes("locked") || String(e).includes("BUSY")) {
        await sleep(2);
        continue;
      }
      throw e;
    }
    claimAttempts++;
    const claimMs = performance.now() - tc;
    reclaimed += c.reclaimed;
    if (!c.job) {
      if (c.reason === "none-left" || c.reason === "cancelled") break;
      const ti = performance.now();
      await sleep(init.idlePollMs);
      idleMs += performance.now() - ti;
      continue;
    }
    const job: Job = c.job;
    const tr = performance.now();
    markRunning(db, job.id);
    const runningMs = performance.now() - tr;
    const tu = performance.now();
    try {
      const out = await runUnit(ctx, job);
      units.push({
        kind: job.kind,
        state: out.state,
        claimMs,
        runningMs,
        runMs: performance.now() - tu,
        phases: out.phases,
        counts: out.counts,
        ...(out.shortCircuit ? { shortCircuit: true } : {}),
        ...(init.recordRss ? { rss: process.memoryUsage.rss() } : {}),
      });
    } catch (e) {
      const st = failJob(db, job, e, init.policy);
      units.push({
        kind: job.kind,
        state: st,
        claimMs,
        runningMs,
        runMs: performance.now() - tu,
        phases: {},
        counts: {},
      });
      if (st === "RETRYING")
        retries.push({ kind: job.kind, unitRef: job.unit_ref, state: st });
    }
  }
  return {
    units,
    retries,
    idleMs,
    reclaimed,
    claimAttempts,
    busyErrors,
    loopMs: performance.now() - tStart,
  };
}

self.onmessage = async (ev: MessageEvent) => {
  const m = ev.data;
  if (m.type === "init") {
    init = m;
    const t = performance.now();
    const w = await installWasm();
    setTestCloudflareEnv({ SNAPSHOTS: createFsR2(init.blobsDir) });
    db = openDb(init.dbPath, {
      journal: init.journal,
      synchronous: init.synchronous,
    });
    ctx = newUnitCtx(
      db,
      init.snapshotId,
      init.blobsDir,
      init.faults,
      init.policy.maxAttempts,
    );
    // warm the grammar/parser cold path is deliberately NOT done here: cold costs land on each language's first unit (M-L7 measures them separately)
    (self as unknown as Worker).postMessage({
      type: "ready",
      workerId: init.workerId,
      initMs: performance.now() - t,
      wasmCompile: w,
    });
  } else if (m.type === "go") {
    const res = await loop();
    db.close();
    (self as unknown as Worker).postMessage({
      type: "done",
      workerId: init.workerId,
      ...res,
    });
  }
};
