import { afterEach, describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import { createMemoryQueue, createMemoryR2 } from "../../support/memory-r2";
import { installFakeGithub } from "../../support/fake-github";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  acquireSnapshotHandler,
  getSnapshotFileHandler,
  listSnapshotFilesHandler,
} from "../../../src/lib/code-intel/snapshot.functions";
import { processSnapshotQueueMessage } from "../../../src/lib/code-intel/queue/snapshot-worker";
import { hashContent } from "../../../src/lib/code-intel/acquisition/content-address";

const SHA = "2".repeat(40);
const FILES = Array.from({ length: 12 }, (_, i) => ({
  name: `file-${i}.txt`,
  content: `content-${i}`,
}));

let restoreFetch: (() => void) | undefined;
afterEach(() => {
  restoreFetch?.();
  setTestCloudflareEnv(undefined);
});

describe("file inventory pagination and independent retrieval (FR-020, FR-019)", () => {
  test("paginated listing never exceeds the requested limit per page; file content hash matches a fresh recompute", async () => {
    restoreFetch = await installFakeGithub(SHA, FILES);
    const db = createSqliteD1();
    const r2 = createMemoryR2();
    const queue = createMemoryQueue();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2, SNAPSHOT_QUEUE: queue });

    const repository = {
      provider: "github" as const,
      owner: "o",
      name: "inventory",
    };
    const created = await acquireSnapshotHandler({ repository, ref: "main" });
    while (queue.messages.length > 0) {
      await processSnapshotQueueMessage(queue.messages.shift() as never, db);
    }

    const page1 = await listSnapshotFilesHandler({
      snapshotId: created.snapshotId,
      limit: 5,
    });
    expect(page1.files.length).toBe(5);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await listSnapshotFilesHandler({
      snapshotId: created.snapshotId,
      cursor: page1.nextCursor ?? undefined,
      limit: 5,
    });
    expect(page2.files.length).toBe(5);

    const page3 = await listSnapshotFilesHandler({
      snapshotId: created.snapshotId,
      cursor: page2.nextCursor ?? undefined,
      limit: 5,
    });
    expect(page3.files.length).toBe(2);
    expect(page3.nextCursor).toBeNull();

    const allPaths = [...page1.files, ...page2.files, ...page3.files]
      .map((f) => f.path)
      .sort();
    expect(allPaths).toEqual(FILES.map((f) => f.name).sort());

    const file = await getSnapshotFileHandler({
      snapshotId: created.snapshotId,
      path: "file-0.txt",
    });
    const recomputed = await hashContent(file.content);
    expect(recomputed).toBe(file.contentHash);
  });
});
