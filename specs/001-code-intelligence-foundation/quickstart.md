# Quickstart: Code Intelligence Foundation

Validation guide for the acceptance scenarios in `spec.md`. No visitor-facing UI exists — every scenario is exercised via `createServerFn` calls (contracts in `contracts/`) against local Wrangler/Miniflare-emulated D1/R2/Queues.

## Prerequisites

1. `wrangler.toml` created with `[[d1_databases]]`, `[[r2_buckets]]`, `[[queues.producers]]`/`[[queues.consumers]]` bindings (see plan.md Project Structure — this file does not exist yet in the repo and must be created as part of implementation, not this plan).
2. `data/code-intel-schema.sql` (contracts/d1-schema.sql) applied to the local D1 emulation: `wrangler d1 execute <DB_NAME> --local --file=contracts/d1-schema.sql`.
3. `GITHUB_TOKEN` set in `.env` (optional but recommended, same as today, to avoid unauthenticated rate limits during archive/API acquisition).
4. `bun install` (no new dependency expected — verify `package.json` diff stays empty for runtime deps).

## Run

```sh
wrangler dev --local   # or the project's existing dev command, with D1/R2/Queues bindings active
bun test tests/contract/code-intel/
bun test tests/integration/code-intel/
```

## Scenario walkthroughs

### US1 — Provider-independent identity

```ts
const gh = await acquireSnapshot({
  repository: { provider: "github", owner: "octocat", name: "Hello-World" },
  ref: "master",
});
// Confirm: gh.repository has no GitHub-specific fields beyond provider/owner/name.
// Repeat with { provider: "gitlab", owner: "octocat", name: "Hello-World" } (a stubbed
// ContentProvider or expected REF_NOT_FOUND/PROVIDER_UNIMPLEMENTED is acceptable —
// the point is the identity row is distinct and never collides with the GitHub one.)
```

**Expect**: two distinct `repositories` rows (verify via direct D1 query: `SELECT * FROM repositories WHERE owner='octocat' AND name='Hello-World'` returns 2 rows, differing only in `provider`).

### US2 — Deterministic ref resolution

```ts
const a = await acquireSnapshot({ repository: ghRepo, ref: "main" });
const b = await acquireSnapshot({
  repository: ghRepo,
  ref: "does-not-exist-branch",
});
```

**Expect**: `a.commitSha` is a 40-char SHA. `b` throws with `AtlasErrorCode: "REF_NOT_FOUND"`; no `snapshots` row created for the failed attempt (`SELECT COUNT(*) FROM snapshots WHERE repository_id = ?` unchanged before/after).

### US3 — Reproducible snapshot

```ts
const sha = "<a known small public repo's commit sha>";
const run1 = await acquireSnapshot({ repository: smallRepo, ref: sha });
await pollUntilComplete(run1.snapshotId);
const run2 = await acquireSnapshot({ repository: smallRepo, ref: sha });
```

**Expect**: `run2.reused === true`, `run2.snapshotId === run1.snapshotId`. File-by-file comparison (`listSnapshotFiles` + `getSnapshotFile` for each) against a second independently-triggered acquisition (delete the D1 row first to force a real re-run, or run against a second `attempt_number`) is byte-identical (SC-003).

### US4 — File inventory

```ts
const page1 = await listSnapshotFiles({ snapshotId, limit: 50 });
const page2 = await listSnapshotFiles({
  snapshotId,
  cursor: page1.nextCursor,
  limit: 50,
});
const file = await getSnapshotFile({ snapshotId, path: page1.files[0].path });
```

**Expect**: no single response exceeds `limit` entries; `getSnapshotFile` returns content matching `file.contentHash` (recompute SHA-256 of `file.content` and compare).

### US5 — Persistent storage across invocations

Run `acquireSnapshot` + wait for completion in one `wrangler dev` process; restart the process (or use a fresh `curl`/client call after a cold reload); call `getSnapshotStatus`/`getSnapshotFile` again.
**Expect**: identical metadata and byte-identical content — proves D1/R2 persistence survives the stateless-per-invocation Workers model (FR-021 boundary), not an in-memory artifact of the first process.

### US6 — Async, checkpointed, idempotent processing

Use a repository large enough to require ≥2 `AcquisitionJob` units (or lower the checkpoint threshold via the tunable config for test purposes). After acquisition, directly re-deliver one already-processed queue message to `snapshot-worker.ts` (simulating at-least-once redelivery).
**Expect**: `snapshot_files` row count for that snapshot is unchanged after the duplicate delivery (no duplicate rows); `acquisition_jobs` row for that unit is still `status='completed'`, not reprocessed into a new state (SC-005). Separately: kill/interrupt a unit mid-processing (or inject a forced failure) and confirm `getSnapshotStatus` never reports `"completed"` until a genuinely full run finishes (SC-006).

### US7 — Incremental synchronization foundation

```ts
const first = await acquireSnapshot({ repository: repo, ref: shaA });
await pollUntilComplete(first.snapshotId);
const second = await acquireSnapshot({ repository: repo, ref: shaB });
const history = await getRepositoryHistory({ repository: repo });
```

**Expect**: `second.acquisitionMode === "incremental_api"` (since a prior completed snapshot exists). `history` contains both `shaA` and `shaB`, ordered most-recent-first. For a repository with zero prior snapshots, `acquisitionMode === "bulk_archive"` and `getRepositoryHistory` returns `[]` before the first call.

## Regression check (existing atlas, SC-009)

```sh
bunx tsc --noEmit
bun run dev   # manually confirm: /, /catalogue, /categories, /insights unchanged
```

**Expect**: zero diff in behavior for the existing default-owner atlas, dynamic GitHub sources dialog, and 3D visualization — this feature introduces no route, component, or server-function change to any of them.
