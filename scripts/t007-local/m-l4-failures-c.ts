/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { openDb } from "./lib/db";
import { BLOBS, dsDir } from "./lib/datasets";
import { createScratchDb } from "./lib/db";
import { ingestLocalSnapshot } from "./lib/snapshot";
import { generate } from "./lib/fixtures";
import {
  canonicalGraph,
  checkCompleteness,
  checkInvariants,
} from "./lib/graph";
import { jobCounts } from "./lib/jobs";
import { freshRunDb, RUNS } from "./lib/run";
import { arg, now, sleep, stats, writeEvidence } from "./lib/common";
import { captureEnvironment } from "./lib/env";
import { runEngine } from "./engine";

/**
 * M-L4 part 3, "rev C" — strengthened failure checks after the KG Engineer / LSP-Index Engineer reviews. The rev-A/B evidence files
 * (m-l4-f1/f1b/f2/f3/f4/f5/f6.json) are preserved untouched; this script ADDS: F-1 with hard "completed work unchanged" assertions,
 * F-1c random-time kills concentrated in the production symbols stage, F-2 with full canonical-graph diff + real mid-persist ROLLBACK
 * injection, F-3 mid-persist transient recovery, F-4e concurrent duplicate execution of the same unit (lease << unit time).
 * No auto-retry; every attempt is classified. usage: bun m-l4-failures-c.ts --test f1|f1c|f2|f3c|f4e|all
 */
const DS = "repo-atlas-rm";
const which = arg("test", "all")!;
const engineCli = resolve(import.meta.dir, "engine.ts");
const env = captureEnvironment();
const PARSED = [
  "import-declaration",
  "call-expression",
  "extends-clause",
  "implements-clause",
  "export-declaration",
];

function perFile(db: Database, sid: number) {
  const rows = db
    .query(
      `SELECT sf.path p, r.extraction_method m, r.relationship_key k, r.evidence_state s FROM relationships r JOIN file_extractions fe ON fe.id=r.evidence_file_extraction_id JOIN snapshot_files sf ON sf.id=fe.snapshot_file_id WHERE r.snapshot_id=?`,
    )
    .all(sid) as any[];
  const map = new Map<string, string[]>();
  for (const r of rows)
    (map.get(r.p) ?? map.set(r.p, []).get(r.p)!).push(`${r.m}|${r.k}|${r.s}`);
  for (const v of map.values()) v.sort();
  return map;
}
const parsedRows = (m: Map<string, string[]>, p: string) =>
  (m.get(p) ?? []).filter((x) => PARSED.includes(x.split("|")[0]!));
const totals = (db: Database, sid: number) =>
  db
    .query(
      `SELECT (SELECT COUNT(*) FROM symbols WHERE snapshot_id=?1) sy, (SELECT COUNT(*) FROM relationships WHERE snapshot_id=?1) re, (SELECT COUNT(*) FROM relationship_candidates c JOIN relationships r ON r.id=c.relationship_id WHERE r.snapshot_id=?1) ca, (SELECT COUNT(*) FROM file_extractions WHERE snapshot_id=?1) fe`,
    )
    .get(sid) as any;
const jobStats = (db: Database, sid: number) => ({
  states: jobCounts(db, sid),
  ...(db
    .query(
      `SELECT COALESCE(SUM(attempts),0) attemptsSum, COALESCE(SUM(reclaims),0) reclaimsSum, COUNT(*) jobRows FROM t7_jobs WHERE snapshot_id=?`,
    )
    .get(sid) as any),
});
const finalChecks = (db: Database, sid: number) => [
  ...checkInvariants(db, sid),
  ...checkCompleteness(db, sid),
];

