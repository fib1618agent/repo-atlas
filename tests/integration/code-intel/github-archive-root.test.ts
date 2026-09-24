import { afterEach, describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import { createMemoryQueue, createMemoryR2 } from "../../support/memory-r2";
import { installFakeGithub } from "../../support/fake-github";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  acquireSnapshotHandler,
  listSnapshotFilesHandler,
} from "../../../src/lib/code-intel/snapshot.functions";
import { processSnapshotQueueMessage } from "../../../src/lib/code-intel/queue/snapshot-worker";

const SHA = "a".repeat(40);
const FILES = [{ name: "README.md", content: "root-stripped\n" }];

let restoreFetch: (() => void) | undefined;
afterEach(() => {
  restoreFetch?.();
  setTestCloudflareEnv(undefined);
});

describe("GitHub codeload archive root prefix (Contents API path parity)", () => {
  test("stores repository-relative paths after stripping tarball root directory", async () => {
    restoreFetch = await installFakeGithub(SHA, FILES, {
      archiveRootPrefix: `hello-${SHA}`,
    });
    const db = createSqliteD1();
    const r2 = createMemoryR2();
    const queue = createMemoryQueue();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2, SNAPSHOT_QUEUE: queue });

    const repository = {
      provider: "github" as const,
      owner: "octocat",
      name: "hello",
    };
    const created = await acquireSnapshotHandler({ repository, ref: "main" });
    while (queue.messages.length > 0) {
      await processSnapshotQueueMessage(queue.messages.shift() as never, db);
    }

    const page = await listSnapshotFilesHandler({
      snapshotId: created.snapshotId,
      limit: 10,
    });
    expect(page.files.map((f) => f.path)).toEqual(["README.md"]);
  });
});
