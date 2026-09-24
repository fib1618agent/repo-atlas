/**
 * Route search-param validation for the Repository Intelligence view (Feature
 * 009, contracts/visualization-surface.md). Pure. Invalid or unsafe values are
 * dropped (falling back to the repository root), never thrown.
 */
import { normalizeDirectoryPath, normalizeFilePath } from "./paths";

export interface RepositorySearch {
  path?: string | undefined;
  file?: string | undefined;
  symbol?: number | undefined;
}

export function validateRepositorySearch(
  search: Record<string, unknown>,
): RepositorySearch {
  const path =
    typeof search["path"] === "string"
      ? normalizeDirectoryPath(search["path"])
      : null;
  const file =
    typeof search["file"] === "string"
      ? normalizeFilePath(search["file"])
      : null;
  const symbolNumber = Number(search["symbol"]);
  return {
    path: path ? path : undefined,
    file: file ?? undefined,
    symbol:
      file && Number.isInteger(symbolNumber) && symbolNumber > 0
        ? symbolNumber
        : undefined,
  };
}
