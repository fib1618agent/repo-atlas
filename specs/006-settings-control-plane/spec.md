# Feature Specification: Settings / Control Plane

**Feature Branch**: `006-settings-control-plane` (specification only; no dedicated git branch was created for this spec)

**Created**: 2026-09-24

**Status**: Draft (clarified 2026-09-24; not planned)

**Input**: User description: "Start Feature 006, Settings / Control Plane, local-first. Define what 'Settings / Control Plane' means for RepoAtlas before any architecture or implementation. Distinguish user-configurable application settings, operator/deployment configuration, secrets/credentials, and runtime operational controls, and state which category each setting belongs to. Do not assume every environment variable becomes a UI setting. Do not expose secrets through the browser. Do not silently override Feature 003's decision that a visitor-facing settings UI was out of scope." Clarified 2026-09-24 (see Clarifications).

## Relationship to Prior Decisions *(context for this spec, not part of the delivered feature)*

- **Feature 003 boundary.** Feature 003 (`specs/003-github-source-enhancement/spec.md`, Assumptions) records that `loadInitialSources`/`initialSources` is "deployment/operator-level configuration … not a visitor-facing settings UI — visitors continue to control their own session via Add Sources / Reset to default as today." Feature 003's own scope excluded a settings UI. **This feature does not pretend that decision never existed.** Feature 006 records its own boundary as a **new feature decision** (see Clarifications, Q1): the surface serves the local Guest/developer of a developer-operated RepoAtlas instance, not an anonymous visitor to a hosted site. Nothing in this spec changes Feature 003's behavior.
- **Constitution** (`.specify/memory/constitution.md`): Principle III (secrets and provider keys live in server environment variables only; never via `VITE_*` or client bundles), Principle I (the default atlas owner stays active until a user successfully loads custom sources; empty or cancelled dialogs do not change the dataset), Principle V (smallest correct change; features named in an approved spec only). Out of scope unless a ratified spec adds them: OAuth, private repos.
- **Existing design intent** (`docs/dynamic-sources-prompt.md`): provider/API keys stay in `.env` and not in the UI; "Settings for provider select" was deferred as later work and never specified.
- **Feature 005 / Feature 004 T007 is paused.** No requirement here depends on the Cloudflare CPU-limit questions, LX-1, or any waiver. The code-intelligence tunables are treated as read-only information here for that reason (see Configuration Classification).

## Clarifications

### Session 2026-09-24

- Q: Who is the audience of Settings / Control Plane, and is an access model (roles, authentication) required? → A: **Guest-first, local.** RepoAtlas is a developer-operated local engineering-intelligence platform. **Guest** means the developer/operator using their own local RepoAtlas instance without authentication. The Settings / Control Plane is available to that Guest. No Admin role, no RBAC, no user management and no authentication are required or introduced by Feature 006; authentication and multi-user authorization are outside this feature. Feature 003's deferral of a *visitor-facing* settings UI is not overridden for a hosted, multi-visitor site: this feature's surface is defined for the local Guest/developer only (a new feature decision, not a change to Feature 003).
- Q: May the product edit and persist operator/deployment configuration (category B)? → A: **No.** Feature 006 provides a **read-only** view of category B (category, effective value, default, availability). It does not persist edits to deployment configuration and does not create a persistence system for environment configuration. Editing deployment configuration is deferred to a future feature if required. User Story 4 is therefore deferred and is not part of the initial scope.
- Q: Are runtime operational controls (start, pause, retry, clear/reset processing) in scope? → A: **No.** Feature 006 provides **read-only operational status** only. It performs no action and mutates no indexing or extraction runtime state. Operational mutation controls are deferred to a later, explicitly scoped feature if required.

- Q (plan review): How should an unparseable numeric configuration value be shown, given the existing configuration functions supply no fallback for it? → A: **Honestly, as Invalid / unavailable.** Feature 006 does not add fallback or default behavior to existing configuration functions and never presents a fabricated fallback as in effect. The read model may show the configured/effective value when valid, the default when an actual default exists, and Invalid / unavailable when the configured value cannot be parsed. Where existing behavior itself applies a defined fallback (for example an unrecognized AI provider name), the value actually used is shown and flagged.
- Q (plan review): Does SC-006 forbid the behavior change caused by remembered preferences? → A: **No.** Remembered category-A preferences (`autoRotate`, `showRelationships`) and their reset are an explicit, intentional exception to SC-006, limited to those two preferences and their browser-local persistence/reset behavior.

