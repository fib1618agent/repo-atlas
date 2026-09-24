import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import {
  setTestCloudflareEnv,
  type D1DatabaseLike,
} from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  getRepositoryIntelligenceHandler,
  listFileSymbolsHandler,
  listStructureLevelHandler,
} from "../../../src/lib/repo-intel/repository-intelligence.functions";
import { extensionOf } from "../../../src/lib/repo-intel/paths";
import { MAX_SYMBOLS_FETCH } from "../../../src/lib/repo-intel/limits";

const NOW = "2026-01-01T00:00:00Z";
const OWNER = "acme-owner";
const NAME = "widget-repo";

let db: D1DatabaseLike;
let statements: string[];

/** Wraps a D1 so every prepared SQL string is recorded (SEC-003 SELECT-only check). */
function spy(inner: D1DatabaseLike): D1DatabaseLike {
  return {
    prepare(query: string) {
      statements.push(query);
      return inner.prepare(query);
    },
    batch: (s) => inner.batch(s),
  };
}

async function insert(sql: string, ...args: unknown[]): Promise<number> {
  const r = await db
    .prepare(sql)
    .bind(...args)
    .run();
  return r.meta.last_row_id as number;
}

async function seedRepo(owner = OWNER, name = NAME): Promise<number> {
  return insert(
    "INSERT INTO repositories (provider, owner, name, created_at) VALUES ('github', ?, ?, ?)",
    owner,
    name,
    NOW,
  );
}

async function seedSnapshot(
  repoId: number,
  status: string,
  completedAt: string | null,
  sha = "a".repeat(40),
  attempt = 1,
): Promise<number> {
  return insert(
    "INSERT INTO snapshots (repository_id, commit_sha, attempt_number, status, acquisition_mode, created_at, completed_at) VALUES (?, ?, ?, ?, 'bulk_archive', ?, ?)",
    repoId,
    sha,
    attempt,
    status,
    completedAt ?? NOW,
    completedAt,
  );
}

async function seedFile(
  snapshotId: number,
  path: string,
  size: number,
): Promise<number> {
  return insert(
    "INSERT INTO snapshot_files (snapshot_id, path, size_bytes, content_hash, r2_key) VALUES (?, ?, ?, ?, ?)",
    snapshotId,
    path,
    size,
    `hash-${path}`,
    `SECRET-R2-KEY/${path}`,
  );
}

async function seedExtraction(
  snapshotId: number,
  fileId: number,
  dir: string,
  language: string | null,
  status: string,
  failure: string | null = null,
): Promise<number> {
  return insert(
    "INSERT INTO file_extractions (snapshot_id, snapshot_file_id, directory_path, language, status, failure_reason, extractor_version, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'v2', ?)",
    snapshotId,
    fileId,
    dir,
    language,
    status,
    failure,
    NOW,
  );
}

async function seedSymbol(
  snapshotId: number,
  extractionId: number,
  kind: string,
  name: string,
  line: number,
  parent: number | null = null,
): Promise<number> {
  return insert(
    "INSERT INTO symbols (file_extraction_id, snapshot_id, kind, name, qualified_name, start_line, start_column, end_line, end_column, parent_symbol_id, is_exported, symbol_key, extractor_version, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1, ?, 1, ?, 'v2', ?)",
    extractionId,
    snapshotId,
    kind,
    name,
    name,
    line,
    line + 1,
    parent,
    `${extractionId}:${kind}:${name}:${line}`,
    NOW,
  );
}

