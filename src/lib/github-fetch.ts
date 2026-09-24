import {
  AtlasError,
  atlasErrorMessage,
  type AtlasErrorCode,
  type SourceFailure,
} from "./atlas-errors";
import { serverAtlasConfig } from "./atlas-config";
import { getGitHubToken } from "./code-intel/persistence/cloudflare-env";
import { normalizeRepository, type Repository } from "./repositories";
import { includesDefaultOwner, parseSourceInputs, sourceKeyFromParsed, type ParsedSource } from "./github-url";

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: { spdx_id?: string | null } | null;
  fork: boolean;
  archived: boolean;
  pushed_at: string | null;
  updated_at: string;
  default_branch: string;
};

export type AtlasWarning = { code: string; message: string };

export type FetchResult = {
  repositories: Repository[];
  sourceKey: string;
  isDefault: boolean;
  warnings: AtlasWarning[];
  meta: {
    requested: number;
    fetched: number;
    spiralCap: number;
    storedCap: number;
    rateLimitRemaining?: number;
    sourceFailures?: SourceFailure[];
  };
};

function authHeaders(): Record<string, string> {
  const token = getGitHubToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function githubHeaders(): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "RepoAtlas",
    ...authHeaders(),
  };
}

function toRepository(repo: GitHubRepo, source: ParsedSource): Repository {
  return normalizeRepository({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    description: repo.description,
    language: repo.language,
    topics: repo.topics ?? [],
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    license: repo.license?.spdx_id ?? null,
    fork: repo.fork,
    archived: repo.archived,
    pushedAt: repo.pushed_at,
    updatedAt: repo.updated_at,
    defaultBranch: repo.default_branch,
    sourceLogin: source.login,
    sourceKind: source.kind,
    sourceUrl: source.sourceUrl,
  });
}

function sourceFailureFromError(source: ParsedSource, error: unknown): SourceFailure {
  if (error instanceof AtlasError) {
    return {
      login: error.login ?? source.login,
      code: error.code,
      message: error.message,
      raw: source.raw,
    };
  }
  return {
    login: source.login,
    code: "NETWORK",
    message: atlasErrorMessage("NETWORK"),
    raw: source.raw,
  };
}

async function githubFetch(url: string): Promise<Response> {
  try {
    return await fetch(url, { headers: githubHeaders() });
  } catch {
    throw new AtlasError("NETWORK", atlasErrorMessage("NETWORK"));
  }
}

function handleRateLimit(response: Response): void {
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining === "0" || response.status === 429) {
      throw new AtlasError("RATE_LIMITED", atlasErrorMessage("RATE_LIMITED"));
    }
  }
}

async function fetchUserOrOrgRepos(source: ParsedSource): Promise<GitHubRepo[]> {
  if (source.kind === "org") {
    const response = await githubFetch(`https://api.github.com/orgs/${source.login}/repos?per_page=100&page=1`);
    handleRateLimit(response);
    if (response.status === 404) {
      throw new AtlasError("SOURCE_NOT_FOUND", atlasErrorMessage("SOURCE_NOT_FOUND", { login: source.login }), {
        login: source.login,
      });
    }
    if (response.status === 401 || response.status === 403) {
      throw new AtlasError("SOURCE_FORBIDDEN", atlasErrorMessage("SOURCE_FORBIDDEN", { login: source.login }), {
        login: source.login,
      });
    }
    if (response.status >= 500) {
      throw new AtlasError(
        "GITHUB_5XX",
        atlasErrorMessage("GITHUB_5XX", { status: response.status }),
      );
    }
    const repos: GitHubRepo[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const pageResponse = await githubFetch(
        `https://api.github.com/orgs/${source.login}/repos?per_page=100&page=${page}&sort=updated`,
      );
      handleRateLimit(pageResponse);
      if (!pageResponse.ok) break;
      const batch = (await pageResponse.json()) as GitHubRepo[];
      repos.push(...batch);
      if (batch.length < 100) break;
    }
    return repos;
  }

  if (source.kind === "repo") {
    const parts = source.sourceUrl.replace("https://github.com/", "").split("/");
    const owner = parts[0]!;
    const repo = parts[1]!;
    const response = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`);
    handleRateLimit(response);
    if (response.status === 404) {
      throw new AtlasError("SOURCE_NOT_FOUND", atlasErrorMessage("SOURCE_NOT_FOUND", { login: source.login }), {
        login: source.login,
      });
    }
    if (response.status === 401 || response.status === 403) {
      throw new AtlasError("SOURCE_FORBIDDEN", atlasErrorMessage("SOURCE_FORBIDDEN", { login: source.login }), {
        login: source.login,
      });
    }
    if (!response.ok) {
      throw new AtlasError(
        "GITHUB_5XX",
        atlasErrorMessage("GITHUB_5XX", { status: response.status }),
      );
    }
    return [await response.json() as GitHubRepo];
  }

  const userRepos: GitHubRepo[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await githubFetch(
      `https://api.github.com/users/${source.login}/repos?per_page=100&page=${page}&sort=updated`,
    );
    handleRateLimit(response);
    if (response.status === 404) {
      const orgRepos: GitHubRepo[] = [];
      for (let orgPage = 1; orgPage <= 10; orgPage += 1) {
        const orgResponse = await githubFetch(
          `https://api.github.com/orgs/${source.login}/repos?per_page=100&page=${orgPage}&sort=updated`,
        );
        handleRateLimit(orgResponse);
        if (orgResponse.status === 404) {
          throw new AtlasError("SOURCE_NOT_FOUND", atlasErrorMessage("SOURCE_NOT_FOUND", { login: source.login }), {
            login: source.login,
          });
        }
        if (orgResponse.status === 401 || orgResponse.status === 403) {
          throw new AtlasError("SOURCE_FORBIDDEN", atlasErrorMessage("SOURCE_FORBIDDEN", { login: source.login }), {
            login: source.login,
          });
        }
        if (!orgResponse.ok) {
          throw new AtlasError(
            "GITHUB_5XX",
            atlasErrorMessage("GITHUB_5XX", { status: orgResponse.status }),
          );
        }
        const batch = (await orgResponse.json()) as GitHubRepo[];
        orgRepos.push(...batch);
        if (batch.length < 100) break;
      }
      return orgRepos;
    }
    if (response.status === 401 || response.status === 403) {
      throw new AtlasError("SOURCE_FORBIDDEN", atlasErrorMessage("SOURCE_FORBIDDEN", { login: source.login }), {
        login: source.login,
      });
    }
    if (!response.ok) {
      throw new AtlasError(
        "GITHUB_5XX",
        atlasErrorMessage("GITHUB_5XX", { status: response.status }),
      );
    }
    const batch = (await response.json()) as GitHubRepo[];
    userRepos.push(...batch);
    if (batch.length < 100) break;
  }
  return userRepos;
}

