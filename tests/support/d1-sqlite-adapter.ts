import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  D1DatabaseLike,
  D1PreparedStatement,
  D1Result,
} from "../../src/lib/code-intel/persistence/cloudflare-env";

/**
 * D1 is SQLite-compatible; this wraps `bun:sqlite` in the same
 * `D1DatabaseLike` shape our persistence layer depends on, so contract tests
 * exercise real SQL (constraints, ON CONFLICT, transactions) without a live
 * Cloudflare account. Test-only — never imported by application code.
 */
export function createSqliteD1(): D1DatabaseLike {
  const db = new Database(":memory:");
  const schemaPath = resolve(
    import.meta.dir,
    "../../data/code-intel-schema.sql",
  );
  db.exec(readFileSync(schemaPath, "utf8"));

  function prepare(query: string): D1PreparedStatement {
    let boundArgs: unknown[] = [];
    const statement: D1PreparedStatement = {
      bind(...values: unknown[]) {
        boundArgs = values;
        return statement;
      },
      async run<T>(): Promise<D1Result<T>> {
        const info = db.prepare(query).run(...(boundArgs as never[])) as {
          lastInsertRowid: number;
          changes: number;
        };
        return {
          success: true,
          meta: {
            last_row_id: Number(info.lastInsertRowid),
            changes: info.changes,
          },
        };
      },
      async all<T>(): Promise<D1Result<T>> {
        const rows = db.prepare(query).all(...(boundArgs as never[])) as T[];
        return { success: true, results: rows, meta: {} };
      },
      async first<T>(): Promise<T | null> {
        const row = db.prepare(query).get(...(boundArgs as never[])) as
          T | undefined;
        return row ?? null;
      },
    };
    return statement;
  }

  return {
    prepare,
    async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const s of statements) results.push(await s.run<T>());
      return results;
    },
  };
}
