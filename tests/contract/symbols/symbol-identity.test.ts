import { describe, expect, test } from "bun:test";
import { computeSymbolKey } from "../../../src/lib/code-intel/symbols/symbol-identity";

/**
 * FR-008, FR-013 (spec.md) — deterministic, snapshot-scoped symbol identity.
 * `symbol_key` = SHA-256 hex of `${snapshotId} ${filePath} ${kind} ${qualifiedNameOrName}
 * ${startLine} ${startColumn}` (data-model.md, Symbol entity — "Deterministic
 * snapshot-scoped identity"). This test only exercises that contract; it does
 * not invent any additional identity semantics.
 */

const BASE: {
  snapshotId: number;
  filePath: string;
  kind: string;
  name: string;
  startLine: number;
  startColumn: number;
} = {
  snapshotId: 1,
  filePath: "src/Foo.ts",
  kind: "class",
  name: "Foo",
  startLine: 3,
  startColumn: 0,
};

function key(overrides: Partial<typeof BASE> = {}) {
  const v = { ...BASE, ...overrides };
  return computeSymbolKey(v.snapshotId, v.filePath, v.kind, v.name, v.startLine, v.startColumn);
}

describe("computeSymbolKey (FR-008, FR-013)", () => {
  test("identical inputs produce the identical key, every time", () => {
    const first = key();
    const second = key();
    const third = key();
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  test("is a SHA-256 hex digest (data-model.md: 'SHA-256 hex digest of a canonical string')", () => {
    expect(key()).toMatch(/^[0-9a-f]{64}$/);
  });

  test("changing snapshotId changes the key", () => {
    expect(key({ snapshotId: 1 })).not.toBe(key({ snapshotId: 2 }));
  });

  test("changing filePath changes the key", () => {
    expect(key({ filePath: "src/Foo.ts" })).not.toBe(key({ filePath: "src/Bar.ts" }));
  });

  test("changing symbol kind changes the key", () => {
    expect(key({ kind: "class" })).not.toBe(key({ kind: "interface" }));
  });

  test("changing symbol name (or qualified name) changes the key", () => {
    expect(key({ name: "Foo" })).not.toBe(key({ name: "Bar" }));
  });

  test("changing start line (source position) changes the key", () => {
    expect(key({ startLine: 3 })).not.toBe(key({ startLine: 4 }));
  });

  test("changing start column (source position) changes the key", () => {
    expect(key({ startColumn: 0 })).not.toBe(key({ startColumn: 5 }));
  });
});
