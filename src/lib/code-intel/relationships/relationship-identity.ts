import { createHash } from "node:crypto";
import type { EntityKind, RelationshipType } from "../domain/relationship";

/**
 * Deterministic snapshot-scoped relationship identity (FR-004,
 * data-model.md's Relationship entity). Direct structural port of
 * symbols/symbol-identity.ts's computeSymbolKey. SHA-256 hex of the exact
 * canonical string `${snapshotId} ${relationshipType} ${sourceKind}
 * ${sourceId} ${targetKind ?? "∅"} ${targetId ?? "∅"}
 * ${evidenceFileExtractionId ?? "∅"} ${evidenceStartLine ?? "∅"}
 * ${evidenceStartColumn ?? "∅"}` — field order and single-space separators
 * are significant, no other normalization is applied.
 */
export function computeRelationshipKey(params: {
  snapshotId: number;
  relationshipType: RelationshipType;
  sourceKind: EntityKind;
  sourceId: number;
  targetKind: EntityKind | null;
  targetId: number | null;
  evidenceFileExtractionId: number | null;
  evidenceStartLine: number | null;
  evidenceStartColumn: number | null;
}): string {
  const {
    snapshotId,
    relationshipType,
    sourceKind,
    sourceId,
    targetKind,
    targetId,
    evidenceFileExtractionId,
    evidenceStartLine,
    evidenceStartColumn,
  } = params;
  const canonical = `${snapshotId} ${relationshipType} ${sourceKind} ${sourceId} ${targetKind ?? "∅"} ${targetId ?? "∅"} ${evidenceFileExtractionId ?? "∅"} ${evidenceStartLine ?? "∅"} ${evidenceStartColumn ?? "∅"}`;
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
