# Data Model: GitHub Source Enhancement

All entities below are **client-side view-models or config shapes**, not new
persisted database rows — this feature adds no D1/R2/queue state (see
research.md §1–6). Where an entity is derived from existing data, its
derivation is stated explicitly.

## ConnectedSource

Read-only view-model for the Connected Sources popup (User Story 2, FR-007–FR-011).
Computed client-side from `useSourcesStore()` + `useAtlasRepositories()`
results — never persisted.

| Field | Type | Notes |
|---|---|---|
| `type` | `"github" \| "gitlab" \| "bitbucket" \| "local" \| "enterprise"` | Only `"github"` is ever populated by this feature; other members exist so the type/UI accommodate future providers without a shape change (FR-009). |
| `identity` | `string` | e.g. `"github.com/imdadareeph"` — derived from `sourceKey`/`urls` (default path) or from each parsed login in `urls` (custom path). |
| `repositoryCount` | `number` | Repositories in the current `repositories` array attributable to this identity. |
| `status` | `"connected" \| "degraded" \| "error"` | `"connected"` by default; `"degraded"` when this identity appears in `meta.sourceFailures` with a partial result; `"error"` when it produced zero repositories due to a failure (`SOURCE_NOT_FOUND`/`SOURCE_FORBIDDEN`). |
| `colorToken` | `string` | Existing design-token reference (e.g. reuse an existing category/status color token — no new palette introduced). |

**Derivation note**: when `isDefault` is `true`, exactly one `ConnectedSource`
exists (the configured default owner). When custom sources are active, one
`ConnectedSource` is derived per distinct login in `urls`, grouping
`repositories` by their source login (each `Repository` already carries
enough provenance — owner login — to group by, per existing `repositories.ts`
normalization).

## SourceInputMode

Not a persisted entity — a transient UI-only union used by the extended Add
Sources popup (User Story 3).

```ts
type SourceInputMode = "users" | "repositories";
```

- `"users"` (Mode 1): each row must parse to `kind: "user" | "org"` via the
  existing `parseGitHubSource`.
- `"repositories"` (Mode 2): each row must parse to `kind: "repo"`.

Both modes submit through the existing `getRepositories({ sources })` call
unchanged (research.md §3) — this type only gates client-side validation and
row-list labeling, it is never sent to the server.

## SelectedRepositoryForAnalysis

Extension-point type for User Story 6 / FR-017–FR-019. Populated client-side
when a visitor confirms Mode 2 selections. **Not sent to any server function
in this feature** — exists purely so a future feature has a stable shape to
consume.

```ts
type SelectedRepositoryForAnalysis = {
  provider: "github";       // matches Feature 001's RepositoryIdentity.provider
  owner: string;
  name: string;
  status: "added";          // never "analyzed" or "queued" until real analysis exists (FR-019)
};
```

Deliberately shaped to match Feature 001's existing `RepositoryIdentity`
(`src/lib/code-intel/domain/repository-identity.ts`: `{ provider, owner,
name }`) so a later feature can pass this directly to the existing
`acquireSnapshot` server function without a reshape — but no such call is
made by this feature (research.md §5).

## StartupSourceConfig

Server-side configuration, extending the existing `serverAtlasConfig()`
pattern (`src/lib/atlas-config.ts`) — not a database row, not visitor-facing.

| Field | Source | Default |
|---|---|---|
| `loadInitialSources` | env var `ATLAS_LOAD_INITIAL_SOURCES` | `true` (preserves current implicit behavior) |
| `initialSources` | env var `ATLAS_INITIAL_SOURCES` (JSON array string) | `[{ "type": "github", "owner": "<ATLAS_DEFAULT_OWNER>" }]` |

```ts
type InitialSourceEntry = { type: "github"; owner: string };
// type: "github" is the only value this feature parses; an unrecognized
// `type` in a hand-edited config value is skipped with a logged warning
// (spec Edge Cases), never a startup crash.
```

Consulted only by the existing "default path" in `getRepositories` (used
when the client has no persisted custom `urls` — research.md §4). Never
overrides a returning visitor's persisted `useSourcesStore` state.

## Relationships

```
useSourcesStore (existing)             StartupSourceConfig (new, server)
   ├─ urls, sourceKey, isDefault  ─┐         │
   │                               │         ▼ (consulted only when isDefault
   ▼                               │           and no persisted urls)
useAtlasRepositories (existing) ───┘   getRepositories default path (extended)
   │
   ├──► ConnectedSource[] (derived, new) ──► ConnectedSourcesDialog (new)
   │
   └──► ordinary repositories[] (existing, unchanged) ──► AtlasScene (untouched)

SourcesDialog (extended)
   ├─ SourceInputMode (new, transient)
   └─ on Mode 2 confirm ──► SelectedRepositoryForAnalysis[] (new, inert — no call made)
```
