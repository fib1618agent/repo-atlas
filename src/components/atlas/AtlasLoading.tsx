import { Sparkles } from "lucide-react";

export function AtlasLoading({ label = "Mapping repositories…" }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
        {label}
      </div>
    </div>
  );
}
