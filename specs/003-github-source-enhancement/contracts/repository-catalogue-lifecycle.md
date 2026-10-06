# Contract: Repository Catalogue, Lifecycle and Selection (Amendment A1, 2026-09-25)

**Documentation contract only — SPECIFIED, NOT IMPLEMENTED (spec.md Amendment A1; ADR-001). Shapes are normative intent for the later plan/tasks pass; exact table/column names are planning outputs.**

## Catalogue entry (discovery metadata — FR-A1-02)

```text
catalogue_repository:
  provider              'github' (others reserved)
  provider_repo_id      canonical identity (FR-A1-06)
  owner / name / url    lookup + display
  default_branch, visibility, primary_language, size,
  updated_at, archived, fork
  source_associations   many-to-many to configured sources
  lifecycle_state       DISCOVERED | SELECTED | QUEUED | ANALYZING | GRAPHIFIED | FAILED | PAUSED | REMOVED | PURGED
  selection             { selected: boolean, selected_at }
  graphification_stage  progressive stage marker (metadata → structure → symbols → relationships → …)
```

## Read contracts

- `getCatalogue({ filters?, page })` → **all** discovered repositories (FR-A1-01), bounded pages, with lifecycle state, stage and capacity summary `{ graphified, max: ATLAS_MAX_DEEP_ANALYSIS_REPOS }`. Never filtered to graphified-only by default.
- `getUniverse()` → same population projected for the Universe scene (Feature 009 consumes; marble state per ADR-001 §5.2).

## Mutation contracts (the only writes this amendment defines)

- `selectForAnalysis(repositoryId)` → SELECTED; rejects with typed `capacity_exhausted` when the plan would exceed `ATLAS_MAX_DEEP_ANALYSIS_REPOS` counting current GRAPHIFIED + planned (FR-A1-05; no silent eviction).
- `deselect(repositoryId)` / `pause(repositoryId)` / `resume(repositoryId)` — explicit, per repository; pause cascades to the Feature 004 job engine (its contract, guarantee 4).
- `removeRepository(repositoryId)` → REMOVED; retained intelligence kept (FR-A1-07).
- `purgeRepository(repositoryId, confirmation)` → PURGED; deletes per the purge manifest below; requires explicit confirmation naming the repository; never reachable from `Clear Sources`.

## Purge manifest (FR-A1-07)

Purge deletes, atomically per repository: source snapshots (filesystem), snapshot/file/extraction rows, symbol rows, relationship rows + candidates, process/impact data, semantic index entries, caches, and PENDING/RETRYING/FAILED jobs in the local job engine. It never touches other repositories' data and never mutates provider-side anything.

## Errors

Typed states only (`capacity_exhausted`, `not_found`, `invalid_state_transition`, `confirmation_required`); no raw errors, secrets, paths, SQL or stack traces (Feature 006 SEC precedent).
