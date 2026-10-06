import type { Database } from "bun:sqlite";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  deriveR2Key,
  hashContent,
} from "../../../src/lib/code-intel/acquisition/content-address";
import {
  toCommitSha,
  type RepositoryIdentity,
} from "../../../src/lib/code-intel/domain/repository-identity";
import { detectLanguage } from "../../../src/lib/code-intel/symbols/language-detector";
import { ensureDir, now, stats } from "./common";

/**
 * LOCAL snapshot acquisition (T007-L03). DEVIATION (recorded): Feature 001's GitHub tar acquisition is NOT used — the
 * approved protocol forbids internet access and the datasets are local git repos. Instead: `git archive <sha>` (read-only
 * against the source repo) → scratch tree → walk → production `hashContent`/`deriveR2Key` (unmodified) → snapshots /
 * snapshot_files rows in the production schema + content-addressed blobs on the local filesystem (R2 stand-in).
 */
export function extractTree(
  gitDir: string,
  commit: string,
  destDir: string,
  pathspec: string[] = [],
): { ms: number } {
  ensureDir(destDir);
  const t = now();
  const r = Bun.spawnSync(
    [
      "bash",
      "-c",
      `git -C "$1" archive "$2" ${pathspec.map((p) => `"${p}"`).join(" ")} | tar -x -C "$3"`,
      "_",
      gitDir,
      commit,
      destDir,
    ],
    { env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } },
  );
  if (r.exitCode !== 0)
    throw new Error(`git archive failed: ${r.stderr.toString()}`);
  return { ms: now() - t };
}

export function walkTree(root: string): {
  files: string[];
  skippedSymlinks: number;
} {
  const files: string[] = [];
  let skippedSymlinks = 0;
  const rec = (rel: string) => {
    const entries = readdirSync(join(root, rel), { withFileTypes: true }).sort(
      (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    );
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      const st = lstatSync(join(root, r));
      if (st.isSymbolicLink()) skippedSymlinks++;
      else if (st.isDirectory()) rec(r);
      else if (st.isFile()) files.push(r);
    }
  };
  rec("");
  return { files, skippedSymlinks };
}

export type IngestResult = {
  snapshotId: number;
  repositoryId: number;
  fileCount: number;
  totalBytes: number;
  skippedSymlinks: number;
  walkMs: number;
  hashMs: number;
  blobWriteMs: number;
  dbMs: number;
  totalMs: number;
};

export async function ingestLocalSnapshot(
  db: Database,
  o: {
    treeDir: string;
    blobsDir: string;
    identity: RepositoryIdentity;
    commitSha: string;
  },
): Promise<IngestResult> {
  const t0 = now();
  const { files, skippedSymlinks } = walkTree(o.treeDir);
  const walkMs = now() - t0;
  ensureDir(o.blobsDir);
  const commit = toCommitSha(o.commitSha);
  let hashMs = 0,
    blobWriteMs = 0,
    totalBytes = 0;
  const rows: { path: string; size: number; hash: string; key: string }[] = [];
  for (const path of files) {
    const bytes = new Uint8Array(readFileSync(resolve(o.treeDir, path)));
    const th = now();
    const hash = await hashContent(bytes);
    hashMs += now() - th;
    const bp = resolve(o.blobsDir, hash);
    const tw = now();
    if (!existsSync(bp)) writeFileSync(bp, bytes);
    blobWriteMs += now() - tw;
    totalBytes += bytes.length;
    rows.push({
      path,
      size: bytes.length,
      hash,
      key: deriveR2Key(o.identity, commit, hash),
    });
  }
  const td = now();
  const nowIso = new Date().toISOString();
  db.exec("BEGIN");
  db.query(
    "INSERT INTO repositories (provider, owner, name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (provider, owner, name) DO NOTHING",
  ).run(o.identity.provider, o.identity.owner, o.identity.name, nowIso);
  const repositoryId = (
    db
      .query(
        "SELECT id FROM repositories WHERE provider=? AND owner=? AND name=?",
      )
      .get(o.identity.provider, o.identity.owner, o.identity.name) as {
      id: number;
    }
  ).id;
  const attempt =
    (
      db
        .query(
          "SELECT COALESCE(MAX(attempt_number),0) n FROM snapshots WHERE repository_id=? AND commit_sha=?",
        )
        .get(repositoryId, commit) as { n: number }
    ).n + 1;
  const snapshotId = Number(
    db
      .query(
        "INSERT INTO snapshots (repository_id, commit_sha, attempt_number, status, acquisition_mode, provider_endpoint, created_at, completed_at) VALUES (?, ?, ?, 'completed', 'bulk_archive', 'local-git-archive', ?, ?)",
      )
      .run(repositoryId, commit, attempt, nowIso, nowIso).lastInsertRowid,
  );
  const ins = db.query(
    "INSERT INTO snapshot_files (snapshot_id, path, size_bytes, content_hash, r2_key) VALUES (?, ?, ?, ?, ?)",
  );
  for (const r of rows) ins.run(snapshotId, r.path, r.size, r.hash, r.key);
  db.exec("COMMIT");
  return {
    snapshotId,
    repositoryId,
    fileCount: rows.length,
    totalBytes,
    skippedSymlinks,
    walkMs,
    hashMs,
    blobWriteMs,
    dbMs: now() - td,
    totalMs: now() - t0,
  };
}

