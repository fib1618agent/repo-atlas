# Contract: `extractSnapshotRelationships` server function

`src/lib/code-intel/relationship.functions.ts`. Same `createServerFn` plain-handler/wrapper pattern as `symbol.functions.ts`'s `extractSnapshotSymbols`. Internal/developer-triggered only — no UI calls this in this feature.

```ts
export const extractSnapshotRelationships = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number }) => data)
  .handler(async ({ data }): Promise<ExtractSnapshotRelationshipsResponse> => { ... });

type ExtractSnapshotRelationshipsResponse = {
  snapshotId: number;
  status: "in_progress" | "completed" | "completed_partial" | "failed";
  relationshipExtractorVersion: string;
  symbolExtractorVersion: string;
  /** true when an existing extraction for the current version pair was returned instead of starting a new one */
  reused: boolean;
};
```

## Behavior contract

1. **Given** a `snapshotId` whose Feature 002 `snapshot_extractions.status` is not `completed`/`completed_partial`, **When** called, **Then** the function throws a serialized `AtlasError` with code `SNAPSHOT_NOT_RELATIONSHIP_EXTRACTABLE`; no `snapshot_relationship_extractions` row is created (FR-010, spec Edge Cases).
2. **Given** a `snapshotId` with no existing `snapshot_relationship_extractions` row, **When** called, **Then** a new row is created (`status: "in_progress"`), the first `contains`-type `RelationshipExtractionJob` unit is enqueued to `RELATIONSHIP_QUEUE` (`unit_type = 'contains'` units run before any `unit_type = 'parsed'` unit, research.md §4), and the response reflects `reused: false`.
3. **Given** a `snapshotId` whose `snapshot_relationship_extractions.relationship_extractor_version` equals the current `RELATIONSHIP_EXTRACTOR_VERSION` **and** whose `symbol_extractor_version` equals the snapshot's current Feature 002 `SYMBOL_EXTRACTOR_VERSION`, and whose `status` is `completed`/`completed_partial`, **When** called, **Then** no new extraction is started; the existing status is returned with `reused: true` (FR-009).
4. **Given** a `snapshotId` whose `snapshot_relationship_extractions.status` is `in_progress` (concurrent request), **When** called, **Then** the in-progress status is returned, no duplicate job sequence is enqueued (FR-011).
5. **Given** a `snapshotId` whose recorded `symbol_extractor_version` differs from the snapshot's current Feature 002 `SYMBOL_EXTRACTOR_VERSION` (Feature 002 was re-extracted since this feature's last run), **When** called, **Then** a fresh relationship-extraction run starts (`reused: false`), even if `relationship_extractor_version` itself is unchanged (spec Edge Cases, FR-018). [AMENDED 2026-09-24 16:58 +04:00 — R6 D-R6-2:** this scenario covers version mismatch only. Same-version F002 re-extraction affecting relationship files must also make the affected dataset non-reusable (spec FR-018 note); the detection mechanism is not defined here and is left to implementation.**]**

## Errors

| Code | When |
|---|---|
| `SNAPSHOT_NOT_RELATIONSHIP_EXTRACTABLE` | Feature 002 `snapshot_extractions` for `snapshotId` has not reached `completed`/`completed_partial`, or does not exist |

New code is an additive member of `AtlasErrorCode` (`atlas-errors.ts`) — existing codes/messages unchanged (FR-017).

---

# Contract: `getRelationshipExtractionStatus` server function

```ts
export const getRelationshipExtractionStatus = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number }) => data)
  .handler(async ({ data }): Promise<RelationshipExtractionStatusResponse> => { ... });

type RelationshipExtractionStatusResponse = {
  snapshotId: number;
  status: "not_started" | "in_progress" | "completed" | "completed_partial" | "failed";
  relationshipExtractorVersion: string | null;
  symbolExtractorVersion: string | null;
  filesProcessed: number;
  relationshipsExtracted: number;
  relationshipsByType: Partial<Record<
    "CONTAINS" | "IMPORTS" | "EXPORTS" | "CALLS" | "EXTENDS" | "IMPLEMENTS" | "USES" | "REFERENCES",
    number
  >>;
  relationshipsByEvidenceState: Partial<Record<
    "EXTRACTED" | "RESOLVED" | "INFERRED" | "AMBIGUOUS" | "UNKNOWN",
    number
  >>;
};
```

`status: "not_started"` is returned (never an error) when no `snapshot_relationship_extractions` row exists yet — mirrors `getExtractionStatus`'s precedent (FR-013, spec User Story 4 Acceptance Scenario 4).

`relationshipsByEvidenceState` exists specifically so a caller can see the `AMBIGUOUS`/`UNKNOWN` proportion without a separate query — the honesty requirement FR-006/FR-007 impose at the data layer surfaces directly in the status summary, not only in individual edge reads.
