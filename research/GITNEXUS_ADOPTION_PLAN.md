# GitNexus — RepoAtlas Adoption Plan

**Status:** Planning reference (not a specification).  
**Authority:** `docs/AGENT-GOVERNANCE.md`, `docs/ROADMAP.md`, feature `specs/`, and `research/ADOPTION_MATRIX.md` outrank this document.  
**License posture:** GitNexus is distributed under **PolyForm-Noncommercial-1.0.0**. RepoAtlas treats it as an **external reference and optional local tool** — **no direct source-code reuse** in the product unless license and attribution are explicitly resolved (`research/ATTRIBUTIONS.md`).

This document records **which GitNexus-style capabilities map to which RepoAtlas features**, with **decision labels**, **functional descriptions**, and **implementation plan sketches**. It does not authorize work; SpecKit and user instruction do.

---

## 1. What GitNexus is (capability model)

GitNexus is a **local, Node-based** static-analysis product: tree-sitter ingestion, cross-file scope resolution, a **typed code graph**, optional **communities** and **execution-flow (process) detection**, **BM25 + optional vector search**, and **agent surfaces** (CLI, MCP, HTTP API, web UI). It persists indexes under `.gitnexus/` and serves queries from an embedded graph database.

RepoAtlas is **edge-first**: immutable **snapshots**, **D1 + R2**, **queue workers** on Cloudflare Workers (Free-plan constraints), and **RepoAtlas-native** intelligence in `src/lib/code-intel/`. The two systems share **ideas** (symbols, relationships, bounded agent responses) but not **runtime or storage**.

```text
GitNexus (local)          RepoAtlas (production)
─────────────────         ───────────────────────
Checkout + analyze   →    Snapshot acquire + queue extract
LadybugDB graph      →    D1 relational model (no graph DB)
Worker-thread parse  →    Isolate + queue message batches
MCP on localhost     →    Feature 007 MCP (planned, Workers-backed)
```

---

## 2. Decision vocabulary

| Label | Meaning for RepoAtlas |
|--------|------------------------|
| **ADOPT** | Adopt as **engineering principle** or **operational practice** (no copied code). |
| **ADAPT** | **RepoAtlas-native** implementation informed by GitNexus behavior. |
| **DEFER** | Valuable later; prerequisites or CPU/runtime block it now. |
| **REJECT** | Incompatible with current architecture, spec non-goals, or license. |
| **TOOL** | Use installed **GitNexus CLI/MCP locally** for derived intelligence only. |
| **REPOATLAS-NATIVE** | Already specified or owned by RepoAtlas; GitNexus only validates direction. |

---

## 3. Capability catalog and decisions

### 3.1 Ingestion and parsing

| ID | Functionality | GitNexus behavior (summary) | Decision | RepoAtlas feature / lane |
|----|---------------|-----------------------------|----------|---------------------------|
| GN-01 | Repository scan + ignore rules | Walk paths; honor ignore files | **REPOATLAS-NATIVE** | **001** — snapshot file inventory, acquisition filters |
| GN-02 | Tree-sitter per-file parse | Worker pool; chunked byte budget; parse cache | **ADAPT** | **002** (done), **004** — parse-once discipline; query-cache candidate (Feature 005 §9) |
| GN-03 | Per-language query extraction | S-expression queries; symbol/call/import captures | **REPOATLAS-NATIVE** | **002** — `.scm` + IR pipeline |
| GN-04 | Scope resolution engine | Unified resolver; import/call/inheritance passes; confidence tiers | **ADAPT** | **004** — CALLS/IMPORTS/EXTENDS/IMPLEMENTS/USES/REFERENCES |
| GN-05 | Parse-once / no main-thread re-parse | Stream ParsedFiles to disk; avoid native buffer leaks | **ADAPT (principle)** | **004** CPU investigations; single-pass architecture candidate |
| GN-06 | Framework overlays (Spring, routes, ORM, DI) | Extra pipeline phases | **DEFER** | Out of Tier-1 scope; revisit if product expands languages/frameworks |
| GN-07 | COBOL / niche grammars | Regex or optional grammars | **REJECT** | Not in RepoAtlas language tier |
| GN-08 | PDG / CFG / taint (`--pdg`) | Control-flow, reaching-def, taint summaries | **REJECT (now)** | Far beyond Workers CPU; no spec |

### 3.2 Graph model and persistence

