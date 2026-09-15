import { Maximize2, MousePointer2, Pause, Play, RotateCcw, Search, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtlasStore } from "@/lib/atlas-store";

export function AtlasControls({ onReset }: { onReset: () => void }) {
  const autoRotate = useAtlasStore((state) => state.autoRotate);
  const toggleAutoRotate = useAtlasStore((state) => state.toggleAutoRotate);
  return (
    <div className="atlas-controls pointer-events-auto">
      <div className="flex items-center gap-2 border-r border-border pr-4">
        <Button variant="ghost" size="icon" onClick={toggleAutoRotate} aria-label={autoRotate ? "Pause rotation" : "Resume rotation"}>
          {autoRotate ? <Pause /> : <Play />}
        </Button>
        <div><p className="text-xs text-foreground">Auto rotate</p><p className="text-[10px] text-muted-foreground">{autoRotate ? "On" : "Paused"}</p></div>
      </div>
      <div className="hidden items-center gap-5 text-[11px] text-muted-foreground md:flex">
        <span className="flex items-center gap-1.5"><MousePointer2 className="h-3.5 w-3.5" />Drag to rotate</span>
        <span className="flex items-center gap-1.5"><ZoomIn className="h-3.5 w-3.5" />Scroll to zoom</span>
        <span className="flex items-center gap-1.5"><Search className="h-3.5 w-3.5" />Search to focus</span>
      </div>
      <Button variant="ghost" size="icon" onClick={onReset} aria-label="Reset selection"><RotateCcw /></Button>
      <Button variant="ghost" size="icon" onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Enter full screen"><Maximize2 /></Button>
    </div>
  );
}
