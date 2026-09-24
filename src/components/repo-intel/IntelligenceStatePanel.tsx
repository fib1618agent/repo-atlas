import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, plural, shortSha } from "@/lib/repo-intel/format";
import { overviewCopy, SYMBOLS_COPY } from "@/lib/repo-intel/copy";
import {
  deriveSymbolsState,
  type OverviewResult,
} from "@/lib/repo-intel/states";
import { CompositionBar } from "./CompositionBar";

export function IntelligenceStatePanel({
  overview,
}: {
  overview: OverviewResult | undefined;
}) {
  const copy = overviewCopy(overview);

  if (copy) {
    return (
      <section
        aria-labelledby="intel-state-heading"
        data-intel-state={overview?.status ?? "loading"}
        className="rounded-xl border border-border/60 bg-card/50 p-5"
      >
        <p className="atlas-section-label">Repository intelligence</p>
        <h2 id="intel-state-heading" className="mt-1 text-lg font-semibold">
          {copy.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
        {!overview && <Skeleton className="mt-4 h-4 w-2/3" />}
      </section>
    );
  }

  if (!overview || overview.status !== "ready") return null;
  const symbols = deriveSymbolsState(overview.extraction);
  const { extraction, snapshot, totals } = overview;

  return (
    <section
      aria-labelledby="intel-state-heading"
      data-intel-state="ready"
      className="rounded-xl border border-border/60 bg-card/50 p-5"
    >
      <p className="atlas-section-label">Repository intelligence</p>
      <h2 id="intel-state-heading" className="mt-1 text-lg font-semibold">
        Analysed snapshot
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Commit</dt>
          <dd className="font-mono">{shortSha(snapshot.commitSha)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Files</dt>
          <dd className="tabular-nums">{totals.files}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Size</dt>
          <dd>{formatBytes(totals.bytes)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Symbols</dt>
          <dd className="tabular-nums">
            {symbols === "not_extracted" ? "—" : extraction.symbolsExtracted}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          Extraction: {extraction.status.replace("_", " ")}
        </Badge>
        {extraction.filesFailed > 0 && (
          <Badge variant="outline">
            {plural(extraction.filesFailed, "file")} failed
          </Badge>
        )}
        {extraction.filesSkippedUnsupported > 0 && (
          <Badge variant="outline">
            {plural(extraction.filesSkippedUnsupported, "file")} unsupported
          </Badge>
        )}
      </div>
      <p
        className="mt-2 text-sm text-muted-foreground"
        data-symbols-state={symbols}
      >
        {SYMBOLS_COPY[symbols]}
      </p>
      <CompositionBar
        composition={overview.composition}
        totalFiles={totals.files}
      />
    </section>
  );
}
