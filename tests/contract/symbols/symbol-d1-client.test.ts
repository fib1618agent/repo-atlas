import { describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import type { D1DatabaseLike } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  createAcquisitionAttempt,
  getOrCreateRepository,
  insertSnapshotFile,
} from "../../../src/lib/code-intel/persistence/d1-client";
import { toCommitSha } from "../../../src/lib/code-intel/domain/repository-identity";
import {
  finalizeSnapshotExtraction,
  getFileExtractionRow,
  getJobRetryCount,
  getOrCreateDirectory,
  getOrCreateSnapshotExtraction,
  getSnapshotExtractionSummary,
  getSymbolWithProvenance,
  listSymbolsPage,
  markJobCompleted,
  markJobFailed,
  recomputeJobCounters,
  recordJobRetry,
  replaceSymbolsForFile,
  upsertExtractionJob,
  upsertFileExtraction,
} from "../../../src/lib/code-intel/persistence/symbol-d1-client";
import type { SymbolIR } from "../../../src/lib/code-intel/symbols/to-intermediate-representation";

/** Seeds a Feature 001 repository + completed snapshot + one snapshot_file, satisfying symbol-d1-client's FK requirements. */
async function seedSnapshotWithFile(db: D1DatabaseLike, owner = "o", name = "r", shaSeed = "a") {
  const repositoryId = await getOrCreateRepository({ provider: "github", owner, name }, db);
  const sha = toCommitSha(shaSeed.repeat(40));
  const snapshotId = await createAcquisitionAttempt(repositoryId, sha, "bulk_archive", db);
  await insertSnapshotFile(snapshotId, "src/Foo.ts", 10, "hash1", "key1", db);
  const snapshotFileId = await insertedSnapshotFileId(db, snapshotId, "src/Foo.ts");
  return { repositoryId, snapshotId, snapshotFileId, commitSha: sha };
}

/** Feature 001's insertSnapshotFile returns void — fetch the id it generated directly. */
async function insertedSnapshotFileId(db: D1DatabaseLike, snapshotId: number, path: string): Promise<number> {
  const row = await db
    .prepare("SELECT id FROM snapshot_files WHERE snapshot_id = ? AND path = ?")
    .bind(snapshotId, path)
    .first<{ id: number }>();
  if (!row) throw new Error(`test setup: no snapshot_files row for path "${path}"`);
  return row.id;
}

function ir(overrides: Partial<SymbolIR> & Pick<SymbolIR, "kind" | "name" | "symbolKey">): SymbolIR {
  return {
    qualifiedName: null,
    startLine: 0,
    startColumn: 0,
    endLine: 0,
    endColumn: 10,
    parentSymbolKey: null,
    ...overrides,
  };
}

describe("getOrCreateDirectory", () => {
  test("creates a directory row and returns its id", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    const id = await getOrCreateDirectory(snapshotId, "src", "", db);
    expect(typeof id).toBe("number");
    const row = await db.prepare("SELECT * FROM directories WHERE id = ?").bind(id).first<{
      path: string;
      parent_path: string;
    }>();
    expect(row?.path).toBe("src");
    expect(row?.parent_path).toBe("");
  });

  test("is idempotent: same (snapshotId, path) always returns the same id, first write wins", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    const first = await getOrCreateDirectory(snapshotId, "src", "", db);
    const second = await getOrCreateDirectory(snapshotId, "src", "different-parent", db);
    expect(second).toBe(first);
    const rows = await db.prepare("SELECT * FROM directories WHERE snapshot_id = ? AND path = ?")
      .bind(snapshotId, "src").all();
    expect(rows.results?.length).toBe(1);
    // ON CONFLICT DO NOTHING — the second call's differing parentPath never applied.
    const row = rows.results![0] as { parent_path: string };
    expect(row.parent_path).toBe("");
  });
});

