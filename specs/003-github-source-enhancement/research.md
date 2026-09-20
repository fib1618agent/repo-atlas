# Phase 0 Research: GitHub Source Enhancement

Each entry resolves one architectural decision the spec (`spec.md`) or the plan's
Technical Context left open, in Decision / Rationale / Alternatives-considered
format, per `/speckit-plan`'s Phase 0 contract.

## 1. Navbar consolidation: shared component vs. patch four headers

**Decision**: Introduce one new component, `SourcesMenu.tsx`, as a drop-in
replacement for `AtlasSourcesChrome.tsx` — same props, same call site pattern —
built on the existing `components/ui/dropdown-menu.tsx` primitive (Radix-based,
already in the dependency tree, zero new libraries per Constitution V). Swap
this one component into all four existing per-route headers
(`index.tsx`, `catalogue.tsx`, `categories.tsx`, `insights.tsx`) in place of
`AtlasSourcesChrome`. Do **not** extract a shared `<Navbar>`/`<Header>`
component covering the logo, nav links, or per-route "About"/active-link
differences.

**Rationale**: FR-003 ("navbar must render identically... on every page")
only constrains the *Sources* control — the four existing headers already
differ slightly today (e.g. `insights.tsx` has a second, loading-state header
variant; `categories.tsx`'s nav includes an "About" link the others don't).
Extracting a full shared header component would touch nav/link structure the
spec explicitly puts out of scope ("do not redesign existing UI," "modify
unrelated pages"). A single swapped-in component satisfies FR-001–FR-006
exactly, keeps the diff to one new file + four one-line call-site edits per
route, and matches Constitution V (smallest correct change, no speculative
refactor).

**Alternatives considered**:
- *Full shared `<Navbar>` extraction*: rejected — larger diff, touches nav
  link markup the spec doesn't ask to change, higher regression risk across
  4 routes for a requirement that only concerns the Sources control.
- *Leave `AtlasSourcesChrome` and add a wrapping dropdown around it*: rejected
  — `AtlasSourcesChrome` already renders three always-visible controls
  imperatively; wrapping without restructuring would either keep the controls
  visible outside the dropdown (violates FR-004) or require the same
  internal rewrite anyway, so a clean replacement is simpler than a wrapper.

## 2. Connected Sources popup: new state vs. derived view

**Decision**: `ConnectedSourcesDialog.tsx` is a pure presentational component
driven entirely by a derived view-model computed from existing state —
`useSourcesStore()` (`sourceKey`, `isDefault`, `urls`) and the existing
`useAtlasRepositories()` result (`repositories`, `warnings`, `meta`). No new
persisted store fields, no new server function, no new D1/cache table.

**Rationale**: Every field FR-008 requires (type, identity, repository
count, status, color) is already derivable: type is always `"github"` today;
identity comes from `sourceKey`/`urls`; repository count is
`repositories.length` (or per-source counts computed client-side by grouping
`repositories` by their originating login, already present on each
`Repository` — see Data Model); status derives from `warnings`/
`meta.sourceFailures` (`PARTIAL_FAILURE`, `SOURCE_NOT_FOUND`,
`SOURCE_FORBIDDEN` already carry per-login failure info per
`atlas-errors.ts`). Introducing a new store field would duplicate data
already available and risk drifting out of sync with the real fetch result.

**Alternatives considered**:
- *New `connectedSources` field in `useSourcesStore`, written on every
  successful load*: rejected — redundant with data already returned by
  `getRepositories`, and persisting it would need its own staleness/reset
  handling (e.g. on `resetToDefault`) that the derived approach gets for
  free.

## 3. Add Sources popup: two modes as a UI-level split, not new parsing

**Decision**: Extend `SourcesDialog.tsx` in place with a two-tab mode
selector (`components/ui/tabs.tsx`, already available). Both tabs post
through the same existing `handleLoad` → `getRepositories` path. Mode 1 uses
today's row list unchanged (any `user`/`org`/`repo` kind accepted, matching
current behavior exactly — no regression). Mode 2 is additive: a second row
list that requires each entry to parse as `kind: "repo"` via the existing
`parseGitHubSource`, rejecting non-repo URLs with the same inline row-error
pattern already used for invalid URLs.

**Rationale**: `parseGitHubSource` already classifies `user`/`org`/`repo`
(`src/lib/github-url.ts`); no new parsing logic is needed, only a
mode-appropriate validation gate before submission. Keeping both modes
funneled through the existing `getRepositories`/`handleLoad` call preserves
every existing behavior (caching, dedupe, cap enforcement, toasts, warnings)
without duplicating that logic. This is the smallest change that satisfies
FR-013–FR-016 while leaving `repositories.functions.ts` untouched.

