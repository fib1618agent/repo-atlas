import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { deriveConnectedSources, type ConnectedSourceStatus } from "@/lib/connected-sources";
import { useAtlasRepositories } from "@/lib/use-atlas-repositories";

type ConnectedSourcesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STATUS_LABEL: Record<ConnectedSourceStatus, string> = {
  connected: "Connected",
  degraded: "Degraded",
  error: "Error",
};

const STATUS_BADGE_VARIANT: Record<ConnectedSourceStatus, "default" | "secondary" | "destructive"> = {
  connected: "default",
  degraded: "secondary",
  error: "destructive",
};

/**
 * Read-only visualization of the current source-set. Presentational —
 * reads useSourcesStore()/useAtlasRepositories() for content the same way
 * SourcesDialog.tsx already does (existing architecture: global dialogs
 * read state directly rather than prop-drilling from route files), but
 * open/close is controlled via props so T011 can wire it into SourcesMenu
 * without this component owning where that boolean lives.
 */
export function ConnectedSourcesDialog({ open, onOpenChange }: ConnectedSourcesDialogProps) {
  const { repositories, sourceKey, isDefault, urls, warnings, meta } = useAtlasRepositories();

  const sources = deriveConnectedSources({
    sourceKey,
    isDefault,
    urls,
    repositories,
    warnings,
    meta: meta ?? {},
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connected sources</DialogTitle>
          <DialogDescription>
            Repository sources currently contributing to the atlas.
          </DialogDescription>
        </DialogHeader>

        {sources.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No sources connected yet. Use Add Sources to load repositories.
          </p>
        ) : (
          <div className="space-y-2 py-2">
            {sources.map((source) => (
              <div
                key={source.identity}
                className="flex items-center gap-3 rounded-md border border-border/60 bg-card/60 px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: source.colorToken }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{source.identity}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.type} · {source.repositoryCount}{" "}
                    {source.repositoryCount === 1 ? "repository" : "repositories"}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE_VARIANT[source.status]}>
                  {STATUS_LABEL[source.status]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
