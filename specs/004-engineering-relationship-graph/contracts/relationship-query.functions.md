# Contract: `listRelationships` server function

`src/lib/code-intel/relationship.functions.ts`. Read-only query surface backing FR-014/User Story 4. Mirrors `symbol.functions.ts`'s `listSymbols` pagination shape.

```ts
export const listRelationships = createServerFn({ method: "POST" })
  .validator((data: {
    snapshotId: number;
    /** Which side of the edge `entityKind`/`entityId` anchors */
    direction: "outgoing" | "incoming";
    entityKind: "directory" | "file" | "symbol";
    entityId: number;
    relationshipType?: "CONTAINS" | "IMPORTS" | "EXPORTS" | "CALLS" | "EXTENDS" | "IMPLEMENTS" | "USES" | "REFERENCES";
    limit?: number;
    cursor?: string;
  }) => data)
  .handler(async ({ data }): Promise<ListRelationshipsResponse> => { ... });

type ListRelationshipsResponse = {
  relationships: RelationshipView[];
  nextCursor: string | null;
};

type RelationshipView = {
  id: number;
  relationshipType: string;
  sourceKind: "directory" | "file" | "symbol";
  sourceId: number;
  targetKind: "directory" | "file" | "symbol" | null;
  targetId: number | null;
  evidenceState: "EXTRACTED" | "RESOLVED" | "INFERRED" | "AMBIGUOUS" | "UNKNOWN";
  confidence: number | null;
  evidenceLocation: { fileExtractionId: number; startLine: number; startColumn: number; endLine: number; endColumn: number } | null;
  extractionMethod: string;
  candidates: { candidateKind: "symbol" | "file"; candidateId: number }[]; // non-empty only when evidenceState === "AMBIGUOUS"
};
```

## Behavior contract

1. **Given** `direction: "outgoing"`, **When** called, **Then** the system MUST return exactly the `relationships` rows where `source_kind = entityKind AND source_id = entityId`, scoped to `snapshotId`, optionally filtered by `relationshipType` (User Story 4, Acceptance Scenario 1).
2. **Given** `direction: "incoming"`, **When** called, **Then** the system MUST return exactly the rows where `target_kind = entityKind AND target_id = entityId` (Acceptance Scenario 2).
3. **Given** a result set larger than `limit` (default matches Feature 002's `CODE_INTEL_LIST_FILES_DEFAULT_LIMIT` pattern via a sibling config constant), **When** called again with the returned `nextCursor`, **Then** the system MUST return the next page with no duplicate/skipped rows relative to the first page (Acceptance Scenario 3, id-ordered cursor, same shape as `listSnapshotFilesPage`/`listSymbols`).
4. **Given** an `AMBIGUOUS` relationship, **When** returned, **Then** `candidates` MUST be populated from `relationship_candidates`; for every other evidence state, `candidates` MUST be an empty array (FR-007).

## Errors

None — an unknown `entityId`/empty relationship set returns `{ relationships: [], nextCursor: null }`, never throws, matching `listSymbols`'/`listSnapshotFiles`'s "never throws, empty-shape" precedent.

---

# Contract: `getRelationship` server function

```ts
export const getRelationship = createServerFn({ method: "POST" })
  .validator((data: { relationshipId: number }) => data)
  .handler(async ({ data }): Promise<RelationshipView | null> => { ... });
```

Returns `null` (never throws) when `relationshipId` does not exist, mirroring `getSymbol`'s not-found precedent. Provenance (snapshot → repository → commit SHA) is resolved via the standard join chain through `snapshots`/`repositories`, matching FR-005's requirement, and is included in the response's `RelationshipView` (omitted above for brevity — same join shape `getSymbol` already performs).
