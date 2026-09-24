# Implementation Plan: Settings / Control Plane

**Branch**: `006-settings-control-plane` (spec directory; no dedicated git branch was created) | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-settings-control-plane/spec.md` (clarified 2026-09-24)

**Note**: Plan phase only. No tasks, no code, no roadmap change. Requirement IDs (FR-, SEC-, NFR-, SC-) are the spec's own; none are invented here.

## Summary

Add a local-first developer/operator **Settings / Control Plane** page (`/settings`) for the Guest/developer of a locally operated RepoAtlas. It (US1) shows a read-only view of how RepoAtlas is configured, with every item classified A–D, effective value or status or availability, and default marker; (US2) lets the Guest change and reset two personal preferences (`autoRotate`, `showRelationships`) persisted browser-locally; (US3) shows read-only code-intelligence status.

Approach, reusing what exists:

- A new pure **setting registry** (allowlist) defines every item and its category, display form and rules. A server-side **read model** builds the configuration DTO from that registry and the **existing** `serverAtlasConfig()`, `codeIntelConfig()`, `canUseSqlite()`, `canUseD1()`, `canUseR2()` helpers. The DTO type has no value field for secrets or sensitive non-secret items, so redaction is structural.
- A read-only **code-intelligence status** module runs two aggregate `SELECT`s through the existing D1 helpers, and reads `SYMBOL_EXTRACTOR_VERSION`.
- Two no-input `createServerFn` functions, in the repository's handler/wrapper pattern, expose both read models.
- Preferences reuse the existing runtime store (`atlas-store.ts`), which already holds both toggles; a small `preferences.ts` adds defaults, sanitizing, guarded browser storage and a write-only-on-change subscription. `persist` middleware is rejected (writes on every hover).
- A new route and three small components use existing shadcn primitives and atlas classes; one `Settings` link is added to each existing header.
- No authentication, roles, deployment-configuration persistence, runtime mutation, MCP, Cloudflare or new dependency.

## Technical Context

**Language/Version**: TypeScript, React 19, Bun (or Node 22+), as existing

**Primary Dependencies**: existing only: TanStack Start / Router / React Query, zustand 5, shadcn/ui primitives, sonner, lucide-react. **No new dependency.**

**Storage**: none new. Browser `localStorage` key `repoatlas.preferences.v1` for the two category-A preferences (FR-009, FR-011). Code-intelligence status reads the existing D1 tables `snapshots` and `snapshot_extractions` (SELECT only) when a database binding exists; no schema change.

**Testing**: `bun test --isolate` (unit + integration; existing `tests/support/d1-sqlite-adapter.ts` and `setTestCloudflareEnv`); `bunx tsc --noEmit`; `bun run lint`; manual browser checklist in quickstart.md (no component-test tooling exists in the repo and none is added).

**Target Platform**: local developer machine (`./run.sh`, port from 4949). The build target remains Cloudflare Workers via Nitro; the feature must not break that build, but nothing in it requires Cloudflare (FR-016).

**Project Type**: single TanStack Start web application (existing structure).

**Performance Goals**: configuration visible within 2 s (NFR-001); preference change effective within 1 s with no dataset reload (NFR-002); no degradation of atlas interaction budgets (NFR-003, Constitution IV).

**Constraints**: secrets server-side only; no authentication so every response is safe for any caller (SEC-005); no client-exposed variable may hold a secret (SEC-008); existing pages unchanged apart from the nav entry and the specified remembered-preferences exception (SC-006); the atlas-store change must not add storage writes per hover (research R5).

**Scale/Scope**: one route, ~3 components, 5 small library modules, 2 server functions, 1 modified store, 1 catalog code, 5 one-line nav edits; ~30–40 configuration items.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design (result unchanged).*

| Principle | Assessment | Result |
|---|---|---|
| I. Data Fidelity | The feature reads configuration; it does not touch repository metadata, the source set or the default owner. Preference reset does not alter the dataset (FR-015). `ATLAS_DEFAULT_OWNER` is shown read-only. | Pass |
| II. Visualization-First | Only two existing presentation toggles are persisted; no scene, geometry or taxonomy change. | Pass |
| III. Server-Side Secrets | Secrets are never returned; DTO types carry no value field for them; no `VITE_*` secret; SQLite/storage unavailability degrades gracefully; user-facing errors use the documented catalog (+1 code). | Pass |
| IV. Performance Budgets | No per-frame work; storage writes only when a preference changes (not per hover); server work is one env read and two indexed-status aggregates. | Pass |
| V. Simplicity & Minimal Scope | Reuses existing functions, store, patterns and UI kit; no new library; no shared-nav refactor; no speculative abstraction. | Pass |
| Technical Constraints | `ssr: false` route, zustand for interaction state, Tailwind atlas tokens, TanStack server functions. `bunx tsc --noEmit` must pass. | Pass |

No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/006-settings-control-plane/
├── spec.md              # clarified specification
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── server-functions.md
│   └── settings-surface.md
├── checklists/requirements.md
└── tasks.md             # NOT created by /speckit-plan
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── control-plane/                       # NEW
│   │   ├── setting-registry.ts              # pure allowlist + invariants data (isomorphic, no values)
│   │   ├── preferences.ts                   # defaults, sanitizePreferences, guarded read/write, storage probe (isomorphic)
│   │   ├── configuration-read-model.ts      # server: builds ConfigurationItem[] from registry + existing config/availability helpers
│   │   ├── code-intel-status.ts             # server: read-only aggregate SELECTs + SYMBOL_EXTRACTOR_VERSION
│   │   └── control-plane.functions.ts       # handlers + createServerFn wrappers (getConfiguration, getCodeIntelStatus)
│   ├── atlas-store.ts                       # MODIFY: init two fields from stored prefs, write-on-change subscription, resetPreferences()
│   └── atlas-errors.ts                      # MODIFY: +SETTINGS_UNAVAILABLE catalog code
├── components/
│   └── settings/                            # NEW
│       ├── ConfigurationSection.tsx
│       ├── PreferencesSection.tsx
│       └── CodeIntelStatusSection.tsx
├── routes/
│   ├── settings.tsx                         # NEW route (/settings, ssr:false)
│   ├── index.tsx, catalogue.tsx, categories.tsx, insights.tsx, about.tsx   # MODIFY: one Settings nav link each
│   └── (routeTree.gen.ts)                   # GENERATED by the router plugin, not hand-edited
tests/
├── unit/control-plane/
│   ├── setting-registry.test.ts
│   ├── preferences.test.ts
│   └── configuration-read-model.test.ts
└── integration/control-plane/
    └── code-intel-status.test.ts
```

