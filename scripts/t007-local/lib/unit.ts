import type { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractFile } from "../../../src/lib/code-intel/symbols/extraction-pipeline";
import {
  detectLanguage,
  type SupportedLanguage,
} from "../../../src/lib/code-intel/symbols/language-detector";
import { getParser } from "./wasm";
import { createD1Shim } from "./db";
import { completeJob, UnitError, type Job } from "./jobs";
import {
  deriveContainsForFile,
  deriveDirectoryContains,
  extractFacts,
  persistRows,
  posKey,
  RELATIONSHIP_EXTRACTOR_VERSION,
  emptyTrace,
  relationshipKey,
  resolveFact,
  Resolver,
  SYMBOL_EXTRACTOR_VERSION,
  PARSED_METHODS,
  CONTAINS_METHODS,
  type FileCtx,
  type ResolvedRow,
} from "./rel";

export type Faults = Record<
  string,
  {
    mode: "transient" | "permanent";
    times?: number;
    at?: "pre" | "mid" | "post";
  }
>; // key `${kind}:${unitRef}`
export type Phases = Record<string, number>;
export type UnitOutcome = {
  state: "COMPLETED" | "SKIPPED";
  phases: Phases;
  counts: Record<string, number>;
  shortCircuit?: boolean;
};

export interface UnitCtx {
  inline?: boolean;
  /** phase-boundary heartbeat for stall diagnosis (M-L1/M-L2 runner only) */
  onPhase?: (phase: string) => void;
  db: Database;
  snapshotId: number;
  blobsDir: string;
  faults: Faults;
  policyMaxAttempts: number;
  resolver: Resolver;
  d1: ReturnType<typeof createD1Shim>;
  d1Timer: { ms: number };
}

const checkpointOf = (rows: number) =>
  JSON.stringify({
    v: `${SYMBOL_EXTRACTOR_VERSION}/${RELATIONSHIP_EXTRACTOR_VERSION}`,
    rows,
  });
const versionOk = (cp: string | null) => {
  try {
    return (
      cp !== null &&
      JSON.parse(cp).v ===
        `${SYMBOL_EXTRACTOR_VERSION}/${RELATIONSHIP_EXTRACTOR_VERSION}`
    );
  } catch {
    return false;
  }
};
const tick = () => performance.now();

/** Job completion inside the unit's transaction; a no-op for the inline (no-job-engine) baseline used to measure job-engine overhead (G6). */
function finish(
  ctx: UnitCtx,
  id: number,
  checkpoint: string,
  state: "COMPLETED" | "SKIPPED" = "COMPLETED",
  note: string | null = null,
) {
  if (!ctx.inline) completeJob(ctx.db, id, checkpoint, state, note);
}

/** BEGIN IMMEDIATE / body / COMMIT with the three costs separated (write-lock wait vs SQL work vs commit) so "persist" attribution can distinguish single-writer contention from inherent write cost. */
function tx<T>(
  ctx: UnitCtx,
  body: () => T,
): { value: T; lockMs: number; bodyMs: number; commitMs: number } {
  const t0 = tick();
  ctx.db.exec("BEGIN IMMEDIATE");
  const t1 = tick();
  let value: T;
  try {
    value = body();
  } catch (e) {
    ctx.db.exec("ROLLBACK");
    throw e;
  }
  const t2 = tick();
  ctx.db.exec("COMMIT");
  const t3 = tick();
  return { value, lockMs: t1 - t0, bodyMs: t2 - t1, commitMs: t3 - t2 };
}
const addTx = (
  T: Phases,
  r: { lockMs: number; bodyMs: number; commitMs: number },
) => {
  T["persistLock"] = (T["persistLock"] ?? 0) + r.lockMs;
  T["persistBody"] = (T["persistBody"] ?? 0) + r.bodyMs;
  T["persistCommit"] = (T["persistCommit"] ?? 0) + r.commitMs;
  T["persist"] = (T["persist"] ?? 0) + r.lockMs + r.bodyMs + r.commitMs;
};

/** Fault points: "pre" (before any work, default), "mid" (inside the persist transaction after the rows were written → exercises real ROLLBACK), "post" (after the production symbols write, before job completion). */
function injectFault(ctx: UnitCtx, job: Job, at: "pre" | "mid" | "post") {
  const f = ctx.faults[`${job.kind}:${job.unit_ref}`];
  if (!f || (f.at ?? "pre") !== at) return;
  if (f.mode === "permanent")
    throw new UnitError(
      "injected-permanent",
      `injected deterministic failure (${at})`,
      false,
    );
  if (job.attempts < (f.times ?? 1))
    throw new UnitError(
      "injected-transient",
      `injected transient failure (${at}) attempt ${job.attempts + 1}`,
      true,
    );
}

