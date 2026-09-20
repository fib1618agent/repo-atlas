# Contract: `getRepositories` default-path extension

`src/lib/repositories.functions.ts` — existing server function, **signature
unchanged** (`{ sources?: string[] }` → `RepositoriesResponse`). Only its
internal default-path behavior (used when `sources` is empty/omitted) gains a
new branch. Every existing call site (custom-sources path, cache read/write,
response shape) is untouched.

```ts
// unchanged signature
export const getRepositories = createServerFn({ method: "POST" })
  .validator((data: { sources?: string[] }) => data)
  .handler(async ({ data }): Promise<RepositoriesResponse> => { ... });
```

## Behavior contract

1. **Given** `data.sources` is empty/omitted (the default path) **and**
   `StartupSourceConfig.loadInitialSources` is `true` (default), **When**
   called, **Then** behavior is identical to today: fetch/cache the
   default-owner (or configured `initialSources`, if more than the single
   default owner is configured) repositories (FR-023, FR-024 — no
   regression from current behavior when the setting is left at its
   default).
2. **Given** the default path **and** `loadInitialSources` is `false`,
   **When** called, **Then** the function returns an explicit "not loaded"
   `RepositoriesResponse` (`repositories: []`, a `source` value distinguishable
   from `"live" | "cache" | "fallback"`, or an equivalent explicit
   not-loaded flag) instead of fetching the default owner (FR-025).
3. **Given** `initialSources` lists more than one entry, **When** the
   default path runs, **Then** all listed sources are fetched and combined,
   using the same multi-source combination logic already used for
   custom `sources` (FR-024's "combined-source behavior").
4. **Given** an `initialSources` entry has an unrecognized `type` (e.g.
   `"gitlab"` before that provider is supported), **When** the default path
   runs, **Then** that entry is skipped with a logged/reported warning; the
   remaining valid entries still load (Edge Cases — no startup crash).
5. **Given** the configured initial source is unreachable (rate-limited,
   not found), **When** startup auto-load fails, **Then** the existing
   fallback-to-bundled-JSON / error-messaging path already used by today's
   default-owner failure case applies unchanged (FR-027 — no new error
   handling introduced).

## Non-change guarantee

The custom-sources path (`data.sources` non-empty) — used by both Add
Sources modes (contracts/sources-menu-components.md) — is **not modified by
this contract**. `StartupSourceConfig` is consulted exclusively inside the
existing `isDefault` branch already present in `getRepositories`.
