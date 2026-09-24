import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mapSourceFailuresToRows } from "@/lib/atlas-error-ui";
import { ATLAS_DEFAULT_OWNER, ATLAS_MAX_SOURCES } from "@/lib/atlas-config";
import { atlasErrorMessage, parseAtlasError } from "@/lib/atlas-errors";
import { dedupeSources } from "@/lib/github-url";
import { getRepositories } from "@/lib/repositories.functions";
import { validateRowsForMode, type SourceInputMode } from "@/lib/source-input-mode";
import {
  buildSelectedRepositoriesForAnalysis,
  type SelectedRepositoryForAnalysis,
} from "@/lib/repository-intelligence-extension-points";
import { useSourcesStore } from "@/lib/sources-store";

const DEFAULT_PREFILL = `https://github.com/${ATLAS_DEFAULT_OWNER}`;

function initialRows(isDefault: boolean, urls: string[]): string[] {
  if (!isDefault && urls.length > 0) return urls;
  return [DEFAULT_PREFILL];
}

export function SourcesDialog() {
  const queryClient = useQueryClient();
  const loadRepositories = useServerFn(getRepositories);

  const dialogOpen = useSourcesStore((s) => s.dialogOpen);
  const isDefault = useSourcesStore((s) => s.isDefault);
  const urls = useSourcesStore((s) => s.urls);
  const setDialogOpen = useSourcesStore((s) => s.setDialogOpen);
  const setLoaded = useSourcesStore((s) => s.setLoaded);
  const resetToDefault = useSourcesStore((s) => s.resetToDefault);

  const [rows, setRows] = useState<string[]>(() => initialRows(isDefault, urls));
  const [mode, setMode] = useState<SourceInputMode>("users");
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  // Extension point only (US6, T024) — populated after a successful Mode 2
  // (Repositories) load; consumed by no code yet. Never sent to a server
  // function, never triggers analysis.
  const [selectedForAnalysis, setSelectedForAnalysis] = useState<SelectedRepositoryForAnalysis[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (dialogOpen) {
      setRows(initialRows(isDefault, urls));
      setMode("users");
      setRowErrors({});
      setFormError(null);
      setSelectedForAnalysis([]);
    }
  }, [dialogOpen, isDefault, urls]);

  const closeDialog = () => {
    setDialogOpen(false);
    setRows(initialRows(isDefault, urls));
    setMode("users");
    setRowErrors({});
    setFormError(null);
    setSelectedForAnalysis([]);
  };

  const addRow = () => {
    if (rows.length >= ATLAS_MAX_SOURCES) return;
    setRows((prev) => [...prev, ""]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const updateRow = (index: number, value: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? value : row)));
    setRowErrors((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setFormError(null);
  };

  const handleLoad = async () => {
    const nonEmpty = rows.map((r) => r.trim()).filter(Boolean);
    if (nonEmpty.length === 0) {
      setFormError(atlasErrorMessage("VALIDATION_EMPTY"));
      return;
    }

    const { parsed, errors } = validateRowsForMode(rows, mode);

    if (Object.keys(errors).length > 0) {
      setRowErrors(errors);
      return;
    }

    const { unique, removed } = dedupeSources(parsed);
    removed.forEach((login) => {
      toast.message(`Removed duplicate: ${login}`);
    });

    if (unique.length === 0) {
      setFormError(atlasErrorMessage("VALIDATION_EMPTY"));
      return;
    }

    const inputs = unique.map((s) => s.raw);
    setLoading(true);
    setFormError(null);
    setRowErrors({});

    try {
      const response = await loadRepositories({ data: { sources: inputs } });
      setLoaded(inputs, response.sourceKey);
      queryClient.setQueryData(["repositories", response.sourceKey], response);

      // Extension point only (US6, T024) — no analysis triggered, no
      // snapshot acquired, no Feature 001 call. Users mode is unaffected.
      if (mode === "repositories") {
        setSelectedForAnalysis(buildSelectedRepositoriesForAnalysis(unique));
      }

      setDialogOpen(false);

      toast.success(
        `Loaded ${response.repositories.length} public repositories from ${response.meta.requested} source(s).`,
      );

      response.warnings.forEach((warning) => {
        if (warning.code === "SPIRAL_TRUNCATED" || warning.code === "CATALOGUE_TRUNCATED") {
          toast.message(warning.message);
        } else if (warning.code === "PARTIAL_FAILURE") {
          toast.warning(warning.message);
        } else if (warning.code === "SOURCE_NOT_FOUND" || warning.code === "SOURCE_FORBIDDEN") {
          toast.error(warning.message);
        }
      });

    } catch (error) {
      const parsed = parseAtlasError(error);
      if (parsed) {
        if (parsed.code === "VALIDATION_EMPTY" || parsed.code === "TOO_MANY_SOURCES") {
          setFormError(parsed.message);
        } else if (parsed.sourceFailures?.length) {
          setRowErrors(mapSourceFailuresToRows(rows, parsed.sourceFailures));
          toast.error(parsed.message);
        } else {
          toast.error(parsed.message);
        }
      } else {
        toast.error(atlasErrorMessage("NETWORK"));
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = () => {
    resetToDefault();
    queryClient.invalidateQueries({ queryKey: ["repositories"] });
    setResetOpen(false);
    setDialogOpen(false);
    toast.message("Restored the default atlas.");
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add GitHub sources</DialogTitle>
            <DialogDescription>
              Paste GitHub user, organization, or repository URLs. Only public repositories are loaded. The default
              atlas stays until you click Load.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={mode} onValueChange={(value) => setMode(value as SourceInputMode)}>
            <TabsList>
              <TabsTrigger value="users" disabled={loading}>
                Users
              </TabsTrigger>
              <TabsTrigger value="repositories" disabled={loading}>
                Repositories
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-3 py-2">
            {rows.map((row, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    value={row}
                    onChange={(e) => updateRow(index, e.target.value)}
                    placeholder="https://github.com/username"
                    disabled={loading}
                    aria-invalid={!!rowErrors[index]}
                  />
                  {rowErrors[index] && (
                    <p className="text-xs text-destructive">{rowErrors[index]}</p>
                  )}
                </div>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(index)}
                    disabled={loading}
                    aria-label="Remove row"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              disabled={loading || rows.length >= ATLAS_MAX_SOURCES}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {rows.length >= ATLAS_MAX_SOURCES ? "Maximum 5 GitHub URLs." : "Add more"}
            </Button>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setResetOpen(true)}
              disabled={loading || isDefault}
            >
              Reset to default
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>
                Cancel
              </Button>
              <Button type="button" onClick={handleLoad} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore the default atlas?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears your custom GitHub sources and shows imdadareeph repositories again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>Restore default</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
