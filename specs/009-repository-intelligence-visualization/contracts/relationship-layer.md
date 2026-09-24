# Contract: Relationship layer boundary (Feature 009 ↔ future Feature 004)

Purpose: give the visualization a stable seam so Feature 004 (currently BLOCKED at T007) can supply relationships later without rewriting Feature 009.

## Port

```ts
import type { RelationshipType, EvidenceState } from "../code-intel/domain/relationship"; // types only

export type RelationshipLayerState =
  | { status: "unavailable"; reason: "not_connected"; feature: "004" }
  | { status: "available"; relationshipTypes: RelationshipType[]; evidenceStates: EvidenceState[] };

export interface RelationshipLayer {
  getState(input: { owner: string; name: string; snapshotId: number }): Promise<RelationshipLayerState>;
}
```

Reserved for the later adapter (declared as comments/types, **not implemented** and unreachable in this feature): bounded traversal by relationship type and direction (mirrors Feature 004 `relationship-query` contract: paginated, never a full-graph read), evidence-state filters, and `AMBIGUOUS` candidate sets.

## Rules

1. The only implementation is `unavailableRelationshipLayer`; it performs no I/O.
2. No module in Feature 009 imports runtime code from `src/lib/code-intel/relationships/` (Feature 004 scaffolding); only types from `domain/relationship.ts`.
3. UI copy: relationship intelligence is "not yet connected (Feature 004 pending)". It MUST NOT say or imply that no relationships exist.
4. No element, datum or test fixture may contain `IMPORTS`, `CALLS`, `EXTENDS`, `IMPLEMENTS`, `USES`, `REFERENCES` or execution-path data as *displayed content*; the type names may appear only in the port's type imports and this documentation. A test (`deferred-scope.test.ts`) enforces this on rendered markup and on the layout input types.
5. Owner→repository and repository→file/symbol containment are structural facts, not relationships in this sense; they are labelled "structure", never "relationship".
6. When Feature 004 becomes available, the adapter is a new implementation of `RelationshipLayer`; layout/renderer receive relationship data through an additive prop and are unchanged for the structural path.