**Structure Decision**: single-project layout of the existing app. New feature code is isolated in `src/lib/control-plane/` and `src/components/settings/`. Existing files are touched only where a requirement needs it: the store (US2), the catalog (one code), and one nav line in each existing header (FR-004). No F001–F005 file is modified.

## Architecture

### Data flow

```text
Configuration (US1, B/C):
  /settings ── useQuery ──> getConfiguration (server fn, no input)
      └─ handler: registry ──> serverAtlasConfig() / codeIntelConfig() / canUseSqlite()/canUseD1()/canUseR2()/getGitHubToken()!=""
         └─ build ConfigurationItem[]  (value | status | availability — types carry no secret/sensitive value)
      <── { generatedAt, items }   (fixed-text SETTINGS_UNAVAILABLE on failure)
  client merges category-A rows from the preference store (same registry definitions)

Preferences (US2, A):
  page load ──> atlas-store init: readStoredPreferences() (sanitized, defaults on any failure)
  switch / reset ──> atlas-store set ──> subscribe: write repoatlas.preferences.v1 only if a preference field changed
  Explore page reads the same store fields ──> immediate effect, no dataset reload

Status (US3, D):
  /settings ── useQuery ──> getCodeIntelStatus ──> canUseD1()? ── no ──> { available:false, reason }
                                                     └ yes ──> SELECT status,COUNT(*) FROM snapshots / snapshot_extractions
```

### Server / client boundary

Server: registry evaluation against `process.env` and bindings, status queries, catalog errors. Client: rendering, category-A preference state and storage. The registry module is isomorphic and contains no values. `*.functions.ts` keeps server-only imports behind the `createServerFn` handlers, as `repositories.functions.ts` already does.

### Architecture areas (task requirement 1–16) and reuse

