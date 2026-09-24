import { describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import {
  createAcquisitionAttempt,
  getOrCreateRepository,
  insertSnapshotFile,
  upsertAcquisitionJob,
} from "../../../src/lib/code-intel/persistence/d1-client";
import { toCommitSha } from "../../../src/lib/code-intel/domain/repository-identity";

describe("D1 idempotent-insert behavior (FR-024 groundwork for SC-005)", () => {
  test("re-inserting the same snapshot_files row twice produces one row, not two", async () => {
    const db = createSqliteD1();
    const repositoryId = await getOrCreateRepository(
      { provider: "github", owner: "o", name: "r" },
      db,
    );
    const sha = toCommitSha("c".repeat(40));
    const snapshotId = await createAcquisitionAttempt(
      repositoryId,
      sha,
      "bulk_archive",
      db,
    );

    await insertSnapshotFile(snapshotId, "a.txt", 3, "hash1", "key1", db);
    await insertSnapshotFile(snapshotId, "a.txt", 3, "hash1", "key1", db); // duplicate delivery

    const rows = await db
      .prepare("SELECT * FROM snapshot_files WHERE snapshot_id = ?")
      .bind(snapshotId)
      .all();
    expect(rows.results?.length).toBe(1);
  });

  test("re-upserting the same acquisition_jobs unit twice produces one row, not two", async () => {
    const db = createSqliteD1();
    const repositoryId = await getOrCreateRepository(
      { provider: "github", owner: "o2", name: "r2" },
      db,
    );
    const sha = toCommitSha("d".repeat(40));
    const snapshotId = await createAcquisitionAttempt(
      repositoryId,
      sha,
      "bulk_archive",
      db,
    );

    await upsertAcquisitionJob(snapshotId, 0, "pending", null, db);
    await upsertAcquisitionJob(snapshotId, 0, "pending", "path/a", db); // duplicate delivery, cursor advanced

    const rows = await db
      .prepare("SELECT * FROM acquisition_jobs WHERE snapshot_id = ?")
      .bind(snapshotId)
      .all();
    expect(rows.results?.length).toBe(1);
  });

  test("upserting a completed job never regresses its status back to pending", async () => {
    const db = createSqliteD1();
    const repositoryId = await getOrCreateRepository(
      { provider: "github", owner: "o3", name: "r3" },
      db,
    );
    const sha = toCommitSha("e".repeat(40));
    const snapshotId = await createAcquisitionAttempt(
      repositoryId,
      sha,
      "bulk_archive",
      db,
    );

    await upsertAcquisitionJob(snapshotId, 0, "pending", null, db);
    await db
      .prepare(
        "UPDATE acquisition_jobs SET status = 'completed' WHERE snapshot_id = ? AND unit_index = 0",
      )
      .bind(snapshotId)
      .run();

    await upsertAcquisitionJob(
      snapshotId,
      0,
      "pending",
      "late-retry-cursor",
      db,
    ); // simulated stale/duplicate redelivery

    const row = await db
      .prepare(
        "SELECT status FROM acquisition_jobs WHERE snapshot_id = ? AND unit_index = 0",
      )
      .bind(snapshotId)
      .first<{ status: string }>();
    expect(row?.status).toBe("completed");
  });
});
