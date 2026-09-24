import { createServerFn } from "@tanstack/react-start";
import fallbackData from "./repositories-fallback.json";
import { normalizeRepository, type Repository } from "./repositories";
import {
  AtlasError,
  atlasErrorMessage,
  isAtlasError,
  serializeAtlasError,
  type SourceFailure,
} from "./atlas-errors";
import { serverAtlasConfig, type InitialSourceEntry } from "./atlas-config";
import { parseSourceInputs, sourceKeyFromParsed } from "./github-url";
import { fetchCustomRepositories, fetchDefaultOwnerRepositories } from "./github-fetch";
import { getAtlasCache, type CachedRepositoriesResponse } from "./storage/atlas-store";

type RawRepository = Omit<Repository, "category" | "subgroup" | "importance">;

export type RepositoriesResponse = {
  repositories: Repository[];
  source: "live" | "cache" | "fallback" | "not_loaded";
  sourceKey: string;
  isDefault: boolean;
  warnings: { code: string; message: string }[];
  meta: {
    requested: number;
    fetched: number;
    spiralCap: number;
    storedCap: number;
    rateLimitRemaining?: number;
    sourceFailures?: SourceFailure[];
  };
};

function buildDefaultResponse(repositories: Repository[], source: "live" | "fallback"): RepositoriesResponse {
  const config = serverAtlasConfig();
  return {
    repositories,
    source,
    sourceKey: config.defaultOwner,
    isDefault: true,
    warnings: [],
    meta: {
      requested: 1,
      fetched: repositories.length,
      spiralCap: config.maxSpiralRepos,
      storedCap: config.maxStoredRepos,
    },
  };
}

async function getCached(sourceKey: string): Promise<RepositoriesResponse | undefined> {
  const cache = await getAtlasCache();
  const hit = cache.getCachedResponse(sourceKey);
  return hit ?? undefined;
}

async function setCache(sourceKey: string, payload: RepositoriesResponse): Promise<void> {
  const cache = await getAtlasCache();
  cache.putCachedResponse(sourceKey, payload as CachedRepositoriesResponse);
}

function normalizeSources(sources?: string[]): string[] {
  return (sources ?? []).map((s) => s.trim()).filter(Boolean);
}

function rethrowSerialized(error: AtlasError): never {
  throw new Error(JSON.stringify(serializeAtlasError(error)));
}

function notLoadedResponse(): RepositoriesResponse {
  const config = serverAtlasConfig();
  return {
    repositories: [],
    source: "not_loaded",
    sourceKey: config.defaultOwner,
    isDefault: true,
    warnings: [],
    meta: {
      requested: 0,
      fetched: 0,
      spiralCap: config.maxSpiralRepos,
      storedCap: config.maxStoredRepos,
    },
  };
}

/**
 * Default (no visitor-supplied sources) path, config-driven (T019/T020,
 * FR-023–FR-025). A single entry matching today's `defaultOwner` keeps the
 * exact pre-existing fast path (zero behavior change at default settings).
 * Multiple entries reuse the existing custom-source combination pipeline
 * (`fetchCustomRepositories`) — same dedup/warnings/error semantics as a
 * visitor manually adding several sources — with `isDefault: true` in the
 * response since this is still the unconfigured-by-visitor startup path.
 * Entries with an unrecognized `type` never reach here — parseInitialSources
 * (atlas-config.ts) already dropped them before this function is called.
 */
async function loadInitialSourcesResponse(entries: InitialSourceEntry[]): Promise<RepositoriesResponse> {
  // Every configured entry had an unrecognized type/shape and was dropped
  // by parseInitialSources (atlas-config.ts) — must not crash loading.
  if (entries.length === 0) return notLoadedResponse();

  const config = serverAtlasConfig();

  if (entries.length === 1 && entries[0]!.owner === config.defaultOwner) {
    const owner = entries[0]!.owner;
    const cached = await getCached(owner);
    if (cached) return cached;

    try {
      const repositories = await fetchDefaultOwnerRepositories(owner);
      const response = buildDefaultResponse(repositories, "live");
      await setCache(owner, response);
      return response;
    } catch {
      const repositories = (fallbackData as RawRepository[]).map(normalizeRepository);
      const response = buildDefaultResponse(repositories, "fallback");
      await setCache(owner, response);
      return response;
    }
  }

  const urls = entries.map((entry) => `https://github.com/${entry.owner}`);
  const { sources: parsedInitial } = parseSourceInputs(urls);
  const cacheKey = sourceKeyFromParsed(parsedInitial);
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  try {
    const result = await fetchCustomRepositories(urls);
    const response: RepositoriesResponse = {
      repositories: result.repositories,
      source: "live",
      sourceKey: result.sourceKey,
      isDefault: true,
      warnings: result.warnings,
      meta: result.meta,
    };
    await setCache(result.sourceKey, response);
    return response;
  } catch {
    const repositories = (fallbackData as RawRepository[]).map(normalizeRepository);
    const response = buildDefaultResponse(repositories, "fallback");
    await setCache(cacheKey, response);
    return response;
  }
}

/**
 * Plain, directly-callable handler (business logic) + thin `createServerFn`
 * wrapper below — same split as `snapshot.functions.ts`/`symbol.functions.ts`
 * (AsyncLocalStorage request context unavailable under plain `bun test`, so
 * tests call this handler directly). T028 (specs/003-github-source-enhancement).
 */
export async function getRepositoriesHandler(data: { sources?: string[] }): Promise<RepositoriesResponse> {
  const config = serverAtlasConfig();
  const sources = normalizeSources(data.sources);
  const isDefault = sources.length === 0;

  if (isDefault) {
    if (!config.loadInitialSources) return notLoadedResponse();
    return loadInitialSourcesResponse(config.initialSources);
  }

  const { sources: parsed } = parseSourceInputs(sources);
  const cacheKey = sourceKeyFromParsed(parsed);
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  try {
    const result = await fetchCustomRepositories(sources);
    const response: RepositoriesResponse = {
      repositories: result.repositories,
      source: "live",
      sourceKey: result.sourceKey,
      isDefault: false,
      warnings: result.warnings,
      meta: result.meta,
    };
    await setCache(result.sourceKey, response);
    return response;
  } catch (error) {
    if (isAtlasError(error)) {
      rethrowSerialized(error);
    }
    rethrowSerialized(new AtlasError("NETWORK", atlasErrorMessage("NETWORK")));
  }
}

export const getRepositories = createServerFn({ method: "POST" })
  .validator((data: { sources?: string[] }) => data)
  .handler(({ data }) => getRepositoriesHandler(data));
