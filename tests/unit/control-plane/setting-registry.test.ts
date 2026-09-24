import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PREFERENCE_DEFAULTS } from "../../../src/lib/control-plane/preferences";
import {
  SETTING_REGISTRY,
  type SettingCategory,
} from "../../../src/lib/control-plane/setting-registry";

const byId = (id: string) => SETTING_REGISTRY.find((d) => d.id === id);
const ofCategory = (c: SettingCategory) =>
  SETTING_REGISTRY.filter((d) => d.category === c);

/** Pinned inventory: adding or removing a setting must be a deliberate edit here. */
const EXPECTED_IDS = [
  "pref.autoRotate",
  "pref.showRelationships",
  "ATLAS_DEFAULT_OWNER",
  "ATLAS_MAX_SOURCES",
  "ATLAS_MAX_SPIRAL_REPOS",
  "ATLAS_MAX_STORED_REPOS",
  "ATLAS_CACHE_TTL_MS",
  "ATLAS_LOAD_INITIAL_SOURCES",
  "ATLAS_INITIAL_SOURCES",
  "ATLAS_SQLITE_ENABLED",
  "ATLAS_AI_PROVIDER",
  "VITE_SITE_URL",
  "CODE_INTEL_MAX_R2_CONCURRENCY",
  "CODE_INTEL_CHECKPOINT_FILE_COUNT",
  "CODE_INTEL_CHECKPOINT_CPU_MS_BUDGET",
  "CODE_INTEL_QUEUE_BATCH_SIZE",
  "CODE_INTEL_MAX_RETRY_ATTEMPTS",
  "CODE_INTEL_LIST_FILES_DEFAULT_LIMIT",
  "CODE_INTEL_LIST_FILES_MAX_LIMIT",
  "CODE_INTEL_EXTRACTION_BATCH_SIZE",
  "CODE_INTEL_MAX_FILE_SIZE_BYTES",
  "availability.sqliteLocation",
  "availability.codeIntelDatabase",
  "availability.snapshotStorage",
  "availability.snapshotQueue",
  "availability.symbolQueue",
  "GITHUB_TOKEN",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "XAI_API_KEY",
];

const SENSITIVE_AVAILABILITY_IDS = EXPECTED_IDS.filter((id) =>
  id.startsWith("availability."),
);

