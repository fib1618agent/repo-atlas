import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PreferencesSection } from "../../../src/components/settings/PreferencesSection";
import { useAtlasStore } from "../../../src/lib/atlas-store";
import { CodeIntelStatusView } from "../../../src/components/settings/CodeIntelStatusSection";
import type { OperationalStatus } from "../../../src/lib/control-plane/code-intel-status";
import { ConfigurationList } from "../../../src/components/settings/ConfigurationSection";
import type { ConfigurationItem } from "../../../src/lib/control-plane/configuration-read-model";
import { PREFERENCE_DEFAULTS } from "../../../src/lib/control-plane/preferences";

const read = (rel: string) =>
  readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");

const base = { category: "B", display: "value", clientVisible: false } as const;
const ITEMS: ConfigurationItem[] = [
  {
    ...base,
    id: "V1",
    label: "Valid custom",
    state: "valid",
    value: 9,
    default: 5,
    isDefault: false,
  },
  {
    ...base,
    id: "V2",
    label: "Valid at default",
    state: "valid",
    value: 5,
    default: 5,
    isDefault: true,
  },
  {
    ...base,
    id: "U1",
    label: "Unset with default",
    state: "unset",
    value: 800,
    default: 800,
    isDefault: true,
  },
  {
    ...base,
    id: "U2",
    label: "Unset no default",
    state: "unset",
    isDefault: true,
  },
  {
    ...base,
    id: "I1",
    label: "Invalid one",
    state: "invalid",
    default: 900000,
  },
  {
    ...base,
    id: "F1",
    label: "Fallback one",
    state: "valid",
    value: "gemini",
    flag: "unrecognized",
    isDefault: false,
  },
  {
    ...base,
    id: "VITE_X",
    label: "Client visible",
    state: "valid",
    value: "https://x",
    isDefault: false,
    clientVisible: true,
  },
  {
    id: "S1",
    label: "A secret",
    category: "C",
    display: "status",
    status: "configured",
    degradesWhenMissing: "AI off",
  },
  {
    id: "S2",
    label: "Missing secret",
    category: "C",
    display: "status",
    status: "not_configured",
    degradesWhenMissing: "AI falls back",
  },
  {
    id: "D1",
    label: "Database",
    category: "B",
    display: "availability",
    availability: "available",
  },
  {
    id: "D2",
    label: "Queue",
    category: "B",
    display: "availability",
    availability: "unavailable",
    reason: "no_binding",
  },
];

const html = renderToStaticMarkup(
  <ConfigurationList items={ITEMS} preferences={PREFERENCE_DEFAULTS} />,
);
const rowFor = (label: string) => {
  const rows = html.split("<tr").filter((r) => r.includes(label));
  expect(rows).toHaveLength(1);
  return rows[0]!;
};

describe("ConfigurationList rendering (T012)", () => {
  test("valid shows the effective value; default marker only when it equals the default", () => {
    expect(rowFor("Valid custom")).toContain("<code>9</code>");
    expect(rowFor("Valid custom")).not.toContain("default");
    expect(rowFor("Valid at default")).toContain(">default<");
  });

  test("unset shows the real default, or Not set when none exists", () => {
    expect(rowFor("Unset with default")).toContain("<code>800</code>");
    expect(rowFor("Unset with default")).toContain(">default<");
    expect(rowFor("Unset no default")).toContain("Not set");
  });

  test("invalid shows Invalid / unavailable and never presents the default as in effect", () => {
    const row = rowFor("Invalid one");
    expect(row).toContain("Invalid / unavailable");
    expect(row).not.toContain("<code>");
    expect(row).toContain("For reference, the default is 900000");
  });

  test("existing fallback shows the value used plus an unrecognized flag", () => {
    const row = rowFor("Fallback one");
    expect(row).toContain("<code>gemini</code>");
    expect(row).toContain("unrecognized configured value");
  });

  test("client-visible badge only on client-visible items; every row has a category", () => {
    expect(rowFor("Client visible")).toContain("client-visible");
    expect(rowFor("Valid custom")).not.toContain("client-visible");
    for (const label of [
      "Valid custom",
      "A secret",
      "Database",
      "Auto-rotate atlas",
    ]) {
      expect(rowFor(label)).toMatch(/[A-D] · /);
    }
  });

  test("secrets show status only; sensitive availability shows no value, unavailable is not an error style", () => {
    expect(rowFor("A secret")).toContain("configured");
    expect(rowFor("A secret")).not.toContain("<code>");
    expect(rowFor("Missing secret")).toContain("not configured");
    expect(rowFor("Missing secret")).toContain("AI falls back");
    expect(rowFor("Database")).toContain("Available");
    expect(rowFor("Queue")).toContain("Unavailable");
    expect(rowFor("Queue")).toContain("Not available in this environment");
    expect(rowFor("Queue")).not.toContain("destructive");
  });

  test("category-A rows come from the registry and the supplied store values", () => {
    const off = renderToStaticMarkup(
      <ConfigurationList
        items={[]}
        preferences={{ autoRotate: false, showRelationships: true }}
      />,
    );
    const rot = off.split("<tr").find((r) => r.includes("Auto-rotate atlas"))!;
    const rel = off.split("<tr").find((r) => r.includes("Show relationships"))!;
    expect(rot).toContain("<code>false</code>");
    expect(rot).not.toContain(">default<");
    expect(rel).toContain("<code>true</code>");
    expect(rel).toContain(">default<");
  });

  test("read-only: no form control anywhere in the list", () => {
    expect(html).not.toMatch(/<(input|button|select|textarea|form)\b/);
  });
});

