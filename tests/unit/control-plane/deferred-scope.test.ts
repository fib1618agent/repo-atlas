import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * T026: guards the scope the spec defers (spec.md Non-Goals; tasks.md T026).
 * Each assertion maps to a written Non-Goal, not to incidental structure.
 */

const ROOT = resolve(import.meta.dir, "../../..");
const list = (dir: string) =>
  readdirSync(join(ROOT, dir)).map((f) => join(ROOT, dir, f));
const read = (abs: string) => readFileSync(abs, "utf8");
const rel = (abs: string) => relative(ROOT, abs);

const CONTROL_PLANE = list("src/lib/control-plane");
const COMPONENTS = list("src/components/settings");
const ROUTE = join(ROOT, "src/routes/settings.tsx");
const ALL_F006 = [...CONTROL_PLANE, ...COMPONENTS, ROUTE];
const FUNCTIONS = join(
  ROOT,
  "src/lib/control-plane/control-plane.functions.ts",
);
const PREFERENCES = join(ROOT, "src/lib/control-plane/preferences.ts");
const byName = (name: string) => COMPONENTS.find((f) => f.endsWith(name))!;

function exportedNames(source: string): string[] {
  return [
    ...source.matchAll(
      /^export\s+(?:async\s+)?(?:function|const|class|let)\s+([A-Za-z0-9_]+)/gm,
    ),
  ].map((m) => m[1]!);
}

