import { Badge } from "@/components/ui/badge";
import type { RelationshipLayerState } from "@/lib/repo-intel/relationship-layer";

/**
 * FR-009: relationship intelligence is not connected. The copy says so and
 * never claims that no relationships exist. No edge or thread is drawn.
 */
export function RelationshipLayerNotice({
  state,
}: {
  state: RelationshipLayerState;
}) {
  if (state.status === "available") return null;
  return (
    <section
      aria-labelledby="relationship-layer-heading"
      data-relationship-layer="unavailable"
      className="rounded-xl border border-dashed border-border/60 bg-card/30 p-5"
    >
      <p className="atlas-section-label">Relationships</p>
      <h2
        id="relationship-layer-heading"
        className="mt-1 flex items-center gap-2 text-lg font-semibold"
      >
        Relationship intelligence
        <Badge variant="outline">Not yet connected</Badge>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Relationships between files and symbols are not available yet. This is
        not a statement that none exist. What is shown here is structure only:
        directories, files and the symbols they contain, as recorded by
        RepoAtlas.
      </p>
    </section>
  );
}
