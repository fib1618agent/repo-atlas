import { languageColor } from "@/lib/repo-intel/language-colors";
import { formatBytes, plural } from "@/lib/repo-intel/format";
import type { Composition } from "@/lib/repo-intel/states";

/** Stacked bar plus a text list: colour is never the only carrier of meaning. */
export function CompositionBar({
  composition,
  totalFiles,
}: {
  composition: Composition;
  totalFiles: number;
}) {
  const rows = [
    ...composition.buckets,
    ...(composition.otherFileCount > 0
      ? [
          {
            key: "other",
            label: "Other",
            fileCount: composition.otherFileCount,
            bytes: composition.otherBytes,
          },
        ]
      : []),
  ];
  if (totalFiles === 0 || rows.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No files in this snapshot.
      </p>
    );
  }
  const summary = rows
    .map((r) => `${r.label}: ${plural(r.fileCount, "file")}`)
    .join(", ");

  return (
    <div className="mt-4">
      <p className="atlas-section-label">File composition</p>
      <div
        role="img"
        aria-label={`File composition. ${summary}`}
        className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        {rows.map((r) => (
          <div
            key={r.key}
            style={{
              width: `${(r.fileCount / totalFiles) * 100}%`,
              backgroundColor:
                r.key === "other" ? "#475569" : languageColor(r.key),
            }}
          />
        ))}
      </div>
      <ul className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  r.key === "other" ? "#475569" : languageColor(r.key),
              }}
            />
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">
              {plural(r.fileCount, "file")} · {formatBytes(r.bytes)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
