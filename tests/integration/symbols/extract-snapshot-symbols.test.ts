import { beforeEach, describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import type { D1DatabaseLike } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { createAcquisitionAttempt, getOrCreateRepository } from "../../../src/lib/code-intel/persistence/d1-client";
import { toCommitSha } from "../../../src/lib/code-intel/domain/repository-identity";
import {
  getOrCreateSnapshotExtraction,
  finalizeSnapshotExtraction,
} from "../../../src/lib/code-intel/persistence/symbol-d1-client";
import { extractSnapshotSymbolsHandler } from "../../../src/lib/code-intel/symbol.functions";
import type { SymbolQueueMessage } from "../../../src/lib/code-intel/symbols/symbol-worker";

function fakeQueue() {
  const sent: SymbolQueueMessage[] = [];
  return { sent, async send(message: SymbolQueueMessage) { sent.push(message); } };
}

async function seedCompletedSnapshot(db: D1DatabaseLike, owner: string): Promise<number> {
  const repositoryId = await getOrCreateRepository({ provider: "github", owner, name: "r" }, db);
  const sha = toCommitSha("a".repeat(40));
  const snapshotId = await createAcquisitionAttempt(repositoryId, sha, "bulk_archive", db);
  await db.prepare(`UPDATE snapshots SET status = 'completed' WHERE id = ?`).bind(snapshotId).run();
  return snapshotId;
}

let db: D1DatabaseLike;
let queue: ReturnType<typeof fakeQueue>;

beforeEach(() => {
  db = createSqliteD1();
  queue = fakeQueue();
  setTestCloudflareEnv({ DB: db, SYMBOL_QUEUE: queue });
});

describe("extractSnapshotSymbolsHandler (T032)", () => {
  test("snapshot not completed: throws SNAPSHOT_NOT_EXTRACTABLE, no snapshot_extractions row created", async () => {
    const repositoryId = await getOrCreateRepository({ provider: "github", owner: "owner-pending", name: "r" }, db);
    const sha = toCommitSha("b".repeat(40));
    const snapshotId = await createAcquisitionAttempt(repositoryId, sha, "bulk_archive", db); // stays 'pending'

    await expect(extractSnapshotSymbolsHandler({ snapshotId })).rejects.toThrow(/SNAPSHOT_NOT_EXTRACTABLE/);

    const row = await db.prepare("SELECT * FROM snapshot_extractions WHERE snapshot_id = ?").bind(snapshotId).first();
    expect(row).toBeNull();
    expect(queue.sent).toEqual([]);
  });

  test("unknown snapshotId: throws SNAPSHOT_NOT_EXTRACTABLE", async () => {
    await expect(extractSnapshotSymbolsHandler({ snapshotId: 999999 })).rejects.toThrow(/SNAPSHOT_NOT_EXTRACTABLE/);
  });

  test("no existing extraction row: creates one (in_progress), enqueues unit 0, reused:false", async () => {
    const snapshotId = await seedCompletedSnapshot(db, "owner-a");

    const result = await extractSnapshotSymbolsHandler({ snapshotId });

    expect(result).toEqual({ snapshotId, status: "in_progress", extractorVersion: "v1", reused: false });
    expect(queue.sent).toEqual([{ snapshotId, unitIndex: 0, fromCursor: 0 }]);
    const row = await db.prepare("SELECT status FROM snapshot_extractions WHERE snapshot_id = ?").bind(snapshotId).first<{ status: string }>();
    expect(row?.status).toBe("in_progress");
  });

  test("existing completed extraction, same extractor version: reused:true, no new enqueue", async () => {
    const snapshotId = await seedCompletedSnapshot(db, "owner-b");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);
    await finalizeSnapshotExtraction(snapshotId, "completed", db);

    const result = await extractSnapshotSymbolsHandler({ snapshotId });

    expect(result).toEqual({ snapshotId, status: "completed", extractorVersion: "v1", reused: true });
    expect(queue.sent).toEqual([]);
  });

  test("existing completed_partial extraction, same extractor version: reused:true", async () => {
    const snapshotId = await seedCompletedSnapshot(db, "owner-b2");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);
    await finalizeSnapshotExtraction(snapshotId, "completed_partial", db);

    const result = await extractSnapshotSymbolsHandler({ snapshotId });

    expect(result).toEqual({ snapshotId, status: "completed_partial", extractorVersion: "v1", reused: true });
    expect(queue.sent).toEqual([]);
  });

  test("existing in_progress extraction (concurrent request): returns in_progress, no duplicate enqueue", async () => {
    const snapshotId = await seedCompletedSnapshot(db, "owner-c");
    await getOrCreateSnapshotExtraction(snapshotId, "v1", db);

    const result = await extractSnapshotSymbolsHandler({ snapshotId });

    expect(result).toEqual({ snapshotId, status: "in_progress", extractorVersion: "v1", reused: true });
    expect(queue.sent).toEqual([]);
  });

  test("existing completed extraction under an older extractor version: fresh run starts, reused:false", async () => {
    const snapshotId = await seedCompletedSnapshot(db, "owner-d");
    await getOrCreateSnapshotExtraction(snapshotId, "v0-old", db);
    await finalizeSnapshotExtraction(snapshotId, "completed", db);

    const result = await extractSnapshotSymbolsHandler({ snapshotId });

    expect(result).toEqual({ snapshotId, status: "in_progress", extractorVersion: "v1", reused: false });
    expect(queue.sent).toEqual([{ snapshotId, unitIndex: 0, fromCursor: 0 }]);
    const row = await db.prepare("SELECT extractor_version as v FROM snapshot_extractions WHERE snapshot_id = ?").bind(snapshotId).first<{ v: string }>();
    expect(row?.v).toBe("v1");
  });

  test("version-bump restart clears stale extraction_jobs so unit 0 isn't skipped as already-completed", async () => {
    const snapshotId = await seedCompletedSnapshot(db, "owner-e");
    await getOrCreateSnapshotExtraction(snapshotId, "v0-old", db);
    await db.prepare(
      `INSERT INTO extraction_jobs (snapshot_id, unit_index, status, checkpoint_cursor, updated_at) VALUES (?, 0, 'completed', NULL, ?)`,
    ).bind(snapshotId, new Date().toISOString()).run();
    await finalizeSnapshotExtraction(snapshotId, "completed", db);

    await extractSnapshotSymbolsHandler({ snapshotId });

    const job = await db.prepare("SELECT * FROM extraction_jobs WHERE snapshot_id = ?").bind(snapshotId).first();
    expect(job).toBeNull();
  });
});
