/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { openDb } from "./lib/db";
import { BLOBS } from "./lib/datasets";
import { canonicalGraph, checkInvariants } from "./lib/graph";
import {
  cancel,
  claim,
  DEFAULT_POLICY,
  enqueueJobs,
  jobCounts,
  lifecycle,
  pause,
  purgeSnapshot,
  resume,
} from "./lib/jobs";
import { dbBytes, freshRunDb, RUNS } from "./lib/run";
import { classifyJobs } from "./lib/unit";
import { ingestLocalSnapshot } from "./lib/snapshot";
import { runEngine } from "./engine";
import { buildSmokeDataset } from "./lib/smoke-fixture";
import { sleep, writeEvidence, readEvidence } from "./lib/common";
import { snapshotIsolation } from "./baseline";
import { captureEnvironment } from "./lib/env";

/**
 * S-L1 harness-fidelity gate (T007-L04/L05 vs contracts/local-job-engine.md). Performed by the executing agent under the
 * authorization's §7 delegation (NOT an independent owner review — recorded as such). Functional conformance only: no gate numbers.
 */
type Check = { id: string; contract: string; pass: boolean; detail: unknown };
const checks: Check[] = [];
const rec = (
  id: string,
  contract: string,
  pass: boolean,
  detail: unknown = null,
) => {
  checks.push({ id, contract, pass, detail });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${id} — ${contract}`,
    pass ? "" : JSON.stringify(detail).slice(0, 400),
  );
};
const sha = (db: Database, sid: number) => canonicalGraph(db, sid);
const F = (db: Database, sid: number, path: string, kind: string) => {
  const r = db
    .query(`SELECT id FROM snapshot_files WHERE snapshot_id=? AND path=?`)
    .get(sid, path) as { id: number };
  return `${kind}:${r.id}`;
};

await buildSmokeDataset();
const ingestExtra = async (dbPath: string) => {
  const db = openDb(dbPath);
  const r = await ingestLocalSnapshot(db, {
    treeDir: resolve(RUNS, "../datasets/smoke/tree"),
    blobsDir: BLOBS,
    identity: { provider: "github", owner: "local", name: "smoke" },
    commitSha: "0".repeat(39) + "1",
  });
  db.close();
  return r.snapshotId;
};
const baseline = readEvidence<any>("isolation-baseline.json");

// ---------------------------------------------------------------- C-A state machine, retry, containment, ordering (one instrumented run)
{
  const { dbPath, snapshotId } = freshRunDb("smoke", "slh-a");
  const db0 = openDb(dbPath);
  db0.exec(`CREATE TABLE t7_job_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, job_id INT, kind TEXT, from_state TEXT, to_state TEXT, ts INT);
    CREATE TRIGGER t7_job_state AFTER UPDATE OF state ON t7_jobs WHEN OLD.state <> NEW.state BEGIN INSERT INTO t7_job_log(job_id, kind, from_state, to_state, ts) VALUES (NEW.id, NEW.kind, OLD.state, NEW.state, NEW.updated_at); END;`);
  const a = F(db0, snapshotId, "src/a.ts", "parsed"),
    b = F(db0, snapshotId, "src/b.ts", "parsed"),
    c = F(db0, snapshotId, "src/c.ts", "parsed");
  db0.close();
  const faults = {
    [a]: { mode: "transient" as const, times: 1 },
    [b]: { mode: "permanent" as const },
    [c]: { mode: "transient" as const, times: 9 },
  };
  const r = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers: 2,
    faults,
    policy: { maxAttempts: 3, backoffBaseMs: 40 },
  });
  const db = openDb(dbPath);
  const job = (ref: string) =>
    db
      .query(
        `SELECT state, attempts, error FROM t7_jobs WHERE snapshot_id=? AND kind='parsed' AND unit_ref=?`,
      )
      .get(snapshotId, ref.split(":")[1]!) as {
      state: string;
      attempts: number;
      error: string | null;
    };
  const ja = job(a),
    jb = job(b),
    jc = job(c);
  rec(
    "C-A1 transient retry → COMPLETED",
    "guarantee 1 (bounded retry/backoff)",
    ja.state === "COMPLETED" && ja.attempts === 1,
    ja,
  );
  rec(
    "C-A2 permanent failure → FAILED, attempts=1, typed error, no stack",
    "job model (typed error) / guarantee 6",
    jb.state === "FAILED" &&
      jb.attempts === 1 &&
      !!jb.error &&
      JSON.parse(jb.error).code === "injected-permanent" &&
      !/\bat\s+\S+\s+\(/.test(jb.error),
    jb,
  );
  rec(
    "C-A3 exhausted transient → FAILED after maxAttempts=3",
    "guarantee 1 (retry bounded by policy)",
    jc.state === "FAILED" && jc.attempts === 3,
    jc,
  );
  const others = db
    .query(
      `SELECT COUNT(*) n FROM t7_jobs WHERE snapshot_id=? AND state NOT IN ('COMPLETED','SKIPPED') AND NOT (kind='parsed' AND unit_ref IN (?,?))`,
    )
    .get(snapshotId, b.split(":")[1], c.split(":")[1]) as { n: number };
  rec(
    "C-A4 failure containment: all other units terminal-success; snapshot completed_partial",
    "guarantee 6 (FR-008)",
    others.n === 0 && r.snapshotStatus === "completed_partial",
    { others, status: r.snapshotStatus },
  );
  const log = db
    .query(
      `SELECT job_id, kind, from_state f, to_state t, ts FROM t7_job_log ORDER BY seq`,
    )
    .all() as {
    job_id: number;
    kind: string;
    f: string;
    t: string;
    ts: number;
  }[];
  const contractAllowed = new Set([
    "PENDING>CLAIMED",
    "CLAIMED>RUNNING",
    "RUNNING>COMPLETED",
    "RUNNING>FAILED",
    "RUNNING>RETRYING",
    "RUNNING>SKIPPED",
    "RETRYING>PENDING",
  ]);
  const seen = new Map<string, number>();
  for (const l of log)
    seen.set(`${l.f}>${l.t}`, (seen.get(`${l.f}>${l.t}`) ?? 0) + 1);
  const outside = [...seen.keys()].filter((k) => !contractAllowed.has(k));
  rec(
    "C-A5 every observed transition is in the contract state machine",
    "state machine",
    outside.length === 0,
    { observed: Object.fromEntries(seen), outside },
  );
  // backoff spacing for job c: RETRYING(ts) → PENDING(ts) gap ≥ base*2^(attempt-1) minus scheduling slack is impossible (claim sets PENDING only when not_before elapsed)
  const cid = (
    db
      .query(
        `SELECT id FROM t7_jobs WHERE snapshot_id=? AND kind='parsed' AND unit_ref=?`,
      )
      .get(snapshotId, c.split(":")[1]) as { id: number }
  ).id;
  const cl = log.filter((l) => l.job_id === cid);
  const gaps: number[] = [];
  for (let i = 0; i < cl.length - 1; i++)
    if (cl[i]!.t === "RETRYING" && cl[i + 1]!.t === "PENDING")
      gaps.push(cl[i + 1]!.ts - cl[i]!.ts);
  rec(
    "C-A6 backoff is exponential and honored (gap1≥40ms, gap2≥80ms)",
    "guarantee 1 (bounded backoff)",
    gaps.length === 2 && gaps[0]! >= 40 && gaps[1]! >= 80,
    { gaps },
  );
  const lastDone = (k: string) =>
    Math.max(
      0,
      ...log
        .filter(
          (l) =>
            l.kind === k && ["COMPLETED", "SKIPPED", "FAILED"].includes(l.t),
        )
        .map((l) => (l.job_id ? log.indexOf(l) : 0)),
    );
  const firstClaim = (k: string) =>
    Math.min(
      ...log
        .filter((l) => l.kind === k && l.t === "CLAIMED")
        .map((l) => log.indexOf(l)),
    );
  rec(
    "C-A7 ordering: no contains claim before all symbols units terminal; no parsed claim before all contains units terminal",
    "guarantee 5",
    firstClaim("contains") > lastDone("symbols") &&
      firstClaim("parsed") > lastDone("contains"),
    {
      symbolsLastDone: lastDone("symbols"),
      containsFirstClaim: firstClaim("contains"),
      containsLastDone: lastDone("contains"),
      parsedFirstClaim: firstClaim("parsed"),
    },
  );
  rec(
    "C-A8 SQLite invariants after run with failures",
    "persistence correctness",
    checkInvariants(db, snapshotId).length === 0,
    checkInvariants(db, snapshotId),
  );
  rec(
    "C-A9 lifecycle projection FAILED when a unit FAILED",
    "guarantee 7",
    lifecycle(db, snapshotId) === "FAILED",
    lifecycle(db, snapshotId),
  );
  db.close();
}

// ---------------------------------------------------------------- C-B stale claim reclaim + barrier (time-injected, in-process)
{
  const { dbPath, snapshotId } = freshRunDb("smoke", "slh-b");
  const db = openDb(dbPath);
  enqueueJobs(db, snapshotId, classifyJobs(db, snapshotId), 1_000);
  const pol = { ...DEFAULT_POLICY, leaseMs: 5_000 };
  const nSym = (
    db.query(`SELECT COUNT(*) n FROM t7_jobs WHERE kind='symbols'`).get() as {
      n: number;
    }
  ).n;
  const claimed: number[] = [];
  for (let i = 0; i < nSym; i++) {
    const c = claim(db, snapshotId, "dead-worker", pol, 1_000);
    if (c.job) claimed.push(c.job.id);
  }
  const barrier = claim(db, snapshotId, "alive", pol, 2_000);
  rec(
    "C-B1 barrier: with all symbols claimed (in flight), no contains unit is claimable",
    "guarantee 5",
    claimed.length === nSym &&
      barrier.job === null &&
      barrier.reason === "wait",
    { claimed: claimed.length, nSym, reason: barrier.reason },
  );
  const before = db
    .query(
      `SELECT COUNT(*) n FROM t7_jobs WHERE state='PENDING' AND kind='contains'`,
    )
    .get();
  const re = claim(db, snapshotId, "alive", pol, 1_000 + 5_000 + 1);
  const row = db
    .query(
      `SELECT reclaims, attempts, state, claimed_by FROM t7_jobs WHERE id=?`,
    )
    .get(re.job!.id) as any;
  rec(
    "C-B2 stale CLAIMED units reclaimed after lease timeout; attempts unchanged; reclaims counted",
    "guarantee 1 (lease reclaim)",
    re.reclaimed === nSym &&
      row.reclaims === 1 &&
      row.attempts === 0 &&
      row.claimed_by === "alive",
    { reclaimed: re.reclaimed, row, before },
  );
  db.close();
}

// ---------------------------------------------------------------- C-C repo/snapshot scoping, pause/resume, cancel, purge, lifecycle (smoke + second snapshot)
{
  const { dbPath, snapshotId: sA } = freshRunDb("smoke", "slh-c");
  const sB = await ingestExtra(dbPath);
  const db = openDb(dbPath);
  enqueueJobs(db, sA, classifyJobs(db, sA));
  enqueueJobs(db, sB, classifyJobs(db, sB));
  rec(
    "C-C0 lifecycle QUEUED before run",
    "guarantee 7",
    lifecycle(db, sA) === "QUEUED",
    lifecycle(db, sA),
  );
  pause(db, sA);
  rec(
    "C-C1 lifecycle PAUSED (needs t7_control — not derivable from the 7 job states)",
    "guarantee 7 / GAP",
    lifecycle(db, sA) === "PAUSED",
    "CONTRACT GAP recorded",
  );
  const rB = await runEngine({
    dbPath,
    snapshotId: sB,
    blobsDir: BLOBS,
    workers: 2,
    enqueue: false,
  });
  const cA = jobCounts(db, sA),
    cB = jobCounts(db, sB);
  rec(
    "C-C2 scoping: pausing snapshot A does not affect B; A jobs untouched",
    "guarantee 4",
    (cB["COMPLETED"] ?? 0) + (cB["SKIPPED"] ?? 0) ===
      Object.values(cB).reduce((a, b) => a + b, 0) &&
      (cA["PENDING"] ?? 0) === Object.values(cA).reduce((a, b) => a + b, 0),
    { cA, cB, statusB: rB.snapshotStatus },
  );
  resume(db, sA);
  const rA = await runEngine({
    dbPath,
    snapshotId: sA,
    blobsDir: BLOBS,
    workers: 2,
    enqueue: false,
  });
  const ga = canonicalGraph(db, sA),
    gb = canonicalGraph(db, sB);
  const norm = (l: string[]) => l.length; // keys embed snapshotId, so compare structure counts here; identity determinism is covered in C-D
  rec(
    "C-C3 resume completes A; both snapshots have equal graph size",
    "guarantee 4",
    norm(ga.lines) === norm(gb.lines) && lifecycle(db, sA) === "GRAPHIFIED",
    { a: ga.counts, b: gb.counts, statusA: rA.snapshotStatus },
  );
  purgeSnapshot(db, sA);
  const left = [
    "snapshots",
    "snapshot_files",
    "file_extractions",
    "symbols",
    "relationships",
    "directories",
  ].map((t) => [
    t,
    (
      db
        .query(
          `SELECT COUNT(*) n FROM ${t} WHERE ${t === "snapshots" ? "id" : "snapshot_id"}=?`,
        )
        .get(sA) as { n: number }
    ).n,
  ]);
  const jl = (
    db.query(`SELECT COUNT(*) n FROM t7_jobs WHERE snapshot_id=?`).get(sA) as {
      n: number;
    }
  ).n;
  const keepB = (
    db
      .query(`SELECT COUNT(*) n FROM relationships WHERE snapshot_id=?`)
      .get(sB) as { n: number }
  ).n;
  rec(
    "C-C4 purge removes snapshot A jobs + artifacts, leaves B intact",
    "guarantee 8",
    left.every(([, n]) => n === 0) && jl === 0 && keepB > 0,
    { left, jl, keepB },
  );
  db.close();
}

// ---------------------------------------------------------------- C-D determinism, comparator sensitivity, phase attribution, concurrency bound, idempotency, pause/cancel mid-run, kill/restart (R-S = repo-atlas src/lib, 83 Tier-1 files)
const RS = "repo-atlas-rs";
const hashes: Record<string, string> = {};
let ref: {
  snapshotId: number;
  dbPath: string;
  graph: ReturnType<typeof canonicalGraph>;
  run: any;
} | null = null;
for (const w of [1, 2, 4]) {
  const { dbPath, snapshotId } = freshRunDb(RS, `slh-w${w}`);
  // concurrency bound probe
  let maxActive = 0;
  const probe = openDb(dbPath, { readonly: true });
  const h = setInterval(() => {
    try {
      const n = (
        probe
          .query(
            `SELECT COUNT(*) n FROM t7_jobs WHERE state IN ('CLAIMED','RUNNING')`,
          )
          .get() as { n: number }
      ).n;
      if (n > maxActive) maxActive = n;
    } catch {
      /* db busy */
    }
  }, 3);
  const run = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers: w,
    recordRss: true,
  });
  clearInterval(h);
  probe.close();
  const db = openDb(dbPath);
  const g = canonicalGraph(db, snapshotId);
  const inv = checkInvariants(db, snapshotId);
  hashes[`w${w}`] = g.hash;
  if (w === 2) {
    // phase attribution on the parsed units
    const P = run.perKind.parsed;
    const parts = [
      "classify",
      "read",
      "parse",
      "facts",
      "resolve",
      "keys",
      "persist",
    ].reduce((a, k) => a + (P.phaseSum[k] ?? 0), 0);
    const attrErr = Math.abs(parts - P.phaseSum.total) / P.phaseSum.total;
    rec(
      "C-D3 parsed-unit phase attribution: Σ phases ≈ unit total (≤2% error), persist>0, parse>0",
      "metric fidelity",
      attrErr <= 0.02 && P.phaseSum.persist > 0 && P.phaseSum.parse > 0,
      { attrErr, phaseSum: P.phaseSum },
    );
    const accounted =
      Object.values(run.perKind as Record<string, any>).reduce(
        (a, k) => a + k.claimMs + k.runningMs + k.runMsStats.mean * k.units,
        0,
      ) + run.idleMs;
    const loop = (run.workerLoopMs as number[]).reduce((a, b) => a + b, 0);
    rec(
      "C-D4 worker time accounting: Σ(claim+running+unit)+idle ≈ Σ worker loop time (≤5%)",
      "metric fidelity",
      Math.abs(accounted - loop) / loop <= 0.05,
      { accounted, loop },
    );
    const need = [
      "wallMs",
      "cpu",
      "memory",
      "workerInit",
      "jobsAfter",
      "perKind",
      "retries",
      "reclaimed",
      "claimAttempts",
      "idleMs",
      "rssSeries",
      "initWallMs",
    ];
    const missing = need.filter((k) => run[k] === undefined);
    const pk = [
      "units",
      "states",
      "phaseSum",
      "counts",
      "runMsStats",
      "claimMs",
      "runningMs",
    ];
    const missingPk = Object.entries(
      run.perKind as Record<string, any>,
    ).flatMap(([kind, v]) =>
      pk.filter((k) => v[k] === undefined).map((k) => `${kind}.${k}`),
    );
    const cnt = [
      "astNodes",
      "bytes",
      "facts",
      "relationships",
      "resolved",
      "ambiguous",
      "unknown",
      "candidates",
      "duplicateKeys",
    ].filter((k) => P.counts[k] === undefined);
    rec(
      "C-D5 metrics completeness (wall, CPU, RSS peak/avg/heap/external, per-phase, jobs, retries, reclaims, counts)",
      "protocol §8/§13",
      missing.length + missingPk.length + cnt.length === 0 &&
        run.memory.peakRss > 0 &&
        run.cpu.userMs > 0,
      { missing, missingPk, cnt },
    );
    ref = { snapshotId, dbPath, graph: g, run };
    rec(
      "C-D6 concurrency bound: observed active (CLAIMED|RUNNING) ≤ workers",
      "guarantee 3",
      maxActive <= w && maxActive >= 1,
      { maxActive, workers: w },
    );
  }
  rec(
    `C-D1.w${w} SQLite invariants (integrity, FKs, dangling refs, evidence-state shape) after ${w}-worker run`,
    "persistence correctness",
    inv.length === 0 && run.jobsAfter["FAILED"] === undefined,
    { inv, jobs: run.jobsAfter },
  );
  if (w === 1)
    rec("C-D1b concurrency=1 bound", "guarantee 3", maxActive <= 1, {
      maxActive,
    });
  db.close();
}
rec(
  "C-D2 determinism: identical canonical graph hash at 1, 2, 4 workers",
  "G1 method",
  new Set(Object.values(hashes)).size === 1,
  hashes,
);
{
  // comparator sensitivity (negative control)
  const { dbPath, snapshotId } = freshRunDb(RS, "slh-neg");
  await runEngine({ dbPath, snapshotId, blobsDir: BLOBS, workers: 2 });
  const db = openDb(dbPath);
  const g1 = canonicalGraph(db, snapshotId);
  db.query(
    `UPDATE relationships SET evidence_state='UNKNOWN', target_kind=NULL, target_id=NULL WHERE id=(SELECT id FROM relationships WHERE snapshot_id=? AND evidence_state='RESOLVED' AND relationship_type='CALLS' LIMIT 1)`,
  ).run(snapshotId);
  const g2 = canonicalGraph(db, snapshotId);
  rec(
    "C-D2b comparator sensitivity: a single altered relationship changes the hash",
    "G1 method",
    g1.hash !== g2.hash && g1.hash === hashes["w2"],
    { same: g1.hash === hashes["w2"] },
  );
  db.close();
}
{
  // idempotency: redelivered COMPLETED unit (checkpoint kept → short-circuit; checkpoint cleared → recompute) must leave byte-identical persisted results
  const { dbPath, snapshotId } = freshRunDb(RS, "slh-idem");
  await runEngine({ dbPath, snapshotId, blobsDir: BLOBS, workers: 2 });
  const db = openDb(dbPath);
  const before = canonicalGraph(db, snapshotId).hash;
  const victim = db
    .query(
      `SELECT id, unit_ref FROM t7_jobs WHERE kind='parsed' AND state='COMPLETED' AND unit_ref IN (SELECT CAST(sf.id AS TEXT) FROM snapshot_files sf JOIN file_extractions fe ON fe.snapshot_file_id=sf.id JOIN relationships r ON r.evidence_file_extraction_id=fe.id WHERE r.extraction_method='call-expression') LIMIT 1`,
    )
    .get() as { id: number; unit_ref: string };
  db.query(
    `UPDATE t7_jobs SET state='PENDING', claimed_by=NULL WHERE id=?`,
  ).run(victim.id);
  const r1 = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers: 1,
    enqueue: false,
  });
  const h1 = canonicalGraph(db, snapshotId).hash;
  db.query(
    `UPDATE t7_jobs SET state='PENDING', checkpoint=NULL, claimed_by=NULL WHERE id=?`,
  ).run(victim.id);
  const r2 = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers: 1,
    enqueue: false,
  });
  const h2 = canonicalGraph(db, snapshotId).hash;
  const dupes = (
    db
      .query(
        `SELECT COUNT(*) n FROM (SELECT relationship_key FROM relationships WHERE snapshot_id=? GROUP BY relationship_key HAVING COUNT(*)>1)`,
      )
      .get(snapshotId) as { n: number }
  ).n;
  rec(
    "C-D7 idempotency: redelivered COMPLETED unit short-circuits (checkpoint kept) and recomputes identically (checkpoint cleared); no duplicates",
    "guarantee 2 (F-4)",
    r1.perKind.parsed.shortCircuits === 1 &&
      r2.perKind.parsed.shortCircuits === 0 &&
      h1 === before &&
      h2 === before &&
      dupes === 0,
    {
      sc1: r1.perKind.parsed.shortCircuits,
      sc2: r2.perKind.parsed.shortCircuits,
      same1: h1 === before,
      same2: h2 === before,
      dupes,
    },
  );
  const r3 = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers: 2,
    enqueue: true,
  });
  rec(
    "C-D8 no-change re-run spawns no workers (FR-009 short-circuit)",
    "guarantee 2",
    r3.shortCircuitedRun === true,
    { wall: r3.engineTotalMs },
  );
  db.close();
}
{
  // pause mid-run → no new claims; resume → identical graph; cancel mid-run → consistent partial state
  const { dbPath, snapshotId } = freshRunDb(RS, "slh-pause");
  const ctl = openDb(dbPath);
  const p = runEngine({ dbPath, snapshotId, blobsDir: BLOBS, workers: 2 });
  let sawSome = false;
  for (let i = 0; i < 4000; i++) {
    await sleep(5);
    const c = jobCounts(ctl, snapshotId);
    if ((c["COMPLETED"] ?? 0) >= 40) {
      sawSome = true;
      break;
    }
  }
  pause(ctl, snapshotId);
  let quiet = false;
  for (let i = 0; i < 2000; i++) {
    await sleep(5);
    const c = jobCounts(ctl, snapshotId);
    if (!c["RUNNING"] && !c["CLAIMED"]) {
      quiet = true;
      break;
    }
  }
  const c1 = jobCounts(ctl, snapshotId);
  await sleep(400);
  const c2 = jobCounts(ctl, snapshotId);
  const noNewClaims = JSON.stringify(c1) === JSON.stringify(c2);
  const inv1 = checkInvariants(ctl, snapshotId);
  resume(ctl, snapshotId);
  const res = await p;
  const g = canonicalGraph(ctl, snapshotId);
  rec(
    "C-D9 pause mid-run: RUNNING units finish, nothing new claimed while paused, resume completes with graph identical to uninterrupted",
    "guarantee 4 (F-5)",
    sawSome &&
      quiet &&
      noNewClaims &&
      inv1.length === 0 &&
      g.hash === hashes["w2"] &&
      res.snapshotStatus === "completed",
    {
      sawSome,
      quiet,
      noNewClaims,
      c1,
      inv1,
      identical: g.hash === hashes["w2"],
    },
  );
  ctl.close();
  const fresh = freshRunDb(RS, "slh-cancel");
  const ctl2 = openDb(fresh.dbPath);
  const pc = runEngine({
    dbPath: fresh.dbPath,
    snapshotId: fresh.snapshotId,
    blobsDir: BLOBS,
    workers: 2,
  });
  for (let i = 0; i < 4000; i++) {
    await sleep(5);
    if ((jobCounts(ctl2, fresh.snapshotId)["COMPLETED"] ?? 0) >= 40) break;
  }
  cancel(ctl2, fresh.snapshotId);
  const rc = await pc;
  const cc = jobCounts(ctl2, fresh.snapshotId);
  const invC = checkInvariants(ctl2, fresh.snapshotId);
  const cancelled = (
    ctl2
      .query(`SELECT COUNT(*) n FROM t7_jobs WHERE error LIKE '%cancelled%'`)
      .get() as { n: number }
  ).n;
  rec(
    "C-D10 cancel mid-run: consistent partial state (no RUNNING/CLAIMED left, invariants hold, completed units persisted, unclaimed → FAILED(cancelled))",
    "guarantee 4 (F-5) + GAP: contract has no CANCELLED state",
    !cc["RUNNING"] &&
      !cc["CLAIMED"] &&
      !cc["PENDING"] &&
      !cc["RETRYING"] &&
      invC.length === 0 &&
      cancelled > 0 &&
      rc.snapshotStatus === "completed_partial",
    { cc, invC, cancelled },
  );
  ctl2.close();
}
{
  // kill -9 / restart (functional S-L1 check; the G2 evidence run is F-1 on R-M in the measurement phase)
  const { dbPath, snapshotId } = freshRunDb(RS, "slh-kill");
  const engine = resolve(import.meta.dir, "engine.ts");
  const args = [
    "bun",
    engine,
    "--db",
    dbPath,
    "--snapshot",
    String(snapshotId),
    "--blobs",
    BLOBS,
    "--workers",
    "2",
    "--lease",
    "1500",
  ];
  const child = Bun.spawn(args, { stdout: "ignore", stderr: "ignore" });
  const ro = openDb(dbPath, { readonly: true });
  let killedAt: Record<string, number> | null = null;
  for (let i = 0; i < 20000; i++) {
    await sleep(2);
    try {
      const c = jobCounts(ro as any, snapshotId, "parsed");
      const done = (c["COMPLETED"] ?? 0) + (c["SKIPPED"] ?? 0),
        total = Object.values(c).reduce((a, b) => a + b, 0);
      if (total > 0 && done >= Math.max(5, Math.floor(total * 0.3))) {
        process.kill(child.pid, "SIGKILL");
        killedAt = { ...c };
        break;
      }
    } catch {
      /* busy */
    }
  }
  await child.exited;
  ro.close();
  const db = openDb(dbPath);
  const afterKill = jobCounts(db, snapshotId);
  const integrity = checkInvariants(db, snapshotId);
  const openAfterKill = ["PENDING", "CLAIMED", "RUNNING", "RETRYING"].reduce(
    (a, s) => a + (afterKill[s] ?? 0),
    0,
  );
  db.close();
  const t = performance.now();
  const restart = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const restartExit = await restart.exited;
  const restartErr = (await new Response(restart.stderr).text()).slice(0, 800);
  const restartOut = (await new Response(restart.stdout).text()).slice(0, 300);
  const recoveryMs = performance.now() - t;
  const db2 = openDb(dbPath);
  const g = canonicalGraph(db2, snapshotId);
  const inv2 = checkInvariants(db2, snapshotId);
  const final = jobCounts(db2, snapshotId);
  const reclaims = (
    db2.query(`SELECT COALESCE(SUM(reclaims),0) n FROM t7_jobs`).get() as {
      n: number;
    }
  ).n;
  db2.close();
  rec(
    "C-D11 kill -9 mid-run then restart: DB consistent after kill, restart recovers stale claims, completes, graph identical to clean run, no duplicates",
    "guarantees 1–2 (F-1 functional)",
    killedAt !== null &&
      openAfterKill > 0 &&
      integrity.length === 0 &&
      inv2.length === 0 &&
      g.hash === hashes["w2"] &&
      (final["FAILED"] ?? 0) === 0,
    {
      killedAt,
      afterKill,
      integrity,
      inv2,
      identical: g.hash === hashes["w2"],
      recoveryMs,
      restartExit,
      restartErr,
      restartOut,
      reclaims,
      final,
    },
  );
}

// ---------------------------------------------------------------- isolation
{
  const now = snapshotIsolation();
  const dataSame = JSON.stringify(now.data) === JSON.stringify(baseline.data);
  const refsSame = ["GitNexus", "graphify", "codegraph"].every(
    (r) => JSON.stringify(now.refs[r]) === JSON.stringify(baseline.refs[r]),
  );
  rec(
    "C-I1 production data files (data/*) unchanged (sha256)",
    "isolation",
    dataSame,
    { now: now.data, base: baseline.data },
  );
  rec(
    "C-I2 no changes under src/ tests/ data/ public/ package.json bun.lock wrangler.toml vite.config.ts",
    "isolation",
    now.srcTestsDataPublicPorcelain.length === 0,
    now.srcTestsDataPublicPorcelain,
  );
  rec(
    "C-I3 reference repos: HEAD, porcelain and .git/index (mtime/size) unchanged",
    "isolation (reference repos read-only)",
    refsSame && now.repoHead === baseline.repoHead,
    { refs: now.refs },
  );
  const scratchOnly =
    existsSync(resolve(RUNS)) &&
    RUNS.includes("/repo-atlas/.cache/t007-local/");
  rec(
    "C-I4 scratch storage is inside repo-atlas/.cache/t007-local (git-ignored), never data/",
    "isolation",
    scratchOnly,
    RUNS,
  );
}

const pass = checks.every((c) => c.pass);
writeEvidence("s-l1-fidelity.json", {
  gate: "S-L1",
  performedBy:
    "executing agent under authorization §7 delegation (not an independent owner review)",
  at: new Date().toISOString(),
  result: pass ? "PASS" : "FAIL",
  passed: checks.filter((c) => c.pass).length,
  total: checks.length,
  checks,
  environment: captureEnvironment(),
});
console.log(
  `\nS-L1: ${pass ? "PASS" : "FAIL"} (${checks.filter((c) => c.pass).length}/${checks.length})`,
);
process.exit(pass ? 0 : 1);
