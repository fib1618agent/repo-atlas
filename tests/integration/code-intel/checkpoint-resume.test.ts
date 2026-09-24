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

const SHA = "7".repeat(40);
const FILES = Array.from({ length: 5 }, (_, i) => ({
  name: `f${i}.txt`,
  content: `content-${i}`,
}));

let restoreFetch: (() => void) | undefined;
const originalCheckpoint = process.env["CODE_INTEL_CHECKPOINT_FILE_COUNT"];

afterEach(() => {
  restoreFetch?.();
  setTestCloudflareEnv(undefined);
  if (originalCheckpoint === undefined)
    delete process.env["CODE_INTEL_CHECKPOINT_FILE_COUNT"];
  else process.env["CODE_INTEL_CHECKPOINT_FILE_COUNT"] = originalCheckpoint;
});

describe("checkpointed multi-unit acquisition with re-fetch-and-fast-forward resume (FR-023, FR-025, US6)", () => {
  test("a repo requiring multiple checkpoints spans multiple AcquisitionJob units and skips already-written files on resume", async () => {
    process.env["CODE_INTEL_CHECKPOINT_FILE_COUNT"] = "2"; // force 3 units for 5 files (2+2+1)
    restoreFetch = await installFakeGithub(SHA, FILES);
    const db = createSqliteD1();
    const r2 = createMemoryR2();
    const queue = createMemoryQueue();
    setTestCloudflareEnv({ DB: db, SNAPSHOTS: r2, SNAPSHOT_QUEUE: queue });

    const repository = {
      provider: "github" as const,
      owner: "o",
      name: "checkpoint",
    };
    const created = await acquireSnapshotHandler({ repository, ref: "main" });

    let unitsProcessed = 0;
    while (queue.messages.length > 0) {
      const message = queue.messages.shift() as {
        snapshotId: number;
        unitIndex: number;
      };
      await processSnapshotQueueMessage(message, db);
      unitsProcessed++;
    }

    expect(unitsProcessed).toBeGreaterThan(1); // real multi-unit checkpointing occurred, not a single pass

    const jobs = await db
      .prepare(
        "SELECT * FROM acquisition_jobs WHERE snapshot_id = ? ORDER BY unit_index",
      )
      .bind(created.snapshotId)
      .all<{ status: string }>();
    expect(jobs.results?.length).toBe(unitsProcessed);
    expect(jobs.results?.every((j) => j.status === "completed")).toBe(true);

    const status = await getSnapshotStatusHandler({
      snapshotId: created.snapshotId,
    });
    expect(status.status).toBe("completed");

    const page = await listSnapshotFilesHandler({
      snapshotId: created.snapshotId,
      limit: 100,
    });
    expect(page.files.length).toBe(5); // resume never duplicated or dropped a file
    expect(new Set(page.files.map((f) => f.path)).size).toBe(5); // no duplicates
  });
});
