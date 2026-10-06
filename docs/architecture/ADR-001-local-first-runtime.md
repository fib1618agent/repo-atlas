# ADR-001 — Local-First Runtime and the Universe / Repository Graph Product Model

**Status:** ACCEPTED (documentation decision; implementation NOT authorized by this ADR)
**Date:** 2026-09-25 · **Decided by:** user (session `architecture-change-fable`, decisions D-ARCH-1…6) · **Source prompt:** `docs/prompts/architecture-revisit/RepoAtlas_Complete_Architecture_Revision_Prompt.md`
**Supersedes:** the Cloudflare-Queue execution premise of Feature 004 (see §6) and the operative role of Feature 005's Cloudflare CPU gate (see §7). It does **not** supersede Feature 001/002 contracts, the evidence model, the eight relationship types, or any delivered feature behavior.

---

## 1. Decision

RepoAtlas becomes a **local-first engineering intelligence platform**. The core product rule:

> **See everything. Graph deeply where selected.**

- Every discovered repository is visible (Universe + Catalogue); only user-selected repositories receive expensive deep graph analysis ("graphification").
- The core runtime must work offline after repository acquisition and must not **require** Cloudflare Workers/Queues/D1/R2, Redis, Kafka, RabbitMQ, PostgreSQL, hosted graph databases, hosted vector databases, or remote LLMs. External providers (GitHub, GitLab) are used for source acquisition/update only.
- Persistence: **SQLite** (metadata, durable job queue, relationship graph as indexed relational tables) + **filesystem** (snapshots, artifacts). No graph database by default; one may be considered later only on workload evidence.
- Deep graphification runs on a **local durable job system** (§9), replacing the Cloudflare Queue dependency in unimplemented work.

## 2. Recorded decisions (user-approved 2026-09-25)

| ID | Decision |
|---|---|
| D-ARCH-1 | Discovery/catalogue/lifecycle/selection/remove-purge specifications live in **Feature 003** (governed amendment); the local durable job engine lives in **Feature 004**. No new feature number. |
| D-ARCH-2 | **Rust is the preferred production core** (native Tree-sitter, parallel parsing, durable jobs, SQLite, traversal, MCP, single-binary potential) — recorded as preference only. Near-term local runtime = existing TypeScript pipelines + the sqlite D1 adapter + a local job engine (feasibility evidenced by Feature 009 D3(a)). TypeScript remains the UI/client language; Python remains research/prototyping only. |
| D-ARCH-3 | Redefined **T007 = Local Relationship Engine Feasibility** replaces the STOPPED Cloudflare CPU gate as the Feature 004 T008+ precondition. `T007-CAL-1` becomes historical (never authorized, never run; still authorizable on request). |
| D-ARCH-4 | Cloudflare remains an **optional deployment adapter** (existing F001/F002 D1/R2/Queue code is not deleted from the architecture); it is simply no longer the core runtime. |
| D-ARCH-5 | New configuration keys keep the existing **`ATLAS_` prefix** (e.g. `ATLAS_MAX_DEEP_ANALYSIS_REPOS`); the revision prompt's `REPOATLAS_*` / camelCase names are recorded as aliases in documentation only. |
| D-ARCH-6 | **512 KiB default max parse file size** is documented as a *proposed* default pending redefined-T007 measurement; the implemented `CODE_INTEL_MAX_FILE_SIZE_BYTES` (10 MiB) is unchanged until then. Oversized files retain structural metadata rather than disappearing (policy detail specified with T007 evidence). |

## 3. Architecture layers

```text
1. Source Providers        (GitHub today; GitLab/local reserved — Feature 003)
2. Repository Discovery    (lightweight metadata only — Feature 003)
3. Repository Catalogue    (all discovered repositories — Feature 003)
4. Source Snapshot         (Feature 001, unchanged contracts)
5. File Classification     (Feature 002, unchanged contracts)
6. AST / Symbol Intelligence (Feature 002, unchanged contracts)
7. Relationship Graph      (Feature 004)
8. Local Durable Job Engine (Feature 004)
9. Search / Retrieval      (FTS/BM25; optional semantic — future)
10. Process Analysis       (future)
11. Impact Analysis        (future)
12. Optional Semantic Index (local-only, never required — future)
13. MCP                    (Feature 007 — interface over the engine, never the engine)
14. Visualization          (Feature 009)
```

