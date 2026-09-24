import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dirOf, plural } from "@/lib/repo-intel/format";
import { MAX_CHILDREN_PAGE } from "@/lib/repo-intel/limits";
import {
  buildMapItems,
  type KindFilter,
  type MapItem,
} from "@/lib/repo-intel/level-items";
import {
  UNAVAILABLE_RELATIONSHIP_STATE,
  unavailableRelationshipLayer,
  type RelationshipLayer,
} from "@/lib/repo-intel/relationship-layer";
import {
  getRepositoryIntelligence,
  listStructureLevel,
} from "@/lib/repo-intel/repository-intelligence.functions";
import { useRepositoryContext } from "@/lib/repo-intel/use-repository-context";
import { Breadcrumb } from "./Breadcrumb";
import { IntelligenceStatePanel } from "./IntelligenceStatePanel";
import { RelationshipLayerNotice } from "./RelationshipLayerNotice";
import { RepositoryHeader } from "./RepositoryHeader";
import { StructureMap } from "./StructureMap";
import { StructureOutline } from "./StructureOutline";
import { SymbolPanel } from "./SymbolPanel";

export interface RepositoryIntelligenceViewProps {
  owner: string;
  name: string;
  path: string;
  file: string | undefined;
  symbol: number | undefined;
  relationshipLayer?: RelationshipLayer;
}

const KIND_BUTTONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "directory", label: "Directories" },
  { value: "file", label: "Files" },
];

function ProblemPanel({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <Alert data-repo-problem>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {body}
        {children}
      </AlertDescription>
    </Alert>
  );
}