interface SF {
  id: number;
  snapshotId: number;
  path: string;
  sizeBytes: number;
  contentHash: string;
  r2Key: string;
}
const sfQuery = (db: Database, id: number) =>
  db
    .query(
      `SELECT id, snapshot_id AS snapshotId, path, size_bytes AS sizeBytes, content_hash AS contentHash, r2_key AS r2Key FROM snapshot_files WHERE id=?`,
    )
    .get(id) as SF | null;

export async function runUnit(ctx: UnitCtx, job: Job): Promise<UnitOutcome> {
  switch (job.kind) {
    case "symbols":
      return runSymbols(ctx, job);
    case "contains":
      return runContains(ctx, job);
    case "parsed":
      return runParsed(ctx, job);
    default:
      throw new UnitError("unknown-kind", job.kind, false);
  }
}

/** Feature 002 production path, unmodified (`extractFile`), through the file-backed sqlite D1 shim + fs R2 stand-in. Not atomic with the job row → idempotent redo by design (delete-then-insert per file). */
async function runSymbols(ctx: UnitCtx, job: Job): Promise<UnitOutcome> {
  const t0 = tick();
  injectFault(ctx, job, "pre");
  const sf = sfQuery(ctx.db, Number(job.unit_ref));
  if (!sf) throw new UnitError("missing-file", job.unit_ref, false);
  ctx.d1Timer.ms = 0;
  ctx.onPhase?.("symbols:extract");
  await extractFile({
    snapshotId: ctx.snapshotId,
    snapshotFile: sf,
    extractorVersion: SYMBOL_EXTRACTOR_VERSION,
    db: ctx.d1,
  });
  const persistMs = ctx.d1Timer.ms;
  injectFault(ctx, job, "post");
  const fe = ctx.db
    .query(
      `SELECT status, language, failure_reason AS reason FROM file_extractions WHERE snapshot_id=? AND snapshot_file_id=?`,
    )
    .get(ctx.snapshotId, sf.id) as {
    status: string;
    language: string | null;
    reason: string | null;
  } | null;
  const oversize = fe?.status === "skipped_unsupported" && fe.language !== null;
  const nSym = (
    ctx.db
      .query(
        `SELECT COUNT(*) n FROM symbols WHERE file_extraction_id=(SELECT id FROM file_extractions WHERE snapshot_id=? AND snapshot_file_id=?)`,
      )
      .get(ctx.snapshotId, sf.id) as { n: number }
  ).n;
  const t1 = tick();
  const ct = tx(ctx, () =>
    finish(
      ctx,
      job.id,
      checkpointOf(nSym),
      oversize ? "SKIPPED" : "COMPLETED",
      oversize ? fe!.reason : null,
    ),
  );
  const total = tick() - t0;
  const completeMs = tick() - t1;
  // production extractFile persists through the D1 shim (per-statement autocommit): persist = time inside shim statements; completion write is job bookkeeping, not persistence
  return {
    state: oversize ? "SKIPPED" : "COMPLETED",
    phases: {
      total,
      persist: persistMs,
      complete: completeMs,
      completeLock: ct.lockMs,
      extractOther: total - persistMs - completeMs,
    },
    counts: {
      symbols: nSym,
      extractionFailed: fe?.status === "failed" ? 1 : 0,
      oversize: oversize ? 1 : 0,
    },
  };
}