| # | Area | Plan | Reuse | Requirements |
|---|---|---|---|---|
| 1 | Settings route/page | `src/routes/settings.tsx`, `ssr:false`, atlas page shell like `about.tsx` | Pattern reused; code new | FR-004 |
| 2 | Navigation entry | One `atlas-nav-item` `Link` per existing header; no shared nav extraction | Existing class and duplication convention | FR-004, SC-006 |
| 3 | Configuration read model | `configuration-read-model.ts` from registry + existing config functions | `serverAtlasConfig()`, `codeIntelConfig()` reused; module new | FR-005, FR-012, FR-013 |
| 4 | Category classification | `setting-registry.ts` allowlist with invariants | New (data only) | FR-001, FR-002, FR-003, SC-001 |
| 5 | Effective values / defaults / availability | Value items with default where it exists, `isDefault`, `state` (valid/invalid); availability items via existing `can*` helpers | `canUseSqlite`, `canUseD1`, `canUseR2` reused | FR-005, FR-013, FR-017, FR-018 |
| 6 | Secret redaction | Status-only DTO type; `configured` = truthiness; value never retained | `getGitHubToken()` reused for the check | SEC-001, SEC-002, SEC-003, SEC-006, SC-002 |
| 7 | Sensitive non-secret | Availability-only type for SQLite path, D1/R2/queue identifiers, platform markers; fixed reason codes | Existing helpers | SEC-007, SEC-006 |
| 8 | Client-visible env vars | `clientVisible` flag; `VITE_SITE_URL` registered and badged; drift test on `.env.example` | New | SEC-003, SEC-008 |
| 9 | Preference persistence | `preferences.ts` + `atlas-store` init/subscribe; key `repoatlas.preferences.v1` | Existing store and key convention reused; `persist` middleware rejected (R5) | FR-009, FR-010, FR-011 |
| 10 | Preference reset | `resetPreferences()` in `atlas-store`; toast confirmation; does not touch sources or filters | Existing store, sonner | FR-006, FR-015 |
| 11 | Code-intel status read model | `code-intel-status.ts`, aggregate SELECTs; counts only | `canUseD1`, `getD1`, `SYMBOL_EXTRACTOR_VERSION` reused; no F001/F002 file modified | FR-014, FR-018 |
| 12 | Server/client boundary | Handler/wrapper split; no-input functions; isomorphic registry | Existing `*.functions.ts` pattern | FR-012, SEC-004 |
| 13 | Network-reachable safety | Content-based safety: allowlist + structural DTO types + fixed-text errors + sentinel test; no auth architecture | New tests | SEC-005, SEC-001, SEC-006, SEC-007 |
| 14 | Loading/error/empty/unavailable | Skeleton, Alert + Retry, "Unavailable" badge, empty message; +`SETTINGS_UNAVAILABLE` | `ui/skeleton`, `ui/alert`, catalog pattern reused; one code added | FR-008, FR-010, FR-018 |
| 15 | Tests | Registry, redaction, read model, preferences, status (in-memory D1) | `bun test`, d1 adapter, `setTestCloudflareEnv`, env save/restore pattern reused | SC-002, SC-004, SC-005 |
| 16 | Local validation | `tsc`, `bun test`, lint, quickstart manual checks; no Cloudflare | Existing scripts | FR-016, SC-005, NFR-001..004 |

## Requirement-to-Plan Mapping

