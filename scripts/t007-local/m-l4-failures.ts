/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { Database } from "bun:sqlite";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { openDb, createScratchDb } from "./lib/db";
import { BLOBS, dsDir } from "./lib/datasets";
import { canonicalGraph, checkInvariants } from "./lib/graph";
import {
  cancelHalt,
  clearCancelHalt,
  jobCounts,
  pause,
  resume,
} from "./lib/jobs";
import { freshRunDb, RUNS } from "./lib/run";
import { ingestLocalSnapshot } from "./lib/snapshot";
import { arg, now, sleep, stats, writeEvidence } from "./lib/common";
import { captureEnvironment } from "./lib/env";
import { runEngine } from "./engine";

/**
 * M-L4 part 3 — failure suite F-1…F-6 on repo-atlas R-M (F-6 also on a purpose-built oversize fixture).
 * Raw attempt records are written even when an attempt fails; nothing is retried automatically; every attempt is classified.
 * usage: bun m-l4-failures.ts --test f1|f2|f3|f4|f5|f6|all
 */
const DS = "repo-atlas-rm";
const which = arg("test", "all")!;
const engineCli = resolve(import.meta.dir, "engine.ts");
const env = captureEnvironment();
const isTerminal = (s: string) =>
  ["COMPLETED", "SKIPPED", "FAILED"].includes(s);

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

// ---------------------------------------------------------------- clean reference (3 clean runs → hash + per-file keys)
async function cleanReference() {
  const hashes: string[] = [];
  let files!: Map<string, string[]>, tot: any, gCounts: any;
  for (let i = 0; i < 3; i++) {
    const { dbPath, snapshotId } = freshRunDb(DS, `m-l4-clean-${i}`);
    await runEngine({ dbPath, snapshotId, blobsDir: BLOBS, workers: 2 });
    const db = openDb(dbPath);
    const g = canonicalGraph(db, snapshotId);
    hashes.push(g.hash);
    if (i === 0) {
      files = perFile(db, snapshotId);
      tot = totals(db, snapshotId);
      gCounts = g.counts;
    }
    db.close();
  }
  return {
    hash: hashes[0]!,
    allEqual: new Set(hashes).size === 1,
    hashes,
    files,
    totals: tot,
    counts: gCounts,
  };
}