| ID | Functionality | GitNexus behavior (summary) | Decision | RepoAtlas feature / lane |
|----|---------------|-----------------------------|----------|---------------------------|
| GN-10 | Typed nodes (File, Class, Function, …) | Many node tables | **ADAPT** | **002** symbols + directories; **004** relationship endpoints |
| GN-11 | Single relation store with `type` + confidence | `CodeRelation` + reason string | **ADAPT** | **004** — `relationships` + `evidence_state` + provenance |
| GN-12 | Embedded graph DB + Cypher | LadybugDB bulk COPY load | **REJECT** | **004** / **009** — D1 only; no graph database |
| GN-13 | Incremental analyze (hash diff, surgical DB write) | Full pipeline; surgical subgraph write | **ADAPT (later)** | Post-**001** incremental acquisition; not filesystem-watch |
| GN-14 | Staleness vs `HEAD` | `current` / `behind` / `diverged` on reads | **ADAPT** | **007** MCP resources; snapshot commit SHA vs index |

### 3.3 Derived intelligence (communities, processes)

| ID | Functionality | GitNexus behavior (summary) | Decision | RepoAtlas feature / lane |
|----|---------------|-----------------------------|----------|---------------------------|
| GN-20 | Leiden communities on call graph | `Community` nodes; `MEMBER_OF`; cohesion | **DEFER** | New feature after **004**; heavy graph + CPU |
| GN-21 | Entry-point scoring + CALLS DFS | `Process` nodes; `STEP_IN_PROCESS`; budgets | **DEFER** | Explicit **004** non-goal; aligns with `research/ENGINEERING_LINEAGE.md` late phase |
| GN-22 | Truncation / partial reporting | Stats when budgets cut traces | **ADOPT** | **007** + future impact APIs — never silent truncation |

### 3.4 Search and retrieval

| ID | Functionality | GitNexus behavior (summary) | Decision | RepoAtlas feature / lane |
|----|---------------|-----------------------------|----------|---------------------------|
| GN-30 | BM25 FTS over symbols/files | Porter stemmer; multi-table merge | **DEFER** | **ADOPTION_MATRIX** #10 — blocked on edge FTS strategy (D1) |
| GN-31 | Vector embeddings + hybrid RRF | ONNX sidecar or HTTP embedder | **REJECT (now)** | **004** non-goals; Workers Free incompatible with default ONNX path |
| GN-32 | Token-budgeted tool output | MCP max tokens; ranked merge | **ADOPT** | **007** — extends ADOPTION_MATRIX #13–#14 |

### 3.5 Agent and API surface

