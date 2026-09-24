# Quickstart: Engineering Relationship Graph

Validates the feature end-to-end against small real fixture repos, mirroring Feature 002's `quickstart.md` shape.

## Prerequisites

- A Feature 001 snapshot that has already completed Feature 002 symbol extraction (`getExtractionStatus` reports `completed`/`completed_partial`) — e.g. reuse one of T068's five live-validated snapshots (`sindresorhus/pify`, `sindresorhus/is-plain-obj`, `sindresorhus/is-obj`, the Java Hello-World sample, or the TSX vite-boilerplate sample).
- Local dev: `bunx wrangler dev --local` (D1/R2/Queues emulation, matching Feature 001/002's established local-dev precedent).

## Scenario 1 — CONTAINS derives with zero parsing (User Story 1, FR-003)

1. Call `extractSnapshotRelationships({ snapshotId })` for a snapshot with a nested directory (e.g. `src/lib/`) and at least one class with a method.
2. Poll `getRelationshipExtractionStatus({ snapshotId })` until `status` includes at least the `contains` phase's completion signal.
3. Call `listRelationships({ snapshotId, direction: "outgoing", entityKind: "directory", entityId: <root dir id> })`.
4. **Expect**: a `CONTAINS` edge to every immediate child directory/file, `evidenceState: "EXTRACTED"`, `extractionMethod: "directory-hierarchy"`.
5. Call `listRelationships({ ..., entityKind: "symbol", entityId: <class symbol id> })` and **expect** a `CONTAINS` edge to each of its methods, `extractionMethod: "symbol-parent"`.

## Scenario 2 — IMPORTS resolves within the snapshot (User Story 1/3, FR-002/FR-006)

1. Use a fixture with one file importing another file present in the same snapshot, and one file importing an external package (not present in the snapshot).
2. After `extractSnapshotRelationships` reaches a terminal status, query outgoing `IMPORTS` relationships for the importing file.
3. **Expect**: the intra-snapshot import is `evidenceState: "RESOLVED"`, `targetKind: "file"` pointing at the imported file's `file_extractions` row. The external-package import is `evidenceState: "UNKNOWN"` (single canonical evidence-state value, per spec FR-006/Edge Cases — not a compound "EXTRACTED plus separate resolution-state"), `targetKind: null`, not omitted and not a thrown error.

## Scenario 3 — EXTENDS/IMPLEMENTS resolve to a same-snapshot symbol (User Story 1)

1. Use a fixture with a class `extends`ing another class and `implements`ing an interface, both present in the snapshot's extracted symbols.
2. **Expect**: two edges from the subclass symbol — `EXTENDS` → the parent class symbol, `IMPLEMENTS` → the interface symbol — both `evidenceState: "RESOLVED"`.

## Scenario 4 — Ambiguous CALLS is never silently resolved (User Story 3, FR-007)

1. Use a fixture with two same-named functions/methods in different scopes and a call site that cannot be deterministically disambiguated under the bounded indexed-lookup rule (research.md §2).
2. **Expect**: a `CALLS` relationship with `evidenceState: "AMBIGUOUS"`, `targetKind: null`, and `candidates` populated with both same-named symbol ids — never a single fabricated target.

## Scenario 5 — File-scoped failure containment (User Story 3, FR-008)

1. Include one file whose Feature 002 `file_extractions.status = 'failed'` (already malformed at the symbol layer) alongside otherwise-healthy files.
2. **Expect**: relationship extraction for the snapshot still reaches `completed`/`completed_partial`; the malformed file simply contributes no relationships (no crash, no effect on other files' relationships).

## Scenario 6 — Idempotent re-extraction (User Story 1 Acceptance Scenario 4, FR-009)

1. Run `extractSnapshotRelationships` to completion.
2. Record the full relationship set (ids + `relationship_key`s).
3. Run `extractSnapshotRelationships` again for the same `snapshotId` with no Feature 002 re-extraction in between.
4. **Expect**: `reused: true`, no new rows, identical relationship set.

## Scenario 7 — Symbol re-extraction invalidates prior relationships (Edge Cases, FR-018)

1. With Scenario 6's completed relationships in place, bump `SYMBOL_EXTRACTOR_VERSION` and re-run Feature 002 extraction for the snapshot.
2. Call `extractSnapshotRelationships` again.
3. **Expect**: `reused: false` (the recorded `symbol_extractor_version` no longer matches), a fresh relationship-extraction run starts.

## Scenario 8 — Bounded pagination (User Story 4)

1. Use a snapshot with enough relationships to exceed the default page size.
2. Call `listRelationships` once, then again with the returned `nextCursor`.
3. **Expect**: two disjoint pages, no duplicate/skipped `id`s, `nextCursor: null` on the final page.
