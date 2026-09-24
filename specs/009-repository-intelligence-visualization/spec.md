# Feature Specification: Repository Intelligence Visualization

**Feature Branch**: `009-repository-intelligence-visualization` (specification only; no dedicated git branch)

**Created**: 2026-09-24 20:25 +04:00

**Status**: Draft (specified and planned; awaiting review before implementation of tasks that depend on the open decisions D1–D3 below)

**Input**: user goal "Implement RepoAtlas Feature 009 — Repository Intelligence Visualization", with two mandatory real-data acceptance targets: user scope `https://github.com/imdadareeph` and repository `https://github.com/fib1618agent/repo-atlas`.

## Relationship to Prior Decisions *(context, not part of the delivered feature)*

- **Feature 004 (Engineering Relationship Graph) is BLOCKED at T007** (X = CONTRADICTORY, Y = PARTIAL, LX-1 not authorized, no waiver). Feature 009 does **not** depend on it and MUST NOT implement, simulate, bypass or infer relationship data. It defines only a boundary (FR-009).
- **Features 001/002** (source snapshots, AST/symbol intelligence, D1 tables `snapshots`, `snapshot_files`, `directories`, `file_extractions`, `symbols`, `snapshot_extractions`) are the authoritative structural data. They are read, never modified (FR-019).
- **Feature 003** provides the existing GitHub source/provider abstraction (`getRepositories`, `github-fetch.ts`, `github-url.ts`, the sources store). Feature 009 reuses it and adds **no** GitHub integration (FR-004).
- **Feature 006** supplies conventions reused here: read-only server functions built as plain handler + `createServerFn` wrapper, SELECT-only D1 status modules, discriminated availability states (`no_binding`), `bun test --isolate` + `tests/support/d1-sqlite-adapter.ts`, atlas page shell and shadcn primitives.
- **Feature 007 (MCP)** is independent and not touched.
- **Existing extension seam**: `src/lib/repository-intelligence-extension-points.ts` (Feature 003) is a hand-off type only; it is not modified.

## Product hierarchy *(normative)*

```
User / Owner  →  Repositories  →  Selected Repository  →  Repository Intelligence  →  Directories / Files  →  Symbols
```

The user/owner level is **GitHub ownership and catalogue context only**. It is never an engineering relationship graph; ownership or "repository belongs to user" links are not `IMPORTS`/`CALLS`/… relationships and are never drawn or labelled as such.

Conceptual levels: **L0** Universe (existing Explore/Catalogue) · **L1** Repository Intelligence · **L2** Code Structure · **L3** Relationship/Execution (**unavailable** in this feature; boundary only).

## Clarifications and Open Decisions

- **D1 (proposed, not user-confirmed): read-only, no acquisition trigger.** The view reads the latest *completed* snapshot that already exists; it never calls `acquireSnapshot`/enqueues work and never writes. Rationale: Feature 006 read-only precedent; selecting a repository must not cause queue/D1 writes. Also, `getRepositoryHistory` (Feature 001) calls `getOrCreateRepository` (a D1 write) and is therefore **not** used; Feature 009 has its own SELECT-only lookup.
- **D2 (proposed): renderer is SVG (2D) with an accessible outline twin, not react-three-fiber.** The existing marble scene uses R3F; the repository view needs keyboard-operable, testable, bounded DOM nodes. Layout is a pure module so a 3D renderer can be added later without changing data or layout contracts.
- **D3 (needs user authorization): how real-data intelligence is produced for validation.** In plain `./run.sh` there are no D1/R2/Queue bindings (Feature 006 shows `no_binding`), so F001/F002 intelligence for `fib1618agent/repo-atlas` cannot exist through the app. Options: (a) opt-in real-data integration test that runs the existing F001/F002 pipelines against the public GitHub archive into the existing sqlite D1 adapter (no Cloudflare); (b) `wrangler dev --local` emulation plus a manual ingest (local, but Wrangler); (c) live Cloudflare (not proposed; prohibited without authorization). Until D3 is decided, browser acceptance covers the unavailable/no-snapshot paths against the real public targets, and the with-data UI paths are covered by (a) plus fixtures derived from real output, each labelled honestly (see quickstart).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Open a repository's intelligence view (Priority: P1, MVP)

From the catalogue (user-level scope) or Explore, a user selects a repository and enters a dedicated Repository Intelligence view showing identity, metadata, intelligence summary and language composition, or an honest state explaining why intelligence is missing.

**Independent Test**: open `/repository/fib1618agent/repo-atlas` (after loading the public source) → identity `fib1618agent/repo-atlas` and metadata render from the Feature 003 provider; with no snapshot/binding an explicit state is shown, never a blank or fabricated summary.

