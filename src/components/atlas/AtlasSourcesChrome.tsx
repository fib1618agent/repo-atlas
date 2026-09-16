import { Button } from "@/components/ui/button";
import { parseAtlasError } from "@/lib/atlas-errors";
import { exportRepositoriesJson } from "@/lib/export-repositories";
import type { Repository } from "@/lib/repositories";
import { useSourcesStore } from "@/lib/sources-store";
import { toast } from "sonner";

type AtlasSourcesChromeProps = {
  sourceKey: string;
  isDefault: boolean;
  repositories: Repository[];
  urls: string[];
  isLoading: boolean;
  isFetching: boolean;
};

export function AtlasSourcesChrome({
  sourceKey,
  isDefault,
  repositories,
  urls,
  isLoading,
  isFetching,
}: AtlasSourcesChromeProps) {
  const setDialogOpen = useSourcesStore((s) => s.setDialogOpen);

  const chipLabel = isDefault
    ? null
    : `Sources: ${sourceKey.split("+").join(" + ")}`;

  const exportDisabled = isLoading || isFetching || repositories.length === 0;

  const handleExport = () => {
    try {
      const count = exportRepositoriesJson({
        repositories,
        sourceKey,
        isDefault,
        urls,
      });
      toast.success(`Exported ${count} repositories.`);
    } catch (error) {
      const parsed = parseAtlasError(error);
      if (parsed?.code === "EXPORT_EMPTY") {
        toast.error(parsed.message);
        return;
      }
      throw error;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        Add sources
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={exportDisabled}
        onClick={handleExport}
      >
        Export JSON
      </Button>
      {chipLabel && (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="hidden rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground sm:inline-flex"
        >
          {chipLabel}
        </button>
      )}
    </div>
  );
}
