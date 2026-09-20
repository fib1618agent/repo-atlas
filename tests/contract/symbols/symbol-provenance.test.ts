import { describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import type { D1DatabaseLike } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { createAcquisitionAttempt, getOrCreateRepository, insertSnapshotFile } from "../../../src/lib/code-intel/persistence/d1-client";
import { toCommitSha } from "../../../src/lib/code-intel/domain/repository-identity";
import { replaceSymbolsForFile, upsertFileExtraction } from "../../../src/lib/code-intel/persistence/symbol-d1-client";
import type { SymbolIR } from "../../../src/lib/code-intel/symbols/to-intermediate-representation";
import { getSymbolHandler } from "../../../src/lib/code-intel/symbol.functions";

async function seedSnapshotWithFile(db: D1DatabaseLike, owner = "o", name = "r", shaSeed = "a") {
  const repositoryId = await getOrCreateRepository({ provider: "github", owner, name }, db);
  const sha = toCommitSha(shaSeed.repeat(40));
  const snapshotId = await createAcquisitionAttempt(repositoryId, sha, "bulk_archive", db);
  await insertSnapshotFile(snapshotId, "src/Foo.ts", 10, "hash1", "key1", db);
  const row = await db.prepare("SELECT id FROM snapshot_files WHERE snapshot_id = ? AND path = ?").bind(snapshotId, "src/Foo.ts").first<{ id: number }>();
  return { snapshotId, snapshotFileId: row!.id, commitSha: sha };
}

function ir(overrides: Partial<SymbolIR> & Pick<SymbolIR, "kind" | "name" | "symbolKey">): SymbolIR {
  return { qualifiedName: null, startLine: 0, startColumn: 0, endLine: 0, endColumn: 10, parentSymbolKey: null, ...overrides };
}

describe("getSymbol (T035) — full provenance in one call", () => {
  test("resolves the full provenance chain: file path, snapshot id, repository, commit SHA", async () => {
    const db = createSqliteD1();
    setTestCloudflareEnv({ DB: db });
    const { snapshotId, snapshotFileId, commitSha } = await seedSnapshotWithFile(db, "prov-owner", "prov-repo", "b");
    const fileExtractionId = await upsertFileExtraction(
      { snapshotId, snapshotFileId, directoryPath: "src", language: "typescript", status: "extracted", failureReason: null, extractorVersion: "v1" },
      db,
    );
    await replaceSymbolsForFile(fileExtractionId, snapshotId, [ir({ kind: "class", name: "X", symbolKey: "x" })], "v1", db);
    const row = await db.prepare("SELECT id FROM symbols WHERE symbol_key = ?").bind("x").first<{ id: number }>();

    const detail = await getSymbolHandler({ symbolId: row!.id });

    expect(detail).toEqual({
      id: row!.id,
      kind: "class",
      name: "X",
      qualifiedName: null,
      startLine: 0,
      startColumn: 0,
      endLine: 0,
      endColumn: 10,
      parentSymbolId: null,
      isExported: null,
      provenance: {
        filePath: "src/Foo.ts",
        snapshotId,
        repository: { provider: "github", owner: "prov-owner", name: "prov-repo" },
        commitSha,
      },
    });
  });

  test("throws SYMBOL_NOT_FOUND for an unknown symbol id", async () => {
    const db = createSqliteD1();
    setTestCloudflareEnv({ DB: db });

    await expect(getSymbolHandler({ symbolId: 999999 })).rejects.toThrow(/SYMBOL_NOT_FOUND/);
  });
});
