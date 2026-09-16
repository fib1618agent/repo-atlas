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
import { serverAtlasConfig } from "./atlas-config";
import { parseSourceInputs, sourceKeyFromParsed } from "./github-url";
import { fetchCustomRepositories, fetchDefaultOwnerRepositories } from "./github-fetch";
import { getAtlasCache, type CachedRepositoriesResponse } from "./storage/atlas-store";

type RawRepository = Omit<Repository, "category" | "subgroup" | "importance">;

export type RepositoriesResponse = {
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

export const getRepositories = createServerFn({ method: "POST" })
  .validator((data: { sources?: string[] }) => data)
  .handler(async ({ data }): Promise<RepositoriesResponse> => {
    const config = serverAtlasConfig();
    const sources = normalizeSources(data.sources);
    const isDefault = sources.length === 0;

    if (isDefault) {
      const cached = await getCached(config.defaultOwner);
      if (cached) return cached;

      try {
        const repositories = await fetchDefaultOwnerRepositories(config.defaultOwner);
        const response = buildDefaultResponse(repositories, "live");
        await setCache(config.defaultOwner, response);
        return response;
      } catch {
        const repositories = (fallbackData as RawRepository[]).map(normalizeRepository);
        const response = buildDefaultResponse(repositories, "fallback");
        await setCache(config.defaultOwner, response);
        return response;
      }
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
  });
