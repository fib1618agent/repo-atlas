# Feature Specification: GitHub Source Enhancement

**Feature Branch**: `003-github-source-enhancement`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Enhance GitHub source management and repository loading experience while preserving all existing RepoAtlas functionality. Consolidate navbar source actions into a single dropdown, add a Connected Sources popup, extend the existing Add Sources popup with two modes (load-all-repos-for-user vs analyze-specific-repos), define extension points for future repository intelligence, minimize the category panel by default while keeping key stats visible, and make initial repository loading on startup configuration-driven (`loadInitialSources`)."

## Existing System Analysis *(context for this spec, not part of the delivered feature)*

**Frontend**

- No shared `Navbar`/`Header` component exists today. The header markup (`<header className="atlas-header">` with `<nav>` links and source controls) is duplicated independently in `src/routes/index.tsx`, `catalogue.tsx`, `categories.tsx`, and `insights.tsx`. Each copy currently renders its own `AtlasSourcesChrome` instance.
- `AtlasSourcesChrome` (`src/components/atlas/AtlasSourcesChrome.tsx`) renders exactly three navbar elements today: an "Add sources" button, an "Export JSON" button, and (when a custom source is active) a "Sources: `<key>`" chip — all three are separate, always-visible controls, not a dropdown.
- `SourcesDialog` (`src/components/atlas/SourcesDialog.tsx`) is the existing "Add GitHub sources" popup — a single global instance rendered once in `src/routes/__root.tsx`, opened via `useSourcesStore().setDialogOpen(true)`. It already accepts a free-form list of GitHub URLs (user, org, or repo) in one flow via `parseGitHubSource` (`src/lib/github-url.ts`), which already classifies each input as `kind: "user" | "org" | "repo"`. There is currently no UI-level separation between "load all repos for a user" and "analyze specific repos" — both go through the same row list and the same `getRepositories` call.
- Source/UI state lives in a persisted Zustand store, `useSourcesStore` (`src/lib/sources-store.ts`): `urls`, `sourceKey`, `isDefault`, `dialogOpen`. Only one active source-set is tracked at a time (not a list of independently toggleable "connections").
- Repository data fetching is `useAtlasRepositories` (`src/lib/use-atlas-repositories.ts`), a TanStack Query hook keyed on `sourceKey`, calling the `getRepositories` server function with `{}` when `isDefault` or `{ sources: urls }` otherwise.
- The category/legend panel is the `#categories` block in `src/routes/index.tsx`, an `Accordion` (`defaultValue="categories"`, i.e. expanded on load) containing the category list. The four headline stats (Repositories / Categories / Platforms / Possibilities, rendered via `<Stat>`) already live outside this accordion, in the hero copy block — they are not affected by the accordion's collapsed/expanded state today.
- The 3D graph visualization (`AtlasScene`, `src/components/atlas/AtlasScene.tsx`) and repository detail panel (`RepositoryPanel.tsx`) are unaffected by this feature; out of scope per explicit constraint.

**Backend / data flow**

- Configuration today is env-var-with-constant-fallback (`src/lib/atlas-config.ts`: `ATLAS_DEFAULT_OWNER`, `ATLAS_MAX_SOURCES`, etc., read via `serverAtlasConfig()`) — there is no JSON/file-based app config yet, and no existing `loadInitialSources`-style startup toggle. The "default owner auto-loads on startup" behavior that exists today is implicit (falls back to `ATLAS_DEFAULT_OWNER` whenever `isDefault` is true), not an explicit, independently-toggleable setting.
- `getRepositories` (`src/lib/repositories.functions.ts`) is the sole server function backing repository loading: given `{ sources?: string[] }`, it resolves default-owner or custom sources through `github-fetch.ts`, applies caching (`storage/atlas-store.ts`), and returns `{ repositories, source, sourceKey, isDefault, warnings, meta }`.
- This atlas-listing pipeline (GitHub REST metadata only, for the 3D marble view) is **architecturally separate** from Feature 001 (Code Intelligence Foundation — commit-addressed snapshot acquisition into D1/R2) and Feature 002 (AST + Symbol Intelligence — structural extraction). "Repository Intelligence" in this spec's Requirement 4 refers to hooking selected repositories toward that existing acquisition/extraction pipeline, not building a new one.
- **Existing GitHub source flow**: `GitHub Source URL(s)` → `SourcesDialog` validates via `parseGitHubSource` → `getRepositories` server function → `github-fetch.ts` resolves user/org (spiral discovery, capped) or single repo → cached in `atlas-store` → `useAtlasRepositories` hydrates the 3D atlas (`AtlasScene`) and stats/legend panel.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consolidated Sources menu in the navbar (Priority: P1)

