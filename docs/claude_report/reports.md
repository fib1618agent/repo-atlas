# R6 Identity Decisions Applied — Documentation Report

**Timestamp**: 2026-09-24 16:58 +04:00 · **Branch**: `feat/atlas-marble-interaction` · **HEAD**: `c576310` (unchanged). Documentation only: no source, test, script, schema, F002, or T007 change; no Cloudflare/LX-1; no commit or push.
**Preserved: T007 = STOPPED · X = UNKNOWN · Y = PARTIAL · LX-1 = NOT AUTHORIZED · FR-038 waiver = NOT ISSUED · F004 T008+ = NOT AUTHORIZED.**

## 1–2. Files and sections changed (all annotation-style, original text preserved; single authoritative resolution text is research.md "A3 Resolution")
- `specs/004-engineering-relationship-graph/spec.md`: FR-004; FR-018; Edge Case "Feature 002 re-extracts a snapshot".
- `…/data-model.md`: `relationship_extractor_version` row; "Deterministic snapshot-scoped identity" paragraph; "Re-extraction Mechanism" paragraph.
- `…/research.md`: three inline markers in A3 (FR-004 contradiction → RESOLVED; FR-018 "not changed" bullet → INCORRECT/superseded; retained-terms bullet → target confirmed) and new subsection **A3 Resolution** (D-R6-1..4).
- `…/plan.md`: "Idempotent Re-extraction & Dual-Version Provenance" paragraph.
- `…/tasks.md`: T005, T013, T040 (notes only; checkboxes unchanged; no task IDs added).
- `…/contracts/extract-relationships.functions.md`: scenario 5 note.
- Bookkeeping: `docs/claude_report/reports.md` (this file), `docs/progress/PROGRESS.md`, `docs/ROADMAP.md`, `docs/prompts/claude-prompts/prompt-log.md`.

## 3. D-R6-1 wording (B+C)
"relationship_extractor_version scopes the validity and provenance of a relationship extraction dataset; it is not an input to relationship_key." Stored as provenance, dataset validity scope, reuse determinant (FR-009). FR-004's "scoped to … the version" is read as dataset scope, not a hash term.

## 4. D-R6-2 wording
"Any F002 re-extraction affecting a file with existing relationships must invalidate or otherwise make stale the affected relationship dataset before those relationships are considered valid again." FR-018 version mismatch alone is insufficient (F002 spec Acceptance 4 supports same-version re-extraction; `replaceSymbolsForFile` renumbers ids). F002 unmodified and not responsible for relationship persistence; boundary defined in F004. Signaling mechanism and granularity (per file vs per snapshot) left to implementation; no current document defines one beyond version mismatch.

## 5. D-R6-3 identity contract
`${snapshotId} ${relationshipType} ${sourceKind} ${sourceRef} ${targetKind ?? "∅"} ${targetRef ?? "∅"} ${evidenceFilePath ?? "∅"} ${evidenceStartLine ?? "∅"} ${evidenceStartColumn ?? "∅"}`; symbol → `symbol_key`, file/directory → snapshot-scoped path; target stays in identity; no D1 AUTOINCREMENT ids; no `relationship_extractor_version`.

## 6. R4 annotations
**Not applied.** The five proposed stale-EXPORTS annotations (`research.md:46`, `tasks.md:49`, `tasks.md:127`, `plan.md:173`, `cpu-decomposition-results.md:7`) are outside this amendment. R4 decision C stands unchanged.

## 7. Remaining contradictions
- Stale D1-only EXPORTS text in the five places above (R4, unannotated).
- Code `relationship-identity.ts` (T005 `[X]`) and `contracts/d1-schema-additions.sql` still describe/implement the old row-id formula (documented as superseded, not modified).
- `data-model.md` identity paragraph still shows the old formula text, with the amendment note appended.
- Pre-existing, unrelated to R6: `research.md`/`plan.md` "10 ms confirmed for the queue consumer" vs X UNKNOWN.

## 8. Remaining user decisions
- How X and Y are established (LX-1 / FR-038 waiver / reviewed F004 amendment).
- Whether to apply the R4 annotations.
- Whether to approve R5 implementation (separate F002 remediation).
- Not decided in docs (implementation-time): D-R6-2 signaling mechanism and granularity; exact path normalization; collision behavior for facts sharing type/source/target/evidence start.

## 9–10. Confirmations
No source, code, test, script, schema, F002 or task implementation performed. **T007 remains STOPPED.**
