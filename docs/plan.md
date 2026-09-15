# RepoAtlas interactive repository universe

## Goal
Replace the placeholder home page with the dark editorial RepoAtlas experience from the supplied brief: a living, vertically rotating 3D hurricane where every public `imdadareeph` repository is an interactive colored marble.

## What will be built

### 1. Live repository data
- Load all public repositories from GitHub’s public API through a server-side function, using pagination so the implementation remains correct beyond the current 92 repositories.
- Cache successful responses to protect page speed and GitHub’s public rate limit, while revalidating automatically so new repositories and metadata appear without a rebuild.
- Normalize real fields only: repository name, owner, URL, description, language, topics, stars, forks, issues, license, fork/archive status, and update date.
- Keep a last-known bundled fallback dataset so the atlas remains usable during a GitHub outage or rate-limit response.

### 2. Category → subgroup taxonomy
- Derive a stable hierarchy from repository topics first, then language, then conservative name/description rules.
- Initial roots will cover AI & Agents, Enterprise Java, Cloud & DevOps, Web Development, Data & Tools, and Other; each root will expose relevant subgroups such as Spring Boot, Microservices, React, Angular, Infrastructure, and RAG.
- Keep the taxonomy and color mapping centralized and replaceable, so a later curated dataset can override classification without changing the visualization.
- Never invent relationships or repository facts. Safe visual links will be limited to shared category, subgroup, language, or owner signals.

### 3. Independent 3D hurricane renderer
- Recreate the reference visually with Three.js and React Three Fiber; the Marble repository contains data and media but no reusable renderer source.
- Render one selectable instanced marble per real repository, arranged with deterministic seeded funnel geometry: a broad asymmetric crown, compressed waist, curved streams, and a tight lower throat.
- Add slow global Y-axis rotation, per-stream angular variance, vertical drift, turbulence, depth-based scale/opacity, controlled glow, and a sparse edge budget.
- Add non-interactive atmospheric dust and motion traces for visual density without pretending they are repositories.
- Support pointer drag to rotate, wheel/pinch zoom with limits, continuous motion after selection, adaptive detail, reduced-motion behavior, and a lower mobile particle/effect budget.

### 4. Repository interaction
- Hovering a marble highlights it and shows a small cursor-adjacent panel with category, repository, description fragment, language, and platform.
- Clicking selects it, brightens its structural neighbors, dims unrelated repositories, and opens a rich right-side panel with only verified GitHub metadata.
- The detail panel includes category/subgroup breadcrumbs, topics, language, activity metrics, license, update date, and a direct “View repository” action.
- Escape closes selection; keyboard search and repository navigation provide an accessible alternative to pointer-only exploration.
- On mobile, tapping replaces hover and repository details open as a bottom sheet rather than a persistent right panel.

### 5. Editorial landing composition
- Build the requested compact RepoAtlas header, understated navigation, command-style search, left editorial headline, concise description, CTAs, live metrics, category legend, dataset summary, interaction hints, and subtle footer.
- Preserve the supplied almost-black cinematic palette, restrained electric blue/violet accents, category colors, dark glass surfaces, substantial negative space, and staged first-load reveal.
- Keep the visualization dominant and avoid a dashboard/card-grid treatment.
- Search will match name, owner, root category, subgroup, language, and topics, then focus and select the corresponding marble.
- Category legend controls will filter emphasis without rebuilding or reshuffling the funnel.

### 6. Responsive and resilient states
- Desktop: editorial copy left, full vortex center/right, floating details on the right.
- Tablet: reduced copy and narrower details while retaining direct 3D interaction.
- Mobile: full-screen vortex, compact controls, overlaid copy, tap interaction, and bottom-sheet details.
- Include loading, empty, API-error fallback, WebGL-unavailable fallback, keyboard focus, readable contrast, and semantic repository access.

## Technical details
- Add the Three.js/React Three Fiber rendering packages and isolate browser-only rendering behind a client-only dynamic boundary so server rendering remains stable.
- Keep per-frame transforms inside GPU buffers/shaders rather than React state; use instancing and throttled raycasting for interaction.
- Use deterministic hashes from repository IDs for stable positions across refreshes.
- Use the existing TanStack Start route and server-function conventions; no database or sign-in is required for public repositories.
- Replace the placeholder metadata with unique RepoAtlas title, description, Open Graph, and Twitter metadata.
- Centralize all visual values in semantic design tokens and reuse existing controls where applicable.

## Validation
- Verify the live GitHub sync, search, category filtering, hover, selection, close behavior, repository links, and API fallback.
- Inspect the scene at desktop, tablet, and mobile sizes, including the non-overlap of headline, vortex, panels, legend, and controls.
- Test sustained animation performance, reduced motion, keyboard access, WebGL fallback, and visible loading/error states.
- Confirm that every returned public repository is represented exactly once as an interactive marble and that displayed metadata matches GitHub.
