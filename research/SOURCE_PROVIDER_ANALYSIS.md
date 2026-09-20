# Source Provider Analysis — GitHub/GitLab & Snapshot Readiness

Evidence tags as in `REPOATLAS_CURRENT_ARCHITECTURE.md`.

## 1. Current provider surface

[RESOLVED] RepoAtlas has exactly one source provider: GitHub REST, called directly from `src/lib/github-fetch.ts`. There is no `SourceProvider` interface, no factory, no registry — `repositories.functions.ts:13` imports and calls GitHub-specific functions by name. GitLab exists only as unused UI iconography and marketing copy (`src/routes/index.tsx:47,36,253`); `docs/dynamic-sources-prompt.md:120,176` documents this as an intentional non-goal for the shipped feature ("GitLab live sync (badge may stay decorative)").

**Consequence**: introducing a second provider (GitLab, or a generic "source snapshot" abstraction for Code Intelligence) is not a matter of implementing an existing interface — the interface itself does not exist and must be designed.

## 2. What the current fetch layer gives for free

[EXTRACTED]

- Pagination handling (up to 10 pages × 100/page, `github-fetch.ts:118-227`).
- Bounded concurrency (`mapWithConcurrency`, concurrency=3, lines 234-253, 289) — a reusable primitive.
- Source URL parsing/normalization (`github-url.ts`: `parseSourceInputs`, `sourceKeyFromParsed`, `includesDefaultOwner`).
- A `source_key` concept already exists in the schema (`data/schema.sql`, `repositories.source_key`) tying a fetched repository back to its originating source row.

[INFERRED] These pieces (pagination, concurrency control, source-key addressing) are the right primitives to carry forward into a Code Intelligence ingestion path — they just need to sit behind a provider-neutral interface rather than being GitHub-specific.

## 3. What's missing for a commit/snapshot-addressable model

[EXTRACTED] `repositories` table stores `payload_json` (an API response blob) keyed by `source_key` + `fetched_at` — there is **no commit SHA column, no snapshot table, no file-index table**. The data model captures "the repository as GitHub's API described it at fetch time," not "the repository's source tree at commit X."

[RESOLVED] To support the proposed `Provider → Repository → Commit/Snapshot → File Index → AST → Symbols → Relationships → Engineering Graph` pipeline (see `REPOATLAS_EVOLUTION.md` and `SDD 02-source-snapshot`), the schema needs new tables/columns for at minimum: snapshot identity (repo + commit SHA), a file index (path, blob hash, language) per snapshot, and a way to mark a snapshot as the "authoritative evidence layer" independent of the existing `payload_json` cache row. None of this exists today — it is new schema, not an extension of `repositories.payload_json`.

## 4. Reference-project provider patterns worth adapting (not copying)

[RESOLVED — Graphify] Graphify has no notion of "provider" in the GitHub/GitLab sense — it operates on a local checked-out directory (`detect.py` → `extract.py` walks a filesystem path). Its relevant transferable concept is the **PR integration surface** (`graphify/prs.py`, MCP tools `list_prs`/`get_pr_impact`/`triage_prs`), which shells out to `gh` CLI for live GitHub PR state layered on top of the already-built graph — i.e., GitHub integration happens _after_ graph-build, as an overlay, not as the ingestion mechanism itself.

[RESOLVED — CodeGraph] CodeGraph is also local-filesystem-first (`.codegraph/` per project, indexed from a working directory), not a hosted-API-driven ingestion tool. Its `indexed_at_commit` field (`project_metadata` table, `src/extraction/index.ts:1319`) is the closest analog to a "snapshot" concept: it stores the git HEAD SHA the index was last synced to, purely to drive **incremental change detection** via `git diff --name-status` (`getGitChangedFiles`, lines 1292-1375) — not as a queryable historical-snapshot store. CodeGraph keeps only the _current_ indexed state; there is no multi-version history table.

**Implication for RepoAtlas** [INFERRED]: neither reference project solves "ingest a hosted repo via API and snapshot it at a commit SHA" — both assume a local git checkout is already present. RepoAtlas's GitHub-API-first ingestion model is a genuinely different starting point than either reference architecture. If Code Intelligence needs AST-level analysis, RepoAtlas will need either (a) a step that clones/checks out the repo at a specific SHA (introducing a new dependency on git tooling and disk/ephemeral-storage, in tension with the Workers-only production constraint — see `REPOATLAS_CURRENT_ARCHITECTURE.md` §12), or (b) an API-based file-content-fetch path (GitHub Contents API / Git Trees API) that avoids a full clone but is slower and rate-limited for larger repos. This is a genuinely open architectural question, not resolved by either reference repo.

## 5. Cloudflare Workers constraint interacts directly with provider design

[EXTRACTED] Production preset is `cloudflare-module` (`vite.config.ts:20`); `canUseSqlite()` disables local SQLite in that environment (`atlas-store.ts:47-54`). [INFERRED] The same edge constraints that force memory-only caching in prod today will force any snapshot/AST storage to live outside the Worker process too — e.g. D1/R2/external Postgres, or an entirely separate indexing service the Worker calls into. This is a first-order design constraint for both provider architecture and snapshot persistence, not a detail to defer.

## 6. Open questions (flagged, not resolved)

- [UNKNOWN] Whether GitLab support is still a product goal, or was permanently descoped when `docs/dynamic-sources-prompt.md` was written.
- [UNKNOWN] Whether Code Intelligence ingestion is expected to reuse the existing GitHub REST fetch path, or introduce a parallel git-clone-based path — this materially changes provider abstraction design and should be settled before `sdd/02-source-snapshot` work begins.
- [INFERRED] A provider abstraction designed now should anticipate both "API-metadata provider" (current GitHub use case) and "source-content provider" (new Code Intelligence need) as potentially distinct interfaces rather than forcing one interface to do both jobs.
