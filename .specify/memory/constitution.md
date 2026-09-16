<!--
Sync Impact Report
- Version change: (template placeholder) → 1.0.0
- Modified principles: none (initial ratification from Spec Kit template)
- Added sections:
  - Core Principles (5): Data Fidelity, Visualization-First Data-Driven,
    Server-Side Secrets & Resilience, Performance Budgets, Simplicity & Scope
  - Technical Constraints
  - Development Workflow & Quality Gates
  - Governance
- Removed sections: none
- Deferred TODOs: none
-->

# RepoAtlas Constitution

## Core Principles

### I. Data Fidelity (NON-NEGOTIABLE)

Repository metadata displayed in the atlas MUST come from verified GitHub API
responses or an explicitly documented bundled fallback. Agents and features MUST
NOT invent stars, topics, relationships, licenses, or descriptions.

- One interactive marble per real repository; deduplicate by GitHub `id` when
  merging multiple sources.
- Visual links MUST be limited to same-category peers or other safe structural
  signals already in the dataset (category, subgroup, language, owner).
- The default atlas owner (`imdadareeph`) MUST remain active until a user
  successfully loads custom GitHub sources. Empty or cancelled source dialogs
  MUST NOT change the dataset.
- Custom-source fetch failures MUST NOT silently mix in the default-owner
  fallback JSON.

**Rationale:** RepoAtlas is a knowledge atlas, not a generative fiction layer.
Trust in displayed metadata is the product.

### II. Visualization-First, Data-Driven

The 3D hurricane funnel (`AtlasScene`) is the primary experience. New features
MUST feed it data, not rewrite funnel geometry, dust, or link math unless a
spec explicitly requires a visualization change.

- Pass updated `repositories` arrays; keep layout deterministic via repository
  IDs and existing seeded funnel math.
- Landing (`/`), Catalogue, Categories, and Insights MUST share one React Query
  key derived from the active source list so all views stay in sync.
- Taxonomy (`CATEGORY_ORDER`, classifier in `repositories.ts`) MUST stay
  centralized and replaceable without scene rewrites.
- AI-generated text is supplementary (summaries, future insight panels) and MUST
  always have a metadata-only fallback.

**Rationale:** The spiral is expensive to tune and easy to break. Data-layer
changes should refresh the atlas without re-architecting WebGL.

### III. Server-Side Secrets & Resilience

Secrets and provider keys MUST live in server environment variables only.
`.env.example` is the committed template; `.env` MUST never be committed.

- MUST NOT expose API keys via `VITE_*` or client bundles.
- GitHub fetches MUST run in TanStack Start server functions with optional
  `GITHUB_TOKEN` for rate-limit headroom.
- Successful responses SHOULD be cached (in-memory TTL; optional SQLite locally)
  to protect GitHub and page speed.
- Production targets Cloudflare Workers (Nitro): filesystem SQLite MUST be behind
  a storage adapter that falls back to memory when no filesystem exists.
- User-facing errors MUST use the documented error catalog (clear message,
  recovery action: Retry, Reset to default, Dismiss).

**Rationale:** Public repos need no sign-in, but tokens and LLM keys must not
leak. The app must degrade gracefully when GitHub or AI providers are unavailable.

### IV. Performance Budgets

Interactive 3D performance is a feature requirement, not an optimization pass.

- Per-frame transforms MUST stay in GPU buffers / `useFrame`; MUST NOT drive
  marble motion from React state.
- Use instancing for marbles and halos; cap highlighted peer links and idle
  edges per existing scene budgets.
- Enforce documented caps: max source URLs (5), spiral marble cap (800), stored
  row cap (2000) unless a spec amends them with measured justification.
- Respect reduced-motion preferences and lower mobile effect budgets.
- Lazy-load the canvas (`AtlasScene`) behind a client-only boundary; keep SSR
  stable.

