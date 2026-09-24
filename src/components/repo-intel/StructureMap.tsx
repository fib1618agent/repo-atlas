import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { keyToAction, nextFocus, stepOrder } from "@/lib/repo-intel/keyboard";
import { languageColor } from "@/lib/repo-intel/language-colors";
import { layoutLevel } from "@/lib/repo-intel/layout";
import type { MapItem } from "@/lib/repo-intel/level-items";
import { plural } from "@/lib/repo-intel/format";

const VIEW_W = 800;
const VIEW_H = 600;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;

export interface StructureMapProps {
  items: MapItem[];
  currentFile: string | undefined;
  /** Directory or file activated by click/Enter/Space. */
  onActivate: (item: MapItem) => void;
  /** Overflow node activated: move focus to the outline, which lists everything. */
  onOverflow: () => void;
  onUp: () => void;
  onFocusFilter: () => void;
}

/**
 * Bounded SVG map of one structure level (FR-012–FR-014). Positions come from
 * the pure `layoutLevel`; every node is a focusable button with an accessible
 * label. No edges are drawn, and nothing animates continuously.
 */
export function StructureMap({
  items,
  currentFile,
  onActivate,
  onOverflow,
  onUp,
  onFocusFilter,
}: StructureMapProps) {
  const gradientPrefix = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const layout = useMemo(
    () => layoutLevel(items, { width: VIEW_W, height: VIEW_H }),
    [items],
  );
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const points = useMemo(
    () => [
      ...layout.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
      ...layout.overflow.map((o) => ({
        id: `overflow:${o.kind}`,
        x: o.x,
        y: o.y,
      })),
    ],
    [layout],
  );

  const [focusId, setFocusId] = useState<string | null>(null);
  const activeId = points.some((p) => p.id === focusId)
    ? focusId
    : (points[0]?.id ?? null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const zoom = (delta: 1 | -1) =>
    setView((v) => ({
      ...v,
      scale: Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, v.scale * (delta === 1 ? 1.25 : 0.8)),
      ),
    }));
  const resetView = () => setView({ scale: 1, x: 0, y: 0 });

  // Ctrl/Cmd + wheel zooms; a plain wheel scrolls the page as usual.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const focusNode = (id: string | null) => {
    if (!id) return;
    setFocusId(id);
    const el = Array.from(
      svgRef.current?.querySelectorAll<SVGGElement>("[data-node-id]") ?? [],
    ).find((g) => g.dataset["nodeId"] === id);
    el?.focus();
  };

  const activate = (id: string) => {
    if (id.startsWith("overflow:")) return onOverflow();
    const item = byId.get(id);
    if (item) onActivate(item);
  };

  const onNodeKeyDown = (event: React.KeyboardEvent, id: string) => {
    const action = keyToAction(event.key);
    if (!action) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    switch (action.type) {
      case "activate":
        return activate(id);
      case "move":
        return focusNode(nextFocus(points, id, action.direction));
      case "order":
        return focusNode(stepOrder(points, id, action.delta));
      case "home":
        return focusNode(points[0]?.id ?? null);
      case "end":
        return focusNode(points[points.length - 1]?.id ?? null);
      case "up":
        return onUp();
      case "zoom":
        return zoom(action.delta);
      case "zoomReset":
        return resetView();
      case "focusFilter":
        return onFocusFilter();
    }
  };

  const colors = useMemo(() => {
    const set = new Set<string>(["dir"]);
    for (const n of layout.nodes) if (n.kind === "file") set.add(n.group ?? "");
    return [...set];
  }, [layout]);
  const gradId = (key: string) => `${gradientPrefix}-g-${colors.indexOf(key)}`;
  const nodeFill = (kind: "directory" | "file", group: string | null) =>
    `url(#${gradId(kind === "directory" ? "dir" : (group ?? ""))})`;

  const summary = `Structure map of the current level: ${plural(
    layout.nodes.filter((n) => n.kind === "directory").length,
    "directory",
    "directories",
  )} and ${plural(layout.nodes.filter((n) => n.kind === "file").length, "file")} shown${
    layout.overflow.length > 0
      ? `, plus ${layout.overflow.map((o) => plural(o.count, o.kind === "directory" ? "more directory" : "more file", o.kind === "directory" ? "more directories" : "more files")).join(" and ")} grouped`
      : ""
  }. Use arrow keys to move, Enter to open, Backspace to go up.`;

  return (
    <div
      className="relative rounded-xl border border-border/60 bg-card/30"
      data-structure-map
    >
      <div
        className="absolute right-2 top-2 z-10 flex gap-1"
        role="group"
        aria-label="Map zoom"
      >
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8"
          aria-label="Zoom in"
          onClick={() => zoom(1)}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8"
          aria-label="Zoom out"
          onClick={() => zoom(-1)}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8"
          aria-label="Reset view"
          onClick={resetView}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <svg
        ref={svgRef}
        role="group"
        aria-label={summary}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-auto w-full touch-none select-none"
        onPointerDown={(e) => {
          if ((e.target as Element).closest("[data-node-id]")) return;
          drag.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const k = VIEW_W / rect.width;
          const dx = (e.clientX - drag.current.x) * k;
          const dy = (e.clientY - drag.current.y) * k;
          drag.current = { x: e.clientX, y: e.clientY };
          setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          {colors.map((key) => {
            const base =
              key === "dir" ? "var(--primary)" : languageColor(key || null);
            return (
              <radialGradient
                key={key}
                id={`${gradientPrefix}-g-${colors.indexOf(key)}`}
                cx="0.35"
                cy="0.3"
                r="0.85"
              >
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
                <stop offset="0.5" style={{ stopColor: base }} />
                <stop
                  offset="1"
                  style={{ stopColor: base }}
                  stopOpacity="0.65"
                />
              </radialGradient>
            );
          })}
        </defs>
        <g
          transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}
          style={{ transformOrigin: "400px 300px" }}
        >
          {layout.nodes.map((n) => {
            const item = byId.get(n.id);
            const isCurrent = item?.path === currentFile;
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={activeId === n.id ? 0 : -1}
                data-node-id={n.id}
                data-node-kind={n.kind}
                aria-label={item?.ariaLabel ?? n.label}
                aria-current={isCurrent ? "true" : undefined}
                className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-[3px] focus-visible:[&>circle]:stroke-white"
                onClick={() => activate(n.id)}
                onFocus={() => setFocusId(n.id)}
                onKeyDown={(e) => onNodeKeyDown(e, n.id)}
              >
                <title>{item?.ariaLabel ?? n.label}</title>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={nodeFill(n.kind, n.group)}
                  stroke={isCurrent ? "#ffffff" : "rgba(255,255,255,0.25)"}
                  strokeWidth={isCurrent ? 2.5 : 1}
                />
                {n.r >= 13 && (
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#ffffff"
                    pointerEvents="none"
                  >
                    {n.label.length > 12 ? `${n.label.slice(0, 11)}…` : n.label}
                  </text>
                )}
              </g>
            );
          })}
          {layout.overflow.map((o) => {
            const id = `overflow:${o.kind}`;
            const label = `${o.count} more ${o.kind === "directory" ? (o.count === 1 ? "directory" : "directories") : o.count === 1 ? "file" : "files"}, open the outline to see all`;
            return (
              <g
                key={id}
                role="button"
                tabIndex={activeId === id ? 0 : -1}
                data-node-id={id}
                data-node-kind="overflow"
                aria-label={label}
                className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-[3px] focus-visible:[&>circle]:stroke-white"
                onClick={() => activate(id)}
                onFocus={() => setFocusId(id)}
                onKeyDown={(e) => onNodeKeyDown(e, id)}
              >
                <title>{label}</title>
                <circle
                  cx={o.x}
                  cy={o.y}
                  r={o.r}
                  fill="rgba(148,163,184,0.18)"
                  stroke="rgba(148,163,184,0.7)"
                  strokeDasharray="4 3"
                />
                <text
                  x={o.x}
                  y={o.y + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#e2e8f0"
                  pointerEvents="none"
                >
                  +{o.count}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {points.length === 0 && (
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          No items match at this level.
        </p>
      )}
    </div>
  );
}