describe("upsertFileExtraction / getFileExtractionRow", () => {
  test("creates a file_extractions row, retrievable via getFileExtractionRow", async () => {
    const db = createSqliteD1();
    const { snapshotId, snapshotFileId } = await seedSnapshotWithFile(db);
    const id = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" },
      db,
    );
    expect(typeof id).toBe("number");
    const row = await getFileExtractionRow(snapshotId, "src/Foo.ts", db);
    expect(row).toEqual({ path: "src/Foo.ts", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1", symbolCount: 0 });
  });

  test("getFileExtractionRow returns null when no snapshot_file matches the path", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    expect(await getFileExtractionRow(snapshotId, "does/not/exist.ts", db)).toBeNull();
  });

  test("getFileExtractionRow returns null when the file exists but has no file_extractions row yet (not_attempted)", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    expect(await getFileExtractionRow(snapshotId, "src/Foo.ts", db)).toBeNull();
  });

  test("re-extraction REPLACES the row (same id), never creates a second row", async () => {
    const db = createSqliteD1();
    const { snapshotId, snapshotFileId } = await seedSnapshotWithFile(db);
    const first = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "failed", failureReason: "boom", extractorVersion: "v1" },
      db,
    );
    const second = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v2" },
      db,
    );
    expect(second).toBe(first);
    const rows = await db.prepare("SELECT * FROM file_extractions WHERE snapshot_id = ?").bind(snapshotId).all();
    expect(rows.results?.length).toBe(1);
    const row = await getFileExtractionRow(snapshotId, "src/Foo.ts", db);
    expect(row?.status).toBe("extracted");
    expect(row?.extractorVersion).toBe("v2");
  });
});

