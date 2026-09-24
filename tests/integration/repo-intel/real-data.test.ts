/**
 * Opt-in REAL-DATA validation (Feature 009 T028, D3 option (a)).
 *
 * Runs the existing Feature 001 acquisition and Feature 002 extraction
 * pipelines against the PUBLIC GitHub archives of real repositories, into the
 * in-memory sqlite D1 adapter and in-memory R2 (no Cloudflare, no Wrangler),
 * then calls the Feature 009 handlers. Read-only network access to public
 * GitHub only. Skipped unless REPOATLAS_REAL_DATA=1:
 *
 *   REPOATLAS_REAL_DATA=1 bun test tests/integration/repo-intel/real-data.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import { createMemoryQueue, createMemoryR2 } from "../../support/memory-r2";
import { installTestWasmModules } from "../../support/wasm-test-modules";
import {
  setTestCloudflareEnv,
  type D1DatabaseLike,
} from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { acquireSnapshotHandler } from "../../../src/lib/code-intel/snapshot.functions";
import { processSnapshotQueueMessage } from "../../../src/lib/code-intel/queue/snapshot-worker";
import {
  extractSnapshotSymbolsHandler,
  getSymbolHandler,
} from "../../../src/lib/code-intel/symbol.functions";
import {
  processSymbolQueueMessage,
  type SymbolQueueMessage,
} from "../../../src/lib/code-intel/symbols/symbol-worker";
import {
  getRepositoryIntelligenceHandler,
  listFileSymbolsHandler,
  listStructureLevelHandler,
} from "../../../src/lib/repo-intel/repository-intelligence.functions";

const ENABLED = process.env["REPOATLAS_REAL_DATA"] === "1";
const TIMEOUT = 300_000;

interface Target {
  owner: string;
  name: string;
  ref: string;
}

const TARGETS: Target[] = [
  { owner: "fib1618agent", name: "repo-atlas", ref: "main" },
  { owner: "imdadareeph", name: "ia-admin", ref: "main" },
  { owner: "imdadareeph", name: "transactions-service", ref: "main" },
];

let db: D1DatabaseLike;
const snapshotIds = new Map<string, number>();

async function ingest(target: Target): Promise<number> {
  const snapshotQueue = createMemoryQueue();
  const symbolQueue = createMemoryQueue();
  setTestCloudflareEnv({
    DB: db,
    SNAPSHOTS: createMemoryR2(),
    SNAPSHOT_QUEUE: snapshotQueue,
    SYMBOL_QUEUE: symbolQueue,
  });
  const acquired = await acquireSnapshotHandler({
    repository: { provider: "github", owner: target.owner, name: target.name },
    ref: target.ref,
  });
  while (snapshotQueue.messages.length > 0) {
    const message = snapshotQueue.messages.shift() as {
      snapshotId: number;
      unitIndex: number;
    };
    await processSnapshotQueueMessage(message, db);
  }
  await extractSnapshotSymbolsHandler({ snapshotId: acquired.snapshotId });
  while (symbolQueue.messages.length > 0) {
    const message = symbolQueue.messages.shift() as SymbolQueueMessage;
    await processSymbolQueueMessage(message, db);
  }
  return acquired.snapshotId;
}

describe.skipIf(!ENABLED)(
  "real GitHub data through Feature 001/002 → Feature 009",
  () => {
    beforeAll(async () => {
      await installTestWasmModules();
      db = createSqliteD1();
      for (const t of TARGETS) {
        snapshotIds.set(`${t.owner}/${t.name}`, await ingest(t));
      }
      // Feature 009 reads through the same environment the pipelines wrote to.
      setTestCloudflareEnv({ DB: db });
    }, TIMEOUT);

    afterAll(() => setTestCloudflareEnv(undefined));

    test(
      "fib1618agent/repo-atlas: identity, overview, structure, symbols (AT-009-03/04/05)",
      async () => {
        const overview = await getRepositoryIntelligenceHandler({
          owner: "fib1618agent",
          name: "repo-atlas",
        });
        expect(overview.status).toBe("ready");
        if (overview.status !== "ready") return;
        const snapshotId = snapshotIds.get("fib1618agent/repo-atlas")!;
        expect(overview.snapshot.snapshotId).toBe(snapshotId);
        expect(overview.snapshot.commitSha).toMatch(/^[0-9a-f]{40}$/);
        expect(overview.totals.files).toBeGreaterThan(50);
        expect(["completed", "completed_partial"]).toContain(
          overview.extraction.status,
        );
        expect(overview.extraction.symbolsExtracted).toBeGreaterThan(0);
        const keys = overview.composition.buckets.map((b) => b.key);
        expect(keys).toContain("typescript");

        const root = await listStructureLevelHandler({ snapshotId });
        const rootDirs = root.directories.map((d) => d.name);
        for (const expected of ["src", "docs", "specs"]) {
          expect(rootDirs).toContain(expected);
        }

        const lib = await listStructureLevelHandler({
          snapshotId,
          directoryPath: "src/lib",
        });
        const tsFile = lib.files.find(
          (f) => f.language === "typescript" && f.symbolCount > 0,
        );
        expect(tsFile).toBeDefined();
        const symbols = await listFileSymbolsHandler({
          snapshotId,
          path: tsFile!.path,
        });
        expect(symbols.extractionStatus).toBe("extracted");
        expect(symbols.symbols.length).toBeGreaterThan(0);

        // Identity propagation: provenance of a real symbol names the same repository.
        const detail = await getSymbolHandler({
          symbolId: symbols.symbols[0]!.id,
        });
        expect(detail.provenance.repository).toEqual({
          provider: "github",
          owner: "fib1618agent",
          name: "repo-atlas",
        });
        expect(detail.provenance.commitSha).toBe(overview.snapshot.commitSha);

        console.log(
          `[real-data] repo-atlas: commit ${overview.snapshot.commitSha.slice(0, 7)}, ` +
            `${overview.totals.files} files, ${overview.totals.bytes} bytes, ` +
            `${overview.totals.directories} directories, extraction ${overview.extraction.status}, ` +
            `${overview.extraction.symbolsExtracted} symbols, root dirs [${rootDirs.join(", ")}], ` +
            `composition [${overview.composition.buckets.map((b) => `${b.key}:${b.fileCount}`).join(", ")}]`,
        );
      },
      TIMEOUT,
    );

    test(
      "second and third repositories from the imdadareeph scope use the same paths (AT-009-08)",
      async () => {
        for (const t of TARGETS.slice(1)) {
          const overview = await getRepositoryIntelligenceHandler({
            owner: t.owner,
            name: t.name,
          });
          expect(overview.status).toBe("ready");
          if (overview.status !== "ready") continue;
          const snapshotId = snapshotIds.get(`${t.owner}/${t.name}`)!;
          expect(overview.snapshot.snapshotId).toBe(snapshotId);
          expect(overview.totals.files).toBeGreaterThan(0);
          const root = await listStructureLevelHandler({ snapshotId });
          expect(root.directories.length + root.files.length).toBeGreaterThan(
            0,
          );
          console.log(
            `[real-data] ${t.owner}/${t.name}: ${overview.totals.files} files, extraction ${overview.extraction.status}, ` +
              `${overview.extraction.symbolsExtracted} symbols, composition [${overview.composition.buckets.map((b) => `${b.key}:${b.fileCount}`).join(", ")}]`,
          );
        }
        // The three repositories are independent: no cross-repository leakage.
        const a = await getRepositoryIntelligenceHandler({
          owner: "fib1618agent",
          name: "repo-atlas",
        });
        const b = await getRepositoryIntelligenceHandler({
          owner: "imdadareeph",
          name: "ia-admin",
        });
        expect(
          a.status === "ready" &&
            b.status === "ready" &&
            a.snapshot.snapshotId !== b.snapshot.snapshotId,
        ).toBe(true);
      },
      TIMEOUT,
    );

    test("no relationship data exists or is produced (AT-009-05/06)", async () => {
      const n = await db
        .prepare("SELECT COUNT(*) AS n FROM relationships")
        .first<{ n: number }>();
      expect(Number(n?.n ?? 0)).toBe(0);
    });
  },
);

test("real-data suite is opt-in", () => {
  expect(typeof ENABLED).toBe("boolean");
});