**Acceptance**: AT-009-01, AT-009-02, AT-009-03.

### User Story 2 — Explore structure progressively (Priority: P1)

Repository → directory/module → file, one level at a time, with breadcrumb/back, zoom/pan, focus and keyboard operation; bounded node counts.

**Acceptance**: AT-009-04.

### User Story 3 — Drill into symbols (Priority: P2)

File → its Feature 002 symbols (kind, name, hierarchy) → symbol detail with provenance.

**Acceptance**: AT-009-04, AT-009-05.

### User Story 4 — Honest relationship boundary (Priority: P2)

Relationship intelligence is explicitly represented as unavailable/not yet connected, with a defined boundary Feature 004 can later fill. No edge, thread or execution path is drawn.

**Acceptance**: AT-009-05, AT-009-06.

### User Story 5 — Return and repeat without regression (Priority: P2)

Navigating back preserves owner/repository context and unrelated state (loaded sources, filters, preferences); a second repository works identically.

**Acceptance**: AT-009-07, AT-009-08.

### Acceptance Tests *(from the user's real-data requirements)*

- **AT-009-01** Open user scope `https://github.com/imdadareeph` → the user-level catalogue renders accessible repositories.
- **AT-009-02** Select `https://github.com/fib1618agent/repo-atlas` → transition into the dedicated Repository Intelligence view.
- **AT-009-03** Identity is owner = `fib1618agent`, repository = `repo-atlas`.
- **AT-009-04** Explore Repository → directories/files → available symbols.
- **AT-009-05** Visualization uses authoritative Feature 001/002 data and fabricates no Feature 004 relationships.
- **AT-009-06** Relationship layer unavailable is represented explicitly, not with invented edges.
- **AT-009-07** Return to the user/repository catalogue preserves owner/repository context and does not reset unrelated state.
- **AT-009-08** Repeat with a second accessible repository from the user scope; nothing is repo-atlas-specific.

Evidence classes (each result is reported PASS / FAIL / NOT VERIFIED): **PROVIDER** (Feature 003 data, works in plain dev), **INTEL** (needs populated F001/F002 data; see D3), **UI** (browser).

### Edge Cases

- Owner/repository casing differs between URL and provider (`FIB1618agent`): canonical `full_name` from the provider is authoritative; the view redirects/normalizes and identity stays consistent.
- Repository not found / private / rate-limited / provider failure: distinct `not_found` / `provider_error` states.
- Repository exists but no completed snapshot; snapshot in progress; extraction `not_started`/`completed_partial`/`failed`; zero files; zero symbols; unsupported-language files; very large directory (thousands of children); deep paths; special characters in paths.
- D1 unavailable (`no_binding`) versus D1 available but empty.
- Route params that are malformed or attempt injection.
- Owner-level context missing (deep link opened without a loaded source).

## Requirements *(mandatory)*

