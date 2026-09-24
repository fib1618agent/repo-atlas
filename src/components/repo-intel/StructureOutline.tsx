import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { dirOf } from "@/lib/repo-intel/format";
import type { MapItem } from "@/lib/repo-intel/level-items";

/**
 * The accessible twin of the structure map (FR-014): every loaded child as a
 * real link, in the same order the map uses, with the same descriptions.
 */
export function StructureOutline({
  owner,
  name,
  items,
  currentFile,
  hasMore,
  loadingMore,
  onLoadMore,
  outlineRef,
}: {
  owner: string;
  name: string;
  items: MapItem[];
  currentFile: string | undefined;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  outlineRef?: React.Ref<HTMLElement>;
}) {
  return (
    <section
      ref={outlineRef}
      tabIndex={-1}
      aria-labelledby="outline-heading"
      data-outline
      className="rounded-xl border border-border/60 bg-card/40 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <h3 id="outline-heading" className="atlas-section-label">
        Outline ({items.length} shown)
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing to show at this level{hasMore ? " yet" : ""}.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border/40 text-sm">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to="/repository/$owner/$name"
                params={{ owner, name }}
                search={
                  item.kind === "directory"
                    ? { path: item.path }
                    : { path: dirOf(item.path), file: item.path }
                }
                aria-current={item.path === currentFile ? "true" : undefined}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-1 py-1.5 hover:bg-secondary/40 focus-visible:bg-secondary/40"
              >
                <span aria-hidden className="text-muted-foreground">
                  {item.kind === "directory" ? "▸" : "·"}
                </span>
                <span className="min-w-0 break-all font-medium">
                  {item.label}
                  {item.kind === "directory" ? "/" : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.detail}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </section>
  );
}
