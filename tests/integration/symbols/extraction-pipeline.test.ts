import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSqliteD1 } from "../../support/d1-sqlite-adapter";
import {
  createAcquisitionAttempt,
  getOrCreateRepository,
  insertSnapshotFile,
} from "../../../src/lib/code-intel/persistence/d1-client";
import { toCommitSha } from "../../../src/lib/code-intel/domain/repository-identity";
import type { D1DatabaseLike, R2BucketLike } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  setTestCoreWasmModule,
  setTestGrammarBytesSource,
} from "../../../src/lib/code-intel/symbols/grammar-provider";
import { extractFile } from "../../../src/lib/code-intel/symbols/extraction-pipeline";
import type { SupportedLanguage } from "../../../src/lib/code-intel/symbols/language-detector";

/**
 * T029 integration tests — the full pipeline (R2 read -> language detection
 * -> real WASM parse -> real IR -> real D1 persistence) exercised end to
 * end, no step mocked. Reuses grammar-provider.ts's own test-injection hooks
 * (same as grammar-provider.test.ts) since Bun's `.wasm?module` resolution
 * differs from the production Nitro path (documented there, not repeated
 * here); an in-memory fake R2 bucket stands in for the ASSETS-unrelated
 * `SNAPSHOTS` binding (Feature 001's `r2-client.ts` reads only bytes given a
 * key, so a plain Map is a faithful double).
 */

function fakeR2Bucket(): R2BucketLike & { seed: (key: string, bytes: Uint8Array) => void } {
  const store = new Map<string, Uint8Array>();
  return {
    seed: (key, bytes) => store.set(key, bytes),
    async get(key) {
      const bytes = store.get(key);
      if (!bytes) return null;
      return { async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; } };
    },
    async put(key, value) {
      if (value instanceof Uint8Array) store.set(key, value);
    },
    async head(key) {
      return store.has(key) ? {} : null;
    },
  };
}

let r2: ReturnType<typeof fakeR2Bucket>;

beforeAll(async () => {
  const ROOT = resolve(import.meta.dir, "../../../node_modules");
  const coreBytes = readFileSync(resolve(ROOT, "web-tree-sitter/tree-sitter.wasm"));
  const coreModule = await WebAssembly.compile(coreBytes);
  setTestCoreWasmModule(coreModule);

  const PUBLIC_WASM = resolve(import.meta.dir, "../../../public/wasm");
  const ASSET_FILE: Record<SupportedLanguage, string> = {
    java: "tree-sitter-java.wasm",
    javascript: "tree-sitter-javascript.wasm",
    typescript: "tree-sitter-typescript.wasm",
    tsx: "tree-sitter-tsx.wasm",
  };
  setTestGrammarBytesSource(async (language) =>
    new Uint8Array(readFileSync(resolve(PUBLIC_WASM, ASSET_FILE[language]))),
  );
});

beforeEach(() => {
  r2 = fakeR2Bucket();
  setTestCloudflareEnv({ SNAPSHOTS: r2 });
});

afterEach(() => {
  setTestCloudflareEnv(undefined);
});

async function seedSnapshot(db: D1DatabaseLike, owner: string) {
  const repositoryId = await getOrCreateRepository({ provider: "github", owner, name: "r" }, db);
  const sha = toCommitSha("a".repeat(40));
  const snapshotId = await createAcquisitionAttempt(repositoryId, sha, "bulk_archive", db);
  return snapshotId;
}

async function seedFile(db: D1DatabaseLike, snapshotId: number, path: string, content: string, r2Key: string) {
  const bytes = new TextEncoder().encode(content);
  await insertSnapshotFile(snapshotId, path, bytes.byteLength, "hash", r2Key, db);
  r2.seed(r2Key, bytes);
  const row = await db.prepare("SELECT * FROM snapshot_files WHERE snapshot_id = ? AND path = ?")
    .bind(snapshotId, path)
    .first<{ id: number; snapshot_id: number; path: string; size_bytes: number; content_hash: string; r2_key: string }>();
  return {
    id: row!.id,
    snapshotId: row!.snapshot_id,
    path: row!.path,
    sizeBytes: row!.size_bytes,
    contentHash: row!.content_hash,
    r2Key: row!.r2_key,
  };
}