Core separation: **Repository Discovery ≠ Repository Graphification ≠ Visualization.**

## 4. Canonical diagram

```text
                    REPOATLAS
                        │
                        ▼
                 SOURCE PROVIDERS
                        │
                        ▼
                  DISCOVERY LAYER
                        │
                        ▼
               REPOSITORY CATALOGUE
                        │
                 filter / select
                        │
                        ▼
                DEEP ANALYSIS PLAN
                        │
                        ▼
                LOCAL JOB ENGINE
                        │
                        ▼
              REPOSITORY GRAPHIFICATION
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
         AST        RELATIONSHIPS   SYMBOLS
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                PROCESS / IMPACT
                        │
                        ▼
              OPTIONAL SEMANTICS
                        │
                        ▼
                 ATLAS INTELLIGENCE
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
       UNIVERSE VIEW        REPOSITORY GRAPH
       all repositories      one repository
             │                     │
             └──── click marble ───┘
                        │
                  Back to Universe
```

## 5. Product model

### 5.1 Two visualization scopes (owned by Feature 009)

- **UNIVERSE** — all discovered repositories as marbles: identity, source, category, language, metadata, repository-level connectivity, lifecycle + graphification status. A repository does **not** need graphification to appear.
- **REPOSITORY(repositoryId)** — the deep intelligence of one graphified repository: AST, files, symbols, imports, calls, references, implementations, inheritance, relationships, process paths, semantic connections, impact, evidence — through focused perspectives (Structure, Symbols, Call Graph, Relationships, Processes, Semantic, Impact) over one underlying model. Clicking a graphified marble zooms into this scope; `← Back to Universe` restores the prior Universe state (zoom, camera, filters, category/source selection, highlighted repository) as a first-class navigation state; breadcrumb `Universe › <repository> › <perspective>`.

### 5.2 Repository lifecycle

```text
DISCOVERED → SELECTED → QUEUED → ANALYZING → GRAPHIFIED
plus: FAILED · PAUSED · REMOVED · PURGED
```

- DISCOVERED: metadata known; visible in Universe/Catalogue; consumes no deep-analysis capacity.
- GRAPHIFIED: deep intelligence available; marble gets a strong visual state (glow/halo/intelligence-ready) within the existing design language.
- FAILED remains visible. REMOVED (association dropped from active state) ≠ PURGED (local snapshots, indexes, relationships, process/impact data, semantic index, caches and queued jobs deleted after explicit confirmation). `Clear Sources` never silently means permanent deletion.
- Conceptual marble states: `●` DISCOVERED · `◌` QUEUED · `◉` ANALYZING · `✦` GRAPHIFIED · `⊗` FAILED · `◇` PAUSED.
- Graphification is **progressive**: metadata → source acquired → structure → AST/symbols → relationships → call graph → process/impact → optional semantic index → GRAPHIFIED; the UI may represent intermediate stages.

### 5.3 Capacity model

```text
ALL discovered repositories → visible in Universe + Catalogue
DEEP graphification         → limited independently
```

