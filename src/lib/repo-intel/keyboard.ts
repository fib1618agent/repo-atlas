/**
 * Pure keyboard model for the structure map (Feature 009 FR-014): key → action
 * mapping and focus movement between laid-out nodes. Spatial arrow movement
 * falls back to ordered stepping so no node is unreachable; Home/End/PageUp/
 * PageDown always step in reading order.
 */

export type Direction = "left" | "right" | "up" | "down";

export interface FocusPoint {
  id: string;
  x: number;
  y: number;
}

export type KeyAction =
  | { type: "move"; direction: Direction }
  | { type: "order"; delta: 1 | -1 }
  | { type: "home" }
  | { type: "end" }
  | { type: "activate" }
  | { type: "up" }
  | { type: "zoom"; delta: 1 | -1 }
  | { type: "zoomReset" }
  | { type: "focusFilter" };

const DIRECTION_KEYS: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

export function keyToAction(key: string): KeyAction | null {
  const direction = DIRECTION_KEYS[key];
  if (direction) return { type: "move", direction };
  switch (key) {
    case "PageDown":
      return { type: "order", delta: 1 };
    case "PageUp":
      return { type: "order", delta: -1 };
    case "Home":
      return { type: "home" };
    case "End":
      return { type: "end" };
    case "Enter":
    case " ":
      return { type: "activate" };
    case "Backspace":
    case "Escape":
      return { type: "up" };
    case "+":
    case "=":
      return { type: "zoom", delta: 1 };
    case "-":
    case "_":
      return { type: "zoom", delta: -1 };
    case "0":
      return { type: "zoomReset" };
    case "/":
      return { type: "focusFilter" };
    default:
      return null;
  }
}

/** Neighbour of `currentId` in reading order (`delta` ±1), clamped at the ends. */
export function stepOrder(
  points: FocusPoint[],
  currentId: string | null,
  delta: 1 | -1,
): string | null {
  if (points.length === 0) return null;
  const index = points.findIndex((p) => p.id === currentId);
  if (index < 0) return points[delta === 1 ? 0 : points.length - 1]!.id;
  const next = Math.min(points.length - 1, Math.max(0, index + delta));
  return points[next]!.id;
}

/**
 * Nearest node in `direction` from the current node (within a 45° cone, then
 * by Euclidean distance); with no candidate, steps in reading order
 * (down/right → next, up/left → previous).
 */
export function nextFocus(
  points: FocusPoint[],
  currentId: string | null,
  direction: Direction,
): string | null {
  if (points.length === 0) return null;
  const current = points.find((p) => p.id === currentId);
  if (!current) return points[0]!.id;

  let best: { id: string; score: number } | null = null;
  for (const p of points) {
    if (p.id === current.id) continue;
    const dx = p.x - current.x;
    const dy = p.y - current.y;
    const along =
      direction === "right"
        ? dx
        : direction === "left"
          ? -dx
          : direction === "down"
            ? dy
            : -dy;
    const across =
      direction === "left" || direction === "right"
        ? Math.abs(dy)
        : Math.abs(dx);
    if (along <= 0 || across > along) continue;
    const score = Math.hypot(dx, dy);
    if (
      !best ||
      score < best.score ||
      (score === best.score && p.id < best.id)
    ) {
      best = { id: p.id, score };
    }
  }
  if (best) return best.id;
  return stepOrder(
    points,
    current.id,
    direction === "right" || direction === "down" ? 1 : -1,
  );
}
