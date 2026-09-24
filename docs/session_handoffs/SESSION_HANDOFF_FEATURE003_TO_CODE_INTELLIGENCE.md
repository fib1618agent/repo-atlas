> **SUPERSEDED (2026-09-24).** Historical only: describes the Feature 003 / Code Intelligence state as of 2026-09-21. Do not use it for current state. Current handoff: `docs/session_handoffs/CURRENT.md`.

# Session Handoff: Feature 003 → Code Intelligence Foundation Continuation

**Written**: 2026-09-21. Read fully before doing anything — written for a fresh Claude session with zero prior context.

> **⚠️ Verified-state correction before you read further**: this handoff was requested with an assumed next action of "run `/speckit-plan`" against `specs/001-code-intelligence-foundation/spec.md`. Direct repo inspection at write-time shows that premise is **stale**: `specs/001-code-intelligence-foundation/` already has `plan.md` and `tasks.md`, all **54/54 tasks marked `[x]`**, and `src/lib/code-intel/` (providers, acquisition, persistence, queue, domain modules including a working `acquireSnapshot`) is fully implemented. A separate handoff doc at repo root (`SESSION_HANDOFF.md`, written 2026-09-21) states Feature 001 is "Complete, live-validated, production-deployed." **Do not run `/speckit-plan` on spec.md 001 — there is nothing to plan.** See §7 for the real next-action options.

## 1. Repository Context

- **Repository**: RepoAtlas (`repo-atlas`), path `/Users/imdadareeph/Documents/dev/git/fib1618agent/repo-atlas`
- **Current branch**: `feat/atlas-marble-interaction`
- **Current feature completed**: `specs/003-github-source-enhancement/` — GitHub Source Enhancement, all tasks T001–T028 done
- **Relationship to Code Intelligence**: Feature 003 is a **source-onboarding UI layer** sitting entirely above the Code Intelligence stack. It does not call into either Code Intelligence feature. It exists to let a user browse/select GitHub sources and, separately, mark specific repositories as candidates for future analysis — producing a typed extension point (`SelectedRepositoryForAnalysis`, §2.5) that a *future* feature can pass into Code Intelligence Foundation's already-existing `acquireSnapshot`. No such call is wired up yet, by design (§4).
- **Actual Code Intelligence state** (verified, not assumed): `001-code-intelligence-foundation` is fully implemented (54/54 tasks, `src/lib/code-intel/{domain,providers,acquisition,persistence,queue}/`). `002-ast-symbol-intelligence` is partially implemented (30/66 tasks — core extraction path done, 103/103 tests passing; later query/server-fn-registration phases, T036+, not started). Neither is "upcoming" — see the correction banner above.

## 2. Feature 003 Completion Summary

**Feature**: GitHub Source Enhancement (`specs/003-github-source-enhancement/`)
**Status**: T001–T028 complete (28 tasks, all `[X]`).

### 2.1 Sources UX

