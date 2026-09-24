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
import { extractFile } from "../../../src/lib/code-intel/symbols/extraction-pipeline";
import { listSymbolsHandler } from "../../../src/lib/code-intel/symbol.functions";

/**
 * T054 (contracts/symbol-query.functions.md `listSymbols`, FR-024) — the
 * `symbol-d1-client.ts` pagination mechanics (`listSymbolsPage`) already have
 * full contract coverage (T008's own 27 tests); this exercises the
 * `listSymbols` handler's own added behavior: config-clamped `limit`.
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
});

async function seedSnapshotWithSymbols(db: D1DatabaseLike, count: number) {
  const repositoryId = await getOrCreateRepository({ provider: "github", owner: "owner-page", name: "r" }, db);
  const sha = toCommitSha("a".repeat(40));
  const snapshotId = await createAcquisitionAttempt(repositoryId, sha, "bulk_archive", db);
  await getOrCreateSnapshotExtraction(snapshotId, "v1", db);

  for (let i = 0; i < count; i++) {
    const path = `f${i}.js`;
    const content = `function f${i}() { return ${i}; }\n`;
    const bytes = new TextEncoder().encode(content);
    const r2Key = `r2/${path}`;
    await insertSnapshotFile(snapshotId, path, bytes.byteLength, "hash", r2Key, db);
    r2.seed(r2Key, bytes);
    const row = await db.prepare("SELECT * FROM snapshot_files WHERE snapshot_id = ? AND path = ?").bind(snapshotId, path).first<{
      id: number; snapshot_id: number; path: string; size_bytes: number; content_hash: string; r2_key: string;
    }>();
    await extractFile({
      snapshotId,
      snapshotFile: { id: row!.id, snapshotId: row!.snapshot_id, path: row!.path, sizeBytes: row!.size_bytes, contentHash: row!.content_hash, r2Key: row!.r2_key },
      extractorVersion: "v1",
      db,
    });
  }
  return snapshotId;
}

describe("listSymbols pagination (T054, contracts/symbol-query.functions.md)", () => {
  test("never returns more than the requested limit", async () => {
    const db = createSqliteD1();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2 });
    const snapshotId = await seedSnapshotWithSymbols(db, 5);

    const page = await listSymbolsHandler({ snapshotId, limit: 2 });
    expect(page.symbols.length).toBe(2);
    expect(page.nextCursor).not.toBeNull();
  });

  test("never returns more than the configured max page size, even if a larger limit is requested", async () => {
    const db = createSqliteD1();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2 });
    const snapshotId = await seedSnapshotWithSymbols(db, 3);

    process.env["CODE_INTEL_LIST_FILES_MAX_LIMIT"] = "1";
    try {
      const page = await listSymbolsHandler({ snapshotId, limit: 500 });
      expect(page.symbols.length).toBe(1);
    } finally {
      delete process.env["CODE_INTEL_LIST_FILES_MAX_LIMIT"];
    }
  });

  test("defaults to the configured default limit when none is requested", async () => {
    const db = createSqliteD1();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2 });
    const snapshotId = await seedSnapshotWithSymbols(db, 2);

    const page = await listSymbolsHandler({ snapshotId });
    expect(page.symbols.length).toBe(2); // under the default limit, so no truncation
  });
});
