# Quickstart: validating Feature 009

Validation guide only. Real-data targets: user scope `https://github.com/imdadareeph`, repository `https://github.com/fib1618agent/repo-atlas`. No Cloudflare account, deployment, live Cloudflare operation or push is needed for the PROVIDER/UI paths. Synthetic fixtures are used only for deterministic unit tests.

## Prerequisites

`bun install`; optional `.env` (`GITHUB_TOKEN` only to raise GitHub rate limits; never committed). Dev server: `./run.sh`. Typecheck `bunx tsc --noEmit`; tests `bun test --isolate`.

## Evidence classes

- **PROVIDER**: Feature 003 data from public GitHub (works in plain dev).
- **INTEL**: populated Feature 001/002 data; needs decision D3 (spec.md). Without it, the app shows `unavailable`, and this class is validated by the opt-in real-data test and by fixtures derived from its output (labelled).
- **UI**: browser (Playwright when available).

## Automated

1. `bunx tsc --noEmit` passes.
2. `bun test --isolate`: unit tests (identity, limits, composition, layout determinism and bounds, relationship-layer boundary, deferred-scope), integration tests (read model against seeded sqlite D1: ready / no_snapshot / snapshot_in_progress / partial / empty / unavailable; SELECT-only assertion; identity propagation), UI state rendering tests.
3. Opt-in real data (needs D3(a)): `REPOATLAS_REAL_DATA=1 bun test tests/integration/repo-intel/real-data.test.ts` runs the existing F001/F002 pipelines on the public archive of `fib1618agent/repo-atlas` into the sqlite adapter and asserts identity, non-empty structure, known top-level directories present (`src`, `tests`, `specs`), and symbols for a known TypeScript file. Results recorded with date and commit SHA; skipped (not failed) when the variable is unset.

## Manual / browser acceptance (report each PASS / FAIL / NOT VERIFIED)

| Test | Steps | Expected | Class |
|---|---|---|---|
| AT-009-01 | Load `https://github.com/imdadareeph` as a source (or default owner) → Catalogue | user-level catalogue lists accessible repositories | PROVIDER, UI |
| AT-009-02 | Add source `https://github.com/fib1618agent/repo-atlas`; select it (Explore panel or Catalogue entry link) | enters `/repository/fib1618agent/repo-atlas` | PROVIDER, UI |
| AT-009-03 | Read header/URL/breadcrumb at every step | owner `fib1618agent`, repository `repo-atlas` throughout | PROVIDER, UI |
| AT-009-04 | Root → directory → file → symbols | structure explorable; symbols when available; honest state otherwise | INTEL, UI |
| AT-009-05 | Inspect rendered data | only provider + F001/F002 data; no relationship data | INTEL, UI |
| AT-009-06 | Read relationship notice | "not yet connected"; no edges | UI |
| AT-009-07 | Browser back / Catalogue link | same sources, filters, preferences; owner/repo context intact | UI |
| AT-009-08 | Repeat with another repository from the `imdadareeph` list | same code paths, no repo-atlas assumptions | PROVIDER, UI (INTEL if data) |

Additional manual checks: loading state visible before data; no-snapshot / unavailable states in plain dev; provider failure (offline or rate limit) shows `provider_error`; keyboard-only walk (Tab, arrows, Enter, Backspace, `+`/`-`); 390×844 no horizontal overflow; reduced-motion; existing routes unchanged; Settings still reachable.

## Expected outcome

Automated checks green; each acceptance test recorded with its evidence class; `git status` shows only the files in plan.md's structure section (plus documentation).
