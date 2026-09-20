import { afterEach, describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import { createMemoryQueue, createMemoryR2 } from "../../support/memory-r2";
import { installFakeGithub } from "../../support/fake-github";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  acquireSnapshotHandler,
  getRepositoryHistoryHandler,
} from "../../../src/lib/code-intel/snapshot.functions";
import { processSnapshotQueueMessage } from "../../../src/lib/code-intel/queue/snapshot-worker";

const SHA_A = "5".repeat(40);
const SHA_B = "6".repeat(40);
const FILES = [{ name: "a.txt", content: "a" }];

let restoreFetch: (() => void) | undefined;
afterEach(() => {
  restoreFetch?.();
  setTestCloudflareEnv(undefined);
});

describe("getRepositoryHistory returns completed snapshots only (FR-028, FR-029, I1)", () => {
  test("empty history before any snapshot exists", async () => {
    const db = createSqliteD1();
    setTestCloudflareEnv({
      DB: db,
      SNAPSHOTS: createMemoryR2(),
      SNAPSHOT_QUEUE: createMemoryQueue(),
    });
    const repository = {
      provider: "github" as const,
      owner: "o",
      name: "history-empty",
    };
    const history = await getRepositoryHistoryHandler({ repository });
    expect(history).toEqual([]);
  });

  test("history is ordered most-recent-completed-first and never includes a failed/in-progress attempt", async () => {
    const db = createSqliteD1();
    const r2 = createMemoryR2();
    const queue = createMemoryQueue();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2, SNAPSHOT_QUEUE: queue });
    const repository = {
      provider: "github" as const,
      owner: "o",
      name: "history",
    };

    restoreFetch = await installFakeGithub(SHA_A, FILES);
    const first = await acquireSnapshotHandler({ repository, ref: "shaA" });
    while (queue.messages.length > 0)
      await processSnapshotQueueMessage(queue.messages.shift() as never, db);
    restoreFetch();

    restoreFetch = await installFakeGithub(SHA_B, FILES);
    const second = await acquireSnapshotHandler({ repository, ref: "shaB" });
    while (queue.messages.length > 0)
      await processSnapshotQueueMessage(queue.messages.shift() as never, db);

    const history = await getRepositoryHistoryHandler({ repository });
    expect(history.map((h) => h.commitSha)).toEqual([SHA_B, SHA_A]); // most recent first
    expect(history.every((h) => h.completedAt)).toBe(true);
    expect(second.acquisitionMode).toBe("incremental_api"); // a prior completed snapshot existed (FR-013, US7)
    expect(first.acquisitionMode).toBe("bulk_archive"); // no prior completed snapshot (FR-012)
  });
});
