import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createScratchDb } from "./lib/db";
import { arg, ensureDir, writeEvidence } from "./lib/common";
import { BLOBS, DATASETS, dsDir } from "./lib/datasets";
import {
  datasetInventory,
  extractTree,
  ingestLocalSnapshot,
} from "./lib/snapshot";

/** T007-L03: local snapshots + dataset inventory + qualification. Read-only against source repos (git archive). */
const only = arg("only");
const out: Record<string, unknown> = {};
for (const d of DATASETS.filter((x) => !only || x.name === only)) {
  const dir = dsDir(d.name);
  rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
  const ex = extractTree(d.gitDir, d.commit, resolve(dir, "tree"), d.pathspec);
  const dbPath = resolve(dir, "template.db");
  const db = createScratchDb(dbPath);
  const ing = await ingestLocalSnapshot(db, {
    treeDir: resolve(dir, "tree"),
    blobsDir: BLOBS,
    identity: { provider: "github", owner: d.owner, name: d.repo },
    commitSha: d.commit,
  });
  const inv = datasetInventory(db, ing.snapshotId);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  const tier1 = inv.tier1Files;
  const qualification =
    d.tier === "R-L"
      ? {
          rule: "plan §5.1/§5.2: Tier-1 files within 1,000–5,000 AND dominant-language share ≥ 70% of Tier-1 files",
          tier1InRange: tier1 >= 1000 && tier1 <= 5000,
          rawTrackedFilesInRange:
            inv.totalFiles >= 1000 && inv.totalFiles <= 5000,
          dominantShare: d.role.startsWith("Java")
            ? inv.javaShareOfTier1
            : inv.jsTsShareOfTier1,
          dominantOk:
            (d.role.startsWith("Java")
              ? inv.javaShareOfTier1
              : inv.jsTsShareOfTier1) >= 0.7,
        }
      : {
          rule:
            d.tier === "R-M" ? "100–1,000 Tier-1 files" : "≤ 100 Tier-1 files",
          ok: d.tier === "R-M" ? tier1 >= 100 && tier1 <= 1000 : tier1 <= 100,
        };
  out[d.name] = {
    def: { ...d, gitDir: d.gitDir.replace(/^\/Users\/[^/]+/, "~") },
    extractMs: ex.ms,
    ingest: ing,
    inventory: inv,
    qualification,
  };
  console.log(
    d.name,
    JSON.stringify({
      files: inv.totalFiles,
      tier1,
      byLang: inv.tier1ByLanguage,
      qualification,
      ingestMs: Math.round(ing.totalMs),
    }),
  );
}
if (!only)
  writeEvidence("dataset-inventory.json", {
    capturedAt: new Date().toISOString(),
    datasets: out,
  });