async function runContains(ctx: UnitCtx, job: Job): Promise<UnitOutcome> {
  const t0 = tick();
  injectFault(ctx, job, "pre");
  if (job.unit_ref === "*dirs") {
    const rows = deriveDirectoryContains(ctx.db, ctx.snapshotId);
    const t1 = tick();
    let n = 0;
    const P: Phases = {};
    addTx(
      P,
      tx(ctx, () => {
        ctx.db
          .query(
            `DELETE FROM relationships WHERE snapshot_id=? AND extraction_method='directory-hierarchy' AND evidence_file_extraction_id IS NULL`,
          )
          .run(ctx.snapshotId);
        n = persistRows(
          ctx.db,
          ctx.snapshotId,
          rows,
          new Date().toISOString(),
        ).inserted;
        finish(ctx, job.id, checkpointOf(n));
      }),
    );
    return {
      state: "COMPLETED",
      phases: { total: tick() - t0, derive: t1 - t0, ...P },
      counts: { relationships: n },
    };
  }
  const fe = ctx.db
    .query(
      `SELECT id FROM file_extractions WHERE snapshot_id=? AND snapshot_file_id=?`,
    )
    .get(ctx.snapshotId, Number(job.unit_ref)) as { id: number } | null;
  if (!fe) throw new UnitError("missing-file-extraction", job.unit_ref, false);
  const rows = deriveContainsForFile(ctx.db, ctx.snapshotId, fe.id);
  const t1 = tick();
  let n = 0;
  const P: Phases = {};
  addTx(
    P,
    tx(ctx, () => {
      ctx.db
        .query(
          `DELETE FROM relationships WHERE evidence_file_extraction_id=? AND extraction_method IN (${CONTAINS_METHODS.map((m) => `'${m}'`).join(",")})`,
        )
        .run(fe.id);
      n = persistRows(
        ctx.db,
        ctx.snapshotId,
        rows,
        new Date().toISOString(),
      ).inserted;
      finish(ctx, job.id, checkpointOf(n));
    }),
  );
  return {
    state: "COMPLETED",
    phases: { total: tick() - t0, derive: t1 - t0, ...P },
    counts: { relationships: n },
  };
}