describe("setting registry", () => {
  test("inventory is exactly the approved, deterministic list (no silent expansion)", () => {
    expect(SETTING_REGISTRY.map((d) => d.id)).toEqual(EXPECTED_IDS);
  });

  test("ids are unique", () => {
    const ids = SETTING_REGISTRY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("required metadata present and category valid (exactly one)", () => {
    for (const d of SETTING_REGISTRY) {
      expect(["A", "B", "C"]).toContain(d.category);
      expect(["value", "status", "availability"]).toContain(d.display);
      expect(["guest", "deployment-config", "none"]).toContain(
        d.changeMechanism,
      );
      expect(d.id.length).toBeGreaterThan(0);
      expect(d.label.length).toBeGreaterThan(0);
      expect(typeof d.clientVisible).toBe("boolean");
    }
  });

  test("category D has no registry entry (status is a separate read-only view)", () => {
    expect(ofCategory("D")).toHaveLength(0);
  });

  test("category C: status only, never client-visible, no value/default, degradation text, env-backed", () => {
    const secrets = ofCategory("C");
    expect(secrets.map((d) => d.id)).toEqual([
      "GITHUB_TOKEN",
      "GEMINI_API_KEY",
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "XAI_API_KEY",
    ]);
    for (const d of secrets) {
      expect(d.display).toBe("status");
      expect(d.clientVisible).toBe(false);
      expect(d).not.toHaveProperty("default");
      expect(d).not.toHaveProperty("value");
      expect(
        (d as { degradesWhenMissing?: string }).degradesWhenMissing?.length,
      ).toBeGreaterThan(0);
      expect(d.envName).toBe(d.id);
    }
  });

  test("sensitive non-secret items (SQLite location, database, storage, queues) are availability-only", () => {
    expect(SENSITIVE_AVAILABILITY_IDS).toHaveLength(5);
    for (const id of SENSITIVE_AVAILABILITY_IDS) {
      const d = byId(id)!;
      expect(d.display).toBe("availability");
      expect(d.clientVisible).toBe(false);
      expect(d).not.toHaveProperty("default");
      expect(d).not.toHaveProperty("envName");
    }
    // The SQLite path variable itself must never be a value item.
    expect(byId("ATLAS_SQLITE_PATH")).toBeUndefined();
  });

  test("VITE_* ids are client-visible and not secret; only VITE_* (and none other) are client-visible in B/C", () => {
    for (const d of SETTING_REGISTRY) {
      if (d.id.startsWith("VITE_")) {
        expect(d.clientVisible).toBe(true);
        expect(d.category).not.toBe("C");
      } else {
        expect(d.clientVisible).toBe(false);
      }
    }
    expect(byId("VITE_SITE_URL")?.clientVisible).toBe(true);
  });

  test("only category A is guest-changeable; nothing else is writable by this feature", () => {
    for (const d of SETTING_REGISTRY) {
      expect(d.changeMechanism === "guest").toBe(d.category === "A");
    }
    for (const d of [...ofCategory("B"), ...ofCategory("C")]) {
      expect(d.changeMechanism).toBe("deployment-config");
    }
  });

  test("category A defaults come from PREFERENCE_DEFAULTS", () => {
    expect((byId("pref.autoRotate") as { default: boolean }).default).toBe(
      PREFERENCE_DEFAULTS.autoRotate,
    );
    expect(
      (byId("pref.showRelationships") as { default: boolean }).default,
    ).toBe(PREFERENCE_DEFAULTS.showRelationships);
    for (const d of SETTING_REGISTRY) {
      if (d.category !== "A") expect(d).not.toHaveProperty("default");
    }
  });

  test("Feature 004/005 relationship settings are excluded", () => {
    expect(
      SETTING_REGISTRY.some((d) =>
        /^CODE_INTEL_RELATIONSHIP_|EXTRACTOR_VERSION/.test(d.id),
      ),
    ).toBe(false);
  });

  test("every CODE_INTEL_* entry is a tunable exported by the code-intel config", async () => {
    const config =
      (await import("../../../src/lib/code-intel/config")) as Record<
        string,
        unknown
      >;
    for (const d of SETTING_REGISTRY.filter((x) =>
      x.id.startsWith("CODE_INTEL_"),
    )) {
      expect(typeof config[d.id]).toBe("number");
    }
  });
});

describe(".env.example drift", () => {
  const declared = readFileSync(
    new URL("../../../.env.example", import.meta.url),
    "utf8",
  )
    .split("\n")
    .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
    .filter((n): n is string => Boolean(n));

  test("parses declared names", () => {
    expect(declared.length).toBeGreaterThan(5);
  });

  test("every declared VITE_* name is registered as client-visible non-secret", () => {
    for (const name of declared.filter((n) => n.startsWith("VITE_"))) {
      const d = byId(name);
      expect(d).toBeDefined();
      expect(d?.clientVisible).toBe(true);
      expect(d?.category).not.toBe("C");
    }
  });

  test("every declared *_API_KEY and GITHUB_TOKEN is registered as category C", () => {
    for (const name of declared.filter(
      (n) => n.endsWith("_API_KEY") || n === "GITHUB_TOKEN",
    )) {
      const d = byId(name);
      expect(d).toBeDefined();
      expect(d?.category).toBe("C");
      expect(d?.clientVisible).toBe(false);
    }
  });

  test("declared ATLAS_SQLITE_PATH is never displayed as a value", () => {
    expect(declared).toContain("ATLAS_SQLITE_PATH");
    expect(byId("ATLAS_SQLITE_PATH")).toBeUndefined();
  });
});