describe("replaceSymbolsForFile — parent resolution, re-extraction, idempotency", () => {
  test("persists symbols with parent_symbol_id resolved to a REAL D1 row id, not the symbolKey string", async () => {
    const db = createSqliteD1();
    const { snapshotId, snapshotFileId } = await seedSnapshotWithFile(db);
    const fileExtractionId = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" },
      db,
    );
    const symbols: SymbolIR[] = [
      ir({ kind: "class", name: "Widget", symbolKey: "key-class" }),
      ir({ kind: "method", name: "render", symbolKey: "key-method", parentSymbolKey: "key-class", qualifiedName: "Widget.render" }),
    ];
    await replaceSymbolsForFile(fileExtractionId, snapshotId, symbols, "v1", db);

    const rows = await db.prepare("SELECT * FROM symbols WHERE file_extraction_id = ? ORDER BY id").bind(fileExtractionId).all<{
      id: number; kind: string; name: string; parent_symbol_id: number | null; symbol_key: string;
    }>();
    expect(rows.results?.length).toBe(2);
    const cls = rows.results!.find((r) => r.kind === "class")!;
    const method = rows.results!.find((r) => r.kind === "method")!;
    expect(cls.parent_symbol_id).toBeNull();
    expect(method.parent_symbol_id).toBe(cls.id); // a real D1 row id (number), not "key-class"
    expect(typeof method.parent_symbol_id).toBe("number");
  });

  test("multi-level nesting resolves correctly (grandparent -> parent -> child)", async () => {
    const db = createSqliteD1();
    const { snapshotId, snapshotFileId } = await seedSnapshotWithFile(db);
    const fileExtractionId = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" },
      db,
    );
    const symbols: SymbolIR[] = [
      ir({ kind: "module", name: "Outer", symbolKey: "k1" }),
      ir({ kind: "class", name: "Inner", symbolKey: "k2", parentSymbolKey: "k1" }),
      ir({ kind: "method", name: "leaf", symbolKey: "k3", parentSymbolKey: "k2" }),
    ];
    await replaceSymbolsForFile(fileExtractionId, snapshotId, symbols, "v1", db);
    const rows = await db.prepare("SELECT * FROM symbols WHERE file_extraction_id = ?").bind(fileExtractionId).all<{
      name: string; id: number; parent_symbol_id: number | null;
    }>();
    const byName = Object.fromEntries(rows.results!.map((r) => [r.name, r]));
    expect(byName["Outer"]!.parent_symbol_id).toBeNull();
    expect(byName["Inner"]!.parent_symbol_id).toBe(byName["Outer"]!.id);
    expect(byName["leaf"]!.parent_symbol_id).toBe(byName["Inner"]!.id);
  });

  test("re-extraction removes stale symbols for THIS file only, leaving other files' symbols untouched", async () => {
    const db = createSqliteD1();
    const { snapshotId, snapshotFileId } = await seedSnapshotWithFile(db);
    await insertSnapshotFile(snapshotId, "src/Bar.ts", 5, "hash2", "key2", db);
    const otherFileId = await insertedSnapshotFileId(db, snapshotId, "src/Bar.ts");

    const fileExtractionId = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" },
      db,
    );
    const otherFileExtractionId = await upsertFileExtraction(
      { snapshotId, snapshotFileId: otherFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" },
      db,
    );

    await replaceSymbolsForFile(fileExtractionId, snapshotId, [ir({ kind: "function", name: "old", symbolKey: "old-key" })], "v1", db);
    await replaceSymbolsForFile(otherFileExtractionId, snapshotId, [ir({ kind: "function", name: "untouched", symbolKey: "other-key" })], "v1", db);

    // Re-extract the first file with a completely different symbol set.
    await replaceSymbolsForFile(fileExtractionId, snapshotId, [ir({ kind: "function", name: "new", symbolKey: "new-key" })], "v1", db);

    const fileRows = await db.prepare("SELECT name FROM symbols WHERE file_extraction_id = ?").bind(fileExtractionId).all<{ name: string }>();
    expect(fileRows.results?.map((r) => r.name)).toEqual(["new"]); // "old" is gone, not accumulated

    const otherRows = await db.prepare("SELECT name FROM symbols WHERE file_extraction_id = ?").bind(otherFileExtractionId).all<{ name: string }>();
    expect(otherRows.results?.map((r) => r.name)).toEqual(["untouched"]); // unaffected by the other file's re-extraction
  });

  test("re-extraction with an empty symbol set clears all symbols for the file (zero-symbol behavior)", async () => {
    const db = createSqliteD1();
    const { snapshotId, snapshotFileId } = await seedSnapshotWithFile(db);
    const fileExtractionId = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" },
      db,
    );
    await replaceSymbolsForFile(fileExtractionId, snapshotId, [ir({ kind: "function", name: "f", symbolKey: "k" })], "v1", db);
    await replaceSymbolsForFile(fileExtractionId, snapshotId, [], "v1", db); // e.g. file became empty
    const rows = await db.prepare("SELECT * FROM symbols WHERE file_extraction_id = ?").bind(fileExtractionId).all();
    expect(rows.results?.length).toBe(0);
  });

  test("a file that never had symbols and is replaced with an empty set does not error", async () => {
    const db = createSqliteD1();
    const { snapshotId, snapshotFileId } = await seedSnapshotWithFile(db);
    const fileExtractionId = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "skipped_unsupported", failureReason: null, extractorVersion: "v1" },
      db,
    );
    await replaceSymbolsForFile(fileExtractionId, snapshotId, [], "v1", db);
    const rows = await db.prepare("SELECT * FROM symbols WHERE file_extraction_id = ?").bind(fileExtractionId).all();
    expect(rows.results?.length).toBe(0);
  });

  test("idempotency: re-running with the identical IR twice produces content-identical results (row ids may differ — delete-then-insert, per data-model.md)", async () => {
    const db = createSqliteD1();
    const { snapshotId, snapshotFileId } = await seedSnapshotWithFile(db);
    const fileExtractionId = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" },
      db,
    );
    const symbols: SymbolIR[] = [
      ir({ kind: "class", name: "Widget", symbolKey: "kc" }),
      ir({ kind: "method", name: "render", symbolKey: "km", parentSymbolKey: "kc" }),
    ];
    await replaceSymbolsForFile(fileExtractionId, snapshotId, symbols, "v1", db);
    await replaceSymbolsForFile(fileExtractionId, snapshotId, symbols, "v1", db);

    const rows = await db.prepare("SELECT kind, name, symbol_key FROM symbols WHERE file_extraction_id = ? ORDER BY name")
      .bind(fileExtractionId).all<{ kind: string; name: string; symbol_key: string }>();
    expect(rows.results?.length).toBe(2); // not 4 — the second run's delete cleared the first run's rows
    expect(rows.results).toEqual([
      { kind: "class", name: "Widget", symbol_key: "kc" },
      { kind: "method", name: "render", symbol_key: "km" },
    ]);
  });
});

