import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRepositories } from "../repositories.functions";
import { useAtlasRepositories } from "../use-atlas-repositories";
import { isValidName, isValidOwner, repositoryUrl } from "./identity";
import {
  findLoaded,
  readyFromLoaded,
  resolveProviderResponse,
  type RepositoryContext,
} from "./repository-context";

/**
 * Provider context for the route's repository (Feature 009 FR-002, FR-004,
 * FR-016). Uses the already-loaded Feature 003 catalogue when it contains the
 * repository; otherwise an isolated single-repository lookup through the same
 * `getRepositories` provider function. It reads the sources store through
 * `useAtlasRepositories` but never calls any store setter.
 */
export function useRepositoryContext(
  owner: string,
  name: string,
): RepositoryContext {
  const atlas = useAtlasRepositories();
  const lookup = useServerFn(getRepositories);
  const valid = isValidOwner(owner) && isValidName(name);
  const loaded = valid
    ? findLoaded({ owner, name }, atlas.repositories)
    : undefined;

  const query = useQuery({
    queryKey: [
      "repo-intel",
      "context",
      owner.toLowerCase(),
      name.toLowerCase(),
    ],
    // Not gated on the sources store's `_hasHydrated` flag: this lookup must not
    // depend on catalogue hydration (see research.md R11).
    enabled: valid && !loaded && !atlas.isLoading,
    queryFn: () =>
      lookup({ data: { sources: [repositoryUrl({ owner, name })] } }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  if (!valid) return { status: "not_found" };
  if (loaded) return readyFromLoaded(loaded);
  if (query.isPending) return { status: "loading" };
  return resolveProviderResponse(
    { owner, name },
    query.data,
    query.isError,
    query.error,
  );
}
