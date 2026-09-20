# Phase 0 Research: Code Intelligence Foundation

All architectural unknowns this feature would otherwise raise were already resolved by prior research (`research/ARCHITECTURE_DECISION_GATE.md`, ratified 2026-09-19, including its Feasibility Ratification spike). This document restates the decisions relevant to `sdd/01-foundation` + `sdd/02-source-snapshot` scope in Decision/Rationale/Alternatives form, plus the handful of implementation-detail questions this plan itself resolves (not left as `NEEDS CLARIFICATION`).

## D1: Provider abstraction shape

- **Decision**: Two separate interfaces, `MetadataProvider` and `ContentProvider`; a concrete provider may implement one or both; Code Intelligence code depends only on `ContentProvider`.
- **Rationale**: The existing `github-fetch.ts` already conflates nothing — it simply _is_ metadata fetch, with zero abstraction today. Forcing one unified interface would let Code Intelligence accidentally depend on metadata-only fields (stars, topics) it has no business needing. Two interfaces cleanly separate "list/describe repos" from "fetch file content at a ref," matching the codebase's existing separation instincts (TanStack Query vs. Zustand).
- **Alternatives considered**: (A) single unified `SourceProvider` — rejected, risks scope leakage. (C) bolt-on content-fetch module with no shared abstraction — rejected, defers the real problem per `SOURCE_PROVIDER_ANALYSIS.md` §6.

## D2: Snapshot acquisition strategy

- **Decision**: Hybrid — bulk archive (`tar.gz` via `codeload.github.com/.../tarball/{sha}`) for cold/full acquisition; provider Contents/Compare API for incremental (changed-paths-only) acquisition when a prior snapshot exists. No git-clone in production.
- **Rationale**: Git-clone is eliminated outright — no git binary or persistent disk in Cloudflare Workers production. Pure per-file API fetch is rate-limit-expensive and slow for a cold full-repo index. Archive-only is wasteful for a one-file incremental change. The hybrid gets both: one bulk download for cold start, targeted per-path fetch for incremental deltas.
- **Alternatives considered**: (A) API-only — rejected for large repos (per-file rate-limit cost). (B) git-clone — eliminated by runtime constraint, not a discretionary choice. (C) archive-only — rejected, poor fit for small incremental re-syncs.

## D3: Archive format and decode mechanism

- **Decision**: Standardize on `tar.gz` (not `.zip`) for both providers; decode via Cloudflare's native `DecompressionStream("gzip")` + a hand-rolled sequential tar-entry parser.
- **Rationale**: Tar is an uncompressed, sequential, fixed-512-byte-header container requiring no seeking or central-directory lookup — a natural fit for streaming. Zip requires a central directory at the _end_ of the archive, a poor fit for sequential Worker-side streaming. `DecompressionStream` is a verified, built-in Workers platform primitive for gzip — no external library, no WASM, no native binary needed for decompression.
- **Alternatives considered**: `.zip` archives — rejected, streaming-hostile format. A gzip npm library — rejected, unnecessary given the native platform API.

## D4: Runtime/execution model for acquisition

- **Decision**: Asynchronous, queue-driven, many-bounded-invocations pipeline (Cloudflare Queues + ordinary Worker invocations), not a single synchronous request and not a separate always-on service.
- **Rationale**: Workers impose a hard per-invocation CPU-time bound, far smaller than "process an entire large repository." A separate analysis service would solve the CPU problem but introduces a second infrastructure/ops/cost surface, in tension with Principle V (Simplicity) and the existing all-Workers deployment story. Cloudflare Queues is a native platform primitive already available in the same account — no new infrastructure class, just a new binding.
- **Alternatives considered**: (A) entirely in one Worker invocation — disqualified outright for non-trivial repos. (C) separate container/service — held in reserve, not adopted, per research §3's explicit recommendation to prefer D unless D proves insufficient.

## D5: Persistence architecture