describe("listSymbolsPage", () => {
  async function seedThreeSymbols(db: D1DatabaseLike) {
    const { snapshotId, snapshotFileId } = await seedSnapshotWithFile(db);
    const fileExtractionId = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" },
      db,
    );
    await replaceSymbolsForFile(
      fileExtractionId, snapshotId,
      [
        ir({ kind: "class", name: "A", symbolKey: "a" }),
        ir({ kind: "function", name: "b", symbolKey: "b" }),
        ir({ kind: "function", name: "c", symbolKey: "c" }),
      ],
      "v1", db,
    );
    return { snapshotId };
  }

  test("pagination never exceeds the requested limit", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedThreeSymbols(db);
    const page1 = await listSymbolsPage(snapshotId, undefined, 2, undefined, undefined, db);
    expect(page1.symbols.length).toBe(2);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = await listSymbolsPage(snapshotId, page1.nextCursor ?? undefined, 2, undefined, undefined, db);
    expect(page2.symbols.length).toBe(1);
    expect(page2.nextCursor).toBeNull();
  });

  test("kind filter returns only matching symbols", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedThreeSymbols(db);
    const page = await listSymbolsPage(snapshotId, undefined, 10, "function", undefined, db);
    expect(page.symbols.map((s) => s.name).sort()).toEqual(["b", "c"]);
  });

  test("directoryPath filter returns only symbols under that directory", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedThreeSymbols(db);
    const matching = await listSymbolsPage(snapshotId, undefined, 10, undefined, "src", db);
    expect(matching.symbols.length).toBe(3);
    const nonMatching = await listSymbolsPage(snapshotId, undefined, 10, undefined, "other", db);
    expect(nonMatching.symbols.length).toBe(0);
  });

  test("empty page (never throws) for a snapshot with no symbols at all", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    const page = await listSymbolsPage(snapshotId, undefined, 10, undefined, undefined, db);
    expect(page).toEqual({ symbols: [], nextCursor: null });
  });
});

describe("getSymbolWithProvenance", () => {
  test("resolves the full provenance chain (file, snapshot, repository, commit SHA) in one call", async () => {
    const db = createSqliteD1();
    const { snapshotId, snapshotFileId, commitSha } = await seedSnapshotWithFile(db, "prov-owner", "prov-repo", "b");
    const fileExtractionId = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" },
      db,
    );
    await replaceSymbolsForFile(fileExtractionId, snapshotId, [ir({ kind: "class", name: "X", symbolKey: "x" })], "v1", db);
    const row = await db.prepare("SELECT id FROM symbols WHERE symbol_key = ?").bind("x").first<{ id: number }>();

    const detail = await getSymbolWithProvenance(row!.id, db);
    expect(detail?.name).toBe("X");
    expect(detail?.filePath).toBe("src/Foo.ts");
    expect(detail?.snapshotId).toBe(snapshotId);
    expect(detail?.provider).toBe("github");
    expect(detail?.owner).toBe("prov-owner");
    expect(detail?.repoName).toBe("prov-repo");
    expect(detail?.commitSha).toBe(commitSha);
  });

  test("returns null for an unknown symbolId", async () => {
    const db = createSqliteD1();
    expect(await getSymbolWithProvenance(999999, db)).toBeNull();
  });
});

describe("extraction_jobs CRUD / state transitions", () => {
  test("upsertExtractionJob creates then updates checkpoint_cursor, without duplicating the row", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    await upsertExtractionJob(snapshotId, 0, "pending", null, db);
    await upsertExtractionJob(snapshotId, 0, "pending", "cursor-1", db);
    const rows = await db.prepare("SELECT * FROM extraction_jobs WHERE snapshot_id = ?").bind(snapshotId).all();
    expect(rows.results?.length).toBe(1);
  });

  test("upsertExtractionJob never regresses a completed job back to pending/retrying", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    await upsertExtractionJob(snapshotId, 0, "pending", null, db);
    await markJobCompleted(snapshotId, 0, db);
    await upsertExtractionJob(snapshotId, 0, "pending", "late-redelivery", db); // duplicate/late delivery
    const row = await db.prepare("SELECT status FROM extraction_jobs WHERE snapshot_id = ? AND unit_index = 0").bind(snapshotId).first<{ status: string }>();
    expect(row?.status).toBe("completed");
  });

  test("recordJobRetry increments retry_count and sets status='retrying', guarded against a completed job", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    await upsertExtractionJob(snapshotId, 0, "pending", null, db);
    await recordJobRetry(snapshotId, 0, "transient error", db);
    expect(await getJobRetryCount(snapshotId, 0, db)).toBe(1);
    await recordJobRetry(snapshotId, 0, "transient error again", db);
    expect(await getJobRetryCount(snapshotId, 0, db)).toBe(2);

    await markJobCompleted(snapshotId, 0, db);
    await recordJobRetry(snapshotId, 0, "should not apply", db); // guarded no-op
    expect(await getJobRetryCount(snapshotId, 0, db)).toBe(2);
  });

  test("markJobFailed sets status='failed' and records failure_reason", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    await upsertExtractionJob(snapshotId, 0, "pending", null, db);
    await markJobFailed(snapshotId, 0, "fatal error", db);
    const row = await db.prepare("SELECT status, failure_reason FROM extraction_jobs WHERE snapshot_id = ? AND unit_index = 0")
      .bind(snapshotId).first<{ status: string; failure_reason: string }>();
    expect(row?.status).toBe("failed");
    expect(row?.failure_reason).toBe("fatal error");
  });

  test("recomputeJobCounters sets (not increments) files_processed/symbols_extracted from actual table contents, retry-safe", async () => {
    const db = createSqliteD1();
    const { snapshotId, snapshotFileId } = await seedSnapshotWithFile(db);
    const fileExtractionId = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" },
      db,
    );
    await replaceSymbolsForFile(fileExtractionId, snapshotId, [ir({ kind: "function", name: "f1", symbolKey: "f1" }), ir({ kind: "function", name: "f2", symbolKey: "f2" })], "v1", db);
    await upsertExtractionJob(snapshotId, 0, "pending", null, db);

    await recomputeJobCounters(snapshotId, 0, db);
    let row = await db.prepare("SELECT files_processed, symbols_extracted FROM extraction_jobs WHERE snapshot_id = ? AND unit_index = 0")
      .bind(snapshotId).first<{ files_processed: number; symbols_extracted: number }>();
    expect(row).toEqual({ files_processed: 1, symbols_extracted: 2 });

    // Recompute again (simulating a retry) — must not double-count.
    await recomputeJobCounters(snapshotId, 0, db);
    row = await db.prepare("SELECT files_processed, symbols_extracted FROM extraction_jobs WHERE snapshot_id = ? AND unit_index = 0")
      .bind(snapshotId).first<{ files_processed: number; symbols_extracted: number }>();
    expect(row).toEqual({ files_processed: 1, symbols_extracted: 2 });
  });
});