A visitor sees one "Sources" menu in the navbar, on every page, instead of separate "Add sources" / "Export JSON" / source-chip controls scattered next to each other. Opening it reveals the same three actions as a dropdown.

**Why this priority**: Lowest-risk, highest-visibility change; it is the entry point every other requirement in this feature builds on (the Connected Sources popup is reached from this same menu), and today's controls are duplicated across four separate route files, so consolidating them first establishes one place to extend.

**Independent Test**: Load any of the four existing pages (Explore, Catalogue, Categories, Insights); confirm a single "Sources ▼" control appears in the same position, and that clicking it reveals exactly "Add Sources", "Export JSON", and "Connected Sources" with no other source-related controls visible outside the menu.

**Acceptance Scenarios**:

1. **Given** a visitor on any page, **When** they look at the navbar, **Then** they see one "Sources" menu control and no separate "Add sources" button, "Export JSON" button, or source chip outside it.
2. **Given** the "Sources" menu is open, **When** the visitor reads its contents, **Then** they see exactly three items in order: Add Sources, Export JSON, Connected Sources.
3. **Given** the visitor selects "Export JSON" from the menu, **When** the export completes, **Then** the exact same success/error feedback occurs as the current standalone "Export JSON" button (same repository set, same disabled-when-empty behavior).
4. **Given** the visitor navigates between Explore, Catalogue, Categories, and Insights, **When** they check the navbar on each, **Then** the Sources menu looks and behaves identically on every page.

---

### User Story 2 - View connected sources (Priority: P2)

A visitor opens "Connected Sources" from the Sources menu and sees a summary of every source currently powering the atlas — today that is at most one GitHub user/org/repo-set, shown with a type indicator, identity, repository count, and status.

**Why this priority**: Delivers the visibility the feature is named for — depends on Story 1's menu existing, but delivers standalone value (users can currently only infer the active source from a truncated chip label).

**Independent Test**: With the default atlas loaded, open Connected Sources and confirm it shows the default GitHub source with a repository count matching the atlas; load a custom source via Add Sources and confirm the popup updates to reflect it.

**Acceptance Scenarios**:

1. **Given** the default atlas is showing (no custom sources loaded), **When** the visitor opens Connected Sources, **Then** they see one entry: source type GitHub, identity `github.com/<default owner>`, a repository count matching the currently loaded atlas, and a "connected" status with a colored indicator.
2. **Given** the visitor has loaded one or more custom GitHub sources via Add Sources, **When** they open Connected Sources, **Then** the popup reflects the current active source-set (identity/count/status), not the stale default.
3. **Given** the most recent load partially failed (some sources errored, per existing `PARTIAL_FAILURE`/source-failure warnings), **When** the visitor opens Connected Sources, **Then** the affected source's status reflects the degraded/error state rather than showing a plain "connected" status.
4. **Given** the popup's design, **When** a future non-GitHub source type is added, **Then** the same summary layout (type, identity, count, status, colored indicator) accommodates it without a redesign.

---

### User Story 3 - Add Sources with two explicit modes (Priority: P3)

Within the existing Add Sources popup, a visitor explicitly chooses between "load all repositories from GitHub users" and "analyze specific repositories" instead of mixing both intents in one undifferentiated URL list.

