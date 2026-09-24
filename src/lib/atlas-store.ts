import { create } from "zustand";
import {
  PREFERENCE_DEFAULTS,
  readStoredPreferences,
  writeStoredPreferences,
} from "./control-plane/preferences";
import type { RepoCategory } from "./repositories";

interface AtlasState {
  hoveredId: number | null;
  selectedId: number | null;
  category: RepoCategory | null;
  language: string | null;
  topic: string | null;
  autoRotate: boolean;
  showRelationships: boolean;
  setHovered: (id: number | null) => void;
  setSelected: (id: number | null) => void;
  setCategory: (category: RepoCategory | null) => void;
  setLanguage: (language: string | null) => void;
  setTopic: (topic: string | null) => void;
  toggleAutoRotate: () => void;
  toggleRelationships: () => void;
  resetFilters: () => void;
  resetPreferences: () => void;
}

const storedPreferences = readStoredPreferences();

export const useAtlasStore = create<AtlasState>((set, get) => ({
  hoveredId: null,
  selectedId: null,
  category: null,
  language: null,
  topic: null,
  autoRotate: storedPreferences.autoRotate,
  showRelationships: storedPreferences.showRelationships,
  setHovered: (hoveredId) => set({ hoveredId }),
  setSelected: (selectedId) => set({ selectedId }),
  setCategory: (category) => set((state) => ({ category: state.category === category ? null : category })),
  setLanguage: (language) => set((state) => ({ language: state.language === language ? null : language })),
  setTopic: (topic) => set((state) => ({ topic: state.topic === topic ? null : topic })),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
  toggleRelationships: () => set((state) => ({ showRelationships: !state.showRelationships })),
  resetFilters: () => set({ category: null, language: null, topic: null, selectedId: null }),
  resetPreferences: () => {
    const { autoRotate, showRelationships } = get();
    const unchanged =
      autoRotate === PREFERENCE_DEFAULTS.autoRotate &&
      showRelationships === PREFERENCE_DEFAULTS.showRelationships;
    // A change is persisted by the subscriber below; when already at defaults, still write them once.
    if (unchanged) writeStoredPreferences(PREFERENCE_DEFAULTS);
    else set({ ...PREFERENCE_DEFAULTS });
  },
}));

// Persist only the two preferences, and only when one of them changed (no zustand `persist`).
useAtlasStore.subscribe((state, prev) => {
  if (
    state.autoRotate !== prev.autoRotate ||
    state.showRelationships !== prev.showRelationships
  ) {
    writeStoredPreferences(state);
  }
});
