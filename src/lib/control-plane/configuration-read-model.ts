import type { ReasonCode, SettingDefinition } from "./setting-registry";

/**
 * Pure configuration read model. It maps already-collected inputs onto the
 * browser-safe DTO. It imports no server module and reads no env, storage or
 * binding, so client code may `import type` from it. The DTO shapes for secrets
 * and availability items have no value field: a leak needs a type-breaking change.
 */

export type InitialSourceValue = { type: string; owner: string };
export type ConfigValue =
  string | number | boolean | readonly InitialSourceValue[];

interface ValueItemBase {
  id: string;
  label: string;
  category: "B";
  display: "value";
  clientVisible: boolean;
}

/** A configured value that is effective. `flag` marks an existing defined fallback. */
export interface ValidValueItem extends ValueItemBase {
  state: "valid";
  value: ConfigValue;
  default?: ConfigValue;
  isDefault: boolean;
  flag?: "unrecognized";
}

/** Nothing configured. `value` is the real default, absent when none exists ("Not set"). */
export interface UnsetValueItem extends ValueItemBase {
  state: "unset";
  value?: ConfigValue;
  default?: ConfigValue;
  isDefault: true;
}

/** Configured value unusable. No `value`, no `isDefault`; `default` is informational only. */
export interface InvalidValueItem extends ValueItemBase {
  state: "invalid";
  default?: ConfigValue;
}

export type ValueItem = ValidValueItem | UnsetValueItem | InvalidValueItem;

export interface SecretStatusItem {
  id: string;
  label: string;
  category: "C";
  display: "status";
  status: "configured" | "not_configured";
  degradesWhenMissing: string;
}

export interface AvailabilityItem {
  id: string;
  label: string;
  category: "B";
  display: "availability";
  availability: "available" | "unavailable";
  reason?: ReasonCode;
}

export type ConfigurationItem = ValueItem | SecretStatusItem | AvailabilityItem;

export interface ConfigurationResponse {
  generatedAt: string;
  items: ConfigurationItem[];
}

/** What the collector reports for one category-B value item. */
export interface ValueInput {
  /** The allowlisted variable is present in the environment. */
  configured: boolean;
  /** Value actually used by existing behavior (may be NaN/Infinity for a bad number). */
  effective?: ConfigValue;
  /** Real existing default, only where one genuinely exists. */
  default?: ConfigValue;
  /** Existing behavior applied its own defined fallback for the configured value. */
  flag?: "unrecognized";
}

export interface AvailabilityInput {
  available: boolean;
  reason?: ReasonCode;
}

/** Inputs carry booleans for secrets and availability; never the underlying values. */
export interface ConfigurationInputs {
  values: Readonly<Record<string, ValueInput>>;
  availability: Readonly<Record<string, AvailabilityInput>>;
  secrets: Readonly<Record<string, boolean>>;
}

const sameValue = (a: ConfigValue, b: ConfigValue) =>
  JSON.stringify(a) === JSON.stringify(b);
const isNonFiniteNumber = (v: unknown) =>
  typeof v === "number" && !Number.isFinite(v);

function buildValueItem(
  def: SettingDefinition,
  input: ValueInput | undefined,
): ValueItem {
  const base = {
    id: def.id,
    label: def.label,
    category: "B",
    display: "value",
    clientVisible: def.clientVisible,
  } as const;
  // Numbers are never JSON-safe when non-finite; a default that is itself non-finite is dropped.
  const dflt =
    input?.default !== undefined && !isNonFiniteNumber(input.default)
      ? input.default
      : undefined;
  const withDefault = dflt === undefined ? {} : { default: dflt };

  // No input, or an unparseable number: report honestly, never substitute a fallback.
  if (
    !input ||
    (input.configured &&
      (input.effective === undefined || isNonFiniteNumber(input.effective)))
  ) {
    return { ...base, state: "invalid", ...withDefault };
  }
  if (!input.configured) {
    return {
      ...base,
      state: "unset",
      isDefault: true,
      ...(dflt === undefined ? {} : { value: dflt }),
      ...withDefault,
    };
  }
  const value = input.effective as ConfigValue;
  return {
    ...base,
    state: "valid",
    value,
    isDefault: dflt !== undefined && sameValue(value, dflt),
    ...withDefault,
    ...(input.flag ? { flag: input.flag } : {}),
  };
}

/** Pure: emits items only for registry entries (allowlist); category A is merged client-side. */
export function buildConfiguration(
  registry: readonly SettingDefinition[],
  inputs: ConfigurationInputs,
  now: Date = new Date(),
): ConfigurationResponse {
  const items: ConfigurationItem[] = [];
  for (const def of registry) {
    if (def.category === "A") continue;
    if (def.category === "C") {
      items.push({
        id: def.id,
        label: def.label,
        category: "C",
        display: "status",
        status:
          inputs.secrets[def.id] === true ? "configured" : "not_configured",
        degradesWhenMissing: def.degradesWhenMissing,
      });
    } else if (def.display === "availability") {
      const input = inputs.availability[def.id];
      items.push({
        id: def.id,
        label: def.label,
        category: "B",
        display: "availability",
        availability: input?.available ? "available" : "unavailable",
        ...(input?.available
          ? {}
          : { reason: input?.reason ?? "not_supported_here" }),
      });
    } else {
      items.push(buildValueItem(def, inputs.values[def.id]));
    }
  }
  return { generatedAt: now.toISOString(), items };
}
