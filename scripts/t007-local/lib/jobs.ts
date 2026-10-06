import type { Database } from "bun:sqlite";

/**
 * PROTOTYPE durable job engine storage layer implementing specs/004-…/contracts/local-job-engine.md exactly:
 * seven states, claims with lease timeout, bounded retry/backoff, checkpoint, per-snapshot pause/cancel,
 * `symbols` < `contains` < `parsed` ordering (barrier on kind_order). Every state change is a SQLite transaction.
 * Contract gaps found while implementing are recorded in the S-L1 report (e.g. no CANCELLED state).
 */
export const KIND_ORDER: Record<string, number> = {
  symbols: 1,
  contains: 2,
  parsed: 3,
};
export type JobState =
  | "PENDING"
  | "CLAIMED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING"
  | "SKIPPED";
export type Job = {
  id: number;
  snapshot_id: number;
  kind: string;
  kind_order: number;
  unit_ref: string;
  state: JobState;
  attempts: number;
  reclaims: number;
  checkpoint: string | null;
  claimed_by: string | null;
  claimed_at: number | null;
  error: string | null;
};
export type Policy = {
  leaseMs: number;
  maxAttempts: number;
  backoffBaseMs: number;
};
export const DEFAULT_POLICY: Policy = {
  leaseMs: 30_000,
  maxAttempts: 3,
  backoffBaseMs: 25,
}; // harness values; production defaults are a T008+ decision

/** D10 (M-L4 review): the claim's MIN(kind_order) subquery scanned every job of the snapshot via the (snapshot_id) autoindex; claims are O(total jobs) under the write lock. Snapshot-scoped index fixes it (schema-level harness defect, same class as D2/D8). */
export const CLAIM_INDEX_SQL = `DROP INDEX IF EXISTS idx_t7_jobs_claim; CREATE INDEX IF NOT EXISTS idx_t7_jobs_claim2 ON t7_jobs (snapshot_id, state, kind_order, id);`;

export function enqueueJobs(
  db: Database,
  snapshotId: number,
  jobs: { kind: string; unitRef: string }[],
  nowMs = Date.now(),
): number {
  db.exec(CLAIM_INDEX_SQL);
  const ins = db.query(
    `INSERT OR IGNORE INTO t7_jobs (snapshot_id, kind, kind_order, unit_ref, state, updated_at) VALUES (?, ?, ?, ?, 'PENDING', ?)`,
  );
  let n = 0;
  db.transaction(() => {
    db.query(`INSERT OR IGNORE INTO t7_control (snapshot_id) VALUES (?)`).run(
      snapshotId,
    );
    for (const j of jobs)
      n += ins.run(
        snapshotId,
        j.kind,
        KIND_ORDER[j.kind]!,
        j.unitRef,
        nowMs,
      ).changes;
  }).immediate();
  return n;
}

export type ClaimResult = {
  job: Job | null;
  reason: "claimed" | "none-left" | "wait" | "paused" | "cancelled";
  reclaimed: number;
};

