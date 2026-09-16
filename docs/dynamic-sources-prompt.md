# Dynamic GitHub sources — implementation prompt

Use this document to **plan, then implement** multi-user GitHub loading for RepoAtlas.

It is the single source of truth for: default owner behavior, the add-sources popup, URL parsing, caps, SQLite cache, JSON export, error copy, recovery actions, scripts, `.env.example`, and a forward-compatible AI provider adapter.

Do not invent extra product surface. Follow the phases. Keep the spiral, taxonomy, hover card, and right panel as they are unless a section below names a file.

---

## Copy-paste prompt

```
Implement RepoAtlas dynamic GitHub sources exactly as specified in
docs/dynamic-sources-prompt.md.

## Invariants (do not break)

1. Default owner stays hardcoded `imdadareeph` until the user successfully
   Loads at least one custom GitHub URL. Empty popup / cancel / first visit
   must behave exactly as today (live GitHub fetch → bundled fallback JSON).
2. AtlasScene is already data-driven. Pass an updated `repositories` array;
   do not rewrite funnel math, dust, or links.
3. Landing (`/`), Catalogue, Categories, and Insights must share one React
   Query key derived from the active source list so all pages update together.
4. Never commit `.env`, API keys, or `data/atlas.sqlite`. Template is
   `.env.example`. Never expose keys via `VITE_*`.
5. Native SQLite is local/Bun/Node only. Production build uses Cloudflare
   Workers (no filesystem). SQLite must be behind a storage adapter that
   no-ops (memory) on Workers.
6. Conventional commits. Do not force-push, rebase, or amend published history.

## Current hardcoded path (must keep as default)

- Server: src/lib/repositories.functions.ts
  fetches https://api.github.com/users/imdadareeph/repos?per_page=100&page=N
  (max 10 pages), 15-minute in-memory cache, fallback
  src/lib/repositories-fallback.json.
- Client queryKey: ["repositories", "imdadareeph"] on
  src/routes/index.tsx, catalogue.tsx, categories.tsx, insights.tsx.
- Classifier: src/lib/repositories.ts (unchanged).
- AI summaries: src/lib/ai-summary.functions.ts (Gemini + metadata fallback).
  Remove any VITE_GEMINI_API_KEY usage; server env only.

## Build this

### Phase 1 — Sources popup + parameterized fetch + JSON export
(See §Product, §URL parsing, §Caps, §Error catalog, §UI copy.)

- Dialog: paste GitHub user/org/repo URLs, Add more, Load, Reset to default.
- Max 5 URL rows. Parse, resolve user vs org, fetch public repos, dedupe by
  GitHub id, attach sourceLogin.
- Default path unchanged until a successful custom Load.
- Persist custom sources in localStorage key `repoatlas.sources.v1` ONLY after
  a successful Load. Missing/invalid key → default owner.
- Shared queryKey ["repositories", sourceKey] where sourceKey is
  "imdadareeph" for default, else sorted logins joined by "+".
- JSON Export button downloads the active dataset.
- Toast + inline dialog errors from the Error catalog. Never mix default
  fallback JSON into a custom-source failure.
- Spiral marble cap 800 (stars desc, then pushedAt desc). Catalogue/insights
  may show all fetched rows up to ATLAS_MAX_STORED_REPOS (2000).

### Phase 2 — SQLite cache + scripts
(See §Storage adapter, §Schema, §Scripts.)

- data/schema.sql + data/.gitkeep. Gitignore data/atlas.sqlite.
- Adapter: Memory (always) + FileSqlite when ATLAS_SQLITE_PATH is set AND
  filesystem is writable (Bun/Node local). Cloudflare: Memory only.
- Upsert sources + repos after each successful fetch. Read cache if younger
  than ATLAS_CACHE_TTL_MS (default 15 min).
- Scripts: bun run db:init, db:export, db:reset.

### Phase 3 — .env.example + AI provider adapter (no extra LLM UI yet)
(See §Environment, §AI providers.)

- Add .env.example with every variable in the env table (commented keys).
- Extract src/lib/ai/providers.ts: ProviderId union, generateText(input),
  ATLAS_AI_PROVIDER selects one. Implement Gemini (existing). Stub OpenAI,
  Anthropic, xAI/Grok with clear "not configured" errors.
- getAISummary uses the adapter. Metadata fallback still always works.
- Do NOT build the future insight Sheet in this phase.

### Phase 4 — later (specify now, implement only if this phase is requested)
(See §Phase 4 LLM insight panels.)

- Settings for provider select (key stays in .env, not the UI).
- Scrollable insight Sheet: paragraphs, download Markdown/JSON.
- Cache notes in ai_notes when SQLite is available.

## UX copy, errors, actions
Use the exact strings in §UI copy and §Error catalog. Each error has a
user message, optional detail, and required actions (Retry, Reset to
default, Open docs, Dismiss).

## Validation
- First visit: still imdadareeph marbles.
- Cancel popup: still imdadareeph.
- Load https://github.com/octocat (or another small public user): spiral
  rebuilds; catalogue/insights match; export JSON contains those repos.
- Reset to default: back to imdadareeph; localStorage key removed.
- 6th Add more: disabled + helper text.
- Invalid URL, 404 user, 403 rate limit, network failure: catalog messages.
- bunx tsc --noEmit passes. Dev server still starts via ./run.sh.

Ask at most 1 question if a named file is missing; otherwise implement.
```

