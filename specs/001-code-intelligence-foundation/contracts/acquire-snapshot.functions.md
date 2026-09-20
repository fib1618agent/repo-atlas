# Contract: `acquireSnapshot` server function

`src/lib/code-intel/snapshot.functions.ts`. Follows the existing `createServerFn` pattern (`repositories.functions.ts`). Internal/developer-triggered only — no UI calls this in this feature (spec Assumptions).

```ts
export const acquireSnapshot = createServerFn({ method: "POST" })
  .validator((data: { repository: RepositoryIdentity; ref: string }) => data)
  .handler(async ({ data }): Promise<AcquireSnapshotResponse> => { ... });

type AcquireSnapshotResponse = {
  snapshotId: number;
  repository: RepositoryIdentity;
  commitSha: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  acquisitionMode: "bulk_archive" | "incremental_api";
  /** true when an existing completed/in-progress snapshot was returned instead of starting a new one */
  reused: boolean;
};
```

## Behavior contract

1. **Given** a `(repository, ref)` where `ref` resolves successfully and no snapshot exists for the resulting SHA, **When** called, **Then** a new `snapshots` row is created (`status: "pending"` → `"in_progress"`), the first `AcquisitionJob` is enqueued, and the response reflects the in-progress state with `reused: false` (User Story 3).
2. **Given** a `(repository, ref)` resolving to a SHA with an existing `completed` snapshot, **When** called, **Then** no new snapshot is created; the existing snapshot's data is returned with `reused: true` (FR-008, Edge Cases §"same commit SHA requested a second time").
3. **Given** a `(repository, ref)` resolving to a SHA with an existing `in_progress` snapshot (concurrent request), **When** called, **Then** the in-progress snapshot's id/status is returned, no duplicate snapshot is created (Edge Cases §"two acquisition requests... triggered concurrently").
4. **Given** a `ref` that does not exist on the provider, **When** called, **Then** the function throws a serialized `AtlasError` with code `REF_NOT_FOUND`; no `snapshots` row is created (FR-007).
5. **Given** a `(repository, commitSha)` directly (already-known SHA passed as `ref`), **When** called, **Then** `resolveRef` still runs (idempotent — a SHA resolves to itself) and no separate "skip resolution" code path is required (FR-005 Acceptance Scenario 4 is satisfied by resolution being cheap/idempotent for an already-resolved SHA, not by a special-cased bypass).

## Errors

| Code                               | When                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `REF_NOT_FOUND`                    | ref does not exist on provider                                          |
| `ARCHIVE_UNAVAILABLE`              | provider archive endpoint unreachable/rate-limited at acquisition start |
| `SNAPSHOT_REPOSITORY_UNAUTHORIZED` | repository is private/inaccessible to configured credentials (FR-034)   |

All new codes are additive members of `AtlasErrorCode` (`atlas-errors.ts`) — existing codes/messages unchanged.