describe("extractFile (T029)", () => {
  test("successful extraction: JavaScript file with a function is parsed, directory chain created, symbol persisted", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-a");
    const snapshotFile = await seedFile(db, snapshotId, "src/lib/foo.js", "function foo() { return 1; }\n", "r2/foo.js");

    await extractFile({ snapshotId, snapshotFile, extractorVersion: "v1", db });

    const fe = await db.prepare("SELECT * FROM file_extractions WHERE snapshot_file_id = ?").bind(snapshotFile.id).first<{
      status: string; language: string; extractor_version: string; directory_path: string;
    }>();
    expect(fe?.status).toBe("extracted");
    expect(fe?.language).toBe("javascript");
    expect(fe?.extractor_version).toBe("v1");
    expect(fe?.directory_path).toBe("src/lib");

    const dirs = await db.prepare("SELECT path FROM directories WHERE snapshot_id = ? ORDER BY path").bind(snapshotId).all<{ path: string }>();
    expect(dirs.results?.map((d) => d.path)).toEqual(["", "src", "src/lib"]);

    const symbols = await db.prepare("SELECT kind, name FROM symbols WHERE snapshot_id = ?").bind(snapshotId).all<{ kind: string; name: string }>();
    expect(symbols.results).toEqual([{ kind: "function", name: "foo" }]);
  });

  test("unsupported language: skipped, never reads R2, no symbols", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-b");
    // Note: content is never seeded into R2 for this key — proves getObject was never called.
    const bytes = new TextEncoder().encode("# hello");
    await insertSnapshotFile(snapshotId, "README.md", bytes.byteLength, "hash", "r2/readme-not-seeded", db);
    const row = await db.prepare("SELECT id FROM snapshot_files WHERE snapshot_id = ? AND path = ?").bind(snapshotId, "README.md").first<{ id: number }>();
    const snapshotFile = { id: row!.id, snapshotId, path: "README.md", sizeBytes: bytes.byteLength, contentHash: "hash", r2Key: "r2/readme-not-seeded" };

    await extractFile({ snapshotId, snapshotFile, extractorVersion: "v1", db });

    const fe = await db.prepare("SELECT status, language FROM file_extractions WHERE snapshot_file_id = ?").bind(snapshotFile.id).first<{ status: string; language: string | null }>();
    expect(fe).toEqual({ status: "skipped_unsupported", language: null });
    const symbols = await db.prepare("SELECT * FROM symbols WHERE snapshot_id = ?").bind(snapshotId).all();
    expect(symbols.results?.length).toBe(0);
  });

  test("malformed source: syntax errors recorded as failed, zero symbols, does not throw", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-c");
    const snapshotFile = await seedFile(db, snapshotId, "broken.js", "function ( { [[[ not valid js at all", "r2/broken.js");

    await extractFile({ snapshotId, snapshotFile, extractorVersion: "v1", db }); // must not throw

    const fe = await db.prepare("SELECT status, failure_reason FROM file_extractions WHERE snapshot_file_id = ?").bind(snapshotFile.id).first<{ status: string; failure_reason: string }>();
    expect(fe?.status).toBe("failed");
    expect(fe?.failure_reason).toContain("syntax errors");
    const symbols = await db.prepare("SELECT * FROM symbols WHERE snapshot_id = ?").bind(snapshotId).all();
    expect(symbols.results?.length).toBe(0);
  });

  test("empty file: successfully extracted with zero symbols, not an error", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-d");
    const snapshotFile = await seedFile(db, snapshotId, "empty.js", "", "r2/empty.js");

    await extractFile({ snapshotId, snapshotFile, extractorVersion: "v1", db });

    const fe = await db.prepare("SELECT status FROM file_extractions WHERE snapshot_file_id = ?").bind(snapshotFile.id).first<{ status: string }>();
    expect(fe?.status).toBe("extracted");
    const symbols = await db.prepare("SELECT * FROM symbols WHERE snapshot_id = ?").bind(snapshotId).all();
    expect(symbols.results?.length).toBe(0);
  });

  test("R2 object missing: recorded as failed, does not throw", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-e");
    const bytes = new TextEncoder().encode("function f(){}");
    await insertSnapshotFile(snapshotId, "ghost.js", bytes.byteLength, "hash", "r2/does-not-exist", db);
    const row = await db.prepare("SELECT id FROM snapshot_files WHERE snapshot_id = ? AND path = ?").bind(snapshotId, "ghost.js").first<{ id: number }>();
    const snapshotFile = { id: row!.id, snapshotId, path: "ghost.js", sizeBytes: bytes.byteLength, contentHash: "hash", r2Key: "r2/does-not-exist" };
    // deliberately not seeded into r2

    await extractFile({ snapshotId, snapshotFile, extractorVersion: "v1", db });

    const fe = await db.prepare("SELECT status, failure_reason FROM file_extractions WHERE snapshot_file_id = ?").bind(snapshotFile.id).first<{ status: string; failure_reason: string }>();
    expect(fe?.status).toBe("failed");
    expect(fe?.failure_reason).toContain("R2 object missing");
  });

  test("nested parent/child symbols persist with a real D1 parent_symbol_id, matching T028+T008's approved design end to end", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-f");
    const snapshotFile = await seedFile(db, snapshotId, "widget.js", "class Widget {\n  render() { return 1; }\n}\n", "r2/widget.js");

    await extractFile({ snapshotId, snapshotFile, extractorVersion: "v1", db });

    const rows = await db.prepare("SELECT kind, name, parent_symbol_id, id FROM symbols WHERE snapshot_id = ?").bind(snapshotId).all<{ kind: string; name: string; parent_symbol_id: number | null; id: number }>();
    const cls = rows.results!.find((r) => r.kind === "class")!;
    const method = rows.results!.find((r) => r.kind === "method")!;
    expect(cls.parent_symbol_id).toBeNull();
    expect(method.parent_symbol_id).toBe(cls.id);
  });

  test("re-extraction (calling extractFile twice) replaces the file_extractions row and symbols, no duplication", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-g");
    const snapshotFile = await seedFile(db, snapshotId, "re.js", "function a() {}\n", "r2/re.js");

    await extractFile({ snapshotId, snapshotFile, extractorVersion: "v1", db });
    await extractFile({ snapshotId, snapshotFile, extractorVersion: "v1", db }); // re-extraction, same content

    const feRows = await db.prepare("SELECT * FROM file_extractions WHERE snapshot_file_id = ?").bind(snapshotFile.id).all();
    expect(feRows.results?.length).toBe(1);
    const symbolRows = await db.prepare("SELECT name FROM symbols WHERE snapshot_id = ?").bind(snapshotId).all<{ name: string }>();
    expect(symbolRows.results?.length).toBe(1);
    expect(symbolRows.results![0]!.name).toBe("a");
  });

  test("extractor_version is stamped on both file_extractions and symbols rows", async () => {
    const db = createSqliteD1();
    const snapshotId = await seedSnapshot(db, "owner-h");
    const snapshotFile = await seedFile(db, snapshotId, "v.js", "function v() {}\n", "r2/v.js");

    await extractFile({ snapshotId, snapshotFile, extractorVersion: "v42", db });

    const fe = await db.prepare("SELECT extractor_version FROM file_extractions WHERE snapshot_file_id = ?").bind(snapshotFile.id).first<{ extractor_version: string }>();
    const sym = await db.prepare("SELECT extractor_version FROM symbols WHERE snapshot_id = ?").bind(snapshotId).first<{ extractor_version: string }>();
    expect(fe?.extractor_version).toBe("v42");
    expect(sym?.extractor_version).toBe("v42");
  });
});