- `AtlasSourcesChrome.tsx` **deleted** (T026) — replaced by `SourcesMenu.tsx` (`src/components/atlas/SourcesMenu.tsx`) as the single "Sources ▼" dropdown control.
- Migrated at all four existing route headers: `src/routes/index.tsx`, `src/routes/catalogue.tsx`, `src/routes/categories.tsx`, `src/routes/insights.tsx`. No shared `<Navbar>` was extracted — `SourcesMenu` is a drop-in per-route replacement (deliberate, minimizes diff, routes' nav markup already differed slightly).
- `SourcesDialog.tsx` mounted once at `src/routes/__root.tsx` (shared, not duplicated). `ConnectedSourcesDialog` mounted inside `SourcesMenu.tsx` itself (per-instance local state, by design).

### 2.2 Connected Sources

- `ConnectedSourcesDialog.tsx` (`src/components/atlas/ConnectedSourcesDialog.tsx`) — read-only popup showing currently active sources.
- `deriveConnectedSources()` in `src/lib/connected-sources.ts` — pure function, no React/store/network access. Input: `{ sourceKey, isDefault, urls, repositories, warnings, meta }` (existing shapes). Output: `ConnectedSource[]`, grouped by login, status derived from `meta.sourceFailures`/`warnings` (`"ok"` / `"degraded"` / `"error"`). Reuses existing `Repository.sourceLogin` field — no schema change. Color tokens reuse existing CSS vars (`--atlas-web`, `--atlas-data`, `--destructive`) — no new palette.

### 2.3 Add Sources

- Two-mode selector added to the existing `SourcesDialog.tsx`, via `Tabs`/`TabsList`/`TabsTrigger` only (no `TabsContent` — row-editing UI is shared between modes, only validation differs).
- `SourceInputMode` type (`src/lib/source-input-mode.ts`): `"users" | "repositories"` (string union, not enum, so a future mode can be added without redesign).
- `validateRowsForMode(rows, mode)` — pure, deterministic. `"users"` mode preserves today's behavior exactly (any user/org/repo URL accepted). `"repositories"` mode additionally requires each row to classify as `kind: "repo"` via the existing `parseGitHubSource`. Empty/whitespace rows silently skipped (not an error), matching prior `handleLoad` behavior.

### 2.4 Initial Sources

- `src/lib/atlas-config.ts`: `InitialSourceEntry = { type: "github"; owner: string }`, `parseInitialSources(raw)`, `loadInitialSources: boolean` (env `ATLAS_LOAD_INITIAL_SOURCES !== "false"`), `initialSources: InitialSourceEntry[]` (env `ATLAS_INITIAL_SOURCES`, JSON array; falls back to a single default entry on parse failure or non-array — but an **empty array of valid entries is legitimate**, not a fallback case).
- `src/lib/repositories.functions.ts`: `loadInitialSourcesResponse(entries)` integrates this; `RepositoriesResponse.source` gained a new union member `"not_loaded"` (additive only, confirmed non-breaking against `index.tsx`'s existing `dataSource === "fallback"` check). An explicit guard returns `notLoadedResponse()` for an empty `entries` array rather than calling `parseSourceInputs([])` (which would throw uncaught — self-caught defect fixed during T020).
- `repositories.functions.ts` also gained a plain-handler split: `getRepositoriesHandler(data)` (plain async, directly callable under `bun test`) + `getRepositories` (thin `createServerFn` wrapper delegating to it) — matches the pre-existing convention in `snapshot.functions.ts`/`symbol.functions.ts` (Feature 001/002).

### 2.5 Repository Analysis Boundary — the extension point

`src/lib/repository-intelligence-extension-points.ts` (verified, exact content):

```typescript
export type SelectedRepositoryForAnalysis = {
  provider: "github";
  owner: string;
  name: string;
  status: "added";
};

export function buildSelectedRepositoriesForAnalysis(
  parsedRepoSources: ParsedSource[],
): SelectedRepositoryForAnalysis[] {
  return parsedRepoSources
    .filter((source): source is ParsedSource & { kind: "repo" } => source.kind === "repo")
    .map((source) => ({
      provider: "github",
      owner: source.login,
      name: source.sourceUrl.split("/").pop()!,
      status: "added",
    }));
}
```

**Purpose**: future hand-off into Code Intelligence workflows. Deliberately shaped to match Feature 001's existing `RepositoryIdentity` (`src/lib/code-intel/domain/repository-identity.ts`: `{ provider, owner, name }`) so a future feature could pass this directly into Feature 001's `acquireSnapshot` without a reshape. **No such call is made in Feature 003** — pure, no React/store/network access, no import from `code-intel/**` (grepped and confirmed zero). Only `kind: "repo"` selections (Mode 2 / "repositories" mode) produce an entry; user/org selections have no single repository to point at and are filtered out. `status` is always `"added"`, never `"analyzed"`/`"queued"` — this feature makes no analysis claim.

Wired into `SourcesDialog.tsx`'s Mode 2 success path as local component state only (`selectedForAnalysis`), reset on dialog-open and `closeDialog()`. No `fetch`/server-function call of any kind results from setting it.

## 3. Architecture Boundaries

**Feature 003 owns**:
- Source discovery (browsing/loading GitHub users, orgs, repositories)
- GitHub source onboarding UX (the Sources dropdown, Add Sources dialog, Connected Sources popup)
- Source configuration (initial/default sources, two input modes)
- Repository *selection* (marking specific repos as analysis candidates — state only, no action)

**Feature 003 does NOT own** (and contains zero code for):
- Snapshot acquisition
- Repository cloning
- AST parsing
- Symbol extraction
- Code intelligence (graph/relationship resolution)
- Knowledge graph construction

**Already-implemented by prior features** (do not confuse "not owned by 003" with "doesn't exist yet"):
- Snapshot lifecycle — owned by `001-code-intelligence-foundation`, **fully implemented** (`src/lib/code-intel/acquisition/`, `persistence/`, `queue/`, `snapshot.functions.ts`).
- AST/symbol intelligence — owned by `002-ast-symbol-intelligence`, **partially implemented** (core extraction done; query-surface/server-fn-registration phases remaining).

## 4. Important Decisions

### Provider

GitHub-only implementation for v1 (both in Feature 003's UI and Feature 001's `ContentProvider`). Provider abstraction remains extensible — `SourceInputMode`, `ParsedSource`, and `RepositoryIdentity` all avoid hardcoding GitHub-only assumptions into their type shapes, but no second provider implementation exists or is required yet.

### Snapshot acquisition must NOT be automatically triggered by repository browsing

**Correct flow** (not yet wired, intentionally):

```
SelectedRepositoryForAnalysis[]
        |
        v
future snapshot acquisition server function
        |
        v
repository snapshot
```

**Wrong** (must never happen):

```
getRepositories()
        |
        v
automatic snapshot creation
```

Verified: `getRepositories`/`getRepositoriesHandler` in `repositories.functions.ts` make no call into `code-intel/**`. `buildSelectedRepositoriesForAnalysis()` and the `selectedForAnalysis` state it populates make no `fetch`/server-function call — the extension point is inert state only. This boundary was explicitly regression-checked in Feature 003's T025 (network-tab inspection intent) and T027 (final sign-off) — see §5 for the disclosed verification gap on live browser confirmation.

### Retention

v1: unbounded retention. No automatic pruning/deletion of snapshots or source-selection state. (This matches Feature 001's own ratified retention decision in `specs/001-code-intelligence-foundation/spec.md`'s Clarifications — consistent posture across features, not a new decision invented here.)

## 5. Validation State

- `bunx tsc --noEmit`: clean.
- `bun run build`: successful (Cloudflare `cloudflare-module` preset, unchanged).
- Feature 001 regression: **31/31** passing (`tests/contract/code-intel/`, `tests/integration/code-intel/`). Note: this suite has a known pre-existing, unrelated flaky test (`repository-history.test.ts`'s timestamp-ordering assertion) — intermittent on a single run, passes on repeat; not a Feature 003 regression if seen.
- Feature 002 regression: **103/103** passing (`tests/contract/symbols/`, `tests/integration/symbols/`).
- Feature 003 new tests: `tests/unit/` + `tests/integration/repositories/`, **37/37** passing (31 unit + 6 integration, per `initial-sources.test.ts`).
- **Browser limitation, disclosed**: no browser extension was connected during Feature 003's implementation session — **no live click-through or extension-based interaction testing was performed.** Workflow verification (dialog opens, dropdown items wired to real handlers, network-tab-would-show-zero-calls, dev server boots clean at HTTP 200 with zero console errors on all 4 routes) was **code-level**: diff inspection, grep-based absence checks (no `code-intel` imports, no `"analyzed"` string anywhere in `SourcesDialog.tsx`), and structural reasoning (e.g., "the hook makes no fetch call of any kind" verified by reading the hook, not by observing network traffic). A real click-through with actual browser interaction and network-tab inspection is still recommended before considering Feature 003 fully sign-off-complete in a human sense.

## 6. Current Git State

- Feature 003 implementation is **complete** (T001–T028, code-verified per §5). No uncommitted assumptions — every task's completion note in `specs/003-github-source-enhancement/tasks.md` records what was verified and how.
- **Nothing has been committed this session or prior.** Branch `feat/atlas-marble-interaction` has no new commits beyond the initial repo history; all Feature 001/002/003 work exists as uncommitted tracked/untracked changes.
- Modified (tracked): `PROGRESS.md`, `README.md`, `bun.lock`, `package.json`, `src/components/atlas/SourcesDialog.tsx`, `src/lib/atlas-config.ts`, `src/lib/atlas-errors.ts`, `src/lib/repositories.functions.ts`, `src/routes/__root.tsx`, `src/routes/{catalogue,categories,index,insights}.tsx`, `tsconfig.json`.
- New/untracked, Feature 003: `src/components/atlas/ConnectedSourcesDialog.tsx`, `src/components/atlas/SourcesMenu.tsx`, `src/lib/connected-sources.ts`, `src/lib/repository-intelligence-extension-points.ts`, `src/lib/source-input-mode.ts`, `specs/003-github-source-enhancement/`, `tests/unit/`, `tests/integration/repositories/`.
- New/untracked, prior Feature 001/002 work (do not touch, not this feature's scope): `.claude/`, `data/code-intel-schema.sql`, `docs/features/`, `nitro.config.ts`, `plugins/`, `public/wasm/`, `research/`, `sdd/`, `specs/001-code-intelligence-foundation/`, `specs/002-ast-symbol-intelligence/`, `src/lib/code-intel/`, `wrangler.toml`.
- Deleted (tracked): `src/components/atlas/AtlasSourcesChrome.tsx` (T026).
- **Recommended commit point**: now, as one commit (or a small logical series) covering Feature 003 in full — `tsc`/build/full regression all clean, all 28 tasks done, no partial state. Suggested scope split if a series is preferred: (1) Feature 003 source files + tests, (2) `AtlasSourcesChrome.tsx` deletion, (3) `PROGRESS.md`/docs updates — but a single conventional-commit (`feat: consolidate GitHub source UX into Sources menu, add repository-selection extension point`) is equally defensible given the tight coupling between the task set.

## 7. Next Session Instructions

**Read first**: `specs/001-code-intelligence-foundation/spec.md` (already `Clarified`, and — contrary to this handoff's original premise — already fully planned and implemented; read it for the domain model/contracts Feature 002 and any future feature build on, not as a pending-plan document).

**Real next-action options** (pick one explicitly with the user before proceeding — do not assume):

1. **Resume Feature 002** (`specs/002-ast-symbol-intelligence/`) — 30/66 tasks done, core extraction path working (103/103 tests), remaining tasks (T036+: query functions, server-fn registration, later user stories) never started/authorized. If this is the priority, read `specs/002-ast-symbol-intelligence/tasks.md` in full before touching anything.
2. **Scope the next Code Intelligence phase** — per `research/ARCHITECTURE_DECISION_GATE.md` §13's revised phase sequence, the phase after AST/Symbols is Engineering Graph (`04-engineering-graph`), which has no spec yet. This would be a genuinely new `/speckit-specify` (not `/speckit-plan` — no spec exists to plan from).
3. **Wire the Feature 003 → Feature 001 hand-off** — build the "future snapshot acquisition server function" from §4's correct-flow diagram, consuming `SelectedRepositoryForAnalysis[]` and calling Feature 001's existing `acquireSnapshot`. This is new work not yet spec'd anywhere; would need its own `/speckit-specify` first.

**Do NOT, regardless of which option is chosen**:
- Modify Feature 003 (`specs/003-github-source-enhancement/`, `SourcesMenu.tsx`, `ConnectedSourcesDialog.tsx`, `connected-sources.ts`, `source-input-mode.ts`, `repository-intelligence-extension-points.ts`) — it is complete and regression-clean.
- Redesign the source flow (Sources dropdown, Add Sources two-mode dialog, Connected Sources popup) without a new ratified spec.
- Auto-wire snapshot acquisition into `getRepositories()` / `getRepositoriesHandler()` — the correct flow is `SelectedRepositoryForAnalysis[]` → a *dedicated* future server function, never piggybacked on repository browsing.
- Couple Code Intelligence (`src/lib/code-intel/**`) with the source UI layer without an explicit, ratified spec authorizing that integration.
- Run `/speckit-plan` against `specs/001-code-intelligence-foundation/spec.md` — already planned and implemented (see correction banner at top of this document).
