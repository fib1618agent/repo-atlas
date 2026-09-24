import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConnectedSourcesDialog } from "@/components/atlas/ConnectedSourcesDialog";
import { parseAtlasError } from "@/lib/atlas-errors";
import { exportRepositoriesJson } from "@/lib/export-repositories";
import type { Repository } from "@/lib/repositories";
import { useSourcesStore } from "@/lib/sources-store";
import { toast } from "sonner";

type SourcesMenuProps = {
  sourceKey: string;
  isDefault: boolean;
  repositories: Repository[];
  urls: string[];
  isLoading: boolean;
  isFetching: boolean;
};

/**
 * Consolidated replacement for AtlasSourcesChrome — one "Sources" dropdown
 * instead of three separate navbar controls (Add sources / Export JSON /
 * source chip). Same props, reusable across every route (T003–T006 swap
 * this in place of AtlasSourcesChrome at each existing call site).
 */
export function SourcesMenu({
  sourceKey,
  isDefault,
  repositories,
  urls,
  isLoading,
  isFetching,
}: SourcesMenuProps) {
  const setDialogOpen = useSourcesStore((s) => s.setDialogOpen);
  const [connectedSourcesOpen, setConnectedSourcesOpen] = useState(false);

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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            Sources
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
            Add Sources
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleExport} disabled={exportDisabled}>
            Export JSON
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConnectedSourcesOpen(true)}>
            Connected Sources
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConnectedSourcesDialog open={connectedSourcesOpen} onOpenChange={setConnectedSourcesOpen} />
    </>
  );
}
