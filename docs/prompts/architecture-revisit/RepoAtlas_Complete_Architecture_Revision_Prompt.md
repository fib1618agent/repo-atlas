# RepoAtlas — Complete Architecture Revision Prompt

## Mission

You are working inside the RepoAtlas repository.

Perform a **complete architecture/specification/roadmap revision** so that RepoAtlas reflects the new product and runtime model described below.

This is a **documentation, specification, architecture, roadmap, and contract revision pass only**.

Do **not** implement production code in this pass.
Do **not** push anything.
Do **not** modify unrelated dirty working-tree files.

The objective is to make the repository's architecture internally consistent before implementation begins.

---

# 1. Read the Repository First

Before changing anything, inspect:

- `docs/ROADMAP.md`
- `docs/progress/PROGRESS.md`
- `docs/session_handoffs/CURRENT.md`
- root roadmap/progress documents if present
- `specs/001-*`
- `specs/002-*`
- `specs/003-*`
- `specs/004-engineering-relationship-graph/`
- `specs/005-queue-cpu-feasibility-architecture/`
- `specs/006-settings-control-plane/`
- `specs/007-*` if present
- `specs/008-*` if present
- `specs/009-*` if present
- current architecture/ADR documents
- current source/repository loading specifications
- current visualization requirements
- existing source-management requirements
- existing GitHub source enhancement requirements

Also inspect the current implementation enough to understand existing boundaries, but do not modify implementation code.

There are known unrelated working-tree changes. Do not overwrite, revert, clean, or refactor them.

---

# 2. Product Direction

RepoAtlas is becoming a **local-first engineering intelligence platform**.

Core product idea:

> Every repository is a marble. Every code symbol is a node. Every relationship is an evidence-backed thread. Every execution path is a process. Every change has a measurable blast radius.

RepoAtlas must allow users to see the **entire discovered software universe**, while only performing expensive deep graph analysis on repositories the user chooses.

The system must therefore separate:

```text
DISCOVERY
from
DEEP INTELLIGENCE
```

Do not equate the number of repositories visible to the user with the number of repositories that can be deeply graphified.

---

# 3. Critical New Product Model

RepoAtlas has two primary visualization scopes.

## Universe View

Shows all discovered repositories.

Every discovered repository can appear as a marble.

The Universe can show:

- repository identity
- source
- category
- language
- metadata
- repository-level connectivity
- analysis status
- graphification status

A repository does NOT need to be deeply graphified to appear.

## Repository Graph View

Shows the deep engineering intelligence of one graphified repository.

It can expose:

- AST
- files
- symbols
- classes
- functions
- methods
- imports
- calls
- references
- implementations
- inheritance
- relationships
- process paths
- semantic connections
- impact analysis
- evidence

The Repository Graph View is scoped to one repository.

---

# 4. Capacity Model — Critical

Do NOT implement:

```text
maximum repositories = 5
```

Implement:

```text
ALL discovered repositories
        ↓
visible in Universe + Catalogue

DEEP graphification
        ↓
limited independently
```

Initial default:

```text
maxDeepAnalysisRepositories = 5
```

This value must be configurable.

The number 5 is an initial engineering/product default, not a permanent architectural constant.

Example:

```text
100 discovered repositories
        ↓
100 visible
        ↓
5 graphified
        ↓
95 discovered-only
```

The user must never lose visibility of repositories merely because they are not graphified.

---

# 5. Discovery Must Be Separate From Analysis

The source flow becomes:

```text
SOURCE
  ↓
DISCOVERY
  ↓
REPOSITORY CATALOGUE
  ↓
FILTER / SELECT
  ↓
DEEP ANALYSIS PLAN
  ↓
QUEUE
  ↓
GRAPHIFICATION
```

For a GitHub user source:

```text
GitHub user
    ↓
discover repositories
    ↓
repository catalogue
    ↓
user selects repositories
    ↓
selected repositories enter deep analysis
```

Discovery should primarily collect lightweight metadata.

Examples:

- provider repository ID
- owner
- name
- URL
- default branch
- visibility
- language
- size
- updated timestamp
- archived state
- fork state
- source association

