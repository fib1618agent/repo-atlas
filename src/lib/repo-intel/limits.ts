/**
 * Named UI/query bounds for the Repository Intelligence view (Feature 009,
 * FR-012, NFR-002). These are rendering and paging limits, not CPU claims.
 */

/** Max SVG nodes (children plus overflow nodes) drawn for one level. */
export const MAX_VISIBLE_NODES = 60;

/** Default and maximum children fetched per structure page. */
export const MAX_CHILDREN_PAGE = 100;

/** Max symbols fetched for one file. */
export const MAX_SYMBOLS_FETCH = 200;

/** Max language/extension buckets in the composition summary. */
export const MAX_COMPOSITION_BUCKETS = 8;
