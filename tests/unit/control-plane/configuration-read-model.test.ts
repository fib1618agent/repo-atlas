import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
  ATLAS_CACHE_TTL_MS,
  ATLAS_DEFAULT_OWNER,
  ATLAS_MAX_SOURCES,
  serverAtlasConfig,
} from "../../../src/lib/atlas-config";
import { getConfigurationHandler } from "../../../src/lib/control-plane/control-plane.functions";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import {
  buildConfiguration,
  type ConfigurationInputs,
  type ConfigurationItem,
  type ValueItem,
} from "../../../src/lib/control-plane/configuration-read-model";
import {
  collectConfigurationInputs,
  getConfigurationView,
} from "../../../src/lib/control-plane/configuration-collector";
import { SETTING_REGISTRY } from "../../../src/lib/control-plane/setting-registry";

const NOW = new Date("2026-01-01T00:00:00.000Z");

const ENV_KEYS = [
  ...SETTING_REGISTRY.flatMap((d) =>
    d.category === "A"
      ? []
      : d.category === "B" && d.display === "availability"
        ? []
        : [d.id],
  ),
  "ATLAS_SQLITE_PATH",
  "NITRO_PRESET",
  "CF_PAGES",
  "SENTINEL_UNLISTED_VAR",
];
let saved: Record<string, string | undefined>;
let warn: ReturnType<typeof spyOn>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  setTestCloudflareEnv(undefined);
  warn = spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  setTestCloudflareEnv(undefined);
  warn.mockRestore();
});

const item = (id: string, now = NOW): ConfigurationItem => {
  const found = getConfigurationView(now).items.find((i) => i.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};
const valueItem = (id: string) => item(id) as ValueItem;

describe("buildConfiguration (pure)", () => {
  const empty: ConfigurationInputs = {
    values: {},
    availability: {},
    secrets: {},
  };

  test("emits only registry entries, skips category A, deterministic for a fixed clock", () => {
    const a = buildConfiguration(SETTING_REGISTRY, empty, NOW);
    const b = buildConfiguration(SETTING_REGISTRY, empty, NOW);
    expect(a).toEqual(b);
    expect(a.generatedAt).toBe(NOW.toISOString());
    expect(a.items.map((i) => i.id)).toEqual(
      SETTING_REGISTRY.filter((d) => d.category !== "A").map((d) => d.id),
    );
    expect(a.items.some((i) => i.id.startsWith("pref."))).toBe(false);
  });

  test("valid / unset-with-default / unset-without-default / invalid", () => {
    const registry = SETTING_REGISTRY.filter((d) =>
      [
        "ATLAS_MAX_SOURCES",
        "ATLAS_MAX_SPIRAL_REPOS",
        "VITE_SITE_URL",
        "ATLAS_CACHE_TTL_MS",
      ].includes(d.id),
    );
    const { items } = buildConfiguration(
      registry,
      {
        secrets: {},
        availability: {},
        values: {
          ATLAS_MAX_SOURCES: { configured: true, effective: 9, default: 5 },
          ATLAS_MAX_SPIRAL_REPOS: {
            configured: false,
            effective: 800,
            default: 800,
          },
          VITE_SITE_URL: { configured: false },
          ATLAS_CACHE_TTL_MS: {
            configured: true,
            effective: NaN,
            default: 900000,
          },
        },
      },
      NOW,
    );
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId["ATLAS_MAX_SOURCES"]).toMatchObject({
      state: "valid",
      value: 9,
      default: 5,
      isDefault: false,
    });
    expect(byId["ATLAS_MAX_SPIRAL_REPOS"]).toMatchObject({
      state: "unset",
      value: 800,
      default: 800,
      isDefault: true,
    });
    expect(byId["VITE_SITE_URL"]).toMatchObject({
      state: "unset",
      isDefault: true,
      clientVisible: true,
    });
    expect(byId["VITE_SITE_URL"]).not.toHaveProperty("value");
    expect(byId["VITE_SITE_URL"]).not.toHaveProperty("default");
    expect(byId["ATLAS_CACHE_TTL_MS"]).toMatchObject({
      state: "invalid",
      default: 900000,
    });
    expect(byId["ATLAS_CACHE_TTL_MS"]).not.toHaveProperty("value");
    expect(byId["ATLAS_CACHE_TTL_MS"]).not.toHaveProperty("isDefault");
  });

  test("Infinity and missing collector input are invalid, never a fabricated value", () => {
    const registry = SETTING_REGISTRY.filter((d) =>
      ["ATLAS_MAX_SOURCES", "ATLAS_MAX_STORED_REPOS"].includes(d.id),
    );
    const { items } = buildConfiguration(
      registry,
      {
        secrets: {},
        availability: {},
        values: {
          ATLAS_MAX_SOURCES: {
            configured: true,
            effective: Infinity,
            default: 5,
          },
        },
      },
      NOW,
    );
    for (const i of items) {
      expect(i).toMatchObject({ state: "invalid" });
      expect(i).not.toHaveProperty("value");
    }
    expect(JSON.stringify(items)).not.toContain("null");
  });

  test("secret and availability items have no value-bearing field", () => {
    const { items } = buildConfiguration(
      SETTING_REGISTRY,
      { ...empty, secrets: { GITHUB_TOKEN: true } },
      NOW,
    );
    const secret = items.find((i) => i.id === "GITHUB_TOKEN")!;
    expect(Object.keys(secret).sort()).toEqual([
      "category",
      "degradesWhenMissing",
      "display",
      "id",
      "label",
      "status",
    ]);
    expect(secret).toMatchObject({ status: "configured" });
    expect(items.find((i) => i.id === "GEMINI_API_KEY")).toMatchObject({
      status: "not_configured",
    });
    for (const id of [
      "availability.sqliteLocation",
      "availability.codeIntelDatabase",
    ]) {
      const a = items.find((i) => i.id === id)!;
      expect(Object.keys(a).sort()).toEqual([
        "availability",
        "category",
        "display",
        "id",
        "label",
        "reason",
      ]);
    }
  });
});

