# Contract: Visualization surface (Feature 009)

## Route

`/repository/$owner/$name?path=<dir>&file=<file>&symbol=<id>` — all search params optional; invalid values are ignored (fall back to root) and never crash.

## Regions (in reading order)

1. Header: repository identity (`owner/name`), owner context link back to catalogue scope, provider metadata, category marble.
2. State/summary panel: one of the FR-011 states; when `ready`, snapshot commit, extraction status, totals, composition bar with text values.
3. Breadcrumb (`nav aria-label="Repository path"`): Repository › dir › … › file.
4. Structure map (SVG, `role="group"` with an `aria-label` summary) with focusable nodes; zoom controls (buttons); filter input.
5. Outline (list of the same children, all loaded items, "Load more" when `nextCursor`), always present, collapsible on narrow screens.
6. Detail panel: selected file (status, language, size, symbol summary) or symbol detail (kind, qualified name, position, provenance).
7. Relationship layer notice (FR-009).

## Node semantics

- Directory node: marble, size ~ log(file count); label name; `aria-label="Directory <name>, <n> files, <m> symbols"`.
- File node: smaller marble, colour by language; `aria-label="File <name>, <size>, <language>, <k> symbols"`.
- Symbol node: shape/glyph by kind (module, class, interface, function, method); hierarchy via parent grouping only.
- Overflow node: `aria-label="<N> more <kind>, open in outline"`; activating it focuses the outline.

## Keyboard

Tab into map → roving focus; Arrow keys move to nearest node in that direction (layout order fallback); Enter/Space drills into directory/file/symbol; Backspace or Escape goes up one level; `+`/`-`/`0` zoom in/out/reset; `/` focuses the filter input. All actions also exist as buttons/links (no mouse-only function).

## Limits (named constants, `limits.ts`)

`MAX_VISIBLE_NODES = 60`, `MAX_CHILDREN_PAGE = 100`, `MAX_SYMBOLS_FETCH = 200`, `MAX_COMPOSITION_BUCKETS = 8`. Test-asserted (SC-003, NFR-002).

## Non-behaviors

No drawing of owner→repository links as threads; no animation loop; no edges of any kind in v1.
