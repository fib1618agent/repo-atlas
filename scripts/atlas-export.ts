import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = resolve(repoRoot, process.env["ATLAS_SQLITE_PATH"] ?? "./data/atlas.sqlite");
const exportPath = resolve(repoRoot, "data/atlas-export.json");

if (!existsSync(dbPath)) {
  console.error(
    `No SQLite cache at ${dbPath}. Run bun run db:init and load sources in the app first.`,
  );
  process.exit(1);
}

const { Database } = await import("bun:sqlite");
const db = new Database(dbPath, { readonly: true });

const sourceRows = db
  .query("SELECT url, login, kind, added_at FROM sources ORDER BY id")
  .all() as { url: string; login: string; kind: string; added_at: string }[];

const repoRows = db
  .query("SELECT source_key, payload_json FROM repositories ORDER BY source_key, id")
  .all() as { source_key: string; payload_json: string }[];

const metaRows = db
  .query("SELECT key, value FROM meta WHERE key LIKE 'response:%'")
  .all() as { key: string; value: string }[];

db.close();

const repositories = repoRows.map((row) => JSON.parse(row.payload_json));
const sourceKeys = [...new Set(repoRows.map((row) => row.source_key))];
const responseMeta = metaRows.map((row) => {
  try {
    return { key: row.key, entry: JSON.parse(row.value) };
  } catch {
    return { key: row.key, entry: null };
  }
});

const payload = {
  exportedAt: new Date().toISOString(),
  dbPath,
  sourceKeys,
  sources: sourceRows,
  count: repositories.length,
  repositories,
  responseCache: responseMeta,
};

if (repositories.length === 0) {
  console.log("cache empty");
}

writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(resolve(exportPath));
