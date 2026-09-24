import type { Repository } from "./repositories";
import type { SourceFailure } from "./atlas-errors";

export type ConnectedSourceStatus = "connected" | "degraded" | "error";

export type ConnectedSource = {
  type: "github" | "gitlab" | "bitbucket" | "local" | "enterprise";
  identity: string;
  repositoryCount: number;
  status: ConnectedSourceStatus;
  colorToken: string;
};

const STATUS_COLOR_TOKEN: Record<ConnectedSourceStatus, string> = {
  connected: "var(--atlas-web)",
  degraded: "var(--atlas-data)",
  error: "var(--destructive)",
};

export type DeriveConnectedSourcesInput = {
  sourceKey: string;
  isDefault: boolean;
  urls: string[];
  repositories: Repository[];
  warnings: { code: string; message: string }[];
  meta?: { sourceFailures?: SourceFailure[] };
};

/**
 * Pure derivation — no React, no store access. Input shapes match what
 * useSourcesStore()/useAtlasRepositories() already provide (data-model.md
 * ConnectedSource). Groups by Repository.sourceLogin for the custom-source
 * case; falls back to a single default-owner entry when isDefault is true.
 */
export function deriveConnectedSources({
  sourceKey,
  isDefault,
  repositories,
  meta,
}: DeriveConnectedSourcesInput): ConnectedSource[] {
  const failuresByLogin = new Map<string, SourceFailure>();
  for (const failure of meta?.sourceFailures ?? []) {
    failuresByLogin.set(failure.login, failure);
  }

  if (isDefault) {
    const login = sourceKey;
    const status = statusFor(login, repositories.length, failuresByLogin);
    return [
      {
        type: "github",
        identity: `github.com/${login}`,
        repositoryCount: repositories.length,
        status,
        colorToken: STATUS_COLOR_TOKEN[status],
      },
    ];
  }

  const countByLogin = new Map<string, number>();
  for (const repo of repositories) {
    if (!repo.sourceLogin) continue;
    countByLogin.set(repo.sourceLogin, (countByLogin.get(repo.sourceLogin) ?? 0) + 1);
  }

  const logins = new Set<string>([...countByLogin.keys(), ...failuresByLogin.keys()]);

  return [...logins].map((login) => {
    const repositoryCount = countByLogin.get(login) ?? 0;
    const status = statusFor(login, repositoryCount, failuresByLogin);
    return {
      type: "github",
      identity: `github.com/${login}`,
      repositoryCount,
      status,
      colorToken: STATUS_COLOR_TOKEN[status],
    };
  });
}

function statusFor(
  login: string,
  repositoryCount: number,
  failuresByLogin: Map<string, SourceFailure>,
): ConnectedSourceStatus {
  if (!failuresByLogin.has(login)) return "connected";
  return repositoryCount > 0 ? "degraded" : "error";
}
