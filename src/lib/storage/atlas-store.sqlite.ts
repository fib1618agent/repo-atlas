import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Repository } from "../repositories";
import { serverAtlasConfig } from "../atlas-config";
import type { AtlasCache, CachedRepositoriesResponse, SourceRow } from "./atlas-store";

type ResponseCacheEntry = {
  expiresAt: number;
  payload: CachedRepositoriesResponse;
};

const RESPONSE_META_PREFIX = "response:";

function responseMetaKey(sourceKey: string): string {
  return `${RESPONSE_META_PREFIX}${sourceKey}`;
}

function schemaPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "../../../data/schema.sql");
}

function cacheTtlMs(): number {
  return serverAtlasConfig().cacheTtlMs;
}

type SqliteDatabase = import("bun:sqlite").Database;

export class FileSqliteAtlasCache implements AtlasCache {
  private readonly db: SqliteDatabase;

  private constructor(db: SqliteDatabase) {
    this.db = db;
  }

  static async open(dbPath: string): Promise<FileSqliteAtlasCache> {
    const { Database } = await import("bun:sqlite");
    const db = new Database(dbPath, { create: true });
    db.exec(readFileSync(schemaPath(), "utf8"));
    return new FileSqliteAtlasCache(db);
  }

  getSources(): SourceRow[] {
    const rows = this.db
      .query("SELECT url, login, kind, added_at FROM sources ORDER BY id")
      .all() as { url: string; login: string; kind: string; added_at: string }[];

    return rows.map((row) => ({
      url: row.url,
      login: row.login,
      kind: row.kind as SourceRow["kind"],
      addedAt: row.added_at,
    }));
  }

  replaceSources(rows: SourceRow[]): void {
    this.db.run("DELETE FROM sources");
    const insert = this.db.prepare(
      "INSERT INTO sources (url, login, kind, added_at) VALUES (?, ?, ?, ?)",
    );
    const tx = this.db.transaction(() => {
      for (const row of rows) {
        insert.run(row.url, row.login, row.kind, row.addedAt);
      }
    });
    tx();
  }

  getRepositories(sourceKey: string): { repositories: Repository[]; fetchedAt: number } | null {
    const meta = this.readResponseMeta(sourceKey);
    if (meta) {
      return {
        repositories: meta.payload.repositories,
        fetchedAt: meta.expiresAt - cacheTtlMs(),
      };
    }

    const rows = this.db
      .query(
        "SELECT payload_json, fetched_at FROM repositories WHERE source_key = ? ORDER BY id",
      )
      .all(sourceKey) as { payload_json: string; fetched_at: string }[];

    if (rows.length === 0) return null;

    const fetchedAt = Date.parse(rows[0]!.fetched_at);
    if (Number.isNaN(fetchedAt) || Date.now() - fetchedAt > cacheTtlMs()) {
      return null;
    }

    return {
      repositories: rows.map((row) => JSON.parse(row.payload_json) as Repository),
      fetchedAt,
    };
  }

  putRepositories(sourceKey: string, repositories: Repository[]): void {
    const fetchedAt = new Date().toISOString();
    const deleteStmt = this.db.prepare("DELETE FROM repositories WHERE source_key = ?");
    const insertStmt = this.db.prepare(
      "INSERT INTO repositories (id, source_id, source_key, full_name, payload_json, fetched_at) VALUES (?, ?, ?, ?, ?, ?)",
    );

    const tx = this.db.transaction(() => {
      deleteStmt.run(sourceKey);
      for (const repo of repositories) {
        const sourceId = this.ensureSourceForRepo(repo);
        insertStmt.run(repo.id, sourceId, sourceKey, repo.fullName, JSON.stringify(repo), fetchedAt);
      }
    });
    tx();
  }

  getCachedResponse(sourceKey: string): CachedRepositoriesResponse | null {
    const entry = this.readResponseMeta(sourceKey);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) this.db.run("DELETE FROM meta WHERE key = ?", responseMetaKey(sourceKey));
      return null;
    }
    return { ...entry.payload, source: "cache" };
  }

  putCachedResponse(sourceKey: string, response: CachedRepositoriesResponse): void {
    const entry: ResponseCacheEntry = {
      expiresAt: Date.now() + cacheTtlMs(),
      payload: response,
    };
    this.db.run(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      responseMetaKey(sourceKey),
      JSON.stringify(entry),
    );
    this.putRepositories(sourceKey, response.repositories);
    this.syncSourcesFromRepositories(response.repositories);
  }

  private readResponseMeta(sourceKey: string): ResponseCacheEntry | null {
    const row = this.db
      .query("SELECT value FROM meta WHERE key = ?")
      .get(responseMetaKey(sourceKey)) as { value: string } | null;
    if (!row) return null;
    try {
      return JSON.parse(row.value) as ResponseCacheEntry;
    } catch {
      return null;
    }
  }

  private syncSourcesFromRepositories(repositories: Repository[]): void {
    const seen = new Map<string, SourceRow>();
    for (const repo of repositories) {
      const login = repo.sourceLogin ?? repo.fullName.split("/")[0] ?? "unknown";
      const kind = repo.sourceKind ?? "user";
      const url = repo.sourceUrl ?? `https://github.com/${login}`;
      if (!seen.has(login)) {
        seen.set(login, {
          url,
          login,
          kind,
          addedAt: new Date().toISOString(),
        });
      }
    }
    this.replaceSources([...seen.values()]);
  }

  private ensureSourceForRepo(repo: Repository): number {
    const login = repo.sourceLogin ?? repo.fullName.split("/")[0] ?? "unknown";
    const kind = repo.sourceKind ?? "user";
    const url = repo.sourceUrl ?? `https://github.com/${login}`;
    const existing = this.db
      .query("SELECT id FROM sources WHERE login = ?")
      .get(login) as { id: number } | null;
    if (existing) return existing.id;

    const result = this.db
      .prepare("INSERT INTO sources (url, login, kind, added_at) VALUES (?, ?, ?, ?)")
      .run(url, login, kind, new Date().toISOString());
    return Number(result.lastInsertRowid);
  }
}
