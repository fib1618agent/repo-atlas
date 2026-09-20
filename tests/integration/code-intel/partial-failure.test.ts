import { afterEach, describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import { createMemoryQueue, createMemoryR2 } from "../../support/memory-r2";
import { installFakeGithub } from "../../support/fake-github";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  acquireSnapshotHandler,
  getSnapshotStatusHandler,
  listSnapshotFilesHandler,
} from "../../../src/lib/code-intel/snapshot.functions";
import { processSnapshotQueueMessage } from "../../../src/lib/code-intel/queue/snapshot-worker";

const SHA = "4".repeat(40);
const FILES = [{ name: "a.txt", content: "a" }];

let restoreFetch: (() => void) | undefined;
afterEach(() => {
  restoreFetch?.();
  setTestCloudflareEnv(undefined);
});

describe("a unit that fails mid-processing is never observable as completed (SC-006)", () => {
  test("forced R2 failure keeps the snapshot non-completed and does not expose partial files", async () => {
    restoreFetch = await installFakeGithub(SHA, FILES);
    const db = createSqliteD1();
    const r2 = createMemoryR2();
    const queue = createMemoryQueue();

    // Force every R2 put to fail, simulating a unit that fails partway through.
    const failingR2 = {
      ...r2,
      put: async () => {
        throw new Error("simulated R2 failure");
      },
    };
    setTestCloudflareEnv({
      DB: db,
      SNAPSHOTS: failingR2,
      SNAPSHOT_QUEUE: queue,
    });

    const repository = {
      provider: "github" as const,
      owner: "o",
      name: "fail",
    };
    const created = await acquireSnapshotHandler({ repository, ref: "main" });

    await expect(
      processSnapshotQueueMessage(
        { snapshotId: created.snapshotId, unitIndex: 0 },
        db,
      ),
    ).rejects.toThrow();

    const status = await getSnapshotStatusHandler({
      snapshotId: created.snapshotId,
    });
    expect(status.status).not.toBe("completed");

    const page = await listSnapshotFilesHandler({
      snapshotId: created.snapshotId,
    });
    expect(page.files).toEqual([]); // never exposed as evidence, even partially
  });

  test("exceeding the retry budget marks the attempt failed, never completed, and terminates the acquisition attempt log", async () => {
    restoreFetch = await installFakeGithub(SHA, FILES);
    const db = createSqliteD1();
    const failingR2 = {
      get: async () => null,
      head: async () => null,
      put: async () => {
        throw new Error("permanent failure");
      },
    };
    const queue = createMemoryQueue();
    setTestCloudflareEnv({
      DB: db,
      SNAPSHOTS: failingR2,
      SNAPSHOT_QUEUE: queue,
    });

    const repository = {
      provider: "github" as const,
      owner: "o",
      name: "fail2",
    };
    const created = await acquireSnapshotHandler({ repository, ref: "main" });

    // Retry the same unit past the configured max attempt count.
    for (let i = 0; i < 6; i++) {
      await processSnapshotQueueMessage(
        { snapshotId: created.snapshotId, unitIndex: 0 },
        db,
      ).catch(() => {});
    }

    const status = await getSnapshotStatusHandler({
      snapshotId: created.snapshotId,
    });
    expect(status.status).toBe("failed");

    const logRow = await db
      .prepare(
        "SELECT status FROM acquisition_attempts WHERE repository_id = (SELECT repository_id FROM snapshots WHERE id = ?)",
      )
      .bind(created.snapshotId)
      .first<{ status: string }>();
    expect(logRow?.status).toBe("failed");
  });
});
