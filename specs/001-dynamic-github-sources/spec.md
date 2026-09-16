# Feature Specification: Dynamic GitHub Sources

**Feature Branch**: `001-dynamic-github-sources`

**Created**: 2026-09-16

**Status**: Clarified

**Input**: User description: "baseline feature spec (e.g. dynamic GitHub sources from docs/dynamic-sources-prompt.md)"

## Clarifications

### Session 2026-09-16

- Q: When a visitor returns or refreshes the page after a successful custom load,
  should the atlas always fetch fresh public repository data from GitHub, or may
  it show the last fetched snapshot until the visitor loads sources again?
  → A: Re-apply saved source URLs on each visit; server may serve cached
  repository data up to approximately 15 minutes old before re-fetching from
  GitHub.
- Q: While a visitor is loading a new set of GitHub sources, should the 3D
  atlas keep showing the current repositories until the new load succeeds?
  → A: Keep the current atlas visible until the new load succeeds; show a
  loading indicator without clearing marbles.
- Q: When more than 800 repositories qualify for the 3D atlas and many share the
  same star count, how should the system decide which marbles to show?
  → A: Highest stars first; ties broken by most recent push date.
- Q: When a successful custom load returns repositories from the pasted sources
  only, should those results fully replace the default owner atlas, or should
  the default owner’s repositories always remain included?
  → A: Replace only: show repositories from loaded sources; exclude the default
  owner unless its profile URL is explicitly one of the pasted sources.
- Q: When more than 2,000 repositories are fetched and the catalogue must
  truncate, should the same ranking rule apply as the 3D atlas (highest stars,
  then most recent push date)?
  → A: Same rule everywhere: stars descending, then most recent push date; the
  800-repository spiral is a subset of the up-to-2,000 catalogue ranking.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Load GitHub profiles into the atlas (Priority: P1)

A visitor wants to explore public repositories from one or more GitHub users,
organizations, or individual repositories—not only the built-in default profile.
They open an “Add sources” dialog, paste up to five GitHub URLs (or shorthand
names), and click Load. The 3D atlas, catalogue, categories view, and insights
all update to show only those public repositories.

**Why this priority**: This is the core product expansion—without it, RepoAtlas
remains a single-owner demo. Loading custom sources is the primary reason for
this feature.

**Independent Test**: Paste a known public GitHub user URL, load, and confirm
every atlas view shows that user’s public repos as interactive marbles with
accurate names, descriptions, and stats.

**Acceptance Scenarios**:

1. **Given** a first-time visitor, **When** they open the app without loading
   custom sources, **Then** they see the default owner’s public repository
   atlas (unchanged from today).
2. **Given** the add-sources dialog, **When** the visitor enters one valid GitHub
   user profile URL and clicks Load, **Then** the spiral and all data pages
   show that user’s public, non-archived repositories.
3. **Given** the add-sources dialog with multiple valid URLs (up to five),
   **When** the visitor clicks Load, **Then** repositories from all sources
   appear once each (duplicates across sources removed), the default owner’s
   repositories are excluded unless that owner’s URL was pasted, and every view
   stays in sync.
4. **Given** a valid single-repository URL, **When** the visitor loads it,
   **Then** exactly one marble appears for that repository.
5. **Given** an atlas is already showing repositories, **When** the visitor
   starts a new Load, **Then** the current marbles remain visible with a
   loading indicator until the new load succeeds or fails.

---

### User Story 2 - Control and restore the default atlas (Priority: P1)

A visitor may open the add-sources dialog but decide not to change anything, or
they may want to return to the original default atlas after experimenting. The
system must not change the dataset until a successful Load, and must offer a
clear way to restore the default.

**Why this priority**: Equal to P1 for trust—accidental or partial input must
not break the default experience. Constitution principle I (Data Fidelity)
depends on this behavior.

**Independent Test**: Open dialog, cancel without loading—default unchanged.
Load custom sources, then reset—default returns.

**Acceptance Scenarios**:

1. **Given** the default atlas is showing, **When** the visitor opens the
   dialog and clicks Cancel (or closes without Load), **Then** the dataset
   remains the default owner’s repositories.
2. **Given** the dialog with only empty URL fields, **When** the visitor
   clicks Load, **Then** a clear validation message appears and the dataset
   does not change.
3. **Given** a custom source load succeeded earlier, **When** the visitor
   chooses “Reset to default” and confirms, **Then** the default owner atlas
   returns on all pages and custom source preferences are cleared.
4. **Given** a custom load fails entirely, **When** the error is shown,
   **Then** the previously active dataset (default or last successful custom)
   remains visible and is not mixed with the default owner’s offline backup
   data.

---

### User Story 3 - Understand errors and recover (Priority: P2)

When a URL is invalid, a profile does not exist, GitHub is unreachable, or
rate limits apply, the visitor sees a plain-language message and a sensible
next step (fix URL, retry, reset to default, or dismiss)—not a blank atlas or
silent failure.

**Why this priority**: Public GitHub access is rate-limited and error-prone;
recoverable UX prevents abandonment.

**Independent Test**: Submit an invalid URL, a non-existent username, and
simulate offline—each shows the documented message and leaves prior data intact.

**Acceptance Scenarios**:

1. **Given** an invalid non-GitHub URL in one row, **When** Load is clicked,
   **Then** that row shows an error and no fetch runs for invalid rows.
2. **Given** a username that does not exist on GitHub, **When** Load is clicked,
   **Then** the visitor sees that the source was not found and the prior
   dataset is unchanged.
3. **Given** GitHub rate limiting, **When** Load is clicked, **Then** the
   visitor is told to try later (and optionally that an access token can be
   configured by the operator) without corrupting the current atlas.
4. **Given** two of three sources succeed and one fails, **When** Load
   completes, **Then** repositories from successful sources appear and the
   visitor is informed which source(s) failed.

---

### User Story 4 - Export the active repository list (Priority: P2)

A visitor (or researcher) wants a portable snapshot of the currently loaded
repository metadata—for offline analysis, sharing, or backup. They click Export
and receive a structured file of the active dataset.

**Why this priority**: High value with low risk; supports transparency and
reuse of atlas data without requiring re-fetch.

**Independent Test**: Load any source set, export, open file—contains source
list, export timestamp, and repository records matching on-screen data.

**Acceptance Scenarios**:

1. **Given** a loaded atlas with at least one repository, **When** the visitor
   clicks Export, **Then** a downloadable file is saved containing metadata
   for all repositories currently in the catalogue (not only spiral-visible
   repos).
2. **Given** no repositories loaded, **When** Export is clicked, **Then** the
   visitor sees that there is nothing to export.

---

### User Story 5 - Return quickly on repeat visits (Priority: P3)

A visitor who previously loaded custom sources returns later and expects the
same source list without re-entering URLs. The system remembers their last
successful custom configuration for the session and across browser restarts.

**Why this priority**: Quality-of-life after P1–P2; reduces friction for repeat
exploration.

**Independent Test**: Load custom sources, reload the browser—same sources and
repos appear without reopening the dialog.

**Acceptance Scenarios**:

1. **Given** a successful custom load, **When** the visitor refreshes the page,
   **Then** the same custom source URLs load automatically and repository data
   is shown from cache if fetched within the last ~15 minutes, otherwise
   refreshed from GitHub.
2. **Given** the default atlas (never loaded custom), **When** the visitor
   refreshes, **Then** the default owner atlas loads (not empty, not stale
   custom data).

---

### Edge Cases

- What happens when a source has zero public, non-archived repositories? Show
  an empty-state message on list views; spiral may show no marbles with clear
  copy—not a crash.
- What happens when total public repos exceed display limits? Repositories are
  ranked by highest star count, then most recent push date; catalogue lists up to
  2,000, the 3D atlas shows the top 800 of that same ranking, and visitors are
  notified when truncation applies.
- What happens when the sixth “Add more” row is requested? Control is disabled
  with “Maximum 5 GitHub URLs.”