async function cleanReference() {
  const hashes: string[] = [],
    dropped: number[] = [];
  let lines!: string[], files!: Map<string, string[]>, tot: any;
  for (let i = 0; i < 3; i++) {
    const { dbPath, snapshotId } = freshRunDb(DS, `m-l4-c-clean-${i}`);
    const r = await runEngine({
      dbPath,
      snapshotId,
      blobsDir: BLOBS,
      workers: 2,
    });
    const db = openDb(dbPath);
    const g = canonicalGraph(db, snapshotId);
    hashes.push(g.hash);
    dropped.push(r.perKind.parsed.counts.duplicateKeys);
    if (i === 0) {
      lines = g.lines;
      files = perFile(db, snapshotId);
      tot = totals(db, snapshotId);
    }
    db.close();
  }
  return {
    hash: hashes[0]!,
    allEqual: new Set(hashes).size === 1,
    hashes,
    lines,
    files,
    totals: tot,
    droppedKeyMetricPerCleanRun: dropped,
    snapshotIdsEqualAcrossRuns: true,
  };
}
type Clean = Awaited<ReturnType<typeof cleanReference>>;

// ------------------------------------------------------------------ kill/restart machinery (F-1, F-1c)
async function killScenario(
  clean: Clean,
  label: string,
  workers: number,
  kills: number[],
  lease = 1500,
) {
  const { dbPath, snapshotId } = freshRunDb(DS, label);
  const args = [
    "bun",
    engineCli,
    "--db",
    dbPath,
    "--snapshot",
    String(snapshotId),
    "--blobs",
    BLOBS,
    "--workers",
    String(workers),
    "--lease",
    String(lease),
  ];
  const rec: any = {
    scenario: label,
    workers,
    killFractions: kills,
    leaseMs: lease,
    kills: [],
    classification: "UNCLASSIFIED",
  };
  const completedParsedAtLastKill = new Map<string, { rows: number }>();
  let afterKillFiles!: Map<string, string[]>;
  try {
    for (let k = 0; k <= kills.length; k++) {
      const isKill = k < kills.length;
      const finalOut = resolve(RUNS, `${DS}--${label}-final.json`);
      const spawnAt = now();
      const child = Bun.spawn(
        [...args, ...(isKill ? [] : ["--out", finalOut])],
        { stdout: "ignore", stderr: "pipe" },
      );
      const ro = openDb(dbPath, { readonly: true });
      let firstProgress: number | null = null,
        info: any = null,
        exited = false;
      const prevKill: number | null =
        k > 0 ? rec.kills[k - 1].killedAtEpochMs : null;
      child.exited.then(() => {
        exited = true;
      });
      for (let i = 0; i < 60000 && !exited; i++) {
        await sleep(1);
        try {
          if (
            prevKill !== null &&
            firstProgress === null &&
            ((ro.query(`SELECT MAX(updated_at) m FROM t7_jobs`).get() as any)
              .m as number) > prevKill
          )
            firstProgress = now() - spawnAt;
          if (!isKill) continue;
          const s = ro
            .query(
              `SELECT SUM(state IN ('COMPLETED','SKIPPED','FAILED')) done, COUNT(*) total FROM t7_jobs`,
            )
            .get() as any;
          if (s.total > 0 && s.done / s.total >= kills[k]!) {
            const completedIds = ro
              .query(
                `SELECT id, checkpoint FROM t7_jobs WHERE state='COMPLETED'`,
              )
              .all() as any[];
            const parsedDone = ro
              .query(
                `SELECT j.unit_ref u, j.checkpoint c, sf.path p FROM t7_jobs j JOIN snapshot_files sf ON sf.id=CAST(j.unit_ref AS INTEGER) WHERE j.kind='parsed' AND j.state='COMPLETED'`,
              )
              .all() as any[];
            const byKind = ro
              .query(`SELECT kind, state, COUNT(*) n FROM t7_jobs GROUP BY 1,2`)
              .all() as any[];
            process.kill(child.pid, "SIGKILL");
            info = {
              triggerFraction: s.done / s.total,
              byKindAtTrigger: byKind,
              runningSymbolsAtTrigger:
                byKind.find(
                  (x) => x.kind === "symbols" && x.state === "RUNNING",
                )?.n ?? 0,
              runningParsedAtTrigger:
                byKind.find((x) => x.kind === "parsed" && x.state === "RUNNING")
                  ?.n ?? 0,
              killedAtEpochMs: Date.now(),
              completedIds,
              parsedDone,
            };
            break;
          }
        } catch {
          /* busy */
        }
      }
      const code = await child.exited;
      ro.close();
      if (isKill) {
        if (!info) {
          rec.kills.push({ note: "trigger never fired", exitCode: code });
          rec.classification = "INCOMPLETE-NO-KILL";
          return rec;
        }
        const db = openDb(dbPath);
        const preserved = info.completedIds.every((c: any) => {
          const r = db
            .query(`SELECT state, checkpoint FROM t7_jobs WHERE id=?`)
            .get(c.id) as any;
          return r && r.state === "COMPLETED" && r.checkpoint === c.checkpoint;
        });
        const files = perFile(db, snapshotId);
        let cpMismatch = 0;
        completedParsedAtLastKill.clear();
        for (const d of info.parsedDone) {
          const rows = JSON.parse(d.c).rows as number;
          completedParsedAtLastKill.set(d.p, { rows });
          if (parsedRows(files, d.p).length !== rows) cpMismatch++;
        }
        afterKillFiles = files;
        info.afterKill = {
          ...jobStats(db, snapshotId),
          completedJobStateAndCheckpointPreserved: preserved,
          completedParsedCheckpointRowsMismatch: cpMismatch,
          invariantViolations: checkInvariants(db, snapshotId),
          exitCode: code,
        };
        delete info.completedIds;
        delete info.parsedDone;
        db.close();
        rec.kills.push(info);
      } else {
        const res = JSON.parse(readFileSync(finalOut, "utf8"));
        rec.finalRestart = {
          exitCode: code,
          wallMs: now() - spawnAt,
          firstProgressAfterRestartMs: firstProgress,
          reclaimed: res.reclaimed,
          restartParsedDroppedKeyMetric:
            res.perKind.parsed?.counts?.duplicateKeys ?? 0,
          restartUnitsExecuted: Object.fromEntries(
            Object.entries<any>(res.perKind).map(([kk, v]) => [kk, v.units]),
          ),
        };
      }
    }
    const db = openDb(dbPath);
    const g = canonicalGraph(db, snapshotId);
    const inv = finalChecks(db, snapshotId),
      js = jobStats(db, snapshotId),
      tot = totals(db, snapshotId),
      files = perFile(db, snapshotId);
    let changedCompleted = 0;
    for (const p of completedParsedAtLastKill.keys())
      if (
        JSON.stringify(parsedRows(files, p)) !==
        JSON.stringify(parsedRows(afterKillFiles, p))
      )
        changedCompleted++;
    rec.final = {
      graphHash: g.hash,
      equalsClean: g.hash === clean.hash,
      invariantAndCompletenessViolations: inv,
      jobs: js,
      totalsEqualClean: JSON.stringify(tot) === JSON.stringify(clean.totals),
      failedJobs: js.states["FAILED"] ?? 0,
      completedParsedFilesChangedAfterRestart: changedCompleted,
      completedParsedFilesChecked: completedParsedAtLastKill.size,
      reexecutedUnitsViaReclaim: js.reclaimsSum,
    };
    const ok =
      rec.final.equalsClean &&
      inv.length === 0 &&
      rec.final.failedJobs === 0 &&
      rec.final.totalsEqualClean &&
      changedCompleted === 0 &&
      rec.kills.every(
        (x: any) =>
          x.afterKill.completedJobStateAndCheckpointPreserved &&
          x.afterKill.completedParsedCheckpointRowsMismatch === 0,
      ) &&
      rec.finalRestart.exitCode === 0;
    rec.classification = ok ? "PASS-CRITERIA-MET" : "CRITERIA-NOT-MET";
    db.close();
  } catch (e) {
    rec.classification = "HARNESS-ERROR";
    rec.error = String(e);
  }
  return rec;
}
const summarizeKills = (attempts: any[]) => ({
  attempts: attempts.length,
  criteriaMet: attempts.filter((a) => a.classification === "PASS-CRITERIA-MET")
    .length,
  notMet: attempts
    .filter((a) => a.classification !== "PASS-CRITERIA-MET")
    .map((a) => `${a.scenario}:${a.classification}`),
  killsWithRunningSymbolsUnit: attempts
    .flatMap((a) => a.kills)
    .filter((k: any) => (k.runningSymbolsAtTrigger ?? 0) > 0).length,
  killsWithRunningParsedUnit: attempts
    .flatMap((a) => a.kills)
    .filter((k: any) => (k.runningParsedAtTrigger ?? 0) > 0).length,
  totalKills: attempts.flatMap((a) => a.kills).length,
  restartWallMs: stats(
    attempts.map((a) => a.finalRestart?.wallMs).filter((x) => x !== undefined),
  ),
  firstProgressAfterRestartMs: stats(
    attempts
      .map((a) => a.finalRestart?.firstProgressAfterRestartMs)
      .filter((x) => x != null),
  ),
});