Discovery must not automatically imply expensive AST/call-graph processing.

---

# 6. Universe Must Not Be Limited to Five

If a source exposes 100 repositories:

```text
Universe: 100
Catalogue: 100
Graphified: 5
```

If a source exposes 347 repositories:

```text
Universe: 347
Catalogue: 347
Graphified: 5
```

Do not silently select the first five or first 100.

If UI/resource safeguards require pagination or lazy rendering, that is a presentation/resource concern, not a deep-analysis restriction.

Users must be able to understand what repositories exist before deciding what to graphify.

---

# 7. Repository States

Define a coherent lifecycle:

```text
DISCOVERED
    ↓
SELECTED
    ↓
QUEUED
    ↓
ANALYZING
    ↓
GRAPHIFIED
```

Additional states:

```text
FAILED
PAUSED
REMOVED
PURGED
```

Semantics:

### DISCOVERED

Repository metadata is known.

Visible in Universe and Catalogue.

Does not consume deep-analysis capacity.

### SELECTED

User has selected it for deep analysis.

### QUEUED

Waiting for analysis capacity.

### ANALYZING

Deep indexing is running.

### GRAPHIFIED

Deep intelligence is available.

The repository becomes visually glowing/active in Universe View.

### FAILED

Analysis failed.

Repository remains visible.

### PAUSED

Deep analysis has been paused.

### REMOVED

Repository/source association is removed from active RepoAtlas state.

### PURGED

Local indexed data, snapshots, graph data, semantic data, caches, and queued work associated with the repository have been removed according to explicit purge semantics.

Do not silently combine REMOVE and PURGE.

---

# 8. Graphified Marble

A graphified repository must remain visible in Universe View.

Its marble should have a strong visual state such as:

- glow
- halo
- brightness
- intelligence-ready indicator

The meaning is:

> Deep repository intelligence is available.

Suggested visual states:

```text
●  DISCOVERED

◌  QUEUED

◉  ANALYZING

✦  GRAPHIFIED

⊗  FAILED

◇  PAUSED
```

These are conceptual states. Preserve the existing visual design language where possible.

Do not redesign unrelated UI.

---

# 9. Clicking a Graphified Marble

This is a major architecture/UI interaction.

When the user clicks a graphified marble:

```text
UNIVERSE VIEW
      ↓
click graphified marble
      ↓
REPOSITORY GRAPH VIEW
```

The experience should feel like zooming into the marble.

Do not require a separate disconnected page.

The visualization scope changes from:

```text
ALL REPOSITORIES
```

to:

```text
ONE REPOSITORY
```

---

# 10. Repository Graph View

Inside Repository Graph View, the selected repository becomes the complete visualization context.

The graph can expose:

```text
AST
SYMBOLS
CALL GRAPH
RELATIONSHIPS
PROCESSES
SEMANTIC CONNECTIONS
IMPACT
EVIDENCE
```

Relationship types already established by Feature 004 must remain:

```text
CONTAINS
IMPORTS
EXPORTS
CALLS
EXTENDS
IMPLEMENTS
USES
REFERENCES
```

Evidence states must remain:

```text
EXTRACTED
RESOLVED
INFERRED
AMBIGUOUS
UNKNOWN
```

Do not weaken the evidence model.

---

# 11. Repository Graph Perspectives

Do not force every graph concept into one overloaded visualization.

The Repository Graph View should support focused perspectives such as:

```text
Structure
Symbols
Call Graph
Relationships
Processes
Semantic
Impact
```

These are views over the same underlying repository intelligence model.

The exact implementation can evolve, but the architecture must support changing the visual/query scope without rebuilding the repository intelligence model.

---

# 12. Back to Universe

Repository Graph View must always provide:

```text
← Back to Universe
```

Returning to Universe should restore the previous Universe state where practical:

- zoom
- camera position
- filters
- category selection
- source selection
- selected repositories
- highlighted repository

The experience should be:

```text
Universe
   ↓
click glowing marble
   ↓
Repository Graph
   ↓
Back to Universe
   ↓
same Universe state
```

