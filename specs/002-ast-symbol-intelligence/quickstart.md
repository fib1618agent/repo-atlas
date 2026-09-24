# Quickstart: AST + Symbol Intelligence

Validation guide for the acceptance scenarios in `spec.md`. No visitor-facing UI exists — every scenario is exercised via `createServerFn` calls (contracts in `contracts/`), same posture as Feature 001's own quickstart. Requires a **completed** Feature 001 snapshot as a precondition for every scenario below (Edge Cases, FR-015).

## Prerequisites

1. Feature 001 already deployed/running (`wrangler.toml`'s `DB`/`SNAPSHOTS`/`SNAPSHOT_QUEUE` bindings) — unchanged by this feature.
2. `data/code-intel-schema.sql` updated with `contracts/d1-schema-additions.sql`'s new tables, applied to the local D1 emulation: `wrangler d1 execute <DB_NAME> --local --file=data/code-intel-schema.sql` (same file Feature 001 already applies — additive, safe to re-apply via `CREATE TABLE IF NOT EXISTS`).
3. `wrangler.toml` updated with the new `repo-atlas-symbol-extraction` queue's producer/consumer entries (research.md §8) — additive alongside the existing `repo-atlas-snapshot-acquisition` entries, not a replacement.
4. `web-tree-sitter` + `tree-sitter-wasms` added to `package.json` (the only new runtime dependencies this feature introduces — verify `bun install` after adding them does not pull in any native/binary dependency, consistent with plan.md's "no dependency that cannot run in the deployed Worker" constraint).
5. A completed Feature 001 snapshot to extract from — reuse the same `octocat/Hello-World`-style small public repository pattern Feature 001's own live validation used, plus at least one fixture repository per Tier 1 language for the acceptance scenarios below (a small Java, a small JavaScript, and a small TypeScript/TSX repository or fixture file set).

## Run

```sh
wrangler dev --local   # or the project's existing dev command, with D1/R2/Queues bindings active (both queues)
bun test tests/contract/symbols/
bun test tests/integration/symbols/
```

## Scenario walkthroughs

### US1 — Structural symbol extraction from a completed snapshot

```ts
const snapshot = await acquireSnapshot({ repository: javaRepo, ref: "main" });
await pollUntilComplete(snapshot.snapshotId); // Feature 001, unchanged
const extraction = await extractSnapshotSymbols({ snapshotId: snapshot.snapshotId });
await pollUntilExtractionComplete(extraction.snapshotId);
const page = await listSymbols({ snapshotId: snapshot.snapshotId, kind: "class" });
```

**Expect**: `page.symbols` contains every top-level class declared in the fixture repository's Java files, each with a non-null source range. Repeat with a JavaScript and a TypeScript/TSX fixture repository — each Tier 1 language's representative fixture produces its expected Module/Class/Interface/Function/Method symbols (`sdd/03-ast-symbols/PHASE.md` acceptance criterion, SC-001). Re-run `extractSnapshotSymbols` for the same `snapshotId` with no extractor change; confirm `listSymbols`'s result set is byte-for-byte identical (SC-003).

### US2 — Symbol identity, source ranges, and provenance

```ts
const detail = await getSymbol({ symbolId: page.symbols[0].id });
```

**Expect**: `detail.provenance` resolves `filePath`, `snapshotId`, `repository`, and `commitSha` in this one call (SC-002). Re-fetch `getSymbol` with the same id in a separate later invocation (simulating a fresh Worker isolate, `wrangler dev` restart) and confirm identical output (persistence survives invocation boundaries, mirroring Feature 001 US5).

### US3 — Graceful handling of unsupported languages and malformed source

```ts
// Fixture snapshot containing: one valid .ts file, one .png (unsupported), one syntactically-broken .ts file
const extraction = await extractSnapshotSymbols({ snapshotId: mixedSnapshot.snapshotId });
await pollUntilExtractionComplete(extraction.snapshotId);
const status = await getExtractionStatus({ snapshotId: mixedSnapshot.snapshotId });
const pngResult = await getFileExtraction({ snapshotId: mixedSnapshot.snapshotId, path: "image.png" });
const brokenResult = await getFileExtraction({ snapshotId: mixedSnapshot.snapshotId, path: "broken.ts" });
```

**Expect**: `status.status === "completed_partial"`, `status.filesSkippedUnsupported === 1`, `status.filesFailed === 1`. `pngResult.status === "skipped_unsupported"`. `brokenResult.status === "failed"` with a non-null `failureReason`. `listSymbols` for the valid `.ts` file's symbols still returns them (SC-004) — one file's failure does not block or corrupt another file's already-recorded symbols.

### US4 — Asynchronous, checkpointed, idempotent processing

Use a repository large enough to require ≥2 `ExtractionJob` units (or lower the batch-size tunable for test purposes, mirroring Feature 001's own checkpoint-threshold test pattern). After extraction, directly re-deliver one already-processed queue message to the symbol-extraction queue worker (simulating at-least-once redelivery).

**Expect**: `symbols` row count for the affected file(s) is unchanged after the duplicate delivery (SC-005). Separately: kill/interrupt a unit mid-processing (or inject a forced failure) and confirm `getExtractionStatus` never reports `"completed"`/`"completed_partial"` until a genuinely full run finishes (mirrors Feature 001 US6/SC-006).

### US5 — Queryable symbol retrieval

```ts
const page1 = await listSymbols({ snapshotId, limit: 50 });
const page2 = await listSymbols({ snapshotId, cursor: page1.nextCursor, limit: 50 });
```

**Expect**: no single response exceeds `limit` entries (mirrors Feature 001 US4's file-inventory pagination contract exactly, one layer up at the symbol level).

## Regression check (existing atlas + Feature 001, SC-007)

```sh
bunx tsc --noEmit
bun run test   # existing suite + tests/contract/code-intel/, tests/integration/code-intel/ (Feature 001) must still pass unmodified
bun run dev    # manually confirm: /, /catalogue, /categories, /insights unchanged
```

**Expect**: zero diff in behavior for the existing default-owner atlas and Feature 001's snapshot acquisition RPCs — this feature introduces no route, component, or change to any existing server function (FR-026, FR-027).
