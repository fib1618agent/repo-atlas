/**
 * Domain types for the Engineering Relationship Graph feature's four D1
 * entities (specs/004-engineering-relationship-graph/data-model.md). Mirrors
 * domain/symbol.ts's shape exactly — persisted row shapes, not a
 * pre-persistence IR.
 */

export type RelationshipType =
  | "CONTAINS"
  | "IMPORTS"
  | "EXPORTS"
  | "CALLS"
  | "EXTENDS"
  | "IMPLEMENTS"
  | "USES"
  | "REFERENCES";

/** The single canonical evidence-state field (research.md §2, closes /speckit-analyze H2) — never a compound value. */
export type EvidenceState = "EXTRACTED" | "RESOLVED" | "INFERRED" | "AMBIGUOUS" | "UNKNOWN";

export type EntityKind = "directory" | "file" | "symbol";

export type RelationshipUnitType = "contains" | "parsed";

export type RelationshipExtractionJobStatus = "pending" | "retrying" | "failed" | "completed";

export type SnapshotRelationshipExtractionStatus =
  "in_progress" | "completed" | "completed_partial" | "failed";

export type Relationship = {
  id: number;
  snapshotId: number;
  relationshipType: RelationshipType;
  sourceKind: EntityKind;
  sourceId: number;
  targetKind: EntityKind | null;
  targetId: number | null;
  evidenceState: EvidenceState;
  confidence: number | null;
  evidenceFileExtractionId: number | null;
  evidenceStartLine: number | null;
  evidenceStartColumn: number | null;
  evidenceEndLine: number | null;
  evidenceEndColumn: number | null;
  extractionMethod: string;
  relationshipExtractorVersion: string;
  symbolExtractorVersion: string;
  relationshipKey: string;
  createdAt: string;
};

export type RelationshipCandidate = {
  id: number;
  relationshipId: number;
  candidateKind: "symbol" | "file";
  candidateId: number;
};

export type RelationshipExtractionJob = {
  id: number;
  snapshotId: number;
  unitIndex: number;
  unitType: RelationshipUnitType;
  status: RelationshipExtractionJobStatus;
  checkpointCursor: string | null;
  retryCount: number;
  failureReason: string | null;
  filesProcessed: number;
  relationshipsExtracted: number;
  updatedAt: string;
};

export type SnapshotRelationshipExtraction = {
  snapshotId: number;
  status: SnapshotRelationshipExtractionStatus;
  relationshipExtractorVersion: string;
  symbolExtractorVersion: string;
  startedAt: string;
  completedAt: string | null;
};
