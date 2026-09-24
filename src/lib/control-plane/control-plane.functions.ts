import { createServerFn } from "@tanstack/react-start";
import { SYMBOL_EXTRACTOR_VERSION } from "../code-intel/config";
import {
  AtlasError,
  atlasErrorMessage,
  serializeAtlasError,
} from "../atlas-errors";
import {
  getCodeIntelStatusView,
  type OperationalStatus,
} from "./code-intel-status";
import { getConfigurationView } from "./configuration-collector";
import type { ConfigurationResponse } from "./configuration-read-model";

/**
 * Plain, directly-callable handler + thin `createServerFn` wrapper (same split
 * as `repositories.functions.ts`; tests call the handler directly).
 *
 * No authentication: the response must be safe for any caller, so it carries
 * only the allowlisted, structurally redacted DTO. It accepts no input.
 */
export async function getConfigurationHandler(): Promise<ConfigurationResponse> {
  try {
    return getConfigurationView();
  } catch {
    // Fixed text only: never the exception, stack, env value, path or identifier.
    console.error("[atlas] settings: configuration view unavailable");
    throw new Error(
      JSON.stringify(
        serializeAtlasError(
          new AtlasError(
            "SETTINGS_UNAVAILABLE",
            atlasErrorMessage("SETTINGS_UNAVAILABLE"),
          ),
        ),
      ),
    );
  }
}

export const getConfiguration = createServerFn({ method: "POST" })
  .validator(() => undefined)
  .handler(() => getConfigurationHandler());

/** Read-only, no input. Any unexpected failure becomes a fixed reason, never an internal message. */
export async function getCodeIntelStatusHandler(): Promise<OperationalStatus> {
  try {
    return await getCodeIntelStatusView();
  } catch {
    console.error("[atlas] settings: code-intelligence status unavailable");
    return {
      available: false,
      reason: "query_failed",
      symbolExtractorVersion: SYMBOL_EXTRACTOR_VERSION,
    };
  }
}

export const getCodeIntelStatus = createServerFn({ method: "POST" })
  .validator(() => undefined)
  .handler(() => getCodeIntelStatusHandler());