---

## Goal

Let anyone paste GitHub profile / org / repo URLs into a popup. After a successful Load, pull **public** repositories into the landing spiral and every other data page. Until that happens, keep today’s hardcoded `imdadareeph` atlas.

Also: JSON export, optional on-disk SQLite cache for local/dev, `.env.example` for all secrets, and an AI provider interface so Gemini stays the default while OpenAI / Anthropic / Grok can be added later without rewriting call sites.

## Non-goals (this prompt)

- Private repositories (would need OAuth; `GITHUB_TOKEN` only raises rate limit for public API).
- GitLab live sync (badge may stay decorative).
- Rewriting AtlasScene funnel / dust / link math.
- Committing live GitHub dumps or the SQLite file.
- Putting API keys in the browser, localStorage, or SQLite.
- Implementing Phase 4 insight panels unless the user explicitly asks for Phase 4.

## Product rules

### Default until custom Load

| User action | Dataset |
|---|---|
| First visit | Hardcoded `imdadareeph` |
| Open popup, type nothing, close | Hardcoded `imdadareeph` |
| Open popup, click Load with empty rows | Validation error; dataset unchanged |
| Successful Load of 1–5 URLs | Those sources only (not merged with default, unless default URL is one of the rows) |
| Click **Reset to default** | Hardcoded `imdadareeph`; clear `localStorage` sources key |
| Custom Load fails | Keep **previous successful** dataset; show error. If there was never a custom success, that previous dataset is still default. |

Do **not** splice `repositories-fallback.json` (imdadareeph) into a failed custom fetch. Fallback JSON is only for the default owner path.

### Caps (performance)

| Cap | Value | Why |
|---|---|---|
| URL rows in popup | **5** | GitHub unauthenticated 60 req/hr; each source is `ceil(repos/100)` list calls |
| GitHub pages per source | **10** (`per_page=100`) | Same as today; max 1000 public repos listed per user/org |
| Marbles on spiral | **800** | InstancedMesh is fine; hover/picking/visual density is not past this |
| Rows stored / catalogue | **2000** | `ATLAS_MAX_STORED_REPOS` |
| Concurrent source fetches | **3** | Avoid bursting rate limit |
| Idle relationship edges | unchanged (existing cap in AtlasScene) | |

When fetched count > 800: spiral uses top 800 by `stars` desc, then `pushedAt` desc. Show toast:

> Showing 800 of {n} repositories in the atlas (sorted by stars). Catalogue lists all loaded repos.

When fetched count > 2000: drop lowest-star remainder after sort; toast:

> Loaded the 2000 most-starred repositories across your sources.

`GITHUB_TOKEN` does **not** raise the URL-row cap. It only reduces 403 risk.

### URL parsing

Accept trimmed input. Strip trailing `/` and `.git`. Allow with or without `https://`, with or without `www.`.

