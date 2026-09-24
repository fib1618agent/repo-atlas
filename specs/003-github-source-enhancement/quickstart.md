# Quickstart: GitHub Source Enhancement

Manual validation scenarios proving the feature works end-to-end, once
implemented. Assumes `./run.sh` (or `bun run dev`) is running locally.

## Prerequisites

- Local dev server running (`./run.sh`).
- No `.env` overrides for `ATLAS_LOAD_INITIAL_SOURCES`/`ATLAS_INITIAL_SOURCES`
  (exercise defaults first).

## Scenario 1 — Consolidated Sources menu (US1)

1. Load `/`. Confirm a single "Sources ▼" control in the navbar, no separate
   Add/Export/chip controls.
2. Click it — confirm exactly three items: Add Sources, Export JSON,
   Connected Sources.
3. Repeat on `/catalogue`, `/categories`, `/insights` — confirm identical
   menu, same position, same items.
4. With the default atlas loaded, select Export JSON — confirm the same
   download/toast behavior as before this feature.

## Scenario 2 — Connected Sources popup (US2)

1. On the default atlas, open Connected Sources. Confirm one entry: GitHub,
   `github.com/<default owner>`, repository count matching the loaded atlas,
   "connected" status.
2. Open Add Sources, load a custom GitHub user (e.g.
   `https://github.com/octocat`). Reopen Connected Sources — confirm it now
   reflects the custom source, not the stale default.
3. Load a source combination that includes an invalid/forbidden login
   alongside a valid one (to trigger `PARTIAL_FAILURE`). Reopen Connected
   Sources — confirm the failing entry shows a degraded/error status, not
   "connected".

## Scenario 3 — Add Sources two modes (US3)

1. Open Add Sources — confirm it defaults to Mode 1 (Users), prefilled as
   today.
2. In Mode 1, submit a GitHub org URL — confirm all public repos load,
   identical to pre-feature behavior.
3. Switch to Mode 2 (Repositories). Enter a specific `owner/repo` URL —
   confirm only that repository loads (not the owner's full repo list).
4. In Mode 2, enter a user/org URL (not a repo URL) — confirm a row-level
   validation error, submission blocked.
5. In either mode, exceed `ATLAS_MAX_SOURCES` (5) combined rows — confirm
   the existing cap message appears.

## Scenario 4 — Category panel minimized by default (US4)

1. Clear any persisted UI state (fresh session/incognito). Load `/`.
2. Confirm the category legend list is collapsed on first render, while
   Repositories/Categories/Platforms/Possibilities stats are visible.
3. Click to expand — confirm the full category list appears.
4. Click again — confirm it collapses.

## Scenario 5 — `loadInitialSources` configuration (US5)

1. Default config (`ATLAS_LOAD_INITIAL_SOURCES` unset/`true`): fresh
   session, load `/` — confirm the default owner's marbles auto-load, as
   today.
2. Set `ATLAS_LOAD_INITIAL_SOURCES=false`, restart dev server. Fresh
   session, load `/` — confirm no repositories auto-load; Add Sources is
   required to populate the atlas.
3. With `ATLAS_LOAD_INITIAL_SOURCES=false`, load a custom source via Add
   Sources, then reload the page (same session/browser) — confirm the
   persisted custom source still loads (persisted state wins over config).
4. Set `ATLAS_INITIAL_SOURCES` to two entries — fresh session, load `/` —
   confirm both sources' repositories load together.

## Scenario 6 — Repository intelligence extension point (US6, non-behavioral)

1. In Mode 2, select and load 1–2 specific repositories.
2. Confirm no network call to any Feature 001/002 endpoint occurs (inspect
   browser network tab) — selection is inert beyond the existing
   `getRepositories` call.
3. Confirm no UI element claims the selected repositories are "analyzed."

## Regression check (all scenarios)

- `bunx tsc --noEmit` clean.
- Feature 001 regression suite unaffected:
  `bun test tests/contract/code-intel/ tests/integration/code-intel/`.
- Feature 002 regression suite unaffected:
  `bun test tests/contract/symbols/ tests/integration/symbols/`.
- Manual: default atlas (`isDefault: true`, no env overrides) looks and
  behaves identically to the pre-feature build.