async function f1(clean: Clean) {
  const sc: { w: number; k: number[] }[] = [];
  for (const w of [1, 2])
    for (const f of [0.1, 0.25, 0.4, 0.55, 0.7, 0.82, 0.86, 0.9, 0.94, 0.97])
      sc.push({ w, k: [f] });
  for (const k of [
    [0.3, 0.7],
    [0.2, 0.5],
    [0.45, 0.8],
    [0.83, 0.93],
    [0.85, 0.95],
    [0.4, 0.88],
  ])
    sc.push({ w: 2, k });
  const attempts: any[] = [];
  for (const [i, s] of sc.entries()) {
    const r = await killScenario(clean, `m-l4-c-f1-${i}`, s.w, s.k);
    attempts.push(r);
    console.log(
      `F-1 revC ${r.scenario} c=${s.w} kills@${s.k.join(",")} → ${r.classification}`,
    );
  }
  return {
    test: "F-1 kill -9 / restart (rev C: strengthened assertions)",
    cleanRunsEqualAsserted: clean.allEqual,
    cleanHash: clean.hash,
    attempts,
    summary: summarizeKills(attempts),
  };
}
async function f1c(clean: Clean) {
  let seed = 7;
  const rnd = () =>
    (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const attempts: any[] = [];
  for (let i = 0; i < 30; i++) {
    const f = 0.02 + rnd() * 0.36;
    const r = await killScenario(clean, `m-l4-c-f1c-${i}`, 2, [f]);
    attempts.push(r);
    console.log(
      `F-1c ${r.scenario} kill@${f.toFixed(3)} runningSymbols=${r.kills[0]?.runningSymbolsAtTrigger} → ${r.classification}`,
    );
  }
  return {
    test: "F-1c random-time kills in the production symbols/contains phases (c=2)",
    cleanHash: clean.hash,
    attempts,
    summary: summarizeKills(attempts),
  };
}

// ------------------------------------------------------------------ F-2 (full-graph diff, pre and mid-persist faults)
async function f2(clean: Clean) {
  const pre = freshRunDb(DS, "m-l4-c-f2-pick");
  const p0 = openDb(pre.dbPath);
  const ranked = [...clean.files.entries()]
    .filter(([, v]) => v.some((x) => x.startsWith("call-expression")))
    .sort(
      (a, b) =>
        parsedRows(clean.files, b[0]).length -
          parsedRows(clean.files, a[0]).length || (a[0] < b[0] ? -1 : 1),
    )
    .slice(0, 3)
    .map(([p]) => p);
  const victims = ranked.map(
    (p) =>
      p0
        .query(
          `SELECT id, path FROM snapshot_files WHERE snapshot_id=? AND path=?`,
        )
        .get(pre.snapshotId, p) as any,
  );
  p0.close();
  const victimKeys = new Set(
    ranked.flatMap((p) =>
      parsedRows(clean.files, p).map((x) => x.split("|")[1]!),
    ),
  );
  const out: any = {
    test: "F-2 per-file containment (rev C)",
    victims: ranked,
    cases: [],
  };
  for (const at of ["pre", "mid"] as const) {
    const { dbPath, snapshotId } = freshRunDb(DS, `m-l4-c-f2-${at}`);
    const faults: any = {};
    for (const v of victims)
      faults[`parsed:${v.id}`] = { mode: "permanent", at };
    const r = await runEngine({
      dbPath,
      snapshotId,
      blobsDir: BLOBS,
      workers: 2,
      faults,
    });
    const db = openDb(dbPath);
    const g = canonicalGraph(db, snapshotId);
    const cleanSet = new Set(clean.lines),
      gotSet = new Set(g.lines);
    const missing = clean.lines.filter((l) => !gotSet.has(l)),
      extra = g.lines.filter((l) => !cleanSet.has(l));
    const missingAreExactlyVictimParsedRows =
      missing.every(
        (l) => l.startsWith("rel|") && victimKeys.has(l.split("|")[1]!),
      ) && missing.length === victimKeys.size;
    const failed = db
      .query(
        `SELECT unit_ref, attempts, error FROM t7_jobs WHERE state='FAILED'`,
      )
      .all() as any[];
    const inv = finalChecks(db, snapshotId);
    out.cases.push({
      faultPoint:
        at === "pre"
          ? "before any work"
          : "inside persist transaction after rows written (real ROLLBACK)",
      snapshotStatus: r.snapshotStatus,
      failedJobs: failed.length,
      failedErrors: failed.map((f) => JSON.parse(f.error).code),
      missingLinesVsClean: missing.length,
      extraLinesVsClean: extra.length,
      missingAreExactlyVictimParsedRows,
      victimContainsRowsRetained: ranked.every((p) =>
        (perFile(db, snapshotId).get(p) ?? []).some((x) =>
          x.startsWith("directory-hierarchy"),
        ),
      ),
      invariantAndCompletenessViolations: inv,
      classification:
        extra.length === 0 &&
        missingAreExactlyVictimParsedRows &&
        failed.length === 3 &&
        r.snapshotStatus === "completed_partial" &&
        inv.length === 0
          ? "PASS-CRITERIA-MET"
          : "CRITERIA-NOT-MET",
    });
    db.close();
  }
  out.classification = out.cases.every(
    (c: any) => c.classification === "PASS-CRITERIA-MET",
  )
    ? "PASS-CRITERIA-MET"
    : "CRITERIA-NOT-MET";
  return out;
}

// ------------------------------------------------------------------ F-3c mid-persist transient recovery
async function f3c(clean: Clean) {
  const { dbPath, snapshotId } = freshRunDb(DS, "m-l4-c-f3c");
  const p = openDb(dbPath);
  const ids = (
    p
      .query(
        `SELECT sf.id id FROM snapshot_files sf WHERE sf.snapshot_id=? AND (sf.path LIKE '%.ts' OR sf.path LIKE '%.tsx') ORDER BY sf.id`,
      )
      .all(snapshotId) as any[]
  )
    .filter((_, i) => i % 9 === 0)
    .slice(0, 20);
  p.close();
  const faults: any = {};
  for (const x of ids)
    faults[`parsed:${x.id}`] = { mode: "transient", times: 1, at: "mid" };
  const r = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers: 2,
    faults,
    policy: { maxAttempts: 3, backoffBaseMs: 25 },
  });
  const db = openDb(dbPath);
  const g = canonicalGraph(db, snapshotId);
  const res = {
    injected: ids.length,
    engineRetries: r.retries.length,
    hashEqualsClean: g.hash === clean.hash,
    droppedKeyMetric: r.perKind.parsed.counts.duplicateKeys,
    snapshotStatus: r.snapshotStatus,
    invariantAndCompletenessViolations: finalChecks(db, snapshotId),
    jobs: jobStats(db, snapshotId),
  };
  db.close();
  return {
    test: "F-3c transient failure INSIDE the persist transaction (rollback + retry)",
    ...res,
    classification:
      res.hashEqualsClean &&
      res.engineRetries === res.injected &&
      res.droppedKeyMetric === 0 &&
      res.invariantAndCompletenessViolations.length === 0 &&
      r.snapshotStatus === "completed"
        ? "PASS-CRITERIA-MET"
        : "CRITERIA-NOT-MET",
  };
}

