# Contract: snapshot query server functions

`src/lib/code-intel/snapshot.functions.ts`. Read-only; used by later features (a future AST-extraction trigger) and by acceptance testing. All co-located with `acquireSnapshot` in the same module.

```ts
export const getSnapshotStatus = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number }) => data)
  .handler(async ({ data }): Promise<SnapshotStatusResponse> => { ... });

type SnapshotStatusResponse = {
  snapshotId: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  unitsCompleted: number;
  unitsTotalKnown: number | null; // null until determinable (dynamic checkpointing)
  filesProcessed: number;
  bytesProcessed: number;
};

export const listSnapshotFiles = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number; cursor?: number; limit?: number }) => data)
  .handler(async ({ data }): Promise<SnapshotFilesPage> => { ... });

type SnapshotFilesPage = {
  files: { path: string; sizeBytes: number; contentHash: string }[];
  nextCursor: number | null;
};

export const getSnapshotFile = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number; path: string }) => data)
  .handler(async ({ data }): Promise<SnapshotFileContent> => { ... });

type SnapshotFileContent = {
  path: string;
  sizeBytes: number;
  contentHash: string;
  content: Uint8Array;
};

export const getRepositoryHistory = createServerFn({ method: "POST" })
  .validator((data: { repository: RepositoryIdentity }) => data)
  .handler(async ({ data }): Promise<RepositoryHistoryEntry[]> => { ... });

/**
 * Completed-snapshot history only. Every entry's snapshot acquisition attempt
 * has status="completed" by construction — status is omitted from this type
 * because it can never vary. In-progress/pending/failed acquisition attempts
 * are operational state, not repository history; query them via
 * getSnapshotStatus(snapshotId), not this function.
 */
type RepositoryHistoryEntry = {
  snapshotId: number;
  commitSha: string;
  completedAt: string;
};
```

## Completed snapshot history vs. operational acquisition state

`getRepositoryHistory` answers "what commit SHAs does this repository have a **completed, immutable snapshot** for, most recent first" — it is a history of evidence, not a log of processing activity. It reads only `snapshots` rows with `status="completed"`.

It deliberately does **not** surface:

- `snapshots` rows for a `failed` or still-`in_progress` **snapshot acquisition attempt** — these are operational state for the _current_ acquisition of a given commit SHA, queryable via `getSnapshotStatus(snapshotId)` while the attempt is active, not part of the repository's history of completed source states.
- `acquisition_attempts` rows (the **acquisition attempt log** — one per snapshot acquisition attempt, recording start/end time, status, duration for observability/operational triage). This table is never read by any function in this contract; it exists solely for the operator-facing observability described in plan.md's Observability section (FR-035).

A repository may have zero, one, or many failed/abandoned acquisition attempts for a commit SHA that never produced a completed snapshot — none of them appear in `getRepositoryHistory`, and a `RepositoryHistoryEntry` never represents one of them.

## Behavior contract

1. `getSnapshotStatus` on a non-existent `snapshotId` throws `SNAPSHOT_NOT_FOUND`.
2. `listSnapshotFiles` on a snapshot whose `status !== "completed"` MUST return an empty page (files are not exposed as evidence until completion, FR-009) rather than throwing — callers distinguish "not yet ready" from "doesn't exist" via a prior `getSnapshotStatus` call.
3. `listSnapshotFiles` MUST always return a bounded page (`limit`, default and max enforced server-side) — never every file in one unbounded response (FR-020, US4 Acceptance Scenario 3).
4. `getSnapshotFile` fetches exactly one file's content via its own R2 key, independent of any other file's retrieval (FR-019) — implementation MUST NOT read or touch any other file's R2 object to serve this call.
5. `getRepositoryHistory` MUST query only `snapshots` rows with `status="completed"` for the given repository, ordered `completedAt DESC` (most recent completed snapshot first, FR-028). It MUST NOT include a `failed`, `in_progress`, or `pending` snapshot acquisition attempt, and MUST NOT read the `acquisition_attempts` (acquisition attempt log) table. Returns an empty array (not an error) for a repository with no completed snapshot (US7 Acceptance Scenario 3).
