import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAtlasStore } from "@/lib/atlas-store";
import { probePreferenceStorage } from "@/lib/control-plane/preferences";

/** Category A only: two browser-local preferences and their reset. No other controls. */
export function PreferencesSection() {
  const autoRotate = useAtlasStore((s) => s.autoRotate);
  const showRelationships = useAtlasStore((s) => s.showRelationships);
  const toggleAutoRotate = useAtlasStore((s) => s.toggleAutoRotate);
  const toggleRelationships = useAtlasStore((s) => s.toggleRelationships);
  const resetPreferences = useAtlasStore((s) => s.resetPreferences);
  const [remembered, setRemembered] = useState(true);

  // The store persists synchronously on change; re-probe so the notice reflects the current storage state.
  const refreshNotice = () => setRemembered(probePreferenceStorage());
  useEffect(refreshNotice, []);

  const change = (apply: () => void) => () => {
    apply();
    refreshNotice();
  };

  return (
    <section
      aria-labelledby="settings-preferences-heading"
      className="space-y-3"
    >
      <div>
        <p className="atlas-eyebrow mb-2">Preferences</p>
        <h2 id="settings-preferences-heading" className="text-xl font-semibold">
          Personal preferences
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Applied immediately and remembered in this browser only.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border/60 bg-card/50 p-5">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="pref-auto-rotate">Auto-rotate atlas</Label>
          <Switch
            id="pref-auto-rotate"
            checked={autoRotate}
            onCheckedChange={change(toggleAutoRotate)}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="pref-show-relationships">Show relationships</Label>
          <Switch
            id="pref-show-relationships"
            checked={showRelationships}
            onCheckedChange={change(toggleRelationships)}
          />
        </div>

        {remembered ? null : (
          <p role="status" className="text-xs text-muted-foreground">
            Browser storage is unavailable, so these preferences will not be
            remembered after you close this page.
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            resetPreferences();
            refreshNotice();
            toast.success("Preferences reset to defaults");
          }}
        >
          Reset preferences
        </Button>
      </div>
    </section>
  );
}
