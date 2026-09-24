/**
 * Relationship layer boundary (Feature 009 FR-009,
 * specs/009-…/contracts/relationship-layer.md). Feature 004 (Engineering
 * Relationship Graph) is BLOCKED and supplies no data; the only implementation
 * here reports the layer as unavailable and performs no I/O. Types only are
 * imported from Feature 004's domain scaffolding: no runtime dependency.
 *
 * Reserved for a later adapter, deliberately not declared as callable here:
 * bounded traversal by relationship type and direction, evidence-state
 * filters and AMBIGUOUS candidate sets.
 */
import type {
  EvidenceState,
  RelationshipType,
} from "../code-intel/domain/relationship";

export type RelationshipLayerState =
  | { status: "unavailable"; reason: "not_connected"; feature: "004" }
  | {
      status: "available";
      relationshipTypes: RelationshipType[];
      evidenceStates: EvidenceState[];
    };

export interface RelationshipLayer {
  getState(input: {
    owner: string;
    name: string;
    snapshotId: number;
  }): Promise<RelationshipLayerState>;
}

export const UNAVAILABLE_RELATIONSHIP_STATE: RelationshipLayerState = {
  status: "unavailable",
  reason: "not_connected",
  feature: "004",
};

export const unavailableRelationshipLayer: RelationshipLayer = {
  getState: () => Promise.resolve(UNAVAILABLE_RELATIONSHIP_STATE),
};
