import { createServerFn } from "@tanstack/react-start";
import fallbackData from "./repositories-fallback.json";
import { normalizeRepository, type Repository } from "./repositories";

type RawRepository = Omit<Repository, "category" | "subgroup">;

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

let cache: { expiresAt: number; repositories: Repository[] } | undefined;

function toRepository(repo: GitHubRepo): Repository {
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
  });
}

async function fetchAllRepositories(): Promise<Repository[]> {
  const all: GitHubRepo[] = [];
  const token = process.env["GITHUB_TOKEN"] ?? "";
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`https://api.github.com/users/imdadareeph/repos?per_page=100&page=${page}&sort=updated`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "RepoAtlas",
        ...authHeaders,
      },
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const batch = (await response.json()) as GitHubRepo[];
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter((repo) => !repo.archived).map(toRepository);
}

export const getRepositories = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && cache.expiresAt > Date.now()) {
    return { repositories: cache.repositories, source: "live" as const };
  }
  try {
    const repositories = await fetchAllRepositories();
    cache = { repositories, expiresAt: Date.now() + 15 * 60 * 1000 };
    return { repositories, source: "live" as const };
  } catch {
    const repositories = (fallbackData as RawRepository[]).map(normalizeRepository);
    return { repositories, source: "fallback" as const };
  }
});
