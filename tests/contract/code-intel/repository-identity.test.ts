import { describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import { getOrCreateRepository } from "../../../src/lib/code-intel/persistence/d1-client";

describe("repository identity (FR-001, FR-033)", () => {
  test("github and gitlab repos sharing owner/name never collide", async () => {
    const db = createSqliteD1();
    const githubId = await getOrCreateRepository(
      { provider: "github", owner: "x", name: "y" },
      db,
    );
    const gitlabId = await getOrCreateRepository(
      { provider: "gitlab", owner: "x", name: "y" },
      db,
    );
    expect(githubId).not.toBe(gitlabId);

    const result = await db
      .prepare("SELECT * FROM repositories WHERE owner = 'x' AND name = 'y'")
      .all();
    expect(result.results?.length).toBe(2);
  });

  test("re-registering the same identity returns the same row, not a duplicate", async () => {
    const db = createSqliteD1();
    const first = await getOrCreateRepository(
      { provider: "github", owner: "a", name: "b" },
      db,
    );
    const second = await getOrCreateRepository(
      { provider: "github", owner: "a", name: "b" },
      db,
    );
    expect(first).toBe(second);

    const result = await db
      .prepare("SELECT * FROM repositories WHERE owner = 'a' AND name = 'b'")
      .all();
    expect(result.results?.length).toBe(1);
  });
});
