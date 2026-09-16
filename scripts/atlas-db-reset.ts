import { existsSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env["ATLAS_DB_RESET"] !== "1") {
  console.error("Refusing to reset database. Set ATLAS_DB_RESET=1 to confirm.");
  process.exit(1);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = resolve(repoRoot, process.env["ATLAS_SQLITE_PATH"] ?? "./data/atlas.sqlite");
const walPath = `${dbPath}-wal`;
const shmPath = `${dbPath}-shm`;

for (const path of [dbPath, walPath, shmPath]) {
  if (existsSync(path)) {
    unlinkSync(path);
    console.log(`deleted ${path}`);
  }
}

console.log("SQLite cache cleared.");