**Initial scope after clarification:** User Story 1 (read-only configuration view), User Story 2 (personal preferences), User Story 3 (read-only code-intelligence status). **Deferred / out of initial scope:** User Story 4 (operator configuration editing) and all runtime mutation controls.

## Configuration Classification *(mandatory; defines the product boundary)*

Every configurable thing in RepoAtlas belongs to **exactly one** of four categories. Category decides who may see it, who may change it, where it may be stored, and whether it may ever reach a browser.

| Category | Definition | May reach the browser? | Who may change it |
|---|---|---|---|
| **A. User-configurable application setting** | A preference of one person using RepoAtlas that changes how the atlas is presented or behaves for them only, with no effect on other users, on the dataset's trustworthiness, or on the deployment. | Yes (value) | The Guest/developer, for their own browser |
| **B. Operator/deployment configuration** | A value that shapes the whole deployment (limits, defaults, which sources load at startup, storage on/off, which AI provider is active). Affects every user. | Only as read-only, non-secret information, visible to the local Guest/developer (no authentication required to view it; sensitive non-secret values are handled per SEC-007) | Nobody through this feature. Changed only through the deployment's own configuration mechanism, outside the product |
| **C. Secret / credential** | A value that grants access to a third-party service (GitHub token, AI provider API keys). | **Never** the value. At most a "configured / not configured" status. | Nobody through this feature. Changed only outside the product UI |
| **D. Runtime operational control** | An action or state that changes what the running system does now (start, pause, retry, re-run, clear cache). | Read-only status only. No actions exist in this feature. | Nobody through this feature (mutation controls are deferred) |

### Configuration inventory *(evidence: repository state at 2026-09-24; classification is this spec's decision unless noted)*

| Item | Where it lives today | Category | Notes |
|---|---|---|---|
| Auto-rotate of the atlas | `atlas-store.ts` (`autoRotate`, in-memory, resets on reload) | **A** (candidate) | Existing behavior; persistence is new |
| Show relationship links | `atlas-store.ts` (`showRelationships`, in-memory) | **A** (candidate) | Existing behavior; persistence is new |
| Category / language / topic filters, selection | `atlas-store.ts` | Not a setting | Transient interaction state, explicitly excluded |
| Active source set and its reset-to-default | `sources-store.ts` (persisted), Sources UI (Feature 003) | Not owned by this feature | Remains in the Sources UI (Feature 003); this feature does not duplicate or replace it |
| `ATLAS_DEFAULT_OWNER`, `ATLAS_MAX_SOURCES`, `ATLAS_MAX_SPIRAL_REPOS`, `ATLAS_MAX_STORED_REPOS`, `ATLAS_CACHE_TTL_MS` | `atlas-config.ts` (environment) | **B** | Deployment-level limits and defaults |
| `ATLAS_LOAD_INITIAL_SOURCES`, `ATLAS_INITIAL_SOURCES` | `atlas-config.ts` (environment) | **B** | Feature 003 already classifies these as operator-level |
| `ATLAS_SQLITE_ENABLED`, `ATLAS_SQLITE_PATH` | `.env.example` | **B** | Local storage toggle and path; the path is a sensitive non-secret value (SEC-007), so only enabled/available state is shown |
| `ATLAS_AI_PROVIDER` | environment, `ai/providers.ts` | **B** | Which provider is active is deployment-level and shown read-only; per-user provider selection is not part of this feature |
| `GITHUB_TOKEN`, `GEMINI_API_KEY` and other provider keys | environment | **C** | Value never exposed; status only |
| `CODE_INTEL_*` tunables and extractor versions | `code-intel/config.ts` (environment/constants) | **B, display only** | Not editable by this feature (see Non-Goals). Extractor versions are read-only system information |
| Code-intelligence snapshot/extraction state | Feature 001/002 persistence | **D (status only)** | No actions in this feature |
| Cloudflare bindings (database, object storage, queues) | `wrangler.toml` | **B (deployment-specific)** | Availability only (see SEC-007); never a prerequisite for the local feature |