// ------------------------------------------------------------------ F-4e concurrent duplicate execution (lease << unit time)
async function f4e(clean: Clean) {
  const attempts: any[] = [];
  for (let i = 0; i < 3; i++) {
    const { dbPath, snapshotId } = freshRunDb(DS, `m-l4-c-f4e-${i}`);
    let res: any,
      error: string | null = null;
    try {
      res = await runEngine({
        dbPath,
        snapshotId,
        blobsDir: BLOBS,
        workers: 4,
        policy: { leaseMs: 2 },
      });
    } catch (e) {
      error = String(e);
    }
    const db = openDb(dbPath);
    const g = canonicalGraph(db, snapshotId);
    const js = jobStats(db, snapshotId);
    const failedRows = db
      .query(
        `SELECT kind, unit_ref, attempts, error FROM t7_jobs WHERE state='FAILED' LIMIT 10`,
      )
      .all();
    attempts.push({
      run: i,
      engineError: error,
      workers: 4,
      leaseMs: 2,
      reclaimsSum: js.reclaimsSum,
      jobs: js,
      failedSample: failedRows,
      hashEqualsClean: g.hash === clean.hash,
      invariantAndCompletenessViolations: finalChecks(db, snapshotId),
      totals: totals(db, snapshotId),
      totalsEqualClean:
        JSON.stringify(totals(db, snapshotId)) === JSON.stringify(clean.totals),
    });
    db.close();
  }
  const ok = attempts.every(
    (a) =>
      a.hashEqualsClean &&
      a.invariantAndCompletenessViolations.length === 0 &&
      !a.jobs.states["FAILED"],
  );
  return {
    test: "F-4e concurrent duplicate execution of the same unit (stale-but-live worker; lease 2 ms ≪ unit time). PROBE — semantics not defined by the contract beyond guarantee 1 'no job silently duplicated'",
    attempts,
    classification: ok ? "PASS-CRITERIA-MET" : "CRITERIA-NOT-MET",
    note: "classification recorded as measured; no fencing token exists in the contract, none was added",
  };
}

