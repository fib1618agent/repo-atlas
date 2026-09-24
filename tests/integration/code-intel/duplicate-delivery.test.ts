import { afterEach, describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import { createMemoryQueue, createMemoryR2 } from "../../support/memory-r2";
import { installFakeGithub } from "../../support/fake-github";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  acquireSnapshotHandler,
  getSnapshotStatusHandler,
} from "../../../src/lib/code-intel/snapshot.functions";
import { processSnapshotQueueMessage } from "../../../src/lib/code-intel/queue/snapshot-worker";

const SHA = "3".repeat(40);
const FILES = [
  { name: "a.txt", content: "a" },
  { name: "b.txt", content: "b" },
];

let restoreFetch: (() => void) | undefined;
const originalCheckpoint = process.env["CODE_INTEL_CHECKPOINT_FILE_COUNT"];

afterEach(() => {
  restoreFetch?.();
  setTestCloudflareEnv(undefined);
  if (originalCheckpoint === undefined) {
    delete process.env["CODE_INTEL_CHECKPOINT_FILE_COUNT"];
  } else {
    process.env["CODE_INTEL_CHECKPOINT_FILE_COUNT"] = originalCheckpoint;
  }
});

describe("duplicate queue delivery is idempotent (SC-005)", () => {
  test("re-delivering an already-processed unit produces identical resulting state — no duplicate files, no corrupted metadata", async () => {
    restoreFetch = await installFakeGithub(SHA, FILES);
    const db = createSqliteD1();
    const r2 = createMemoryR2();
    const queue = createMemoryQueue();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2, SNAPSHOT_QUEUE: queue });

    const repository = { provider: "github" as const, owner: "o", name: "dup" };
    const created = await acquireSnapshotHandler({ repository, ref: "main" });

    const firstMessage = { snapshotId: created.snapshotId, unitIndex: 0 };
    await processSnapshotQueueMessage(firstMessage, db);

    const filesAfterFirst = await db
      .prepare("SELECT * FROM snapshot_files WHERE snapshot_id = ?")
      .bind(created.snapshotId)
      .all();
    const jobsAfterFirst = await db
      .prepare("SELECT * FROM acquisition_jobs WHERE snapshot_id = ?")
      .bind(created.snapshotId)
      .all();
    const statusAfterFirst = await getSnapshotStatusHandler({
      snapshotId: created.snapshotId,
    });

    // Simulated at-least-once redelivery of the SAME message.
    await processSnapshotQueueMessage(firstMessage, db);

    const filesAfterDup = await db
      .prepare("SELECT * FROM snapshot_files WHERE snapshot_id = ?")
      .bind(created.snapshotId)
      .all();
    const jobsAfterDup = await db
      .prepare("SELECT * FROM acquisition_jobs WHERE snapshot_id = ?")
      .bind(created.snapshotId)
      .all();
    const statusAfterDup = await getSnapshotStatusHandler({
      snapshotId: created.snapshotId,
    });

    expect(filesAfterDup.results?.length).toBe(filesAfterFirst.results?.length);
    expect(jobsAfterDup.results?.length).toBe(jobsAfterFirst.results?.length);
    expect(statusAfterDup.status).toBe(statusAfterFirst.status);
    expect(statusAfterDup.filesProcessed).toBe(statusAfterFirst.filesProcessed);
  });

  test("re-delivering unit 0 while snapshot is still in_progress does not duplicate file rows", async () => {
    process.env["CODE_INTEL_CHECKPOINT_FILE_COUNT"] = "2";
    const manyFiles = [
      { name: "a.txt", content: "a" },
      { name: "b.txt", content: "b" },
      { name: "c.txt", content: "c" },
    ];
    restoreFetch = await installFakeGithub(SHA, manyFiles);
    const db = createSqliteD1();
    const r2 = createMemoryR2();
    const queue = createMemoryQueue();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2, SNAPSHOT_QUEUE: queue });

    const repository = {
      provider: "github" as const,
      owner: "o",
      name: "dup",
    };
    const created = await acquireSnapshotHandler({ repository, ref: "main" });
    const unit0 = { snapshotId: created.snapshotId, unitIndex: 0 };

    await processSnapshotQueueMessage(unit0, db);

    const statusMid = await getSnapshotStatusHandler({
      snapshotId: created.snapshotId,
    });
    expect(statusMid.status).toBe("in_progress");

    const filesAfterFirst = await db
      .prepare("SELECT path FROM snapshot_files WHERE snapshot_id = ?")
      .bind(created.snapshotId)
      .all<{ path: string }>();
    expect(filesAfterFirst.results?.length).toBe(2);

    await processSnapshotQueueMessage(unit0, db);

    const filesAfterDup = await db
      .prepare("SELECT path FROM snapshot_files WHERE snapshot_id = ?")
      .bind(created.snapshotId)
      .all<{ path: string }>();
    expect(filesAfterDup.results?.length).toBe(2);
    expect(new Set(filesAfterDup.results?.map((r) => r.path)).size).toBe(2);
    expect(
      await getSnapshotStatusHandler({ snapshotId: created.snapshotId }),
    ).toMatchObject({ status: "in_progress" });
  });
});
