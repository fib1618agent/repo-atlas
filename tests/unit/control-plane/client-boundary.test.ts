import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * T025: the Settings client boundary. Client code may runtime-import the
 * `control-plane.functions.ts` server-function wrapper (the framework strips its
 * server body from the client bundle) and may only `import type` from the
 * server-only DTO modules. Nothing else server-side may be reachable at runtime.
 */

const ROOT = resolve(import.meta.dir, "../../..");
const SRC = join(ROOT, "src");
const rel = (abs: string) => relative(ROOT, abs);

const CLIENT_ENTRIES = [
  ...readdirSync(join(SRC, "components/settings")).map((f) =>
    join(SRC, "components/settings", f),
  ),
  join(SRC, "routes/settings.tsx"),
  join(SRC, "lib/control-plane/setting-registry.ts"),
  join(SRC, "lib/control-plane/preferences.ts"),
];

/** The server-function wrapper file: a legitimate runtime import whose body is server-only. Not traversed. */
const SERVER_FN_WRAPPER = join(
  SRC,
  "lib/control-plane/control-plane.functions.ts",
);

/** Server-only implementation modules that must never be reachable from client code at runtime. */
const FORBIDDEN = [
  "src/lib/control-plane/configuration-collector.ts",
  "src/lib/control-plane/code-intel-status.ts",
  "src/lib/code-intel/persistence/cloudflare-env.ts",
  "src/lib/code-intel/persistence/d1-client.ts",
  "src/lib/code-intel/config.ts",
  "src/lib/ai/providers.ts",
  "src/lib/storage/atlas-store.ts",
];

type Import = { spec: string; typeOnly: boolean };

function parseImports(source: string): Import[] {
  const out: Import[] = [];
  for (const m of source.matchAll(
    /^\s*import\s+(type\s+)?(?:[^;]*?\sfrom\s+)?["']([^"']+)["']/gm,
  )) {
    out.push({ spec: m[2]!, typeOnly: Boolean(m[1]) });
  }
  for (const m of source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g))
    out.push({ spec: m[1]!, typeOnly: false });
  return out;
}

function resolveSpec(from: string, spec: string): string | undefined {
  const base = spec.startsWith("@/")
    ? join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : undefined;
  if (!base) return undefined; // package import
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (
      existsSync(candidate) &&
      !candidate.endsWith("/") &&
      /\.(ts|tsx)$/.test(candidate)
    )
      return candidate;
  }
  return undefined;
}

/** Runtime import closure; `import type` edges are skipped, the server-fn wrapper is terminal. */
function runtimeClosure(entries: string[]): {
  files: Set<string>;
  edges: Map<string, string[]>;
} {
  const files = new Set<string>();
  const edges = new Map<string, string[]>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    if (file === SERVER_FN_WRAPPER) continue;
    const deps: string[] = [];
    for (const imp of parseImports(readFileSync(file, "utf8"))) {
      if (imp.typeOnly) continue;
      const target = resolveSpec(file, imp.spec);
      if (target) {
        deps.push(target);
        queue.push(target);
      }
    }
    edges.set(file, deps);
  }
  return { files, edges };
}

describe("Settings client boundary (T025)", () => {
  const { files, edges } = runtimeClosure(CLIENT_ENTRIES);
  const closureNames = [...files].map(rel);

  test("closure discovery is meaningful (finds the wrapper and the registry)", () => {
    expect(closureNames).toContain(
      "src/lib/control-plane/control-plane.functions.ts",
    );
    expect(closureNames).toContain("src/lib/control-plane/setting-registry.ts");
    expect(closureNames).toContain("src/lib/atlas-store.ts");
  });

  test("no server-only implementation module is reachable from client code at runtime", () => {
    for (const forbidden of FORBIDDEN)
      expect(closureNames).not.toContain(forbidden);
  });

  test("the only Feature 006 server-side module in the closure is the server-function wrapper", () => {
    const serverSide = closureNames.filter((f) =>
      f.startsWith("src/lib/control-plane/"),
    );
    expect(serverSide.sort()).toEqual(
      [
        "src/lib/control-plane/control-plane.functions.ts",
        "src/lib/control-plane/preferences.ts",
        "src/lib/control-plane/setting-registry.ts",
      ].sort(),
    );
  });

  test("no client-reachable file (beyond the terminal wrapper) reads process.env", () => {
    for (const f of files) {
      if (f === SERVER_FN_WRAPPER) continue;
      expect(readFileSync(f, "utf8")).not.toContain("process.env");
    }
  });

  test("components import the wrapper at runtime and the DTO modules only with `import type`", () => {
    for (const file of CLIENT_ENTRIES.filter(
      (f) =>
        f.includes("components/settings") || f.endsWith("routes/settings.tsx"),
    )) {
      for (const imp of parseImports(readFileSync(file, "utf8"))) {
        if (/configuration-read-model|code-intel-status/.test(imp.spec)) {
          expect(imp.typeOnly).toBe(true);
        }
        expect(imp.spec).not.toMatch(
          /configuration-collector|cloudflare-env|persistence\//,
        );
      }
    }
    const runtimeWrapperImporters = CLIENT_ENTRIES.filter((f) =>
      parseImports(readFileSync(f, "utf8")).some(
        (i) => !i.typeOnly && /control-plane\.functions/.test(i.spec),
      ),
    ).map(rel);
    expect(runtimeWrapperImporters.sort()).toEqual(
      [
        "src/components/settings/CodeIntelStatusSection.tsx",
        "src/components/settings/ConfigurationSection.tsx",
      ].sort(),
    );
  });

  test("the registry (shipped to the browser) carries names and rules only: no env reads, no values", () => {
    const reg = readFileSync(
      join(SRC, "lib/control-plane/setting-registry.ts"),
      "utf8",
    );
    expect(reg).not.toMatch(
      /process\.|import\.meta\.env|window|localStorage|getCloudflareEnv/,
    );
    expect(
      edges.get(join(SRC, "lib/control-plane/setting-registry.ts"))?.map(rel),
    ).toEqual(["src/lib/control-plane/preferences.ts"]);
  });

  test("server-function wrapper exposes no-input functions only (no arguments reach the collector)", () => {
    const src = readFileSync(SERVER_FN_WRAPPER, "utf8");
    expect(src.match(/\.validator\(\(\) => undefined\)/g)).toHaveLength(2);
  });
});