Not every environment variable becomes a UI setting: items in categories B, C and D are shown, if at all, as read-only information or status, and only items in category A are editable.

## Access Model

RepoAtlas is, for this feature, a developer-operated local platform. The only actor is the **Guest/developer**: the person running RepoAtlas locally and using its Web UI. There are no roles, no authentication and no user management in Feature 006. The Guest may view every category the feature exposes and may change only category-A preferences. Secrets stay server-side regardless of who is viewing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how RepoAtlas is configured, safely (Priority: P1)

The Guest/developer opens a Settings / Control Plane view and sees, for each item: its name, its category (A–D), its current effective value or status, and whether it is at its default. Secrets show only "configured" or "not configured". This gives the developer one place to answer "what is this deployment doing and why", without opening environment files and without any secret leaving the server.

**Why this priority**: It is the smallest slice that delivers the product boundary, has no persistence, no editing and no Cloudflare dependency, and it proves the secret-handling rule before anything can be changed.

**Independent Test**: Start the app locally with a mix of set and unset values (including a secret). Open the view. Every displayed item shows its category and effective value or status, no secret value appears anywhere in the page, its data, or its network responses, and an unset item shows its default.

**Acceptance Scenarios**:

1. **Given** a secret is configured, **When** the view is opened, **Then** it shows "configured" for that secret and its value is absent from everything delivered to the browser.
2. **Given** a secret is not configured, **When** the view is opened, **Then** it shows "not configured" and explains which capability degrades (for example AI summaries fall back to metadata-only).
3. **Given** a configurable value is unset, **When** the view is opened, **Then** the default is shown and marked as a default.
4. **Given** a configured numeric value cannot be parsed (for example a non-numeric limit), **When** the view is opened, **Then** that item is shown as **Invalid / unavailable**, its default is shown as information only where an actual default exists (never as the value in effect), no fabricated fallback value is presented, and the page does not crash.
5. **Given** the existing configuration behavior itself applies a defined fallback for an unrecognized value (for example an unrecognized AI provider name), **When** the view is opened, **Then** the value the system actually uses is shown and the item is flagged as an unrecognized configured value.

---

### User Story 2 - Adjust personal application preferences (Priority: P2)

The Guest/developer changes category-A preferences (for example whether the atlas auto-rotates and whether relationship links are shown), sees them applied immediately, has them remembered on their next visit on the same browser, and can reset all preferences to defaults.

**Why this priority**: It is the only clearly user-owned settings content evidenced in the repository (both preferences already exist as in-memory toggles). It is independent of operator configuration.

**Independent Test**: Change each preference, reload the page, and confirm it is remembered; press reset and confirm defaults return; confirm the deployment's behavior and the source set did not change.

**Acceptance Scenarios**:

1. **Given** default preferences, **When** the person changes one and reloads, **Then** the changed value is still in effect.
2. **Given** changed preferences, **When** the person resets, **Then** every preference returns to its default and the reset is confirmed.
3. **Given** stored preferences that are malformed or from an unknown older shape, **When** the app loads, **Then** invalid entries fall back to defaults and valid entries are kept, with no crash.
4. **Given** preferences are unavailable to store (storage blocked), **When** the person changes one, **Then** it applies for the current session and the person is told it will not be remembered.

---

### User Story 3 - Understand operational status of code intelligence (Priority: P3)

The Guest/developer sees read-only status of the code-intelligence features that already exist (whether they are enabled/available, current extractor versions, and the state of known snapshots/extractions as already recorded by Features 001/002), without being able to start, pause, retry, clear, reset or otherwise alter anything.

**Why this priority**: It gives the control plane real operational meaning using data that already exists, while staying read-only. It is status-only per the 2026-09-24 clarification and declares a read-only dependency on Features 001/002 data.

**Independent Test**: With and without existing code-intelligence data, open the status view: it shows accurate present state or a clear "no code-intelligence data" state, and offers no action.

