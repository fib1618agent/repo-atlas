import { afterEach, describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import { createMemoryQueue, createMemoryR2 } from "../../support/memory-r2";
import { installFakeGithub } from "../../support/fake-github";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  acquireSnapshotHandler,
  getSnapshotFileHandler,
  getSnapshotStatusHandler,
} from "../../../src/lib/code-intel/snapshot.functions";
import { processSnapshotQueueMessage } from "../../../src/lib/code-intel/queue/snapshot-worker";

const SHA = "1".repeat(40);
const FILES = [{ name: "a.txt", content: "persisted content\n" }];

let restoreFetch: (() => void) | undefined;
afterEach(() => {
  restoreFetch?.();
  setTestCloudflareEnv(undefined);
});

describe("persistence across invocations (SC-008)", () => {
  test("snapshot metadata and file content are retrievable, unchanged, from a later, separate call sequence", async () => {
    restoreFetch = await installFakeGithub(SHA, FILES);
    const db = createSqliteD1();
    const r2 = createMemoryR2();
    const queue = createMemoryQueue();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2, SNAPSHOT_QUEUE: queue });

    const repository = {
      provider: "github" as const,
      owner: "o",
      name: "persist",
    };

    // "Invocation 1": create + complete.
    const created = await acquireSnapshotHandler({ repository, ref: "main" });
    while (queue.messages.length > 0) {
      await processSnapshotQueueMessage(queue.messages.shift() as never, db);
    }

    // Simulate "a completely separate later invocation": fresh calls against
    // the same durable D1/R2 state (in a real deployment, a different Worker
    // invocation; here, the same test process re-reading via the handler
    // functions with no reliance on any in-memory state from the first call).
    const status = await getSnapshotStatusHandler({
      snapshotId: created.snapshotId,
    });
    expect(status.status).toBe("completed");

    const file = await getSnapshotFileHandler({
      snapshotId: created.snapshotId,
      path: "a.txt",
    });
    expect(new TextDecoder().decode(file.content)).toBe("persisted content\n");
  });
});
