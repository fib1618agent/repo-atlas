import type { Repository } from "../repositories";
import { serverAtlasConfig } from "../atlas-config";

export type SourceRow = {
  url: string;
  login: string;
  kind: "user" | "org" | "repo";
  addedAt: string;
};

/** Cached server response shape (mirrors repositories.functions.ts). */
export type CachedRepositoriesResponse = {
  repositories: Repository[];
  source: "live" | "cache" | "fallback";
  sourceKey: string;
  isDefault: boolean;
  warnings: { code: string; message: string }[];
  meta: {
    requested: number;
    fetched: number;
    spiralCap: number;
    storedCap: number;
    rateLimitRemaining?: number;
  };
};

type ResponseCacheEntry = {
  expiresAt: number;
  payload: CachedRepositoriesResponse;
};

export interface AtlasCache {
  getSources(): SourceRow[];
  replaceSources(rows: SourceRow[]): void;
  getRepositories(sourceKey: string): { repositories: Repository[]; fetchedAt: number } | null;
  putRepositories(sourceKey: string, repositories: Repository[]): void;
  getCachedResponse(sourceKey: string): CachedRepositoriesResponse | null;
  putCachedResponse(sourceKey: string, response: CachedRepositoriesResponse): void;
}

const DEFAULT_SQLITE_PATH = "./data/atlas.sqlite";

export function getSqlitePath(): string {
  return process.env["ATLAS_SQLITE_PATH"] ?? DEFAULT_SQLITE_PATH;
}

export function canUseSqlite(): boolean {
  if (process.env["ATLAS_SQLITE_ENABLED"] === "false") return false;
  if (!process.env["ATLAS_SQLITE_PATH"]) return false;
  if (process.env["NITRO_PRESET"] === "cloudflare-module") return false;
  if (process.env["CF_PAGES"]) return false;
  if (typeof process === "undefined" || !process.versions?.node) return false;
  return true;
}

function cacheTtlMs(): number {
  return serverAtlasConfig().cacheTtlMs;
}

export class MemoryAtlasCache implements AtlasCache {
  private sources: SourceRow[] = [];
  private repositoriesByKey = new Map<string, { repositories: Repository[]; fetchedAt: number }>();
  private responseCache = new Map<string, ResponseCacheEntry>();

  getSources(): SourceRow[] {
    return [...this.sources];
  }

  replaceSources(rows: SourceRow[]): void {
    this.sources = [...rows];
  }

  getRepositories(sourceKey: string): { repositories: Repository[]; fetchedAt: number } | null {
    const entry = this.repositoriesByKey.get(sourceKey);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > cacheTtlMs()) {
      this.repositoriesByKey.delete(sourceKey);
      return null;
    }
    return entry;
  }

  putRepositories(sourceKey: string, repositories: Repository[]): void {
    this.repositoriesByKey.set(sourceKey, {
      repositories,
      fetchedAt: Date.now(),
    });
  }

  getCachedResponse(sourceKey: string): CachedRepositoriesResponse | null {
    const entry = this.responseCache.get(sourceKey);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.responseCache.delete(sourceKey);
      return null;
    }
    return { ...entry.payload, source: "cache" };
  }

  putCachedResponse(sourceKey: string, response: CachedRepositoriesResponse): void {
    this.responseCache.set(sourceKey, {
      expiresAt: Date.now() + cacheTtlMs(),
      payload: response,
    });
    this.putRepositories(sourceKey, response.repositories);
  }
}

class CompositeAtlasCache implements AtlasCache {
  constructor(
    private readonly memory: MemoryAtlasCache,
    private readonly sqlite: AtlasCache,
  ) {}

  getSources(): SourceRow[] {
    const sqliteSources = this.sqlite.getSources();
    if (sqliteSources.length > 0) {
      this.memory.replaceSources(sqliteSources);
      return sqliteSources;
    }
    return this.memory.getSources();
  }

  replaceSources(rows: SourceRow[]): void {
    this.memory.replaceSources(rows);
    this.sqlite.replaceSources(rows);
  }

  getRepositories(sourceKey: string): { repositories: Repository[]; fetchedAt: number } | null {
    const memoryHit = this.memory.getRepositories(sourceKey);
    if (memoryHit) return memoryHit;

    const sqliteHit = this.sqlite.getRepositories(sourceKey);
    if (sqliteHit) {
      this.memory.putRepositories(sourceKey, sqliteHit.repositories);
      return sqliteHit;
    }
    return null;
  }

  putRepositories(sourceKey: string, repositories: Repository[]): void {
    this.memory.putRepositories(sourceKey, repositories);
    this.sqlite.putRepositories(sourceKey, repositories);
  }

  getCachedResponse(sourceKey: string): CachedRepositoriesResponse | null {
    const memoryHit = this.memory.getCachedResponse(sourceKey);
    if (memoryHit) return memoryHit;

    const sqliteHit = this.sqlite.getCachedResponse(sourceKey);
    if (sqliteHit) {
      this.memory.putCachedResponse(sourceKey, { ...sqliteHit, source: sqliteHit.source === "cache" ? "live" : sqliteHit.source });
      return this.memory.getCachedResponse(sourceKey);
    }
    return null;
  }

  putCachedResponse(sourceKey: string, response: CachedRepositoriesResponse): void {
    this.memory.putCachedResponse(sourceKey, response);
    this.sqlite.putCachedResponse(sourceKey, response);
  }
}

export async function createAtlasCache(): Promise<AtlasCache> {
  const memory = new MemoryAtlasCache();
  if (!canUseSqlite()) {
    return memory;
  }

  try {
    const { FileSqliteAtlasCache } = await import("./atlas-store.sqlite");
    const sqlite = await FileSqliteAtlasCache.open(getSqlitePath());
    return new CompositeAtlasCache(memory, sqlite);
  } catch (error) {
    console.error("SQLITE_OPEN_FAILED", error);
    return memory;
  }
}

let atlasCacheSingleton: AtlasCache | null = null;
let atlasCacheInit: Promise<AtlasCache> | null = null;

/** Process-local singleton; memory L1 with optional SQLite L2. */
export async function getAtlasCache(): Promise<AtlasCache> {
  if (atlasCacheSingleton) return atlasCacheSingleton;
  if (!atlasCacheInit) {
    atlasCacheInit = createAtlasCache().then((cache) => {
      atlasCacheSingleton = cache;
      return cache;
    });
  }
  return atlasCacheInit;
}
