import { resolve } from "node:path";
import { REF_ROOT, REPO_ROOT, SCRATCH } from "./common";

export type DatasetDef = {
  name: string;
  tier: "R-S" | "R-M" | "R-L";
  role: string;
  gitDir: string;
  commit: string;
  pathspec: string[];
  owner: string;
  repo: string;
};
const sh = (dir: string, ...a: string[]) =>
  Bun.spawnSync(["git", "-C", dir, ...a], {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  })
    .stdout.toString()
    .trim();
const IATA =
  "/Users/imdadareeph/Documents/dev/git/johndoetechguy/iata-one-order";

/** Datasets frozen for this execution (authorization §4). Commits are pinned to SHAs recorded at S-L1. */
export const DATASETS: DatasetDef[] = [
  {
    name: "repo-atlas-rm",
    tier: "R-M",
    role: "approved real repository (primary scale gate)",
    gitDir: REPO_ROOT,
    commit: "430e1703386ebd9264122d54a3ba398d43b363f9",
    pathspec: [],
    owner: "local",
    repo: "repo-atlas",
  },
  {
    name: "repo-atlas-rs",
    tier: "R-S",
    role: "real-repository subset (src/lib of repo-atlas @ same commit)",
    gitDir: REPO_ROOT,
    commit: "430e1703386ebd9264122d54a3ba398d43b363f9",
    pathspec: ["src/lib"],
    owner: "local",
    repo: "repo-atlas-src-lib",
  },
  {
    name: "gitnexus-rl",
    tier: "R-L",
    role: "JS/TS-dominant R-L candidate (reference repo, read-only)",
    gitDir: resolve(REF_ROOT, "GitNexus"),
    commit: "233ca28492f5dd8957425e273779f1571cd45035",
    pathspec: [],
    owner: "ref",
    repo: "GitNexus",
  },
  {
    name: "iata-rl",
    tier: "R-L",
    role: "Java-dominant R-L candidate (owner's local repo, read-only)",
    gitDir: IATA,
    commit: "a686149cbd00f8186022030d687aed4d8efdb3be",
    pathspec: [],
    owner: "local",
    repo: "iata-one-order",
  },
];
export const dsDir = (name: string) => resolve(SCRATCH, "datasets", name);
export const BLOBS = resolve(SCRATCH, "blobs");
export const currentHead = (d: DatasetDef) => sh(d.gitDir, "rev-parse", "HEAD");
