import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import type { D1DatabaseLike, R2BucketLike } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  createAcquisitionAttempt,
  getOrCreateRepository,
  insertSnapshotFile,
} from "../../../src/lib/code-intel/persistence/d1-client";
import { toCommitSha } from "../../../src/lib/code-intel/domain/repository-identity";
import {
  getOrCreateSnapshotExtraction,
  upsertExtractionJob,
  upsertFileExtraction,
} from "../../../src/lib/code-intel/persistence/symbol-d1-client";
import {
  setTestCoreWasmModule,
  setTestGrammarBytesSource,
} from "../../../src/lib/code-intel/symbols/grammar-provider";
import {
  processSymbolQueueMessage,
  type SymbolQueueMessage,
} from "../../../src/lib/code-intel/symbols/symbol-worker";
import type { SupportedLanguage } from "../../../src/lib/code-intel/symbols/language-detector";

/** Same real-WASM/real-R2 harness as extraction-pipeline.test.ts, one layer up. */
function fakeR2Bucket(): R2BucketLike & { seed: (key: string, bytes: Uint8Array) => void } {
  const store = new Map<string, Uint8Array>();
  return {
    seed: (key, bytes) => store.set(key, bytes),
    async get(key) {
      const bytes = store.get(key);
      if (!bytes) return null;
      return { async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; } };
    },
    async put(key, value) {
      if (value instanceof Uint8Array) store.set(key, value);
    },
    async head(key) {
      return store.has(key) ? {} : null;
    },
  };
}

function fakeQueue() {
  const sent: SymbolQueueMessage[] = [];
  return { sent, async send(message: SymbolQueueMessage) { sent.push(message); } };
}

let r2: ReturnType<typeof fakeR2Bucket>;

beforeAll(async () => {
  const ROOT = resolve(import.meta.dir, "../../../node_modules");
  const coreModule = await WebAssembly.compile(readFileSync(resolve(ROOT, "web-tree-sitter/tree-sitter.wasm")));
  setTestCoreWasmModule(coreModule);

  const PUBLIC_WASM = resolve(import.meta.dir, "../../../public/wasm");
  const ASSET_FILE: Record<SupportedLanguage, string> = {
    java: "tree-sitter-java.wasm",
    javascript: "tree-sitter-javascript.wasm",
    typescript: "tree-sitter-typescript.wasm",
    tsx: "tree-sitter-tsx.wasm",
  };
  setTestGrammarBytesSource(async (language) => new Uint8Array(readFileSync(resolve(PUBLIC_WASM, ASSET_FILE[language]))));
});

beforeEach(() => {
  r2 = fakeR2Bucket();
  setTestCloudflareEnv({ SNAPSHOTS: r2 });
});

async function seedSnapshot(db: D1DatabaseLike, owner: string) {
  const repositoryId = await getOrCreateRepository({ provider: "github", owner, name: "r" }, db);
  const sha = toCommitSha("a".repeat(40));
  const snapshotId = await createAcquisitionAttempt(repositoryId, sha, "bulk_archive", db);
  return snapshotId;
}

async function seedFile(db: D1DatabaseLike, snapshotId: number, path: string, content: string) {
  const bytes = new TextEncoder().encode(content);
  const r2Key = `r2/${path}`;
  await insertSnapshotFile(snapshotId, path, bytes.byteLength, "hash", r2Key, db);
  r2.seed(r2Key, bytes);
  const row = await db.prepare("SELECT id FROM snapshot_files WHERE snapshot_id = ? AND path = ?").bind(snapshotId, path).first<{ id: number }>();
  return row!.id;
}