describe("settings route and navigation (T013/T014)", () => {
  test("/settings route file exists and is registered in the generated tree", () => {
    expect(read("src/routes/settings.tsx")).toContain(
      'createFileRoute("/settings")',
    );
    const tree = read("src/routeTree.gen.ts");
    expect(tree).toContain("'/settings'");
    expect(tree).toContain("./routes/settings");
  });

  test.each(["index", "catalogue", "categories", "insights", "about"])(
    "%s has exactly one Settings nav link to /settings",
    (name) => {
      const src = read(`src/routes/${name}.tsx`);
      expect(
        src.match(
          /<Link to="\/settings" className="atlas-nav-item">Settings<\/Link>/g,
        ),
      ).toHaveLength(1);
      expect(src.match(/to="\/settings"/g)).toHaveLength(1);
    },
  );

  test("settings page marks Settings active and links the other pages", () => {
    const src = read("src/routes/settings.tsx");
    expect(src).toContain(
      '<span className="atlas-nav-item is-active">Settings</span>',
    );
    for (const to of [
      "/",
      "/catalogue",
      "/categories",
      "/insights",
      "/about",
    ]) {
      expect(src).toContain(`<Link to="${to}" className="atlas-nav-item">`);
    }
  });
});

describe("client boundary for the settings UI (T012)", () => {
  const files = [
    "src/components/settings/ConfigurationSection.tsx",
    "src/routes/settings.tsx",
  ];

  test("no process.env, no collector or server-only imports, type-only read-model import", () => {
    for (const f of files) {
      const src = read(f);
      expect(src).not.toContain("process.env");
      expect(src).not.toMatch(
        /configuration-collector|code-intel-status|cloudflare-env|atlas-config"|code-intel\/config/,
      );
      for (const m of src.matchAll(
        /^import[^;]*configuration-read-model";/gms,
      )) {
        expect(m[0]).toMatch(/^import type /);
      }
    }
    expect(read(files[0]!)).toContain(
      'from "@/lib/control-plane/control-plane.functions"',
    );
  });

  test("no edit controls for configuration in the components (no input, password, save)", () => {
    const src = read(files[0]!);
    expect(src).not.toMatch(/<Input\b|<input\b|type="password"|<Switch\b|Save/);
  });
});

