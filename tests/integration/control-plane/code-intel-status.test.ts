import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import {
  RELATIONSHIP_EXTRACTOR_VERSION,
  SYMBOL_EXTRACTOR_VERSION,
} from "../../../src/lib/code-intel/config";
import {
  setTestCloudflareEnv,
  type D1DatabaseLike,
} from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { getCodeIntelStatusView } from "../../../src/lib/control-plane/code-intel-status";
import { getCodeIntelStatusHandler } from "../../../src/lib/control-plane/control-plane.functions";

const NOW = "2026-01-01T00:00:00Z";
let seq = 0;

async function seedRepo(db: D1DatabaseLike): Promise<number> {
  seq += 1;
  const r = await db
    .prepare(
      "INSERT INTO repositories (provider, owner, name, created_at) VALUES ('github', ?, ?, ?)",
    )
    .bind(`SENTINEL-OWNER-${seq}`, `SENTINEL-NAME-${seq}`, NOW)
    .run();
  return r.meta.last_row_id as number;
}

async function seedSnapshot(
  db: D1DatabaseLike,
  repoId: number,
  status: string,
): Promise<number> {
  seq += 1;
  const r = await db
    .prepare(
      "INSERT INTO snapshots (repository_id, commit_sha, attempt_number, status, acquisition_mode, created_at) VALUES (?, ?, 1, ?, 'bulk_archive', ?)",
    )
    .bind(repoId, `sha-SENTINEL-${seq}`, status, NOW)
    .run();
  return r.meta.last_row_id as number;
}

async function seedExtraction(
  db: D1DatabaseLike,
  snapshotId: number,
  status: string,
) {
  await db
    .prepare(
      "INSERT INTO snapshot_extractions (snapshot_id, status, extractor_version, started_at) VALUES (?, ?, 'v-test', ?)",
    )
    .bind(snapshotId, status, NOW)
    .run();
}

async function count(db: D1DatabaseLike, table: string): Promise<number> {
  const r = await db
    .prepare(`SELECT COUNT(*) AS n FROM ${table}`)
    .all<{ n: number }>();
  return r.results![0]!.n;
}

/** Wraps a D1 so every prepared statement text is recorded. */
function spied(db: D1DatabaseLike) {
  const statements: string[] = [];
  const wrapped: D1DatabaseLike = {
    prepare: (q) => {
      statements.push(q);
      return db.prepare(q);
    },
    batch: (s) => db.batch(s),
  };
  return { wrapped, statements };
}

let errorSpy: ReturnType<typeof spyOn>;
beforeEach(() => {
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  setTestCloudflareEnv(undefined);
  errorSpy.mockRestore();
});

