import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSymbol } from "@/lib/code-intel/symbol.functions";
import { plural, shortSha } from "@/lib/repo-intel/format";
import { listFileSymbols } from "@/lib/repo-intel/repository-intelligence.functions";
import {
  buildSymbolTree,
  type SymbolTreeNode,
} from "@/lib/repo-intel/symbol-tree";
import { fileStateMessage } from "@/lib/repo-intel/copy";

function TreeList({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: SymbolTreeNode[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
}) {
  return (
    <ul className="space-y-0.5 text-sm">
      {nodes.map(({ symbol, children }) => (
        <li key={symbol.id}>
          <button
            type="button"
            onClick={() => onSelect(symbol.id)}
            aria-pressed={symbol.id === selectedId}
            className="flex w-full items-baseline gap-2 rounded px-1 py-1 text-left hover:bg-secondary/40 focus-visible:bg-secondary/40 aria-pressed:bg-secondary/60"
          >
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {symbol.kind}
            </Badge>
            <span className="min-w-0 break-all font-medium">{symbol.name}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
              L{symbol.startLine + 1}
            </span>
          </button>
          {children.length > 0 && (
            <div className="ml-4 border-l border-border/40 pl-2">
              <TreeList
                nodes={children}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function SymbolDetail({
  owner,
  name,
  symbolId,
}: {
  owner: string;
  name: string;
  symbolId: number;
}) {
  const fetchSymbol = useServerFn(getSymbol);
  const q = useQuery({
    queryKey: ["repo-intel", "symbol", owner, name, symbolId],
    queryFn: () => fetchSymbol({ data: { symbolId } }),
    retry: false,
  });
  if (q.isPending) return <Skeleton className="h-16 w-full" />;
  if (q.isError || !q.data) {
    return (
      <p className="text-sm text-muted-foreground">
        Symbol details are not available.
      </p>
    );
  }
  const d = q.data;
  const same =
    d.provenance.repository.owner.toLowerCase() === owner.toLowerCase() &&
    d.provenance.repository.name.toLowerCase() === name.toLowerCase();
  if (!same) {
    return (
      <p role="alert" className="text-sm text-destructive">
        This symbol belongs to a different repository and is not shown here.
      </p>
    );
  }
  return (
    <dl
      className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
      data-symbol-detail
    >
      <dt className="text-muted-foreground">Kind</dt>
      <dd>{d.kind}</dd>
      <dt className="text-muted-foreground">Name</dt>
      <dd className="break-all">{d.qualifiedName ?? d.name}</dd>
      <dt className="text-muted-foreground">Position</dt>
      <dd className="tabular-nums">
        lines {d.startLine + 1}–{d.endLine + 1}
      </dd>
      <dt className="text-muted-foreground">Exported</dt>
      <dd>{d.isExported === null ? "unknown" : d.isExported ? "yes" : "no"}</dd>
      <dt className="text-muted-foreground">Source</dt>
      <dd className="break-all">
        {d.provenance.repository.owner}/{d.provenance.repository.name} @{" "}
        <span className="font-mono">{shortSha(d.provenance.commitSha)}</span> ·{" "}
        {d.provenance.filePath}
      </dd>
    </dl>
  );
}

export function SymbolPanel({
  owner,
  name,
  snapshotId,
  file,
  symbolId,
  onSelectSymbol,
}: {
  owner: string;
  name: string;
  snapshotId: number;
  file: string;
  symbolId: number | undefined;
  onSelectSymbol: (id: number | undefined) => void;
}) {
  const fetchSymbols = useServerFn(listFileSymbols);
  const q = useQuery({
    queryKey: ["repo-intel", "symbols", owner, name, snapshotId, file],
    queryFn: () => fetchSymbols({ data: { snapshotId, path: file } }),
    retry: false,
  });
  const tree = useMemo(() => buildSymbolTree(q.data?.symbols ?? []), [q.data]);

  return (
    <section
      aria-labelledby="symbols-heading"
      data-symbol-panel
      className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4"
    >
      <div>
        <p className="atlas-section-label">File</p>
        <h3 id="symbols-heading" className="break-all text-base font-semibold">
          {file}
        </h3>
      </div>
      {q.isPending && <Skeleton className="h-20 w-full" />}
      {q.isError && (
        <p className="text-sm text-muted-foreground">
          Symbols could not be read.
        </p>
      )}
      {q.data && (
        <>
          <p className="text-xs text-muted-foreground">
            {q.data.language ?? "language not detected"} ·{" "}
            {plural(q.data.symbolCount, "symbol")}
          </p>
          {fileStateMessage(q.data) && (
            <p
              className="text-sm text-muted-foreground"
              data-file-state={q.data.extractionStatus}
            >
              {fileStateMessage(q.data)}
            </p>
          )}
          {tree.length > 0 && (
            <TreeList
              nodes={tree}
              selectedId={symbolId}
              onSelect={onSelectSymbol}
            />
          )}
          {q.data.truncated && (
            <p className="text-xs text-muted-foreground" data-truncated>
              Showing the first {q.data.symbols.length} of {q.data.symbolCount}{" "}
              symbols.
            </p>
          )}
        </>
      )}
      {symbolId !== undefined && (
        <div className="border-t border-border/40 pt-3">
          <SymbolDetail owner={owner} name={name} symbolId={symbolId} />
        </div>
      )}
    </section>
  );
}