export function claim(
  db: Database,
  snapshotId: number,
  workerId: string,
  policy: Policy,
  nowMs = Date.now(),
  readPrecheck = false,
): ClaimResult {
  if (readPrecheck) {
    // VARIANT (not the pre-registered primary configuration): idle workers first look with a read-only query and take the write lock only when a claim or a reclaim is actually possible
    const r = db
      .query(
        `SELECT (SELECT paused FROM t7_control WHERE snapshot_id=?1) paused, (SELECT cancelled FROM t7_control WHERE snapshot_id=?1) cancelled,
          EXISTS(SELECT 1 FROM t7_jobs WHERE snapshot_id=?1 AND state='PENDING' AND kind_order=(SELECT MIN(kind_order) FROM t7_jobs WHERE snapshot_id=?1 AND state IN ('PENDING','CLAIMED','RUNNING','RETRYING'))) claimable,
          EXISTS(SELECT 1 FROM t7_jobs WHERE snapshot_id=?1 AND state='RETRYING' AND not_before<=?2) retryDue,
          EXISTS(SELECT 1 FROM t7_jobs WHERE snapshot_id=?1 AND state IN ('CLAIMED','RUNNING') AND claimed_at<?3) stale,
          (SELECT COUNT(*) FROM t7_jobs WHERE snapshot_id=?1 AND state IN ('PENDING','CLAIMED','RUNNING','RETRYING')) open`,
      )
      .get(snapshotId, nowMs, nowMs - policy.leaseMs) as {
      paused: number | null;
      cancelled: number | null;
      claimable: number;
      retryDue: number;
      stale: number;
      open: number;
    };
    if (r.cancelled) return { job: null, reason: "cancelled", reclaimed: 0 };
    if (r.paused) return { job: null, reason: "paused", reclaimed: 0 };
    if (!r.claimable && !r.retryDue && !r.stale)
      return {
        job: null,
        reason: r.open === 0 ? "none-left" : "wait",
        reclaimed: 0,
      };
  }
  let reclaimed = 0;
  let result: ClaimResult = { job: null, reason: "wait", reclaimed: 0 };
  db.transaction(() => {
    const ctl = db
      .query(`SELECT paused, cancelled FROM t7_control WHERE snapshot_id=?`)
      .get(snapshotId) as { paused: number; cancelled: number } | null;
    if (ctl?.cancelled) {
      result = { job: null, reason: "cancelled", reclaimed: 0 };
      return;
    }
    if (ctl?.paused) {
      result = { job: null, reason: "paused", reclaimed: 0 };
      return;
    }
    // stale-claim reclaim after lease timeout (guarantee 1); a crash is not the unit's fault → attempts unchanged
    reclaimed = db
      .query(
        `UPDATE t7_jobs SET state='PENDING', claimed_by=NULL, claimed_at=NULL, reclaims=reclaims+1, updated_at=? WHERE snapshot_id=? AND state IN ('CLAIMED','RUNNING') AND claimed_at < ?`,
      )
      .run(nowMs, snapshotId, nowMs - policy.leaseMs).changes;
    db.query(
      `UPDATE t7_jobs SET state='PENDING', updated_at=? WHERE snapshot_id=? AND state='RETRYING' AND not_before <= ?`,
    ).run(nowMs, snapshotId, nowMs);
    const job = db
      .query(
        `UPDATE t7_jobs SET state='CLAIMED', claimed_by=?, claimed_at=?, updated_at=? WHERE id = (SELECT id FROM t7_jobs WHERE snapshot_id=? AND state='PENDING' AND kind_order = (SELECT MIN(kind_order) FROM t7_jobs WHERE snapshot_id=? AND state IN ('PENDING','CLAIMED','RUNNING','RETRYING')) ORDER BY id LIMIT 1) RETURNING *`,
      )
      .get(workerId, nowMs, nowMs, snapshotId, snapshotId) as Job | null;
    if (job) {
      result = { job, reason: "claimed", reclaimed };
      return;
    }
    const open = (
      db
        .query(
          `SELECT COUNT(*) AS n FROM t7_jobs WHERE snapshot_id=? AND state IN ('PENDING','CLAIMED','RUNNING','RETRYING')`,
        )
        .get(snapshotId) as { n: number }
    ).n;
    result = {
      job: null,
      reason: open === 0 ? "none-left" : "wait",
      reclaimed,
    };
  }).immediate();
  return result;
}

export function markRunning(db: Database, id: number, nowMs = Date.now()) {
  db.query(
    `UPDATE t7_jobs SET state='RUNNING', updated_at=? WHERE id=? AND state='CLAIMED'`,
  ).run(nowMs, id);
}

/** Call inside the unit's own persist transaction so results + COMPLETED are atomic (guarantees 1, 2). */
export function completeJob(
  db: Database,
  id: number,
  checkpoint: string,
  state: "COMPLETED" | "SKIPPED" = "COMPLETED",
  note: string | null = null,
  nowMs = Date.now(),
) {
  db.query(
    `UPDATE t7_jobs SET state=?, checkpoint=?, error=?, claimed_by=NULL, updated_at=? WHERE id=?`,
  ).run(state, checkpoint, note, nowMs, id);
}

export class UnitError extends Error {
  constructor(
    public code: string,
    message: string,
    public transient: boolean,
  ) {
    super(message);
  }
}

/** Typed error, no stack trace stored (contract job model). Transient → RETRYING with exponential backoff until attempts exhausted. */
export function failJob(
  db: Database,
  job: Job,
  err: unknown,
  policy: Policy,
  nowMs = Date.now(),
): "FAILED" | "RETRYING" {
  const e =
    err instanceof UnitError
      ? err
      : new UnitError(
          "unit-error",
          err instanceof Error ? err.message : String(err),
          false,
        );
  const attempts = job.attempts + 1;
  const retry = e.transient && attempts < policy.maxAttempts;
  const error = JSON.stringify({
    code: e.code,
    message: e.message.slice(0, 300),
    transient: e.transient,
  });
  if (retry)
    db.query(
      `UPDATE t7_jobs SET state='RETRYING', attempts=?, not_before=?, error=?, claimed_by=NULL, updated_at=? WHERE id=?`,
    ).run(
      attempts,
      nowMs + policy.backoffBaseMs * 2 ** (attempts - 1),
      error,
      nowMs,
      job.id,
    );
  else
    db.query(
      `UPDATE t7_jobs SET state='FAILED', attempts=?, error=?, claimed_by=NULL, updated_at=? WHERE id=?`,
    ).run(attempts, error, nowMs, job.id);
  return retry ? "RETRYING" : "FAILED";
}