| Input | Kind | GitHub calls |
|---|---|---|
| `octocat` | user-or-org | `GET /users/octocat` then repos; if user 404, `GET /orgs/octocat/repos` |
| `https://github.com/octocat` | user-or-org | same |
| `https://github.com/orgs/vercel` | org | `GET /orgs/vercel/repos` |
| `https://github.com/octocat/Hello-World` | repo | `GET /repos/octocat/Hello-World` |
| `github.com/octocat/Hello-World/` | repo | same |

Reject:

- Non-GitHub hosts (`gitlab.com`, `bitbucket.org`, arbitrary URLs)
- `github.com/settings`, `github.com/explore`, `github.com/topics/...`
- Empty / whitespace-only rows (ignore the row if other rows exist; if **all** empty, validation error)
- Duplicate logins after parse (keep first, toast “Removed duplicate: {login}”)

User vs org: GitHub user 404 is not always org. Try user first; on 404 try org. If both 404 → `SOURCE_NOT_FOUND`.

Only public, non-archived repos (keep today’s `!archived` filter). Include forks (today includes them; classifier already tags “Forks & Experiments”).

Deduplicate by numeric GitHub `id` when the same repo appears under two sources.

Attach extra fields (additive, classifier unchanged):

```ts
sourceLogin: string;   // e.g. "octocat"
sourceKind: "user" | "org" | "repo";
sourceUrl: string;     // canonical https://github.com/{login} or full repo URL
```

---

## Architecture

```
Popup (Dialog)
  → parse URLs
  → POST getRepositories({ sources })
       → resolve each source (user/org/repo)
       → fetch pages (concurrency 3)
       → normalizeRepository()
       → storage.upsert
       → return { repositories, source, warnings[], truncated? }
  → React Query setQueryData / invalidate ["repositories", sourceKey]
  → AtlasScene / Catalogue / Categories / Insights re-render
  → optional download JSON
```

### Shared client state

New file `src/lib/sources-store.ts` (Zustand, persist to `localStorage`):

```ts
{
  urls: string[];          // last successfully loaded raw inputs (1–5)
  sourceKey: string;       // "imdadareeph" | "loginA+loginB"
  isDefault: boolean;
  setLoaded(urls: string[], sourceKey: string): void;
  resetToDefault(): void;  // urls=[], sourceKey="imdadareeph", isDefault=true
}
```

Hydration: if persisted `urls` is empty or invalid, `isDefault === true`. Never treat a half-typed draft as loaded.

Draft popup rows live in component state, **not** in the persisted store, until Load succeeds.

### Server function signature

Replace the no-arg GET with a POST (body needed for source list). Keep a thin GET for default-only if easier, but one POST is enough:

```ts
getRepositories = createServerFn({ method: "POST" })
  .validator((data: { sources?: string[] }) => data)
  .handler(async ({ data }) => { ... });
```

- `sources` omitted, `[]`, or only whitespace → **default owner path** (including fallback JSON on GitHub failure).
- `sources` with 1–5 parsed URLs → custom path (no imdadareeph fallback JSON).
- `sources.length > 5` → throw `TOO_MANY_SOURCES` (do not fetch).

Return shape:

```ts
{
  repositories: Repository[];
  source: "live" | "cache" | "fallback";
  sourceKey: string;
  isDefault: boolean;
  warnings: { code: string; message: string }[];
  meta: {
    requested: number;
    fetched: number;
    spiralCap: number;
    storedCap: number;
    rateLimitRemaining?: number;
  };
}
```

`source: "fallback"` is **only** allowed when `isDefault === true`.

### Query key (all four routes)

```ts
queryKey: ["repositories", sourceKey]
queryFn: () => loadRepositories({ data: isDefault ? {} : { sources: urls } })
```

Default `sourceKey` is `"imdadareeph"` so existing mental model / cache label stays.

---

## UI

### Entry points

1. **Header** (all pages that have the atlas chrome): button `Add sources` (Plus icon) next to search. Opens the dialog.
2. **Explore hero**: secondary outline button `Load GitHub users` (in addition to existing CTAs). Same dialog.
3. **Export JSON**: header overflow or icon button next to Add sources. Disabled while `isLoading` or `repositories.length === 0`.

