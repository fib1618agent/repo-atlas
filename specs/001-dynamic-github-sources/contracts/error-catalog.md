# Contract: Error catalog

Maps server `code` → user message → UI placement → actions.

Exact copy from `docs/dynamic-sources-prompt.md` §Error catalog. Implementation MUST NOT paraphrase user-facing strings.

| Code | When | User message | Placement | Actions |
|------|------|--------------|-----------|---------|
| `VALIDATION_EMPTY` | Load with no usable URLs | Add at least one GitHub user, org, or repository URL. | Dialog inline | Fix input |
| `VALIDATION_INVALID_URL` | Not GitHub | "{input}" is not a GitHub user, org, or repository URL. | Row | Fix URL |
| `TOO_MANY_SOURCES` | >5 sources | You can load at most 5 GitHub sources. | Dialog | Remove rows |
| `SOURCE_NOT_FOUND` | 404 user/org/repo | GitHub could not find "{login}". Check the URL. | Row + toast | Edit, Retry |
| `SOURCE_FORBIDDEN` | 401/403 not rate-limit | GitHub refused "{login}". If this is a private org, it cannot be loaded. | Toast | Remove row |
| `RATE_LIMITED` | 429 / limit 0 | GitHub rate limit reached. Try again later or set GITHUB_TOKEN in .env. | Toast | Retry, Dismiss |
| `NETWORK` | fetch failure | Could not reach GitHub. Check your connection and try again. | Toast | Retry |
| `GITHUB_5XX` | 5xx | GitHub is unavailable ({status}). Try again shortly. | Toast | Retry |
| `PARTIAL_FAILURE` | Some sources fail | Loaded {ok} source(s). {fail} failed. | Toast + dialog | Keep partial data |
| `DEFAULT_FALLBACK` | Default GitHub down | GitHub is unavailable. Showing the bundled default dataset. | Toast once/session | Dismiss |
| `EXPORT_EMPTY` | Export with 0 repos | Nothing to export yet. | Toast | Dismiss |
| `SQLITE_UNAVAILABLE` | Workers / no fs | (dev only) Local SQLite cache is off (no filesystem). Using memory cache. | Toast | Dismiss |
| `SQLITE_OPEN_FAILED` | DB open fail | Could not open SQLite at {path}. Using memory cache. | Toast | Dismiss |
| `AI_NOT_CONFIGURED` | No provider key | No API key for {provider}. Add it to .env (see .env.example). | Panel | Dismiss |
| `AI_PROVIDER_UNIMPLEMENTED` | Stub provider | {provider} is not wired yet. Using the metadata summary. | Panel | Dismiss |
| `AI_UPSTREAM` | LLM HTTP error | AI summary is unavailable. Showing a metadata summary instead. | Panel | Dismiss |

## Policies

- **Partial success**: If ≥1 source returns repos, return them with `warnings` + `PARTIAL_FAILURE`
- **Total failure**: Do not change active dataset; dialog stays open
- **Default fallback**: Only on default owner path; `sessionStorage` flag `repoatlas.toast.fallback` for once-per-session toast
