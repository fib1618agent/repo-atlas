# Quickstart: Validate Dynamic GitHub Sources

End-to-end validation guide for feature `001-dynamic-github-sources`.  
Contracts: [`contracts/`](./contracts/). Data model: [`data-model.md`](./data-model.md).

## Prerequisites

```bash
cp .env.example .env   # after Phase 3 lands; optional GITHUB_TOKEN, GEMINI_API_KEY
bun install
bun run db:init        # Phase 2 only; optional for Phase 1
./run.sh               # http://127.0.0.1:4949+
```

## Phase 1 — Core flow

### 1. Default atlas unchanged

1. Open `/` in a fresh browser profile (or clear `localStorage` key `repoatlas.sources.v1`).
2. **Expect**: `imdadareeph` marbles load; query uses default owner.
3. Open **Add sources** → **Cancel**.
4. **Expect**: Dataset unchanged.

### 2. Custom load

1. Open **Add sources**.
2. Enter `https://github.com/octocat` → **Load**.
3. **Expect**: Spiral + `/catalogue` + `/categories` + `/insights` show octocat public repos only.
4. **Expect**: Sources chip `Sources: octocat` (or equivalent).
5. Refresh page.
6. **Expect**: Same sources without re-entry (FR-016).

### 3. Replace-only (not merged with default)

1. Load `octocat` only.
2. **Expect**: No `imdadareeph/*` repos unless imdadareeph URL was pasted (FR-022).

### 4. Reset to default

1. After custom load → **Reset to default** → confirm.
2. **Expect**: `imdadareeph` atlas returns; `localStorage` cleared.

### 5. Loading UX (FR-021)

1. With atlas visible on `/`, start a new Load to another user.
2. **Expect**: Current marbles stay mounted until success/fail (no blank canvas).
3. **Expect**: `AtlasLoading` overlay (or equivalent) visible on explore while fetching; dialog Load button shows `Loading…` and is disabled.
4. On `/catalogue` (optional): during refetch, existing page loading copy appears; list does not flash empty if prior data exists.

### 6. Export

1. With repos loaded → **Export JSON**.
2. **Expect**: File downloads; `count` matches catalogue; includes `sources` + `repositories`.

### 7. Error paths

| Action | Expect |
|--------|--------|
| Load empty rows | `VALIDATION_EMPTY`; no dataset change |
| `https://example.com` | Row error `VALIDATION_INVALID_URL` |
| `https://github.com/this-user-does-not-exist-xyz` | `SOURCE_NOT_FOUND`; prior data kept |
| Export with 0 repos | `EXPORT_EMPTY` toast |

### 8. Caps (if test user has enough repos)

- Load a high-volume org; **expect** truncation toasts at 800 spiral / 2000 catalogue per spec.

### 9. Dialog from every route (FR-002)

1. Load a custom source (e.g. `octocat`).
2. On `/catalogue`, click header **Add sources** → **expect** dialog opens (same instance as explore).
3. Close dialog; click **Sources: octocat** chip → **expect** dialog opens again.
4. Repeat **Add sources** on `/categories` and `/insights`.

### 10. Duplicate URL toast

1. Open **Add sources**; enter `https://github.com/octocat` twice → **Load**.
2. **Expect** toast `Removed duplicate: octocat`; load proceeds with one source.

### 11. SC-007 — 800-marble interaction

**Reference device** (acceptance baseline): Apple M1 or Intel Core i5 (2018+), 8 GB RAM, 1080p display, latest Chrome or Safari.

1. Load a source with ≥800 public repos (or use truncation path from §8).
2. On `/`, hover marbles, click to select, drag to rotate the scene.
3. **Expect** no frame freeze or lost pointer events; ≥30 FPS while idle-orbiting on the reference device above.

## Phase 2 — SQLite cache (local)

```bash
bun run db:init
# Load sources in app
bun run db:export   # writes data/atlas-export.json
```

**Expect**: `data/atlas.sqlite` gitignored; repeat visit within 15 min may hit cache (`source: "cache"` in network response).

## Phase 3 — Environment & AI

1. Verify `.env.example` lists all vars; no `VITE_*` API keys.
2. With `GEMINI_API_KEY` set, open repo panel → AI summary still works.
3. With key unset → metadata fallback only.

## Build gates

```bash
bunx tsc --noEmit
bun run build        # Cloudflare bundle; no top-level bun:sqlite in Worker graph
```

## Success criteria mapping

| ID | Quickstart step |
|----|-----------------|
| SC-001 | §2 custom load timing |
| SC-002 | §2 cross-page sync |
| SC-003 | §1 cancel dialog |
| SC-004 | §7 failed custom load |
| SC-005 | §6 export |
| SC-006 | §2 refresh |
| SC-007 | §11 800-marble interaction (reference device) |
| FR-021 | §5 loading UX |
| FR-002 | §9 dialog from every route |
| SC-008 | §7 error catalog |