**Why this priority**: Extends existing, already-working functionality (URL parsing already distinguishes user/org from repo) — valuable but not blocking Stories 1–2, and depends on the popup being reachable from the new Sources menu (Story 1).

**Independent Test**: Open Add Sources, switch to Mode 1, enter a GitHub user URL, confirm all public repos for that user load as today; switch to Mode 2, enter one or more specific repo URLs, confirm only those repos are added/selected.

**Acceptance Scenarios**:

1. **Given** the Add Sources popup is open, **When** the visitor selects Mode 1 (GitHub users), **Then** they can enter one or more GitHub user/org URLs (with "+ Add another user", mirroring the existing multi-row pattern and the existing 5-source cap) and load all public repositories for each.
2. **Given** Mode 1 with multiple users entered, **When** the visitor submits, **Then** discovered repositories from all listed users are shown together, exactly as today's combined multi-source load behaves.
3. **Given** the Add Sources popup is open, **When** the visitor selects Mode 2 (specific repositories), **Then** they can add one or more individual `owner/repo` URLs and see them listed as discovered/selected repositories without pulling in the rest of that owner's repositories.
4. **Given** Mode 2 with repositories added, **When** the visitor confirms, **Then** only the explicitly listed repositories are loaded into the atlas (not the owning user's/org's full repository set).
5. **Given** either mode, **When** the visitor submits invalid input (malformed URL, non-GitHub host, blocked path), **Then** the same per-row validation errors as today's popup are shown, and nothing is loaded.
6. **Given** either mode's submission, **When** it succeeds, **Then** the existing toasts, caching, and default-atlas-preserved-until-Load behavior are unchanged.

---

### User Story 4 - Category panel minimized by default (Priority: P4)

On the Explore page, the category legend panel starts collapsed so the 3D graph, hero stats, and repository details are more visible; the visitor can still expand it manually at any time.

**Why this priority**: Small, self-contained visual default change; independently valuable and independently testable, no dependency on the other stories.

**Independent Test**: Load the Explore page fresh; confirm the category list starts collapsed while the four headline stats remain visible; click to expand and confirm the full category list appears.

**Acceptance Scenarios**:

1. **Given** a visitor loads the Explore page for the first time, **When** the page renders, **Then** the category legend list is collapsed by default.
2. **Given** the category legend is collapsed, **When** the visitor looks at the page, **Then** the Repositories, Categories, Platforms, and Possibilities stats remain visible regardless of the legend's collapsed state.
3. **Given** the collapsed legend, **When** the visitor clicks to expand it, **Then** the full category list appears, identical to today's expanded view.
4. **Given** the visitor has expanded the legend, **When** they click again, **Then** it collapses — manual toggling works in both directions.

---

### User Story 5 - Configuration-driven initial repository loading (Priority: P5)

On application startup, the atlas automatically loads repository marbles for a configured set of initial sources (today, implicitly, the default GitHub owner) — but this behavior is explicit, named (`loadInitialSources`), and can be turned off or repointed via configuration without a code change.

**Why this priority**: Formalizes existing implicit behavior into an explicit, documented setting; low risk since the default-owner auto-load already happens today, but independently valuable as it unblocks configuring RepoAtlas for a different default identity or disabling auto-load entirely.

**Independent Test**: With `loadInitialSources: true` and `initialSources: [{ type: "github", owner: "imdadareeph" }]`, confirm the atlas auto-populates on a fresh session exactly as today. With `loadInitialSources: false`, confirm the atlas starts empty (or in an explicit "no source loaded" state) until the visitor adds a source manually.

**Acceptance Scenarios**:

