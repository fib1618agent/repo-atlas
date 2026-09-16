# Spiral Funnel Atlas — Recreation Prompt

Use this prompt to build (or recreate) an interactive **3D colored spiral funnel** visualization: glowing marbles on a hurricane-shaped vortex, atmospheric dust dots, category-colored relationship links, slow auto-rotation, and mouse zoom/rotate controls.

The marbles are **domain-agnostic** — they can represent repositories, workflow steps, diagram nodes, important classes, API endpoints, or any discrete entities you provide.

**Categories are supplied by the caller** (not hardcoded). Each category has a name and color; marbles, dust, legend, links, hover card, and right panel all derive from that list.

---

## Copy-paste prompt

```
Build an interactive 3D “spiral funnel atlas” visualization with the following design and behavior. Use React + Three.js (React Three Fiber + drei recommended) unless I specify otherwise.

## Visual concept

A dark, cinematic scene (#05070b background, exponential fog) showing a **hurricane / tornado funnel** shape:

- **Wide crown at the top** → **pinched waist in the middle** → **slight base flare at the bottom**
- Entities spiral **downward** along the funnel (not a flat disc)
- The funnel is slightly tilted on X/Z (~0.05, -0.25, -0.04 rad) so it reads as a 3D vortex, not a top-down ring
- Optional faint **orbital ring traces** (very low-opacity white line segments) following the same funnel profile for depth

## Two particle layers

### 1. Atmospheric dust (background dots)
- Thousands of small colored points (~4000+) filling the funnel volume
- Same spiral math as marbles but finer and more numerous
- **Category-tinted** vertex colors (from supplied categories), semi-transparent (opacity ~0.55), soft point size (~0.05)
- Rotates slowly on the **Y axis** when auto-rotate is on (counter to marble group for parallax)

### 2. Marbles (primary interactive nodes)
- Instanced colored spheres — **unlit** (`MeshBasicMaterial` + `setColorAt`), not PBR glass
- Per-node color from **supplied category** palette, with small deterministic hue/lightness variation per id
- Soft **additive halo** behind each marble (larger, low opacity)
- Size varies slightly per node; optional **importance/weight** scales size
- Subtle **live drift**: vertical sine + light X/Z turbulence so marbles feel suspended in flow
- **Invisible enlarged pick mesh** (~4× radius) for easy hover/click
- Hover: scale up ~1.85×, brighten; **same-category link lines** appear (see Links)
- Select: same emphasis; non-related nodes can dim when one is focused

## Supplied categories (required input)

I will provide a **category catalog** — do not invent categories unless I omit them:

```ts
type CategoryDef = {
  name: string;       // e.g. "AI & Agents", "Web Development"
  color: string;      // hex, e.g. "#a78bfa"
  order?: number;     // optional sort index for legend + angular stream offset in funnel
};

