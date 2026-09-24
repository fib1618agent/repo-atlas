import { afterEach, describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import { createMemoryQueue, createMemoryR2 } from "../../support/memory-r2";
import { installFakeGithub } from "../../support/fake-github";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  acquireSnapshotHandler as acquireSnapshot,
  getSnapshotFileHandler as getSnapshotFile,
  getSnapshotStatusHandler as getSnapshotStatus,
  listSnapshotFilesHandler as listSnapshotFiles,
} from "../../../src/lib/code-intel/snapshot.functions";
import { processSnapshotQueueMessage } from "../../../src/lib/code-intel/queue/snapshot-worker";

const SHA = "f".repeat(40);
const FILES = [
  { name: "README.md", content: "hello world\n" },
  { name: "src/index.ts", content: "export const x = 1;\n" },
];

async function drainQueue(
  queue: { messages: unknown[] },
  db: ReturnType<typeof createSqliteD1>,
) {
  while (queue.messages.length > 0) {
    const message = queue.messages.shift() as {
      snapshotId: number;
      unitIndex: number;
    };
    await processSnapshotQueueMessage(message, db);
  }
}

let restoreFetch: (() => void) | undefined;

afterEach(() => {
  restoreFetch?.();
  setTestCloudflareEnv(undefined);
});

describe("reproducible snapshot acquisition end-to-end (SC-003, US3 MVP)", () => {
  test("acquiring the same repository+commitSha twice produces byte-identical file content both times", async () => {
    restoreFetch = await installFakeGithub(SHA, FILES);
    const db = createSqliteD1();
    const r2 = createMemoryR2();
    const queue = createMemoryQueue();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2, SNAPSHOT_QUEUE: queue });

    const repository = {
      provider: "github" as const,
      owner: "octocat",
      name: "hello",
    };

    // First acquisition.
    const first = await acquireSnapshot({ repository, ref: "main" });
    expect(first.reused).toBe(false);
    expect(first.status).toBe("in_progress");
    await drainQueue(queue, db);

    const status1 = await getSnapshotStatus({ snapshotId: first.snapshotId });
    expect(status1.status).toBe("completed");

    const page1 = await listSnapshotFiles({ snapshotId: first.snapshotId });
    expect(page1.files.map((f) => f.path).sort()).toEqual([
      "README.md",
      "src/index.ts",
    ]);

    const file1 = await getSnapshotFile({
      snapshotId: first.snapshotId,
      path: "README.md",
    });
    expect(new TextDecoder().decode(file1.content)).toBe("hello world\n");

    // Second acquisition for the same (repository, commitSha) — must reuse, not re-acquire.
    const second = await acquireSnapshot({ repository, ref: "main" });
    expect(second.reused).toBe(true);
    expect(second.snapshotId).toBe(first.snapshotId);

    const file2 = await getSnapshotFile({
      snapshotId: second.snapshotId,
      path: "README.md",
    });
    expect(file2.content).toEqual(file1.content);
    expect(file2.contentHash).toBe(file1.contentHash);
  });

  test("never observable as completed mid-acquisition (SC-006 groundwork)", async () => {
    restoreFetch = await installFakeGithub(SHA, FILES);
    const db = createSqliteD1();
    const r2 = createMemoryR2();
    const queue = createMemoryQueue();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2, SNAPSHOT_QUEUE: queue });

    const repository = {
      provider: "github" as const,
      owner: "octocat",
      name: "hello2",
    };
    const result = await acquireSnapshot({ repository, ref: "main" });

    // Before draining the queue, status must not be "completed".
    const midStatus = await getSnapshotStatus({
      snapshotId: result.snapshotId,
    });
    expect(midStatus.status).not.toBe("completed");

    const midPage = await listSnapshotFiles({ snapshotId: result.snapshotId });
    expect(midPage.files).toEqual([]); // not exposed as evidence until completion (FR-009)
  });
});
