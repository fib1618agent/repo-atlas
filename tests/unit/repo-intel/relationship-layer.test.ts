import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import {
  deriveSymbolsState,
  type ExtractionSummary,
} from "../../../src/lib/repo-intel/states";
import {
  UNAVAILABLE_RELATIONSHIP_STATE,
  unavailableRelationshipLayer,
} from "../../../src/lib/repo-intel/relationship-layer";

const ext = (over: Partial<ExtractionSummary>): ExtractionSummary => ({
  status: "completed",
  extractorVersion: "v2",
  filesTotal: 1,
  filesExtracted: 1,
  filesSkippedUnsupported: 0,
  filesFailed: 0,
  symbolsExtracted: 3,
  ...over,
});

describe("relationship layer boundary (FR-009)", () => {
  test("the only implementation is unavailable and performs no I/O", async () => {
    const state = await unavailableRelationshipLayer.getState({
      owner: "o",
      name: "n",
      snapshotId: 1,
    });
    expect(state).toEqual({
      status: "unavailable",
      reason: "not_connected",
      feature: "004",
    });
    expect(state).toBe(UNAVAILABLE_RELATIONSHIP_STATE);
  });

  test("no runtime import from Feature 004 code anywhere in repo-intel", () => {
    const dir = new URL("../../../src/lib/repo-intel/", import.meta.url);
    for (const file of readdirSync(dir)) {
      const src = readFileSync(new URL(file, dir), "utf8");
      expect(src).not.toMatch(/from\s+["'][^"']*code-intel\/relationships\//);
      for (const line of src.split("\n")) {
        if (/^import\b/.test(line) && line.includes("domain/relationship")) {
          expect(line.startsWith("import type")).toBe(true);
        }
      }
    }
  });
});

describe("deriveSymbolsState (FR-011)", () => {
  test("maps every extraction status", () => {
    expect(
      deriveSymbolsState(ext({ status: "not_started", symbolsExtracted: 0 })),
    ).toBe("not_extracted");
    expect(deriveSymbolsState(ext({ status: "in_progress" }))).toBe("partial");
    expect(deriveSymbolsState(ext({ status: "completed_partial" }))).toBe(
      "partial",
    );
    expect(deriveSymbolsState(ext({ status: "failed" }))).toBe("partial");
    expect(
      deriveSymbolsState(ext({ status: "completed", symbolsExtracted: 0 })),
    ).toBe("empty");
    expect(deriveSymbolsState(ext({ status: "completed" }))).toBe("available");
  });
});
