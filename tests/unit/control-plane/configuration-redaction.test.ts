import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
  atlasErrorMessage,
  parseAtlasError,
} from "../../../src/lib/atlas-errors";
import { setTestCloudflareEnv } from "../../../src/lib/code-intel/persistence/cloudflare-env";
import { collectConfigurationInputs } from "../../../src/lib/control-plane/configuration-collector";
import type { SecretStatusItem } from "../../../src/lib/control-plane/configuration-read-model";
import { getConfigurationHandler } from "../../../src/lib/control-plane/control-plane.functions";

const SECRET_ENV = [
  "GITHUB_TOKEN",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "XAI_API_KEY",
];
const OTHER_ENV = [
  "ATLAS_SQLITE_PATH",
  "ATLAS_SQLITE_ENABLED",
  "ATLAS_AI_PROVIDER",
  "NITRO_PRESET",
  "CF_PAGES",
];
const ENV_KEYS = [
  ...SECRET_ENV,
  ...OTHER_ENV,
  "ATLAS_MAX_SOURCES",
  "ATLAS_INITIAL_SOURCES",
];

const SECRET_SENTINELS = SECRET_ENV.map((k) => `SENTINEL-SECRET-${k}`);
const PATH_SENTINEL = "/SENTINEL-PATH/atlas.sqlite";
const DB_ID = "SENTINEL-DB-ID";
const BUCKET_ID = "SENTINEL-BUCKET-ID";
const QUEUE_ID = "SENTINEL-QUEUE-ID";
const ALL_SENTINELS = [
  ...SECRET_SENTINELS,
  PATH_SENTINEL,
  DB_ID,
  BUCKET_ID,
  QUEUE_ID,
  "SENTINEL-FAILURE-MESSAGE",
];

let saved: Record<string, string | undefined>;
let errorSpy: ReturnType<typeof spyOn>;
let warnSpy: ReturnType<typeof spyOn>;

const expectNoSentinel = (text: string) => {
  for (const s of ALL_SENTINELS) expect(text).not.toContain(s);
};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  SECRET_ENV.forEach((k, i) => {
    process.env[k] = SECRET_SENTINELS[i]!;
  });
  process.env["ATLAS_SQLITE_PATH"] = PATH_SENTINEL;
  setTestCloudflareEnv({
    DB: { id: DB_ID } as never,
    SNAPSHOTS: { bucket: BUCKET_ID } as never,
    SNAPSHOT_QUEUE: { name: QUEUE_ID } as never,
    SYMBOL_QUEUE: { name: QUEUE_ID } as never,
  });
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
  warnSpy = spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  setTestCloudflareEnv(undefined);
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

describe("configuration handler redaction (sentinel values)", () => {
  test("no secret, path or binding-identifier sentinel appears anywhere in the serialized response", async () => {
    const view = await getConfigurationHandler();
    expectNoSentinel(JSON.stringify(view));
  });

  test("collector inputs never contain sentinels either", () => {
    expectNoSentinel(JSON.stringify(collectConfigurationInputs()));
  });

  test("category C items are exactly SecretStatusItem-shaped and report presence correctly", async () => {
    const view = await getConfigurationHandler();
    const secrets = view.items.filter(
      (i): i is SecretStatusItem => i.category === "C",
    );
    expect(secrets.map((i) => i.id)).toEqual(SECRET_ENV);
    for (const s of secrets) {
      expect(Object.keys(s).sort()).toEqual([
        "category",
        "degradesWhenMissing",
        "display",
        "id",
        "label",
        "status",
      ]);
      expect(s.status).toBe("configured");
    }
    delete process.env["XAI_API_KEY"];
    process.env["OPENAI_API_KEY"] = "";
    const after = (await getConfigurationHandler()).items.filter(
      (i): i is SecretStatusItem => i.category === "C",
    );
    expect(after.find((i) => i.id === "XAI_API_KEY")?.status).toBe(
      "not_configured",
    );
    expect(after.find((i) => i.id === "OPENAI_API_KEY")?.status).toBe(
      "not_configured",
    );
    expect(after.find((i) => i.id === "GEMINI_API_KEY")?.status).toBe(
      "configured",
    );
  });

  test("availability items report presence and carry no value-bearing field", async () => {
    const view = await getConfigurationHandler();
    const avail = view.items.filter((i) => i.display === "availability");
    expect(avail).toHaveLength(5);
    for (const a of avail) {
      expect(
        Object.keys(a).every((k) =>
          [
            "id",
            "label",
            "category",
            "display",
            "availability",
            "reason",
          ].includes(k),
        ),
      ).toBe(true);
    }
  });

  test("existing AI-provider warning stays server-side: raw unrecognized value is not returned as the value", async () => {
    process.env["ATLAS_AI_PROVIDER"] = "SENTINEL-PROVIDER-RAW";
    const view = await getConfigurationHandler();
    const provider = view.items.find((i) => i.id === "ATLAS_AI_PROVIDER");
    expect(provider).toMatchObject({
      state: "valid",
      value: "gemini",
      flag: "unrecognized",
    });
    expect(JSON.stringify(view)).not.toContain("SENTINEL-PROVIDER-RAW");
  });

  test("forced collection failure yields only the fixed SETTINGS_UNAVAILABLE error", async () => {
    setTestCloudflareEnv({
      get DB(): never {
        throw new Error(
          "SENTINEL-FAILURE-MESSAGE " +
            PATH_SENTINEL +
            " " +
            SECRET_SENTINELS[0],
        );
      },
    } as never);

    let thrown: unknown;
    try {
      await getConfigurationHandler();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const err = thrown as Error;
    const parsed = parseAtlasError(err);
    expect(parsed).toEqual({
      code: "SETTINGS_UNAVAILABLE",
      message: atlasErrorMessage("SETTINGS_UNAVAILABLE"),
    });
    expect(err.message).toBe(JSON.stringify(parsed));
    expectNoSentinel(err.message);
    expectNoSentinel(String(err.stack ?? "").split("\n")[0] ?? "");
    expect(err.cause).toBeUndefined();

    // Server log is sanitized too.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expectNoSentinel(JSON.stringify(errorSpy.mock.calls));
  });
});
