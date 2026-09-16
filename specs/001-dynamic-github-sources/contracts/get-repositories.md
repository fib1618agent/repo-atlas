# Contract: `getRepositories` server function

**Type**: TanStack Start `createServerFn`  
**Method**: `POST`  
**Auth**: None (public GitHub data); optional `GITHUB_TOKEN` server env

## Request

```ts
{
  sources?: string[];  // 0–5 raw URL/login strings; omit or [] for default owner
}
```

### Behavior

| `sources` | Path |
|-----------|------|
| omitted, `[]`, or all whitespace | Default owner (`ATLAS_DEFAULT_OWNER`, default `imdadareeph`); may use `repositories-fallback.json` on GitHub failure |
| 1–5 valid strings | Custom fetch; no default fallback JSON on failure |
| >5 after parse | Error `TOO_MANY_SOURCES` |

## Response `200`

```ts
{
  repositories: Repository[];     // ranked, max ATLAS_MAX_STORED_REPOS (2000)
  source: "live" | "cache" | "fallback";
  sourceKey: string;              // "imdadareeph" | sorted logins joined by "+"
  isDefault: boolean;
  warnings: Array<{ code: string; message: string }>;
  meta: {
    requested: number;            // source count
    fetched: number;              // before catalogue cap
    spiralCap: number;            // 800
    storedCap: number;            // 2000
    rateLimitRemaining?: number;
  };
}
```

### Invariants

- `source === "fallback"` implies `isDefault === true`
- `repositories` deduped by GitHub `id`
- Custom load excludes default owner repos unless default URL in `sources`
- Each `Repository` includes `sourceLogin`, `sourceKind`, `sourceUrl` when from custom path

## Errors

Structured throw or HTTP error body:

```ts
{ code: string; message: string; detail?: string }
```

Codes: see `error-catalog.md`.

## Client usage

```ts
queryKey: ["repositories", sourceKey]
queryFn: () => loadRepositories({
  data: isDefault ? {} : { sources: urls },
})
```

Use `placeholderData: keepPreviousData` on refetch.

**Loading UX (FR-021)**: While `isFetching` with prior data, keep marbles mounted on `/` and show the existing `AtlasLoading` overlay; do not swap to an empty canvas. Dialog Load button shows `Loading…` and is disabled per `sources-dialog-ui.md`.

## GitHub endpoints used (server only)

| Source kind | Endpoints |
|-------------|-----------|
| user-or-org | `/users/{login}/repos?per_page=100&page=N` then `/orgs/{login}/repos` on user 404 |
| org | `/orgs/{login}/repos` |
| repo | `/repos/{owner}/{repo}` |

Max 10 pages per list source. Concurrency 3 across sources.
