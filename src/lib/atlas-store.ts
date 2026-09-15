import { create } from "zustand";
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
}

export const useAtlasStore = create<AtlasState>((set) => ({
  hoveredId: null,
  selectedId: null,
  category: null,
  language: null,
  topic: null,
  autoRotate: true,
  showRelationships: true,
  setHovered: (hoveredId) => set({ hoveredId }),
  setSelected: (selectedId) => set({ selectedId }),
  setCategory: (category) => set((state) => ({ category: state.category === category ? null : category })),
  setLanguage: (language) => set((state) => ({ language: state.language === language ? null : language })),
  setTopic: (topic) => set((state) => ({ topic: state.topic === topic ? null : topic })),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
  toggleRelationships: () => set((state) => ({ showRelationships: !state.showRelationships })),
  resetFilters: () => set({ category: null, language: null, topic: null, selectedId: null }),
}));
