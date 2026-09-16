# Data Model: Dynamic GitHub Sources

**Feature**: `001-dynamic-github-sources`  
**Date**: 2026-09-16

## Entity relationship overview

```text
Source (1..5 per load)
  └── has many → RepositoryRecord (deduped by githubId across sources)

ActiveSourceSet
  ├── isDefault: boolean
  ├── sourceKey: string          # "imdadareeph" | "loginA+loginB"
  └── sources: Source[] | default owner implicit

AtlasDataset (API response)
  ├── repositories: Repository[]  # ranked, capped for catalogue
  ├── spiralRepositories: Repository[]  # top 800 of same ranking (client or server slice)
  └── meta + warnings
```

## Source

| Field | Type | Rules |
|-------|------|-------|
| `url` | string | Raw visitor input; trimmed |
| `canonicalUrl` | string | Normalized `https://github.com/...` |
| `login` | string | GitHub login or `owner/repo` for single-repo |
| `kind` | `"user" \| "org" \| "repo"` | Resolved at parse time |
| `addedAt` | ISO-8601 | SQLite only; server insert time |

**Validation**:
- Max 5 per load (`ATLAS_MAX_SOURCES`)
- Must parse as github.com user, org, or repo path
- Duplicates by `login` removed (first wins)

## Repository (extended)

Extends existing `Repository` in `src/lib/repositories.ts`:

| Field | Type | Rules |
|-------|------|-------|
| `id` | number | GitHub repo id; unique key for dedup |
| `name`, `fullName`, `htmlUrl`, … | existing | From GitHub API only |
| `category`, `subgroup`, `importance` | existing | From `normalizeRepository()` |
| `sourceLogin` | string | **New** — originating source login |
| `sourceKind` | `"user" \| "org" \| "repo"` | **New** |
| `sourceUrl` | string | **New** — canonical source URL |

**Filters**: `archived === false` only. Forks allowed.

## ActiveSourceSet (client)

Client state in `sources-store` (Zustand):

| Field | Type | Persisted | Rules |
|-------|------|-----------|-------|
| `urls` | string[] | yes | Last successful Load inputs; empty when default |
| `sourceKey` | string | yes | `"imdadareeph"` when default |
| `isDefault` | boolean | yes | `true` until first successful custom Load |
| `dialogOpen` | boolean | no | Ephemeral UI; opens dialog from any route header/chip |

**State transitions**:

```text
[Initial] isDefault=true, urls=[]
    → successful custom Load → isDefault=false, urls=[...], sourceKey=derived
    → Reset to default → isDefault=true, urls=[], sourceKey="imdadareeph"
```

Draft dialog rows are **not** persisted until Load succeeds.

## AtlasDataset (server response)

| Field | Type | Rules |
|-------|------|-------|
| `repositories` | Repository[] | Full catalogue set (≤2000), ranked |
| `source` | `"live" \| "cache" \| "fallback"` | `fallback` only if `isDefault` |
| `sourceKey` | string | |
| `isDefault` | boolean | |
| `warnings` | `{ code, message }[]` | Partial failures, truncation |
| `meta` | object | `requested`, `fetched`, caps, optional `rateLimitRemaining` |

## Ranking function

```text
sort(repos):
  ORDER BY stars DESC, pushedAt DESC (nulls last)
slice catalogue: [0..2000)
slice spiral:    catalogue[0..800)
```

## SQLite schema (Phase 2, local only)

See `data/schema.sql` in implementation handoff. Tables: `sources`, `repositories`, `ai_notes`, `meta`.

Keys never stored in SQLite.

## Export snapshot

| Field | Type |
|-------|------|
| `exportedAt` | ISO-8601 |
| `sourceKey` | string |
| `isDefault` | boolean |
| `sources` | string[] |
| `count` | number |
| `repositories` | Repository[] |

Filename: `repoatlas-{sourceKey}-{YYYYMMDD}.json`

## Error codes (structured)

Canonical list in `contracts/error-catalog.md`. Server throws `{ code, message, detail? }`; client maps to toast + inline UI.