/** Dataset inventory from an ingested snapshot (authorization §4/§15: file count, source count, language mix, bytes, size distribution). */
export function datasetInventory(db: Database, snapshotId: number) {
  const rows = db
    .query("SELECT path, size_bytes FROM snapshot_files WHERE snapshot_id=?")
    .all(snapshotId) as { path: string; size_bytes: number }[];
  const byExt: Record<string, { files: number; bytes: number }> = {};
  const byLang: Record<string, { files: number; bytes: number }> = {};
  const tier1Sizes: number[] = [];
  let tier1 = 0,
    tier1Bytes = 0,
    totalBytes = 0;
  for (const r of rows) {
    totalBytes += r.size_bytes;
    const dot = r.path.lastIndexOf(".");
    const ext =
      dot > r.path.lastIndexOf("/")
        ? r.path.slice(dot + 1).toLowerCase()
        : "(none)";
    (byExt[ext] ??= { files: 0, bytes: 0 }).files++;
    byExt[ext]!.bytes += r.size_bytes;
    const lang = detectLanguage(r.path);
    if (lang) {
      tier1++;
      tier1Bytes += r.size_bytes;
      tier1Sizes.push(r.size_bytes);
      (byLang[lang] ??= { files: 0, bytes: 0 }).files++;
      byLang[lang]!.bytes += r.size_bytes;
    }
  }
  const buckets = [
    4096,
    16384,
    65536,
    262144,
    524288,
    1048576,
    4194304,
    10485760,
    Infinity,
  ];
  const hist = buckets.map((b, i) => ({
    upToBytes: b === Infinity ? "inf" : b,
    files: tier1Sizes.filter((s) => s > (buckets[i - 1] ?? -1) && s <= b)
      .length,
  }));
  const topExt = Object.entries(byExt)
    .sort((a, b) => b[1].files - a[1].files)
    .slice(0, 12);
  const jsTs = ["javascript", "typescript", "tsx"].reduce(
    (a, l) => a + (byLang[l]?.files ?? 0),
    0,
  );
  return {
    totalFiles: rows.length,
    totalBytes,
    tier1Files: tier1,
    tier1Bytes,
    tier1ByLanguage: byLang,
    topExtensions: Object.fromEntries(topExt),
    javaShareOfTier1: tier1 ? (byLang["java"]?.files ?? 0) / tier1 : 0,
    jsTsShareOfTier1: tier1 ? jsTs / tier1 : 0,
    tier1SizeStats: stats(tier1Sizes),
    tier1SizeHistogram: hist,
  };
}
