# Feature Specification: Code Intelligence Foundation

**Feature Branch**: `001-code-intelligence-foundation`

**Created**: 2026-09-19

**Status**: Clarified

**Input**: User description: "Establish the infrastructure required for RepoAtlas to acquire, identify, snapshot, and persist repository source independently of the GitHub/GitLab provider — the deterministic source foundation (Provider → Repository → Ref → Commit SHA → Source Snapshot → Files) that later AST, symbol, relationship, retrieval, and impact-analysis features will build on. See `research/ARCHITECTURE_DECISION_GATE.md` for the ratified architectural decisions this spec must not contradict."

## Clarifications

### Session 2026-09-19

- Q: Is GitLab content acquisition required as a second working provider implementation in this feature, or is a GitLab-ready abstraction with GitHub-only shipped sufficient? → A: GitHub-only ships in this feature. The constitution lists GitLab live sync as out of scope "unless a ratified spec adds them" (Technical Constraints), and this spec does not ratify shipping a working GitLab provider. The provider abstraction (FR-003) MUST remain GitLab-ready (no GitHub-specific shape leaking into the domain model), but a concrete GitLab `ContentProvider` implementation is deferred to a future feature, to be added only when a real GitLab acquisition need is ratified.
- Q: What specifically triggers snapshot acquisition in this feature's initial implementation? → A: An internal, developer/operator-facing server function — the same `createServerFn` RPC pattern the existing app already uses for repository metadata (`src/lib/repositories.functions.ts`) — callable directly for development/testing and callable by later features (e.g., a future AST extraction trigger) once they exist. It is explicitly NOT wired automatically into the existing GitHub metadata ingestion flow (`getRepositories`) in this feature, since that would require changing existing atlas behavior, which FR-039/FR-040 forbid. No visitor-facing UI trigger exists in this feature (see Out of Scope).
- Q: Is unbounded snapshot/file retention acceptable for v1, or is a retention/cleanup policy required before this feature is production-ready? → A: Unbounded retention is acceptable for this feature. No automatic snapshot/file expiry, pruning, or deletion mechanism is implemented. This follows constitution Principle V (Simplicity & Minimal Scope — avoid speculative abstractions not named in an approved spec) and mirrors the existing app's own posture (its SQLite/memory cache uses freshness TTLs for re-fetch decisions, not deletion). Storage growth is an accepted, explicit limitation of this feature, not a silent gap — a dedicated retention/cleanup policy is deferred to a future feature once real usage data shows it is needed.

## Relationship to Prior Research

This feature is grounded in, and must not contradict, the ratified decisions in `research/ARCHITECTURE_DECISION_GATE.md`: provider architecture (§1), snapshot acquisition strategy (§2), runtime model (§3), persistence architecture (§4), evidence model (§7), and the revised phase sequence (§13), together with the Feasibility Ratification section's findings on archive decoding, language distribution, and the WASM tree-sitter runtime. This spec covers only `sdd/01-foundation` and `sdd/02-source-snapshot` scope — it establishes the source foundation, not AST/symbol extraction (`sdd/03-ast-symbols`), which is a later feature.

## User Scenarios & Testing _(mandatory)_

<!--
  These user stories describe infrastructure outcomes consumed by later Code
  Intelligence features and by operators/developers, not by RepoAtlas's public
  visitors. There is no visitor-facing UI in this feature (see Non-Goals).
-->

### User Story 1 - Provider-independent repository identity (Priority: P1)

A developer working on any Code Intelligence feature can refer to a repository by a stable, provider-qualified identity, without that code depending on whether the repository came from GitHub, GitLab, or a future provider.

**Why this priority**: Every later capability (snapshots, files, symbols, graph, retrieval, impact analysis) addresses "a repository" as its root concept. If repository identity is provider-coupled from the start, every downstream feature inherits that coupling permanently. This must be right before anything else is built.

**Independent Test**: Register a repository originating from a GitHub source and a repository originating from a (future or stubbed) GitLab source, and confirm both are represented through the same repository-identity shape with no code path that inspects a GitHub- or GitLab-specific field to determine identity.

**Acceptance Scenarios**:

1. **Given** a repository identity, **When** any Code Intelligence component reads it, **Then** the component MUST be able to determine the repository unambiguously without querying a provider-specific API.
2. **Given** a GitHub repository and a GitLab repository that share the same owner/name string, **When** both are registered, **Then** they MUST be represented as two distinct repository identities with no collision.
3. **Given** a repository already known to the existing GitHub-metadata atlas, **When** a Code Intelligence repository identity is created for it, **Then** the two identities MUST be able to reference the same underlying repository without requiring the existing atlas code to change.

---

### User Story 2 - Deterministic ref resolution (Priority: P1)

A developer (or an automated caller) can resolve a branch, tag, or other ref to an immutable commit SHA before any acquisition or analysis work begins.

**Why this priority**: Every downstream artifact (snapshot, file, symbol, graph fact) must be traceable to an exact commit. If a mutable ref (like a branch name) were allowed to flow into acquisition or storage, "the same snapshot" could silently mean different content at different times, breaking reproducibility for every later feature.

**Independent Test**: Submit a repository identity plus a branch name; confirm the system returns a single, immutable commit SHA and that no acquisition step accepts a bare ref in place of a resolved SHA.

**Acceptance Scenarios**:

1. **Given** a repository and a branch or tag name, **When** ref resolution runs, **Then** the system MUST return exactly one immutable commit SHA.
2. **Given** a ref that does not exist on the provider, **When** ref resolution runs, **Then** the system MUST report a clear failure and MUST NOT produce a snapshot.
3. **Given** a ref that has already been resolved to a commit SHA, **When** the same ref is resolved again and the underlying branch has moved, **Then** the system MUST return the _new_ current SHA for that ref (ref resolution is always current-in-time; only the resulting SHA and its snapshot are immutable).
4. **Given** a commit SHA is already known, **When** acquisition or snapshot creation is requested, **Then** the system MUST accept the SHA directly without requiring a fresh ref resolution.

---

### User Story 3 - Reproducible source snapshot (Priority: P1)

A repository's contents at a specific commit SHA can be represented as a source snapshot that any later feature can depend on as authoritative evidence.

