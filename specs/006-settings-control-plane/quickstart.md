# Quickstart: validating Feature 006 locally

**Feature**: 006-settings-control-plane · **Contracts**: [contracts/](./contracts/) · **Model**: [data-model.md](./data-model.md)

Validation guide only; no implementation code. All steps run on a developer machine with no Cloudflare account, no Wrangler and no deployment (FR-016, SC-005). Steps apply after implementation.

## Prerequisites

- `bun install`; optionally copy `.env.example` to `.env` (never commit `.env`).
- Unit/integration suite: `bun test`. Typecheck: `bunx tsc --noEmit`. Lint: `bun run lint`. Dev server: `./run.sh` (first free port from 4949).

## Automated checks

1. `bunx tsc --noEmit` passes (constitution).
2. `bun test` passes, including the new control-plane tests:
   - **Registry invariants** (FR-001, FR-002, SEC-002, SEC-003, SEC-007, SEC-008): every item has one category; C ⇒ status-only and not client-visible; sensitive ⇒ availability-only; every `VITE_*` in `.env.example` is registered as client-visible and never C.
   - **Secret redaction** (SEC-001, SEC-006, SC-002): set sentinel values for every secret and sensitive item; serialize the `getConfiguration` and `getCodeIntelStatus` outputs and the error output; assert no sentinel appears.
   - **Effective values** (FR-005, FR-013, SC-004): set, unset and deliberately invalid numeric and provider values; the DTO reports the value in use, default marker where valid, and Invalid / unavailable (no value, no fabricated fallback) for unparseable numerics, and never throws.
   - **Preferences** (FR-009, FR-010, FR-015): `sanitizePreferences` per-item fallback for malformed/unknown data; reset restores defaults; reset does not touch the source store or filters.
   - **Code-intelligence status** (FR-014, FR-018): with the in-memory D1 adapter: empty tables → zero counts; seeded snapshots/extractions → matching counts; no binding → unavailable; only SELECT issued; no F001/F002 table modified.
   - **No input accepted** (SEC-004): handlers ignore supplied data.

## Manual checks (browser; no UI test tooling exists in the repository)

1. Start `./run.sh`, open `/settings` from the navigation on each of the five pages (FR-004, SC-006: no other visual change).
2. **US1**: every row shows a category badge and an effective value/status/availability; unset values show a default marker; with `GEMINI_API_KEY` set the row says "configured" and the key text appears nowhere in the page, in the browser network responses, or in the page source; with it unset it says "not configured" with the degradation note. Set `ATLAS_MAX_SOURCES=abc`, restart, reload: the page loads and the row shows Invalid / unavailable (with the default as information only), not a substituted value. Configuration appears within 2 seconds (NFR-001).
3. **US2**: toggle each switch; the Explore page reflects it without a data reload (NFR-002); reload, the choice is remembered; **Reset preferences** restores defaults and shows a confirmation; the loaded source set and Explore filters are unchanged (FR-015). Corrupt the stored `repoatlas.preferences.v1` value in devtools and reload: defaults for the bad items, no crash. Block site storage in the browser: switches work and the "will not be remembered" notice appears (FR-010).
4. **US3**: under plain `./run.sh` the section says the database is not available in this environment and everything else still works (FR-018). Populated counts are proven by the integration test (running with local D1 emulation is optional and outside this feature's prerequisites).
5. Network-reachable safety (SEC-005): open the same page from another device on the local network (or inspect the raw `/_serverFn` responses): only the content permitted by the spec is present; no secret, path, identifier or stack trace.
6. Confirm there is no control anywhere on `/settings` that edits deployment configuration, edits a secret, or starts, pauses, retries, clears or resets processing.

## Expected outcome

All automated checks green; the manual checks above match; `git status` shows only the files listed in plan.md's structure section.