1. **Given** `loadInitialSources` is `true` with one configured GitHub owner, **When** a visitor loads the app with no prior session state, **Then** repository marbles for that owner load automatically, matching today's default-owner behavior.
2. **Given** `loadInitialSources` is `false`, **When** a visitor loads the app with no prior session state, **Then** no repositories are auto-loaded and the visitor must use Add Sources to populate the atlas.
3. **Given** a returning visitor with a previously-loaded custom source-set persisted from an earlier session, **When** they reload the app, **Then** their persisted custom sources take precedence over `initialSources` (existing session state is never silently overwritten by startup configuration).
4. **Given** `initialSources` lists more than one entry, **When** the app starts, **Then** all listed sources load together, following the same combined-source behavior as manually adding multiple sources today.
5. **Given** the configured initial GitHub owner is unreachable (rate-limited, not found), **When** startup auto-load fails, **Then** the visitor sees the same fallback/error handling that today's default-owner failure path already provides (bundled fallback dataset / error messaging), not a silent blank atlas.

---

### User Story 6 - Extension points for repository intelligence (Priority: P6)

For repositories selected via Add Sources (either mode), the system exposes a defined extension point where deeper repository intelligence (source analysis, function/class extraction, dependency mapping, call graphs, categorization, AI-generated notes) can be triggered later, without requiring this feature to implement that intelligence itself.

**Why this priority**: Architecture-only — defines where future work plugs in; explicitly not required to produce visible behavior beyond exposing the hook, so it is lowest priority and independently deferrable.

**Independent Test**: Confirm that a selected-repository record includes a stable identifier and a "not yet analyzed" state that a separate process (e.g. the existing Feature 001/002 acquisition-and-extraction pipeline) could act on, and that no analysis is triggered synchronously by selection alone.

**Acceptance Scenarios**:

1. **Given** a visitor selects specific repositories via Mode 2, **When** selection completes, **Then** each selected repository is identifiable (owner/name/host) in a form suitable for handing off to a separate analysis process — no analysis runs as part of this feature.
2. **Given** the extension-point design, **When** a future feature wires in source analysis / function extraction / class extraction / dependency mapping / call graph generation / categorization / AI notes, **Then** it can do so by consuming the selected-repository record without changing this feature's UI contract.
3. **Given** this feature ships without any intelligence-generation capability implemented, **When** a visitor uses Mode 2, **Then** the UI is honest about this (e.g., repositories are marked "added" / "queued", not falsely marked "analyzed").

---

### Edge Cases

