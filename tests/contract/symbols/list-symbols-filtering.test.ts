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
 * T055 (contracts/symbol-query.functions.md `listSymbols`, FR-009-precedent
 * "never throws for an unstarted extraction"). `kind`/`directoryPath`
 * filtering mechanics themselves are T008's `listSymbolsPage` contract
 * (already 27-tested); this covers the handler's own added empty-page gate.
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

async function seedSnapshot(db: D1DatabaseLike, owner: string) {
  const repositoryId = await getOrCreateRepository({ provider: "github", owner, name: "r" }, db);
  const sha = toCommitSha("a".repeat(40));
  return createAcquisitionAttempt(repositoryId, sha, "bulk_archive", db);
}

async function seedAndExtract(db: D1DatabaseLike, snapshotId: number, path: string, content: string) {
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

describe("listSymbols filtering + empty-page precedent (T055)", () => {
  test("filters by kind", async () => {
    const db = createSqliteD1();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2 });
    const snapshotId = await seedSnapshot(db, "owner-kind");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);
    await seedAndExtract(db, snapshotId, "widget.js", "class Widget {\n  render() { return 1; }\n}\n");

    const classesOnly = await listSymbolsHandler({ snapshotId, kind: "class" });
    expect(classesOnly.symbols.map((s) => s.name)).toEqual(["Widget"]);

    const methodsOnly = await listSymbolsHandler({ snapshotId, kind: "method" });
    expect(methodsOnly.symbols.map((s) => s.name)).toEqual(["render"]);
  });

  test("filters by directoryPath", async () => {
    const db = createSqliteD1();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2 });
    const snapshotId = await seedSnapshot(db, "owner-dir");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);
    await seedAndExtract(db, snapshotId, "src/lib/a.js", "function a() {}\n");
    await seedAndExtract(db, snapshotId, "src/other/b.js", "function b() {}\n");

    const libOnly = await listSymbolsHandler({ snapshotId, directoryPath: "src/lib" });
    expect(libOnly.symbols.map((s) => s.name)).toEqual(["a"]);
  });

  test("returns an empty page, never throws, for a snapshot with no snapshot_extractions row", async () => {
    const db = createSqliteD1();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2 });
    const snapshotId = await seedSnapshot(db, "owner-none");
    // deliberately no getOrCreateSnapshotExtraction call — extraction never run

    const page = await listSymbolsHandler({ snapshotId });
    expect(page).toEqual({ symbols: [], nextCursor: null });
  });
});
