import { describe, expect, test } from "bun:test";
import {
  PREFERENCE_DEFAULTS,
  PREFERENCES_STORAGE_KEY,
  sanitizePreferences,
} from "../../../src/lib/control-plane/preferences";

describe("sanitizePreferences", () => {
  test("defaults match the current atlas store initial values", () => {
    expect(PREFERENCE_DEFAULTS).toEqual({
      autoRotate: true,
      showRelationships: true,
    });
    expect(PREFERENCES_STORAGE_KEY).toBe("repoatlas.preferences.v1");
  });

  test("keeps valid values", () => {
    expect(
      sanitizePreferences({ autoRotate: false, showRelationships: false }),
    ).toEqual({
      autoRotate: false,
      showRelationships: false,
    });
  });

  test("invalid item falls back to its own default; valid sibling kept", () => {
    expect(
      sanitizePreferences({ autoRotate: "no", showRelationships: false }),
    ).toEqual({
      autoRotate: true,
      showRelationships: false,
    });
    expect(
      sanitizePreferences({ autoRotate: false, showRelationships: 1 }),
    ).toEqual({
      autoRotate: false,
      showRelationships: true,
    });
  });

  test("missing item falls back to default", () => {
    expect(sanitizePreferences({ autoRotate: false })).toEqual({
      autoRotate: false,
      showRelationships: true,
    });
  });

  test("unknown keys ignored", () => {
    const out = sanitizePreferences({
      autoRotate: false,
      extra: 1,
      theme: "x",
    });
    expect(out).toEqual({ autoRotate: false, showRelationships: true });
    expect(Object.keys(out).sort()).toEqual([
      "autoRotate",
      "showRelationships",
    ]);
  });

  test.each([
    [null],
    [undefined],
    [[]],
    [[true, false]],
    ["str"],
    [42],
    [true],
  ])("non-object %p yields defaults", (raw) => {
    expect(sanitizePreferences(raw)).toEqual(PREFERENCE_DEFAULTS);
  });

  test("returns a fresh object, not the shared defaults", () => {
    expect(sanitizePreferences(null)).not.toBe(PREFERENCE_DEFAULTS);
  });
});
