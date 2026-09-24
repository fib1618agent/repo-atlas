import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { useAtlasStore } from "../../../src/lib/atlas-store";
import {
  configurePreferenceStorage,
  PREFERENCE_DEFAULTS,
  PREFERENCES_STORAGE_KEY,
  probePreferenceStorage,
  readStoredPreferences,
  writeStoredPreferences,
  type PreferenceStorage,
} from "../../../src/lib/control-plane/preferences";
import { useSourcesStore } from "../../../src/lib/sources-store";

function memoryStorage() {
  const data = new Map<string, string>();
  const writes: string[] = [];
  const storage: PreferenceStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(k);
      data.set(k, v);
    },
    removeItem: (k) => void data.delete(k),
  };
  return {
    storage,
    data,
    writes,
    prefWrites: () =>
      writes.filter((k) => k === PREFERENCES_STORAGE_KEY).length,
  };
}

const throwing: PreferenceStorage = {
  getItem: () => {
    throw new Error("SENTINEL read failure");
  },
  setItem: () => {
    throw new Error("SENTINEL write failure");
  },
  removeItem: () => {
    throw new Error("SENTINEL remove failure");
  },
};

const stored = (m: ReturnType<typeof memoryStorage>) =>
  JSON.parse(m.data.get(PREFERENCES_STORAGE_KEY) ?? "null");

beforeEach(() => {
  configurePreferenceStorage(undefined);
  useAtlasStore.setState({
    ...PREFERENCE_DEFAULTS,
    hoveredId: null,
    selectedId: null,
    category: null,
    language: null,
    topic: null,
  });
});
afterEach(() => configurePreferenceStorage(undefined));

describe("storage layer (T015)", () => {
  test("module import and read need no browser globals; no storage yields defaults", () => {
    expect(typeof window).toBe("undefined");
    expect(readStoredPreferences()).toEqual(PREFERENCE_DEFAULTS);
    expect(writeStoredPreferences(PREFERENCE_DEFAULTS)).toBe(false);
    expect(probePreferenceStorage()).toBe(false);
  });

  test("source has no top-level browser API access", () => {
    const src = readFileSync(
      new URL("../../../src/lib/control-plane/preferences.ts", import.meta.url),
      "utf8",
    );
    for (const line of src.split("\n")) {
      if (
        /^\s/.test(line) ||
        line.startsWith("//") ||
        line.startsWith("/*") ||
        line.startsWith(" *")
      )
        continue;
      expect(line).not.toMatch(
        /\b(window|localStorage|sessionStorage|document)\b/,
      );
    }
    expect(src).not.toContain("process.env");
  });

  test("restores valid stored values", () => {
    const m = memoryStorage();
    m.data.set(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ autoRotate: false, showRelationships: false }),
    );
    configurePreferenceStorage(m.storage);
    expect(readStoredPreferences()).toEqual({
      autoRotate: false,
      showRelationships: false,
    });
  });

  test("malformed JSON, wrong shapes and invalid items fall back to defaults per item", () => {
    const m = memoryStorage();
    configurePreferenceStorage(m.storage);
    for (const raw of ["{not json", "null", "[]", '"str"', "42", ""]) {
      m.data.set(PREFERENCES_STORAGE_KEY, raw);
      expect(readStoredPreferences()).toEqual(PREFERENCE_DEFAULTS);
    }
    m.data.set(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ autoRotate: "yes", showRelationships: false, extra: 1 }),
    );
    expect(readStoredPreferences()).toEqual({
      autoRotate: true,
      showRelationships: false,
    });
  });

  test("throwing storage never throws: read defaults, write/probe return false", () => {
    configurePreferenceStorage(throwing);
    expect(readStoredPreferences()).toEqual(PREFERENCE_DEFAULTS);
    expect(writeStoredPreferences(PREFERENCE_DEFAULTS)).toBe(false);
    expect(probePreferenceStorage()).toBe(false);
  });

  test("write persists only the two known keys; probe uses a separate key and cleans up", () => {
    const m = memoryStorage();
    configurePreferenceStorage(m.storage);
    expect(
      writeStoredPreferences({
        autoRotate: false,
        showRelationships: true,
        ...{ extra: "x" },
      } as never),
    ).toBe(true);
    expect(stored(m)).toEqual({ autoRotate: false, showRelationships: true });
    expect(probePreferenceStorage()).toBe(true);
    expect([...m.data.keys()]).toEqual([PREFERENCES_STORAGE_KEY]);
  });
});

