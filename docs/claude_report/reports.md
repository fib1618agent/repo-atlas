# Feature 006 — Settings / Control Plane: T028 Results and T030 Persist

**Timestamp**: 2026-09-24 19:29 +04:00 · **Branch**: `feat/atlas-marble-interaction` · **HEAD**: `f1cef88` · Reporting files only in T030: no source, test, package, lockfile, `.env.example`, roadmap, F001–F005 or F007 change; no commit, push, stash, reset, clean, Cloudflare, Wrangler or GitNexus.
**Status: T001–T030 DONE (T030 = this persist step) · Feature 006 COMPLETE · `docs/ROADMAP.md` reconciled in the closeout · T028 = PASS with 2 NOT VERIFIED items and 1 narrow-width qualification.**

## 1. Automated validation (recorded from T027/T029; not re-run in T030)
- `bunx tsc --noEmit`: PASS.
- `bun test`: 323 pass / 0 fail; Feature 006 added 124 tests, all passing.
- Lint: Feature 006 files clean. Repo-wide 1815 errors / 6 warnings vs T001 baseline 1810 / 6. The +5 delta is exactly the five intentional one-line Settings navigation additions (Prettier errors); it is not a new regression.

## 2. T028 manual browser validation (Playwright MCP, local `./run.sh`, Chromium, desktop 1280×900 unless stated)
**PASS**
- Navigation: Settings link reachable from `/`, `/catalogue`, `/categories`, `/insights`, `/about`.
- Configuration surface: category badges (A/B/C), default markers, defaults (Max sources 5, spiral 800, stored 2000, TTL 900000, default owner `imdadareeph`, AI provider `gemini`, CODE_INTEL values); Site URL shows the client-visible badge and "Not set"; five secret rows show only configured/not-configured with degradation notes; SQLite location, code-intel DB, snapshot storage, snapshot queue and symbol queue show Unavailable.
- Secret redaction (separate temporary server, inline `GITHUB_TOKEN` and `GEMINI_API_KEY` sentinels, no `.env`): rows show "configured" only; neither value appears in rendered text, raw HTML, DOM HTML, local/session/cookie storage, or the raw `getConfiguration` server-function body (which carries `status: configured`). Sentinel values are not recorded here.
- Invalid numeric (separate temporary server, `ATLAS_MAX_SOURCES=abc`): Max sources renders "Invalid / unavailable", with the default (5) as reference only; raw body has `state: invalid`, no `value` field, no `abc`, path or stack trace; other rows unaffected.
- Preferences: Auto-rotate and Show relationships each reflect on Explore immediately (label "Resume rotation / Off"; Links button loses active state). Persist across reload. Reset restores true/true with default markers and toast "Preferences reset to defaults"; Explore then shows defaults.
- Corrupted `repoatlas.preferences.v1`: malformed JSON and `[1,2]` → both defaults; `{"autoRotate":false,"showRelationships":"banana"}` and `{"autoRotate":false}` → autoRotate false, showRelationships default true (per-item fallback); no page errors; Explore usable.
- Blocked storage (simulated only on a `?t028block=1` URL by making `window.localStorage` throw): notice "Browser storage is unavailable, so these preferences will not be remembered after you close this page."; switches still toggle.
- Code intelligence (plain dev): Unavailable / "Not available in this environment" / `no_binding`.
- Server-function responses (`getConfiguration`, `getCodeIntelStatus`, plain, sentinel and invalid runs): no secrets, filesystem paths, SQL, infrastructure identifiers, stack traces or exception details.
- Read-only boundary: only two preference switches and "Reset preferences"; no control to edit configuration or secrets, start/pause/retry/clear/re-run processing, or browse per-snapshot code intelligence.
- Explore regression: loads with canvas, no visible error, no console errors; its own rotation/Links controls work and share state with Settings; Settings → Explore → Settings works.

**NOT VERIFIED** (not upgraded)
1. Absolute proof that a preference change can never trigger an atlas-data refetch. Evidence: during tested toggles and returns to Explore, a page-level fetch hook logged only the Settings server functions (`getConfiguration`, `getCodeIntelStatus`) and no atlas-data request; the hook intercepts `fetch` only, so it does not prove absence of every possible request.
2. LAN reachability (SEC-005 network-reachable check). Evidence: dev server bound to 127.0.0.1 only; a request to the machine's LAN address got no connection; no second device or browser context was available; performing it would require changing exposure, which was not authorized. Raw server-function responses were inspected locally instead (see above).

**Qualification (not a silent PASS or FAIL): narrow width 390×844**
Page itself does not overflow (document scroll width 375 in a 390 viewport). The configuration table sits in a horizontal-scroll wrapper (table 377 px in a 327 px container, about 50 px internal scroll); the third-column header and some values ("Effective value / sta…", `github:imdadare…`, the "default" chip on Max file size, the GitHub token note) are clipped until scrolled. Badges, both switches (36×20) and Reset preferences (130×32) stay usable; Preferences and Code Intelligence sections are readable. Affected requirement: NFR-004; whether this is acceptable is a user decision. No remediation started.

## 3. Scope (T029) and pre-existing work
F006 did not modify `package.json`, lockfiles, `.env.example`, `sources-store.ts`, `atlas-config.ts`, `code-intel/config.ts`, AI/storage implementation, F001–F005 or F007 source, or `docs/ROADMAP.md`.
Pre-existing uncommitted work, **not** F006: `AGENTS.md`, `docs/AGENT-GOVERNANCE.md`, `roadmap.md`, `specs/004-engineering-relationship-graph/{plan,research,tasks}.md`, Query-cache experiment (`src/lib/code-intel/symbols/to-intermediate-representation.ts`, `tests/contract/symbols/to-intermediate-representation.test.ts`, `scripts/query-cold-start-experiment.ts`, `specs/002-ast-symbol-intelligence/query-cold-start-results.md`), `.claude/skills/gitnexus/`.
F006 files (uncommitted): `specs/006-settings-control-plane/`, `src/lib/control-plane/`, `src/components/settings/`, `src/routes/settings.tsx`, generated `src/routeTree.gen.ts`, one nav line each in `src/routes/{index,catalogue,categories,insights,about}.tsx`, `src/lib/atlas-store.ts`, `src/lib/atlas-errors.ts`, `tests/unit/control-plane/`, `tests/integration/control-plane/`. (Attribution per T029; T030 did not re-audit.)

## 4. Evidence
Untracked validation-artifact directory `.playwright-mcp/` (kept, not committed, `.gitignore` unchanged), including `t028-settings-desktop-plain.png`, `t028-settings-390.png`, `t028-blocked-storage.png`, `t028-invalid-max-sources.png`, `t028-sentinel-getConfiguration.json`, plus Playwright snapshot/console logs.

## 5. Temporary state
Both temporary servers (sentinel, `ATLAS_MAX_SOURCES=abc`) stopped; `repoatlas.preferences.v1` removed (original state: absent); viewport restored. Dev server on 4950 (started for T028) and the older Vite process on 4949 (PID 55263, untouched) may still be running.

## 6. Open user decisions
Commit/review of Feature 006; acceptance of the two NOT VERIFIED items; whether the narrow-width clipping needs remediation; (`docs/ROADMAP.md` reconciled in the closeout; `specs/006-…/tasks.md` checkboxes remain unchecked because F006 specs were not to be modified: user may authorize ticking them); Feature 004 decisions unchanged (T007 STOPPED). Feature 007 not started.