// ---------------------------------------------------------------- F-1 kill -9 / restart
async function f1(
  clean: Awaited<ReturnType<typeof cleanReference>>,
  variant: "a" | "b" = "a",
) {
  const attempts: any[] = [];
  const scenarios: { workers: number; kills: number[] }[] = [];
  if (variant === "a") {
    for (const w of [1, 2])
      for (const f of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85])
        scenarios.push({ workers: w, kills: [f] });
    for (const f of [
      [0.3, 0.7],
      [0.2, 0.5],
      [0.45, 0.8],
    ])
      scenarios.push({ workers: 2, kills: f });
  } else {
    // parsed-phase coverage: units are ~40% symbols, ~40% contains, ~20% parsed, so kills at >0.8 of all jobs land in the relationship (parsed) phase
    for (const w of [1, 2])
      for (const f of [0.82, 0.86, 0.9, 0.94, 0.97])
        for (let rep = 0; rep < 2; rep++)
          scenarios.push({ workers: w, kills: [f] });
    for (const f of [
      [0.83, 0.93],
      [0.85, 0.95],
      [0.4, 0.88],
    ])
      scenarios.push({ workers: 2, kills: f });
  }
  const LEASE = 1500;
  let n = 0;
  for (const sc of scenarios) {
    const label = `m-l4-f1${variant === "b" ? "b" : ""}-${n++}`;
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
      String(sc.workers),
      "--lease",
      String(LEASE),
    ];
    const rec: any = {
      scenario: label,
      workers: sc.workers,
      killFractions: sc.kills,
      leaseMs: LEASE,
      kills: [],
      classification: "UNCLASSIFIED",
    };
    let restartMs = 0;
    try {
      for (let k = 0; k <= sc.kills.length; k++) {
        const isKillRound = k < sc.kills.length;
        const spawnAt = now();
        const child = Bun.spawn(args, { stdout: "ignore", stderr: "pipe" });
        const ro = openDb(dbPath, { readonly: true });
        let firstProgressMs: number | null = null;
        const killTsPrev: number | null =
          k > 0 ? rec.kills[k - 1].killedAtEpochMs : null;
        let killInfo: any = null;
        let exitedEarly = false;
        child.exited.then(() => {
          exitedEarly = true;
        });
        for (let i = 0; i < 60000 && !exitedEarly; i++) {
          await sleep(1);
          try {
            if (killTsPrev !== null && firstProgressMs === null) {
              const m = (
                ro.query(`SELECT MAX(updated_at) m FROM t7_jobs`).get() as any
              ).m as number;
              if (m > killTsPrev) firstProgressMs = now() - spawnAt;
            }
            if (!isKillRound) continue;
            const s = ro
              .query(
                `SELECT SUM(state IN ('COMPLETED','SKIPPED','FAILED')) done, COUNT(*) total FROM t7_jobs`,
              )
              .get() as any;
            if (s.total > 0 && s.done / s.total >= sc.kills[k]!) {
              const completed = ro
                .query(
                  `SELECT id, checkpoint FROM t7_jobs WHERE state='COMPLETED'`,
                )
                .all() as any[];
              const states = jobCounts(ro as any, snapshotId);
              const byKind = ro
                .query(
                  `SELECT kind, state, COUNT(*) n FROM t7_jobs GROUP BY 1,2`,
                )
                .all();
              const t = now();
              process.kill(child.pid, "SIGKILL");
              killInfo = {
                triggerFraction: s.done / s.total,
                killLatencyMs: now() - t,
                statesAtTrigger: states,
                completedIdsAtTrigger: completed,
                killedAtEpochMs: Date.now(),
              };
              break;
            }
          } catch {
            /* busy */
          }
        }
        const code = await child.exited;
        ro.close();
        if (isKillRound) {
          if (!killInfo) {
            rec.kills.push({
              note: "kill trigger never fired (child exited/finished first)",
              exitCode: code,
            });
            rec.classification = "INCOMPLETE-NO-KILL";
            break;
          }
          const db = openDb(dbPath);
          const after = jobStats(db, snapshotId);
          const preserved = killInfo.completedIdsAtTrigger.every((c: any) => {
            const r = db
              .query(`SELECT state, checkpoint FROM t7_jobs WHERE id=?`)
              .get(c.id) as any;
            return (
              r && r.state === "COMPLETED" && r.checkpoint === c.checkpoint
            );
          });
          const invAfterKill = checkInvariants(db, snapshotId);
          const filesAtKill = perFile(db, snapshotId);
          killInfo.afterKill = {
            ...after,
            invariantViolations: invAfterKill,
            completedWorkPreserved: preserved,
            exitCode: code,
          };
          killInfo.filesSnapshot = filesAtKill; // used below for completed-unit stability
          delete killInfo.completedIdsAtTrigger;
          killInfo.completedCountAtTrigger =
            killInfo.statesAtTrigger["COMPLETED"] ?? 0;
          db.close();
          rec.kills.push(killInfo);
        } else {
          restartMs = now() - spawnAt;
          rec.finalRestart = {
            exitCode: code,
            wallMs: restartMs,
            firstProgressAfterRestartMs: firstProgressMs,
            stderr: (await new Response(child.stderr).text()).slice(0, 300),
          };
        }
        if (killInfo && k + 1 <= sc.kills.length) {
          /* next loop restarts */
        }
        if (!isKillRound) break;
        // record latency of intermediate restarts on the next iteration's firstProgress
        if (k + 1 < sc.kills.length + 1)
          rec.kills[k].nextRestartFirstProgressMs = null;
      }
      if (rec.classification === "UNCLASSIFIED") {
        const db = openDb(dbPath);
        const g = canonicalGraph(db, snapshotId);
        const inv = checkInvariants(db, snapshotId);
        const js = jobStats(db, snapshotId);
        const tot = totals(db, snapshotId);
        const filesFinal = perFile(db, snapshotId);
        // completed-before-kill stability: every file's rows at the LAST kill must be unchanged in the final graph (for files fully persisted then)
        const lastKill = rec.kills[rec.kills.length - 1];
        let changedCompletedFiles = 0;
        for (const [p, keys] of (
          lastKill.filesSnapshot as Map<string, string[]>
        ).entries())
          if (
            JSON.stringify(filesFinal.get(p) ?? []) !== JSON.stringify(keys) &&
            (filesFinal.get(p)?.length ?? 0) >= keys.length
          ) {
            /* file grew: partial at kill; ignore */
          } else if (
            JSON.stringify(filesFinal.get(p) ?? []) !== JSON.stringify(keys)
          )
            changedCompletedFiles++;
        for (const k of rec.kills) delete k.filesSnapshot;
        rec.final = {
          graphHash: g.hash,
          equalsClean: g.hash === clean.hash,
          invariantViolations: inv,
          jobs: js,
          totals: tot,
          totalsEqualClean:
            JSON.stringify(tot) === JSON.stringify(clean.totals),
          failedJobs: js.states["FAILED"] ?? 0,
          changedCompletedFiles,
          reexecutedUnits: js.reclaimsSum,
        };
        rec.classification =
          rec.final.equalsClean &&
          inv.length === 0 &&
          rec.final.failedJobs === 0 &&
          rec.final.totalsEqualClean &&
          rec.kills.every((k: any) => k.afterKill?.completedWorkPreserved)
            ? "PASS-CRITERIA-MET"
            : "CRITERIA-NOT-MET";
        db.close();
      }
    } catch (e) {
      rec.classification = "HARNESS-ERROR";
      rec.error = String(e);
    }
    for (const k of rec.kills ?? []) delete k.filesSnapshot;
    attempts.push(rec);
    console.log(
      `F-1 ${label} c=${sc.workers} kills@${sc.kills.join(",")} → ${rec.classification}${rec.final ? ` hash==clean ${rec.final.equalsClean} reexec ${rec.final.reexecutedUnits} restart ${Math.round(rec.finalRestart?.wallMs ?? 0)}ms` : ""}`,
    );
  }
  return {
    test: "F-1 kill -9 / restart (mandatory G1/G2 evidence)",
    cleanReference: { hash: clean.hash, cleanRunsEqual: clean.allEqual },
    attempts,
    summary: {
      attempts: attempts.length,
      criteriaMet: attempts.filter(
        (a) => a.classification === "PASS-CRITERIA-MET",
      ).length,
      other: attempts
        .filter((a) => a.classification !== "PASS-CRITERIA-MET")
        .map((a) => `${a.scenario}:${a.classification}`),
      restartWallMs: stats(
        attempts
          .map((a) => a.finalRestart?.wallMs)
          .filter((x) => x !== undefined),
      ),
      firstProgressAfterRestartMs: stats(
        attempts
          .map((a) => a.finalRestart?.firstProgressAfterRestartMs)
          .filter((x) => x != null),
      ),
    },
  };
}