describe("deferred scope: no runtime actions, no operator configuration editing (Non-Goals 2, 3)", () => {
  test("control-plane.functions.ts exports exactly the two read-only server functions and their handlers", () => {
    expect(exportedNames(read(FUNCTIONS)).sort()).toEqual(
      [
        "getCodeIntelStatus",
        "getCodeIntelStatusHandler",
        "getConfiguration",
        "getConfigurationHandler",
      ].sort(),
    );
    expect(
      read(FUNCTIONS).match(/createServerFn\(\{ method: "POST" \}\)/g),
    ).toHaveLength(2);
    expect(
      read(FUNCTIONS).match(/\.validator\(\(\) => undefined\)/g),
    ).toHaveLength(2);
  });

  test("no exported action-style function exists in src/lib/control-plane (only the category-A storage helpers)", () => {
    const action =
      /^(set|write|save|update|delete|remove|start|pause|resume|retry|clear|reset|rerun|run|index|extract|enqueue|apply|persist|configure)/i;
    for (const file of CONTROL_PLANE.filter((f) => f !== PREFERENCES)) {
      for (const name of exportedNames(read(file)))
        expect(`${rel(file)}:${name}`).not.toMatch(
          new RegExp(`:${action.source}`, "i"),
        );
    }
    // The only writers live in preferences.ts and are for the two category-A preferences.
    const prefExports = exportedNames(read(PREFERENCES));
    expect(prefExports.filter((n) => action.test(n)).sort()).toEqual([
      "configurePreferenceStorage",
      "writeStoredPreferences",
    ]);
  });

  test("server-side status and configuration modules never write: no mutating SQL, no queue send, no env writes", () => {
    for (const file of [
      join(ROOT, "src/lib/control-plane/code-intel-status.ts"),
      join(ROOT, "src/lib/control-plane/configuration-collector.ts"),
      join(ROOT, "src/lib/control-plane/configuration-read-model.ts"),
      FUNCTIONS,
    ]) {
      const src = read(file);
      expect(src).not.toMatch(
        /\b(INSERT|UPDATE|DELETE|DROP|ALTER)\s+(INTO|FROM|TABLE|\w+\s+SET)\b/i,
      );
      expect(src).not.toMatch(
        /\.send\(|\.sendBatch\(|process\.env\[[^\]]+\]\s*=|writeFile|\.run\(/,
      );
    }
  });

  test("no editing controls for configuration, secrets or CODE_INTEL_* anywhere in the settings UI", () => {
    for (const file of [...COMPONENTS, ROUTE]) {
      const src = read(file);
      expect(src).not.toMatch(
        /<Input\b|<input\b|<Textarea\b|<textarea\b|<Select\b|type="password"|<form\b/,
      );
    }
  });

  test("settings UI has no start/pause/retry-processing/clear/re-run/index controls", () => {
    for (const file of [...COMPONENTS, ROUTE]) {
      const jsxText = [
        ...read(file).matchAll(/>\s*([A-Z][A-Za-z\- ]{2,40})\s*</g),
      ].map((m) => m[1]!);
      for (const text of jsxText)
        expect(text).not.toMatch(
          /^(Start|Pause|Resume|Clear|Re-?run|Re-?index|Index|Extract|Rebuild|Save|Apply)\b/i,
        );
    }
  });

  test("state-changing controls exist only in PreferencesSection; the one Retry is a data refetch", () => {
    for (const file of COMPONENTS) {
      const src = read(file);
      const changes = /onClick=|onCheckedChange=|<Switch\b/.test(src);
      if (file === byName("PreferencesSection.tsx")) {
        expect(src.match(/<Switch\b/g)).toHaveLength(2);
        expect(src.match(/onClick=/g)).toHaveLength(1);
        expect(src).toContain("resetPreferences()");
      } else if (file === byName("ConfigurationSection.tsx")) {
        expect(src.match(/onClick=/g)).toHaveLength(1);
        expect(src).toMatch(/onClick=\{\(\) => void query\.refetch\(\)\}/);
        expect(src).not.toMatch(/<Switch\b|onCheckedChange=/);
      } else {
        expect(changes).toBe(false);
      }
    }
  });

  test("preferences are limited to autoRotate and showRelationships", () => {
    const src = read(PREFERENCES);
    expect(src).toContain(
      'PREFERENCE_KEYS = ["autoRotate", "showRelationships"]',
    );
  });

  test("browser storage is used only by preferences.ts", () => {
    for (const file of ALL_F006.filter((f) => f !== PREFERENCES)) {
      expect(read(file)).not.toMatch(
        /\b(localStorage|sessionStorage|indexedDB)\b/,
      );
    }
  });
});

describe("deferred scope: identity, protocols, relationships, Sources (Non-Goals 1, 4, 7, 12)", () => {
  test("no authentication, roles, RBAC or user management in Feature 006 files", () => {
    for (const file of ALL_F006) {
      expect(read(file)).not.toMatch(
        /\b(rbac|useAuth|signIn|signOut|oauth|sessionToken|isAdmin|userRole)\b|Authorization:/i,
      );
    }
  });

  test("no MCP or CLI implementation files or imports in Feature 006", () => {
    for (const file of ALL_F006) {
      expect(rel(file)).not.toMatch(/mcp|cli/i);
      expect(read(file)).not.toMatch(
        /@modelcontextprotocol|from "commander"|from "yargs"|process\.argv/,
      );
    }
  });

  test("no relationship-graph or per-snapshot browsing in Feature 006", () => {
    for (const file of ALL_F006) {
      const src = read(file);
      expect(src).not.toMatch(
        /code-intel\/relationships|RELATIONSHIP_EXTRACTOR_VERSION|CODE_INTEL_RELATIONSHIP/,
      );
    }
    const status = read(
      join(ROOT, "src/lib/control-plane/code-intel-status.ts"),
    );
    expect(status.match(/\.prepare\(/g)).toHaveLength(2);
    expect(status).not.toMatch(
      /snapshot_files|symbols\b|file_extractions|repositories|LIMIT|OFFSET/i,
    );
  });

  test("the Sources UI and stores are neither imported nor duplicated by the settings surface", () => {
    for (const file of [...COMPONENTS, ROUTE]) {
      expect(read(file)).not.toMatch(
        /SourcesDialog|SourcesMenu|ConnectedSourcesDialog|sources-store|source-input-mode/,
      );
    }
    for (const file of ALL_F006) {
      expect(rel(file)).not.toMatch(/sources/i);
    }
  });

  test("no deployment or resource-management operations (Cloudflare API, wrangler, remote calls)", () => {
    for (const file of ALL_F006) {
      const src = read(file);
      expect(src).not.toMatch(
        /wrangler|api\.cloudflare\.com|\bfetch\(|child_process/,
      );
    }
  });
});
