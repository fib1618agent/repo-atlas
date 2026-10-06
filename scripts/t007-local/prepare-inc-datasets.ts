/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { REPO_ROOT, SCRATCH, ensureDir, writeEvidence } from "./lib/common";
import { createScratchDb } from "./lib/db";
import { BLOBS, dsDir } from "./lib/datasets";
import { datasetInventory, extractTree, ingestLocalSnapshot } from "./lib/snapshot";

/**
 * T007-L0? (M-L6 prep): a real content edit committed to a SCRATCH CLONE of repo-atlas (plan §5.3 —
 * "never a fabricated DB state"). Never touches the working repo-atlas checkout; the scratch clone lives under
 * .cache/t007-local/inc-repo (git-ignored). Produces two new commits: C2 (1 file changed) and C3 (~10% of the
 * R-M Tier-1 files changed), each git-archived and ingested as its own snapshot exactly like prepare-datasets.ts.
 */
const BASE_COMMIT = "430e1703386ebd9264122d54a3ba398d43b363f9"; // same commit as repo-atlas-rm/rs
const SCRATCH_REPO = resolve(SCRATCH, "inc-repo");
const sh = (...a: string[]) =>
  Bun.spawnSync(["git", "-C", SCRATCH_REPO, ...a], {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
const shOut = (...a: string[]) => sh(...a).stdout.toString().trim();

function walkTier1(root: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(root, rel), { withFileTypes: true }).sort(
    (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  )) {
    if (e.name === ".git" || e.name === "node_modules") continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walkTier1(root, r));
    else if (/\.(ts|tsx|js|java)$/.test(e.name)) out.push(r);
  }
  return out;
}

function markEdit(scratchTree: string, path: string, tag: string) {
  const p = resolve(scratchTree, path);
  const content = readFileSync(p, "utf8");
  writeFileSync(p, content + `\n// T007-LOCAL M-L6 ${tag} scratch content edit\n`);
}

// 1. Fresh scratch clone (local, hardlinked; never the working tree) pinned to the R-M commit.
if (!existsSync(SCRATCH_REPO)) {
  const r = Bun.spawnSync(["git", "clone", "--quiet", REPO_ROOT, SCRATCH_REPO]);
  if (r.exitCode !== 0) throw new Error(`clone failed: ${r.stderr.toString()}`);
}
{
  const r = sh("checkout", "-f", BASE_COMMIT);
  if (r.exitCode !== 0) throw new Error(`checkout failed: ${r.stderr.toString()}`);
  sh("clean", "-fdx", "src"); // in case a prior aborted run left edits
}
const headAtBase = shOut("rev-parse", "HEAD");
if (headAtBase !== BASE_COMMIT)
  throw new Error(`scratch clone not pinned: ${headAtBase} != ${BASE_COMMIT}`);

// Enumerate the SAME Tier-1 file population the R-M dataset used (src/ + top-level), for edit selection only.
const allTier1 = walkTier1(SCRATCH_REPO).filter((p) => !p.startsWith(".cache"));

// 2. INC-2: exactly one real file, one line appended.
sh("config", "user.email", "t007-local@localhost");
sh("config", "user.name", "T007-LOCAL harness");
const oneFile = "src/lib/atlas-config.ts";
if (!allTier1.includes(oneFile)) throw new Error(`INC-2 target file missing: ${oneFile}`);
markEdit(SCRATCH_REPO, oneFile, "INC-2");
sh("add", "-A");
sh("commit", "-q", "-m", "T007-LOCAL M-L6 INC-2 scratch edit (1 file)");
const commitInc2 = shOut("rev-parse", "HEAD");

// 3. INC-3: reset to the base commit, then edit ~10% of the Tier-1 population (every 10th file, deterministic).
sh("reset", "-q", "--hard", BASE_COMMIT);
const tenPct = allTier1.filter((_, i) => i % 10 === 0);
for (const f of tenPct) markEdit(SCRATCH_REPO, f, "INC-3");
sh("add", "-A");
sh("commit", "-q", "-m", `T007-LOCAL M-L6 INC-3 scratch edit (${tenPct.length} files, ~10% of Tier-1)`);
const commitInc3 = shOut("rev-parse", "HEAD");

console.log(
  JSON.stringify({
    scratchRepo: SCRATCH_REPO.replace(/^\/Users\/[^/]+/, "~"),
    baseCommit: BASE_COMMIT,
    inc2: { commit: commitInc2, filesChanged: 1, file: oneFile },
    inc3: { commit: commitInc3, filesChanged: tenPct.length, totalTier1: allTier1.length, pct: tenPct.length / allTier1.length },
  }),
);

// 4. Git-archive + ingest each changed commit as its own dataset template (same mechanism as prepare-datasets.ts).
const out: Record<string, unknown> = {};
for (const [name, commit] of [
  ["repo-atlas-inc2", commitInc2],
  ["repo-atlas-inc3", commitInc3],
] as const) {
  const dir = dsDir(name);
  ensureDir(dir);
  const ex = extractTree(SCRATCH_REPO, commit, resolve(dir, "tree"));
  const dbPath = resolve(dir, "template.db");
  const db = createScratchDb(dbPath);
  const ing = await ingestLocalSnapshot(db, {
    treeDir: resolve(dir, "tree"),
    blobsDir: BLOBS,
    identity: { provider: "github", owner: "local", name: name },
    commitSha: commit,
  });
  const inv = datasetInventory(db, ing.snapshotId);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  out[name] = { commit, extractMs: ex.ms, ingest: ing, inventory: inv };
  console.log(name, JSON.stringify({ tier1: inv.tier1Files, files: inv.totalFiles }));
}
writeEvidence("m-l6-inc-dataset-inventory.json", {
  capturedAt: new Date().toISOString(),
  baseCommit: BASE_COMMIT,
  inc2: { commit: commitInc2, filesChanged: 1, file: oneFile },
  inc3: { commit: commitInc3, filesChanged: tenPct.length, changedFiles: tenPct },
  datasets: out,
});
