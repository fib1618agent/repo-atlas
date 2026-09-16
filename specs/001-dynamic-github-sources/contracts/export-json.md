# Contract: JSON export (client-side)

**Trigger**: Header control `Export JSON`  
**Disabled when**: `isLoading` or `repositories.length === 0`

## Filename

```text
repoatlas-{sourceKey}-{YYYYMMDD}.json
```

`sourceKey` uses `+` between logins (e.g. `octocat+vercel`).

## Payload schema

```json
{
  "exportedAt": "2026-09-16T12:00:00.000Z",
  "sourceKey": "octocat",
  "isDefault": false,
  "sources": ["https://github.com/octocat"],
  "count": 42,
  "repositories": [
    {
      "id": 123,
      "name": "Hello-World",
      "fullName": "octocat/Hello-World",
      "htmlUrl": "https://github.com/octocat/Hello-World",
      "description": "...",
      "language": "C",
      "topics": [],
      "stars": 1000,
      "forks": 500,
      "openIssues": 10,
      "license": "MIT",
      "fork": false,
      "archived": false,
      "pushedAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z",
      "defaultBranch": "main",
      "category": "Other",
      "subgroup": "General Projects",
      "importance": 0.6,
      "sourceLogin": "octocat",
      "sourceKind": "user",
      "sourceUrl": "https://github.com/octocat"
    }
  ]
}
```

## Rules

- `repositories` = full active catalogue list (up to 2,000), not spiral-only 800
- `count` === `repositories.length`
- Metadata MUST match on-screen catalogue data at export time
- No API keys or env values in export

## Success toast

```text
Exported {n} repositories.
```

## Empty export

Error code `EXPORT_EMPTY`: `Nothing to export yet.`
