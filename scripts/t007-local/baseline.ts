import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { REF_ROOT, REPO_ROOT, readEvidence, writeEvidence } from "./lib/common";

/** Isolation baseline / check (authorization §5, S-L1 step 3–4): production data + source untouched, reference repos untouched. */
const sh = (dir: string, ...a: string[]) =>
  Bun.spawnSync(["git", "-C", dir, ...a], {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  })
    .stdout.toString()
    .trim();
export function snapshotIsolation() {
  const hashDir = (d: string) =>
    Object.fromEntries(
      readdirSync(resolve(REPO_ROOT, d))
        .sort()
        .map((f) => [
          `${d}/${f}`,
          createHash("sha256")
            .update(readFileSync(resolve(REPO_ROOT, d, f)))
            .digest("hex")
            .slice(0, 16),
        ]),
    );
  const refs: Record<string, unknown> = {};
  for (const r of ["GitNexus", "graphify", "codegraph"]) {
    const d = resolve(REF_ROOT, r);
    refs[r] = {
      head: sh(d, "rev-parse", "HEAD"),
      porcelainLines: sh(d, "status", "--porcelain").split("\n").filter(Boolean)
        .length,
      indexMtime: statSync(resolve(d, ".git/index")).mtimeMs,
      indexSize: statSync(resolve(d, ".git/index")).size,
    };
  }
  const iata =
    "/Users/imdadareeph/Documents/dev/git/johndoetechguy/iata-one-order";
  refs["iata-one-order"] = {
    head: sh(iata, "rev-parse", "HEAD"),
    porcelainLines: sh(iata, "status", "--porcelain")
      .split("\n")
      .filter(Boolean).length,
    indexMtime: statSync(resolve(iata, ".git/index")).mtimeMs,
  };
  const tracked = sh(
    REPO_ROOT,
    "status",
    "--porcelain",
    "--",
    "src",
    "tests",
    "data",
    "public",
    "package.json",
    "bun.lock",
    "wrangler.toml",
    "vite.config.ts",
  )
    .split("\n")
    .filter(Boolean);
  return {
    data: hashDir("data"),
    srcTestsDataPublicPorcelain: tracked,
    refs,
    repoHead: sh(REPO_ROOT, "rev-parse", "HEAD"),
  };
}
if (import.meta.main) {
  if (process.argv.includes("--record")) {
    writeEvidence("isolation-baseline.json", {
      at: new Date().toISOString(),
      ...snapshotIsolation(),
    });
    console.log("baseline recorded");
  } else console.log(JSON.stringify(snapshotIsolation(), null, 1));
}
