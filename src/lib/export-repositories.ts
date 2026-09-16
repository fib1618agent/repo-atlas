import { exportEmptyError } from "./atlas-errors";
import type { Repository } from "./repositories";

export type ExportRepositoriesPayload = {
  exportedAt: string;
  sourceKey: string;
  isDefault: boolean;
  sources: string[];
  count: number;
  repositories: Repository[];
};

export type ExportRepositoriesInput = {
  repositories: Repository[];
  sourceKey: string;
  isDefault: boolean;
  urls: string[];
};

function formatExportFilenameDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function resolveExportSources(urls: string[], sourceKey: string, isDefault: boolean): string[] {
  if (urls.length > 0) return urls;
  if (isDefault) return [`https://github.com/${sourceKey}`];
  return sourceKey.split("+").map((login) => `https://github.com/${login}`);
}

function triggerBrowserDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export function exportRepositoriesJson({
  repositories,
  sourceKey,
  isDefault,
  urls,
}: ExportRepositoriesInput): number {
  if (repositories.length === 0) {
    throw exportEmptyError();
  }

  const count = repositories.length;
  const payload: ExportRepositoriesPayload = {
    exportedAt: new Date().toISOString(),
    sourceKey,
    isDefault,
    sources: resolveExportSources(urls, sourceKey, isDefault),
    count,
    repositories,
  };

  const filename = `repoatlas-${sourceKey}-${formatExportFilenameDate(new Date())}.json`;
  triggerBrowserDownload(filename, `${JSON.stringify(payload, null, 2)}\n`);

  return count;
}