Defaults (RepoAtlas-local engineering/resource controls, all configurable, all category B in Feature 006's read-only model; not provider limits):

| Key (D-ARCH-5 naming) | Default | Meaning |
|---|---|---|
| `ATLAS_MAX_DEEP_ANALYSIS_REPOS` | 5 | Max concurrently GRAPHIFIED repositories (initial product default, not an architectural constant) |
| `ATLAS_MAX_CONCURRENT_ANALYSES` | 2 | Parallel deep-analysis runs |
| `ATLAS_MAX_QUEUED_ANALYSES` | 20 | Queued deep-analysis jobs |
| (proposed, D-ARCH-6) max parse file size | 512 KiB | Pending T007 measurement; `CODE_INTEL_MAX_FILE_SIZE_BYTES` = 10 MiB until then |
| (future safeguards) | — | maxRepositorySize, maxTotalSourceSize, maxRetainedSnapshots — designed with T007 evidence |

Invariants: 100 discovered → 100 visible → 5 graphified → 95 discovered-only. Never silently select the first N. At capacity, never silently evict; the user must deselect, pause or remove a graphified repository first. Pagination/lazy rendering are presentation concerns, never analysis restrictions. **Not to be confused with `ATLAS_MAX_SOURCES = 5`**, the existing cap on source URLs (unchanged): one source may discover hundreds of repositories.

### 5.4 Source vs repository

A SOURCE resolves to many REPOSITORIES (e.g. a GitHub user → all their repositories). Canonical repository identity is **provider identity (provider repository ID)**, not URL or `(owner, name)` alone; the same repository discovered from multiple sources is deduplicated to one intelligence record (many-to-many source associations). The existing `(provider, owner, name)` key remains a lookup.

## 6. Feature 004 execution model change

Feature 004 remains the **Engineering Relationship Graph** with its ratified relationship types (`CONTAINS`, `IMPORTS`, `EXPORTS`, `CALLS`, `EXTENDS`, `IMPLEMENTS`, `USES`, `REFERENCES`), evidence states (`EXTRACTED`, `RESOLVED`, `INFERRED`, `AMBIGUOUS`, `UNKNOWN`), identity/provenance amendments (A1–A5) and its additive relationship to Features 001/002 — all unchanged. What changes: the execution substrate. Extraction runs as **local durable jobs** over **SQLite** instead of Cloudflare Queue consumers over D1; the `RELATIONSHIP_QUEUE` binding plan becomes the Cloudflare-adapter variant (D-ARCH-4), not the core. No LLM inference enters the deterministic Tier-1 graph. Pipeline: Repository Snapshot → File Classification → Tree-sitter (native/local where practical) → AST → Symbols → Relationships → Resolution; Feature 004 consumes Feature 002's symbol contracts, never duplicates extraction.

## 7. T007 redefinition and Feature 005 supersession

- **T007 (Feature 004) = Local Relationship Engine Feasibility.** It validates: native parser throughput, file-size bands, AST/symbol/relationship extraction and resolution cost, memory and CPU, worker concurrency, SQLite throughput, durable-job throughput, incremental indexing, cold start, large-file behavior, repository-scale graphification. The gate condition for T008+ is now "local engine validated", not "fits a Cloudflare invocation budget". T008+ remain NOT AUTHORIZED until the redefined T007 is executed and reviewed (or the user waives it).
- **Feature 005 (Queue CPU Feasibility Architecture) is historical/superseded evidence.** Nothing is deleted: the decision record, evidence dossier, LX-1 and `T007-CAL-1` proposals are preserved verbatim. `T007-CAL-1` was never authorized and never ran; it remains authorizable on request if the Cloudflare datum is ever wanted. The evidence chain: *Cloudflare feasibility research → useful evidence → not the core runtime → local-native architecture.* The work was not wasted — its CPU accounting model, measurement protocol, evidence-acceptability rules and stop-gate discipline are reused by the local T007.

## 8. Local runtime target

```text
                RepoAtlas UI (TypeScript)
                    │
                    ▼
             Local API / MCP
                    │
                    ▼
             Atlas Engine
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
   Repository    Analysis     Query/Graph
   Providers      Engine        Engine
       │            │            │
       ▼            ▼            ▼
     Git       AST / Symbols   Traversal
   GitHub      Relationships   Search
   GitLab      Processes       Impact
               Semantic        Evidence
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
       SQLite            Filesystem
       metadata          snapshots/
       queue             artifacts/
```

`./run.sh` today starts the dev server with no D1/R2/Queue bindings (Feature 006 renders `no_binding`). Target: `./run.sh` boots the full local stack — UI + local API + Atlas Engine on SQLite + filesystem — so intelligence works offline after acquisition. Near-term path (D-ARCH-2): wire the existing sqlite D1 adapter as default local persistence and add the local job engine; Rust core is the recorded production preference for later.

## 9. Local durable job system (Feature 004)

Job states: `PENDING → CLAIMED → RUNNING → COMPLETED | FAILED | RETRYING | SKIPPED`.
Requirements: crash recovery, retry policy, idempotency, bounded concurrency, resumability, persistent job state (SQLite), repository-scoped analysis, explicit cancellation/pause. Deep graphification must use this system. The seven job states are engine states; the nine repository lifecycle states (§5.2) are product states projected from them.

## 10. Query architecture

```text
User / Agent query → BM25/FTS (optional local semantic) retrieval → candidate symbols/nodes
→ deterministic graph traversal → evidence validation → process/impact analysis → answer
```

Retrieval and graph intelligence stay separate. Semantic indexing is optional, local-only, and never required for deterministic intelligence; remote embeddings are never a core requirement. MCP (Feature 007) is an interface over the local Atlas Engine — it must not become the graph engine.

## 11. Reference implementations (../repotlas-references/ — read-only, non-authoritative)

| Reference | What it does | Adopt | Change / improve | Avoid |
|---|---|---|---|---|
| **GitNexus** (TypeScript) | 19-phase dependency-declared pipeline DAG builds an in-memory knowledge graph, loads it into a dedicated graph DB (LadybugDB); hybrid BM25 + vector `query`; single authoritative `SemanticModel` symbol store; MCP over the index | Staged pipeline with explicit per-phase deps (maps to progressive graphification §5.2); retrieval-then-traversal query split (§10); "one authoritative symbol store, no parallel parse representations" principle (matches FR-001's no-second-pipeline rule) | RepoAtlas phases are **durable jobs with persisted checkpoints**, not one in-memory run; evidence states + provenance on every edge (GitNexus has no five-state evidence model) | Dedicated graph database (SQLite relational tables stay, per §1); vector search as a required query path; whole-graph-in-memory builds for large repositories |
| **graphify** (Python) | Tree-sitter extract → in-memory graph → community detection, god nodes, import cycles, per-community wiki/report; confidence labels on edges | Community/cluster summaries as **Universe-level** repository intelligence (categories, connectivity) without deep graphification; graph-diff idea for incremental re-index validation | Its "confidence label" is weaker than RepoAtlas's five evidence states + AMBIGUOUS candidate sets — keep ours | Python core; INFERRED call edges without retrievable candidate sets; single-pass whole-repo extraction with no job durability |
| **codegraph** (Rust kernel + TS shell) | Native Rust Tree-sitter kernel (20+ languages), SQLite-only storage, 100% local, OS-event file watcher with debounced incremental sync scoped to changed files, per-file fallback, byte-identical determinism verification against a reference engine | SQLite-only local storage (validates §1); change-scoped incremental indexing model for T007's "incremental indexing" item; byte-identical determinism verification as a T007 method; Rust-kernel direction (D-ARCH-2 preference) | RepoAtlas is **snapshot-addressed and immutable** (Feature 001), not a live working-tree watcher — incremental indexing operates between snapshots, not on file-save events | Always-on watcher daemon as default (RepoAtlas graphifies on explicit selection through the job queue); staleness-free marketing claims — RepoAtlas states staleness honestly per its evidence discipline |

Constraints honored: nothing in `../repotlas-references/` is modified, copied in, or depended on. RepoAtlas differentiators kept: evidence state, provenance, ambiguity, durable local jobs, source/repository separation, bounded selectable deep-analysis capacity, progressive graphification, impact analysis, process discovery, local-first execution, Universe↔Repository transition.

## 12. Documentation conventions for this revision

New architecture documentation, diagrams, tests and examples use neutral domains only (car rental, payment, notification, fleet management, customer, pricing, inventory services) — never booking/airline-domain examples. The architecture is domain-independent.

## 13. Consequences

- Feature 004 spec/plan/tasks/contracts amended (research.md A6); Feature 005 decision record carries a supersession note; `docs/AGENT-GOVERNANCE.md` gate wording updated; Feature 003 amended with discovery/catalogue/lifecycle/selection/purge requirements; Feature 009 amended with the two-scope visualization model. Roadmap "Current Stage" now points at the redefined T007.
- Nothing in this ADR authorizes implementation: no Rust services, queue workers, UI rewrite, graph rendering, MCP tools, production schema changes, graph/vector databases, or deployments were built. This ADR is the authoritative architecture for later, separately authorized implementation.