async function seedReady(): Promise<number> {
  const repo = await seedRepo();
  const snap = await seedSnapshot(repo, "completed", "2026-01-02T00:00:00Z");
  const files: [string, number][] = [
    ["README.md", 100],
    ["package.json", 50],
    ["src/index.ts", 400],
    ["src/util.ts", 200],
    ["src/lib/deep/a.ts", 300],
    ["src/lib/b.js", 120],
    ["docs/guide.md", 500],
    ["docs/we ird & name.md", 10],
  ];
  const ids: Record<string, number> = {};
  for (const [p, s] of files) ids[p] = await seedFile(snap, p, s);
  await insert(
    "INSERT INTO snapshot_extractions (snapshot_id, status, extractor_version, started_at, completed_at) VALUES (?, 'completed', 'v2', ?, ?)",
    snap,
    NOW,
    NOW,
  );
  for (const d of ["src", "src/lib", "src/lib/deep", "docs"]) {
    await insert(
      "INSERT INTO directories (snapshot_id, path, parent_path) VALUES (?, ?, ?)",
      snap,
      d,
      d.includes("/") ? d.slice(0, d.lastIndexOf("/")) : null,
    );
  }
  const idx = await seedExtraction(
    snap,
    ids["src/index.ts"]!,
    "src",
    "typescript",
    "extracted",
  );
  const cls = await seedSymbol(snap, idx, "class", "Widget", 1);
  await seedSymbol(snap, idx, "method", "render", 2, cls);
  await seedSymbol(snap, idx, "function", "helper", 20);
  const util = await seedExtraction(
    snap,
    ids["src/util.ts"]!,
    "src",
    "typescript",
    "extracted",
  );
  await seedSymbol(snap, util, "function", "u", 1);
  const deep = await seedExtraction(
    snap,
    ids["src/lib/deep/a.ts"]!,
    "src/lib/deep",
    "typescript",
    "extracted",
  );
  await seedSymbol(snap, deep, "function", "deepFn", 1);
  await seedExtraction(
    snap,
    ids["src/lib/b.js"]!,
    "src/lib",
    "javascript",
    "failed",
    'R2 object missing for key "SECRET-R2-KEY/src/lib/b.js"',
  );
  return snap;
}

beforeEach(() => {
  statements = [];
  db = createSqliteD1();
  setTestCloudflareEnv({ DB: spy(db) });
});

afterEach(() => setTestCloudflareEnv(undefined));