This should be treated as a first-class navigation state, not a workaround.

---

# 13. Breadcrumb

Support a lightweight breadcrumb:

```text
Universe
  ›
my-service
  ›
Call Graph
```

This makes visualization scope explicit.

---

# 14. Catalogue Requirements

The Catalogue must show all discovered repositories.

It must NOT show only graphified repositories.

Example:

```text
Repository       State        Intelligence
-------------------------------------------
service-a        GRAPHIFIED   Ready
service-b        GRAPHIFIED   Ready
service-c        DISCOVERED   Not graphified
service-d        DISCOVERED   Not graphified
service-e        ANALYZING    Processing
```

The exact columns can follow the existing design.

The key invariant is:

> Catalogue visibility is independent from deep-analysis capacity.

---

# 15. Repository Selection

Users must be able to select repositories for deep graphification from:

- Catalogue
- Universe

Selection must feed the analysis planner.

Example:

```text
Graphified: 3 / 5

[✓] service-a
[✓] service-b
[✓] service-c
[ ] service-d
[ ] service-e
```

At capacity:

```text
Graphified: 5 / 5
```

Do not silently evict an existing graphified repository.

If the user wants another repository graphified, they must explicitly deselect, pause, or remove one.

---

# 16. Source Model

Maintain a clear distinction:

```text
SOURCE
REPOSITORY
```

A source can resolve to many repositories.

Example:

```text
GitHub user
    ↓
Repository Discovery
    ↓
Repository A
Repository B
Repository C
...
Repository N
```

A repository must have a canonical identity based on provider identity, not merely its URL.

If the same repository is discovered from multiple sources, RepoAtlas must deduplicate the repository intelligence rather than creating duplicate indexes.

---

# 17. Removal and Purge

The existing source-management behavior already has concepts such as:

- add source
- replace sources
- clear sources
- remove source

Preserve those capabilities.

Clarify their semantics.

At minimum distinguish:

### Remove source

Stops using that source association.

### Remove repository

Removes a repository from the active repository set.

### Purge repository

Deletes locally retained repository intelligence and analysis artifacts according to explicit confirmation.

Purge may include:

- source snapshots
- AST/symbol indexes
- relationships
- process data
- impact data
- semantic index
- caches
- queued jobs

Do not make `Clear Sources` silently mean permanent deletion unless the existing product contract explicitly defines it that way.

---

# 18. Deep Analysis Resource Governance

Initial defaults:

```text
maxDeepAnalysisRepositories = 5
maxConcurrentAnalyses       = 2
maxQueuedAnalyses           = 20
```

These should be configuration values.

Additional safeguards can include:

```text
maxFileSize
maxRepositorySize
maxTotalSourceSize
maxRetainedSnapshots
```

Do not treat these as external provider limits.

They are RepoAtlas local engineering/resource controls.

---

# 19. Local-First Architecture

RepoAtlas must be redesigned around a local-native execution model.

The core must not require:

- Cloudflare Workers
- Cloudflare Queues
- Cloudflare D1
- Cloudflare R2
- Redis
- Kafka
- RabbitMQ
- PostgreSQL
- hosted graph databases
- hosted vector databases
- remote LLMs

The core should work offline after repository acquisition.

External providers may be used for source acquisition/update.

---

# 20. Local Runtime Target

Target architecture:

```text
                RepoAtlas UI
                    │
                    ▼
             Local API / MCP
                    │
                    ▼
             Atlas Engine
                    │
       ┌────────────┼────────────┐
       │            │            │
       ▼            ▼            ▼
   Repository    Analysis     Query/Graph
   Providers      Engine        Engine
       │            │            │
       ▼            ▼            ▼
     Git       AST / Symbols   Traversal
   GitHub      Relationships   Search
   GitLab      Processes       Impact
               Semantic       Evidence
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
       SQLite            Filesystem
       metadata          snapshots/
       queue             artifacts/
```

Rust is the preferred production core for:

- native Tree-sitter
- parallel parsing
- local durable jobs
- filesystem operations
- SQLite
- graph traversal
- resource control
- MCP support
- single-binary/local runtime potential