describe("processSymbolQueueMessage (T030)", () => {
  test("completed extraction: a single small snapshot finishes in one unit, finalizes as 'completed'", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-a");
    await seedFile(db, snapshotId, "a.js", "function a() {}\n");
    await seedFile(db, snapshotId, "b.js", "function b() {}\n");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);

    await processSymbolQueueMessage({ snapshotId, unitIndex: 0, fromCursor: 0 }, db);

    const job = await db.prepare("SELECT status FROM extraction_jobs WHERE snapshot_id = ? AND unit_index = 0").bind(snapshotId).first<{ status: string }>();
    expect(job?.status).toBe("completed");
    const extraction = await db.prepare("SELECT status FROM snapshot_extractions WHERE snapshot_id = ?").bind(snapshotId).first<{ status: string }>();
    expect(extraction?.status).toBe("completed");
    const symbols = await db.prepare("SELECT name FROM symbols WHERE snapshot_id = ? ORDER BY name").bind(snapshotId).all<{ name: string }>();
    expect(symbols.results?.map((s) => s.name)).toEqual(["a", "b"]);
  });

  test("partial failure: unsupported + malformed files finalize the snapshot as 'completed_partial'", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-b");
    await seedFile(db, snapshotId, "good.js", "function good() {}\n");
    await seedFile(db, snapshotId, "readme.md", "# not code\n");
    await seedFile(db, snapshotId, "broken.js", "function ( { [[[ not valid");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);

    await processSymbolQueueMessage({ snapshotId, unitIndex: 0, fromCursor: 0 }, db);

    const extraction = await db.prepare("SELECT status FROM snapshot_extractions WHERE snapshot_id = ?").bind(snapshotId).first<{ status: string }>();
    expect(extraction?.status).toBe("completed_partial");
    const statuses = await db.prepare("SELECT status FROM file_extractions WHERE snapshot_id = ? ORDER BY status").bind(snapshotId).all<{ status: string }>();
    expect(statuses.results?.map((s) => s.status).sort()).toEqual(["extracted", "failed", "skipped_unsupported"]);
  });

  test("duplicate delivery: processing the same completed unit again is a no-op, no duplicate symbols", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-c");
    await seedFile(db, snapshotId, "a.js", "function a() {}\n");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);

    await processSymbolQueueMessage({ snapshotId, unitIndex: 0, fromCursor: 0 }, db);
    await processSymbolQueueMessage({ snapshotId, unitIndex: 0, fromCursor: 0 }, db); // redelivered

    const symbols = await db.prepare("SELECT * FROM symbols WHERE snapshot_id = ?").bind(snapshotId).all();
    expect(symbols.results?.length).toBe(1); // not 2
    const extraction = await db.prepare("SELECT status FROM snapshot_extractions WHERE snapshot_id = ?").bind(snapshotId).first<{ status: string }>();
    expect(extraction?.status).toBe("completed"); // still completed, not re-triggered
  });

  test("a message for an already-terminal extraction (e.g. failed) is a no-op", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-d");
    await seedFile(db, snapshotId, "a.js", "function a() {}\n");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);
    await db.prepare("UPDATE snapshot_extractions SET status = 'failed' WHERE snapshot_id = ?").bind(snapshotId).run();

    await processSymbolQueueMessage({ snapshotId, unitIndex: 0, fromCursor: 0 }, db); // must not throw, must not process

    const symbols = await db.prepare("SELECT * FROM symbols WHERE snapshot_id = ?").bind(snapshotId).all();
    expect(symbols.results?.length).toBe(0);
  });

  test("resume: files already covered by checkpoint_cursor are not re-queried; only files past it are processed", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-e");
    const id1 = await seedFile(db, snapshotId, "f1.js", "function f1() {}\n");
    const id2 = await seedFile(db, snapshotId, "f2.js", "function f2() {}\n");
    await seedFile(db, snapshotId, "f3.js", "function f3() {}\n");
    await seedFile(db, snapshotId, "f4.js", "function f4() {}\n");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);

    // Simulate a prior partial run of this unit: f1/f2 already processed
    // (sentinel extractor_version so we can prove they're untouched), and
    // the job's checkpoint_cursor already advanced to f2's id.
    const feId1 = await upsertFileExtraction({ snapshotId, snapshotFileId: id1, directoryPath: "", language: "javascript", status: "extracted", failureReason: null, extractorVersion: "sentinel" }, db);
    const feId2 = await upsertFileExtraction({ snapshotId, snapshotFileId: id2, directoryPath: "", language: "javascript", status: "extracted", failureReason: null, extractorVersion: "sentinel" }, db);
    await upsertExtractionJob(snapshotId, 0, "pending", String(id2), db);

    await processSymbolQueueMessage({ snapshotId, unitIndex: 0, fromCursor: 0 }, db);

    const fe1 = await db.prepare("SELECT extractor_version FROM file_extractions WHERE id = ?").bind(feId1).first<{ extractor_version: string }>();
    const fe2 = await db.prepare("SELECT extractor_version FROM file_extractions WHERE id = ?").bind(feId2).first<{ extractor_version: string }>();
    expect(fe1?.extractor_version).toBe("sentinel"); // untouched — resume skipped it, never re-queried
    expect(fe2?.extractor_version).toBe("sentinel");

    const rest = await db.prepare("SELECT snapshot_file_id FROM file_extractions WHERE snapshot_id = ? AND extractor_version = 'v1'").bind(snapshotId).all<{ snapshot_file_id: number }>();
    expect(rest.results?.length).toBe(2); // f3, f4 newly processed under the real extractor_version
  });

  test("retry: a transient D1 failure increments retry_count and records 'retrying', rethrows for queue redelivery", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-f");
    await seedFile(db, snapshotId, "a.js", "function a() {}\n");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);

    let callCount = 0;
    const throwingDb: D1DatabaseLike = {
      prepare(query: string) {
        const real = db.prepare(query);
        if (query.startsWith("SELECT id, path")) {
          // fail exactly once, inside listSnapshotFilesPage's query
          callCount++;
          if (callCount === 1) {
            return {
              bind: () => ({ bind: () => {}, run: async () => { throw new Error("transient D1 error"); }, all: async () => { throw new Error("transient D1 error"); }, first: async () => { throw new Error("transient D1 error"); } }) as never,
            } as never;
          }
        }
        return real;
      },
      batch: (statements) => db.batch(statements),
    };

    await expect(processSymbolQueueMessage({ snapshotId, unitIndex: 0, fromCursor: 0 }, throwingDb)).rejects.toThrow("transient D1 error");

    const job = await db.prepare("SELECT status, retry_count FROM extraction_jobs WHERE snapshot_id = ? AND unit_index = 0").bind(snapshotId).first<{ status: string; retry_count: number }>();
    expect(job?.status).toBe("retrying");
    expect(job?.retry_count).toBe(1);

    // A genuine retry (redelivery) with the real db now succeeds.
    await processSymbolQueueMessage({ snapshotId, unitIndex: 0, fromCursor: 0 }, db);
    const extraction = await db.prepare("SELECT status FROM snapshot_extractions WHERE snapshot_id = ?").bind(snapshotId).first<{ status: string }>();
    expect(extraction?.status).toBe("completed");
  });

  test("enqueues the next unit (via getSymbolQueue) when more files remain beyond the batch size", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-g");
    for (let i = 0; i < 3; i++) {
      await seedFile(db, snapshotId, `f${i}.js`, `function f${i}() {}\n`);
    }
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);

    const queue = fakeQueue();
    setTestCloudflareEnv({ SNAPSHOTS: r2, SYMBOL_QUEUE: queue });

    // Force a tiny batch size so the 3 seeded files span two units.
    process.env["CODE_INTEL_EXTRACTION_BATCH_SIZE"] = "2";
    try {
      await processSymbolQueueMessage({ snapshotId, unitIndex: 0, fromCursor: 0 }, db);
    } finally {
      delete process.env["CODE_INTEL_EXTRACTION_BATCH_SIZE"];
    }

    expect(queue.sent.length).toBe(1);
    expect(queue.sent[0]!.unitIndex).toBe(1);
    expect(queue.sent[0]!.snapshotId).toBe(snapshotId);

    const extraction = await db.prepare("SELECT status FROM snapshot_extractions WHERE snapshot_id = ?").bind(snapshotId).first<{ status: string }>();
    expect(extraction?.status).toBe("in_progress"); // not finalized yet — one more unit still pending
  });
});