Use existing `Dialog` (`src/components/ui/dialog.tsx`) and `sonner` toasts. Do not add a new modal library.

New component: `src/components/atlas/SourcesDialog.tsx`.

### Dialog layout

```
┌ Add GitHub sources ──────────────────────────────────── × ┐
│ Paste profile, org, or repository URLs. Public repos    │
│ only. Up to 5 sources. Default atlas stays until Load.  │
│                                                          │
│ [ https://github.com/octocat                    ] [−]   │
│ [                                                ] [−]   │
│ + Add more                                               │
│                                                          │
│ ⚠ {inline error or per-row error}                        │
│                                                          │
│              [ Reset to default ]  [ Cancel ]  [ Load ] │
└──────────────────────────────────────────────────────────┘
```

- First row prefilled with `https://github.com/imdadareeph` when `isDefault` (editable). After a custom load, prefill with the successful `urls`.
- **Add more** appends an empty row; disabled at 5 with helper: `Maximum 5 GitHub URLs.`
- Minus hidden when only one row (cannot go to zero rows).
- Load: primary. Disabled while `loading`. Label becomes `Loading…` with a spinner.
- Cancel: closes without writing the store.
- Reset to default: confirm via `AlertDialog`: see copy below. On confirm: `resetToDefault()`, invalidate query, close.

Show per-source progress during Load if easy (`octocat — 42 repos`) using server-returned warnings/partial results. If the server is all-or-nothing, a single progress line is enough: `Fetching public repositories…`

After success: close dialog, toast success, spiral updates (loading overlay may flash — acceptable).

### Spiral / pages

No scene changes. **FR-021**: If `isFetching` on custom refetch and prior `repositories.length > 0`, reuse existing `AtlasLoading` overlay while keeping `AtlasScene` mounted. Do not empty the canvas to a blank screen — keep previous marbles until new data arrives (`placeholderData: keepPreviousData` from TanStack Query). Dialog Load button: `Loading…` + disabled (see `contracts/sources-dialog-ui.md`).

Catalogue / Categories / Insights: same query; existing empty/loading copy stays, plus a small chip when `!isDefault`:

`Sources: octocat + vercel` with a link/button that opens the dialog.

### JSON export

Client-side download, no extra server route required:

Filename: `repoatlas-{sourceKey}-{YYYYMMDD}.json`

Body:

```json
{
  "exportedAt": "ISO-8601",
  "sourceKey": "octocat+vercel",
  "isDefault": false,
  "sources": ["https://github.com/octocat"],
  "count": 123,
  "repositories": [ { "...Repository fields including sourceLogin" } ]
}
```

Toast: `Exported {n} repositories.`

---

## UI copy (exact)

**Dialog title:** `Add GitHub sources`

**Dialog description:** `Paste GitHub user, organization, or repository URLs. Only public repositories are loaded. The default atlas stays until you click Load.`

**URL field placeholder:** `https://github.com/username`

**URL field aria-label:** `GitHub URL {n}`

**Add more:** `Add more`

**Add more disabled title:** `Maximum 5 GitHub URLs.`

**Load:** `Load` / `Loading…`

**Cancel:** `Cancel`

**Reset to default:** `Reset to default`

**Reset confirm title:** `Restore the default atlas?`

**Reset confirm body:** `This clears your custom GitHub sources and shows imdadareeph repositories again.`

**Reset confirm action:** `Restore default`

**Reset confirm cancel:** `Keep current`

**Header button:** `Add sources` (aria-label same)

**Hero button:** `Load GitHub users`

**Export button:** `Export JSON` (aria-label `Export repositories as JSON`)

**Success toast (custom):** `Loaded {n} public repositories from {k} source(s).`

**Success toast (default restore):** `Restored the default atlas.`

**Duplicate toast:** `Removed duplicate: {login}`

**Truncation toast (800):** `Showing 800 of {n} repositories in the atlas (sorted by stars). Catalogue lists all loaded repos.`

**Truncation toast (2000):** `Loaded the 2000 most-starred repositories across your sources.`