TypeScript remains appropriate for the UI/client.

Python can remain useful for research, experiments, benchmarks, and prototyping.

---

# 21. Local Durable Job System

Replace cloud queue dependency with a local durable job system.

States:

```text
PENDING
CLAIMED
RUNNING
COMPLETED
FAILED
RETRYING
SKIPPED
```

Requirements:

- crash recovery
- retry policy
- idempotency
- bounded concurrency
- resumability
- persistent job state
- repository-scoped analysis
- explicit cancellation/pause

Deep graphification must use this job system.

---

# 22. Graph Storage

Do not introduce a graph database by default.

Feature 004 relationships should remain relational graph data initially.

Use:

- SQLite
- indexed relationship tables
- bounded graph traversal
- deterministic resolution
- evidence/provenance

A dedicated graph database can be considered later only if workload evidence demonstrates the need.

Do not copy another project's storage architecture blindly.

---

# 23. AST and Symbol Architecture

Use native/local Tree-sitter where practical.

Pipeline:

```text
Repository Snapshot
       ↓
File Classification
       ↓
Tree-sitter
       ↓
AST
       ↓
Symbols
       ↓
Relationships
       ↓
Resolution
```

Preserve Feature 002's established symbol intelligence contracts.

Feature 004 should consume those contracts rather than duplicating symbol extraction.

---

# 24. Relationship Engine

Feature 004 remains:

> Engineering Relationship Graph

But its execution model must be runtime-independent and local-first.

Relationship extraction remains additive to existing code intelligence.

Preserve:

```text
CONTAINS
IMPORTS
EXPORTS
CALLS
EXTENDS
IMPLEMENTS
USES
REFERENCES
```

Preserve evidence:

```text
EXTRACTED
RESOLVED
INFERRED
AMBIGUOUS
UNKNOWN
```

Do not introduce LLM inference into the deterministic Tier-1 relationship graph.

---

# 25. T007 Architecture Change

The previous Feature 004 T007 gate was tied to Cloudflare Queue CPU feasibility.

That is no longer the core architecture.

Feature 005:

```text
Queue CPU Feasibility Architecture
```

becomes historical/superseded evidence for the local-first architecture.

Do not delete the Cloudflare research.

Preserve it as historical engineering evidence and decision context.

The existing Cloudflare calibration may finish if already running, but it must not block the local-first architecture.

Do not use Cloudflare 10 ms CPU as RepoAtlas's core processing constraint.

---

# 26. New Meaning of T007

Redefine Feature 004 T007 as:

> Local Relationship Engine Feasibility

It should eventually validate:

- native parser throughput
- file-size bands
- AST extraction
- symbol extraction
- relationship extraction
- relationship resolution
- memory usage
- CPU usage
- worker concurrency
- SQLite throughput
- durable job throughput
- incremental indexing
- cold start
- large-file behavior
- repository-scale graphification

The goal is to validate the local engine rather than fit the architecture into a cloud invocation budget.

---

# 27. File Size Governance

Introduce explicit local file-size policy.

Initial design direction:

```text
default max file size = 512 KiB
```

A larger hard ceiling can be designed and validated separately.

Oversized files should not necessarily disappear.

They may retain structural metadata while being excluded from expensive parsing according to policy.

Configuration should be explicit, for example:

```text
REPOATLAS_MAX_FILE_SIZE_KIB
```

Do not invent final limits without measurement.

---

# 28. Progressive Graphification

Graphification should be progressive.

Conceptually:

```text
DISCOVERED
   ↓
metadata available
   ↓
selected
   ↓
source acquired
   ↓
structure available
   ↓
AST/symbols available
   ↓
relationships available
   ↓
call graph available
   ↓
process/impact available
   ↓
semantic index optional
   ↓
GRAPHIFIED
```

The UI should be able to represent intermediate states.

This makes large repositories understandable without requiring one monolithic indexing step.

---

# 29. Semantic Indexing

Semantic indexing is optional.

It must not be required for deterministic graph intelligence.