describe("snapshot_extractions CRUD / state transitions", () => {
  test("getOrCreateSnapshotExtraction creates a row with status='in_progress' when absent", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    const row = await getOrCreateSnapshotExtraction(snapshotId, "v1", db);
    expect(row.status).toBe("in_progress");
    expect(row.extractorVersion).toBe("v1");
    expect(row.completedAt).toBeNull();
  });

  test("getOrCreateSnapshotExtraction does not mutate an already-existing row", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    const first = await getOrCreateSnapshotExtraction(snapshotId, "v1", db);
    await finalizeSnapshotExtraction(snapshotId, "completed", db);
    const second = await getOrCreateSnapshotExtraction(snapshotId, "v2", db); // different version passed in
    expect(second.status).toBe("completed"); // unchanged by the second call's "v2"
    expect(second.extractorVersion).toBe("v1");
    expect(second.startedAt).toBe(first.startedAt);
  });

  test("finalizeSnapshotExtraction is guarded: a second call after finalization is a no-op", async () => {
    const db = createSqliteD1();
    const { snapshotId } = await seedSnapshotWithFile(db);
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);
    const first = await finalizeSnapshotExtraction(snapshotId, "completed", db);
    const second = await finalizeSnapshotExtraction(snapshotId, "failed", db); // redelivered/retried finalization
    expect(first).toBe(true);
    expect(second).toBe(false);
    const row = await db.prepare("SELECT status FROM snapshot_extractions WHERE snapshot_id = ?").bind(snapshotId).first<{ status: string }>();
    expect(row?.status).toBe("completed"); // not overwritten to "failed"
  });

  test("getSnapshotExtractionSummary aggregates file/symbol counts correctly", async () => {
    const db = createSqliteD1();
    const { snapshotId, snapshotFileId } = await seedSnapshotWithFile(db);
    await insertSnapshotFile(snapshotId, "src/Bar.ts", 5, "hash2", "key2", db);
    const otherFileId = await insertedSnapshotFileId(db, snapshotId, "src/Bar.ts");

    const fe1 = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" }, db);
    await upsertFileExtraction(
      { snapshotId, snapshotFileId: otherFileId, directoryPath: "src", language: null, status: "skipped_unsupported", failureReason: null, extractorVersion: "v1" }, db);
    await replaceSymbolsForFile(fe1, snapshotId, [ir({ kind: "function", name: "f", symbolKey: "f" })], "v1", db);

    const summary = await getSnapshotExtractionSummary(snapshotId, db);
    expect(summary).toEqual({ filesTotal: 2, filesExtracted: 1, filesSkippedUnsupported: 1, filesFailed: 0, symbolsExtracted: 1 });
  });
});