**Empty catalogue (custom, zero public repos):** `These sources have no public, non-archived repositories.`

**Sources chip:** `Sources: {logins joined by +}`

---

## Error catalog

Throw structured errors from the server (`code` + `message`). Map to toasts + inline dialog text. Log `console.error` with code; never log tokens.

Each row: **code**, **when**, **user message**, **detail (optional)**, **actions**.

| Code | When | User message | Detail | Actions |
|---|---|---|---|---|
| `VALIDATION_EMPTY` | Load with no usable URLs | `Add at least one GitHub user, org, or repository URL.` | — | Stay in dialog |
| `VALIDATION_INVALID_URL` | Host/path not GitHub | `“{input}” is not a GitHub user, org, or repository URL.` | Show under that row | Fix URL |
| `TOO_MANY_SOURCES` | >5 after parse | `You can load at most 5 GitHub sources.` | — | Disable extra rows |
| `SOURCE_NOT_FOUND` | User and org 404; or repo 404 | `GitHub could not find “{login}”. Check the URL.` | Row-level | Edit URL, Retry |
| `SOURCE_FORBIDDEN` | 401/403 not rate-limit | `GitHub refused “{login}”. If this is a private org, it cannot be loaded.` | — | Remove row |
| `RATE_LIMITED` | 403 + rate-limit remaining 0, or 429 | `GitHub rate limit reached. Try again later or set GITHUB_TOKEN in .env.` | `Resets {relative time}` if header present | Retry, Dismiss, copy hint to `.env.example` |
| `NETWORK` | fetch throw / DNS / abort | `Could not reach GitHub. Check your connection and try again.` | — | Retry |
| `GITHUB_5XX` | 5xx from GitHub | `GitHub is unavailable ({status}). Try again shortly.` | — | Retry |
| `PARTIAL_FAILURE` | Some sources ok, some failed | `Loaded {ok} source(s). {fail} failed.` | List failed logins + their codes | Keep data, show failed rows |
| `DEFAULT_FALLBACK` | Default owner GitHub failed | `GitHub is unavailable. Showing the bundled default dataset.` | Existing fallback behavior | Dismiss (dataset already shown) |
| `EXPORT_EMPTY` | Export with 0 repos | `Nothing to export yet.` | — | Dismiss |
| `SQLITE_UNAVAILABLE` | File adapter requested on Workers | Silent: use memory. Dev toast only if `ATLAS_SQLITE_PATH` set and open failed: `Local SQLite cache is off (no filesystem). Using memory cache.` | — | Dismiss |
| `SQLITE_OPEN_FAILED` | Path not writable | `Could not open SQLite at {path}. Using memory cache.` | — | Dismiss |
| `AI_NOT_CONFIGURED` | Phase 3/4, provider selected, no key | `No API key for {provider}. Add it to .env (see .env.example).` | Summary uses metadata fallback | Dismiss |
| `AI_PROVIDER_UNIMPLEMENTED` | Stub provider called | `{provider} is not wired yet. Using the metadata summary.` | Fallback | Dismiss |
| `AI_UPSTREAM` | Provider HTTP error | `AI summary is unavailable. Showing a metadata summary instead.` | Existing panel behavior | Dismiss |

**Partial success policy:** If ≥1 source returns repos, return those repos with `warnings[]` and `PARTIAL_FAILURE`. Do not abort the whole Load.

**All sources fail:** Do not change the active dataset. Dialog stays open. Toast uses the first error code.

**Default owner failure:** Keep today’s catch → fallback JSON → `source: "fallback"`. Toast `DEFAULT_FALLBACK` once per session (sessionStorage flag `repoatlas.toast.fallback`).

Retry action: re-call the same `queryFn`. Reset to default: only shown on custom-source errors, not on default fallback.

---

## Storage adapter

File: `src/lib/storage/atlas-store.ts`

```ts
interface AtlasCache {
  getSources(): SourceRow[];
  replaceSources(rows: SourceRow[]): void;
  getRepositories(sourceKey: string): { repositories: Repository[]; fetchedAt: number } | null;
  putRepositories(sourceKey: string, repositories: Repository[]): void;
}
```