async function fetchSourceRepos(source: ParsedSource): Promise<GitHubRepo[]> {
  return fetchUserOrOrgRepos(source);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function rankRepositories(repos: Repository[]): Repository[] {
  return [...repos].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    return (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "");
  });
}

function dedupeById(repos: Repository[]): Repository[] {
  const map = new Map<number, Repository>();
  for (const repo of repos) {
    map.set(repo.id, repo);
  }
  return [...map.values()];
}

export async function fetchDefaultOwnerRepositories(owner: string): Promise<Repository[]> {
  const source: ParsedSource = {
    login: owner,
    kind: "user",
    sourceUrl: `https://github.com/${owner}`,
    raw: owner,
  };
  const raw = await fetchSourceRepos(source);
  return rankRepositories(raw.filter((r) => !r.archived).map((r) => toRepository(r, source)));
}

export async function fetchCustomRepositories(inputs: string[]): Promise<FetchResult> {
  const config = serverAtlasConfig();
  const { sources } = parseSourceInputs(inputs);
  const sourceKey = sourceKeyFromParsed(sources);
  const warnings: AtlasWarning[] = [];
  const sourceFailures: SourceFailure[] = [];
  let okCount = 0;

  const results = await mapWithConcurrency(sources, 3, async (source) => {
    try {
      const repos = await fetchSourceRepos(source);
      okCount += 1;
      return repos.filter((r) => !r.archived).map((r) => toRepository(r, source));
    } catch (error) {
      const failure = sourceFailureFromError(source, error);
      sourceFailures.push(failure);
      warnings.push({ code: failure.code, message: failure.message });
      return [] as Repository[];
    }
  });

  const merged = dedupeById(results.flat());
  const defaultOwner = config.defaultOwner.toLowerCase();
  const filtered = includesDefaultOwner(sources, config.defaultOwner)
    ? merged
    : merged.filter((r) => !r.fullName.toLowerCase().startsWith(`${defaultOwner}/`));

  if (okCount === 0) {
    const primary = sourceFailures[0];
    const code: AtlasErrorCode = primary?.code ?? "NETWORK";
    const message = primary?.message ?? atlasErrorMessage("NETWORK");
    throw new AtlasError(code, message, {
      ...(primary?.login ? { login: primary.login } : {}),
      sourceFailures,
      detail: JSON.stringify({ sourceFailures }),
    });
  }

  if (sourceFailures.length > 0) {
    warnings.push({
      code: "PARTIAL_FAILURE",
      message: atlasErrorMessage("PARTIAL_FAILURE", { ok: okCount, fail: sourceFailures.length }),
    });
  }

  const ranked = rankRepositories(filtered);
  const fetched = ranked.length;
  let catalogue = ranked;
  if (catalogue.length > config.maxStoredRepos) {
    catalogue = catalogue.slice(0, config.maxStoredRepos);
    warnings.push({
      code: "CATALOGUE_TRUNCATED",
      message: `Loaded the ${config.maxStoredRepos} most-starred repositories across your sources.`,
    });
  }

  if (fetched > config.maxSpiralRepos) {
    warnings.push({
      code: "SPIRAL_TRUNCATED",
      message: `Showing ${config.maxSpiralRepos} of ${fetched} repositories in the atlas (sorted by stars). Catalogue lists all loaded repos.`,
    });
  }

  return {
    repositories: catalogue,
    sourceKey,
    isDefault: false,
    warnings,
    meta: {
      requested: sources.length,
      fetched,
      spiralCap: config.maxSpiralRepos,
      storedCap: config.maxStoredRepos,
      ...(sourceFailures.length > 0 ? { sourceFailures } : {}),
    },
  };
}
