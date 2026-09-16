import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ATLAS_DEFAULT_OWNER } from "./atlas-config";

type SourcesState = {
  urls: string[];
  sourceKey: string;
  isDefault: boolean;
  dialogOpen: boolean;
  _hasHydrated: boolean;
  setLoaded: (urls: string[], sourceKey: string) => void;
  resetToDefault: () => void;
  setDialogOpen: (open: boolean) => void;
};

export const useSourcesStore = create<SourcesState>()(
  persist(
    (set) => ({
      urls: [],
      sourceKey: ATLAS_DEFAULT_OWNER,
      isDefault: true,
      dialogOpen: false,
      _hasHydrated: false,
      // FR-016: only this path writes persisted urls/sourceKey/isDefault
      setLoaded: (urls, sourceKey) =>
        set({
          urls,
          sourceKey,
          isDefault: false,
          dialogOpen: false,
        }),
      resetToDefault: () =>
        set({
          urls: [],
          sourceKey: ATLAS_DEFAULT_OWNER,
          isDefault: true,
          dialogOpen: false,
        }),
      setDialogOpen: (open) => set({ dialogOpen: open }),
    }),
    {
      name: "repoatlas.sources.v1",
      partialize: (state) => ({
        urls: state.urls,
        sourceKey: state.sourceKey,
        isDefault: state.isDefault,
      }),
      onRehydrateStorage: () => () => {
        useSourcesStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
