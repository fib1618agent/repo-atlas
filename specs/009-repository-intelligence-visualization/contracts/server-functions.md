# Contract: Server functions (Feature 009)

All three follow the repository pattern (plain handler exported for tests + `createServerFn({ method: "POST" })` wrapper). All are **read-only**: SELECT statements only; no INSERT/UPDATE/DELETE, no queue send, no R2 write. Inputs are validated (SEC-001) and bound as parameters. Failures are typed result states, not thrown errors, except input validation which returns `{ status: "invalid_request" }`.

## `getRepositoryIntelligence({ owner: string, name: string })` → `IntelligenceOverview | { status: "invalid_request" }`

- No D1 binding → `{ status: "unavailable", reason: "no_binding" }`.
- Repository row absent, or present with no snapshot rows → `{ status: "no_snapshot" }`. (The repository row is never created.)
- Only non-completed attempts → `{ status: "snapshot_in_progress", latestAttemptStatus }`.
- Newest `completed` snapshot by `completed_at` → `ready` with `snapshot`, `extraction`, `composition`, `totals` (see data-model.md).
- Identity match is exact on canonical `owner`/`name` supplied by the caller.

## `listStructureLevel({ snapshotId: number, directoryPath?: string, cursor?: number, limit?: number })` → `StructureLevel`

- `limit` defaults to `MAX_CHILDREN_PAGE` and is clamped to `min(limit, codeIntelConfig().listFilesMaxLimit)`.
- Unknown/non-completed snapshot → empty level (never throws), like Feature 001 `listSnapshotFiles`.
- `directoryPath` is normalized (no leading/trailing slash, no `..`); invalid → empty level.

## `listFileSymbols({ snapshotId: number, path: string })` → `FileSymbols`

- Unknown file → `extractionStatus: "not_attempted"`, `symbols: []`.
- At most `MAX_SYMBOLS_FETCH` symbols ordered by `start_line, start_column, id`; `truncated` set when more exist.

## Not provided (by design)

Any function that acquires, extracts, enqueues, deletes or edits; any function returning relationships.

## Registration

The three wrappers are referenced from `RepositoryIntelligenceView` via `useServerFn` (same mechanism as `settings.tsx`); no separate registration component is required because the route imports them.
