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

const SHA = "8".repeat(40);
const FILES = [{ name: "a.txt", content: "a" }];

let restoreFetch: (() => void) | undefined;
afterEach(() => {
  restoreFetch?.();
  setTestCloudflareEnv(undefined);
});

describe("attempt-level retry after a failed attempt (FR-011, requirement 7/9)", () => {
  test("re-invoking acquireSnapshot after a failed attempt creates a NEW attempt (incremented attempt_number), not a mutation of the failed one, and the new attempt can succeed", async () => {
    restoreFetch = await installFakeGithub(SHA, FILES);
    const db = createSqliteD1();
    const queue = createMemoryQueue();
    const failingR2 = {
      get: async () => null,
      head: async () => null,
      put: async () => {
        throw new Error("permanent failure");
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
      name: "attempt-retry",
    };
    const first = await acquireSnapshotHandler({ repository, ref: "main" });

    for (let i = 0; i < 6; i++) {
      await processSnapshotQueueMessage(
        { snapshotId: first.snapshotId, unitIndex: 0 },
        db,
      ).catch(() => {});
    }
    const firstStatus = await getSnapshotStatusHandler({
      snapshotId: first.snapshotId,
    });
    expect(firstStatus.status).toBe("failed");

    // Fix the underlying failure, then retry at the attempt level.
    setTestCloudflareEnv({
      DB: db,
      SNAPSHOTS: createMemoryR2(),
      SNAPSHOT_QUEUE: queue,
    });
    const second = await acquireSnapshotHandler({ repository, ref: "main" });

    expect(second.snapshotId).not.toBe(first.snapshotId); // a genuinely new attempt row, not a mutation
    expect(second.reused).toBe(false);

    const attemptRows = await db
      .prepare(
        "SELECT attempt_number FROM snapshots WHERE id IN (?, ?) ORDER BY attempt_number",
      )
      .bind(first.snapshotId, second.snapshotId)
      .all<{ attempt_number: number }>();
    expect(attemptRows.results?.map((r) => r.attempt_number)).toEqual([1, 2]);

    while (queue.messages.length > 0) {
      await processSnapshotQueueMessage(queue.messages.shift() as never, db);
    }
    const secondStatus = await getSnapshotStatusHandler({
      snapshotId: second.snapshotId,
    });
    expect(secondStatus.status).toBe("completed");

    // The failed attempt's row is untouched — still failed, not silently upgraded.
    const firstStatusAfter = await getSnapshotStatusHandler({
      snapshotId: first.snapshotId,
    });
    expect(firstStatusAfter.status).toBe("failed");

    // Acquisition attempt log: one terminal 'failed' row and one terminal 'completed' row — not conflated.
    const logRows = await db
      .prepare(
        "SELECT status FROM acquisition_attempts WHERE repository_id = (SELECT repository_id FROM snapshots WHERE id = ?) ORDER BY started_at",
      )
      .bind(first.snapshotId)
      .all<{ status: string }>();
    expect(logRows.results?.map((r) => r.status)).toEqual([
      "failed",
      "completed",
    ]);
  });
});
