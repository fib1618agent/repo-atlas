/**
 * SERVER-ONLY. Read-only aggregate status of Code Intelligence (Features 001/002):
 * counts by state, the symbol extractor version, and availability. Two SELECT
 * aggregates and nothing else: no rows, identifiers, paths or Error text leave here.
 */
import { SYMBOL_EXTRACTOR_VERSION } from "../code-intel/config";
import { canUseD1, getD1 } from "../code-intel/persistence/cloudflare-env";
import type { ReasonCode } from "./setting-registry";

export interface SnapshotCounts {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
}

export interface ExtractionCounts {
  total: number;
  in_progress: number;
  completed: number;
  completed_partial: number;
  failed: number;
}

export interface OperationalStatus {
  available: boolean;
  /** Present when `available` is false. */
  reason?: ReasonCode;
  symbolExtractorVersion: string;
  snapshots?: SnapshotCounts;
  extractions?: ExtractionCounts;
}

const SNAPSHOT_STATES = [
  "pending",
  "in_progress",
  "completed",
  "failed",
] as const;
const EXTRACTION_STATES = [
  "in_progress",
  "completed",
  "completed_partial",
  "failed",
] as const;

const SNAPSHOTS_SQL =
  "SELECT status, COUNT(*) AS n FROM snapshots GROUP BY status";
const EXTRACTIONS_SQL =
  "SELECT status, COUNT(*) AS n FROM snapshot_extractions GROUP BY status";

type Row = { status: string; n: number };

/** Zero-fill every known state and total them; unknown statuses are ignored. */
function tally<S extends string>(
  rows: readonly Row[],
  states: readonly S[],
): { total: number } & Record<S, number> {
  const counts = Object.fromEntries(states.map((s) => [s, 0])) as Record<
    S,
    number
  >;
  let total = 0;
  for (const row of rows) {
    if ((states as readonly string[]).includes(row.status)) {
      counts[row.status as S] = Number(row.n);
      total += Number(row.n);
    }
  }
  return { total, ...counts };
}

export async function getCodeIntelStatusView(): Promise<OperationalStatus> {
  const symbolExtractorVersion = SYMBOL_EXTRACTOR_VERSION;
  if (!canUseD1())
    return { available: false, reason: "no_binding", symbolExtractorVersion };

  try {
    const db = getD1();
    const snapshotRows = await db.prepare(SNAPSHOTS_SQL).all<Row>();
    const extractionRows = await db.prepare(EXTRACTIONS_SQL).all<Row>();
    return {
      available: true,
      symbolExtractorVersion,
      snapshots: tally(snapshotRows.results ?? [], SNAPSHOT_STATES),
      extractions: tally(extractionRows.results ?? [], EXTRACTION_STATES),
    };
  } catch {
    // Fixed reason only: never the exception message, SQL, stack or identifiers.
    return { available: false, reason: "query_failed", symbolExtractorVersion };
  }
}