- What happens when the visitor opens Connected Sources with zero sources ever loaded (very first visit, `loadInitialSources: false`)? The popup must show an empty/not-yet-connected state, not an error.
- How does the Sources dropdown behave on narrow/mobile viewports where today's chip is already hidden (`hidden ... sm:block`)? The dropdown must remain reachable at all breakpoints, not silently disappear.
- What happens if the same GitHub user/org is entered in both Mode 1 and Mode 2 across the 5-source cap in one session? The existing dedupe-and-cap behavior (`dedupeSources`, `ATLAS_MAX_SOURCES`) must still apply across modes combined, not double the effective cap.
- What happens when Mode 2 is submitted with zero repositories added? Same "add at least one source" validation as today's empty-form case.
- What happens when `loadInitialSources: true` but the visitor has an existing persisted custom source-set from a previous session? Persisted state wins (see Story 5, Scenario 3) — initial-source config only applies to genuinely fresh sessions.
- What happens when the configured `initialSources` references a source type not yet supported (e.g. `"gitlab"` before GitLab loading is implemented)? Startup must fail gracefully for that entry (skip with a logged/reported warning) rather than crashing the app.
- How does Export JSON behave from within the dropdown when there are zero repositories loaded? Same disabled-button behavior as today, moved into the menu item.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST present exactly one "Sources" menu control in the navbar, replacing the current separate "Add sources" button, "Export JSON" button, and source-identity chip.
- **FR-002**: The Sources menu MUST expose exactly three actions, in this order: Add Sources, Export JSON, Connected Sources.
- **FR-003**: The Sources menu MUST render identically (same items, same position, same behavior) on every existing page (Explore, Catalogue, Categories, Insights).
- **FR-004**: No source-related action (adding sources, exporting, viewing connections) MUST be duplicated as a standalone control outside the Sources menu.
- **FR-005**: Selecting "Export JSON" from the menu MUST preserve all existing export behavior — same data exported, same disabled-when-empty condition, same success/error feedback.
- **FR-006**: The Sources menu's design MUST accommodate future source providers being added as additional menu context or Connected Sources entries without restructuring the menu itself.
- **FR-007**: Selecting "Connected Sources" MUST open a popup listing every source currently contributing to the loaded atlas.
- **FR-008**: Each entry in the Connected Sources popup MUST display: source type, source identity (e.g. `github.com/<owner>`), repository count contributed by that source, connection status, and a colored status/type indicator.
- **FR-009**: The Connected Sources popup's data model MUST support source types beyond GitHub (GitLab, Bitbucket, local repositories, enterprise repositories) without a layout redesign, even though only GitHub is functionally supported in this feature.
- **FR-010**: The Connected Sources popup MUST reflect the currently active source-set (default or custom) and MUST update when the active source-set changes.
- **FR-011**: If the most recent source load produced partial failures, the affected source's status in the popup MUST reflect that degraded state rather than a generic "connected" status.
- **FR-012**: The existing Add Sources popup MUST be extended, not replaced — it remains the same dialog, reachable from the Sources menu (FR-002).
- **FR-013**: The Add Sources popup MUST support two explicit modes: (Mode 1) load all public repositories for one or more GitHub users/organizations, and (Mode 2) add and load only specific, explicitly listed repositories.
- **FR-014**: Mode 1 MUST allow adding multiple GitHub users/organizations in one submission, consistent with the existing multi-row "+ Add another" pattern and the existing combined-source cap.
- **FR-015**: Mode 2 MUST allow adding multiple specific repositories in one submission and MUST load only those repositories, not the rest of their owner's/org's repository set.
- **FR-016**: Both modes MUST reuse the existing URL validation, deduplication, error surfacing, and source-cap enforcement already implemented for the Add Sources flow.
- **FR-017**: The system MUST define, but is NOT required to implement in this feature, extension points for repository-level intelligence: source analysis, function extraction, class extraction, dependency mapping, call graph generation, repository categorization, and AI-generated notes.
- **FR-018**: Repositories selected via Mode 2 MUST be represented in a form (stable owner/name/host identity) that a separate intelligence-generation process can consume, without this feature performing that analysis itself.
- **FR-019**: The system MUST NOT present Mode-2-selected repositories as "analyzed" or "intelligence-ready" unless and until that capability actually exists.
- **FR-020**: The category/legend panel on the Explore page MUST be collapsed by default on initial page load.
- **FR-021**: The Repositories, Categories, Platforms, and Possibilities headline stats MUST remain visible regardless of the category panel's collapsed/expanded state.
- **FR-022**: Visitors MUST be able to manually expand and collapse the category panel at any time, with the manual toggle unaffected by this change.
- **FR-023**: The system MUST support a configuration setting, `loadInitialSources` (boolean), controlling whether repositories auto-load on a fresh session with no prior state.
- **FR-024**: When `loadInitialSources` is enabled, the system MUST support a configured list of initial sources (`initialSources`, each with at least `type` and an identity field such as `owner`) that load automatically on startup.
- **FR-025**: When `loadInitialSources` is disabled, the system MUST start with no repositories auto-loaded, requiring the visitor to add a source manually.
- **FR-026**: A visitor's previously persisted custom source-set (from an earlier session) MUST take precedence over `initialSources` — startup configuration only applies to genuinely fresh sessions with no persisted state.
- **FR-027**: If startup auto-loading of a configured initial source fails, the system MUST fall back to existing error/fallback handling (bundled default dataset and/or user-visible error messaging) rather than leaving the atlas silently empty without explanation.
- **FR-028**: All existing GitHub source loading, repository discovery, repository processing, and atlas visualization behavior MUST continue to function exactly as before this feature — no regression to the current flow described in "Existing GitHub Source Flow" above.
- **FR-029**: This feature MUST NOT alter the 3D graph visualization architecture, the repository detail panel, or navigation routes.