describe("getConfigurationView (server collection, existing behavior is authoritative)", () => {
  test("nothing set: numerics unset with the real defaults; VITE_SITE_URL Not set", () => {
    expect(valueItem("ATLAS_MAX_SOURCES")).toMatchObject({
      state: "unset",
      value: ATLAS_MAX_SOURCES,
      isDefault: true,
    });
    expect(valueItem("ATLAS_CACHE_TTL_MS")).toMatchObject({
      state: "unset",
      value: ATLAS_CACHE_TTL_MS,
    });
    expect(valueItem("ATLAS_DEFAULT_OWNER")).toMatchObject({
      state: "unset",
      value: ATLAS_DEFAULT_OWNER,
    });
    expect(valueItem("VITE_SITE_URL")).toMatchObject({
      state: "unset",
      clientVisible: true,
    });
    expect(valueItem("VITE_SITE_URL")).not.toHaveProperty("value");
    expect(valueItem("ATLAS_LOAD_INITIAL_SOURCES")).toMatchObject({
      state: "unset",
      value: true,
    });
  });

  test("valid override reports the value actually used; isDefault reflects equality with the default", () => {
    process.env["ATLAS_MAX_SOURCES"] = "9";
    process.env["ATLAS_MAX_STORED_REPOS"] = "2000";
    expect(valueItem("ATLAS_MAX_SOURCES")).toMatchObject({
      state: "valid",
      value: 9,
      default: ATLAS_MAX_SOURCES,
      isDefault: false,
    });
    expect(valueItem("ATLAS_MAX_STORED_REPOS")).toMatchObject({
      state: "valid",
      value: 2000,
      isDefault: true,
    });
  });

  test("invalid numeric: no value, no fabricated fallback, existing behavior still yields NaN", () => {
    process.env["ATLAS_MAX_SOURCES"] = "abc";
    const v = valueItem("ATLAS_MAX_SOURCES");
    expect(v.state).toBe("invalid");
    expect(v).not.toHaveProperty("value");
    expect(v).not.toHaveProperty("isDefault");
    expect(Number.isNaN(serverAtlasConfig().maxSources)).toBe(true);
    // Every serialized item must remain JSON-safe (no NaN -> null).
    expect(JSON.stringify(getConfigurationView(NOW))).not.toContain("null");
  });

  test("invalid code-intel numeric is reported the same way", () => {
    process.env["CODE_INTEL_QUEUE_BATCH_SIZE"] = "nope";
    expect(valueItem("CODE_INTEL_QUEUE_BATCH_SIZE").state).toBe("invalid");
    delete process.env["CODE_INTEL_QUEUE_BATCH_SIZE"];
  });

  test("AI provider: unrecognized value -> provider actually used plus flag", () => {
    process.env["ATLAS_AI_PROVIDER"] = "nope";
    expect(valueItem("ATLAS_AI_PROVIDER")).toMatchObject({
      state: "valid",
      value: "gemini",
      flag: "unrecognized",
    });
    process.env["ATLAS_AI_PROVIDER"] = "openai";
    const ok = valueItem("ATLAS_AI_PROVIDER");
    expect(ok).toMatchObject({ state: "valid", value: "openai" });
    expect(ok).not.toHaveProperty("flag");
  });

  test("AI provider unset: default is the provider in use", () => {
    expect(valueItem("ATLAS_AI_PROVIDER")).toMatchObject({
      state: "unset",
      isDefault: true,
      value: "gemini",
    });
  });

  test("ATLAS_INITIAL_SOURCES: invalid JSON, wrong shape and skipped entries are flagged; used list is shown", () => {
    process.env["ATLAS_INITIAL_SOURCES"] = "{not json";
    expect(valueItem("ATLAS_INITIAL_SOURCES")).toMatchObject({
      state: "valid",
      value: [{ type: "github", owner: ATLAS_DEFAULT_OWNER }],
      flag: "unrecognized",
    });
    process.env["ATLAS_INITIAL_SOURCES"] = JSON.stringify([
      { type: "github", owner: "a" },
      { type: "gitlab", owner: "b" },
    ]);
    expect(valueItem("ATLAS_INITIAL_SOURCES")).toMatchObject({
      value: [{ type: "github", owner: "a" }],
      flag: "unrecognized",
    });
    process.env["ATLAS_INITIAL_SOURCES"] = JSON.stringify([
      { type: "github", owner: "a" },
    ]);
    expect(valueItem("ATLAS_INITIAL_SOURCES")).not.toHaveProperty("flag");
  });

  test("boolean switches: 'false' honored; other defined values are treated as on and flagged", () => {
    process.env["ATLAS_LOAD_INITIAL_SOURCES"] = "false";
    expect(valueItem("ATLAS_LOAD_INITIAL_SOURCES")).toMatchObject({
      state: "valid",
      value: false,
    });
    expect(valueItem("ATLAS_LOAD_INITIAL_SOURCES")).not.toHaveProperty("flag");
    process.env["ATLAS_LOAD_INITIAL_SOURCES"] = "0";
    expect(valueItem("ATLAS_LOAD_INITIAL_SOURCES")).toMatchObject({
      value: true,
      flag: "unrecognized",
    });
  });

  test("availability comes from presence only; SQLite path and binding ids never appear", () => {
    process.env["ATLAS_SQLITE_PATH"] = "/secret/sentinel/path.sqlite";
    setTestCloudflareEnv({ DB: {} as never, SNAPSHOT_QUEUE: {} as never });
    const view = getConfigurationView(NOW);
    const get = (id: string) => view.items.find((i) => i.id === id);
    expect(get("availability.codeIntelDatabase")).toMatchObject({
      availability: "available",
    });
    expect(get("availability.snapshotQueue")).toMatchObject({
      availability: "available",
    });
    expect(get("availability.snapshotStorage")).toMatchObject({
      availability: "unavailable",
      reason: "no_binding",
    });
    expect(get("availability.symbolQueue")).toMatchObject({
      availability: "unavailable",
      reason: "no_binding",
    });
    expect(JSON.stringify(view)).not.toContain("sentinel");
    process.env["ATLAS_SQLITE_ENABLED"] = "false";
    expect(
      getConfigurationView(NOW).items.find(
        (i) => i.id === "availability.sqliteLocation",
      ),
    ).toMatchObject({
      availability: "unavailable",
      reason: "disabled_by_configuration",
    });
  });

  test("secrets reduce to configured / not_configured; the value is absent from inputs and view", () => {
    process.env["GEMINI_API_KEY"] = "SENTINEL-GEMINI-KEY";
    process.env["GITHUB_TOKEN"] = "SENTINEL-GH-TOKEN";
    const inputs = collectConfigurationInputs();
    expect(inputs.secrets["GEMINI_API_KEY"]).toBe(true);
    expect(inputs.secrets["GITHUB_TOKEN"]).toBe(true);
    expect(inputs.secrets["OPENAI_API_KEY"]).toBe(false);
    expect(JSON.stringify(inputs)).not.toContain("SENTINEL");
    expect(JSON.stringify(getConfigurationView(NOW))).not.toContain("SENTINEL");
    expect(item("GEMINI_API_KEY")).toMatchObject({ status: "configured" });
    expect(item("OPENAI_API_KEY")).toMatchObject({ status: "not_configured" });
  });

  test("only registry ids appear; unlisted env vars and other categories are never emitted", () => {
    process.env["SENTINEL_UNLISTED_VAR"] = "SENTINEL-UNLISTED";
    const view = getConfigurationView(NOW);
    expect(JSON.stringify(view)).not.toContain("SENTINEL");
    const allowed = new Set(SETTING_REGISTRY.map((d) => d.id));
    expect(view.items.every((i) => allowed.has(i.id))).toBe(true);
    expect(view.items.every((i) => i.category !== ("A" as string))).toBe(true);
  });

  test("view is deterministic for a fixed clock and never throws for broken configuration", () => {
    process.env["ATLAS_MAX_SOURCES"] = "x";
    process.env["ATLAS_INITIAL_SOURCES"] = "[[[";
    process.env["ATLAS_AI_PROVIDER"] = "???";
    expect(getConfigurationView(NOW)).toEqual(getConfigurationView(NOW));
  });
});

