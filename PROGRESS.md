# RepoAtlas — Progress Tracker

> Last updated: 2026-09-13  
> Status legend: `[ ]` Planned · `[/]` In progress · `[x]` Done · `[-]` Skipped / deferred

---

## Phase 0 — Project Setup

- [x] Inspect existing repository structure
- [x] Read existing component files (`AtlasScene`, `RepositoryPanel`, `AtlasControls`, `RepoAtlasLogo`, `index.tsx`, `styles.css`)
- [x] Read existing lib files (`repositories.ts`, `atlas-store.ts`, `repositories.functions.ts`)
- [x] Inspect `repos.json` dataset structure
- [x] Read `package.json` (confirm Three.js / R3F / Zustand / TanStack already present)
- [x] Create `implementation_plan.md` (artifact)
- [x] Create `PROGRESS.md` (this file)
- [x] Create `run.sh` with smart port selection (prefers 4858, auto-increments)

---

## Phase 1 — Design Tokens & Global Styles (`src/styles.css`)

- [x] Add Google Fonts import (Inter · Space Grotesk · IBM Plex Mono + Manrope 800w)
- [x] Expand category CSS token palette to full 9-category system (hex values for vibrant marbles)
- [x] Add `--atlas-glow`, atmospheric radial vortex glow tokens
- [x] Adjust `atlas-canvas-wrap` left inset to 22rem for better vortex centering
- [x] Add `atlas-vortex-glow` radial CSS overlay behind canvas
- [x] Add `atlas-nav-item`, `atlas-platform-badge`, `atlas-hint` component classes
- [x] Add `atlas-ai-summary`, `atlas-ai-badge`, `atlas-lang-bar` panel component classes
- [x] Add `atlas-hover-card` redesign with hc-* subclasses
- [x] Add `@keyframes atlas-hover-in` entrance for hover card
- [x] Polish footer to three-column layout CSS
- [x] Scrollbar styling for `.atlas-panel`
- [x] Full responsive audit (tablet 1200px, mobile 767px)

---

## Phase 2 — Data Layer (`src/lib/`)

- [x] Expand `CATEGORY_ORDER` to 9 categories in `repositories.ts`
- [x] Add `Security`, `Developer Tools`, `Mobile` classification branches
- [x] Add `importance` scoring based on `log10(stars)` normalised to 0–1
- [x] Update `CATEGORY_TOKEN` map for all 9 categories
- [x] Add `language`, `topic`, `showRelationships`, `resetFilters` to `atlas-store.ts`
- [x] Create `ai-summary.functions.ts` (Gemini API + smart metadata fallback)

---

## Phase 3 — 3D Vortex Upgrade (`src/components/atlas/AtlasScene.tsx`)

- [x] Improved hurricane geometry profile (non-linear crown + waist + base-flare curve)
- [x] Per-particle vertical drift via `useFrame` time-based sine (no React state)
- [x] Per-particle turbulence layer (independent XZ sine/cosine noise)
- [x] Pre-computed seed arrays for turbulence (no allocation in animation loop)
- [x] Atmospheric dust particle count raised to 4,200
- [x] Category angular clustering in particle angular placement
- [x] Added `RelationshipEdges` component (category-derived, budgeted ≤180 idle edges)
- [x] Idle edges: opacity 0.045 white
- [x] Selected edges: nearest category peers highlighted at 0.30 opacity violet
- [x] Switched from oklch CSS var parsing → direct hex `COLOR_MAP` (reliable across environments)
- [x] Added `importance` property to marble size bonus
- [x] Language/topic filter support: dimming logic respects all three active filters
- [x] Added third point light (warm amber at bottom) for depth
- [x] Better camera default: position [0, 0.5, 17], fov 46
- [x] Tuned `fogExp2` density to 0.028

---

## Phase 4 — UI Components

### RepoAtlasLogo (`src/components/atlas/RepoAtlasLogo.tsx`)
- [ ] Upgrade `atlas-mark` to proper orbital SVG icon (three-ring style is good as-is; defer)

### AtlasControls → inline in `index.tsx`
- [x] Auto-rotate Pause/Play button
- [x] Relationship edges toggle (Links button)
- [x] Reset filters button
- [x] Full-screen button
- [x] Keyboard `⌘K` / `Escape` shortcuts

### RepositoryPanel (`src/components/atlas/RepositoryPanel.tsx`)
- [x] AI-powered summary section (`AISummarySection`) with Gemini API + loading state
- [x] Smart metadata-based fallback summary when no API key is set
- [x] GitHub platform badge
- [x] URL row with external link icon and clickable link
- [x] Language colour bar (`LanguageBar` with LANG_COLORS map)
- [x] Taxonomy tree section (`TaxonomyTree`: Category → Subgroup)
- [x] Improved topic chips with hover state
- [x] `atlas-panel-in` entrance animation
- [x] Scrollable panel with custom scrollbar

---

## Phase 5 — Landing Page Composition (`src/routes/index.tsx`)

- [x] Full navigation: Explore / Catalogue / Categories / Insights / About
- [x] `is-active` underline on current nav item
- [x] GitHub + GitLab icons in header
- [x] **"View Profile" links to `http://www.imdadareeph.com/`**
- [x] Primary CTA: `Start Exploring →` (violet→cyan gradient + glow)
- [x] Secondary CTA: `View Profile` (glass outline button)
- [x] 4-metric row: Repositories / Categories / Platforms / Possibilities (∞)
- [x] Atmospheric `atlas-vortex-glow` overlay
- [x] Language filter pills in category legend
- [x] Topic filter pills in category legend
- [x] Clear filters button
- [x] Improved hover card: category dot, name, description (2-line clamp), language + stars
- [x] Centered interaction hint (Drag · Scroll · Click)
- [x] Three-column footer: RepoAtlas | Powered by Open Source | Explore the code…
- [x] Keyboard `Escape` / `⌘K`

---

## Phase 6 — Catalogue Page (`src/routes/catalogue.tsx`)

- [x] New `/catalogue` route with TanStack file-based routing
- [x] Repo grid: 1–4 columns responsive
- [x] Search bar with clear button
- [x] Sort controls: Stars / Forks / Updated / Name
- [x] Collapsible filter panel (Category · Language · Topic)
- [x] Active filter indicator dot on Filters button
- [x] Clear all filters button
- [x] Premium repo cards: name, fullName, category badge (coloured), description, topics, stats, language dot
- [x] Hover lift animation on cards
- [x] Empty state with search icon + clear prompt
- [x] Back to Atlas link

---

## Phase 7 — Polish & Performance

- [x] Build passes zero TypeScript / lint errors (`bun run build` ✓)
- [x] No React state updates inside animation loop (all via `useRef` / direct InstancedMesh writes)
- [x] 4,200 dust particles + up to 92 marble marbles instanced
- [x] Edge budget capped at 180 idle + up to ~20 highlight edges
- [ ] Responsive audit on physical devices (tablet/mobile)
- [ ] Add `GEMINI_API_KEY` env var for AI summaries (optional, fallback always works)
- [ ] Final visual comparison against reference images

---

## Completed Summary

| Phase | Items | Done |
|---|---|---|
| 0 — Setup | 8 | 8 |
| 1 — Styles | 11 | 11 |
| 2 — Data layer | 6 | 6 |
| 3 — 3D vortex | 14 | 14 |
| 4 — UI components | 15 | 14 |
| 5 — Landing page | 16 | 16 |
| 6 — Catalogue | 12 | 12 |
| 7 — Polish | 7 | 5 |
| **Total** | **89** | **86** |