describe("PreferencesSection (T018/T019)", () => {
  const src = read("src/components/settings/PreferencesSection.tsx");
  const markup = renderToStaticMarkup(<PreferencesSection />);

  test("exactly two switches and one reset button, nothing else interactive", () => {
    expect(markup.match(/role="switch"/g)).toHaveLength(2);
    expect(markup.match(/<button\b/g)).toHaveLength(3); // 2 switch buttons + reset
    expect(markup).toContain("Reset preferences");
    // Radix renders one hidden aria-hidden checkbox per switch; no other input/select/textarea/form/password.
    const inputs = markup.match(/<input\b[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(2);
    for (const i of inputs)
      expect(i).toMatch(/type="checkbox"[^>]*aria-hidden="true"/);
    expect(markup).not.toMatch(/<(select|textarea|form)\b|type="password"/);
  });

  test("switches reflect the atlas store (default on) and labels are present", () => {
    expect(markup.match(/aria-checked="true"/g)).toHaveLength(2);
    expect(markup).toContain("Auto-rotate atlas");
    expect(markup).toContain("Show relationships");
  });

  test("bound to the store actions, reset toast, storage probe; category A only", () => {
    expect(src).toContain("toggleAutoRotate");
    expect(src).toContain("toggleRelationships");
    expect(src).toContain("resetPreferences");
    expect(src).toContain("probePreferenceStorage");
    expect(src).toMatch(/will not be\s+remembered/);
    expect(src).toContain("toast.success");
    expect(src).not.toMatch(
      /process\.env|localStorage|sessionStorage|<Input\b|<input\b|configuration-collector|control-plane\.functions/,
    );
  });

  test("mounted below ConfigurationSection on the settings route", () => {
    const route = read("src/routes/settings.tsx");
    expect(route.indexOf("<PreferencesSection />")).toBeGreaterThan(
      route.indexOf("<ConfigurationSection />"),
    );
    expect(route.match(/<PreferencesSection \/>/g)).toHaveLength(1);
  });
});

describe("CodeIntelStatusSection (T023/T024)", () => {
  const view = (status: OperationalStatus) =>
    renderToStaticMarkup(<CodeIntelStatusView status={status} />);
  const srcFile = read("src/components/settings/CodeIntelStatusSection.tsx");

  test("populated counts and extractor version render", () => {
    const html = view({
      available: true,
      symbolExtractorVersion: "v-test",
      snapshots: {
        total: 7,
        pending: 1,
        in_progress: 2,
        completed: 3,
        failed: 1,
      },
      extractions: {
        total: 5,
        in_progress: 1,
        completed: 2,
        completed_partial: 1,
        failed: 1,
      },
    });
    expect(html).toContain("<code>v-test</code>");
    expect(html).toContain("(7 total)");
    expect(html).toContain("(5 total)");
    for (const [label, n] of [
      ["Pending", 1],
      ["In progress", 2],
      ["Completed", 3],
      ["Completed (partial)", 1],
    ] as const) {
      expect(html).toMatch(
        new RegExp(`${label.replace(/[()]/g, "\\$&")}</dt><dd[^>]*>${n}</dd>`),
      );
    }
    expect(html).not.toContain("Unavailable");
    expect(html).not.toContain("No code-intelligence data");
  });

  test("all-zero counts show the empty message (version still shown)", () => {
    const html = view({
      available: true,
      symbolExtractorVersion: "v-test",
      snapshots: {
        total: 0,
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0,
      },
      extractions: {
        total: 0,
        in_progress: 0,
        completed: 0,
        completed_partial: 0,
        failed: 0,
      },
    });
    expect(html).toContain("No code-intelligence data");
    expect(html).toContain("<code>v-test</code>");
    expect(html).not.toContain("<dl");
  });

  test("unavailable / no_binding: Unavailable badge, fixed message, not error-styled", () => {
    const html = view({
      available: false,
      reason: "no_binding",
      symbolExtractorVersion: "v-test",
    });
    expect(html).toContain("Unavailable");
    expect(html).toContain("Not available in this environment");
    expect(html).toContain("<code>no_binding</code>");
    expect(html).not.toMatch(/destructive|role="alert"/);
    expect(html).not.toContain("<dl");
  });

  test("unavailable / query_failed: fixed reason only, no internal detail", () => {
    const html = view({
      available: false,
      reason: "query_failed",
      symbolExtractorVersion: "v-test",
    });
    expect(html).toContain("Not available in this environment");
    expect(html).toContain("The status could not be read.");
    expect(html).toContain("<code>query_failed</code>");
    expect(html).not.toMatch(/SELECT|Error|stack|sqlite|SENTINEL/i);
  });

  test("read-only: no buttons, links, inputs, switches, or per-snapshot rows", () => {
    for (const status of [
      {
        available: true,
        symbolExtractorVersion: "v",
        snapshots: {
          total: 1,
          pending: 0,
          in_progress: 0,
          completed: 1,
          failed: 0,
        },
        extractions: {
          total: 1,
          in_progress: 0,
          completed: 1,
          completed_partial: 0,
          failed: 0,
        },
      },
      { available: false, reason: "no_binding", symbolExtractorVersion: "v" },
    ] satisfies OperationalStatus[]) {
      const html = view(status);
      expect(html).not.toMatch(
        /<(button|a|input|select|textarea|form|table|ul|ol)\b|role="switch"/,
      );
    }
    expect(srcFile).not.toMatch(
      /<Button\b|<Link\b|<Switch\b|<Input\b|refetch|onClick|<a\b/,
    );
  });

  test("client boundary: type-only import of the status module; only the wrapper at runtime", () => {
    expect(srcFile).toContain(
      'import type { OperationalStatus } from "@/lib/control-plane/code-intel-status"',
    );
    expect(
      srcFile.match(/from "@\/lib\/control-plane\/code-intel-status"/g),
    ).toHaveLength(1);
    expect(srcFile).toContain(
      'from "@/lib/control-plane/control-plane.functions"',
    );
    expect(srcFile).not.toMatch(
      /process\.env|configuration-collector|cloudflare-env|RELATIONSHIP/,
    );
  });

  test("settings route mounts it exactly once, as the third section", () => {
    const route = read("src/routes/settings.tsx");
    expect(route.match(/<CodeIntelStatusSection \/>/g)).toHaveLength(1);
    const order = [
      "<ConfigurationSection />",
      "<PreferencesSection />",
      "<CodeIntelStatusSection />",
    ].map((t) => route.indexOf(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
