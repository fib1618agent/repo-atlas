# Contract: Settings surface (UI)

**Feature**: 006-settings-control-plane · **Spec**: [../spec.md](../spec.md)

## Route and navigation

- Route `/settings`, file route with `ssr: false`, title "Settings — RepoAtlas" (FR-004).
- A `Settings` link is added to the primary navigation of the five existing pages, using the existing `atlas-nav-item` class; active state on `/settings` follows the existing `is-active` pattern. Existing header structure is otherwise unchanged (SC-006). The nav follows the existing `lg` breakpoint behavior.

## Sections (in order)

1. **Configuration** (US1): a list/table of all items: label, category badge (A–D), effective value or status or availability, and a "default" marker (FR-005, SC-001). Client-visible items carry a "client-visible" badge (SEC-008). Invalid items show **Invalid / unavailable** in place of a value, with fixed explanatory text, and show the default only as information where one exists (FR-008, FR-013). Secrets show "configured" / "not configured" plus the degradation note. Category-A rows show the live preference values.
2. **Preferences** (US2): two switches (`autoRotate`, `showRelationships`) with immediate effect (FR-006, NFR-002), a **Reset preferences** button with a confirmation toast, and a notice "will not be remembered" when storage is unavailable (FR-010).
3. **Code intelligence status** (US3): version, counts by state, or "No code-intelligence data", or "Not available in this environment" with fixed reason (FR-014, FR-018). Read-only: no button, link or control that starts, pauses, retries, clears or resets anything.

## States (FR-008, FR-018)

| State | Presentation |
|---|---|
| Loading | Skeleton per section; page shell renders immediately |
| Configuration read failed | Alert with the catalog message and **Retry** (refetch) |
| Capability unavailable (no database, SQLite off, no binding) | "Unavailable" badge with fixed reason; not styled as an error |
| Empty code-intelligence data | "No code-intelligence data" |
| Storage unavailable | Inline notice on the Preferences section; switches still work for the session |

## Prohibitions (asserted in review and by tests where testable)

- No input field that accepts a secret; no control that edits category B, C or D (SEC-002, FR-002).
- No display of any value for category C or sensitive non-secret items (SEC-001, SEC-007).
- No authentication, role, or user UI (Non-Goals).
- The Sources UI, Connected Sources dialog and the Sources "Reset to default" are not duplicated or altered; the Preferences **Reset** resets only the two preferences (FR-015).