**Alternatives considered**:
- *Two separate dialogs*: rejected — spec explicitly says "extend the
  existing... popup. Do not create a new popup" (FR-012).
- *New server function `getRepositoriesForSpecificRepos`*: rejected — the
  existing `getRepositories({ sources })` already handles a list of
  `kind: "repo"` URLs identically to how it would need to; no backend
  distinction exists between "some of the sources happen to be repos" and
  "the user is in repo-only mode." The mode is a client-side input-shaping
  concern only.

## 4. `loadInitialSources` configuration surface

**Decision**: Extend `atlas-config.ts`'s existing env-var-with-fallback
pattern: add `ATLAS_LOAD_INITIAL_SOURCES` (boolean, default `true`, preserving
today's implicit always-on behavior) and `ATLAS_INITIAL_SOURCES` (JSON array
string, default `[{"type":"github","owner":"<ATLAS_DEFAULT_OWNER>"}]`),
surfaced through `serverAtlasConfig()` exactly like `ATLAS_DEFAULT_OWNER`
today. The existing `getRepositories({})` "default path" (used when
`useSourcesStore().isDefault` is `true`) consults this config: if
`loadInitialSources` is `false`, it returns an explicit empty/not-loaded
response instead of fetching the default owner.

**Rationale**: `useSourcesStore`'s persisted `isDefault`/`urls` already fully
determines precedence — a returning visitor with `isDefault: false` (custom
sources persisted) never calls the default path at all, so FR-026
("persisted custom sources take precedence") is satisfied automatically by
routing `loadInitialSources` only through the *default* code path, with zero
changes to the store's rehydration logic. This is additive to
`serverAtlasConfig()`, matching Constitution III (server-side config only,
no `VITE_*` exposure) and V (extend existing pattern, no new config
subsystem).

**Alternatives considered**:
- *Client-side JSON config file fetched at startup*: rejected — introduces a
  new client-visible config-loading mechanism where a server-env-var pattern
  already exists and is constitutionally mandated for this kind of setting
  (III: secrets/config server-side).
- *A dedicated `initialSources` table/store field synced from server config
  on load*: rejected — unnecessary; the existing default-path branch is the
  only place this decision needs to be consulted.

## 5. Repository Intelligence extension points: type-only, no wiring

**Decision**: Add one new exported TypeScript type,
`SelectedRepositoryForAnalysis` (see `data-model.md`), populated client-side
when a visitor confirms Mode 2 selections. No server function call, no
Feature 001/002 import, no new D1 write. The type's shape (host/owner/name
identity + `status: "added"`) is deliberately the same shape Feature 001's
`RepositoryIdentity` already uses (`provider`/`owner`/`name`,
`domain/repository-identity.ts`), so a *future* feature can pass it directly
to Feature 001's existing `acquireSnapshot` server function without a
reshape — but this feature does not call it.

**Rationale**: Spec Requirement 4/Story 6 explicitly says "design extension
points... do NOT implement... unless already supported" and this feature's
constraints forbid modifying Feature 002. Matching Feature 001's existing
`RepositoryIdentity` shape costs nothing now and removes a translation step
later, without creating any coupling today (no import from `code-intel/` in
this feature's new files).

**Alternatives considered**:
- *Introduce a stub server function that no-ops*: rejected — adds
  dead/untestable surface area for zero current behavior; a type
  definition alone fully satisfies "extension point," and FR-019 explicitly
  forbids implying capability that doesn't exist yet.

## 6. Category panel default-collapsed

**Decision**: Remove the `defaultValue="categories"` prop from the existing
`Accordion` in `src/routes/index.tsx` (or pass `undefined`). Confirmed via
`components/ui/accordion.tsx`: `Accordion` is a direct passthrough of Radix's
`AccordionPrimitive.Root` (`type="single" collapsible`), so omitting
`defaultValue` simply starts uncontrolled-and-closed while manual
expand/collapse (`AccordionTrigger`) continues to work exactly as today — no
controlled-state rewrite needed. No other change.

**Rationale**: The four headline stats already render outside the accordion
in the hero copy block (confirmed by inspection), so FR-021 ("stats remain
visible regardless of collapsed state") requires no code change — it is
already true. This is the single smallest change in the entire feature.

**Alternatives considered**: none meaningfully different — this is a
one-line default-value change to an existing, already-controllable
component.
