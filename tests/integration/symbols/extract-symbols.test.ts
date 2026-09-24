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
import { processSymbolQueueMessage, type SymbolQueueMessage } from "../../../src/lib/code-intel/symbols/symbol-worker";
import { extractSnapshotSymbolsHandler, listSymbolsHandler } from "../../../src/lib/code-intel/symbol.functions";

/**
 * T020 (spec.md US1 Acceptance Scenario 4, SC-003) — the one end-to-end path
 * through the real public API surface: `extractSnapshotSymbols` -> drain the
 * enqueued unit(s) through the real worker -> `listSymbols`; then call
 * `extractSnapshotSymbols` again with an unchanged `SYMBOL_EXTRACTOR_VERSION`
 * and confirm `listSymbols`'s result set is identical (not just "a" symbol
 * set — the *same* one, no re-extraction side effects).
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

function fakeQueue(db: D1DatabaseLike) {
  return {
    async send(message: SymbolQueueMessage) {
      // Synchronously drains the unit, same as a real Cloudflare Queue
      // consumer would (no test needs to poll/await a separate dispatch).
      await processSymbolQueueMessage(message, db);
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

describe("extractSnapshotSymbols end-to-end (T020, SC-003)", () => {
  test("extract -> listSymbols -> re-run at unchanged version -> listSymbols is identical", async () => {
    const db = createSqliteD1();
    const queue = fakeQueue(db);
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2, SYMBOL_QUEUE: queue });

    const repositoryId = await getOrCreateRepository({ provider: "github", owner: "owner-e2e", name: "r" }, db);
    const sha = toCommitSha("a".repeat(40));
    const snapshotId = await createAcquisitionAttempt(repositoryId, sha, "bulk_archive", db);
    await db.prepare(`UPDATE snapshots SET status = 'completed' WHERE id = ?`).bind(snapshotId).run();

    const bytes = new TextEncoder().encode("function a() {}\nclass B {\n  m() {}\n}\n");
    await insertSnapshotFile(snapshotId, "src/a.js", bytes.byteLength, "hash", "r2/a.js", db);
    r2.seed("r2/a.js", bytes);

    const first = await extractSnapshotSymbolsHandler({ snapshotId });
    expect(first.reused).toBe(false);
    // `first.status` reflects the row's state at the moment the handler
    // captured it (before the synchronous fake queue below finished draining
    // the unit inside `.send()`) — "in_progress" here is correct per
    // contract, not stale; the real post-drain state is checked next.
    expect(first.status).toBe("in_progress");

    const firstPage = await listSymbolsHandler({ snapshotId, limit: 100 });
    expect(firstPage.symbols.map((s) => s.name).sort()).toEqual(["B", "a", "m"]);
    expect(firstPage.nextCursor).toBeNull();

    // Re-run at the same SYMBOL_EXTRACTOR_VERSION — must reuse, not re-extract.
    const second = await extractSnapshotSymbolsHandler({ snapshotId });
    expect(second.reused).toBe(true);
    expect(second.status).toBe("completed");

    const secondPage = await listSymbolsHandler({ snapshotId, limit: 100 });
    expect(secondPage).toEqual(firstPage); // identical result set, not just equivalent content
  });
});