export function RepositoryIntelligenceView({
  owner,
  name,
  path,
  file,
  symbol,
  relationshipLayer = unavailableRelationshipLayer,
}: RepositoryIntelligenceViewProps) {
  const navigate = useNavigate();
  const ctx = useRepositoryContext(owner, name);
  const canonical =
    ctx.status === "ready" ? { owner: ctx.owner, name: ctx.name } : null;

  // FR-002: normalise casing to the provider's canonical identity.
  useEffect(() => {
    if (canonical && (canonical.owner !== owner || canonical.name !== name)) {
      void navigate({
        to: "/repository/$owner/$name",
        params: canonical,
        search: { path: path || undefined, file, symbol },
        replace: true,
      });
    }
  }, [canonical?.owner, canonical?.name, owner, name]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOverview = useServerFn(getRepositoryIntelligence);
  const overviewQ = useQuery({
    queryKey: ["repo-intel", "overview", canonical?.owner, canonical?.name],
    enabled: canonical !== null,
    queryFn: () => fetchOverview({ data: canonical! }),
    staleTime: 60 * 1000,
    retry: false,
  });
  const overview = overviewQ.data;
  const snapshotId =
    overview?.status === "ready" ? overview.snapshot.snapshotId : null;

  const fetchLevel = useServerFn(listStructureLevel);
  const levelQ = useInfiniteQuery({
    queryKey: [
      "repo-intel",
      "level",
      canonical?.owner,
      canonical?.name,
      snapshotId,
      path,
    ],
    enabled: snapshotId !== null,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchLevel({
        data: {
          snapshotId: snapshotId!,
          directoryPath: path,
          cursor: pageParam,
          limit: MAX_CHILDREN_PAGE,
        },
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
  });

  const relationshipQ = useQuery({
    queryKey: [
      "repo-intel",
      "relationships",
      canonical?.owner,
      canonical?.name,
      snapshotId,
    ],
    enabled: canonical !== null && snapshotId !== null,
    queryFn: () =>
      relationshipLayer.getState({
        owner: canonical!.owner,
        name: canonical!.name,
        snapshotId: snapshotId!,
      }),
  });
  // Until the layer answers, show the unavailable state, never an invented one.
  const relationshipState =
    relationshipQ.data ?? UNAVAILABLE_RELATIONSHIP_STATE;

  const [filterText, setFilterText] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  useEffect(() => {
    setFilterText("");
    setKind("all");
  }, [path]);
  const filterRef = useRef<HTMLInputElement>(null);
  const outlineRef = useRef<HTMLElement>(null);

  const pages = levelQ.data?.pages;
  const allDirs = useMemo(
    () => (pages ?? []).flatMap((p) => p.directories),
    [pages],
  );
  const allFiles = useMemo(
    () => (pages ?? []).flatMap((p) => p.files),
    [pages],
  );
  const items = useMemo(
    () => buildMapItems(allDirs, allFiles, { text: filterText, kind }),
    [allDirs, allFiles, filterText, kind],
  );

  const go = (next: {
    path?: string | undefined;
    file?: string | undefined;
    symbol?: number | undefined;
  }) => {
    if (!canonical) return;
    void navigate({
      to: "/repository/$owner/$name",
      params: canonical,
      search: {
        path: next.path || undefined,
        file: next.file,
        symbol: next.symbol,
      },
    });
  };
  const onActivate = (item: MapItem) =>
    item.kind === "directory"
      ? go({ path: item.path })
      : go({ path: dirOf(item.path), file: item.path });
  const onUp = () => {
    if (file) return go({ path });
    if (path !== "") go({ path: dirOf(path) });
  };

  if (ctx.status === "loading") {
    return (
      <div className="space-y-4" data-repo-state="loading" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (ctx.status === "not_found") {
    return (
      <ProblemPanel
        title="Repository not found"
        body={`No repository ${owner}/${name} was found by the source provider, or it is not accessible.`}
      />
    );
  }
  if (ctx.status === "provider_error") {
    return (
      <ProblemPanel
        title="The source provider could not be reached"
        body="Repository metadata could not be loaded. This can be a network failure or a provider rate limit; nothing has been substituted."
      />
    );
  }
  if (ctx.status === "identity_mismatch") {
    return (
      <ProblemPanel
        title="Repository identity does not match"
        body={`The provider reports this repository as ${ctx.canonicalFullName}, not ${owner}/${name}.`}
      >
        {" "}
        <Link
          to="/repository/$owner/$name"
          params={{
            owner: ctx.canonicalFullName.split("/")[0] ?? owner,
            name: ctx.canonicalFullName.split("/")[1] ?? name,
          }}
          search={{}}
          className="underline"
        >
          Open {ctx.canonicalFullName}
        </Link>
      </ProblemPanel>
    );
  }

  const levelError = pages?.[0]?.error === "query_failed" || levelQ.isError;
  const isReady = overview?.status === "ready";
  const rootLabel = path === "" ? "the repository root" : path;

  return (
    <div
      className="space-y-8"
      data-repo-state="ready"
      data-repo-owner={ctx.owner}
      data-repo-name={ctx.name}
    >
      <RepositoryHeader
        repository={ctx.repository}
        owner={ctx.owner}
        name={ctx.name}
      />
      <IntelligenceStatePanel
        overview={overviewQ.isPending ? undefined : overview}
      />

      {isReady && (
        <section aria-labelledby="structure-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="atlas-section-label">Structure</p>
              <h2 id="structure-heading" className="text-lg font-semibold">
                Explore structure
              </h2>
            </div>
            {(path !== "" || file) && (
              <Button type="button" variant="outline" size="sm" onClick={onUp}>
                Up one level
              </Button>
            )}
          </div>
          <Breadcrumb
            owner={ctx.owner}
            name={ctx.name}
            path={path}
            file={file}
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="structure-filter">
              Filter this level by name
            </label>
            <Input
              id="structure-filter"
              ref={filterRef}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by name ( / )"
              className="max-w-xs"
            />
            <div
              role="group"
              aria-label="Filter by kind"
              className="flex gap-1"
            >
              {KIND_BUTTONS.map((b) => (
                <Button
                  key={b.value}
                  type="button"
                  size="sm"
                  variant={kind === b.value ? "default" : "outline"}
                  aria-pressed={kind === b.value}
                  onClick={() => setKind(b.value)}
                >
                  {b.label}
                </Button>
              ))}
            </div>
          </div>

          <p
            aria-live="polite"
            className="text-sm text-muted-foreground"
            data-level-summary
          >
            {levelQ.isPending
              ? "Loading this level…"
              : levelError
                ? "This level could not be read."
                : `Showing ${plural(allDirs.length, "directory", "directories")} and ${plural(allFiles.length, "file")} loaded in ${rootLabel}${levelQ.hasNextPage ? " (more available)" : ""}.`}
          </p>

          {levelQ.isPending && <Skeleton className="h-64 w-full" />}
          {levelError && (
            <p
              className="text-sm text-muted-foreground"
              data-level-state="error"
            >
              Structure could not be loaded for this directory.
            </p>
          )}
          {!levelQ.isPending &&
            !levelError &&
            allDirs.length + allFiles.length === 0 && (
              <p
                className="text-sm text-muted-foreground"
                data-level-state="empty"
              >
                This directory is empty in the analysed snapshot.
              </p>
            )}

          {!levelQ.isPending &&
            !levelError &&
            allDirs.length + allFiles.length > 0 && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
                <div className="min-w-0 space-y-4">
                  <StructureMap
                    items={items}
                    currentFile={file}
                    onActivate={onActivate}
                    onOverflow={() => outlineRef.current?.focus()}
                    onUp={onUp}
                    onFocusFilter={() => filterRef.current?.focus()}
                  />
                  <StructureOutline
                    owner={ctx.owner}
                    name={ctx.name}
                    items={items}
                    currentFile={file}
                    hasMore={Boolean(levelQ.hasNextPage)}
                    loadingMore={levelQ.isFetchingNextPage}
                    onLoadMore={() => void levelQ.fetchNextPage()}
                    outlineRef={outlineRef}
                  />
                </div>
                <div className="min-w-0">
                  {file && snapshotId !== null ? (
                    <SymbolPanel
                      owner={ctx.owner}
                      name={ctx.name}
                      snapshotId={snapshotId}
                      file={file}
                      symbolId={symbol}
                      onSelectSymbol={(id) => go({ path, file, symbol: id })}
                    />
                  ) : (
                    <p className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                      Select a file to see its symbols.
                    </p>
                  )}
                </div>
              </div>
            )}
        </section>
      )}

      <RelationshipLayerNotice state={relationshipState} />
    </div>
  );
}
