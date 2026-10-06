import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HARNESS_VERSION, REPO_ROOT } from "./common";

function sh(cmd: string[], cwd?: string): string {
  const r = Bun.spawnSync(cmd, {
    cwd,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  return (
    r.stdout.toString() +
    (r.exitCode ? ` [exit ${r.exitCode}] ${r.stderr.toString()}` : "")
  ).trim();
}

/** Static (freezable) + dynamic (per-run) environment record — plan §4, authorization §2. */
export function captureEnvironment() {
  const db = new Database(":memory:");
  const sqliteVersion = (
    db.query("select sqlite_version() as v").get() as { v: string }
  ).v;
  db.close();
  const pkg = JSON.parse(
    readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"),
  );
  const twsVersion = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, "node_modules/web-tree-sitter/package.json"),
      "utf8",
    ),
  ).version;
  const staticPart = {
    os: `${sh(["sw_vers", "-productName"])} ${sh(["sw_vers", "-productVersion"])} (${sh(["sw_vers", "-buildVersion"])}), ${sh(["uname", "-mrs"])}`,
    cpuModel: sh(["sysctl", "-n", "machdep.cpu.brand_string"]),
    physicalCores: Number(sh(["sysctl", "-n", "hw.physicalcpu"])),
    logicalCores: Number(sh(["sysctl", "-n", "hw.logicalcpu"])),
    perfLevels: sh(["sysctl", "-n", "hw.nperflevels"]),
    ramBytes: Number(sh(["sysctl", "-n", "hw.memsize"])),
    storage: sh([
      "bash",
      "-lc",
      "system_profiler SPStorageDataType 2>/dev/null | grep -E 'Device Name|Medium Type' | head -2 | tr '\\n' ' '",
    ]),
    bunVersion: Bun.version,
    bunRevision: Bun.revision,
    nodeVersion: sh(["node", "--version"]),
    typescriptVersion: sh([
      resolve(REPO_ROOT, "node_modules/.bin/tsc"),
      "--version",
    ]),
    webTreeSitterVersion: twsVersion,
    sqliteVersion,
    sqliteDriver: "bun:sqlite (built-in)",
    repoAtlasCommit: sh(["git", "rev-parse", "HEAD"], REPO_ROOT),
    repoAtlasBranch: sh(
      ["git", "rev-parse", "--abbrev-ref", "HEAD"],
      REPO_ROOT,
    ),
    packageName: pkg.name,
    harnessVersion: HARNESS_VERSION,
    workerRuntime:
      "Bun Worker threads (one web-tree-sitter WASM instance + one bun:sqlite connection per worker)",
    sqliteJournalModeDefault:
      "WAL (synchronous=NORMAL, busy_timeout=15000) — recorded variable in M-L3",
    atlasEnv: Object.fromEntries(
      Object.entries(process.env).filter(([k]) =>
        /^(ATLAS_|CODE_INTEL_|NODE_ENV|BUN_)/.test(k),
      ),
    ),
  };
  const dynamicPart = {
    capturedAt: new Date().toISOString(),
    loadAvg: sh(["bash", "-lc", "sysctl -n vm.loadavg"]),
    power: sh(["bash", "-lc", "pmset -g batt | head -2 | tr '\\n' ' '"]),
    thermal: sh(["bash", "-lc", "pmset -g therm 2>&1 | tr '\\n' ' '"]),
    topCpuProcesses: sh([
      "bash",
      "-lc",
      "ps -Ao pcpu,comm -r | head -6 | tail -5 | tr '\\n' ';'",
    ]),
    freeDiskGiB: sh([
      "bash",
      "-lc",
      `df -g ${REPO_ROOT} | tail -1 | awk '{print $4}'`,
    ]),
  };
  const envHash = createHash("sha256")
    .update(JSON.stringify(staticPart))
    .digest("hex")
    .slice(0, 16);
  return { static: staticPart, dynamic: dynamicPart, envHash };
}