const categories: CategoryDef[] = [ /* supplied by me */ ];
```

Use this catalog to:
- Assign each node’s `category` (must match a `name` in the list; fallback to last category or "Other")
- Map **marble color**, **dust tint**, **link color**, **legend chips**, and **UI accents**
- Compute **stream offset** in spiral layout: `catIndex * (2π / categoryCount)` so each category forms a visible band in the funnel
- Render a **clickable category legend** (name + count + color dot); clicking filters/dims non-matching marbles

## Layout math (spiral funnel)

For each node `i` of `N`, compute normalized depth `t = i / max(1, N-1)`:

- `y` = top-to-bottom height (e.g. 6.2 → -6.2) + small per-id jitter
- `radius` = crown term `pow(1-t, 1.4)` + sinusoidal waist pinch + small base flare, clamped min radius
- `angle` = `t * ~12` (multi-turn spiral) + **category stream offset** + per-id jitter
- Position: `(cos(angle)*radius, y, sin(angle)*radius*0.7)` — elliptical cross-section (0.7 Z scale)

Use a **deterministic hash** from node id for all jitter/seeds so layout is stable across reloads.

## Relationship links

Toggleable “Links” layer:

- **Idle** (nothing hovered/selected): thin lines to each node’s nearest **same-category** neighbor (low opacity ~0.12)
- **Hover**: lines from hovered node to up to ~12 nearest same-category peers using **live animated positions** (opacity ~0.42)
- **Select**: same as hover but stronger (opacity ~0.65); selection persists while right panel is open
- Line colors match the focused node’s category color
- Hide idle links whenever a node is hovered or selected
- Hover takes priority for link focus when moving between marbles with the panel already open

## Rotation

- **Auto-rotate** (toggle, default on): entire marble + link group rotates slowly on **Y axis** (~0.10 rad/s)
- Dust layer rotates slightly faster/slower on Y for depth
- User can **pause** auto-rotate and drag to orbit manually

## Zoom & orbit controls

- `OrbitControls` with damping
- **Scroll / pinch** to zoom in and out
- **Drag** to rotate camera around funnel center
- Constrain zoom: min distance ~9, max ~26 (adjust to funnel scale)
- Constrain polar angle so camera stays in a pleasing “side” view (avoid flipping under the funnel)
- Pan disabled (keep focus on the vortex)
- Initial camera: slightly above center, looking at funnel mid-point (e.g. position [0, 0.5, 17], fov ~46)

## Hover — marble emphasis + floating hover panel

When the pointer is over a marble (and it is **not** the currently selected node):

### 3D feedback
- Marble scales up and brightens (see Marbles above)
- Category **link lines** draw to nearest peers (Links / Hover mode)
- Cursor-following pointer position tracked from canvas `pointermove`

### Floating hover panel (hover card)
A compact **glassmorphism card** fixed near the cursor (offset ~20px; clamp so it stays on screen):

| Element | Content |
|--------|---------|
| Category row | Color dot + **category name** (from supplied catalog) |
| Title | Node **label** / primary name (bold) |
| Description | Short **summary** text (1–3 lines, truncated); fallback if empty |
| Meta row | Optional chips: secondary tag (e.g. language/type), numeric metric (e.g. stars/score), source badge |

**Behavior:**
- `pointer-events: none` on the card (does not block canvas interaction)
- `z-index` above canvas; subtle fade/slide-in animation (~140ms)
- Hidden on mobile / narrow viewports if needed
- **Not shown** when hovering the same node that is already selected (panel owns that node)

**Example hover card layout:**
```
[●] Category Name
Node Title
One or two line description…
[lang dot] TypeScript   ★ 12.4k   GitHub
```

## Click — right-side info bar (detail panel)

**Clicking a marble selects it** (no toggle-off on re-click; close via X). Open a **right-side info bar** — not overlaying the funnel center.

### Layout
- Fixed **aside** on the right (~24rem wide), glass panel, scrollable if content is long
- **Canvas inset**: when panel is open, shrink canvas/glow area from the right (~26rem) so the vortex stays visible and marbles remain clickable
- Slide-in animation from the right (~280ms)
- Close button (X) clears `selectedId`

### Panel sections (top → bottom)

| Section | Content |
|--------|---------|
| **Header** | Category-colored icon, category eyebrow, **title**, subtitle/full name, close X |
| **Platform / source badge** | Optional (e.g. GitHub, internal API, file path root) |
| **Description** | Full description paragraph |
| **Enriched summary** | Optional AI or computed summary block (loading state) |
| **Primary link** | URL or deep link with icon |
| **Stats row** | 3-column metrics (e.g. stars / forks / issues — or domain equivalents) |
| **Tags / topics** | Chip list (cap display + “+N more”) |
| **Taxonomy** | Category tree: category name + subgroup/secondary grouping |
| **Secondary detail** | Language bar, last-updated, license, branch, flags — 2-column grid |
| **CTA button** | Full-width primary action (e.g. “View Repository”, “Open in IDE”) |

Category color from supplied catalog used for icon border, eyebrow, and accents throughout.

### Selection vs hover
- Selected node stays highlighted in 3D; same-category links at **select** opacity
- Hovering **other** marbles while panel is open: show **hover card** for the other node + **hover** link preview for that node
- Filters (category, tags) dim non-matching marbles but keep panel independent until closed

## Toolbar & legend

- Bottom-center controls pill: Auto rotate toggle, Links toggle, optional fullscreen
- Hints: “Drag to rotate”, “Scroll to zoom”
- Left legend: supplied **categories** with counts; optional accordions for language/topic filters
- Search (optional): jump to node by name; selecting from search opens right panel

## Interaction state

```ts
{
  hoveredId: string | number | null;
  selectedId: string | number | null;
  activeCategory: string | null;   // from supplied categories
  autoRotate: boolean;
  showRelationships: boolean;
  // optional: language, topic, search query filters
}
```

## Data model (generic)

Each node:

```ts
{
  id: string | number;
  label: string;              // hover title + panel header
  fullName?: string;          // panel subtitle
  category: string;           // must match a name in supplied categories
  description?: string | null;
  importance?: number;        // 0–1, affects marble size
  url?: string;               // panel link + CTA
  tags?: string[];            // chips
  subgroup?: string;          // taxonomy sub-row
  metrics?: {                   // panel stats row — keys are domain-specific
    [key: string]: number | string;
  };
  metadata?: Record<string, unknown>;  // extra panel fields
}
```

Nodes + **categories** provided as JSON or API. Invalid category → map to fallback category from catalog.

## Lighting & mood

- Ambient + directional fill
- 2–3 colored point lights (violet, cyan, warm accent) for atmosphere
- Dark UI chrome

## Performance

- InstancedMesh for marbles and halos
- BufferGeometry + draw ranges for dynamic link segments
- Cap highlighted peers (~12) and idle edges (~120)

## Deliverables

1. Full-screen canvas component with funnel scene
2. Zustand (or equivalent) for hover/selection/filter state
3. **Hover panel** (cursor card) wired to `hoveredId`
4. **Right info bar** wired to `selectedId` with canvas inset
5. Category legend driven by **supplied categories**
6. Responsive layout; touch-friendly orbit/zoom
7. TypeScript, accessible labels on canvas and panel

---

Before implementing, ask me up to **3 clarification questions** (no more):

1. **What do the marbles represent, and where does the node data come from?** (e.g. GitHub repos, pipeline stages, codebase classes, diagram nodes — JSON file, API, or generated list)

2. **What are the categories?** (supply the `categories` array: names + hex colors + order; and whether links connect only within the same category or also across categories)

3. **What fields populate the hover card vs the right info bar?** (which metrics, tags, links, and CTAs apply to this domain — I will map them to the generic schema above)

After I answer, implement the funnel atlas to match this spec.
```

