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
import { extractFile } from "../../../src/lib/code-intel/symbols/extraction-pipeline";

/**
 * T034 (spec.md US2 Acceptance Scenario 1 + 4, FR-008) — integration-level
 * identity stability, distinct from T027's unit-level `computeSymbolKey`
 * determinism test and T028's within-one-run uniqueness test: this exercises
 * two genuinely separate `extractFile` invocations (fresh D1 rows each time,
 * simulating a later read after the fact) against real persistence, and two
 * distinct snapshots of identical source content.
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
  const r2Key = `r2/${snapshotId}/${path}`;
  await insertSnapshotFile(snapshotId, path, bytes.byteLength, "hash", r2Key, db);
  r2.seed(r2Key, bytes);
  const row = await db.prepare("SELECT * FROM snapshot_files WHERE snapshot_id = ? AND path = ?").bind(snapshotId, path).first<{
    id: number; snapshot_id: number; path: string; size_bytes: number; content_hash: string; r2_key: string;
  }>();
  return { id: row!.id, snapshotId: row!.snapshot_id, path: row!.path, sizeBytes: row!.size_bytes, contentHash: row!.content_hash, r2Key: row!.r2_key };
}

describe("Symbol identity stability (T034, FR-008)", () => {
  test("a symbol's identity is unchanged across two separate extraction invocations of the same content, same extractor_version", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-a");
    const snapshotFile = await seedFile(db, snapshotId, "src/foo.js", "function foo() { return 1; }\n");

    await extractFile({ snapshotId, snapshotFile, extractorVersion: "v1", db });
    const first = await db.prepare("SELECT symbol_key FROM symbols WHERE snapshot_id = ?").bind(snapshotId).first<{ symbol_key: string }>();

    // A second, separate invocation against the same snapshot/file/version —
    // simulates re-reading identity in a later request, not a re-run of the
    // whole pipeline from scratch.
    await extractFile({ snapshotId, snapshotFile, extractorVersion: "v1", db });
    const second = await db.prepare("SELECT symbol_key FROM symbols WHERE snapshot_id = ?").bind(snapshotId).first<{ symbol_key: string }>();

    expect(second?.symbol_key).toBe(first?.symbol_key);
  });

  test("two symbols from different snapshots never share an identity, even for the same logical declaration", async () => {
    const db = createSqliteD1();
    const snapshotIdA = await seedSnapshot(db, "owner-b");
    const snapshotIdB = await seedSnapshot(db, "owner-c");
    const fileA = await seedFile(db, snapshotIdA, "src/foo.js", "function foo() { return 1; }\n");
    const fileB = await seedFile(db, snapshotIdB, "src/foo.js", "function foo() { return 1; }\n");

    await extractFile({ snapshotId: snapshotIdA, snapshotFile: fileA, extractorVersion: "v1", db });
    await extractFile({ snapshotId: snapshotIdB, snapshotFile: fileB, extractorVersion: "v1", db });

    const rowA = await db.prepare("SELECT symbol_key FROM symbols WHERE snapshot_id = ?").bind(snapshotIdA).first<{ symbol_key: string }>();
    const rowB = await db.prepare("SELECT symbol_key FROM symbols WHERE snapshot_id = ?").bind(snapshotIdB).first<{ symbol_key: string }>();

    expect(rowA?.symbol_key).not.toBe(rowB?.symbol_key);
  });
});
