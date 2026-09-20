# Contract: `extractSnapshotSymbols` server function

`src/lib/code-intel/symbol.functions.ts`. Follows the exact `createServerFn` pattern Feature 001 established (`snapshot.functions.ts`): a plain, directly-callable handler function (business logic, callable from `bun test` without the TanStack Start `AsyncLocalStorage` request context) plus a thin `createServerFn` wrapper around it (the real RPC surface). Internal/developer-triggered only — no UI calls this in this feature (spec Assumptions), same posture as `acquireSnapshot`.

```ts
export const extractSnapshotSymbols = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number }) => data)
  .handler(async ({ data }): Promise<ExtractSnapshotSymbolsResponse> => { ... });

type ExtractSnapshotSymbolsResponse = {
  snapshotId: number;
  status: "in_progress" | "completed" | "completed_partial" | "failed";
  extractorVersion: string;
  /** true when an existing extraction for the current extractorVersion was returned instead of starting a new one */
  reused: boolean;
};
```

## Behavior contract

1. **Given** a `snapshotId` whose Feature 001 snapshot status is not `completed`, **When** called, **Then** the function throws a serialized `AtlasError` with code `SNAPSHOT_NOT_EXTRACTABLE`; no `snapshot_extractions` row is created (FR-015, Edge Cases).
2. **Given** a `snapshotId` with no existing `snapshot_extractions` row, **When** called, **Then** a new `snapshot_extractions` row is created (`status: "in_progress"`), the first `ExtractionJob` unit is enqueued to `SYMBOL_QUEUE`, and the response reflects `reused: false`.
3. **Given** a `snapshotId` whose `snapshot_extractions.extractor_version` already equals the current `SYMBOL_EXTRACTOR_VERSION` and whose `status` is `completed` or `completed_partial`, **When** called, **Then** no new extraction is started; the existing status is returned with `reused: true` (FR-013).
4. **Given** a `snapshotId` whose `snapshot_extractions.status` is `in_progress` (concurrent request), **When** called, **Then** the in-progress status is returned, no duplicate `ExtractionJob` sequence is enqueued (Edge Cases, mirrors Feature 001's `acquireSnapshot` concurrent-request handling).
5. **Given** a `snapshotId` whose `snapshot_extractions.extractor_version` differs from the current `SYMBOL_EXTRACTOR_VERSION` (an extractor/grammar upgrade since the last extraction), **When** called, **Then** a fresh extraction run starts (`reused: false`), re-processing every file under the new version (FR-014).

## Errors

| Code | When |
|---|---|
| `SNAPSHOT_NOT_EXTRACTABLE` | Feature 001 snapshot for `snapshotId` is not `completed`, or does not exist |

New code is an additive member of `AtlasErrorCode` (`atlas-errors.ts`) — existing codes/messages unchanged, matching Feature 001's own FR-039-style protection.

---

# Contract: `getExtractionStatus` server function

```ts
export const getExtractionStatus = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number }) => data)
  .handler(async ({ data }): Promise<ExtractionStatusResponse> => { ... });

type ExtractionStatusResponse = {
  snapshotId: number;
  status: "not_started" | "in_progress" | "completed" | "completed_partial" | "failed";
  extractorVersion: string | null;
  filesTotal: number;
  filesExtracted: number;
  filesSkippedUnsupported: number;
  filesFailed: number;
  symbolsExtracted: number;
};
```

`status: "not_started"` is returned (never an error) when no `snapshot_extractions` row exists yet — mirrors `listSnapshotFiles`'s "never throws, returns an empty/not-ready shape" precedent (Feature 001 FR-009) rather than `getSnapshotStatus`'s throw-on-unknown-id behavior, since "extraction never attempted" is an expected, common state here (every completed Feature 001 snapshot starts this way), not an error condition.