**Acceptance Scenarios**:

1. **Given** code-intelligence storage is not available locally, **When** the status is opened, **Then** the view says so clearly and everything else still works.
2. **Given** extraction records exist, **When** the status is opened, **Then** the shown versions and states match the recorded data and nothing is fabricated.

---

### User Story 4 - Change operator configuration from the product (DEFERRED: out of initial scope)

Recorded for traceability only. Editing category-B values (for example a limit or the active AI provider) from the product is **deferred** to a future feature if required (Clarifications, Q2). It has no requirements, tasks or acceptance obligations in Feature 006.

**Why deferred**: Category B is deployment configuration by design (Feature 003), and the product does not persist edits to it.

**Independent Test / Acceptance Scenarios**: None in this feature.

### Edge Cases

- A value is set in the deployment configuration and also differs from a stored preference: the category decides precedence (B is authoritative over deployment behavior; A only affects the person's own view). A person's preference can never override an operator value in category B.
- A setting is removed or renamed in a future version: stored values for unknown settings are ignored, not fatal.
- The view is opened while the server configuration cannot be read: the view fails safe, shows an error with a recovery action (Retry, Reset to default, Dismiss, per the existing error catalog), and exposes nothing partial that is unsafe.
- The view is reached on an instance other than a local developer instance (for example a network-reachable deployment): Feature 006 defines no access control for that case, so everything the view shows must already be safe for any viewer, that is, no secret values (SEC-001) and no sensitive non-secret values (SEC-007).
- The default atlas owner is in effect and a person resets preferences: the dataset does not change; the constitution's rule that empty or cancelled dialogs do not change the dataset still holds.
- A configuration export or copy action (if offered) includes a secret or sensitive non-secret value: forbidden; both are excluded from any export, log, or copy.

## Requirements *(mandatory)*

Requirement IDs are local to this specification.

### Functional Requirements: classification and ownership

- **FR-001**: Every setting and configuration item exposed or described by this feature MUST be assigned to exactly one category (A user setting, B operator/deployment configuration, C secret, D runtime operational control), and the assigned category MUST be visible where the item is shown.
- **FR-002**: The system MUST NOT treat an environment variable as a user-facing setting unless it is category A. Items in categories B, C and D MUST NOT be editable or actionable through this feature.
- **FR-003**: Each item MUST have a defined default, a defined validity rule, and a defined change mechanism (category A: the Guest/developer; B and C: deployment configuration outside the product), stated in the specification/plan artifacts for that item.

### Functional Requirements: browser / UI surface

- **FR-004**: The system MUST provide a Settings / Control Plane view reachable from the existing navigation, in the existing visual style, without redesigning existing pages.
- **FR-005**: The view MUST display, for each visible item, its category, its effective value or status, and whether it equals its default (User Story 1).
- **FR-006**: The view MUST present category-A preferences with immediate effect, an explicit reset-to-defaults action, and a confirmation that the reset happened (User Story 2).
- **FR-007**: Invalid input MUST be rejected at the point of entry with a message that says what is wrong and what is allowed, and MUST NOT change the effective value.
- **FR-008**: The view MUST remain usable and accurate when parts of the configuration are unset, invalid or unavailable, showing each such item honestly (unset: its default; invalid or unavailable: as Invalid / unavailable) and never as a value the system is not using.

### Functional Requirements: local application state and persistence

- **FR-009**: Category-A preferences MUST persist across page reloads on the same browser, and MUST fall back to defaults per item when stored data is missing, malformed or unrecognized (User Story 2, scenarios 1 and 3).
- **FR-010**: If preference storage is unavailable, the system MUST still apply changes for the current session and MUST tell the person they will not be remembered.
- **FR-011**: The only persistence in this feature is browser-local persistence of category-A preferences (FR-009). The feature MUST NOT create a persistence system for deployment/operator configuration and MUST NOT persist edits to it. This specification selects no storage technology.

### Functional Requirements: server-side configuration and runtime behavior

- **FR-012**: The system MUST expose configuration to the browser only through server-controlled views that apply the category rules (including SEC-001 and SEC-007); it MUST NOT hand the browser the raw server configuration.
- **FR-013**: Effective values shown for category B MUST be the values the system actually uses at that moment, as determined by the existing configuration behavior. A missing value shows its actual default where one exists. Where a configured value cannot be parsed and the existing behavior supplies no usable value, the item MUST be shown as **Invalid / unavailable**; this feature MUST NOT substitute, fabricate or display a fallback that the existing configuration behavior does not apply, and MUST NOT change the existing configuration behavior of Features 001–005.
- **FR-014**: Category-D information, if shown, MUST be read-only status derived from data that already exists (Features 001/002 records and versions) and MUST NOT be fabricated (User Story 3). The feature MUST NOT start, pause, retry, clear or reset any processing and MUST NOT mutate indexing or extraction runtime state.
- **FR-015**: Changes to a category-A preference MUST NOT alter the dataset, the source set, or any other person's experience, and MUST NOT change the default-owner behavior defined by the constitution.

### Functional Requirements: deployment-specific configuration

- **FR-016**: The feature MUST be specifiable, buildable and testable in a purely local environment. No requirement of this feature may make Cloudflare, a deployment, or a live experiment a prerequisite for the local scope (User Stories 1 and 2).
- **FR-017**: Deployment-specific items (for example the presence of platform bindings) MAY be shown as read-only information. They MUST be clearly separated from local application state in the view and in the specification of each item.
- **FR-018**: Where a deployment-only capability is absent (for example no database or queue locally), the view MUST say the capability is unavailable and MUST NOT report it as failing.

### Security Requirements

- **SEC-001**: The value of any category-C item MUST NOT appear in any response, page, state object, log, error message, export or copy delivered to or produced in the browser. Only "configured" / "not configured" MAY be shown.
- **SEC-002**: Category-C items MUST NOT be editable, creatable or replaceable through the product UI in this feature.
- **SEC-003**: No secret MAY be exposed through any client-visible configuration channel (including any variable prefixed for client exposure). This restates and applies Constitution Principle III.
- **SEC-004**: All validation of submitted values MUST be enforced on the server side of the boundary, not only in the browser.
- **SEC-005**: Viewing category-B and category-D information MUST NOT require authentication in the Guest-first local model, and the feature introduces no roles, authentication or user management. Because no access control exists, the only protection for a viewer of any kind is content-based: nothing shown may be a secret (SEC-001) or a sensitive non-secret value (SEC-007).
- **SEC-006**: Error messages MUST NOT disclose secret values or any content derived from them, nor sensitive non-secret values (SEC-007).
- **SEC-007**: **Sensitive non-secret values** are values that are not credentials but should not be broadcast: local filesystem paths (for example the local database path) and infrastructure identifiers (database identifiers, storage bucket names, queue names, account identifiers), and internal error detail such as stack traces. The view MUST show these only as availability or enabled/disabled state, never as the value.
- **SEC-008**: A value that is delivered to the browser by design (a client-exposed environment variable) is by definition not a secret and MUST NOT be used to hold one. The view MUST classify such variables as non-secret category B and label them client-visible.

### Non-Functional Requirements

- **NFR-001**: The view MUST show the effective configuration within 2 seconds on a normal local development machine for a deployment with all items set.
- **NFR-002**: Applying a category-A preference MUST take effect within 1 second and MUST NOT reload the atlas dataset.
- **NFR-003**: Opening or using the Settings / Control Plane MUST NOT degrade the atlas's existing interaction performance budgets (Constitution Principle IV).
- **NFR-004**: The view MUST be usable on the same range of screen sizes the existing pages support.

### Key Entities *(include if feature involves data)*

- **Setting Definition**: a named item with category (A–D), default, validity rule, change mechanism, display form (value, status only, or availability only) and mutability (editable only for category A).
- **Effective Configuration**: the set of values actually in force according to the existing configuration behavior (including any fallback that behavior itself applies), with unparseable values reported as Invalid / unavailable; derived server-side and reported per the category rules.
- **Preference Set**: one person's category-A choices with their stored/default state.
- **Secret Status**: a per-secret "configured / not configured" indicator; never a value.
- **Operational Status**: read-only state of existing code-intelligence data and versions (category D); never an action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the items shown by the feature carry a category (A–D) and a stated owner.
- **SC-002**: A test that inspects everything delivered to the browser (pages, data, responses, exports) with every secret configured finds zero secret values.
- **SC-003**: A person can change a preference, see it applied, reload, and see it retained in under 15 seconds, and can reset all preferences in one action.
- **SC-004**: With configuration deliberately broken (invalid, missing, unreadable), the view still loads for 100% of tested cases, and every broken item is shown as Invalid / unavailable, or as its actual default when missing, and never as a fabricated value.
- **SC-005**: The local scope (User Stories 1 and 2) can be run and verified with no Cloudflare access and no deployment.
- **SC-006**: No existing page's behavior or visual output changes when the feature is present, other than (a) the addition of the navigation entry and (b) the intentional, specified effect of the remembered category-A preferences `autoRotate` and `showRelationships` on the Explore page after reload and after reset (FR-006, FR-009). The exception (b) covers only those two preferences and their browser-local persistence and reset behavior; no other existing behavior changes.

## Non-Goals

- No authentication, accounts, sign-in, OAuth, roles (Admin/Operator/User), RBAC or user management, and no private-repository access. Authentication and multi-user authorization are outside Feature 006.
- No editing or persistence of deployment/operator configuration (deferred to a future feature if required; User Story 4).
- No runtime operational actions (start, pause, retry, clear/reset processing) and no mutation of indexing or extraction runtime state from Settings (deferred).
- No CLI or MCP requirements: Feature 007 owns the MCP implementation.
- No editing, creating or rotating secrets from the product UI.
- No editing of `CODE_INTEL_*` tunables, extractor versions, batching, checkpoint or CPU-related values, and no Cloudflare limit assertions. Feature 004/005 CPU feasibility questions are neither answered nor depended on here.
- No replacement or duplication of the Sources UI, the Connected Sources dialog, or source-set management (Feature 003).
- No new atlas visualization, geometry or data-fidelity changes; no changes to Features 001–005.
- No change to the existing configuration semantics of Features 001–005, including adding fallback or default behavior for invalid numeric configuration; invalid values are reported, not repaired.
- No relationship-graph, symbol, MCP, retrieval, or impact-analysis functionality.
- No deployment, provisioning, or Cloudflare resource management.
- No implementation plan, architecture, storage technology, or task list in this specification.

## Dependencies

Declared only where a requirement actually needs them:

- **Feature 003 (Sources / source configuration): interaction, not replacement.** Reset-to-default and the source set stay owned by Feature 003; FR-015 requires that this feature not alter them.
- **Features 001/002 (source acquisition, symbol intelligence): read-only, for User Story 3.** FR-014 needs their existing recorded state and versions for status; no change to them.
- **Constitution (Principles I, III, IV, V): constraints**, not features.
- **Features 004/005: none.** Not a dependency; code-intelligence tunables are display-only.
- **Feature 007 (RepoAtlas MCP): none required.** A future MCP feature may consume this feature's configuration model; this spec creates no obligation toward it. Numbering is not a dependency.

## Assumptions

- Feature 006 is Settings / Control Plane and Feature 007 is RepoAtlas MCP for the current execution sequence (decided by the requester); `docs/ROADMAP.md` has not yet been aligned.
- Category-A candidates are limited to the two existing in-memory presentation toggles until further preferences are evidenced and approved; the specification does not invent more.
- Local-first means the first deliverable runs entirely on a developer machine with the existing local environment configuration and no platform account.
- Category-B values continue to be read from the deployment's existing configuration mechanism and are displayed read-only. The feature reads them through the existing configuration behavior and does not alter it.
- The existing error catalog (clear message with Retry, Reset to default, Dismiss) applies to failures in this feature.
- "Guest/developer" is the single actor: the person running RepoAtlas locally, unauthenticated. The product does not distinguish people, operators or administrators. The developer may also use RepoAtlas through an MCP-capable AI coding agent; that access path is owned by Feature 007 and creates no requirement here.
