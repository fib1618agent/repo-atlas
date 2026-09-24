# Contract: Control-plane server functions

**Feature**: 006-settings-control-plane · **Spec**: [../spec.md](../spec.md) · **Data**: [../data-model.md](../data-model.md)

Two read-only server functions in `src/lib/control-plane/control-plane.functions.ts`, using the repository's handler/wrapper split (exported `…Handler` for tests, `createServerFn` wrapper for the app). Both accept **no input** and perform **no mutation**. No authentication (SEC-005): every response must therefore be safe for any caller.

## `getConfiguration` → `ConfigurationResponse`

- **Input**: none (the wrapper's validator ignores any supplied data; SEC-004 has no server-side user input to validate in this feature).
- **Output**: `{ generatedAt: string, items: ConfigurationItem[] }` per data-model.md (Effective Configuration).
- **Guarantees** (each covered by a test):
  1. Item set equals the registry's server-side entries (allowlist; FR-001, FR-012). Environment variables not in the registry never appear.
  2. Category-C items contain only `status` (`configured` | `not_configured`); the secret value never appears anywhere in the serialized response (SEC-001, SEC-003, SC-002). `configured` is computed as truthiness of the value and the value is not retained past that expression.
  3. Sensitive non-secret items contain only `availability` (SEC-007).
  4. Value items report the value the system uses (`serverAtlasConfig()`, `codeIntelConfig()`), the default where one exists, and `isDefault` when valid; an unparseable numeric value is returned as `state: invalid` with no value (Invalid / unavailable) and is never replaced by a fabricated fallback (FR-005, FR-013).
  5. Client-visible items carry `clientVisible: true` (SEC-008).
  6. Broken/missing/unreadable configuration never throws to the client: invalid items are returned as Invalid / unavailable, and a wholesale failure yields the error below (FR-008, SC-004).
- **Errors**: on unexpected failure the handler logs a sanitized server-side message and throws the serialized catalog error `SETTINGS_UNAVAILABLE` (fixed message; no `Error.message`, path, stack or env value; SEC-006). The UI offers **Retry**.

## `getCodeIntelStatus` → `OperationalStatus`

- **Input**: none.
- **Output**: per data-model.md (Operational Status).
- **Guarantees**:
  1. Read-only: only `SELECT` statements; no INSERT/UPDATE/DELETE, no queue send, no call to any F001/F002 mutating function (FR-014).
  2. When the database binding is absent → `{ available: false, reason: "no_binding", symbolExtractorVersion }` (FR-018); not an error.
  3. When present → aggregate counts only, no identifiers (SEC-007).
  4. A query failure → `{ available: false, reason: "query_failed", … }` with fixed text; no `Error.message` is forwarded.
- **Errors**: none thrown for unavailability; unexpected failures return `available: false` with a fixed reason.

## Out of contract (deliberately absent)

No write, update, reset, start, pause, retry or clear function exists in this feature (FR-002, FR-014, FR-011; deferred US4 and runtime mutation). No function returns or accepts a secret. No function returns raw `process.env`, `wrangler.toml` content, filesystem paths, binding identifiers or stack traces.
