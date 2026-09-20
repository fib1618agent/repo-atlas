# Contract: UI components (Sources menu, Connected Sources popup, Add Sources modes)

App-layer feature — no REST/RPC surface of its own beyond the one extended
server function (see `get-repositories-extension.md`). "Contracts" here are
component prop/behavior contracts, the appropriate interface unit for a
TanStack Start UI feature per `/speckit-plan`'s "contracts appropriate to the
project type" guidance.

## `SourcesMenu` (replaces `AtlasSourcesChrome`)

`src/components/atlas/SourcesMenu.tsx` — same call-site shape as the
component it replaces, so all four route files change by one import/JSX
swap only.

```ts
type SourcesMenuProps = {
  sourceKey: string;
  isDefault: boolean;
  repositories: Repository[];
  urls: string[];
  isLoading: boolean;
  isFetching: boolean;
};
```

**Behavior contract**:

1. **Given** the component renders, **When** the visitor has not interacted
   with it, **Then** exactly one trigger control ("Sources ▼") is visible —
   no separate Add/Export/chip controls outside it (FR-001, FR-004).
2. **Given** the trigger is clicked, **When** the menu opens, **Then** it
   shows exactly three items in order: "Add Sources", "Export JSON",
   "Connected Sources" (FR-002).
3. **Given** "Export JSON" is selected, **When** `repositories.length === 0`
   or `isLoading`/`isFetching` is true, **Then** the item is disabled,
   identical to today's `AtlasSourcesChrome` export-button disabled logic
   (FR-005 — no regression).
4. **Given** "Export JSON" succeeds, **When** the export completes, **Then**
   the same `exportRepositoriesJson` call and toast feedback fire as today
   (FR-005).
5. **Given** "Add Sources" is selected, **When** clicked, **Then** it calls
   `useSourcesStore().setDialogOpen(true)`, identical to today's behavior.
6. **Given** "Connected Sources" is selected, **When** clicked, **Then** it
   opens `ConnectedSourcesDialog` (new).

## `ConnectedSourcesDialog`

`src/components/atlas/ConnectedSourcesDialog.tsx` — new component, no props
beyond open/close state (reads `useSourcesStore()` and
`useAtlasRepositories()` directly, consistent with `SourcesDialog`'s
existing pattern of reading global state rather than prop-drilling).

**Behavior contract**:

1. **Given** the dialog opens, **When** rendered, **Then** it lists one
   `ConnectedSource` entry (data-model.md) per distinct active source login,
   each showing type, identity, repository count, status, and a colored
   indicator (FR-007, FR-008).
2. **Given** no source has ever loaded (`loadInitialSources: false`, no
   custom sources), **When** the dialog opens, **Then** it shows an explicit
   empty/not-yet-connected state, never an error (Edge Cases).
3. **Given** the active source-set changes (new load, or reset to default),
   **When** the dialog is next opened, **Then** its contents reflect the new
   state (FR-010).
4. **Given** a partial failure occurred on the most recent load, **When**
   the dialog opens, **Then** the affected entry's `status` is `"degraded"`
   or `"error"`, not `"connected"` (FR-011).

## `SourcesDialog` (extended in place)

`src/components/atlas/SourcesDialog.tsx` — same component, same global
`dialogOpen` wiring; adds a `SourceInputMode` (data-model.md) tab selector.

**Behavior contract (additive to existing, all current behavior unchanged)**:

1. **Given** the dialog opens, **When** rendered, **Then** it defaults to
   Mode 1 ("Users"), preserving today's exact default-row/prefill behavior
   for backward compatibility.
2. **Given** Mode 1 is active, **When** the visitor submits, **Then**
   behavior is byte-for-byte identical to today's `handleLoad` (FR-014,
   no regression).
3. **Given** Mode 2 ("Repositories") is active, **When** the visitor enters
   a row that does not parse to `kind: "repo"`, **Then** a row-level error
   is shown and submission is blocked, mirroring today's existing
   `rowErrors` pattern (FR-015, FR-016).
4. **Given** Mode 2 rows all parse as `kind: "repo"`, **When** submitted,
   **Then** the same `getRepositories({ sources })` call, caching,
   dedupe, cap (`ATLAS_MAX_SOURCES`), and toast/warning handling as Mode 1
   apply (FR-016).
5. **Given** Mode 2 submission succeeds, **When** the load completes,
   **Then** a `SelectedRepositoryForAnalysis[]` (data-model.md) is derived
   from the submitted rows for future use — no server call is made with it,
   no UI claims "analyzed" (FR-018, FR-019).

## Category panel (`src/routes/index.tsx`, modified in place)

No new component. Behavior contract:

1. **Given** the Explore page loads fresh, **When** rendered, **Then** the
   `#categories` `Accordion` starts collapsed (FR-020).
2. **Given** the panel is collapsed, **When** the visitor views the hero
   stats row, **Then** Repositories/Categories/Platforms/Possibilities remain
   visible (FR-021 — already true today, verified unaffected).
3. **Given** the visitor clicks the `AccordionTrigger`, **When** toggled,
   **Then** expand/collapse works in both directions exactly as today
   (FR-022).
