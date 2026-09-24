import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import { installTestWasmModules } from "../../support/wasm-test-modules";
import type { D1DatabaseLike, R2BucketLike } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  createAcquisitionAttempt,
  getOrCreateRepository,
  insertSnapshotFile,
} from "../../../src/lib/code-intel/persistence/d1-client";
import { toCommitSha } from "../../../src/lib/code-intel/domain/repository-identity";
import { getOrCreateSnapshotExtraction } from "../../../src/lib/code-intel/persistence/symbol-d1-client";
import { processSymbolQueueMessage } from "../../../src/lib/code-intel/symbols/symbol-worker";
import { getExtractionStatusHandler, getFileExtractionHandler } from "../../../src/lib/code-intel/symbol.functions";

/**
 * T038 (quickstart.md US3 mixed-snapshot scenario, SC-004) — end to end
 * through the real queue worker, then read back via the public query surface
 * (`getExtractionStatus`, `getFileExtraction`, T043/T044) rather than raw SQL,
 * since this scenario's whole point is what an external caller observes.
 */

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

let r2: ReturnType<typeof fakeR2Bucket>;

beforeAll(async () => {
  await installTestWasmModules();
});

beforeEach(() => {
  r2 = fakeR2Bucket();
  setTestCloudflareEnv({ SNAPSHOTS: r2 });
});

async function seedSnapshot(db: D1DatabaseLike, owner: string) {
  const repositoryId = await getOrCreateRepository({ provider: "github", owner, name: "r" }, db);
  const sha = toCommitSha("a".repeat(40));
  return createAcquisitionAttempt(repositoryId, sha, "bulk_archive", db);
}

async function seedFile(db: D1DatabaseLike, snapshotId: number, path: string, content: string) {
  const bytes = new TextEncoder().encode(content);
  const r2Key = `r2/${path}`;
  await insertSnapshotFile(snapshotId, path, bytes.byteLength, "hash", r2Key, db);
  r2.seed(r2Key, bytes);
}

describe("Mixed-snapshot partial coverage (T038, SC-004)", () => {
  test("getExtractionStatus reports completed_partial with correct file-outcome counts", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-partial");
    await seedFile(db, snapshotId, "good.js", "function good() {}\n");
    await seedFile(db, snapshotId, "readme.md", "# not code\n");
    await seedFile(db, snapshotId, "broken.js", "function ( { [[[ not valid");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);

    await processSymbolQueueMessage({ snapshotId, unitIndex: 0, fromCursor: 0 }, db);

    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2 });
    const status = await getExtractionStatusHandler({ snapshotId });
    expect(status.status).toBe("completed_partial");
    expect(status.filesTotal).toBe(3);
    expect(status.filesExtracted).toBe(1);
    expect(status.filesSkippedUnsupported).toBe(1);
    expect(status.filesFailed).toBe(1);
    expect(status.symbolsExtracted).toBe(1);
  });

  test("getExtractionStatus returns not_started (never throws) for a snapshot with no extraction row", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-none");

    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2 });
    const status = await getExtractionStatusHandler({ snapshotId });
    expect(status.status).toBe("not_started");
    expect(status.extractorVersion).toBeNull();
    expect(status.filesTotal).toBe(0);
  });

  test("getFileExtraction reflects each file's individual outcome after a mixed run", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-partial-2");
    await seedFile(db, snapshotId, "good.js", "function good() {}\n");
    await seedFile(db, snapshotId, "readme.md", "# not code\n");
    await seedFile(db, snapshotId, "broken.js", "function ( { [[[ not valid");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);
    await processSymbolQueueMessage({ snapshotId, unitIndex: 0, fromCursor: 0 }, db);

    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2 });
    const good = await getFileExtractionHandler({ snapshotId, path: "good.js" });
    expect(good.status).toBe("extracted");
    expect(good.symbolCount).toBe(1);

    const md = await getFileExtractionHandler({ snapshotId, path: "readme.md" });
    expect(md.status).toBe("skipped_unsupported");

    const broken = await getFileExtractionHandler({ snapshotId, path: "broken.js" });
    expect(broken.status).toBe("failed");
    expect(broken.failureReason).not.toBeNull();
  });

  test("getFileExtraction returns not_attempted (never throws) for a path never processed", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-unprocessed");

    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2 });
    const result = await getFileExtractionHandler({ snapshotId, path: "nope.js" });
    expect(result.status).toBe("not_attempted");
    expect(result.symbolCount).toBe(0);
  });
});