**Why this priority**: This is the central artifact the entire Code Intelligence initiative is built on (`research/ARCHITECTURE_DECISION_GATE.md` §2, §7's "commit-based source truth" discussion). Without a trustworthy, reproducible snapshot concept, no later evidence tag (EXTRACTED/RESOLVED/INFERRED/AMBIGUOUS/UNKNOWN) can be meaningfully anchored to anything.

**Independent Test**: Trigger snapshot creation for a small public repository at a known commit SHA twice; confirm both runs produce a snapshot representing identical file content for that SHA, and that the snapshot is never observable in a partially-created state.

**Acceptance Scenarios**:

1. **Given** a repository and a resolved commit SHA, **When** snapshot acquisition completes successfully, **Then** the resulting snapshot MUST be associated with exactly that one commit SHA and no other.
2. **Given** a snapshot acquisition in progress, **When** any component queries the snapshot's status, **Then** the system MUST report it as not-yet-complete and MUST NOT expose it as usable source evidence until acquisition finishes successfully.
3. **Given** a snapshot acquisition that fails partway through, **When** any component later queries that snapshot, **Then** the system MUST report a failed state, and no partial file data from the failed attempt may be presented as belonging to a complete snapshot.
4. **Given** two independent acquisition runs for the same repository and the same commit SHA, **When** both complete successfully, **Then** the resulting snapshots MUST represent identical file content (byte-for-byte, per file).

---

### User Story 4 - Source file inventory (Priority: P2)

A later feature (such as AST extraction) can enumerate a snapshot's files and their metadata, and retrieve any individual file's content, without needing the entire repository loaded into memory at once.

**Why this priority**: This is the access pattern every downstream feature (AST extraction first, then retrieval, impact analysis, etc.) needs. It builds directly on US3 but is a distinct, separately testable capability: a snapshot existing is not the same as a snapshot's contents being efficiently queryable file-by-file.

**Independent Test**: For a completed snapshot, list its files and confirm the list can be paged/streamed rather than requiring one unbounded response; fetch one file's content directly by its snapshot-scoped identity and confirm the fetch does not require touching any other file in the snapshot.

**Acceptance Scenarios**:

1. **Given** a completed snapshot, **When** its file inventory is requested, **Then** the system MUST return each file's path, size, and content-addressable identity without requiring the caller to download file content.
2. **Given** a file's snapshot-scoped identity, **When** its content is requested, **Then** the system MUST return exactly that file's content, retrieved independently of the rest of the snapshot.
3. **Given** a snapshot with a very large number of files, **When** the file inventory is requested, **Then** the response mechanism MUST support retrieval in bounded pages/batches rather than requiring the full list in one unbounded response.

---

### User Story 5 - Persistent snapshot storage (Priority: P1)

Snapshot metadata and source file content persist beyond any single Worker invocation and remain retrievable on demand.

**Why this priority**: Cloudflare Workers are stateless per invocation (`research/REPOATLAS_CURRENT_ARCHITECTURE.md` §12). Without durable persistence, no snapshot could ever be referenced by a later request, making every other user story in this feature moot in production.

**Independent Test**: Create a snapshot in one request/invocation; in a completely separate later invocation, query for that snapshot by identity and confirm both its metadata and its file content are retrievable unchanged.

**Acceptance Scenarios**:

1. **Given** a successfully completed snapshot, **When** the system is queried in a later, unrelated invocation, **Then** the snapshot's metadata MUST be retrievable exactly as it was at completion.
2. **Given** a successfully completed snapshot, **When** an individual file's content is requested in a later, unrelated invocation, **Then** the content MUST be byte-identical to what was stored during acquisition.
3. **Given** local development (no Workers runtime), **When** the same snapshot operations are performed, **Then** the system MUST behave consistently with production persistence semantics (mirroring the existing app's established local/production parity pattern, `research/REPOATLAS_CURRENT_ARCHITECTURE.md` §11).

---

### User Story 6 - Asynchronous, checkpointed processing (Priority: P2)

Large source acquisitions are processed through bounded, queue-driven units of work rather than a single synchronous request, and a failed or retried unit of work never corrupts or duplicates a completed snapshot.

**Why this priority**: This is what makes US3 actually work for real-world repositories under Cloudflare Workers' per-invocation CPU-time and memory limits (`research/ARCHITECTURE_DECISION_GATE.md` §3 and Feasibility Ratification's Archive Decode section). It is listed separately from US3 because it is independently testable: the failure-safety and idempotency behavior can be verified without needing an especially large repository to prove it.

**Independent Test**: Simulate a queued processing unit being delivered twice (duplicate delivery, a normal condition for at-least-once queues); confirm the resulting snapshot state is identical to what a single delivery would have produced, with no duplicated files and no corrupted metadata.

**Acceptance Scenarios**:

1. **Given** an acquisition large enough to require more than one unit of queued work, **When** processing runs, **Then** the system MUST complete it as a sequence of bounded units, none of which is required to hold the entire repository in memory at once.
2. **Given** a queued unit of work is delivered more than once (duplicate delivery), **When** both deliveries are processed, **Then** the resulting snapshot state MUST be identical to processing it exactly once (no duplicate files, no duplicate metadata rows).
3. **Given** a queued unit of work fails partway through, **When** it is retried, **Then** the retry MUST be able to complete the snapshot without requiring the entire acquisition to restart from the beginning, where checkpointing has been recorded.
4. **Given** an acquisition that never completes all of its required units (permanent failure), **When** any component queries the snapshot, **Then** it MUST be reported as failed, never as complete.

---

### User Story 7 - Incremental synchronization foundation (Priority: P2)

A later analyzer can identify a repository's most recent prior snapshot and determine, given a new commit SHA, whether a full re-acquisition or an incremental (changed-files-only) acquisition is appropriate.

**Why this priority**: This does not need to be fully exploited by this feature (incremental _analysis_ is a later feature's concern) but the foundation must expose enough relationship data — "this repository has these prior snapshots, at these commit SHAs, in this order" — for that decision to be made later without re-deriving it from scratch.

**Independent Test**: Create two snapshots for the same repository at two different commit SHAs; confirm a query can identify the more recent snapshot and retrieve both commit SHAs to support an external diff/comparison.

**Acceptance Scenarios**:

1. **Given** a repository with at least one prior completed snapshot, **When** a new snapshot is requested for a new commit SHA, **Then** the system MUST be able to report the prior snapshot's commit SHA to support a later incremental-vs-full decision.
2. **Given** a repository with multiple completed snapshots, **When** its snapshot history is queried, **Then** the system MUST return them ordered in a way that makes "most recent" unambiguous.
3. **Given** no prior snapshot exists for a repository, **When** a new snapshot is requested, **Then** the system MUST proceed as a full (bulk) acquisition with no incremental-comparison step required.

---

### Edge Cases

- What happens when a ref resolves to a commit SHA, but the repository's default branch changes between resolution and acquisition? The resolved SHA remains authoritative for that specific snapshot request; the snapshot represents the SHA it was given, not "whatever the branch currently points to."
- What happens when two acquisition requests for the same repository + same commit SHA are triggered concurrently? The second request MUST NOT create a duplicate snapshot; it MUST either join the in-progress acquisition or return the already-completed snapshot.
- What happens when the provider archive endpoint is unavailable or rate-limited during bulk acquisition? The acquisition MUST fail into a reportable, retryable failure state — it MUST NOT silently fall back to a partial snapshot.
- What happens when a repository is deleted or made private at the provider after a snapshot already exists? The existing snapshot remains valid, immutable evidence (it represents what was true at acquisition time); new acquisition attempts for that repository MUST fail cleanly.
- What happens when a single file within an otherwise-successful acquisition cannot be read/decoded? This is a per-file failure; the specification requires the overall snapshot to fail cleanly rather than silently omit the file and report success (finalization requires the full file set as inventoried during acquisition — see FR-015).
- What happens when the same commit SHA is requested for acquisition a second time after a snapshot for it already exists? The system MUST recognize the existing snapshot and MUST NOT re-acquire it (idempotent by commit SHA).
- What happens if archive decompression yields more files, or more total bytes, than the acquisition anticipated? Processing continues to completion via the bounded/checkpointed model (US6); there is no fixed repository-size ceiling in this specification, only a bounded-per-unit processing requirement.

## Requirements _(mandatory)_

### Functional Requirements

**Repository & provider identity**

- **FR-001**: System MUST represent repository identity as provider-qualified (at minimum: provider name + provider-native owner/organization + provider-native repository name), such that two repositories from different providers can never be conflated even if their owner/name strings are identical.
- **FR-002**: System MUST expose repository identity to Code Intelligence components as a provider-neutral value; no Code Intelligence component (snapshot, file inventory, or later AST/graph/retrieval feature) MAY depend on a provider-specific API shape to determine or use repository identity.
- **FR-003**: System MUST separate provider responsibilities into metadata acquisition (listing/describing repositories, as the existing GitHub integration already does) and content acquisition (fetching file trees/content at a ref), per `research/ARCHITECTURE_DECISION_GATE.md` §1; a given provider implementation MAY support one or both, and Code Intelligence components MUST depend only on the content-acquisition capability.
- **FR-004**: System MUST support GitHub as a content-acquisition provider in this feature. A working GitLab content-acquisition provider is explicitly NOT required by this feature (resolved 2026-09-19 — see Clarifications); the provider abstraction (FR-003) MUST remain capable of accommodating a GitLab implementation later without redesign, but shipping one is out of scope here.

**Ref & commit resolution**

- **FR-005**: System MUST accept a ref (branch name, tag name, or an already-known commit SHA) and resolve it to exactly one immutable commit SHA before any acquisition step begins.
- **FR-006**: System MUST treat a resolved commit SHA as immutable for the lifetime of any snapshot created from it; system MUST NOT treat a branch/tag name as a substitute for a commit SHA anywhere in the acquisition or storage pipeline.
- **FR-007**: System MUST report a clear, distinguishable failure when a requested ref does not exist on the provider, separate from other failure classes (e.g., network failure, rate limiting).

**Snapshot identity & lifecycle**

- **FR-008**: System MUST represent a source snapshot as uniquely identified by the combination of (provider-qualified repository, commit SHA), such that requesting a snapshot for a repository+SHA pair that already has a completed snapshot returns the existing snapshot rather than creating a duplicate.
- **FR-009**: System MUST track snapshot lifecycle status (at minimum: pending/in-progress, completed, failed) and MUST NOT allow a snapshot in any state other than completed to be consumed as source evidence by another feature.
- **FR-010**: System MUST guarantee that a snapshot, once reported as completed, represents the full, consistent file set acquired for that commit SHA — partial results MUST never be finalized as complete.
- **FR-011**: System MUST allow a failed snapshot acquisition to be safely retried (a new acquisition attempt for the same repository+SHA), and a retry MUST NOT be blocked or corrupted by remnants of the prior failed attempt.

**Acquisition — bulk (archive) and incremental (provider API)**

- **FR-012**: System MUST support bulk snapshot acquisition via the provider's repository archive (tarball) endpoint as the default acquisition mode when no relevant prior snapshot exists for the repository.
- **FR-013**: System MUST support incremental acquisition via the provider's content API (fetching only changed paths) when a prior snapshot for the same repository exists and the system can identify which paths changed between the prior commit SHA and the new one.
- **FR-014**: System MUST NOT use a git-clone-based acquisition mechanism in production (per `research/ARCHITECTURE_DECISION_GATE.md` §2 — no git binary/persistent disk available in the target runtime).
- **FR-015**: System MUST process bulk archive acquisition as a streaming pipeline (fetch → decompress → extract → store) and MUST NOT require the complete decompressed repository to be held in memory at any point, per `research/ARCHITECTURE_DECISION_GATE.md` Feasibility Ratification (Archive Decode).
- **FR-016**: System MUST decompress provider archives using gzip decompression support native to the target runtime (no additional native/binary dependency for the decompression step).
- **FR-017**: System MUST parse the archive's file-container format (tar) as a sequential stream, without requiring random access/seeking into the archive.

**File inventory & storage addressing**

- **FR-018**: System MUST record, for every file in a completed snapshot, at minimum: its path within the repository, its size, and a content-addressable identity (e.g., a content hash) sufficient to detect whether the same content already exists.
- **FR-019**: System MUST allow retrieval of an individual file's content by its snapshot-scoped identity, independent of retrieving any other file in the same snapshot.
- **FR-020**: System MUST allow file inventory for a snapshot to be retrieved in bounded pages/batches; the system MUST NOT require a single unbounded response for a snapshot's full file list.
- **FR-021**: System MUST store raw source file content as R2 object data and MUST store structured snapshot/file/job metadata (repository, ref, commit, snapshot status, file records, job status) in D1, per `research/ARCHITECTURE_DECISION_GATE.md` §4 — no dedicated graph database is introduced in this feature.
- **FR-022**: System MUST address R2 objects such that a file's storage location is derivable from its snapshot and file identity without requiring a separate lookup table entry per file solely for addressing purposes (content-addressing MAY additionally allow de-duplication of identical file content across snapshots).

**Asynchronous processing & queue semantics**

- **FR-023**: System MUST process snapshot acquisition (at minimum, the bulk archive path) as a sequence of bounded, independently-executable units of work, not as a single synchronous, unbounded operation.
- **FR-024**: System MUST make every unit of queued processing work idempotent: processing the same unit of work more than once (duplicate delivery, a normal condition for at-least-once queue semantics) MUST NOT produce duplicate files, duplicate metadata rows, or corrupted snapshot state.
- **FR-025**: System MUST record enough checkpoint information during bulk acquisition that a failed or interrupted unit of work can be retried without requiring the entire acquisition to restart from the beginning.
- **FR-026**: System MUST distinguish, in recorded snapshot/job state, between a job that is retrying, a job that has permanently failed, and a job that has completed — no ambiguity between "still trying" and "given up."
- **FR-027**: System MUST ensure that finalizing a snapshot as "completed" only occurs after every required unit of work for that snapshot has itself completed successfully.

**Incremental relationships**

- **FR-028**: System MUST record, for each snapshot, its repository and commit SHA such that a later query can retrieve a repository's snapshot history ordered by recency.
- **FR-029**: System MUST allow a caller to determine, given a repository, whether a prior completed snapshot exists and, if so, its commit SHA — supporting a later feature's full-vs-incremental acquisition decision without this feature needing to make that decision itself.

**Provenance & evidence**

- **FR-030**: System MUST make every stored file traceable to its provider, repository, commit SHA, and snapshot — sufficient provenance for later features to anchor EXTRACTED/RESOLVED/INFERRED/AMBIGUOUS/UNKNOWN evidence tags (`research/ARCHITECTURE_DECISION_GATE.md` §7) to a specific, reproducible source location.
- **FR-031**: System MUST record which acquisition mode (bulk archive vs. incremental API) produced each snapshot, and, where applicable, which provider API version/endpoint was used, to support future debugging of extraction discrepancies.

**Security & credential boundaries**

- **FR-032**: System MUST keep provider credentials (tokens) server-side only; no snapshot, file, or job record MAY contain provider credential material, consistent with the existing constitution's Server-Side Secrets principle (Principle III).
- **FR-033**: System MUST prevent a repository identity collision across providers from granting unintended cross-provider access to snapshot or file data (a GitHub repo and a GitLab repo with matching owner/name strings MUST remain fully isolated in storage and in access).
- **FR-034**: System MUST restrict snapshot acquisition to repositories the configured provider credentials are authorized to read (public repositories at minimum, matching the existing app's public-only scope per constitution Assumptions; authenticated/private-repo acquisition is not introduced by this feature).

**Observability**

- **FR-035**: System MUST record, for each acquisition attempt, at minimum: repository, provider, commit SHA, acquisition mode, start/end status, and duration.
- **FR-036**: System MUST record files-processed and bytes-processed counts sufficient to diagnose where a large-repository acquisition slowed or failed.
- **FR-037**: System MUST record queue retry counts and failure reasons per unit of work, sufficient to distinguish transient failures (worth retrying) from permanent ones (not worth retrying) during operational triage.
- **FR-038**: System MUST record checkpoint progress (e.g., units completed vs. units required) for in-progress bulk acquisitions, sufficient to diagnose a stalled or abandoned acquisition without re-running it.

**Protection of existing functionality**

- **FR-039**: System MUST NOT modify or degrade the existing GitHub repository metadata ingestion, in-memory/SQLite cache, search/filtering, taxonomy, or 3D visualization behavior (`research/REPOATLAS_CURRENT_ARCHITECTURE.md` §§1–8); this feature is additive infrastructure, not a replacement of the existing atlas data path.
- **FR-040**: System MUST NOT require any existing atlas route, component, or server function to change its behavior as a precondition of this feature being considered complete.

### Key Entities _(this feature is entirely data/infrastructure-oriented)_

- **Provider**: A repository hosting service (e.g., GitHub, GitLab) identified by a stable name; the source of both metadata and content acquisition capability for repositories it hosts.
- **Repository**: A provider-qualified, stable identity for a single repository (provider + owner/organization + name). Distinct from the existing atlas's GitHub-specific repository _metadata_ record — this entity exists to let Code Intelligence address "a repository" without depending on that metadata shape.
- **RepositoryRef**: A named pointer (branch, tag) within a repository that resolves, at a point in time, to a commit SHA. Refs are mutable over time; a given resolution result (the SHA) is not.
- **Commit**: An immutable commit SHA belonging to a repository, the unit every snapshot is anchored to.
- **Snapshot**: The repository's file content as it existed at one specific commit SHA. Uniquely identified by (repository, commit SHA). Has a lifecycle status and, once completed, is immutable and reproducible.
- **SnapshotFile**: One file's record within a snapshot — path, size, content-addressable identity, and a pointer to its stored content (R2). Retrievable independently of other files in the same snapshot.
- **AcquisitionJob**: A unit (or the overall coordinating record) of asynchronous, queue-driven work that acquires and processes a snapshot — carries status, checkpoint progress, retry count, and failure/completion state. May be decomposed into multiple smaller processing units for large repositories, per the bounded/checkpointed processing model (US6).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of repository identities created through this feature are provider-qualified; zero identity collisions occur between a GitHub and a GitLab repository sharing the same owner/name string in acceptance testing.
- **SC-002**: 100% of snapshots reachable through a query are associated with exactly one commit SHA; no snapshot record in acceptance testing is ever observed associated with a branch/tag name instead of a resolved SHA.
- **SC-003**: A snapshot created twice for the same repository and commit SHA produces byte-identical file content both times, verified across at least one real public repository in acceptance testing.
- **SC-004**: Bulk archive acquisition for a test repository completes without at any point requiring the full decompressed repository to be held in memory, verified by the acquisition being implemented as a bounded, streaming/checkpointed pipeline rather than a single buffer-then-process operation.
- **SC-005**: A duplicated delivery of any queued processing unit (simulated) produces identical resulting snapshot state to a single delivery, verified for at least one processing-unit type in acceptance testing (idempotency).
- **SC-006**: A snapshot acquisition that is interrupted or fails partway through is never observable, by any query, as "completed" — verified in acceptance testing by attempting to read snapshot status mid-failure and confirming a non-complete status is returned.
- **SC-007**: An individual file's content is retrievable from R2 using only its snapshot and file identity, without needing to re-read or re-process any other file in the snapshot, verified in acceptance testing.
- **SC-008**: Snapshot metadata created in one Worker invocation is retrievable, unchanged, from a separate later invocation in 100% of acceptance tests (persistence survives invocation boundaries).
- **SC-009**: All existing RepoAtlas acceptance criteria from `specs/001-dynamic-github-sources/spec.md` (repository metadata display, search, taxonomy, 3D visualization) continue to pass unmodified after this feature is implemented — zero regressions.
- **SC-010**: Zero AST parsing, symbol extraction, graph construction, search-index (BM25/vector), or MCP-tool functionality is required to exist for this feature's acceptance criteria to be met (non-goal boundary is provable by the test suite not needing any of it).

## Assumptions

- This feature has no visitor-facing UI; snapshot acquisition is triggered by an internal, developer/operator-facing server function (resolved 2026-09-19 — see Clarifications), following the existing `createServerFn` pattern; it is not wired automatically into existing repository ingestion in this feature.
- Snapshot acquisition in this feature operates on any provider-qualified repository identity supplied to it; it does not require the target repository to already exist in the existing GitHub-metadata atlas catalogue, though it may commonly be used for repositories that do.
- GitHub is the only provider with a working content-acquisition implementation delivered by this feature; the provider abstraction (FR-003) is designed to be GitLab-ready, but a working GitLab implementation is not required for this feature to be considered complete (resolved 2026-09-19 — see Clarifications and FR-004).
- Snapshot and file retention/expiry policy is unbounded for this feature — no automatic expiry, pruning, or deletion is implemented (resolved 2026-09-19 — see Clarifications). Unbounded storage growth is an accepted, explicit limitation, not a silent gap; a retention/cleanup policy is deferred to a future feature.
- The existing app's public-repositories-only scope (constitution Assumptions, `specs/001-dynamic-github-sources/spec.md` Out of Scope) continues to apply: this feature does not introduce private-repository or OAuth-authenticated acquisition.
- Cloudflare D1, R2, and Queues are available in both production and local-development environments (via Wrangler/Miniflare emulation), consistent with the existing app's established local/production parity pattern for its current SQLite-based cache.
- The specific maximum repository size processable within a single queued unit of work, and the exact checkpointing granularity, are implementation details left to the plan phase, per `research/ARCHITECTURE_DECISION_GATE.md` Feasibility Ratification's explicit "SPIKE REQUIRED" flag on this question — this spec requires bounded/checkpointed behavior to exist, not a specific numeric threshold.

## Out of Scope

- AST/Tree-sitter parsing of any file content.
- Symbol extraction of any kind.
- CALLS, IMPORTS, EXTENDS, IMPLEMENTS, or any other relationship resolution.
- Engineering Graph construction (nodes/edges beyond the Repository/Snapshot/SnapshotFile entities defined in this spec).
- BM25 or any lexical/full-text search implementation.
- Vector/embedding search.
- Impact analysis / blast-radius computation.
- Process discovery.
- MCP tool implementation of any kind.
- AI/LLM-based summarization of source content.
- Any Code Intelligence user interface (visualization, browsing, search UI for code-level data).
- A working GitLab content-acquisition provider implementation (the abstraction must accommodate one later; shipping one now is not required — see Assumptions/FR-004).
- Snapshot retention/expiry/cleanup policy implementation (unbounded retention accepted for this feature per Clarifications; a cleanup policy is a future feature).
- Any change to the existing GitHub repository _metadata_ ingestion, 3D atlas, catalogue, categories, or insights views.