async function runParsed(ctx: UnitCtx, job: Job): Promise<UnitOutcome> {
  const T: Phases = {};
  const t0 = tick();
  // Idempotency (guarantee 2): a redelivered unit whose checkpoint matches the current version pair short-circuits.
  if (versionOk(job.checkpoint)) {
    tx(ctx, () => finish(ctx, job.id, job.checkpoint!));
    return {
      state: "COMPLETED",
      phases: { total: tick() - t0 },
      counts: {},
      shortCircuit: true,
    };
  }
  injectFault(ctx, job, "pre");
  // phase: classification (row lookups)
  const sf = sfQuery(ctx.db, Number(job.unit_ref));
  if (!sf) throw new UnitError("missing-file", job.unit_ref, false);
  const fe = ctx.db
    .query(
      `SELECT id, language, status, failure_reason AS reason FROM file_extractions WHERE snapshot_id=? AND snapshot_file_id=?`,
    )
    .get(ctx.snapshotId, sf.id) as {
    id: number;
    language: SupportedLanguage | null;
    status: string;
    reason: string | null;
  } | null;
  if (!fe || fe.status !== "extracted" || !fe.language) {
    tx(ctx, () =>
      finish(
        ctx,
        job.id,
        checkpointOf(0),
        "SKIPPED",
        `upstream-not-extracted:${fe?.status ?? "missing"}`,
      ),
    );
    return {
      state: "SKIPPED",
      phases: { total: tick() - t0 },
      counts: { skippedUpstream: 1 },
    };
  }
  const symRows = ctx.db
    .query(
      `SELECT id, symbol_key AS key, kind, start_line AS sl, start_column AS sc FROM symbols WHERE file_extraction_id=?`,
    )
    .all(fe.id) as {
    id: number;
    key: string;
    kind: string;
    sl: number;
    sc: number;
  }[];
  const symByStart = new Map<number, { id: number; key: string }>();
  const fnStarts = new Set<number>();
  for (const s of symRows) {
    const k = posKey(s.sl, s.sc);
    if (!symByStart.has(k) || s.kind !== "module")
      symByStart.set(k, { id: s.id, key: s.key });
    if (s.kind === "function" || s.kind === "method") fnStarts.add(k);
  }
  let t = tick();
  T["classify"] = t - t0;
  ctx.onPhase?.("parsed:read");
  // phase: read + decode
  const bytes = readFileSync(resolve(ctx.blobsDir, sf.contentHash));
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  T["read"] = tick() - t;
  t = tick();
  // phase: parse (unmodified production getParser)
  ctx.onPhase?.("parsed:parse");
  const parser = await getParser(fe.language);
  const tree = parser.parse(text);
  if (!tree) throw new UnitError("parse-failed", sf.path, false);
  T["parse"] = tick() - t;
  t = tick();
  let rows: ResolvedRow[];
  let keys: string[];
  let astNodes = 0;
  try {
    astNodes = tree.rootNode.descendantCount;
    // phase: relationship fact extraction
    ctx.onPhase?.("parsed:facts");
    const facts = extractFacts(tree, parser.language!, fe.language, fnStarts);
    T["facts"] = tick() - t;
    t = tick();
    // phase: resolution (indexed SQLite lookups)
    const fctx: FileCtx = {
      feId: fe.id,
      path: sf.path,
      lang: fe.language,
      symByStart,
    };
    ctx.onPhase?.("parsed:resolve");
    if (ctx.resolver.trace) Object.assign(ctx.resolver.trace, emptyTrace());
    rows = facts.map((f) => resolveFact(ctx.resolver, fctx, f));
    T["resolve"] = tick() - t;
    if (ctx.resolver.trace) {
      const tr = ctx.resolver.trace;
      T["resolveSameFile"] = tr.sameFileMs;
      T["resolveByName"] = tr.byNameMs;
      T["resolveFiles"] = tr.filesMs;
      T["resolveOther"] =
        T["resolve"] - tr.sameFileMs - tr.byNameMs - tr.filesMs;
      T["lookupSameFileCalls"] = tr.sameFileCalls;
      T["lookupSameFileRows"] = tr.sameFileRows;
      T["lookupByNameCalls"] = tr.byNameCalls;
      T["lookupByNameRows"] = tr.byNameRows;
    }
    t = tick();
    // phase: identity hashing (moved OUT of the write lock so persistLock/Body measure database work, not sha256 CPU)
    keys = rows.map((r) => relationshipKey(ctx.snapshotId, r));
    T["keys"] = tick() - t;
    t = tick();
  } finally {
    tree.delete(); // R5 tree-lifecycle lesson: free immediately
  }
  // phase: persist (delete-then-insert for this file's parsed rows + COMPLETED, one atomic transaction)
  ctx.onPhase?.("parsed:persist");
  let res = { inserted: 0, duplicateKeys: 0, candidates: 0 };
  let completeMs = 0;
  const wt = tx(ctx, () => {
    ctx.db
      .query(
        `DELETE FROM relationships WHERE evidence_file_extraction_id=? AND extraction_method IN (${PARSED_METHODS.map((m) => `'${m}'`).join(",")})`,
      )
      .run(fe.id);
    res = persistRows(
      ctx.db,
      ctx.snapshotId,
      rows,
      new Date().toISOString(),
      keys,
    );
    injectFault(ctx, job, "mid");
    const tc = tick();
    finish(ctx, job.id, checkpointOf(res.inserted));
    completeMs = tick() - tc;
  });
  addTx(T, wt);
  T["complete"] = completeMs;
  T["total"] = tick() - t0;
  const states: Record<string, number> = {};
  for (const r of rows) states[r.state] = (states[r.state] ?? 0) + 1;
  return {
    state: "COMPLETED",
    phases: T,
    counts: {
      facts: rows.length,
      relationships: res.inserted,
      duplicateKeys: res.duplicateKeys,
      candidates: res.candidates,
      astNodes,
      bytes: bytes.length,
      resolved: states["RESOLVED"] ?? 0,
      ambiguous: states["AMBIGUOUS"] ?? 0,
      unknown: states["UNKNOWN"] ?? 0,
      lookups: rows.length,
    },
  };
}

export function newUnitCtx(
  db: Database,
  snapshotId: number,
  blobsDir: string,
  faults: Faults,
  policyMaxAttempts: number,
): UnitCtx {
  const d1Timer = { ms: 0 };
  return {
    db,
    snapshotId,
    blobsDir,
    faults,
    policyMaxAttempts,
    resolver: new Resolver(db, snapshotId),
    d1: createD1Shim(db, d1Timer),
    d1Timer,
  };
}

export function classifyJobs(
  db: Database,
  snapshotId: number,
): { kind: string; unitRef: string }[] {
  const files = db
    .query(
      `SELECT id, path FROM snapshot_files WHERE snapshot_id=? ORDER BY id`,
    )
    .all(snapshotId) as { id: number; path: string }[];
  const jobs: { kind: string; unitRef: string }[] = [];
  for (const f of files) jobs.push({ kind: "symbols", unitRef: String(f.id) });
  jobs.push({ kind: "contains", unitRef: "*dirs" });
  for (const f of files) jobs.push({ kind: "contains", unitRef: String(f.id) });
  for (const f of files)
    if (detectLanguage(f.path))
      jobs.push({ kind: "parsed", unitRef: String(f.id) });
  return jobs;
}
