import { describe, expect, test } from "bun:test";
import {
  keyToAction,
  nextFocus,
  stepOrder,
  type FocusPoint,
} from "../../../src/lib/repo-intel/keyboard";
import { languageColor } from "../../../src/lib/repo-intel/language-colors";
import {
  findLoaded,
  resolveProviderResponse,
} from "../../../src/lib/repo-intel/repository-context";
import type { Repository } from "../../../src/lib/repositories";

const pts: FocusPoint[] = [
  { id: "a", x: 0, y: 0 },
  { id: "b", x: 100, y: 0 },
  { id: "c", x: 200, y: 5 },
  { id: "d", x: 100, y: 100 },
  { id: "e", x: 0, y: 100 },
];

describe("keyboard model (FR-014)", () => {
  test("keys map to actions; unknown keys map to nothing", () => {
    expect(keyToAction("ArrowLeft")).toEqual({
      type: "move",
      direction: "left",
    });
    expect(keyToAction("Enter")).toEqual({ type: "activate" });
    expect(keyToAction(" ")).toEqual({ type: "activate" });
    expect(keyToAction("Backspace")).toEqual({ type: "up" });
    expect(keyToAction("Escape")).toEqual({ type: "up" });
    expect(keyToAction("+")).toEqual({ type: "zoom", delta: 1 });
    expect(keyToAction("-")).toEqual({ type: "zoom", delta: -1 });
    expect(keyToAction("0")).toEqual({ type: "zoomReset" });
    expect(keyToAction("/")).toEqual({ type: "focusFilter" });
    expect(keyToAction("x")).toBeNull();
  });

  test("spatial movement picks the nearest node in that direction", () => {
    expect(nextFocus(pts, "a", "right")).toBe("b");
    expect(nextFocus(pts, "b", "right")).toBe("c");
    expect(nextFocus(pts, "b", "down")).toBe("d");
    expect(nextFocus(pts, "d", "up")).toBe("b");
    expect(nextFocus(pts, "d", "left")).toBe("e");
  });

  test("no spatial candidate falls back to reading order; empty and unknown ids are safe", () => {
    expect(nextFocus(pts, "c", "right")).toBe("d");
    expect(nextFocus(pts, "a", "left")).toBe("a");
    expect(nextFocus([], "a", "down")).toBeNull();
    expect(nextFocus(pts, null, "down")).toBe("a");
    expect(nextFocus(pts, "zzz", "down")).toBe("a");
  });

  test("ordered stepping reaches every node and clamps at the ends", () => {
    const seen = new Set<string>();
    let cur: string | null = null;
    for (let i = 0; i < pts.length + 2; i++) {
      cur = stepOrder(pts, cur, 1);
      seen.add(cur!);
    }
    expect(seen.size).toBe(pts.length);
    expect(stepOrder(pts, "e", 1)).toBe("e");
    expect(stepOrder(pts, "a", -1)).toBe("a");
  });
});

const repo = (fullName: string): Repository =>
  ({ id: 1, name: fullName.split("/")[1], fullName }) as Repository;

describe("provider context resolution (FR-002, FR-004)", () => {
  test("match in a loaded catalogue is case-insensitive and canonical", () => {
    const found = findLoaded({ owner: "ACME", name: "Widget" }, [
      repo("other/x"),
      repo("acme/widget"),
    ]);
    expect(found?.fullName).toBe("acme/widget");
  });

  test("a thrown serialized provider error maps by code (lone missing repo)", () => {
    const params = { owner: "acme", name: "widget" };
    const thrown = (code: string) =>
      new Error(JSON.stringify({ code, message: "x" }));
    for (const code of ["SOURCE_NOT_FOUND", "SOURCE_FORBIDDEN"]) {
      expect(
        resolveProviderResponse(params, undefined, true, thrown(code)),
      ).toEqual({ status: "not_found" });
    }
    for (const code of ["RATE_LIMITED", "NETWORK", "GITHUB_5XX"]) {
      expect(
        resolveProviderResponse(params, undefined, true, thrown(code)),
      ).toEqual({ status: "provider_error" });
    }
    expect(
      resolveProviderResponse(params, undefined, true, new Error("boom")),
    ).toEqual({ status: "provider_error" });
  });

  test("missing or forbidden repositories are not_found; outages are provider_error", () => {
    const params = { owner: "acme", name: "widget" };
    for (const code of ["SOURCE_NOT_FOUND", "SOURCE_FORBIDDEN"]) {
      expect(
        resolveProviderResponse(
          params,
          { repositories: [], meta: { sourceFailures: [{ code }] } },
          false,
        ),
      ).toEqual({ status: "not_found" });
    }
    for (const code of ["RATE_LIMITED", "NETWORK", "GITHUB_5XX"]) {
      expect(
        resolveProviderResponse(
          params,
          { repositories: [], meta: { sourceFailures: [{ code }] } },
          false,
        ),
      ).toEqual({ status: "provider_error" });
    }
  });

  test("isolated lookup: ready, mismatch, not found, provider error", () => {
    const params = { owner: "acme", name: "widget" };
    const ok = resolveProviderResponse(
      params,
      { repositories: [repo("Acme/Widget")] },
      false,
    );
    expect(ok).toMatchObject({
      status: "ready",
      owner: "Acme",
      name: "Widget",
    });
    expect(
      resolveProviderResponse(
        params,
        { repositories: [repo("acme/renamed")] },
        false,
      ),
    ).toEqual({
      status: "identity_mismatch",
      canonicalFullName: "acme/renamed",
    });
    expect(
      resolveProviderResponse(params, { repositories: [] }, false),
    ).toEqual({ status: "not_found" });
    expect(
      resolveProviderResponse(
        params,
        { repositories: [], meta: { sourceFailures: [{ code: "NETWORK" }] } },
        false,
      ),
    ).toEqual({ status: "provider_error" });
    expect(
      resolveProviderResponse(
        params,
        { repositories: [], source: "fallback" },
        false,
      ),
    ).toEqual({ status: "provider_error" });
    expect(resolveProviderResponse(params, undefined, true)).toEqual({
      status: "provider_error",
    });
  });
});

describe("language colours (FR-017)", () => {
  test("known keys map, unknown fall back to neutral", () => {
    expect(languageColor("TypeScript")).toBe("#3178c6");
    expect(languageColor(".MD")).toBe("#94a3b8");
    expect(languageColor("zzz")).toBe(languageColor(null));
  });
});