Preferred architecture:

```text
deterministic graph intelligence
        +
optional local semantic index
```

Do not make remote embeddings a core requirement.

Local embeddings/vector search may be added as an optional layer.

---

# 30. Query Architecture

A repository query should conceptually follow:

```text
User / Agent Query
       ↓
BM25 / FTS / optional semantic retrieval
       ↓
Candidate symbols/nodes
       ↓
Deterministic graph traversal
       ↓
Evidence validation
       ↓
Process / Impact analysis
       ↓
Answer
```

This keeps retrieval and graph intelligence separate.

---

# 31. MCP Architecture

Feature 007 remains the MCP boundary.

Architecture:

```text
MCP Client
    ↓
RepoAtlas MCP
    ↓
Local Atlas Engine
    ↓
Graph / Search / Process / Impact / Evidence
```

MCP must not become the graph engine.

It is an interface over the local intelligence engine.

---

# 32. Visualization Architecture

Feature 009 consumes the engine's intelligence.

It should not create its own independent graph model.

Use two primary query scopes:

```text
UNIVERSE
```

and:

```text
REPOSITORY(repositoryId)
```

Conceptually:

```text
GET UNIVERSE
       ↓
all repository marbles

GET REPOSITORY GRAPH(id)
       ↓
deep graph for one graphified repository
```

The UI controls which scope is visualized.

---

# 33. Feature 009 Scope

Feature 009 remains:

> Repository Intelligence Visualization

It owns:

- Universe visualization
- marble states
- graphified visual state
- repository selection
- Repository Graph View
- transitions between Universe and Repository Graph
- breadcrumbs
- Back to Universe
- graph perspectives
- visualization filtering

It does not own:

- parsing
- graph extraction
- queue implementation
- repository acquisition
- MCP
- embeddings
- relationship resolution

---

# 34. Architecture Layers

Update the architecture to clearly represent:

```text
1. Source Providers
2. Repository Discovery
3. Repository Catalogue
4. Source Snapshot
5. File Classification
6. AST / Symbol Intelligence
7. Relationship Graph
8. Local Durable Job Engine
9. Search / Retrieval
10. Process Analysis
11. Impact Analysis
12. Optional Semantic Index
13. MCP
14. Visualization
```

The important architectural separation is:

```text
Repository Discovery
        ≠
Repository Graphification
        ≠
Visualization
```

---

# 35. Repository Intelligence Model

The repository model should support at least:

```text
Repository
├── identity
├── source
├── metadata
├── lifecycle state
├── selection state
├── graphification state
├── snapshot
├── files
├── symbols
├── relationships
├── processes
├── impact
├── semantic index
└── analysis statistics
```

Do not duplicate the same intelligence simply because a repository was discovered through multiple sources.

---

# 36. Universe-Level Intelligence

The Universe View can use repository-level information without requiring every repository to be deeply graphified.

Examples:

- categories
- language distribution
- repository size
- source boundaries
- repository-level dependency information
- high-level connectivity
- lifecycle state

Deep symbol-level intelligence requires graphification.

The UI must make this distinction understandable.

---

# 37. Architecture Diagram to Add to Documentation

Add a canonical diagram similar to:

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

---

# 38. Roadmap Changes

Update the roadmap without renumbering existing features.

Preserve the distinction between:

- Feature ID
- sequence/order

Known feature structure must remain consistent.

Do not create Feature 010 merely because this is a large architecture change.

First determine which existing feature boundaries own each responsibility.

Likely ownership:

```text
Feature 003 / source enhancement
    discovery + source management

Feature 004
    relationship graph + local graphification engine

Feature 005
    historical Cloudflare feasibility evidence

Feature 006
    settings/control plane

Feature 007
    MCP

Feature 008
    governance

Feature 009
    visualization
```

Adjust only where the repository's actual specifications demonstrate a better boundary.

---

# 39. Required Documentation Updates

Update the relevant authoritative documents.

At minimum inspect and update:

```text
docs/ROADMAP.md
docs/progress/PROGRESS.md
docs/session_handoffs/CURRENT.md

Feature 004:
spec.md
plan.md
research.md
data-model.md
quickstart.md
contracts/*
tasks.md
checklists/*

Feature 005:
decision/history documentation

Feature 007:
MCP architecture/contracts where necessary

Feature 009:
spec.md
plan.md
research.md
data model
contracts
tasks
checklists

Architecture ADR/design documents
Source/repository management documents
```

Do not modify files that are not semantically affected.

---

# 40. Existing Cloudflare Evidence

Preserve the Cloudflare evidence dossier and its conclusions.

It is historical architecture evidence.

Do not erase it.

The local-first decision should explain:

```text
Cloudflare feasibility research
        ↓
useful evidence
        ↓
not the core runtime
        ↓
local-native architecture
```

Do not describe the Cloudflare work as wasted.

It informed the architecture decision.

---

# 41. Comparison With Other Systems

The architecture may adopt useful ideas from systems such as:

- GitNexus
- Graphify
- CodeGraph

But do not copy their implementation blindly.

RepoAtlas-native capabilities remain important:

- evidence state
- provenance
- ambiguity
- durable local jobs
- source/repository separation
- repository graphification selection
- bounded deep-analysis capacity
- progressive graphification
- impact analysis
- process discovery
- local-first execution
- Universe-to-Repository visualization transition

Use these as differentiators.

---

# 42. Neutral Examples Only

Do not use airline, flight, passenger, booking, reservation, PNR, fulfilment, or other booking-domain examples in new architecture documentation, diagrams, tests, or explanatory examples.

Use neutral examples such as:

- car rental system
- payment service
- notification service
- fleet management service
- customer service
- pricing service
- inventory service

The architecture itself must remain domain-independent.

---

# 43. No Production Implementation

This pass must NOT:

- implement Rust services
- implement queue workers
- rewrite the UI
- implement graph rendering
- add MCP tools
- change production database schemas
- introduce a graph database
- introduce a vector database
- deploy anything
- push anything

This pass produces the authoritative architecture/specification for later implementation.

---

# 44. No Unrelated Changes

Do not:

- revert existing work
- clean unrelated files
- reformat unrelated documents
- alter unrelated source code
- modify unrelated tests
- modify existing working-tree changes

Only change documents required to make the architecture coherent.

---

# 45. Required Final Report

When finished, report:

1. Files inspected.
2. Files changed.
3. Architecture changes.
4. New Universe/Repository Graph model.
5. New 5-repository deep-analysis capacity model.
6. Discovery vs graphification separation.
7. Repository lifecycle changes.
8. Local-first runtime changes.
9. Feature 004/T007 changes.
10. Feature 005 historical/superseded status.
11. Feature 009 visualization changes.
12. Source/repository/removal model changes.
13. MCP implications.
14. Roadmap changes.
15. Any unresolved decisions.
16. Any assumptions made.
17. Confirmation that no production implementation was performed.
18. Confirmation that no unrelated dirty files were modified.
19. Git status summary.
20. Whether a commit is recommended — do not create it unless explicitly instructed.

Do not claim a requirement is implemented if this pass only documented it.

---

# 46. Final Architectural Principle

The architecture must reduce to this:

```text
                SEE EVERYTHING
                     │
                     ▼
             ALL REPOSITORIES
                     │
             ┌───────┴───────┐
             │               │
        DISCOVERED       SELECTED
             │               │
             │               ▼
             │          DEEP ANALYSIS
             │               │
             │          max default 5
             │               │
             │               ▼
             │          GRAPHIFIED
             │               │
             │               ▼
             │       GLOWING MARBLE
             │               │
             │             click
             │               │
             │               ▼
             │      REPOSITORY GRAPH
             │               │
             │       AST / CALL GRAPH
             │       RELATIONSHIPS
             │       PROCESSES
             │       SEMANTICS
             │       IMPACT
             │               │
             │               ▼
             │       ← BACK TO UNIVERSE
             │               │
             └───────────────┘
```

The core product rule is:

> **See everything. Graph deeply where selected.**

Execute this as a careful architecture/specification revision, not an implementation pass.