| Requirement | Planned by |
|---|---|
| FR-001 | Registry (one category per item) + invariants test; category badge in every row (contracts/settings-surface.md) |
| FR-002 | Registry `changeMechanism`; no write function or control for B/C/D (contracts/server-functions.md "Out of contract") |
| FR-003 | Registry `default`, `validity`, `changeMechanism` |
| FR-004 | `settings.tsx` + five nav links |
| FR-005 | `ConfigurationSection`; DTO `category`, value/status/availability, `isDefault` |
| FR-006 | `PreferencesSection` switches (shared store, immediate) + reset button + confirmation toast |
| FR-007 | Switches only (no free-form input); `sanitizePreferences` validates stored data; note in research R5 |
| FR-008 | Loading/error/unavailable/invalid states; invalid shown as Invalid / unavailable; handler never throws on bad config |
| FR-009 | `preferences.ts` sanitize + `atlas-store` init/subscribe |
| FR-010 | `probePreferenceStorage()` + session-only behavior + notice |
| FR-011 | Only `repoatlas.preferences.v1`; no deployment-configuration persistence; no storage technology beyond existing browser storage |
| FR-012 | Server-controlled DTOs built from the allowlist; raw env/config never passed through |
| FR-013 | Value items call existing config functions unchanged; report the value in use, the actual default where one exists, and Invalid / unavailable for an unparseable value; no fabricated fallback |
| FR-014 | `code-intel-status.ts` read-only; no action, no fabrication |
| FR-015 | Store change limited to two fields; reset scoped; tests confirm sources/filters untouched |
| FR-016 | No Cloudflare/Wrangler/deploy step in build or validation; US1/US2 fully local |
| FR-017 | Availability items separated from local state (own badge/section grouping) |
| FR-018 | `available:false` + fixed reason; "Unavailable" not "failed" |
| SEC-001 | Status-only DTO type; sentinel serialization test |
| SEC-002 | No write path for C; no input control |
| SEC-003 | Registry invariant (C never client-visible; `VITE_*` never C); drift test on `.env.example` |
| SEC-004 | No-input server functions; the only editable data is boolean switches; test that handlers ignore input |
| SEC-005 | Content-based safety design; no auth, no roles |
| SEC-006 | Fixed-text `SETTINGS_UNAVAILABLE`; never forward `Error.message`; sentinel test on error output |
| SEC-007 | Availability-only type for paths/identifiers; sentinel test |
| SEC-008 | `clientVisible` badge; `VITE_SITE_URL` registered; invariant test |
| NFR-001 | Two cheap server reads; quickstart timing check |
| NFR-002 | Shared store switches, no refetch of atlas data; manual check |
| NFR-003 | Write-on-change subscription (no per-hover writes); no per-frame work; typecheck |
| NFR-004 | Existing responsive primitives and layout; nav follows existing breakpoint behavior; manual check at narrow width |
| SC-001 | Registry invariant + rendered category badge on every row |
| SC-002 | Sentinel test over DTOs and error output (browser network inspection in quickstart) |
| SC-003 | Immediate store effect; one-action reset; manual timing |
| SC-004 | Read-model tests with deliberately broken configuration |
| SC-005 | Local run and tests need no platform account; US3 data path via in-memory D1 |
| SC-006 | Nav link additions plus the specified remembered-preferences exception (store init for `autoRotate`, `showRelationships` only) |

Every planned module maps to at least one requirement above; nothing in the plan lacks a requirement.

## Security Model

- **No authentication, no roles.** Guest-first per spec (SEC-005). Safety is content-based: the DTOs are safe for any caller who can reach the instance.
- **Allowlist, not denylist**: the read model never enumerates `process.env` or `wrangler.toml`.
- **Structural redaction**: category-C and sensitive non-secret items have no value field in the DTO union; a value can only leak through a type-breaking change, which the sentinel test catches.
- **Client-visible variables** are identified, badged, and constrained by an invariant and a drift test (SEC-008); they are treated as public by definition.
- **Errors** use fixed catalog text; nothing from `Error.message`, stack, path or env is forwarded; internals are logged server-side in sanitized form only.
- **No write surface**: no function or control changes B/C/D; category A never leaves the browser.
- **Existing exposure is unchanged**: the already-unauthenticated F001/F002 server functions are out of scope for this feature.

## Persistence Approach

Only category-A preferences persist, browser-locally (`repoatlas.preferences.v1`, two booleans, per-item sanitize). No deployment/operator-configuration persistence, no new persistence system, no D1/R2/SQLite write, no server-side preference storage (FR-011). The existing store is reused as the runtime holder; the existing zustand `persist` mechanism is deliberately not used for it (per-hover writes, research R5).

## Testing Strategy

Bun unit and integration tests, using the repository's existing helpers; UI verified by typecheck plus quickstart (no component-test tooling exists; none added).