- What happens when duplicate profile URLs are entered? Duplicates are removed
  with a brief notice; load proceeds with unique sources.
- What happens when the default owner’s live data is unavailable? Only on the
  default path, show bundled backup data with a one-time notice—never substitute
  default backup data into a failed custom load.
- What happens for private or restricted organizations? Show refusal message;
  do not expose private repository metadata.
- What happens when the visitor loads only org URLs vs user URLs? Both resolve
  to public repository lists using the same dialog and limits.
- What happens on refresh within the ~15-minute cache window? Saved source URLs
  restore automatically; repository metadata may match the prior fetch without
  a new GitHub request.
- What happens on refresh after the cache window expires? Saved source URLs
  restore automatically and repository data is re-fetched from GitHub.
- What happens during an in-progress Load while marbles are on screen? The
  current atlas stays visible with marbles mounted; `AtlasLoading` overlays
  explore during fetch; the dialog Load button shows `Loading…`; marbles are
  replaced only after a successful load.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display the default owner’s public repository atlas
  on first visit and whenever no successful custom load has occurred.
- **FR-002**: System MUST provide an “Add sources” entry point on every atlas
  data page: header **Add sources** on all four routes; explore also offers hero
  **Load GitHub users**; on catalogue, categories, and insights the **Sources**
  chip (when viewing a custom atlas) MUST also open the same dialog.
- **FR-003**: System MUST accept GitHub user profiles, organization profiles,
  and individual repository URLs (with or without `https://`).
- **FR-004**: System MUST allow up to five source URLs per load operation.
- **FR-005**: System MUST fetch only public, non-archived repositories from
  accepted sources.
- **FR-006**: System MUST update the 3D atlas, catalogue, categories, and
  insights views together whenever the active source set changes.
- **FR-022**: On successful custom load, system MUST show only repositories
  from the loaded sources; the default owner’s repositories MUST NOT be included
  unless the default owner’s profile URL is explicitly among the pasted sources.
- **FR-007**: System MUST NOT change the active dataset until the visitor
  successfully completes a Load action.
- **FR-021**: During an in-progress Load, system MUST keep the current 3D atlas
  visible until the new load succeeds or fails; a loading indicator MUST be
  shown without clearing marbles prematurely. On explore (`/`), reuse the
  existing `AtlasLoading` overlay while `isFetching` when prior repositories
  exist (marbles stay mounted). The add-sources dialog Load control MUST show
  `Loading…` and be disabled for the same fetch. List pages (catalogue,
  categories, insights) MUST show their existing loading copy during refetch
  without flashing empty when prior data exists.
- **FR-008**: System MUST provide “Reset to default” with confirmation that
  restores the default owner atlas and clears saved custom source preferences.
- **FR-009**: System MUST deduplicate repositories that appear under multiple
  loaded sources.
- **FR-010**: System MUST cap the 3D atlas at 800 repositories, ranking by highest
  star count then most recent push date when star counts tie, and inform the
  visitor when truncation occurs.
- **FR-011**: System MUST cap catalogue data at 2,000 repositories using the same
  ranking as the 3D atlas (highest star count, then most recent push date when
  stars tie); the spiral MUST show the top 800 of that ranked set; inform the
  visitor when either cap applies.
- **FR-012**: System MUST show repository metadata (name, description, language,
  topics, stars, forks, issues, license, dates, URL) matching the upstream
  source—never invented values.
- **FR-013**: System MUST display documented error messages with recovery
  actions for validation failures, not-found sources, network failures, rate
  limits, and partial load failures.
- **FR-014**: System MUST preserve the previous dataset when a custom load
  fails completely.
- **FR-015**: System MUST offer JSON export of the full active repository list
  with source metadata and export timestamp.
- **FR-016**: System MUST persist the last successful custom source list so
  repeat visits reload without re-entry (until reset to default).