Implementations:

1. **MemoryAtlasCache** — process-local Map. Always used as L1. Same 15 min TTL as today (`ATLAS_CACHE_TTL_MS`).
2. **FileSqliteCache** — `bun:sqlite` (preferred) or `node:sqlite` / `better-sqlite3` only if Bun Database is unavailable. Open `ATLAS_SQLITE_PATH` (default `data/atlas.sqlite`). If `open` throws or `process.env.CF_PAGES` / no `fs`, skip.

Factory:

```
if (canUseSqlite()) FileSqliteCache else MemoryAtlasCache
```

`canUseSqlite()`: `ATLAS_SQLITE_ENABLED !== "false"` AND `ATLAS_SQLITE_PATH` set AND not a Cloudflare production runtime (`typeof navigator === "undefined"` is not sufficient; check `globalThis.caches` + missing `fs` or `process.env.NITRO_PRESET === "cloudflare-module"`). Fail open to memory.

Do not import `bun:sqlite` at module top-level from a file that Cloudflare will bundle into the Worker. Dynamic `import()` inside `canUseSqlite()` branch, or split `atlas-store.sqlite.ts` and only import from a Node-only script plus a guarded server fn.

### Schema (`data/schema.sql`)

```sql
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  login TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('user', 'org', 'repo')),
  added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repositories (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL,
  source_key TEXT NOT NULL,
  full_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_repositories_source_key ON repositories(source_key);

CREATE TABLE IF NOT EXISTS ai_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Gitignore:

```
data/atlas.sqlite
data/atlas.sqlite-wal
data/atlas.sqlite-shm
```

Keep `data/schema.sql` and `data/.gitkeep` tracked.

---

## Scripts

Add npm/bun scripts in `package.json` and files under `scripts/`.

| Script | Command | Behavior |
|---|---|---|
| `db:init` | `bun scripts/atlas-db-init.ts` | Create `data/`, apply `data/schema.sql`, print absolute db path |
| `db:export` | `bun scripts/atlas-export.ts` | Read SQLite (or print “cache empty”) → `data/atlas-export.json` (gitignored) |
| `db:reset` | `bun scripts/atlas-db-reset.ts` | Delete sqlite files after confirm env `ATLAS_DB_RESET=1` (no interactive prompt) |

`atlas-export.ts` must refuse if db missing: exit 1, stderr `No SQLite cache at {path}. Run bun run db:init and load sources in the app first.`

`run.sh` unchanged except optional one-liner in the banner is **not** required.

Update `AGENTS.md` commands:

```bash
bun run db:init     # create data/atlas.sqlite from schema
bun run db:export   # dump cached repos to data/atlas-export.json
bun run db:reset    # ATLAS_DB_RESET=1 bun run db:reset
```

---

## Environment

Create **`.env.example`** at repo root (tracked). Never commit `.env`.

```bash
# RepoAtlas environment
# Copy to .env and fill values. Never commit .env.
#   cp .env.example .env

# ── GitHub ──────────────────────────────────────────────────────────────────
# Optional. Unauthenticated = 60 req/hr. Token = 5,000 req/hr.
# Classic or fine-grained PAT with public_repo read is enough.
GITHUB_TOKEN=

# Default atlas owner when the user has not loaded custom sources.
# Do not change unless you intend to replace the product default.
ATLAS_DEFAULT_OWNER=imdadareeph

# ── Cache / SQLite (local Bun/Node only; ignored on Cloudflare Workers) ─────
# Set to false to force in-memory cache even locally.
ATLAS_SQLITE_ENABLED=true
ATLAS_SQLITE_PATH=./data/atlas.sqlite
# Cache TTL in milliseconds (default 15 minutes)
ATLAS_CACHE_TTL_MS=900000
ATLAS_MAX_SOURCES=5
ATLAS_MAX_SPIRAL_REPOS=800
ATLAS_MAX_STORED_REPOS=2000

# ── Site ────────────────────────────────────────────────────────────────────
VITE_SITE_URL=

