/**
 * Pure mapping from a fetched structure level to renderable items (Feature 009
 * FR-013, FR-014): applies the name/kind filter and produces the accessible
 * label used by both the map and the outline, so they always agree.
 */
import { formatBytes, plural } from "./format";
import type { LevelItem } from "./layout";
import type { StructureDirectory, StructureFile } from "./states";

export type KindFilter = "all" | "directory" | "file";

export interface MapItem extends LevelItem {
  path: string;
  ariaLabel: string;
  detail: string;
}

export function describeDirectory(d: StructureDirectory): string {
  const symbols =
    d.symbolCount === null
      ? "symbols not extracted"
      : plural(d.symbolCount, "symbol");
  return `${plural(d.fileCount, "file")}, ${symbols}`;
}

export function describeFile(f: StructureFile): string {
  const parts = [
    formatBytes(f.sizeBytes),
    f.language ?? "language not detected",
  ];
  if (f.extractionStatus === "extracted")
    parts.push(plural(f.symbolCount, "symbol"));
  else if (f.extractionStatus === "failed") parts.push("extraction failed");
  else if (f.extractionStatus === "skipped_unsupported")
    parts.push("unsupported for symbols");
  else parts.push("symbols not extracted");
  return parts.join(", ");
}

export function buildMapItems(
  directories: StructureDirectory[],
  files: StructureFile[],
  filter: { text: string; kind: KindFilter },
): MapItem[] {
  const needle = filter.text.trim().toLowerCase();
  const matches = (name: string) =>
    needle === "" || name.toLowerCase().includes(needle);
  const items: MapItem[] = [];
  if (filter.kind !== "file") {
    for (const d of directories) {
      if (!matches(d.name)) continue;
      const detail = describeDirectory(d);
      items.push({
        id: `dir:${d.path}`,
        kind: "directory",
        label: d.name,
        weight: d.fileCount,
        group: null,
        path: d.path,
        detail,
        ariaLabel: `Directory ${d.name}, ${detail}`,
      });
    }
  }
  if (filter.kind !== "directory") {
    for (const f of files) {
      if (!matches(f.name)) continue;
      const detail = describeFile(f);
      items.push({
        id: `file:${f.path}`,
        kind: "file",
        label: f.name,
        weight: f.sizeBytes,
        group: f.language,
        path: f.path,
        detail,
        ariaLabel: `File ${f.name}, ${detail}`,
      });
    }
  }
  return items;
}
