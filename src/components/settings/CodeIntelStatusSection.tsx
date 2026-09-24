import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getCodeIntelStatus } from "@/lib/control-plane/control-plane.functions";
import type { OperationalStatus } from "@/lib/control-plane/code-intel-status";
import type { ReasonCode } from "@/lib/control-plane/setting-registry";

/** Fixed text per reason; never server-supplied strings. */
const REASON_TEXT: Record<ReasonCode, string> = {
  no_binding: "No code-intelligence database is connected to this instance.",
  disabled_by_configuration: "Turned off by configuration.",
  not_supported_here: "Not supported in this environment.",
  query_failed: "The status could not be read.",
};

const SNAPSHOT_ROWS = [
  ["pending", "Pending"],
  ["in_progress", "In progress"],
  ["completed", "Completed"],
  ["failed", "Failed"],
] as const;

const EXTRACTION_ROWS = [
  ["in_progress", "In progress"],
  ["completed", "Completed"],
  ["completed_partial", "Completed (partial)"],
  ["failed", "Failed"],
] as const;

function CountList({
  title,
  total,
  rows,
}: {
  title: string;
  total: number;
  rows: readonly (readonly [string, number])[];
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
      <h3 className="text-sm font-medium">
        {title} <span className="text-muted-foreground">({total} total)</span>
      </h3>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
        {rows.map(([label, n]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function UnavailableNotice({ reason }: { reason: ReasonCode | undefined }) {
  return (
    <div className="space-y-1">
      <Badge variant="outline">Unavailable</Badge>
      <p className="text-sm">Not available in this environment</p>
      {reason ? (
        <p className="text-xs text-muted-foreground">
          {REASON_TEXT[reason]} (<code>{reason}</code>)
        </p>
      ) : null}
    </div>
  );
}

/** Presentational and read-only: aggregate counts, version and availability only. */
export function CodeIntelStatusView({ status }: { status: OperationalStatus }) {
  const { snapshots, extractions } = status;
  const empty =
    status.available && snapshots?.total === 0 && extractions?.total === 0;

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Symbol extractor version: <code>{status.symbolExtractorVersion}</code>
      </p>

      {!status.available ? (
        <UnavailableNotice reason={status.reason} />
      ) : empty ? (
        <p className="text-sm text-muted-foreground">
          No code-intelligence data
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {snapshots ? (
            <CountList
              title="Snapshots"
              total={snapshots.total}
              rows={SNAPSHOT_ROWS.map(
                ([key, label]) => [label, snapshots[key]] as const,
              )}
            />
          ) : null}
          {extractions ? (
            <CountList
              title="Symbol extractions"
              total={extractions.total}
              rows={EXTRACTION_ROWS.map(
                ([key, label]) => [label, extractions[key]] as const,
              )}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

export function CodeIntelStatusSection() {
  const loadStatus = useServerFn(getCodeIntelStatus);
  const query = useQuery({
    queryKey: ["control-plane", "code-intel-status"],
    queryFn: () => loadStatus({}),
    retry: false,
  });

  return (
    <section
      aria-labelledby="settings-code-intel-heading"
      className="space-y-3"
    >
      <div>
        <p className="atlas-eyebrow mb-2">Code intelligence</p>
        <h2 id="settings-code-intel-heading" className="text-xl font-semibold">
          Code-intelligence status
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only summary. Nothing here starts or changes processing.
        </p>
      </div>

      {query.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : query.isError ? (
        // The server function reports failures as data; this is only a transport failure.
        <UnavailableNotice reason="query_failed" />
      ) : (
        <CodeIntelStatusView status={query.data} />
      )}
    </section>
  );
}