| Test | Layer | Covers |
|---|---|---|
| `setting-registry.test.ts` | unit | FR-001, FR-002, SEC-002, SEC-003, SEC-007, SEC-008, SC-001; `.env.example` `VITE_*` drift check |
| `configuration-read-model.test.ts` | unit (env save/restore pattern) | FR-005, FR-012, FR-013, SEC-001, SEC-006, SEC-007, SC-002, SC-004; sentinel secrets/paths; invalid numerics shown as Invalid / unavailable (no value, no fallback); no-input handler |
| `preferences.test.ts` | unit | FR-009, FR-010 (sanitize/probe with injected storage), FR-015 (reset scope), NFR-003 (writes only on change) |
| `code-intel-status.test.ts` | integration (in-memory D1) | FR-014, FR-018, SEC-007, SC-005; empty/seeded/no-binding; SELECT-only |
| Quickstart manual | manual | FR-004, FR-006, FR-007, FR-008, NFR-001, NFR-002, NFR-004, SC-003, SC-006, network-reachable check |

## Implementation Phases (ordering only; not tasks)

1. **Foundation (server-side, no UI)**: registry, read model, `SETTINGS_UNAVAILABLE`, server functions, code-intel status; registry/read-model/status tests. Proves the security and redaction guarantees first.
2. **Preferences**: `preferences.ts`, `atlas-store` init/subscribe/reset; preference tests.
3. **Surface**: `/settings` route, three components, five nav links; typecheck.
4. **Validation**: `bunx tsc --noEmit`, `bun test`, `bun run lint`, quickstart manual checks, confirmation that `git status` lists only the planned files.

## Dependency Analysis

| Dependency | Needed? | Why / how |
|---|---|---|
| Constitution I, III, IV, V | Constraints | See Constitution Check |
| Feature 003 (Sources UI) | Interaction only | `sources-store`, `SourcesDialog`, `SourcesMenu` are not modified or duplicated; the default-owner rule is unaffected (FR-015) |
| Feature 001 / 002 | **Read-only, US3 only** | Existing tables `snapshots`, `snapshot_extractions`; `SYMBOL_EXTRACTOR_VERSION`; `canUseD1`/`getD1` helpers. No F001/F002 file is modified |
| Existing app code | Reused | `atlas-config.ts`, `code-intel/config.ts` (read), `storage/atlas-store.ts` `canUseSqlite()`, `atlas-store.ts`, `atlas-errors.ts`, shadcn primitives |
| Feature 004 / 005 | **None** | `RELATIONSHIP_EXTRACTOR_VERSION` and `CODE_INTEL_RELATIONSHIP_*` are deliberately not displayed; the F004/F005 gate is not consulted |
| Feature 007 (MCP) | **None** | No MCP or CLI requirement here |
| Cloudflare / D1 / R2 / Queues / Wrangler | **Not a prerequisite** | Presence shown as availability only; US3 shows "unavailable" without a database binding |

## Explicitly Deferred (no plan content)

- **US4** editing operator/deployment configuration and any persistence for it (no acceptance obligations).
- **Runtime mutation controls**: start, pause, retry, clear/reset processing, any change to indexing or extraction state.
- Authentication, roles, RBAC, user management.
- Per-snapshot listing in the status view; per-user AI provider selection; editing of `CODE_INTEL_*` values; MCP/CLI.

## Remaining Ambiguities (plan-level; for review, not resolved by guessing)

- **A1 (resolved 2026-09-24 at plan review).** Invalid numeric configuration is shown honestly as **Invalid / unavailable**; no fallback is added to `serverAtlasConfig()`/`codeIntelConfig()` and none is fabricated (spec FR-013, US1 scenarios 4–5, FR-008, SC-004).
- **A2 (resolved 2026-09-24 at plan review).** SC-006 now names remembered `autoRotate`/`showRelationships` (and their browser-local persistence and reset) as its only exception.
- **A3. `VITE_SITE_URL` is declared in `.env.example` but unused by current code.** It is shown as client-visible non-secret; whether the variable should be kept is outside this feature.
- **A4. US3 granularity.** The plan provides aggregate counts by state and the version (smallest reading of FR-014/US3); a per-snapshot list is not planned. Confirm this is sufficient.
- **A5. Local availability of the status data.** Under plain dev there is no D1 binding, so US3 shows "unavailable" locally; populated behavior is proven by the in-memory integration test. Confirm acceptable for SC-005 (which requires only US1/US2 locally).
- **A6. Mobile navigation.** Existing headers hide the nav below `lg`; the new link inherits that limitation (NFR-004 is judged against existing pages).

## Complexity Tracking

No constitution violations; nothing to justify.