- **Decision**: Cloudflare D1 for all structured metadata (repository identity, refs, commits, snapshots, file inventory, job/checkpoint state); Cloudflare R2 for raw file blob content, content-addressed by hash. No dedicated graph database, no external Postgres.
- **Rationale**: This feature's data shape (repository/snapshot/file/job records) is relational/tabular, not graph-native — no traversal operator is needed in this feature at all (graph traversal is explicitly out of scope; that's a future feature's concern regardless). D1 is edge-native, callable from Workers with no outbound network hop, and has official local emulation via Wrangler/Miniflare, extending the existing `AtlasCache` pluggable-backend precedent. R2 is the correct tool for many large text blobs; D1 would be a poor fit for storing file content directly.
- **Alternatives considered**: External Postgres — rejected, adds a second network hop and ops/billing surface from every Worker call, in tension with Simplicity. Dedicated graph DB — rejected, not evidenced as necessary for this feature's node/edge-free scope (no AST/symbol/graph work exists yet).

## D6: Checkpoint/resume mechanism for large-archive acquisition (this plan's own resolution, not in prior research)

- **Decision**: Checkpoint by (dynamic) file-count/CPU-time budget; resume via **re-fetch-and-fast-forward** — re-request the same immutable, SHA-addressed archive URL and skip already-written entries (tracked via idempotent D1 lookups by path) until reaching the checkpoint cursor, then continue.
- **Rationale**: True byte-offset resume into a live HTTP+gzip+tar stream is not practically supported (no seek into a `DecompressionStream`, and the archive endpoint doesn't support HTTP range-resume of a decompression-in-progress). Re-fetching the same URL is cheap (content is immutable per commit SHA) and the skip-already-written-entries step reuses the same idempotent-insert mechanism already required for duplicate-queue-delivery safety (FR-024), rather than inventing a second resume mechanism.
- **Alternatives considered**: True byte-offset seek/resume — rejected, not practically supported by the underlying streams. Restart-from-scratch on every retry — rejected, defeats the purpose of checkpointing for genuinely large repositories (research explicitly requires checkpointing so a retry "MUST NOT require the entire acquisition to restart from the beginning," FR-025).
- **Confidence / open tuning question carried into tasks phase**: the exact checkpoint threshold (file count or elapsed CPU-time) is explicitly `SPIKE REQUIRED` per `research/ARCHITECTURE_DECISION_GATE.md` Feasibility Ratification — this plan fixes the mechanism, the tasks/implementation phase tunes the constant against a real timed run.

## D7: Language/AST scope

- **Decision**: N/A to this feature. Confirmed out of scope by spec (Out of Scope list) and constitution alignment — no AST, symbol, or language-specific work of any kind is introduced here, so `research/ARCHITECTURE_DECISION_GATE.md` §5's Tier 1 (Java/JS/TS) language findings are not consumed by this plan at all. Recorded here only to make the boundary explicit: a future `sdd/03-ast-symbols` feature consumes §5, not this one.

## D8: Testing approach

- **Decision**: Adopt `bun test` (Bun's built-in runner) for this feature's new code only; do not retroactively add tests for existing untested app code.
- **Rationale**: The repo has zero test infrastructure today (`bunx tsc --noEmit` is the sole gate). This feature is the first to need genuine correctness guarantees (idempotency under duplicate delivery, streaming-parser correctness across chunk boundaries) that a type-checker cannot catch. Bun's built-in runner requires no new dependency, matching the Bun-first toolchain already in use (`bunfig.toml`).
- **Alternatives considered**: Vitest/Jest — rejected, would be the first new test-framework dependency when a zero-dependency built-in option already fits; not justified by this feature's scope. Skipping tests entirely — rejected, the spec's own Acceptance Scenarios (idempotency, partial-failure-never-complete) are specifically the class of behavior that needs an executable check per Testing Strategy in plan.md.

## Summary: no `NEEDS CLARIFICATION` markers remain

Every Technical Context field in `plan.md` is resolved from either prior ratified research or this document's D6/D8 resolutions. No open unknown blocks Phase 1 design.
