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

/** T056 (quickstart.md US5 scenario) — page through a snapshot's complete symbol set, confirm the union across calls matches with no duplicates or omissions. */

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

describe("listSymbols full pagination (T056)", () => {
  test("paging through nextCursor visits every symbol exactly once", async () => {
    const db: D1DatabaseLike = createSqliteD1();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2 });

    const repositoryId = await getOrCreateRepository({ provider: "github", owner: "owner-paging", name: "r" }, db);
    const sha = toCommitSha("a".repeat(40));
    const snapshotId = await createAcquisitionAttempt(repositoryId, sha, "bulk_archive", db);
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);

    const expectedNames: string[] = [];
    for (let i = 0; i < 11; i++) {
      const path = `f${i}.js`;
      const content = `function f${i}() { return ${i}; }\n`;
      expectedNames.push(`f${i}`);
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

    const seen: string[] = [];
    let cursor: number | undefined = undefined;
    let pageCount = 0;
    do {
      const page = await listSymbolsHandler({ snapshotId, cursor, limit: 4 });
      seen.push(...page.symbols.map((s) => s.name));
      cursor = page.nextCursor ?? undefined;
      pageCount++;
      expect(pageCount).toBeLessThan(20); // guard against an infinite loop bug
    } while (cursor !== undefined);

    expect(new Set(seen).size).toBe(seen.length); // no duplicates
    expect(seen.sort()).toEqual([...expectedNames].sort()); // no omissions
    expect(pageCount).toBeGreaterThan(1); // actually exercised multiple pages
  });
});
