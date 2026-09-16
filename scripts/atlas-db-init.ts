import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(repoRoot, "data");
const schemaPath = resolve(dataDir, "schema.sql");
const dbPath = resolve(repoRoot, process.env["ATLAS_SQLITE_PATH"] ?? "./data/atlas.sqlite");

mkdirSync(dirname(dbPath), { recursive: true });
mkdirSync(dataDir, { recursive: true });

const { Database } = await import("bun:sqlite");
const db = new Database(dbPath, { create: true });
db.exec(readFileSync(schemaPath, "utf8"));
db.close();

console.log(resolve(dbPath));
