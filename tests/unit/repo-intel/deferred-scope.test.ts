import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../../../", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), "utf8");
const sources = (dir: string) =>
  readdirSync(new URL(dir, root)).map((f) => ({
    file: `${dir}${f}`,
    text: read(`${dir}${f}`),
  }));

const LIB = sources("src/lib/repo-intel/");
const COMPONENTS = sources("src/components/repo-intel/");
const ROUTE = [
  {
    file: "src/routes/repository.$owner.$name.tsx",
    text: read("src/routes/repository.$owner.$name.tsx"),
  },
];
const ALL = [...LIB, ...COMPONENTS, ...ROUTE];

describe("Feature 009 scope guards (FR-008, FR-009, FR-010, FR-016, FR-018, SC-002)", () => {
  test("relationship type names appear only as type imports, never as displayed data", () => {
    const TOKENS =
      /\b(IMPORTS|CALLS|EXTENDS|IMPLEMENTS|USES|REFERENCES|EXPORTS)\b/;
    for (const { file, text } of ALL) {
      if (file.endsWith("relationship-layer.ts")) continue;
      // comments may describe the boundary; code and copy may not
      const code = text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect({ file, hit: TOKENS.test(code) }).toEqual({ file, hit: false });
    }
  });

  test("the read model issues only SELECT statements (no write verbs, no .run)", () => {
    const text = LIB.find((f) =>
      f.file.endsWith("intelligence-read-model.ts"),
    )!.text;
    const code = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const sqlStrings = [...code.matchAll(/`([^`]*)`|"([^"\n]*)"/g)]
      .map((m) => m[1] ?? m[2] ?? "")
      .filter(
        (s) =>
          /\bSELECT\b/i.test(s) ||
          /\b(INSERT|UPDATE|DELETE|REPLACE)\b\s/i.test(s),
      );
    expect(sqlStrings.length).toBeGreaterThan(5);
    for (const s of sqlStrings) {
      expect(s.trimStart().toUpperCase().startsWith("SELECT")).toBe(true);
      expect(
        /\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|CREATE|PRAGMA)\b/i.test(s),
      ).toBe(false);
    }
    expect(code).not.toMatch(/\.run\s*[<(]/);
  });

  test("no acquisition, queue, history-write or store-setter usage", () => {
    const FORBIDDEN =
      /acquireSnapshot|extractSnapshotSymbols|getRepositoryHistory|getSnapshotQueue|getSymbolQueue|\.send\(|setLoaded|resetToDefault|setDialogOpen|toggleAutoRotate|toggleRelationships|resetFilters|resetPreferences/;
    for (const { file, text } of ALL) {
      expect({ file, hit: FORBIDDEN.test(text) }).toEqual({ file, hit: false });
    }
  });

  test("no runtime import from Feature 004 code, no new dependency, no repo-specific literals", () => {
    for (const { file, text } of ALL) {
      expect(text).not.toMatch(/from\s+["'][^"']*code-intel\/relationships\//);
      expect({
        file,
        hit: /repo-atlas|imdadareeph|fib1618agent/.test(text),
      }).toEqual({ file, hit: false });
    }
    const pkg = JSON.parse(read("package.json")) as {
      dependencies: Record<string, string>;
    };
    for (const name of Object.keys(pkg.dependencies)) {
      expect(
        /^(d3|cytoscape|sigma|vis-network|graphology|neo4j|kuzu)/.test(name),
      ).toBe(false);
    }
  });

  test("the map component draws no edge primitives and never animates continuously", () => {
    const map = COMPONENTS.find((f) =>
      f.file.endsWith("StructureMap.tsx"),
    )!.text;
    expect(map).not.toMatch(
      /<line\b|<path\b|<polyline\b|requestAnimationFrame|useFrame/,
    );
  });
});