// ------------------------------------------------------------------ F-4e control: is the silent divergence reachable under the CONFIGURED 1.5 s lease?
async function f4eControl(clean: Clean) {
  const out: any = {
    test: "F-4e control (owner decision 2026-09-26): configured lease 1500 ms",
    parts: {},
  };
  // (a) R-M, c=4, lease 1.5 s — units are ≪ lease, so no stale-live execution is expected
  const a: any[] = [];
  for (let i = 0; i < 5; i++) {
    const { dbPath, snapshotId } = freshRunDb(DS, `m-l4-c-f4e-ctl-a${i}`);
    const r = await runEngine({
      dbPath,
      snapshotId,
      blobsDir: BLOBS,
      workers: 4,
      policy: { leaseMs: 1500 },
    });
    const db = openDb(dbPath);
    const g = canonicalGraph(db, snapshotId);
    const js = jobStats(db, snapshotId);
    a.push({
      run: i,
      hashEqualsClean: g.hash === clean.hash,
      reclaimsSum: js.reclaimsSum,
      states: js.states,
      maxUnitMs: Math.max(
        ...Object.values<any>(r.perKind).map((k: any) => k.runMsStats.max),
      ),
      violations: finalChecks(db, snapshotId).length,
    });
    db.close();
  }
  out.parts.rmLease1500 = {
    runs: a,
    allEqualClean: a.every((x) => x.hashEqualsClean),
    totalReclaims: a.reduce((x, y) => x + y.reclaimsSum, 0),
  };
  // (b) a legitimately large file whose unit exceeds the lease: one 768 KiB TS file + 6 small files, c=2, lease 1.5 s vs a single-worker long-lease reference
  const dir = dsDir("f4e-large");
  rmSync(dir, { recursive: true, force: true });
  const files: Record<string, string> = {
    "src/big.ts": generate("typescript", "ordinary", 768 * 1024),
  };
  for (let i = 0; i < 6; i++)
    files[`src/small${i}.ts`] =
      `export function pay${i}(a: number): number { return notify${i}(a); }\nexport function notify${i}(a: number): number { return a; }\n`;
  for (const [p, c] of Object.entries(files)) {
    const f = resolve(dir, "tree", p);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, c);
  }
  const t = createScratchDb(resolve(dir, "template.db"));
  await ingestLocalSnapshot(t, {
    treeDir: resolve(dir, "tree"),
    blobsDir: BLOBS,
    identity: { provider: "github", owner: "local", name: "f4e-large" },
    commitSha: "0".repeat(39) + "7",
  });
  t.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  t.close();
  const ref = freshRunDb("f4e-large", "m-l4-c-f4e-large-ref");
  const rr = await runEngine({
    dbPath: ref.dbPath,
    snapshotId: ref.snapshotId,
    blobsDir: BLOBS,
    workers: 1,
    policy: { leaseMs: 3_600_000 },
  });
  const rdb = openDb(ref.dbPath);
  const refG = canonicalGraph(rdb, ref.snapshotId);
  rdb.close();
  const b: any[] = [];
  for (let i = 0; i < 3; i++) {
    const { dbPath, snapshotId } = freshRunDb(
      "f4e-large",
      `m-l4-c-f4e-large-${i}`,
    );
    const r = await runEngine({
      dbPath,
      snapshotId,
      blobsDir: BLOBS,
      workers: 2,
      policy: { leaseMs: 1500 },
    });
    const db = openDb(dbPath);
    const g = canonicalGraph(db, snapshotId);
    const js = jobStats(db, snapshotId);
    const missing = refG.lines.filter((l) => !new Set(g.lines).has(l)).length;
    b.push({
      run: i,
      hashEqualsReference: g.hash === refG.hash,
      missingLinesVsReference: missing,
      reclaimsSum: js.reclaimsSum,
      attemptsSum: js.attemptsSum,
      states: js.states,
      engineWallMs: r.wallMs,
      violations: finalChecks(db, snapshotId),
    });
    db.close();
  }
  out.parts.largeFileLease1500 = {
    referenceWallMs: rr.wallMs,
    referenceLongestUnitMs: Math.max(
      ...Object.values<any>(rr.perKind).map((k: any) => k.runMsStats.max),
    ),
    leaseMs: 1500,
    runs: b,
    anyReclaim: b.some((x) => x.reclaimsSum > 0),
    anyDivergence: b.some((x) => !x.hashEqualsReference),
  };
  out.classification =
    out.parts.rmLease1500.allEqualClean &&
    !out.parts.largeFileLease1500.anyDivergence
      ? "NOT-REPRODUCED-UNDER-1500ms-LEASE (see reclaim counts: reachability depends on a unit exceeding the lease)"
      : "REPRODUCED-UNDER-1500ms-LEASE";
  return out;
}

