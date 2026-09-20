/**
 * Access to Cloudflare Workers bindings (D1/R2/Queues) declared in
 * `wrangler.toml`. Nitro's `cloudflare-module` preset stashes the per-request
 * `env` object on `globalThis.__env__` for every fetch/queue/scheduled
 * invocation (see `node_modules/nitro/dist/presets/cloudflare/runtime/_module-handler.mjs`)
 * — this is the only binding-access mechanism available to code that isn't
 * itself the top-level Worker entry, which is exactly the position every
 * `code-intel` server function and queue-consumer function is in.
 *
 * Minimal structural types below (not `@cloudflare/workers-types`, no new
 * dependency — plan.md's "no new npm dependency" posture) covering only the
 * D1/R2/Queue surface this feature actually calls.
 */

export type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
  meta: { last_row_id?: number; changes?: number };
};

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(colName?: string): Promise<T | null>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface R2ObjectBodyLike {
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(
    key: string,
    value: Uint8Array | ReadableStream<Uint8Array>,
  ): Promise<unknown>;
  head(key: string): Promise<unknown | null>;
}

export interface QueueLike<T = unknown> {
  send(message: T): Promise<void>;
}

export type CloudflareEnv = {
  DB?: D1DatabaseLike;
  SNAPSHOTS?: R2BucketLike;
  SNAPSHOT_QUEUE?: QueueLike;
  /** AST + Symbol Intelligence (specs/002-ast-symbol-intelligence) — topic `repo-atlas-symbol-extraction`, independent of SNAPSHOT_QUEUE (research.md §8). */
  SYMBOL_QUEUE?: QueueLike;
};

export function getCloudflareEnv(): CloudflareEnv | undefined {
  return (globalThis as { __env__?: CloudflareEnv }).__env__;
}

/** Injectable overrides for local dev / tests where `globalThis.__env__` isn't populated (e.g. `bun test`, not run under `wrangler dev`). */
let testEnvOverride: CloudflareEnv | undefined;

export function setTestCloudflareEnv(env: CloudflareEnv | undefined): void {
  testEnvOverride = env;
}

function resolveEnv(): CloudflareEnv | undefined {
  return testEnvOverride ?? getCloudflareEnv();
}

export function canUseD1(): boolean {
  return Boolean(resolveEnv()?.DB);
}

export function canUseR2(): boolean {
  return Boolean(resolveEnv()?.SNAPSHOTS);
}

export function getD1(): D1DatabaseLike {
  const db = resolveEnv()?.DB;
  if (!db) {
    throw new Error(
      "D1 binding (env.DB) unavailable — Code Intelligence snapshot acquisition requires running under `wrangler dev` (local D1 emulation) or a deployed Worker, not plain `vite dev`. See quickstart.md.",
    );
  }
  return db;
}

export function getR2(): R2BucketLike {
  const bucket = resolveEnv()?.SNAPSHOTS;
  if (!bucket) {
    throw new Error(
      "R2 binding (env.SNAPSHOTS) unavailable — Code Intelligence snapshot acquisition requires running under `wrangler dev` (local R2 emulation) or a deployed Worker, not plain `vite dev`. See quickstart.md.",
    );
  }
  return bucket;
}

export function getSnapshotQueue(): QueueLike {
  const queue = resolveEnv()?.SNAPSHOT_QUEUE;
  if (!queue) {
    throw new Error(
      "Queue binding (env.SNAPSHOT_QUEUE) unavailable — Code Intelligence snapshot acquisition requires running under `wrangler dev` (local Queues emulation) or a deployed Worker, not plain `vite dev`. See quickstart.md.",
    );
  }
  return queue;
}

/** AST + Symbol Intelligence (specs/002-ast-symbol-intelligence) — mirrors getSnapshotQueue() exactly, for the independent SYMBOL_QUEUE binding (topic repo-atlas-symbol-extraction). */
export function getSymbolQueue(): QueueLike {
  const queue = resolveEnv()?.SYMBOL_QUEUE;
  if (!queue) {
    throw new Error(
      "Queue binding (env.SYMBOL_QUEUE) unavailable — AST + Symbol Intelligence extraction requires running under `wrangler dev` (local Queues emulation) or a deployed Worker, not plain `vite dev`. See quickstart.md.",
    );
  }
  return queue;
}