---

## Reference implementation

This repository (`repo-atlas`) is the reference build:

| Concern | Location |
|--------|----------|
| Funnel layout, marbles, dust, links | `src/components/atlas/AtlasScene.tsx` |
| Interaction state | `src/lib/atlas-store.ts` |
| Hover card, legend, canvas inset | `src/routes/index.tsx` |
| Right info bar (detail panel) | `src/components/atlas/RepositoryPanel.tsx` |
| Category catalog | `src/lib/repositories.ts` (`CATEGORY_ORDER`, `CATEGORY_TOKEN`) |
| Panel / hover styles | `src/styles.css` (`.atlas-panel`, `.atlas-hover-card`, `.atlas-canvas-wrap--panel-open`) |

### Reference: hover card fields

- Category (colored dot + name)
- Repository name
- Description (truncated)
- Language, star count, “GitHub” badge

### Reference: right panel sections

- Header: category, name, fullName, close
- GitHub badge, description, AI summary
- URL link, stats (stars / forks / issues)
- Topic chips, taxonomy (category → subgroup)
- Language bar, last pushed, license, branch, fork flag
- “View Repository” CTA

---

## Example answers (GitHub repo atlas)

**Categories supplied:**
```ts
[
  { name: "AI & Agents",     color: "#a78bfa", order: 0 },
  { name: "Enterprise Java", color: "#fb923c", order: 1 },
  { name: "Cloud & DevOps",  color: "#60a5fa", order: 2 },
  { name: "Web Development", color: "#4ade80", order: 3 },
  { name: "Data & Tools",    color: "#facc15", order: 4 },
  { name: "Security",        color: "#f87171", order: 5 },
  { name: "Developer Tools", color: "#22d3ee", order: 6 },
  { name: "Mobile",          color: "#f472b6", order: 7 },
  { name: "Other",           color: "#94a3b8", order: 8 },
]
```

1. Marbles = GitHub repositories; data in `src/lib/repositories.ts`.
2. Links = nearest peers **within the same category** only.
3. Hover = name + short description + language + stars. Panel = full repo metadata, AI summary, topics, taxonomy, external link.

## Example answers (codebase class map)

1. Marbles = important classes; data from `graphify-out/graph.json` or static analysis.
2. Categories = packages/layers (`api`, `domain`, `infra`, …) with supplied colors; links within package only.
3. Hover = class name + file path snippet. Panel = methods, imports, callers, “Open file” CTA.

## Example answers (flow diagram)

1. Marbles = workflow steps; data from YAML/JSON.
2. Categories = stages (`build`, `test`, `deploy`) supplied with colors; links = sequential + same-stage neighbors.
3. Hover = step name + avg duration. Panel = owner, dependencies, logs link, retry action.
