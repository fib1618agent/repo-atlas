# Data Model: Repository Intelligence Visualization

No new tables, columns or indexes. All data are read from existing Feature 001/002 tables (SELECT-only) and the Feature 003 provider. Types below are the DTOs the server functions return (JSON-serializable, no `Date`, no `undefined` in payloads).

## RepositoryIdentity (reused type)

`{ provider: "github"; owner: string; name: string }` from `src/lib/code-intel/domain/repository-identity.ts` (imported as a type). Canonical values come from the provider `full_name`.

## IntelligenceOverview (discriminated by `status`)

| `status` | Meaning | Extra fields |
|---|---|---|
| `unavailable` | No D1 binding, or the read failed | `reason: "no_binding" \| "query_failed"` |
| `no_snapshot` | Repository has no completed snapshot | — |
| `snapshot_in_progress` | An attempt exists but none completed | `latestAttemptStatus` |
| `ready` | A completed snapshot exists | `snapshot`, `extraction`, `composition`, `totals` |

`snapshot`: `{ snapshotId: number; commitSha: string; completedAt: string }` — the newest `completed` row by `completed_at`.

`extraction`: `{ status: "not_started" | "in_progress" | "completed" | "completed_partial" | "failed"; extractorVersion: string | null; filesTotal; filesExtracted; filesSkippedUnsupported; filesFailed; symbolsExtracted }` — same semantics as Feature 002 `getExtractionStatus`; `symbols` state derived: `not_extracted` (not_started) | `partial` (completed_partial/failed/in_progress) | `empty` (completed, 0 symbols) | `available`.

`composition`: `{ buckets: { key: string; label: string; fileCount: number; bytes: number }[]; otherFileCount: number; otherBytes: number }` — at most `MAX_COMPOSITION_BUCKETS = 8` buckets (language from `file_extractions.language`, else file extension), remainder in `other*`.

`totals`: `{ files: number; bytes: number; directories: number | null }` (`directories` is `null` when the snapshot has no Feature 002 `directories` rows, i.e. no extraction yet).

## StructureLevel

Request `{ snapshotId, directoryPath: string ("" = root), cursor?: number, limit? }`.

```
StructureLevel {
  directoryPath: string
  directories: { path: string; name: string; fileCount: number; symbolCount: number | null }[]
  files: { path: string; name: string; sizeBytes: number; language: string | null;
           extractionStatus: "not_attempted" | "extracted" | "skipped_unsupported" | "failed"; symbolCount: number }[]
  nextCursor: number | null
  truncated: boolean   // more children exist than one page
}
```

`fileCount`/`symbolCount` for a directory are aggregate counts over its subtree, computed by bounded aggregate SELECTs; `symbolCount` is `null` when the snapshot has no extraction.

## FileSymbols

`{ path; language; extractionStatus; failureReason: string | null; symbolCount: number; symbols: { id; kind; name; qualifiedName; startLine; startColumn; endLine; endColumn; parentSymbolId: number | null }[]; truncated: boolean }` — at most `MAX_SYMBOLS_FETCH = 200`. Symbol detail uses the existing `getSymbol` (unchanged).

## RelationshipLayer (boundary)

```
RelationshipLayerState =
  | { status: "unavailable"; reason: "not_connected"; feature: "004" }
  // reserved shape for a later adapter (not produced in this feature):
  | { status: "available"; relationshipTypes: RelationshipType[]; evidenceStates: EvidenceState[] }

interface RelationshipLayer {
  getState(identity, snapshotId): Promise<RelationshipLayerState>
  // bounded traversal + candidate retrieval are declared for the future adapter but
  // are only reachable when getState returns "available"; not implemented here.
}
```

`RelationshipType` and `EvidenceState` are `import type` from `domain/relationship.ts`. The only implementation, `unavailableRelationshipLayer`, always returns `unavailable`.

## Layout (pure, client)

`layoutLevel(children, viewport) → { nodes: LayoutNode[]; overflow: OverflowNode[] }`: deterministic ordering (kind, then size desc, then name), radius from `sizeBytes`/counts (log-scaled, clamped), positions by phyllotaxis packing; `nodes.length + overflow.length ≤ MAX_VISIBLE_NODES`. Constants live in `src/lib/repo-intel/limits.ts`.

## State ownership

- Route: `owner`, `name`, and search params `path` (directory), `file` (file path), `symbol` (symbol id) — the only navigation state; bookmarkable.
- Query cache: overview, levels, symbols keyed by canonical identity + snapshotId + path.
- No zustand additions; no writes to `sources-store`, `atlas-store` filters or preferences.