### Key Entities

- **Connected Source**: A currently-active contributor to the loaded atlas. Attributes: source type (github today; gitlab/bitbucket/local/enterprise reserved for future), identity (e.g. owner or org login), repository count, connection status (connected / degraded / error), display color. Today, at most one "source-set" (possibly combining several GitHub logins) is active at a time.
- **Source Input Mode**: The visitor's declared intent when adding a source — "user/org (load all)" or "specific repositories (analyze selected)". Not a persisted entity; a UI-time distinction that maps onto the existing `kind: "user" | "org" | "repo"` classification already produced by URL parsing.
- **Selected Repository (for intelligence)**: A repository explicitly chosen via Mode 2, carrying a stable identity (host, owner, name) and an intelligence status (e.g. "added" / "queued", never "analyzed" unless real analysis has run). Intended hand-off point to a separate analysis process; no new persisted analysis data introduced by this feature.
- **Startup Source Configuration**: `loadInitialSources` (boolean) plus `initialSources` (list of `{ type, owner }`-shaped entries). Deployment/environment-level configuration, not a per-visitor setting, analogous to existing `ATLAS_DEFAULT_OWNER`-style configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can find and use every existing source action (add, export, view) from a single navbar menu, on 100% of existing pages, with zero source-related controls remaining outside that menu.
- **SC-002**: A visitor can determine, within one click from any page, how many sources are connected, their type, and their repository counts — a task that currently requires inferring state from a truncated chip label.
- **SC-003**: A visitor can add repositories via either "load all for a user" or "specific repositories" without needing to know today's underlying mixed-input syntax, and without any drop in successfully-loaded-repository accuracy compared to the current single-mode flow.
- **SC-004**: Zero regressions: every existing acceptance scenario for GitHub source loading, export, and the default atlas continues to pass unchanged after this feature ships.
- **SC-005**: The Explore page's 3D graph and headline stats are visible above the fold, without the category list, for first-time visitors on standard desktop and mobile viewport sizes.
- **SC-006**: An operator can change or disable automatic startup repository loading by editing configuration alone, with no code changes required.

## Assumptions

- No shared `Navbar`/`Header` component exists today; consolidation is applied within each route's existing header markup rather than requiring a full component-extraction refactor, since the constraint set explicitly forbids redesigning existing UI structure. (Extracting a shared component remains a reasonable implementation choice as long as visual/behavioral output is unchanged on every page — left to planning.)
- The existing `parseGitHubSource` classification (`user` / `org` / `repo`) already provides the underlying distinction Mode 1 vs Mode 2 needs; this feature is a UI-level mode selector over already-supported parsing/fetch logic, not a new backend capability.
- "Connected Sources" reflects the single active source-set already tracked by `useSourcesStore` (at most one combined set of up to `ATLAS_MAX_SOURCES` GitHub logins at a time) — this feature does not introduce simultaneously-active independent source "accounts" beyond what's already supported.
- Repository Intelligence extension points (Requirement/Story 6) are designed to hand off to the existing, separate Feature 001 (Code Intelligence Foundation) / Feature 002 (AST + Symbol Intelligence) pipeline rather than introducing a new analysis pipeline; no synchronous, heavy analysis is triggered by this feature itself.
- `loadInitialSources`/`initialSources` is deployment/operator-level configuration (mirroring the existing `ATLAS_DEFAULT_OWNER`-style env-var pattern), not a visitor-facing settings UI — visitors continue to control their own session via Add Sources / Reset to default as today.
- Only GitHub is functionally supported for Mode 1/Mode 2 fetching and for `initialSources` in this feature; GitLab/Bitbucket/local/enterprise are represented only as reserved entries in the Connected Sources data model for forward compatibility, matching the existing "GitLab" icon already shown (statically) in today's navbar.
- The existing 5-source cap (`ATLAS_MAX_SOURCES`), dedupe behavior, and per-row validation apply uniformly across Mode 1 and Mode 2 combined, not as separate independent caps.