**Rationale:** Hundreds of instanced nodes are fine; unbounded fetches and
per-frame React updates are not.

### V. Simplicity & Minimal Scope

Implement the smallest correct change. Avoid speculative abstractions, drive-by
refactors, and features not named in an approved spec or plan doc.

- Conventional commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`).
- Do not rewrite published git history (no force-push, rebase, amend, or squash
  of commits already pushed).
- Keep the branch in a working state; `bunx tsc --noEmit` MUST pass before merge.
- Prefer extending existing server functions, stores, and UI primitives (Dialog,
  Sheet, sonner) over new libraries.
- Tests are valuable for data parsing, caps, and error paths; do not add
  trivial tests that only assert the obvious.

**Rationale:** RepoAtlas is a focused TanStack Start app. Scope creep in the
scene or data layer compounds quickly.

## Technical Constraints

| Area | Requirement |
|------|-------------|
| Runtime | Bun (or Node 22+); `./run.sh` for dev on first free port from 4949 |
| Framework | TanStack Start + Router + React Query; `ssr: false` on atlas routes |
| 3D | Three.js, React Three Fiber, drei; Zustand for interaction state |
| Styling | Tailwind v4; semantic atlas tokens in `src/styles.css` |
| Deploy | `bun run build` → `.output/` via Nitro; Cloudflare Workers preset |
| Data | GitHub REST public API; optional Gemini via server adapter (more providers later) |
| Docs | `docs/plan.md`, `docs/dynamic-sources-prompt.md`, `docs/prompt.md` for visualization spec |
| Agent notes | `AGENTS.md` for day-to-day commands and conventions |

Out of scope unless a ratified spec adds them: OAuth, private repos, GitLab live
sync, committing `data/atlas.sqlite` or live API dumps.

## Development Workflow & Quality Gates

Work SHOULD follow the Spec Kit sequence initialized in this repository:

1. `/speckit-constitution` — this document (governance baseline)
2. `/speckit-specify` — feature specification
3. `/speckit-plan` — implementation plan aligned with constitution
4. `/speckit-tasks` — actionable tasks
5. `/speckit-implement` — execution
6. Optional: `/speckit-clarify` before plan; `/speckit-analyze` after tasks

Before marking work complete, verify:

- Default-owner behavior unchanged unless the feature is custom sources.
- All atlas pages show the same repository set for the active `sourceKey`.
- Hover, selection, search, filters, and panel metadata match GitHub (or stated fallback).
- Loading, empty, error, and WebGL-unavailable states remain usable.
- No secrets in git status; `.env.example` updated when new env vars are introduced.
- Responsive behavior at desktop, tablet, and mobile breakpoints.

Implementation prompts in `docs/` are authoritative for phased features until
superseded by a Spec Kit spec. When they conflict, the newer ratified spec wins;
amend this constitution if principles change.

## Governance

This constitution supersedes ad-hoc agent instructions for RepoAtlas when they
conflict on non-negotiable rules (data fidelity, secrets, default-owner behavior,
performance caps).

**Amendment procedure**

1. Propose changes with rationale and version bump type (MAJOR / MINOR / PATCH).
2. Update `.specify/memory/constitution.md` and prepend an updated Sync Impact
   Report HTML comment.
3. Align `docs/plan.md`, `AGENTS.md`, or feature specs if principles changed.
4. Commit with conventional `docs:` message referencing constitution version.

**Versioning policy**

- MAJOR: Removing or redefining a non-negotiable principle.
- MINOR: New principle or materially expanded section.
- PATCH: Clarifications, wording, non-semantic fixes.

**Compliance**

All specs, plans, and PRs SHOULD be checked against Core Principles. Complexity
beyond documented caps MUST be justified in the plan. Use `AGENTS.md` and
`docs/dynamic-sources-prompt.md` for runtime implementation guidance.

**Version**: 1.0.0 | **Ratified**: 2026-09-16 | **Last Amended**: 2026-09-16