describe("getCodeIntelStatusView", () => {
  test("empty tables: available, every count is 0, version exposed", async () => {
    setTestCloudflareEnv({ DB: createSqliteD1() });
    const status = await getCodeIntelStatusView();
    expect(status).toEqual({
      available: true,
      symbolExtractorVersion: SYMBOL_EXTRACTOR_VERSION,
      snapshots: {
        total: 0,
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0,
      },
      extractions: {
        total: 0,
        in_progress: 0,
        completed: 0,
        completed_partial: 0,
        failed: 0,
      },
    });
  });

  test("populated: exact counts and totals across every state", async () => {
    const db = createSqliteD1();
    setTestCloudflareEnv({ DB: db });
    const repo = await seedRepo(db);
    const plan = {
      pending: 1,
      in_progress: 2,
      completed: 3,
      failed: 1,
    } as const;
    const ids: Record<string, number[]> = {};
    for (const [status, n] of Object.entries(plan)) {
      ids[status] = [];
      for (let i = 0; i < n; i++)
        ids[status]!.push(await seedSnapshot(db, repo, status));
    }
    await seedExtraction(db, ids["completed"]![0]!, "completed");
    await seedExtraction(db, ids["completed"]![1]!, "completed");
    await seedExtraction(db, ids["completed"]![2]!, "completed_partial");
    await seedExtraction(db, ids["in_progress"]![0]!, "in_progress");
    await seedExtraction(db, ids["failed"]![0]!, "failed");

    const status = await getCodeIntelStatusView();
    expect(status.available).toBe(true);
    expect(status.snapshots).toEqual({
      total: 7,
      pending: 1,
      in_progress: 2,
      completed: 3,
      failed: 1,
    });
    expect(status.extractions).toEqual({
      total: 5,
      in_progress: 1,
      completed: 2,
      completed_partial: 1,
      failed: 1,
    });
  });

  test("no D1 binding: available false / no_binding, no counts, no throw", async () => {
    setTestCloudflareEnv(undefined);
    const status = await getCodeIntelStatusView();
    expect(status).toEqual({
      available: false,
      reason: "no_binding",
      symbolExtractorVersion: SYMBOL_EXTRACTOR_VERSION,
    });
  });

  test("exactly two SELECT aggregate queries; SELECT only; no rows changed", async () => {
    const db = createSqliteD1();
    const repo = await seedRepo(db);
    const snap = await seedSnapshot(db, repo, "completed");
    await seedExtraction(db, snap, "completed");
    const before = {
      repos: await count(db, "repositories"),
      snaps: await count(db, "snapshots"),
      ext: await count(db, "snapshot_extractions"),
    };

    const { wrapped, statements } = spied(db);
    setTestCloudflareEnv({ DB: wrapped });
    await getCodeIntelStatusView();

    expect(statements).toHaveLength(2);
    for (const sql of statements) {
      expect(sql.trim()).toMatch(/^SELECT\b/i);
      expect(sql).toMatch(/COUNT\(\*\)/i);
      expect(sql).toMatch(/GROUP BY status/i);
      expect(sql).not.toMatch(
        /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE)\b/i,
      );
    }
    expect(statements[0]).toContain("FROM snapshots");
    expect(statements[1]).toContain("FROM snapshot_extractions");
    expect({
      repos: await count(db, "repositories"),
      snaps: await count(db, "snapshots"),
      ext: await count(db, "snapshot_extractions"),
    }).toEqual(before);
  });

  test("query failure: query_failed and no Error.message, SQL or sentinel escapes", async () => {
    const failing: D1DatabaseLike = {
      prepare: () => {
        throw new Error(
          "SENTINEL-DB-ERROR SELECT status FROM snapshots secret-binding-id",
        );
      },
      batch: async () => [],
    };
    setTestCloudflareEnv({ DB: failing });
    const status = await getCodeIntelStatusView();
    expect(status).toEqual({
      available: false,
      reason: "query_failed",
      symbolExtractorVersion: SYMBOL_EXTRACTOR_VERSION,
    });
    const text = JSON.stringify(status);
    for (const leak of ["SENTINEL", "SELECT", "secret-binding-id", "Error"])
      expect(text).not.toContain(leak);
  });

  test("output is counts only: no repository owner/name, commit or identifier", async () => {
    const db = createSqliteD1();
    setTestCloudflareEnv({ DB: db });
    const repo = await seedRepo(db);
    const snap = await seedSnapshot(db, repo, "completed");
    await seedExtraction(db, snap, "completed");
    const status = await getCodeIntelStatusView();
    expect(JSON.stringify(status)).not.toMatch(/SENTINEL|sha-|github|v-test/);
    expect(Object.keys(status).sort()).toEqual([
      "available",
      "extractions",
      "snapshots",
      "symbolExtractorVersion",
    ]);
    for (const group of [status.snapshots!, status.extractions!]) {
      for (const v of Object.values(group)) expect(typeof v).toBe("number");
    }
  });

  test("exposes SYMBOL_EXTRACTOR_VERSION and never RELATIONSHIP_EXTRACTOR_VERSION or relationship state", async () => {
    setTestCloudflareEnv({ DB: createSqliteD1() });
    const status = await getCodeIntelStatusView();
    expect(status.symbolExtractorVersion).toBe(SYMBOL_EXTRACTOR_VERSION);
    const text = JSON.stringify(status);
    expect(text).not.toMatch(/relationship/i);
    // Distinct constants today, so a leaked relationship version would be detectable as a value.
    expect(RELATIONSHIP_EXTRACTOR_VERSION as string).not.toBe(
      SYMBOL_EXTRACTOR_VERSION as string,
    );
    expect(Object.values(status)).not.toContain(RELATIONSHIP_EXTRACTOR_VERSION);
  });
});

describe("getCodeIntelStatusHandler", () => {
  test("returns the view, ignores supplied input, and works alongside no binding", async () => {
    setTestCloudflareEnv({ DB: createSqliteD1() });
    const call = getCodeIntelStatusHandler as (
      input?: unknown,
    ) => ReturnType<typeof getCodeIntelStatusHandler>;
    const plain = await getCodeIntelStatusHandler();
    expect(await call({ status: "failed", extra: "SENTINEL-INPUT" })).toEqual(
      plain,
    );
    setTestCloudflareEnv(undefined);
    expect(await getCodeIntelStatusHandler()).toMatchObject({
      available: false,
      reason: "no_binding",
    });
  });

  test("unexpected failure becomes a fixed reason with no internal detail", async () => {
    setTestCloudflareEnv({
      get DB(): never {
        throw new Error("SENTINEL-GETTER-FAILURE");
      },
    } as never);
    const status = await getCodeIntelStatusHandler();
    expect(status).toEqual({
      available: false,
      reason: "query_failed",
      symbolExtractorVersion: SYMBOL_EXTRACTOR_VERSION,
    });
    expect(
      JSON.stringify(status) + JSON.stringify(errorSpy.mock.calls),
    ).not.toContain("SENTINEL");
  });
});