// ---------------------------------------------------------------- F-2 per-file containment
async function f2(clean: Awaited<ReturnType<typeof cleanReference>>) {
  const { dbPath, snapshotId } = freshRunDb(DS, "m-l4-f2");
  const pre = openDb(dbPath);
  const victims = pre
    .query(
      `SELECT sf.id id, sf.path path FROM snapshot_files sf WHERE sf.snapshot_id=? AND sf.path IN (${[
        ...clean.files.entries(),
      ]
        .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
        .filter(([, v]) => v.some((x) => x.startsWith("call-expression")))
        .slice(0, 3)
        .map(([p]) => `'${p.replace(/'/g, "''")}'`)
        .join(",")})`,
    )
    .all(snapshotId) as any[];
  pre.close();
  const faults: any = {};
  for (const v of victims) faults[`parsed:${v.id}`] = { mode: "permanent" };
  const r = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers: 2,
    faults,
  });
  const db = openDb(dbPath);
  const files = perFile(db, snapshotId);
  const failedPaths = new Set(victims.map((v) => v.path));
  let otherDiffs = 0;
  const diffFiles: string[] = [];
  for (const [p, keys] of clean.files.entries())
    if (
      !failedPaths.has(p) &&
      JSON.stringify(files.get(p) ?? []) !== JSON.stringify(keys)
    ) {
      otherDiffs++;
      diffFiles.push(p);
    }
  const victimParsedRows = victims.map((v) => ({
    path: v.path,
    parsedRowsRemaining: (files.get(v.path) ?? []).filter(
      (x) =>
        !x.startsWith("directory-hierarchy") && !x.startsWith("symbol-parent"),
    ).length,
    containsRowsRetained: (files.get(v.path) ?? []).some((x) =>
      x.startsWith("directory-hierarchy"),
    ),
  }));
  const js = jobStats(db, snapshotId);
  const errs = db
    .query(
      `SELECT unit_ref, state, attempts, error FROM t7_jobs WHERE state='FAILED'`,
    )
    .all() as any[];
  const inv = checkInvariants(db, snapshotId);
  const status = r.snapshotStatus;
  // secondary: symbols-unit failure cascades (dependent contains/parsed units + cross-file resolution) — recorded, not pass/fail
  const { dbPath: p2, snapshotId: s2 } = freshRunDb(DS, "m-l4-f2b");
  const sv = victims[0]!;
  const r2 = await runEngine({
    dbPath: p2,
    snapshotId: s2,
    blobsDir: BLOBS,
    workers: 2,
    faults: { [`symbols:${sv.id}`]: { mode: "permanent" } },
  });
  const d2 = openDb(p2);
  const secondary = {
    failedUnit: `symbols:${sv.path}`,
    jobs: jobStats(d2, s2),
    failedRows: d2
      .query(
        `SELECT kind, unit_ref, state, error FROM t7_jobs WHERE state IN ('FAILED','SKIPPED')`,
      )
      .all(),
    snapshotStatus: r2.snapshotStatus,
    invariantViolations: checkInvariants(d2, s2),
  };
  d2.close();
  db.close();
  const contained =
    otherDiffs === 0 &&
    status === "completed_partial" &&
    errs.length === victims.length &&
    victimParsedRows.every((v) => v.parsedRowsRemaining === 0);
  return {
    test: "F-2 per-file failure containment",
    victims: victims.map((v) => v.path),
    snapshotStatus: status,
    failedJobs: errs,
    otherFilesDiffVsClean: otherDiffs,
    diffFiles,
    victimParsedRows,
    jobs: js,
    invariantViolations: inv,
    containedOnParsedUnits: contained,
    secondarySymbolsUnitFailure: secondary,
    classification: contained ? "PASS-CRITERIA-MET" : "CRITERIA-NOT-MET",
  };
}

// ---------------------------------------------------------------- F-3 bounded retry / backoff
async function f3(clean: Awaited<ReturnType<typeof cleanReference>>) {
  const out: any = { test: "F-3 bounded retry/backoff" };
  async function scenario(
    label: string,
    pick: (ids: any[]) => Record<string, any>,
    expectAllComplete: boolean,
  ) {
    const { dbPath, snapshotId } = freshRunDb(DS, label);
    const pre = openDb(dbPath);
    pre.exec(
      `CREATE TABLE t7_job_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, job_id INT, from_state TEXT, to_state TEXT, ts INT); CREATE TRIGGER t7_job_state AFTER UPDATE OF state ON t7_jobs WHEN OLD.state <> NEW.state BEGIN INSERT INTO t7_job_log(job_id, from_state, to_state, ts) VALUES (NEW.id, OLD.state, NEW.state, NEW.updated_at); END;`,
    );
    const ids = pre
      .query(
        `SELECT sf.id id FROM snapshot_files sf WHERE sf.snapshot_id=? AND (sf.path LIKE '%.ts' OR sf.path LIKE '%.tsx') ORDER BY sf.id`,
      )
      .all(snapshotId) as any[];
    pre.close();
    const faults = pick(ids);
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
    const attemptsDist = db
      .query(
        `SELECT attempts, state, COUNT(*) n FROM t7_jobs WHERE attempts>0 GROUP BY 1,2`,
      )
      .all();
    const log = db
      .query(
        `SELECT job_id, from_state f, to_state t, ts FROM t7_job_log ORDER BY seq`,
      )
      .all() as any[];
    const gaps: number[] = [];
    const lastRetry = new Map<number, number>();
    for (const l of log) {
      if (l.t === "RETRYING") lastRetry.set(l.job_id, l.ts);
      else if (
        l.f === "RETRYING" &&
        l.t === "PENDING" &&
        lastRetry.has(l.job_id)
      )
        gaps.push(l.ts - lastRetry.get(l.job_id)!);
    }
    const rec = {
      label,
      injected: Object.keys(faults).length,
      engineRetries: r.retries.length,
      attemptsDistribution: attemptsDist,
      snapshotStatus: r.snapshotStatus,
      hashEqualsClean: g.hash === clean.hash,
      backoffGapsMs: stats(gaps),
      minGapMs: gaps.length ? Math.min(...gaps) : null,
      jobs: jobStats(db, snapshotId),
      invariantViolations: checkInvariants(db, snapshotId),
    };
    db.close();
    return rec;
  }
  out.transientRecoverable = await scenario(
    "m-l4-f3a",
    (ids) => {
      const f: any = {};
      ids
        .filter((_, i) => i % 11 === 0)
        .slice(0, 20)
        .forEach((x, j) => {
          f[`parsed:${x.id}`] = {
            mode: "transient",
            times: j % 5 === 0 ? 2 : 1,
          };
        });
      return f;
    },
    true,
  );
  out.exhausted = await scenario(
    "m-l4-f3b",
    (ids) => ({
      [`parsed:${ids[3].id}`]: { mode: "transient", times: 99 },
      [`parsed:${ids[9].id}`]: { mode: "transient", times: 99 },
    }),
    false,
  );
  const a = out.transientRecoverable,
    b = out.exhausted;
  out.expectations = {
    recoverableAllCompleteAndHashEqualsClean:
      a.hashEqualsClean &&
      a.snapshotStatus === "completed" &&
      a.engineRetries >= a.injected,
    backoffAtLeastBase: a.minGapMs === null || a.minGapMs >= 25,
    exhaustedBoundedAt3AndPartial:
      b.snapshotStatus === "completed_partial" &&
      b.attemptsDistribution.some(
        (x: any) => x.state === "FAILED" && x.attempts === 3,
      ) &&
      !b.attemptsDistribution.some((x: any) => x.attempts > 3),
  };
  out.classification = Object.values(out.expectations).every(Boolean)
    ? "PASS-CRITERIA-MET"
    : "CRITERIA-NOT-MET";
  return out;
}

// ---------------------------------------------------------------- F-4 idempotent re-execution
async function f4(clean: Awaited<ReturnType<typeof cleanReference>>) {
  const { dbPath, snapshotId } = freshRunDb(DS, "m-l4-f4");
  await runEngine({ dbPath, snapshotId, blobsDir: BLOBS, workers: 2 });
  const db = openDb(dbPath);
  const base = canonicalGraph(db, snapshotId).hash;
  const pick = (kind: string, n: number) =>
    (
      db
        .query(
          `SELECT id FROM t7_jobs WHERE kind=? AND state='COMPLETED' ORDER BY id`,
        )
        .all(kind) as any[]
    )
      .filter((_, i) => i % Math.max(1, Math.floor(200 / n)) === 0)
      .slice(0, n)
      .map((x) => x.id);
  const out: any = {
    test: "F-4 idempotent re-execution",
    baseEqualsClean: base === clean.hash,
  };
  const dupCount = () =>
    (
      db
        .query(
          `SELECT COUNT(*) n FROM (SELECT relationship_key FROM relationships WHERE snapshot_id=? GROUP BY relationship_key HAVING COUNT(*)>1)`,
        )
        .get(snapshotId) as any
    ).n;
  const relCount = () =>
    (
      db
        .query(`SELECT COUNT(*) n FROM relationships WHERE snapshot_id=?`)
        .get(snapshotId) as any
    ).n;
  const before = relCount();
  // (a) redelivery with checkpoint kept → short-circuit
  const ids = pick("parsed", 25);
  db.query(
    `UPDATE t7_jobs SET state='PENDING', claimed_by=NULL WHERE id IN (${ids.join(",")})`,
  ).run();
  const ra = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers: 2,
    enqueue: false,
  });
  out.a_redeliverCheckpointKept = {
    redelivered: ids.length,
    shortCircuits: ra.perKind.parsed?.shortCircuits,
    hashEqualsBase: canonicalGraph(db, snapshotId).hash === base,
    duplicateKeys: dupCount(),
    relationshipCountUnchanged: relCount() === before,
  };
  // (b) redelivery with checkpoint cleared → recompute
  db.query(
    `UPDATE t7_jobs SET state='PENDING', checkpoint=NULL, claimed_by=NULL WHERE id IN (${ids.join(",")})`,
  ).run();
  const rb = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers: 2,
    enqueue: false,
  });
  out.b_redeliverCheckpointCleared = {
    recomputed: ids.length,
    shortCircuits: rb.perKind.parsed?.shortCircuits ?? 0,
    hashEqualsBase: canonicalGraph(db, snapshotId).hash === base,
    duplicateKeys: dupCount(),
    relationshipCountUnchanged: relCount() === before,
    duplicateKeysIgnored: rb.perKind.parsed?.counts?.duplicateKeys,
  };
  // (d) whole-run re-enqueue on unchanged snapshot
  const rd = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers: 2,
  });
  out.d_wholeRunNoChange = {
    shortCircuitedRun: rd.shortCircuitedRun,
    engineTotalMs: rd.engineTotalMs,
    hashEqualsBase: canonicalGraph(db, snapshotId).hash === base,
  };
  // (c) F002 symbols-unit redelivery (checkpoint cleared): production extractFile delete-then-insert ⇒ NEW symbol row ids
  const sids = (
    db
      .query(
        `SELECT j.id id FROM t7_jobs j WHERE j.kind='symbols' AND j.state='COMPLETED' AND EXISTS (SELECT 1 FROM symbols s JOIN file_extractions fe ON fe.id=s.file_extraction_id WHERE fe.snapshot_id=?1 AND fe.snapshot_file_id=CAST(j.unit_ref AS INTEGER)) ORDER BY j.id`,
      )
      .all(snapshotId) as any[]
  )
    .filter((_, i) => i % 9 === 0)
    .slice(0, 5)
    .map((x) => x.id);
  db.query(
    `UPDATE t7_jobs SET state='PENDING', checkpoint=NULL, claimed_by=NULL WHERE id IN (${sids.join(",")})`,
  ).run();
  const rc = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers: 1,
    enqueue: false,
  });
  const g = canonicalGraph(db, snapshotId);
  const inv = checkInvariants(db, snapshotId);
  out.c_symbolsUnitRedelivery = {
    redelivered: sids.length,
    symbolRowsBySymbolKeyEqualBase: g.lines.filter((l) => l.startsWith("sym|"))
      .length,
    hashEqualsBase: g.hash === base,
    invariantViolations: inv,
    danglingRelationshipEndpoints: g.lines.filter(
      (l) => l.startsWith("rel|") && /MISSING-/.test(l),
    ).length,
    note: "measured behaviour of the unmodified F002 replaceSymbolsForFile (delete + re-insert ⇒ new AUTOINCREMENT ids); relationships store row ids (R6 D-R6-2 known hazard). Not adjusted.",
  };
  out.classification =
    out.a_redeliverCheckpointKept.hashEqualsBase &&
    out.b_redeliverCheckpointCleared.hashEqualsBase &&
    out.d_wholeRunNoChange.shortCircuitedRun &&
    out.a_redeliverCheckpointKept.duplicateKeys === 0 &&
    out.b_redeliverCheckpointCleared.duplicateKeys === 0
      ? out.c_symbolsUnitRedelivery.hashEqualsBase &&
        out.c_symbolsUnitRedelivery.invariantViolations.length === 0
        ? "PASS-CRITERIA-MET"
        : "PARTIAL: relationship-stage idempotent; symbols-stage redelivery breaks id-based relationship endpoints"
      : "CRITERIA-NOT-MET";
  db.close();
  return out;
}

// ---------------------------------------------------------------- F-5 pause / resume, cancel-halt
async function f5(clean: Awaited<ReturnType<typeof cleanReference>>) {
  const out: any = {
    test: "F-5 pause/resume + cancel",
    contractLimitation:
      "local-job-engine.md guarantee 4 says pause/cancel are explicit and per-repository but defines no PAUSED job state or terminal cancelled state. Harness represents pause with a control flag (t7_control) and cancel-halt as 'stop claiming, leave job rows untouched'. Only BEHAVIOUR (plan §8 F-5 expectations) is evaluated; state-representation semantics are NOT evaluated and none is invented.",
    pause: [],
    cancelHalt: [],
  };
  for (const workers of [2, 2, 2, 4, 4, 4]) {
    const { dbPath, snapshotId } = freshRunDb(
      DS,
      `m-l4-f5p-${out.pause.length}`,
    );
    const ctl = openDb(dbPath);
    const p = runEngine({ dbPath, snapshotId, blobsDir: BLOBS, workers });
    let armed = false;
    for (let i = 0; i < 20000; i++) {
      await sleep(1);
      const s = ctl
        .query(
          `SELECT SUM(state IN ('COMPLETED','SKIPPED','FAILED')) d, COUNT(*) t FROM t7_jobs`,
        )
        .get() as any;
      if (s.t > 0 && s.d / s.t >= 0.4) {
        armed = true;
        break;
      }
    }
    const tp = now();
    pause(ctl, snapshotId);
    let quietMs: number | null = null;
    for (let i = 0; i < 5000; i++) {
      const c = jobCounts(ctl, snapshotId);
      if (!c["RUNNING"] && !c["CLAIMED"]) {
        quietMs = now() - tp;
        break;
      }
      await sleep(1);
    }
    const c1 = jobCounts(ctl, snapshotId);
    await sleep(500);
    const c2 = jobCounts(ctl, snapshotId);
    const invPaused = checkInvariants(ctl, snapshotId);
    resume(ctl, snapshotId);
    const res = await p;
    const g = canonicalGraph(ctl, snapshotId);
    out.pause.push({
      workers,
      armed,
      pauseToQuietMs: quietMs,
      noNewClaimsWhilePaused: JSON.stringify(c1) === JSON.stringify(c2),
      statesWhilePaused: c1,
      invariantViolationsWhilePaused: invPaused,
      resumedToCompletion: res.snapshotStatus === "completed",
      hashEqualsClean: g.hash === clean.hash,
    });
    ctl.close();
  }
  for (let i = 0; i < 3; i++) {
    const { dbPath, snapshotId } = freshRunDb(DS, `m-l4-f5c-${i}`);
    const ctl = openDb(dbPath);
    const p = runEngine({ dbPath, snapshotId, blobsDir: BLOBS, workers: 2 });
    for (let k = 0; k < 20000; k++) {
      await sleep(1);
      const s = ctl
        .query(
          `SELECT SUM(state IN ('COMPLETED','SKIPPED','FAILED')) d, COUNT(*) t FROM t7_jobs`,
        )
        .get() as any;
      if (s.t > 0 && s.d / s.t >= 0.4) break;
    }
    const tc = now();
    cancelHalt(ctl, snapshotId);
    const res = await p;
    const haltMs = now() - tc;
    const states = jobCounts(ctl, snapshotId);
    const inv = checkInvariants(ctl, snapshotId);
    const pendingRemain = states["PENDING"] ?? 0;
    // consistency probe (NOT a defined "resume-after-cancel" semantic): clear the flag and finish; graph must equal clean
    clearCancelHalt(ctl, snapshotId);
    const res2 = await runEngine({
      dbPath,
      snapshotId,
      blobsDir: BLOBS,
      workers: 2,
      enqueue: false,
    });
    const g = canonicalGraph(ctl, snapshotId);
    out.cancelHalt.push({
      haltToEngineExitMs: haltMs,
      statesAtHalt: states,
      noRunningOrClaimedLeft: !states["RUNNING"] && !states["CLAIMED"],
      pendingRemain,
      invariantViolationsAtHalt: inv,
      engineReportedStatusAtHalt: res.snapshotStatus,
      consistencyProbe_finishedAfterClearingFlag:
        res2.snapshotStatus === "completed",
      consistencyProbe_hashEqualsClean: g.hash === clean.hash,
    });
    ctl.close();
  }
  const pOk = out.pause.every(
    (x: any) =>
      x.armed &&
      x.noNewClaimsWhilePaused &&
      x.invariantViolationsWhilePaused.length === 0 &&
      x.resumedToCompletion &&
      x.hashEqualsClean,
  );
  const cOk = out.cancelHalt.every(
    (x: any) =>
      x.noRunningOrClaimedLeft &&
      x.pendingRemain > 0 &&
      x.invariantViolationsAtHalt.length === 0 &&
      x.consistencyProbe_hashEqualsClean,
  );
  out.classification =
    pOk && cOk
      ? "PASS-CRITERIA-MET (behaviour only; cancel terminal-state semantics NOT EVALUABLE — contract limitation)"
      : "CRITERIA-NOT-MET";
  out.pauseBehaviourOk = pOk;
  out.cancelHaltBehaviourOk = cOk;
  return out;
}

// ---------------------------------------------------------------- F-6 oversized file
function synthTs(bytes: number, tag: string) {
  // statements only (no functions/classes/calls): exercises the file-size POLICY without stressing resolution (band scaling is M-L1/M-L2's job)
  let s = `export const ${tag}Seed = 1;\n`;
  let i = 0;
  while (s.length < bytes) {
    s += `let ${tag}Rental${i} = ${i} + ${i % 7} * (${i} - 3);\n`;
    i++;
  }
  return s;
}
async function buildF6() {
  const dir = dsDir("f6-oversize");
  rmSync(dir, { recursive: true, force: true });
  const files: Record<string, string> = {
    "src/payment.ts":
      "export function pay(a: number): number { return notify(a); }\nexport function notify(a: number): number { return a; }\n",
    "src/pricing.ts":
      "import { pay } from './payment';\nexport class Pricing { total(a: number): number { return pay(a); } }\n",
    "src/big-600k.ts": synthTs(600 * 1024, "big"),
    "src/big-3m.ts": synthTs(3 * 1024 * 1024, "huge"),
    "src/generated-11m.js": synthTs(11 * 1024 * 1024, "gen")
      .replace(/: number/g, "")
      .replace(/\(fleet: number\)/g, "(fleet)")
      .replace(/\(n: number\)/g, "(n)"),
  };
  for (const [p, c] of Object.entries(files)) {
    const f = resolve(dir, "tree", p);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, c);
  }
  const db = createScratchDb(resolve(dir, "template.db"));
  const ing = await ingestLocalSnapshot(db, {
    treeDir: resolve(dir, "tree"),
    blobsDir: BLOBS,
    identity: { provider: "github", owner: "local", name: "f6-oversize" },
    commitSha: "0".repeat(39) + "6",
  });
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  return ing;
}
async function f6() {
  const ing = await buildF6();
  const out: any = {
    test: "F-6 oversized file",
    fixture: { files: ing.fileCount, bytes: ing.totalBytes },
    cases: [],
  };
  async function runCase(
    label: string,
    dataset: string,
    capBytes: number | null,
    workers = 2,
  ) {
    if (capBytes === null) delete process.env["CODE_INTEL_MAX_FILE_SIZE_BYTES"];
    else process.env["CODE_INTEL_MAX_FILE_SIZE_BYTES"] = String(capBytes);
    const { dbPath, snapshotId } = freshRunDb(dataset, label);
    const r = await runEngine({ dbPath, snapshotId, blobsDir: BLOBS, workers });
    const db = openDb(dbPath);
    const fe = db
      .query(
        `SELECT sf.path p, sf.size_bytes sz, fe.status st, fe.failure_reason fr, (SELECT COUNT(*) FROM symbols s WHERE s.file_extraction_id=fe.id) syms, (SELECT COUNT(*) FROM relationships r WHERE r.evidence_file_extraction_id=fe.id AND r.extraction_method='directory-hierarchy' AND r.target_kind='file' AND r.target_id=fe.id) dirContains FROM file_extractions fe JOIN snapshot_files sf ON sf.id=fe.snapshot_file_id WHERE fe.snapshot_id=?`,
      )
      .all(snapshotId) as any[];
    const skipped = fe.filter(
      (x) =>
        x.st === "skipped_unsupported" && x.fr && /size ceiling/.test(x.fr),
    );
    const jobsSkipped = db
      .query(
        `SELECT kind, unit_ref, state, error FROM t7_jobs WHERE state='SKIPPED' AND (error LIKE '%size ceiling%' OR error LIKE '%upstream-not-extracted:skipped%')`,
      )
      .all();
    const structuralRetained = skipped.every(
      (x) => x.dirContains === 1 && x.sz > 0,
    );
    const noSymbols = skipped.every((x) => x.syms === 0);
    const inv = checkInvariants(db, snapshotId);
    const rec = {
      label,
      capBytes: capBytes ?? "default (10 MiB)",
      oversizedFiles: skipped.map((x) => ({
        path: x.p,
        sizeBytes: x.sz,
        reason: x.fr,
      })),
      skippedJobs: jobsSkipped,
      structuralMetadataRetained: structuralRetained,
      noSymbolsForSkipped: noSymbols,
      silentDisappearances:
        fe.length -
        db
          .query(`SELECT COUNT(*) n FROM snapshot_files WHERE snapshot_id=?`)
          .get(snapshotId)!["n" as never],
      snapshotStatus: r.snapshotStatus,
      invariantViolations: inv,
      engineWallMs: r.wallMs,
      peakRssMiB: Math.round(r.memory.peakRss / 1048576),
      parsedFilesExtracted: fe
        .filter((x) => x.st === "extracted")
        .map((x) => x.p),
    };
    db.close();
    return rec;
  }
  out.cases.push(await runCase("m-l4-f6-512k", "f6-oversize", 512 * 1024));
  out.cases.push(await runCase("m-l4-f6-default10m", "f6-oversize", null));
  out.cases.push(await runCase("m-l4-f6-rm-8k", DS, 8 * 1024));
  delete process.env["CODE_INTEL_MAX_FILE_SIZE_BYTES"];
  const c0 = out.cases[0],
    c1 = out.cases[1],
    c2 = out.cases[2];
  out.expectations = {
    cap512k_skipsAll3Over512KiB:
      c0.oversizedFiles.length === 3 && c0.parsedFilesExtracted.length === 2,
    default10m_skipsOnlyTheElevenMiB:
      c1.oversizedFiles.length === 1 && c1.parsedFilesExtracted.length === 4,
    structuralMetadataRetainedEverywhere: [c0, c1, c2].every(
      (c) => c.structuralMetadataRetained && c.noSymbolsForSkipped,
    ),
    noSilentDisappearance: [c0, c1, c2].every(
      (c) => c.silentDisappearances === 0,
    ),
    invariantsClean: [c0, c1, c2].every(
      (c) => c.invariantViolations.length === 0,
    ),
    r_m_lowCapSkipsSomeAndKeepsRest:
      c2.oversizedFiles.length > 0 && c2.parsedFilesExtracted.length > 0,
  };
  out.classification = Object.values(out.expectations).every(Boolean)
    ? "PASS-CRITERIA-MET"
    : "CRITERIA-NOT-MET";
  return out;
}

// ---------------------------------------------------------------- driver
const results: Record<string, any> = {};
const clean = await cleanReference();
console.log(
  `clean reference hash ${clean.hash.slice(0, 12)} (3 clean runs equal: ${clean.allEqual})`,
);
const tests: [string, () => Promise<any>][] = [
  ["f1", () => f1(clean, "a")],
  ["f1b", () => f1(clean, "b")],
  ["f2", () => f2(clean)],
  ["f3", () => f3(clean)],
  ["f4", () => f4(clean)],
  ["f5", () => f5(clean)],
  ["f6", () => f6()],
];
for (const [name, fn] of tests) {
  if (which !== "all" && which !== name) continue;
  const t = now();
  let res: any;
  try {
    res = await fn();
  } catch (e) {
    res = {
      test: name,
      classification: "HARNESS-ERROR",
      error: String(e),
      stack: (e as Error).stack?.split("\n").slice(0, 6),
    };
  }
  res.durationMs = now() - t;
  writeEvidence(`m-l4-${name}.json`, {
    measurement: "M-L4 part 3",
    dataset: DS,
    environmentHash: env.envHash,
    loadAvgAtStart: env.dynamic.loadAvg,
    power: env.dynamic.power,
    cleanReferenceHash: clean.hash,
    cleanRunsEqual: clean.allEqual,
    ...res,
  });
  console.log(
    `${name}: ${res.classification} (${Math.round(res.durationMs)} ms)`,
  );
}
