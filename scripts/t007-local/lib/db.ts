import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  D1DatabaseLike,
  D1PreparedStatement,
  D1Result,
} from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { REPO_ROOT } from "./common";

/**
 * PROTOTYPE scratch schema. Production schema file (data/code-intel-schema.sql) is applied
 * READ-ONLY (never written); everything below is a scratch-only extension recorded as a T007 finding:
 *  - idx_symbols_snapshot_name: F004's "indexed bounded lookup" (research.md §2) needs a name index that the F002 schema lacks.
 *  - relationships.t7_target_name/t7_import_spec: unresolved-fact fields kept so incremental re-resolution needs no re-parse.
 *  - t7_* tables: prototype durable job engine (contracts/local-job-engine.md).
 */
export const SCRATCH_EXTENSION_SQL = `
CREATE INDEX IF NOT EXISTS idx_symbols_snapshot_name ON symbols (snapshot_id, name, kind);
ALTER TABLE relationships ADD COLUMN t7_target_name TEXT;
ALTER TABLE relationships ADD COLUMN t7_import_spec TEXT;
CREATE INDEX IF NOT EXISTS idx_relationships_t7_target_name ON relationships (snapshot_id, t7_target_name);

CREATE TABLE IF NOT EXISTS t7_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  kind_order INTEGER NOT NULL,
  unit_ref TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PENDING','CLAIMED','RUNNING','COMPLETED','FAILED','RETRYING','SKIPPED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  reclaims INTEGER NOT NULL DEFAULT 0,
  checkpoint TEXT,
  claimed_by TEXT,
  claimed_at INTEGER,
  updated_at INTEGER NOT NULL,
  not_before INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  UNIQUE (snapshot_id, kind, unit_ref)
);
CREATE INDEX IF NOT EXISTS idx_t7_jobs_claim2 ON t7_jobs (snapshot_id, state, kind_order, id);
CREATE TABLE IF NOT EXISTS t7_control (snapshot_id INTEGER PRIMARY KEY, paused INTEGER NOT NULL DEFAULT 0, cancelled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS t7_map (snapshot_id INTEGER NOT NULL, kind TEXT NOT NULL, old_id INTEGER NOT NULL, new_id INTEGER NOT NULL, PRIMARY KEY (snapshot_id, kind, old_id));
CREATE TABLE IF NOT EXISTS t7_meta (key TEXT PRIMARY KEY, value TEXT);
`;

export type JournalMode = "WAL" | "DELETE";

export function openDb(
  path: string,
  opts: {
    journal?: JournalMode;
    synchronous?: "NORMAL" | "FULL" | "OFF";
    readonly?: boolean;
  } = {},
): Database {
  const db = new Database(
    path,
    opts.readonly ? { readonly: true } : { create: true },
  );
  db.exec("PRAGMA busy_timeout = 15000");
  if (!opts.readonly) {
    db.exec(`PRAGMA journal_mode = ${opts.journal ?? "WAL"}`);
    db.exec(`PRAGMA synchronous = ${opts.synchronous ?? "NORMAL"}`);
  }
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export function createScratchDb(
  path: string,
  opts: { journal?: JournalMode; synchronous?: "NORMAL" | "FULL" | "OFF" } = {},
): Database {
  const db = openDb(path, opts);
  db.exec(
    readFileSync(resolve(REPO_ROOT, "data/code-intel-schema.sql"), "utf8"),
  );
  db.exec(SCRATCH_EXTENSION_SQL);
  return db;
}

/** D1DatabaseLike over a bun:sqlite Database (mirrors tests/support/d1-sqlite-adapter.ts; harness-owned copy, file-backed). Optionally accumulates time spent inside statements. */
export function createD1Shim(
  db: Database,
  timer?: { ms: number },
): D1DatabaseLike {
  function prepare(query: string): D1PreparedStatement {
    let args: unknown[] = [];
    const time = <T>(fn: () => T): T => {
      if (!timer) return fn();
      const t = performance.now();
      try {
        return fn();
      } finally {
        timer.ms += performance.now() - t;
      }
    };
    const st: D1PreparedStatement = {
      bind(...v: unknown[]) {
        args = v;
        return st;
      },
      async run<T>(): Promise<D1Result<T>> {
        const info = time(() =>
          db.prepare(query).run(...(args as never[])),
        ) as { lastInsertRowid: number; changes: number };
        return {
          success: true,
          meta: {
            last_row_id: Number(info.lastInsertRowid),
            changes: info.changes,
          },
        };
      },
      async all<T>(): Promise<D1Result<T>> {
        const rows = time(() =>
          db.prepare(query).all(...(args as never[])),
        ) as T[];
        return { success: true, results: rows, meta: {} };
      },
      async first<T>(): Promise<T | null> {
        const row = time(() => db.prepare(query).get(...(args as never[]))) as
          T | undefined;
        return row ?? null;
      },
    };
    return st;
  }
  return {
    prepare,
    async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const out: D1Result<T>[] = [];
      db.exec("BEGIN");
      try {
        for (const s of statements) out.push(await s.run<T>());
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return out;
    },
  };
}
