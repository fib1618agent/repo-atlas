import { Database } from "bun:sqlite";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { SCRATCH, now, startMemSampler } from "./common";
import { BLOBS, dsDir } from "./datasets";
import { openDb } from "./db";
import { createFsR2 } from "./fsr2";
import { installWasm } from "./wasm";
import {
  classifyJobs,
  newUnitCtx,
  runUnit,
  type Faults,
  type Phases,
} from "./unit";
import { KIND_ORDER, type Job } from "./jobs";

export const RUNS = resolve(SCRATCH, "runs");

/** Fresh working copy of a dataset's template DB (snapshot rows only; no graph). */
export function freshRunDb(
  dataset: string,
  label: string,
  journal: "WAL" | "DELETE" = "WAL",
): { dbPath: string; snapshotId: number } {
  mkdirSync(RUNS, { recursive: true });
  const dbPath = resolve(RUNS, `${dataset}--${label}.db`);
  for (const suf of ["", "-wal", "-shm", "-journal"])
    rmSync(dbPath + suf, { force: true });
  copyFileSync(resolve(dsDir(dataset), "template.db"), dbPath);
  const db = openDb(dbPath, { journal });
  const snapshotId = (
    db.query("SELECT MIN(id) AS id FROM snapshots").get() as { id: number }
  ).id;
  db.close();
  return { dbPath, snapshotId };
}

export function dbBytes(dbPath: string): number {
  let n = 0;
  for (const suf of ["", "-wal"]) {
    const f = Bun.file(dbPath + suf);
    if (existsSync(dbPath + suf)) n += f.size;
  }
  return n;
}

/** Inline baseline: identical unit code, sequential, in-process, no job table interaction (no claim / RUNNING / COMPLETED writes). */
export async function runInline(
  dbPath: string,
  snapshotId: number,
  o: {
    faults?: Faults;
    journal?: "WAL" | "DELETE";
    kinds?: string[];
    sample?: boolean;
  } = {},
) {
  await installWasm();
  setTestCloudflareEnv({ SNAPSHOTS: createFsR2(BLOBS) });
  const db = openDb(dbPath, { journal: o.journal ?? "WAL" });
  const ctx = newUnitCtx(db, snapshotId, BLOBS, o.faults ?? {}, 3);
  ctx.inline = true;
  const jobs = classifyJobs(db, snapshotId).filter(
    (j) => !o.kinds || o.kinds.includes(j.kind),
  );
  jobs.sort((a, b) => KIND_ORDER[a.kind]! - KIND_ORDER[b.kind]!);
  const perKind: Record<
    string,
    { units: number; wallMs: number; phaseSum: Phases }
  > = {};
  const sampler = o.sample === false ? null : startMemSampler(50);
  const cpu0 = process.cpuUsage();
  const t0 = now();
  for (const j of jobs) {
    const job: Job = {
      id: 0,
      snapshot_id: snapshotId,
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
    const t = now();
    const out = await runUnit(ctx, job);
    const k = (perKind[j.kind] ??= { units: 0, wallMs: 0, phaseSum: {} });
    k.units++;
    k.wallMs += now() - t;
    for (const [p, v] of Object.entries(out.phases))
      k.phaseSum[p] = (k.phaseSum[p] ?? 0) + v;
  }
  const wallMs = now() - t0;
  const cpuEnd = process.cpuUsage(cpu0);
  const memory = sampler?.stop();
  db.close();
  return {
    wallMs,
    cpu: {
      userMs: cpuEnd.user / 1000,
      systemMs: cpuEnd.system / 1000,
      cpuWallRatio: (cpuEnd.user + cpuEnd.system) / 1000 / wallMs,
    },
    memory,
    perKind,
  };
}