# ── AI providers (server-side only — never prefix with VITE_) ───────────────
# Active provider: gemini | openai | anthropic | grok
ATLAS_AI_PROVIDER=gemini

# Google Gemini (implemented)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

# OpenAI (adapter stub until Phase 4 / provider wiring)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

# Anthropic (adapter stub)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5

# xAI Grok (adapter stub)
XAI_API_KEY=
XAI_MODEL=grok-4
```

README Environment table: add the new variables in one paragraph + “see `.env.example`”. Do not document stub providers as working.

Remove `VITE_GEMINI_API_KEY` from `ai-summary.functions.ts` if present.

---

## AI providers (Phase 3 scaffold)

New files:

- `src/lib/ai/types.ts` — `ProviderId`, `GenerateTextRequest`, `GenerateTextResult`
- `src/lib/ai/providers.ts` — `getActiveProvider()`, `generateText()`
- `src/lib/ai/gemini.ts` — move existing `generateWithGemini`
- `src/lib/ai/openai.ts` — stub: throw `{ code: "AI_PROVIDER_UNIMPLEMENTED" }`
- `src/lib/ai/anthropic.ts` — stub
- `src/lib/ai/grok.ts` — stub
- `src/lib/ai-summary.functions.ts` — calls `generateText`; on any AI error, `buildFallbackSummary`

```ts
export type ProviderId = "gemini" | "openai" | "anthropic" | "grok";

export async function generateText(req: {
  system: string;
  prompt: string;
  maxOutputTokens: number;
}): Promise<{ text: string; provider: ProviderId; model: string }>
```

`getActiveProvider()` reads `ATLAS_AI_PROVIDER` (default `gemini`). Unknown value → gemini + console.warn.

Phase 3 does **not** add a settings UI. Keys live in `.env` only.

When implementing a stub for real later:

| Provider | Endpoint (fill when wiring) |
|---|---|
| Gemini | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=` |
| OpenAI | `https://api.openai.com/v1/chat/completions` |
| Anthropic | `https://api.anthropic.com/v1/messages` |
| Grok | `https://api.x.ai/v1/chat/completions` |

Do not send full repo contents in Phase 3. Summaries stay metadata-only (current prompt).

---

## Phase 4 — LLM insight panels (later)

Implement only when explicitly requested. Spec is frozen here so it does not need another design pass.

**Trigger:** Button `Ask AI` in `RepositoryPanel` (below existing 2-sentence summary). Disabled with tooltip `Add an API key in .env` when no key for active provider.

**UI:** `Sheet` (right on desktop, bottom on mobile) with `ScrollArea`:

- Title: `{repo.name} — details`
- Eyebrow: provider + model chip
- Body: 3–6 short paragraphs (what it is, how it’s structured at a glance from README excerpt + metadata, related atlas repos in same category — names only from already-loaded dataset)
- Actions: `Download Markdown`, `Download JSON`, `Close`
- Loading: skeleton paragraphs, `Generating details…`
- Error: catalog `AI_*` messages + `Use metadata summary` (existing panel text)

**Download Markdown** filename: `{repo.name}-atlas-notes.md`

**README fetch:** `GET /repos/{fullName}/readme` (accept raw) truncated to 8k chars. Cache on `ai_notes` when SQLite exists; otherwise memory Map keyed by `fullName + provider`.

**Never** paste user API keys into this sheet. Provider is env-selected.

---

## Files to add / change