- **FR-020**: On repeat visit, system MUST restore saved custom source URLs and
  MAY serve repository data from server cache for up to approximately 15 minutes
  before re-fetching from GitHub (same freshness policy as the default-owner
  atlas).
- **FR-017**: System MUST show which sources are active when viewing a custom
  atlas (e.g., a “Sources: userA + orgB” indicator with access back to the
  dialog).
- **FR-018**: System MUST keep optional AI-generated repository summaries
  supplementary, with a non-AI summary always available when AI is unavailable
  (no change to visitor trust in core metadata).
- **FR-019**: Operators MUST be able to configure optional GitHub and AI
  access credentials via environment template (not exposed to visitors in the
  browser).

### Key Entities

- **Source**: A GitHub user, organization, or single repository identified by
  a URL or shorthand name; up to five per load; has a display login and kind
  (user, org, repo).
- **Repository record**: Public project metadata from GitHub used for marbles,
  panels, filters, and export; belongs to one logical source; unique by
  platform repository id.
- **Active source set**: The sources currently driving the atlas; either the
  default owner alone or the visitor’s last successful custom load.
- **Atlas view**: Any consumer of the repository list—3D explore, catalogue,
  categories, insights—must reflect the same active source set.
- **Export snapshot**: Point-in-time JSON document of active sources and
  repository records for download.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can load a new GitHub user’s public repositories and
  see them in the atlas within 30 seconds under normal network conditions for
  up to 500 repositories across five sources.
- **SC-002**: 100% of atlas views show the same repository count and source
  label immediately after a successful load or reset (no page left on stale data).
- **SC-003**: At least 95% of visitors who cancel the add-sources dialog
  without loading see the unchanged default atlas (zero unintended dataset
  switches in acceptance testing).
- **SC-004**: When custom load fails, 100% of acceptance tests retain the
  prior dataset with no default-owner backup data mixed in.
- **SC-005**: Export produces a valid file within 5 seconds for datasets up to
  2,000 repositories on a typical laptop.
- **SC-006**: After loading custom sources once, a browser refresh restores the
  same source URLs without re-entry in 100% of acceptance tests; metadata within
  the ~15-minute cache window MAY match the prior fetch.
- **SC-007**: The 3D atlas remains interactive (hover, select, rotate) with
  800 marbles at ≥30 FPS while idle-orbiting on a **reference device**: Apple M1
  or Intel Core i5 (2018+), 8 GB RAM, 1080p display, latest Chrome or Safari
  (see `quickstart.md` §11).
- **SC-008**: Every error scenario in the error catalog has a corresponding
  user-visible message and at least one recovery action in acceptance tests.

## Assumptions

- Visitors explore **public** GitHub data only; private repos and OAuth sign-in
  are out of scope for this feature.
- GitLab and other hosts remain out of scope; only `github.com` URLs are valid.
- The default owner (`imdadareeph`) remains the product default until custom
  load; marketing copy may still reference the default profile.
- Display limits (5 sources, 800 spiral marbles, 2,000 catalogue rows) are
  acceptable product caps documented in constitution v1.0.0.
- Forks may appear; archived repositories are excluded.
- Optional operator-configured GitHub token improves rate limits but does not
  change visitor-facing source limits.
- On repeat visit, saved source URLs persist in browser storage; repository
  metadata MAY be served from server cache for up to approximately 15 minutes
  before a fresh GitHub fetch (aligned with default-owner behavior).
- Optional local durable cache beyond the 15-minute server window is a P3
  implementation concern for development operators only.
- Extended AI insight panels (multi-paragraph “Ask AI” sheet) are a **future
  feature**; this spec only requires existing summary behavior to remain
  reliable and env-configurable for operators.
- Implementation details, exact UI copy, error codes, and file layout are
  documented in `docs/dynamic-sources-prompt.md` for the planning phase.

## Out of Scope

- Private repository access or user authentication to GitHub.
- Live GitLab (or other forge) synchronization.
- Rewriting 3D funnel geometry or visual design system.
- Visitor-facing API key entry for AI providers.
- Committing live API dumps or local cache database files to version control.