export function pause(db: Database, snapshotId: number) {
  db.query(
    `INSERT INTO t7_control (snapshot_id, paused) VALUES (?,1) ON CONFLICT(snapshot_id) DO UPDATE SET paused=1`,
  ).run(snapshotId);
}
export function resume(db: Database, snapshotId: number) {
  db.query(`UPDATE t7_control SET paused=0 WHERE snapshot_id=?`).run(
    snapshotId,
  );
}
/** Cancel: stop claiming; unclaimed PENDING/RETRYING → FAILED('cancelled') because the contract has no CANCELLED state (gap recorded); RUNNING units finish. */
export function cancel(db: Database, snapshotId: number, nowMs = Date.now()) {
  db.transaction(() => {
    db.query(`UPDATE t7_control SET cancelled=1 WHERE snapshot_id=?`).run(
      snapshotId,
    );
    db.query(
      `UPDATE t7_jobs SET state='FAILED', error='{"code":"cancelled","transient":false}', updated_at=? WHERE snapshot_id=? AND state IN ('PENDING','RETRYING')`,
    ).run(nowMs, snapshotId);
  }).immediate();
}

export function jobCounts(
  db: Database,
  snapshotId: number,
  kind?: string,
): Record<string, number> {
  const rows = db
    .query(
      `SELECT state, COUNT(*) AS n FROM t7_jobs WHERE snapshot_id=? ${kind ? "AND kind=?" : ""} GROUP BY state`,
    )
    .all(...(kind ? [snapshotId, kind] : [snapshotId])) as {
    state: string;
    n: number;
  }[];
  return Object.fromEntries(rows.map((r) => [r.state, r.n]));
}

/** Contract guarantee 8 (purge): removes the snapshot's jobs with its artifacts (relationships/symbols/… cascade via snapshots FK). t7_* tables carry no FK → explicit delete. */
export function purgeSnapshot(db: Database, snapshotId: number) {
  db.transaction(() => {
    db.query(`DELETE FROM t7_jobs WHERE snapshot_id=?`).run(snapshotId);
    db.query(`DELETE FROM t7_control WHERE snapshot_id=?`).run(snapshotId);
    db.query(`DELETE FROM t7_map WHERE snapshot_id=?`).run(snapshotId);
    db.query(`DELETE FROM snapshots WHERE id=?`).run(snapshotId);
  }).immediate();
}

/** Contract guarantee 7: repository lifecycle as a projection over job states. PAUSED needs t7_control (gap: not derivable from the seven job states alone). */
export function lifecycle(
  db: Database,
  snapshotId: number,
): "QUEUED" | "ANALYZING" | "GRAPHIFIED" | "FAILED" | "PAUSED" {
  const c = jobCounts(db, snapshotId);
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const paused = (
    db
      .query(`SELECT paused FROM t7_control WHERE snapshot_id=?`)
      .get(snapshotId) as { paused: number } | null
  )?.paused;
  if (paused) return "PAUSED";
  const open =
    (c["PENDING"] ?? 0) +
    (c["CLAIMED"] ?? 0) +
    (c["RUNNING"] ?? 0) +
    (c["RETRYING"] ?? 0);
  if (total === 0 || open === total) return "QUEUED";
  if (open > 0) return "ANALYZING";
  return (c["FAILED"] ?? 0) > 0 ? "FAILED" : "GRAPHIFIED";
}

/** Cancel-halt (M-L4 F-5): stop claiming only. Job rows are NOT rewritten — the contract defines no terminal "cancelled" state, so none is invented; unclaimed jobs stay PENDING. */
export function cancelHalt(db: Database, snapshotId: number) {
  db.query(
    `INSERT INTO t7_control (snapshot_id, cancelled) VALUES (?,1) ON CONFLICT(snapshot_id) DO UPDATE SET cancelled=1`,
  ).run(snapshotId);
}
export function clearCancelHalt(db: Database, snapshotId: number) {
  db.query(`UPDATE t7_control SET cancelled=0 WHERE snapshot_id=?`).run(
    snapshotId,
  );
}