- **FR-001**: Selecting a repository from the Catalogue or Explore MUST open a dedicated view at `/repository/$owner/$name`, deep-linkable and back-navigable.
- **FR-002**: The repository identity (`provider = github`, canonical owner, name) MUST come from the route and be verified against the Feature 003 provider's canonical `full_name`; it MUST be displayed and passed unchanged to every data call in the view; a mismatch MUST produce an explicit `identity_mismatch` state.
- **FR-003**: The owner/user level MUST be presented as catalogue/ownership context only, never as relationship intelligence.
- **FR-004**: Repository metadata and user-scope catalogues MUST come from the existing Feature 003 provider abstraction (`getRepositories` and the sources store contracts). No new GitHub integration, HTTP client or API call site is added.
- **FR-005**: The overview MUST show identity, provider metadata (description, primary language, topics, stars, forks, updated), and, when a completed snapshot exists, the snapshot commit, extraction status, file/symbol counts, language composition and file distribution.
- **FR-006**: Structure MUST be explorable one directory level at a time (Repository → Directory → File), with breadcrumb and back navigation; each step MUST fetch only a bounded page.
- **FR-007**: For a file, the view MUST list its Feature 002 symbols (kind, name, position, parent hierarchy) and show symbol detail with provenance using existing Feature 002 data.
- **FR-008**: Only authoritative data MAY be visualized: provider metadata, Feature 001 files/snapshots, Feature 002 directories/file extractions/symbols. Containment is shown only where it is stored (directory hierarchy, file→symbol, `parent_symbol_id`). No inference, AI content or synthesized structure.
- **FR-009**: Relationship intelligence MUST be shown as **unavailable / not yet connected**. A typed boundary (`RelationshipLayer` port) MUST exist that a later Feature 004 adapter can implement to supply relationship types, evidence states (`EXTRACTED`, `RESOLVED`, `INFERRED`, `AMBIGUOUS`, `UNKNOWN`), bounded traversal and candidate sets. In this feature the only implementation is `unavailable`; no edge, thread, or execution path is ever rendered.
- **FR-010**: The feature MUST be read-only: SELECT-only D1 access, no writes, no queue sends, no snapshot acquisition, no repository-row creation.
- **FR-011**: The UI MUST represent each state distinctly and honestly: loading, ready, partial, empty (no files / no symbols), not extracted, no snapshot, snapshot in progress, intelligence unavailable (no D1), provider error, not found, identity mismatch.
- **FR-012**: Rendering MUST be bounded by explicit named limits (max visible nodes per view, max children page, max symbols rendered per file); overflow MUST be aggregated into an explicit "+N more" element with its true count; nothing unbounded is fetched or rendered.
- **FR-013**: The view MUST support zoom, pan, selection, focus, drill-down, breadcrumb/back, and name/kind filtering of the current level's loaded page.
- **FR-014**: The view MUST be operable by keyboard, expose semantic controls, visible focus, accessible labels, a text summary of the current level, and an equivalent accessible outline of what the visual shows.
- **FR-015**: The layout MUST NOT cause horizontal page overflow at narrow widths (390 px); it degrades to a stacked layout.
- **FR-016**: Navigating from the view back to the Catalogue/Explore MUST preserve loaded sources, filters, sort, preferences and the selected repository context; Feature 009 MUST NOT write to the sources store or existing filter/preference state.
- **FR-017**: No code, constant, path or label MAY be specific to `repo-atlas` or `imdadareeph`; both are test data only.
- **FR-018**: No new dependency, graph database, vector store, LLM/AI generation or new infrastructure.
- **FR-019**: Feature 001/002 contracts, tables and source files MUST NOT be modified; Feature 004, 005 and 007 artifacts are untouched.
- **FR-020**: The visual language MUST reuse existing atlas tokens/classes and the repository's category colour token; no unrelated UI system.

### Non-functional and security

- **NFR-001**: Layout is deterministic: identical input produces identical positions (no randomness).
- **NFR-002**: DOM/SVG node count per view is bounded by FR-012 limits and asserted by a test.
- **NFR-003**: Each navigation step issues a bounded number of read queries, each with a page limit no greater than the existing `listFilesMaxLimit`.
- **SEC-001**: Route params are validated (owner and name character sets/lengths) and only ever passed as bound SQL parameters or provider inputs; never interpolated.
- **SEC-002**: Responses contain no secrets, filesystem paths, SQL, stack traces or infrastructure identifiers; failures are typed states, not thrown raw errors.
- **SEC-003**: Only SELECT statements are issued (asserted by a test, as in Feature 006).

### Key Entities

- **RepositoryContext**: identity + provider metadata + owner context (from Feature 003).
- **IntelligenceSnapshotSummary**: latest completed snapshot (id, commit SHA, completed at), extraction status and counts, composition.
- **StructureLevel**: one directory's bounded children (child directories with aggregated counts, files with size/language/extraction status).
- **FileSymbols**: bounded symbol list with hierarchy for one file.
- **RelationshipLayer**: boundary state and port (`unavailable` now).

## Success Criteria *(mandatory)*

- **SC-001**: At every step of AT-009-02…AT-009-07 the displayed owner and repository equal the selected ones (0 mismatches).
- **SC-002**: A test proves no relationship edge/thread/execution-path element or datum can be produced by this feature (only the `unavailable` layer exists).
- **SC-003**: No view exceeds the named node limits, including for a synthetic directory with thousands of children.
- **SC-004**: Every state in FR-011 has a distinct, tested rendering.
- **SC-005**: At 390×844 there is no horizontal page overflow and all controls are usable.
- **SC-006**: Existing routes (`/`, `/catalogue`, `/categories`, `/insights`, `/about`, `/settings`) behave as before; the only edits to them are the entry links.
- **SC-007**: A second repository from the `imdadareeph` scope renders through the same code paths.

## Assumptions

- Real-data intelligence for a repository exists only if a completed F001/F002 snapshot exists in the D1 the app reads (D3).
- The Feature 003 provider is reachable for public GitHub data; unauthenticated rate limits may apply (`provider_error` state).
- Category colour, language colour and atlas classes already exist and are reused.

## Non-Goals / Deferred

Relationship extraction or display (Feature 004); execution paths/processes/blast radius; snapshot acquisition or extraction triggers; diff/history views; editing anything; MCP/agents; AI summaries in this view; graph or vector storage; a 3D renderer (layout keeps that door open).
