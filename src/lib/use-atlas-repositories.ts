import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ATLAS_MAX_SPIRAL_REPOS } from "./atlas-config";
import { getRepositories } from "./repositories.functions";
import { useSourcesStore } from "./sources-store";

export function useAtlasRepositories() {
  const hasHydrated = useSourcesStore((s) => s._hasHydrated);
  const sourceKey = useSourcesStore((s) => s.sourceKey);
  const isDefault = useSourcesStore((s) => s.isDefault);
  const urls = useSourcesStore((s) => s.urls);
  const loadRepositories = useServerFn(getRepositories);

  const query = useQuery({
    queryKey: ["repositories", sourceKey],
    queryFn: () =>
      loadRepositories({
        data: isDefault ? {} : { sources: urls },
      }),
    enabled: hasHydrated,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const repositories = query.data?.repositories ?? [];

  return {
    ...query,
    repositories,
    spiralRepositories: repositories.slice(0, ATLAS_MAX_SPIRAL_REPOS),
    sourceKey,
    isDefault,
    urls,
    hasHydrated,
    warnings: query.data?.warnings ?? [],
    meta: query.data?.meta,
    dataSource: query.data?.source,
  };
}