| ID | Functionality | GitNexus behavior (summary) | Decision | RepoAtlas feature / lane |
|----|---------------|-----------------------------|----------|---------------------------|
| GN-40 | MCP tools: `query`, `context`, `impact`, `trace`, `cypher`, … | Read-only pool; staleness wrapper | **ADAPT** | **007** — tool catalog and contracts |
| GN-41 | `impact` BFS + risk tiers + epistemic boundary | Caller/callee expansion; `exact` vs `lower-bound` | **DEFER** | After **004** graph; complement Graphify blast-radius (**ADOPTION_MATRIX** #8) |
| GN-42 | `detect_changes` (git diff → symbols → processes) | Range overlap; `partial` on parse failure | **DEFER** | **007** or later; needs reliable CALLS + process layer |
| GN-43 | `rename` dry-run default | Graph + text search file set | **DEFER** | Agent convenience; not core atlas |
| GN-44 | HTTP API + web UI (Sigma graph) | Thin client over backend | **ADAPT (split)** | **009** UI patterns only; production API remains Workers routes |
| GN-45 | Editor hooks / `augment` on search | BM25-only fast context injection | **TOOL** | Optional Cursor workflow; not RepoAtlas server code |
| GN-46 | Cross-repo `group.yaml` contracts | Bridge DB + cross-impact | **DEFER** | Monorepo/multi-repo product scope TBD |
| GN-47 | LLM wiki generation | Multi-phase doc generation | **REJECT** | Out of RepoAtlas code-intel mission |

---

## 4. RepoAtlas feature mapping (plan details)

### 4.1 Feature 002 — AST + Symbol Intelligence (COMPLETE)

| GitNexus-related item | Plan |
|----------------------|------|
| GN-02, GN-03 | **No new feature work** unless user approves Query-cache adoption (Feature 005 decision: RETAIN unadopted experiment). |
| GN-05 | If adopted: memoize compiled Tree-sitter `Query` objects per isolate; re-measure under **Feature 004 T007** / calibration policy. |
| GN-08 R5 hygiene | Separate remediation: `tree.delete()` in `finally` on extraction paths — not authorized by this plan. |

**Exit criteria:** Symbol extraction remains source of truth; GitNexus index may **disagree** — resolve per `AGENT-GOVERNANCE.md` §8.

---

### 4.2 Feature 004 — Engineering Relationship Graph (BLOCKED at T007)

**Gate (authoritative):** Feature 004 **T007** remains **STOPPED / not cleared** until governance clears it (calibration `T007-CAL-1`, waiver, or amended architecture). This plan does **not** override that gate.

| Phase | GitNexus-informed work | GN IDs | Deliverables (when authorized) |
|-------|------------------------|--------|--------------------------------|
| **4a — Resolution design** | Import resolver chains; 3-tier confidence; unresolved-receiver census | GN-04, GN-11 | Amend **004** contracts only after review; map to D1 `evidence_state` |
| **4b — CPU-safe units** | Bounded lookup; no second full parse where single-pass approved | GN-02, GN-05 | Worker unit sizing per Feature 005 / T007 outcomes |
| **4c — Implementation T008+** | Queue consumer mirrors symbol worker | GN-13 pattern (idempotent units) | `RELATIONSHIP_QUEUE`, D1 client, extraction jobs per `tasks.md` |
| **4d — EXPORTS** | Parse-derived exports (not D1 `is_exported` alone) | GN-04 | Per **004** research Amendments A2 / R4 |

**Explicit non-import from GitNexus:** Ladybug schema (GN-12), communities (GN-20), processes (GN-21), PDG (GN-08).

**Prerequisites:** T007 gate clearance or valid waiver; FR-017 / single-pass decisions recorded in **004** spec if architecture changes.

---

### 4.3 Feature 007 — RepoAtlas MCP (NOT STARTED)

**Primary GitNexus alignment.** SpecKit feature to be created when user authorizes (`sdd/08-mcp-agent-interface/` is planning input only).

| Workstream | Functionality | GN IDs | Plan detail |
|------------|---------------|--------|-------------|
| **7.1 Tool contract** | Read-only default; `destructiveHint` only on mutating tools (if any) | GN-40 | Spec: tool list, params, error shapes; no Ladybug |
| **7.2 Context hydration** | `context` / `query` with ranked, bounded payloads | GN-32, GN-40 | Tiered budgets by repo size (see ADOPTION_MATRIX #13); Workers response limits |
| **7.3 Staleness** | Every tool result carries snapshot/commit status | GN-14 | Bind to `Repository` / `Snapshot` / `commit_sha` from D1 |
| **7.4 Impact (v1 defer, v2)** | `impact` mode callgraph | GN-41 | **v1:** defer or stub with `UNKNOWN` if graph incomplete; **v2:** after **004** CALLS quality gate |
| **7.5 Trace** | Shortest path over relationships | GN-40 | Requires **004** edges; cap depth and fan-out on Workers |
| **7.6 Transport** | MCP over Workers (stdio N/A on edge; HTTP/SSE as product allows) | GN-40, GN-44 | Match **006** settings for keys/origins; Free-plan safety |

**Dependencies:** Feature **006** (control plane) COMPLETE; Feature **004** for relationship-heavy tools (progressive enhancement, not blocking MCP skeleton).

**Suggested SpecKit order:** specify → plan → tasks → implement read-only `context` + `list_snapshots` first; add `impact` only when graph evidence exists.

---

### 4.4 Feature 009 — Repository Intelligence Visualization (PARTIALLY COMPLETE)

| UI concept | GitNexus reference behavior | GN IDs | RepoAtlas plan |
|------------|----------------------------|--------|----------------|
| L1 module/domain clusters | Community cohesion + labels | GN-20 | **Phase 1:** directory/symbol clustering from **002** only; **Phase 2:** community-like grouping when **004** CALLS exist |
| Process / flow overlay | Processes panel + Mermaid | GN-21 | **DEFER** until process detection is a scoped feature |
| Graph canvas | Sigma WebGL | GN-44 | **REJECT renderer copy** — keep Three.js / marble model per roadmap note |
| Drill-down + breadcrumbs | File tree + cluster drill | GN-44 | **ADAPT** navigation model L0→L3 in **009** session handoff |
| Relationship edges | Graph edges by type | GN-11 | Wire when **004** delivers; until then structural-only edges |

**Boundaries (unchanged):** no graph DB; does not replace **007** MCP.

---

### 4.5 Future features (not in `specs/` yet)

| Proposed capability | GN IDs | Suggested sequencing | Notes |
|--------------------|--------|----------------------|-------|
| Impact / blast radius | GN-41, ADOPTION_MATRIX #8 | After **004** + stable CALLS | Prefer graph-native BFS on D1, not embedded Cypher |
| Process intelligence | GN-21 | After impact or parallel research spike | High risk; evidence-light in references |
| Knowledge retrieval (BM25) | GN-30 | After symbol/relationship store proven | D1 FTS or alternative per matrix #10 |
| PR / change-aware triage | GN-42, ADOPTION_MATRIX #20 | After MCP + git integration story | `detect_changes` semantics as spec input |

---

## 5. Local GitNexus as derived intelligence (TOOL)

Use when **native** graph is incomplete or blocked (**004 T007**).

| Practice | Rule |
|----------|------|
| Index | `gitnexus analyze` from repo root; `.gitnexus/` gitignored |
| Authority | **SOURCE / snapshot / AST** wins on conflict (`AGENT-GOVERNANCE.md`) |
| Staleness | Compare index `lastCommit` to `git rev-parse HEAD` before decisions |
| Regeneration | User-authorized only; may rewrite GitNexus blocks in `AGENTS.md` / `CLAUDE.md` per `docs/CONTEXT-PROTOCOL.md` |
| Side effects | Registry updates possible on some CLI commands — treat as non-read-only |

**Good uses now:** explore call graph for **004** design, draft **007** tool shapes, sanity-check refactors.  
**Bad uses:** treat MCP output as production truth or as proof of Workers CPU compliance.

---

## 6. Consolidated adoption matrix (GitNexus-only rows)

| # | Capability | Decision | Target feature / phase |
|---|------------|----------|-------------------------|
| G1 | Tree-sitter worker-pool + parse cache discipline | ADAPT | 004 CPU / optional 002 cache |
| G2 | Unified scope resolution + confidence | ADAPT | 004 |
| G3 | Epistemic exact vs lower-bound reporting | ADOPT | 004 evidence + 007 tools |
| G4 | Embedded graph DB + Cypher | REJECT | — |
| G5 | Community detection (Leiden) | DEFER | Post-004 feature |
| G6 | Process / entry-point tracing | DEFER | Post-004 feature |
| G7 | Impact BFS + risk scale | DEFER | Post-004 / 007 v2 |
| G8 | MCP tool catalog + output budgets | ADAPT | 007 |
| G9 | Hybrid BM25 + vector RRF | REJECT (now) | — |
| G10 | Web graph UI (Sigma) | ADAPT (IA only) | 009 |
| G11 | Local index for dev agents | TOOL | Governance §5–§8 |
| G12 | PDG / taint | REJECT (now) | — |

**Overlap with `research/ADOPTION_MATRIX.md`:** Graphify/CodeGraph rows remain canonical for those projects. This table adds **GitNexus-specific** rows (G1–G12). Where both apply (e.g. token budgets #13), **007** should satisfy the stricter Workers constraint.

---

## 7. Risks and constraints

1. **CPU gate:** No GitNexus-informed **004** implementation past T008 without cleared T007 or waiver.  
2. **License:** No copy-paste of GitNexus source into `repo-atlas/` without legal review.  
3. **Runtime mismatch:** Do not assume local wall-clock or Ladybug query times apply to Workers.  
4. **Spec non-goals:** Impact, process, MCP, vectors are **out of Feature 004** — schedule them under **007** or new features.  
5. **Contradictions:** If GitNexus index and D1 symbols disagree, classify per governance (SOURCE-CONTRADICTED / STALE GRAPH).

---

## 8. Suggested execution order (planning only)

```text
Now (authorized separately):
  TOOL — local GitNexus for design/agent support
  009 — complete visualization closure (native 002 data)
  006 — review/commit if not done

After T007 clearance:
  004 T008+ — relationship queue + resolution (GN-04, GN-11)
  009 — relationship layers from 004

Parallel when user authorizes SpecKit:
  007 — MCP skeleton (GN-40, GN-32, GN-14)
  007 v2 — impact/trace when 004 edges exist (GN-41)

Later:
  Communities, processes, retrieval (GN-20, GN-21, GN-30)
```

---

## 9. Document maintenance

| Event | Action |
|-------|--------|
| Feature 004 gate changes | Update §4.2 and §7 |
| Feature 007 spec created | Replace §4.3 sketches with spec paths |
| New GitNexus major capability | Add row to §3 and §6 |
| ADOPTION_MATRIX revised | Reconcile G8–G9 with matrix #10–#13 |

**Created:** 2026-09-24  
**Evidence basis:** GitNexus product architecture (CLI/MCP/graph pipeline), RepoAtlas `specs/004`, `docs/ROADMAP.md`, `docs/AGENT-GOVERNANCE.md`, `research/ADOPTION_MATRIX.md`.