| File | Change |
|---|---|
| `src/lib/github-url.ts` | **Add.** Parse/validate GitHub URLs |
| `src/lib/github-fetch.ts` | **Add.** User/org/repo pagination, rate-limit headers, concurrency |
| `src/lib/sources-store.ts` | **Add.** Zustand + persist |
| `src/lib/storage/atlas-store.ts` | **Add.** Memory + guarded SQLite factory |
| `src/lib/storage/atlas-store.sqlite.ts` | **Add.** Bun sqlite implementation (Workers-safe unused) |
| `src/lib/repositories.ts` | Add optional `sourceLogin`, `sourceKind`, `sourceUrl` |
| `src/lib/repositories.functions.ts` | Parameterized sources; default owner constant from env; structured errors |
| `src/lib/ai/*` | Provider adapter + Gemini move + stubs |
| `src/lib/ai-summary.functions.ts` | Use adapter; drop `VITE_` key |
| `src/components/atlas/SourcesDialog.tsx` | **Add.** |
| `src/routes/index.tsx` | Header + hero buttons; shared queryKey; export; keepPreviousData |
| `src/routes/catalogue.tsx` | Same queryKey + sources chip + Add sources |
| `src/routes/categories.tsx` | Same |
| `src/routes/insights.tsx` | Same |
| `src/routes/__root.tsx` | `<Toaster />` from sonner if not already mounted |
| `data/schema.sql` | **Add.** |
| `data/.gitkeep` | **Add.** |
| `scripts/atlas-db-init.ts` | **Add.** |
| `scripts/atlas-export.ts` | **Add.** |
| `scripts/atlas-db-reset.ts` | **Add.** |
| `.env.example` | **Add.** Full template |
| `.gitignore` | sqlite + `data/atlas-export.json` |
| `package.json` | `db:*` scripts |
| `README.md` | Short “Load GitHub users” + env pointer |
| `AGENTS.md` | db commands |
| `PROGRESS.md` | New phase checkboxes |

Do **not** rewrite `AtlasScene.tsx` except if `Repository` type change requires a trivial field ignore.

---

## Implementation sequence

1. `.env.example`, `.gitignore`, `ATLAS_DEFAULT_OWNER` constant.
2. `github-url.ts` + unit-free sanity via a tiny `scripts/check-github-url.ts` **or** just exported functions and tsc (no test runner in repo — do not add Jest).
3. `github-fetch.ts` + refactor `repositories.functions.ts` default path to use it with `[ATLAS_DEFAULT_OWNER]`.
4. `sources-store.ts` + `SourcesDialog` + header/hero wiring + queryKey on four routes.
5. Export JSON button + toasts + error catalog.
6. Storage adapter + schema + db scripts; wire cache into server fn.
7. AI adapter split; Gemini still works; stubs; README/AGENTS/PROGRESS.

Keep the branch runnable after each of 3, 5, and 7.

---

## Validation checklist

- [ ] Cold load, no localStorage: spiral shows default owner repos (or bundled fallback).
- [ ] Open dialog, Cancel: dataset unchanged.
- [ ] Load empty: `VALIDATION_EMPTY`, dataset unchanged.
- [ ] Load `https://github.com/octocat`: marbles, catalogue, insights, categories all change; queryKey is not `imdadareeph`.
- [ ] Reload the browser: custom sources return (localStorage); spiral matches.
- [ ] Reset to default: `imdadareeph` again; localStorage cleared; toast restored.
- [ ] Invalid URL row: row error, no fetch.
- [ ] Unknown login: `SOURCE_NOT_FOUND`, previous dataset kept.
- [ ] Add more disabled at 5.
- [ ] Export downloads valid JSON with `sourceKey` and `repositories`.
- [ ] Default GitHub failure still uses `repositories-fallback.json` and `DEFAULT_FALLBACK` toast.
- [ ] Custom GitHub failure does **not** show imdadareeph fallback mixed in.
- [ ] `bunx tsc --noEmit` clean.
- [ ] `./run.sh` serves the app; Add sources works in the browser (header + hero).
- [ ] Cloudflare build still bundles (no top-level `bun:sqlite` import from Worker graph). Verify with `bun run build` if time allows.
- [ ] No secrets in git status.

---

## Design tokens / a11y

- Reuse atlas glass dialog surface (`bg-card/95`, `border-border`, existing Dialog).
- Focus trap: Radix Dialog default.
- Esc closes dialog (Radix) without Load.
- Buttons have visible labels, not icon-only, on the dialog itself. Header icon button needs `aria-label`.
- Respect existing reduced-motion on the canvas; dialog has no extra animation requirement.

---

## Out of scope reminders

- Do not force-push.
- Do not add OAuth.
- Do not fetch private repos.
- Do not put keys in `VITE_`.
- Do not implement Phase 4 sheets until asked.
- Do not merge custom sources with default owner unless the user included that URL in the list.