describe("getConfigurationHandler (T010 handler assertions)", () => {
  test("never throws for broken configuration and reports it as invalid/flagged", async () => {
    process.env["ATLAS_MAX_SOURCES"] = "abc";
    process.env["ATLAS_INITIAL_SOURCES"] = "[[[";
    process.env["ATLAS_AI_PROVIDER"] = "???";
    const view = await getConfigurationHandler();
    const byId = (id: string) => view.items.find((i) => i.id === id);
    expect(byId("ATLAS_MAX_SOURCES")).toMatchObject({ state: "invalid" });
    expect(byId("ATLAS_INITIAL_SOURCES")).toMatchObject({
      flag: "unrecognized",
    });
    expect(byId("ATLAS_AI_PROVIDER")).toMatchObject({
      value: "gemini",
      flag: "unrecognized",
    });
  });

  test("takes no input: a supplied payload does not change the result", async () => {
    const items = (v: { items: unknown[] }) => JSON.stringify(v.items);
    const plain = await getConfigurationHandler();
    const call = getConfigurationHandler as (
      input?: unknown,
    ) => ReturnType<typeof getConfigurationHandler>;
    const withInput = await call({
      ATLAS_MAX_SOURCES: "999",
      extra: "SENTINEL-INPUT",
    });
    expect(items(withInput)).toBe(items(plain));
    expect(JSON.stringify(withInput)).not.toContain("SENTINEL-INPUT");
  });
});