describe("overview (FR-005, FR-011)", () => {
  test("ready: newest completed snapshot, extraction, composition, totals", async () => {
    const snap = await seedReady();
    const r = await getRepositoryIntelligenceHandler({
      owner: OWNER,
      name: NAME,
    });
    expect(r.status).toBe("ready");
    if (r.status !== "ready") return;
    expect(r.snapshot).toEqual({
      snapshotId: snap,
      commitSha: "a".repeat(40),
      completedAt: "2026-01-02T00:00:00Z",
    });
    expect(r.extraction.status).toBe("completed");
    expect(r.extraction.filesExtracted).toBe(3);
    expect(r.extraction.filesFailed).toBe(1);
    expect(r.extraction.symbolsExtracted).toBe(5);
    expect(r.totals).toEqual({ files: 8, bytes: 1680, directories: 4 });
    const byKey = Object.fromEntries(
      r.composition.buckets.map((b) => [b.key, b]),
    );
    expect(byKey["typescript"]?.fileCount).toBe(3);
    expect(byKey["javascript"]?.fileCount).toBe(1);
    expect(byKey[".md"]?.fileCount).toBe(3);
    expect(byKey[".json"]?.fileCount).toBe(1);
    const sum =
      r.composition.buckets.reduce((n, b) => n + b.fileCount, 0) +
      r.composition.otherFileCount;
    expect(sum).toBe(8);
  });

  test("no repository row: no_snapshot and nothing is created", async () => {
    const r = await getRepositoryIntelligenceHandler({
      owner: "nobody",
      name: "nothing",
    });
    expect(r).toEqual({ status: "no_snapshot" });
    const n = await db
      .prepare("SELECT COUNT(*) AS n FROM repositories")
      .first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  test("in-progress only → snapshot_in_progress; failed only → no_snapshot", async () => {
    const repo = await seedRepo();
    await seedSnapshot(repo, "in_progress", null);
    expect(
      await getRepositoryIntelligenceHandler({ owner: OWNER, name: NAME }),
    ).toEqual({
      status: "snapshot_in_progress",
      latestAttemptStatus: "in_progress",
    });
    const repo2 = await seedRepo("o2", "n2");
    await seedSnapshot(repo2, "failed", null);
    expect(
      await getRepositoryIntelligenceHandler({ owner: "o2", name: "n2" }),
    ).toEqual({ status: "no_snapshot" });
  });

  test("picks the newest completed snapshot", async () => {
    const repo = await seedRepo();
    await seedSnapshot(
      repo,
      "completed",
      "2026-01-02T00:00:00Z",
      "1".repeat(40),
    );
    const newer = await seedSnapshot(
      repo,
      "completed",
      "2026-03-02T00:00:00Z",
      "2".repeat(40),
    );
    const r = await getRepositoryIntelligenceHandler({
      owner: OWNER,
      name: NAME,
    });
    expect(r.status === "ready" && r.snapshot.snapshotId).toBe(newer);
  });

  test("completed snapshot without extraction: structure only, not_started", async () => {
    const repo = await seedRepo();
    const snap = await seedSnapshot(repo, "completed", "2026-01-02T00:00:00Z");
    await seedFile(snap, "a.ts", 10);
    const r = await getRepositoryIntelligenceHandler({
      owner: OWNER,
      name: NAME,
    });
    expect(r.status === "ready" && r.extraction.status).toBe("not_started");
    expect(r.status === "ready" && r.totals.directories).toBeNull();
  });

  test("empty completed snapshot renders zero totals", async () => {
    const repo = await seedRepo();
    await seedSnapshot(repo, "completed", "2026-01-02T00:00:00Z");
    const r = await getRepositoryIntelligenceHandler({
      owner: OWNER,
      name: NAME,
    });
    expect(r.status === "ready" && r.totals).toEqual({
      files: 0,
      bytes: 0,
      directories: null,
    });
  });

  test("identity is exact: a different owner does not see the data", async () => {
    await seedReady();
    expect(
      await getRepositoryIntelligenceHandler({ owner: "other", name: NAME }),
    ).toEqual({ status: "no_snapshot" });
  });
});

describe("structure (FR-006, FR-012)", () => {
  test("root level lists child directories and files with counts", async () => {
    const snap = await seedReady();
    const lvl = await listStructureLevelHandler({ snapshotId: snap });
    expect(lvl.directoryPath).toBe("");
    expect(
      lvl.directories.map((d) => [d.name, d.path, d.fileCount, d.symbolCount]),
    ).toEqual([
      ["docs", "docs", 2, 0],
      ["src", "src", 4, 5],
    ]);
    // Binary path order: uppercase sorts before lowercase.
    expect(
      lvl.files.map((f) => [f.name, f.extractionStatus, f.language]),
    ).toEqual([
      ["README.md", "not_attempted", null],
      ["package.json", "not_attempted", null],
    ]);
    expect(lvl.nextCursor).toBeNull();
    expect(lvl.truncated).toBe(false);
  });

  test("nested level and per-file symbol counts", async () => {
    const snap = await seedReady();
    const lvl = await listStructureLevelHandler({
      snapshotId: snap,
      directoryPath: "src",
    });
    expect(
      lvl.directories.map((d) => [d.path, d.fileCount, d.symbolCount]),
    ).toEqual([["src/lib", 2, 1]]);
    const idx = lvl.files.find((f) => f.name === "index.ts");
    expect(idx).toMatchObject({
      path: "src/index.ts",
      language: "typescript",
      extractionStatus: "extracted",
      symbolCount: 3,
      sizeBytes: 400,
    });
  });

  test("special characters in names survive; malformed paths yield an empty level", async () => {
    const snap = await seedReady();
    const lvl = await listStructureLevelHandler({
      snapshotId: snap,
      directoryPath: "docs/",
    });
    expect(lvl.files.map((f) => f.name)).toContain("we ird & name.md");
    for (const bad of ["../etc", "a/../b", "a\\b", "src/\u0000"]) {
      const r = await listStructureLevelHandler({
        snapshotId: snap,
        directoryPath: bad,
      });
      expect(r.directories).toEqual([]);
      expect(r.files).toEqual([]);
    }
  });

  test("paging: cursor walks directories then files with no gaps or repeats", async () => {
    const repo = await seedRepo();
    const snap = await seedSnapshot(repo, "completed", "2026-01-02T00:00:00Z");
    for (let i = 0; i < 5; i++) await seedFile(snap, `d${i}/x.ts`, 1);
    for (let i = 0; i < 4; i++) await seedFile(snap, `f${i}.ts`, 1);
    const seen: string[] = [];
    let cursor: number | undefined;
    for (let guard = 0; guard < 10; guard++) {
      const page = await listStructureLevelHandler({
        snapshotId: snap,
        limit: 3,
        cursor,
      });
      seen.push(
        ...page.directories.map((d) => `d:${d.name}`),
        ...page.files.map((f) => `f:${f.name}`),
      );
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }
    expect(seen).toEqual([
      "d:d0",
      "d:d1",
      "d:d2",
      "d:d3",
      "d:d4",
      "f:f0.ts",
      "f:f1.ts",
      "f:f2.ts",
      "f:f3.ts",
    ]);
  });

  test("limit is clamped to the configured maximum", async () => {
    const repo = await seedRepo();
    const snap = await seedSnapshot(repo, "completed", "2026-01-02T00:00:00Z");
    for (let i = 0; i < 700; i++)
      await seedFile(snap, `f${String(i).padStart(4, "0")}.ts`, 1);
    const page = await listStructureLevelHandler({
      snapshotId: snap,
      limit: 100000,
    });
    expect(page.files.length).toBeLessThanOrEqual(500);
    expect(page.truncated).toBe(true);
  });

  test("unknown or non-completed snapshot → empty level, never throws", async () => {
    const repo = await seedRepo();
    const snap = await seedSnapshot(repo, "in_progress", null);
    await seedFile(snap, "a.ts", 1);
    expect(
      (await listStructureLevelHandler({ snapshotId: snap })).files,
    ).toEqual([]);
    expect(
      (await listStructureLevelHandler({ snapshotId: 99999 })).files,
    ).toEqual([]);
    expect((await listStructureLevelHandler({ snapshotId: -1 })).files).toEqual(
      [],
    );
  });
});

describe("file symbols (FR-007)", () => {
  test("hierarchy is preserved and ordered", async () => {
    const snap = await seedReady();
    const r = await listFileSymbolsHandler({
      snapshotId: snap,
      path: "src/index.ts",
    });
    expect(r.extractionStatus).toBe("extracted");
    expect(r.language).toBe("typescript");
    expect(r.symbolCount).toBe(3);
    expect(r.symbols.map((s) => [s.kind, s.name])).toEqual([
      ["class", "Widget"],
      ["method", "render"],
      ["function", "helper"],
    ]);
    expect(r.symbols[1]!.parentSymbolId).toBe(r.symbols[0]!.id);
    expect(r.truncated).toBe(false);
  });

  test("failed extraction returns a fixed failure class, never raw text or keys", async () => {
    const snap = await seedReady();
    const r = await listFileSymbolsHandler({
      snapshotId: snap,
      path: "src/lib/b.js",
    });
    expect(r.extractionStatus).toBe("failed");
    expect(r.failureKind).toBe("unreadable");
    expect(JSON.stringify(r)).not.toContain("SECRET-R2-KEY");
  });

  test("unextracted or unknown file → not_attempted", async () => {
    const snap = await seedReady();
    expect(
      (await listFileSymbolsHandler({ snapshotId: snap, path: "README.md" }))
        .extractionStatus,
    ).toBe("not_attempted");
    expect(
      (await listFileSymbolsHandler({ snapshotId: snap, path: "nope.ts" }))
        .extractionStatus,
    ).toBe("not_attempted");
    expect(
      (await listFileSymbolsHandler({ snapshotId: snap, path: "../x" }))
        .symbols,
    ).toEqual([]);
  });

  test("more than MAX_SYMBOLS_FETCH symbols → truncated with the true count", async () => {
    const repo = await seedRepo();
    const snap = await seedSnapshot(repo, "completed", "2026-01-02T00:00:00Z");
    const f = await seedFile(snap, "big.ts", 1);
    const e = await seedExtraction(snap, f, "", "typescript", "extracted");
    for (let i = 0; i < MAX_SYMBOLS_FETCH + 25; i++)
      await seedSymbol(snap, e, "function", `fn${i}`, i + 1);
    const r = await listFileSymbolsHandler({
      snapshotId: snap,
      path: "big.ts",
    });
    expect(r.symbols).toHaveLength(MAX_SYMBOLS_FETCH);
    expect(r.symbolCount).toBe(MAX_SYMBOLS_FETCH + 25);
    expect(r.truncated).toBe(true);
  });
});

describe("read-only and safety (FR-010, SEC-001..003)", () => {
  test("only SELECT statements are issued across all handlers", async () => {
    const snap = await seedReady();
    statements = [];
    await getRepositoryIntelligenceHandler({ owner: OWNER, name: NAME });
    await listStructureLevelHandler({ snapshotId: snap });
    await listStructureLevelHandler({ snapshotId: snap, directoryPath: "src" });
    await listFileSymbolsHandler({ snapshotId: snap, path: "src/index.ts" });
    expect(statements.length).toBeGreaterThan(0);
    for (const sql of statements) {
      expect(sql.trimStart().toUpperCase().startsWith("SELECT")).toBe(true);
    }
  });

  test("injection-shaped input is inert", async () => {
    await seedReady();
    const bad = await getRepositoryIntelligenceHandler({
      owner: "x' OR '1'='1",
      name: NAME,
    });
    expect(bad).toEqual({ status: "invalid_request" });
    const snap = (await db
      .prepare("SELECT id FROM snapshots LIMIT 1")
      .first<{ id: number }>())!.id;
    const r = await listFileSymbolsHandler({
      snapshotId: snap,
      path: "x' OR '1'='1",
    });
    expect(r.symbols).toEqual([]);
    const n = await db
      .prepare("SELECT COUNT(*) AS n FROM repositories")
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
  });

  test("responses contain no R2 keys or SQL", async () => {
    const snap = await seedReady();
    const all = JSON.stringify([
      await getRepositoryIntelligenceHandler({ owner: OWNER, name: NAME }),
      await listStructureLevelHandler({
        snapshotId: snap,
        directoryPath: "src/lib",
      }),
      await listFileSymbolsHandler({ snapshotId: snap, path: "src/lib/b.js" }),
    ]);
    expect(all).not.toMatch(/SECRET-R2-KEY|SELECT |FROM |r2_key/i);
  });

  test("SQL extension expression agrees with extensionOf", async () => {
    const repo = await seedRepo();
    const snap = await seedSnapshot(repo, "completed", "2026-01-02T00:00:00Z");
    const paths = [
      "a/b.TS",
      "Makefile",
      "x/.gitignore",
      "a.b.c",
      "trail.",
      "dir.v2/file",
      "src/x.min.js",
    ];
    for (const p of paths) await seedFile(snap, p, 1);
    const r = await getRepositoryIntelligenceHandler({
      owner: OWNER,
      name: NAME,
    });
    if (r.status !== "ready") throw new Error("expected ready");
    const keys = new Set(r.composition.buckets.map((b) => b.key));
    for (const p of paths) {
      const ext = extensionOf(p);
      expect(keys.has(ext ? `.${ext}` : "(no extension)")).toBe(true);
    }
  });
});

describe("availability (FR-011)", () => {
  test("no D1 binding: unavailable, empty levels, never throws", async () => {
    setTestCloudflareEnv(undefined);
    expect(
      await getRepositoryIntelligenceHandler({ owner: OWNER, name: NAME }),
    ).toEqual({ status: "unavailable", reason: "no_binding" });
    expect((await listStructureLevelHandler({ snapshotId: 1 })).files).toEqual(
      [],
    );
    expect(
      (await listFileSymbolsHandler({ snapshotId: 1, path: "a.ts" })).symbols,
    ).toEqual([]);
  });

  test("a failing database yields query_failed states without leaking the error", async () => {
    const boom: D1DatabaseLike = {
      prepare: () => {
        throw new Error("secret /internal/path failure");
      },
      batch: () => Promise.reject(new Error("x")),
    };
    setTestCloudflareEnv({ DB: boom });
    const o = await getRepositoryIntelligenceHandler({
      owner: OWNER,
      name: NAME,
    });
    expect(o).toEqual({ status: "unavailable", reason: "query_failed" });
    const l = await listStructureLevelHandler({ snapshotId: 1 });
    expect(l.error).toBe("query_failed");
    const s = await listFileSymbolsHandler({ snapshotId: 1, path: "a.ts" });
    expect(s.error).toBe("query_failed");
    expect(JSON.stringify([o, l, s])).not.toContain("secret");
  });

  test("invalid requests are rejected without touching the database", async () => {
    expect(
      await getRepositoryIntelligenceHandler({ owner: "", name: "" }),
    ).toEqual({ status: "invalid_request" });
    expect(
      await getRepositoryIntelligenceHandler({ owner: OWNER, name: ".." }),
    ).toEqual({ status: "invalid_request" });
    expect(statements).toEqual([]);
  });
});