describe("atlas store integration (T016)", () => {
  test("toggling each preference writes exactly once, with the new value", () => {
    const m = memoryStorage();
    configurePreferenceStorage(m.storage);
    useAtlasStore.getState().toggleAutoRotate();
    expect(m.prefWrites()).toBe(1);
    expect(stored(m)).toEqual({ autoRotate: false, showRelationships: true });
    useAtlasStore.getState().toggleRelationships();
    expect(m.prefWrites()).toBe(2);
    expect(stored(m)).toEqual({ autoRotate: false, showRelationships: false });
  });

  test("setting a preference to its current value writes nothing", () => {
    const m = memoryStorage();
    configurePreferenceStorage(m.storage);
    useAtlasStore.setState({ autoRotate: true, showRelationships: true });
    expect(m.writes).toHaveLength(0);
  });

  test("unrelated store changes never write", () => {
    const m = memoryStorage();
    configurePreferenceStorage(m.storage);
    const s = useAtlasStore.getState();
    s.setHovered(1);
    s.setHovered(null);
    s.setSelected(2);
    s.setCategory("ai" as never);
    s.setLanguage("TypeScript");
    s.setTopic("x");
    s.resetFilters();
    expect(m.writes).toHaveLength(0);
  });

  test("resetPreferences restores defaults and persists them", () => {
    const m = memoryStorage();
    useAtlasStore.setState({ autoRotate: false, showRelationships: false });
    configurePreferenceStorage(m.storage);
    useAtlasStore.getState().resetPreferences();
    const { autoRotate, showRelationships } = useAtlasStore.getState();
    expect({ autoRotate, showRelationships }).toEqual(PREFERENCE_DEFAULTS);
    expect(stored(m)).toEqual(PREFERENCE_DEFAULTS);
    expect(m.prefWrites()).toBe(1);
  });

  test("resetPreferences at defaults still persists the defaults once (heals a bad record)", () => {
    const m = memoryStorage();
    m.data.set(PREFERENCES_STORAGE_KEY, "{corrupt");
    configurePreferenceStorage(m.storage);
    useAtlasStore.getState().resetPreferences();
    expect(stored(m)).toEqual(PREFERENCE_DEFAULTS);
    expect(m.prefWrites()).toBe(1);
  });

  test("resetPreferences leaves filters, selection and the source set untouched", () => {
    const before = { ...useSourcesStore.getState() };
    useAtlasStore.setState({
      autoRotate: false,
      category: "ai" as never,
      language: "Go",
      topic: "t",
      selectedId: 3,
    });
    useAtlasStore.getState().resetPreferences();
    const a = useAtlasStore.getState();
    expect([a.category, a.language, a.topic, a.selectedId]).toEqual([
      "ai",
      "Go",
      "t",
      3,
    ]);
    expect(useSourcesStore.getState()).toEqual(before);
  });

  test("storage failures do not break state changes", () => {
    configurePreferenceStorage(throwing);
    expect(() => useAtlasStore.getState().toggleAutoRotate()).not.toThrow();
    expect(useAtlasStore.getState().autoRotate).toBe(false);
    expect(() => useAtlasStore.getState().resetPreferences()).not.toThrow();
    expect(useAtlasStore.getState().autoRotate).toBe(true);
  });

  test("new store instance initializes from stored values, sanitized; unavailable storage gives defaults", async () => {
    const path = "../../../src/lib/atlas-store";
    const fresh = async (n: number) =>
      (
        (await import(`${path}?fresh=${n}`)) as {
          useAtlasStore: typeof useAtlasStore;
        }
      ).useAtlasStore;

    const m = memoryStorage();
    m.data.set(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ autoRotate: false, showRelationships: "bad" }),
    );
    configurePreferenceStorage(m.storage);
    const a = (await fresh(1)).getState();
    expect({
      autoRotate: a.autoRotate,
      showRelationships: a.showRelationships,
    }).toEqual({
      autoRotate: false,
      showRelationships: true,
    });
    expect(m.writes).toHaveLength(0); // initialization never writes

    configurePreferenceStorage(throwing);
    const b = (await fresh(2)).getState();
    expect({
      autoRotate: b.autoRotate,
      showRelationships: b.showRelationships,
    }).toEqual(PREFERENCE_DEFAULTS);
  });

  test("store uses no zustand persist middleware and only browser-local preferences storage", () => {
    const src = readFileSync(
      new URL("../../../src/lib/atlas-store.ts", import.meta.url),
      "utf8",
    );
    expect(src).not.toContain("zustand/middleware");
    expect(src).not.toMatch(/localStorage|sessionStorage|process\.env|fetch\(/);
  });
});