// ------------------------------------------------------------------ driver
const clean = await cleanReference();
console.log(
  `clean reference ${clean.hash.slice(0, 12)} equal=${clean.allEqual} dropped-key metric per clean run ${clean.droppedKeyMetricPerCleanRun}`,
);
const tests: [string, string, () => Promise<any>][] = [
  ["f1", "m-l4-f1-revC", () => f1(clean)],
  ["f1c", "m-l4-f1c-random-kills", () => f1c(clean)],
  ["f2", "m-l4-f2-revC", () => f2(clean)],
  ["f3c", "m-l4-f3c-mid-persist", () => f3c(clean)],
  ["f4e", "m-l4-f4e-stale-live-duplicate-execution", () => f4e(clean)],
  ["f4e-control", "m-l4-f4e-control-lease1500", () => f4eControl(clean)],
];
for (const [key, file, fn] of tests) {
  if (which !== "all" && which !== key) continue;
  const t = now();
  let res: any;
  try {
    res = await fn();
  } catch (e) {
    res = {
      test: key,
      classification: "HARNESS-ERROR",
      error: String(e),
      stack: (e as Error).stack?.split("\n").slice(0, 6),
    };
  }
  res.durationMs = now() - t;
  writeEvidence(`${file}.json`, {
    measurement: "M-L4 part 3 (rev C)",
    dataset: DS,
    environmentHash: env.envHash,
    loadAvgAtStart: env.dynamic.loadAvg,
    power: env.dynamic.power,
    cleanReferenceHash: clean.hash,
    cleanRunsEqual: clean.allEqual,
    droppedKeyMetricPerCleanRun: clean.droppedKeyMetricPerCleanRun,
    ...res,
  });
  console.log(
    `${key}: ${res.classification ?? JSON.stringify(res.summary)} (${Math.round(res.durationMs)} ms)`,
  );
}
