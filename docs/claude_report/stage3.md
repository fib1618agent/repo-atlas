# Claude Report — Stage 3: Feature 005 Verification, Feature 004 Readiness, GitNexus/Graphify Analysis

**Date**: 2026-09-24 · **Repo**: `~/Documents/dev/git/fib1618agent/repo-atlas` · **Branch**: `feat/atlas-marble-interaction` · **HEAD**: `c576310` (unchanged) · **Working tree**: dirty (pre-existing; see §3)
**Stage type**: analysis and readiness only. Feature 004 and Feature 005 were not executed. No commit, no push, no Cloudflare/Wrangler operation.

**Evidence-origin tags used below**: `[SRC]` source/repo files read directly · `[AST]` deterministic AST evidence · `[RA-GRAPH]` RepoAtlas graph evidence (none exists yet; the relationship graph is unbuilt) · `[GN]` GitNexus evidence · `[GFY]` Graphify evidence · `[AGENT]` agent (persona-lens) interpretation · `[MODEL]` model synthesis. Claim status: FACT / INCOMPLETE / UNVERIFIED / CONTRADICTION / UNKNOWN.

---

## 1. Executive Summary

1. **Feature 004 is not ready to proceed, and Feature 005 finishing does not change that.** Feature 004's own result at T007 is a recorded STOP: large (~2,000-line) fixtures classify `likely unsafe` (p95 9.7–12.2 ms local wall-clock) across all four languages `[SRC: specs/004…/research.md §1, feasibility-results.md]`. Feature 005's decision record independently keeps Feature 004 T007 **STOPPED**: all five FR-028 conditions unsatisfied, no waiver, "no unit selectable yet" `[SRC: DR §6.4, §13, §14]`. Feature 004's tasks.md gates T008 onward on T007 not returning `likely unsafe` `[SRC: tasks.md lines 30, 43, 209–210]`.
2. **Three record-state contradictions exist and were not reconciled**: (a) 004 `tasks.md` shows T007 `[X]` while the recorded outcome is STOP; (b) 005 `tasks.md` shows **0 of 49** tasks checked while PROGRESS.md, the audit log and DR Appendix C say T001–T049 executed and S5 was reached; (c) the 005 decision-record header still says "SKELETON … every section PENDING" although every section is filled (§4, §20).
3. **GitNexus** now has a real RepoAtlas index (4,706 nodes / 7,289 edges, HEAD `c576310`) `[GN]`. **Graphify** did not have one before this stage; `graphify update .` produced 3,073 nodes / 4,502 edges in 3.9 s `[GFY]`. Both are derived intelligence, not source truth.
4. **Graph-assisted findings verified against source**: importer counts for `cloudflare-env.ts` (34) and `atlas-errors.ts` (19) agree across grep, GitNexus and Graphify; the three `implements` edges agree across source, GitNexus and Graphify. Two task-path discrepancies were found in 004 tasks.md (T010, T024) `[SRC][GN]`.
5. **Exact next action (outcome E, with F as housekeeping)**: a human decision is needed. Nothing in Feature 004 can proceed independently. The user must choose how T007 is to be resolved (§21).
6. **Side effects of this stage**: `graphify-out/` (gitignored) was created by the authorized `graphify update .`; nothing else was written except this report and the three log appends (§24). GitNexus registry unchanged by this stage's commands.

---

## 2. Stage 3 Scope

Performed: read governing documents; verified Feature 005 terminal state; analyzed Feature 004 task readiness; queried the existing GitNexus index read-only (`gitnexus cypher`, `gitnexus impact`); ran the authorized `graphify update .`; compared tools and reference research; wrote this report and appended to the three logs.
Not performed (per instructions): `gitnexus analyze`, `--embeddings`, `gitnexus list`/`status`, Graphify semantic extraction, any Feature 004/005 execution, T007 change, edits to specs/CLAUDE.md/AGENTS.md/constitution, Cloudflare/Wrangler, commit, push, deploy.
`bunx tsc --noEmit` was run (read-only, local) to check Feature 005's typecheck evidence: exit 0, no output `[SRC-run 2026-09-24]`. `bun test` and `bun run build` were not run.

---

## 3. Actual Repository State

- HEAD `c576310586cfbdfdfbd75f0cd3824d62ced32bb5`; remote `https://github.com/fib1618agent/repo-atlas.git`; branch `feat/atlas-marble-interaction`.
- **Pre-existing uncommitted changes (not mine)** `[SRC: git status]`: modified `.gitignore` (+`.gitnexus`), `AGENTS.md`, `data/code-intel-schema.sql` (+77 lines, Feature 004 T003), `docs/progress/PROGRESS.md`, `specs/003…/tasks.md` (+1 line), `src/lib/code-intel/config.ts` (+21, Feature 004 T002), `src/lib/code-intel/symbols/to-intermediate-representation.ts` (Query-cache experiment, "Set B"), `src/routeTree.gen.ts`, four route files, two test files. Untracked: `CLAUDE.md`, `.graphifyignore`, `.claude/skills/gitnexus/`, `docs/AGENT-GOVERNANCE.md`, `docs/agency-agents-for-repo-atlas.md`, `docs/{audit_reports,claude_report,investigations,prompts}/`, `specs/004…/`, `specs/005…/`, `src/lib/code-intel/domain/relationship.ts`, `src/lib/code-intel/relationships/`, `src/routes/about.tsx`, spike scripts.
- **Tool-generated changes to governed files (FACT, `[SRC]` diff)**: `AGENTS.md` and `CLAUDE.md` each contain a `<!-- gitnexus:start -->…<!-- gitnexus:end -->` block appended by the user's manual `gitnexus analyze` (the CLI's own help says it updates "the gitnexus section in AGENTS.md and CLAUDE.md" unless `--skip-agents-md`; the exact causation is INFERENCE). The block hard-codes `MUST run impact analysis before editing any symbol`, `NEVER commit … without gitnexus_detect_changes`, and says "run `npx gitnexus analyze`" when stale. **These were left untouched** (instruction: do not modify CLAUDE.md/AGENTS.md). See §20 for the governance implication.
- Feature completion by checkbox `[SRC]`: 001-code-intelligence-foundation 54/54 · 001-dynamic-github-sources 54/54 · 002 69/69 · 003 28/28 · **004 7/76** · **005 0/49 (contradicted, §4)**.
- Typecheck: `bunx tsc --noEmit` exit 0, empty output (matches Feature 005 baseline `tsc-baseline.txt`).

---

## 4. Feature 005 Verification

| Item | Repository state `[SRC]` | Previous narrative | Status |
|---|---|---|---|
| T049 / S5 | DR Appendix C revision R0 "finalized by task T049 on 2026-09-24", disposition STOPPED; PROGRESS.md entry "T049 executed; STOP GATE S5 reached" | S5 reached | FACT that the records say so |
| **005 tasks.md checkboxes** | `grep "^- \[X\]"` = **0**, `grep "^- \[ \]"` = **49** | T001–T049 executed | **CONTRADICTION** (not reconciled) |
| **DR header** | line 5: "Record status: SKELETON — created by task T001. Every section below is PENDING" | finalized | **CONTRADICTION** (stale banner; sections §1–§16 and Appendices A–C are filled) |
| Final decision | §6.4 "NO UNIT SELECTABLE YET"; §8.2 single-pass DEFER; §9.3 Query cache RETAIN, unadopted; §13 no waiver; §14.3 **Feature 004 T007 STOPPED** | same | FACT |
| FR-028 gate | (a)–(e) all `unsatisfied` (§14.2) | same | FACT |
| Evidence register | E1–E8 in DR §2; PLATFORM-TELEMETRY: none | same | FACT (no platform CPU telemetry exists) |
| Unresolved questions | U1–U5 UNKNOWN/PARTIAL; K1 (15 vs 5 min) narrowed not resolved; C1–C3 open; D1 free-tier figures UNKNOWN (§16.4) | same | FACT |
| Amendments | §15: none indicated; amendment "does not begin until this record has been reviewed" | same | FACT |
| Production code changed by Feature 005? | Protected-path check re-run by me: `shasum -c` of `evidence/baseline/set-A.sha256` (148 files) and `set-B.sha256` (2 files) → **0 mismatches** `[SRC-run]`; Appendix B/T046 reports the same | "no Feature 001/002 file modified" | FACT (integrity vs. the 2026-09-23 baseline) |
| Live operation? | audit-log entry: none; `live-experiment-proposal.md` LX-1 = `STATUS: NOT AUTHORIZED`; `.wrangler/` last modified 2026-09-21, before Feature 005's baseline (2026-09-23) | none | FACT for what is recorded; absence of any other live call is UNVERIFIED beyond the logs |
| Typecheck | rerun exit 0 / no output = baseline | exit 0 | FACT |
| Active safety gates | T007 STOPPED; LX-1 not authorized; no waiver | same | FACT |

**Consequence for the T049 report**: Stage 2 overwrote `docs/claude_report/reports.md` as instructed, so the T049 final-report text no longer exists there (it is untracked, so not in git). Its content survives in DR Appendix C, PROGRESS.md and the audit log. `[SRC]`

---

## 5. Feature 004 Readiness

**Summary `[SRC][MODEL]`**
- Done by checkbox: T001–T007. I verified T001–T006 artifacts exist (dirs, `config.ts` +21, schema +77 with four `CREATE TABLE` at lines 166/205/213/228, `domain/relationship.ts`, `relationship-identity.ts`, `scripts/relationship-cpu-spike.ts`, `feasibility-results.md`). T007's deliverable exists: research.md §1 "CPU Feasibility — Empirical Result" records **"Go/no-go decision: STOP"**.
- **Independent dual blockers**: (1) Feature 004's own T007 result (STOP; "architecture reconsideration … not performed in this session"); (2) Feature 005 disposition STOPPED with no waiver and no selectable unit.
- Phase-2 tail (T008–T012) is text-gated by T007 (`tasks.md` line 209: "T008–T012 … once T007 clears the gate"). All user-story phases depend on Phase 2 and on "T007's non-blocking classification" (line 210). T023 is written "one file per invocation per T007's confirmed granularity" — that granularity was **not** confirmed.
- Reading of `[X]` on T007: the task text says its output must state a `likely unsafe` result and STOP; the record does that. So `[X]` plausibly means "review recorded", not "gate passed" (`[AGENT]` INFERENCE). It is not treated as authorization, and the checkbox was not touched.
- **Task-text discrepancies found (SRC + GN + GFY agree on the real paths)**: T010 names `src/lib/code-intel/atlas-errors.ts`; the file is `src/lib/atlas-errors.ts`. T024 places `relationship-worker.ts` in `src/lib/code-intel/queue/` "mirroring `symbols/symbol-worker.ts`", but `symbol-worker.ts` lives in `src/lib/code-intel/symbols/` (the `queue/` directory holds only `snapshot-worker.ts`). Also T019's `.scm` files already exist untracked (`relationships/queries/{java,javascript,typescript,tsx}.scm`, 3,985 B) while T019 is unchecked (spike drafts; INFERENCE) → INCOMPLETE. None of these were edited.

Full per-task matrix: §18.

---

## 6. Cross-Feature Dependency Graph

```text
F001 snapshot model (Repository→Snapshot→SnapshotFile; D1/R2/queue plumbing)  [54/54 + 54/54]
  └─► F002 AST symbols (symbols, file_extractions, directories; grammar-provider; symbol queue)  [69/69, live-validated per 002 T068]
        └─► F004 relationship graph  [7/76]  ◄── gated by its own T007 STOP
              ▲                                        ▲
              │ reads/depends on                       │ disposition input (decision only)
   F005 CPU-feasibility decision (docs/evidence only) [records say done; tasks.md 0/49]
F003 GitHub source enhancement (UI, connected sources) [28/28] — shares src/routes, src/lib/repositories*; NOT a code-intel dependency
```

- **Completed prerequisites for F004** (`[SRC]`): F001 snapshot tables/queue plumbing; F002 `symbols`, `file_extractions`, `directories` tables and unchanged `grammar-provider.ts`/`getParser`.
- **Blocking**: F004 T007 (STOPPED). **Non-blocking unfinished work**: F003 (complete, only a 1-line uncommitted edit), the unadopted Query-cache experiment (Set B), UI route edits.
- **Shared files / hotspots** `[GN][GFY][SRC]`: `data/code-intel-schema.sql` (F001/F002/F004; loaded by the test adapter), `src/lib/code-intel/config.ts` (8 importers per GN), `persistence/cloudflare-env.ts` (34 importers — grep, GN, GFY agree), `src/lib/atlas-errors.ts` (19 importers, all three agree), `nitro.config.ts` + `wrangler.toml` (queue registration, T011), `tests/support/d1-sqlite-adapter.ts` (22 importers per GN), `src/routes/__root.tsx` (T054), `relationship.functions.ts` (T025→T030→T046→T048→T053 serial chain), `relationship-d1-client.ts` (T009, T031).
- **Query-cache experiment coupling** `[SRC]`: Set B (`to-intermediate-representation.ts`, `scripts/query-cold-start-experiment.ts`) is a Feature 002 file change that F004 FR-017 says F004 must not modify; it sits unadopted and uncommitted.
- **Can specific F004 tasks begin despite unrelated unfinished work?** Unrelated unfinished work (F003 edits, UI, Set B) does not block anything. The blocker is F004's own gate, not an unfinished neighbor. Roadmap order was not used (`roadmap.md` is a generic six-item list).

---

## 7. GitNexus Current Index

Baseline `[GN, user-run, not re-run]`: tool GitNexus **1.6.8**; command `gitnexus analyze .`; indexed commit `c576310`; current commit `c576310`; status up-to-date; duration 4.9 s; nodes 4,706; edges 7,289; clusters 90; flows 217; skipped 1 file >512 KB.

Observed by read-only queries this stage (`gitnexus cypher -r repo-atlas`, `gitnexus impact`; registry hash verified unchanged before/after):
- Artifacts: `.gitnexus/lbug` (38,907,904 B, LadybugDB) and `.gitnexus/meta.json` (383 B). `meta.json`: `repoPath`, `lastCommit c576310…`, `indexedAt 2026-09-24T10:32:12.260Z`, `remoteUrl`, stats `files 345, nodes 4706, edges 7289, communities 90, processes 217, embeddings 0`. Registry entry for repo-atlas exists (7 entries now). `.gitnexus` is in `.gitignore`; untracked/ignored, local-only.
- **Node labels** (sum = 4,706): Const 1,778 · Section 1,630 · Function 425 · File 345 · Process 217 · Method 119 · Folder 77 · Community 38 · Variable 37 · Interface 22 · Property 13 · Class 5.
- **Edge types** (`CodeRelation.type`, sum = 7,289): DEFINES 2,399 · CONTAINS 2,015 · CALLS 1,106 · STEP_IN_PROCESS 816 · IMPORTS 469 · MEMBER_OF 379 · HAS_METHOD 52 · ACCESSES 19 · METHOD_IMPLEMENTS 18 · HAS_PROPERTY 13 · IMPLEMENTS 3.
- **Confidence** (per edge, numeric): CALLS 0.5–0.95; IMPORTS 0.8–1; IMPLEMENTS 0.92–0.95; all others 1. `reason` values include `import-resolved` 773, `same-file` 300, `markdown-heading` 1,619, `markdown-link` 30, `trace-detection` 816, `leiden-algorithm` 379, `global` 27, `interface-dispatch` 6, `read`/`write` 9/10. CALLS with confidence <0.8 are `global` (27) and `interface-dispatch` (6).
- **Coverage**: 345 files including untracked working-tree files (5 files under `relationships/`, 14 in `specs/004`, 28 in `specs/005`), tests, scripts, `sdd/`, `research/`. Markdown is indexed as `Section` nodes. No file under `.gitnexus/` is indexed.
- **Freshness caveat (FINDING)**: "up-to-date" is commit-based (indexed commit = HEAD). The index was built from the **dirty working tree**, and includes uncommitted/untracked files, so commit equality does not mean "equal to committed content". I confirmed no file under `src/ tests/ scripts/ specs/ docs/` was newer than the index time (14:32) when Stage 3 started. Working-tree-level staleness after that is UNKNOWN.
- **Anomaly (INCOMPLETE)**: `meta.json`/registry say 90 communities; the graph has **38** `Community` nodes. Unexplained (possible counting basis difference).
- **Skipped >512 KB file**: not named by the tool output. `repos.json` (559,222 B) is the only non-media, non-binary file over 512 KB and is absent from the index file list; that it is the skipped file is INFERENCE.
- `getSymbolQueue` `impact`: risk HIGH, 6 impacted symbols, 3 affected processes, 2 modules (`[GN]`, relevant to T008 as an additive-only edit).

## 8. GitNexus Capability Analysis

| Capability | Evidence origin and state | RepoAtlas decision | Reason |
|---|---|---|---|
| File/folder representation | `[GN]` File, Folder, CONTAINS | ADAPT | RepoAtlas already has snapshot-scoped `directories`/`file_extractions`; keep those, adopt the vocabulary only |
| AST | `[SRC]` package.json: native `tree-sitter 0.21.1` (Node). Not WASM | REJECT (as implementation) | Native modules cannot run in Workers; RepoAtlas uses `web-tree-sitter` WASM (F002) |
| Symbols | `[GN]` Function/Method/Class/Interface/Const/Variable/Property, `startLine/endLine/isExported/content/description` | REPOATLAS-NATIVE | F002 `symbols` is snapshot-addressed with stable identity; GN keys are not snapshot-scoped |
| Imports | `[GN]` IMPORTS 469, conf 0.8–1 | ADAPT | Resolution-with-confidence idea; RepoAtlas uses discrete evidence states |
| Exports | `[GN]` `isExported` property only; no EXPORTS edge observed | REPOATLAS-NATIVE | F002 `is_exported` already persisted; F004 derives EXPORTS from it |
| Calls | `[GN]` CALLS 1,106, conf 0.5–0.95 with reason | ADAPT / IMPROVE | Keep RESOLVED/AMBIGUOUS/UNKNOWN; improve by retaining candidate sets (§14) |
| Inheritance / implementation | `[GN]` IMPLEMENTS 3, METHOD_IMPLEMENTS 18; EXTENDS 0 rows (see §13) | DEFER (EXTENDS evidence) | No in-repo extends target exists to test with |
| References / usage | `[GN]` ACCESSES 19 (read/write); no REFERENCES/USES edge type observed | REPOATLAS-NATIVE | F004 defines USES/REFERENCES; GN's read/write ACCESSES is only a closest equivalent |
| Unresolved references | `[GN]` not observed as a stored state | IMPROVE | RepoAtlas stores UNKNOWN explicitly |
| Communities | `[GN]` Community (Leiden, MEMBER_OF 379) | DEFER | Out of F004's 8 relationships; possible later analytics |
| Processes/flows | `[GN]` Process 217, STEP_IN_PROCESS 816 (`trace-detection`) | DEFER | Maps to SDD phase 06 (process discovery), not F004 |
| Tracing / impact | `[GN]` `trace`, `impact` CLI/MCP; ran `impact` OK | ADAPT | Reverse-BFS blast radius is an intended later RepoAtlas capability (ADOPTION_MATRIX #8) |
| Semantic search / embeddings | `[GN]` 0 embeddings; README: local model (onnx/HF) or remote endpoint | DEFER | See §11 (no F004 need; network/model dependencies) |
| PDG/data-flow | `[SRC]` CLI `--pdg` opt-in; tool `pdg_query`; **not built here** | DEFER | UNKNOWN in this index |
| MCP | `[SRC]` tools: query, context, impact, trace, cypher, detect_changes, check, rename, explain, pdg_query, route_map, tool_map, shape_check, api_impact, group_* ; Cursor MCP entry exists, none found for Claude | ADOPT (design principle) | Sufficiency/response shaping for RepoAtlas's own future MCP layer (SDD 08) |
| Incremental analysis | `[GN]` up-to-date check is commit-based; incremental parsing/caching UNKNOWN | DEFER | F004 is snapshot-immutable, not edit-based |
| Parser caching | UNKNOWN (not observed) | UNKNOWN | — |
| Large-file handling | `[GN]` 1 file >512 KB skipped | ADAPT | Same idea as CodeGraph's size ceiling (§12) |
| Provenance / revision awareness | `[GN]` `meta.json` lastCommit + remoteUrl; per-edge `reason`; no per-edge commit/snapshot | IMPROVE | RepoAtlas ties every relationship to snapshot + commit SHA |
| Worker pool resilience | `[SRC README]` retry, split, quarantine | REJECT | Node worker pool; no Workers analogue |

---

## 9. Graphify Current Index

**Evidence register (`[GFY]`, produced this stage)**

| Field | Value |
|---|---|
| Tool / version | Graphify **0.9.6** |
| Command | `graphify update .` (help: "re-extract code files and update the graph (no LLM needed)"), from repo root |
| Timestamp | 2026-09-24T10:44:05Z (14:44 +04) |
| HEAD | `c576310586cfbdfdfbd75f0cd3824d62ced32bb5` (`built_at_commit` recorded in graph.json) |
| Duration | 3.855 s wall; 14 workers |
| Output location | `repo-atlas/graphify-out/` (gitignored; also in `.graphifyignore`) |
| Artifacts | `graph.json` 2,855,785 B · `graph.html` 2,782,486 B · `GRAPH_REPORT.md` 87,201 B · `manifest.json` 58,207 B · `.graphify_labels.json` 11,862 B · `.graphify_root` · `cache/ast/` · `cache/stat-index.json` |
| Format | node-link JSON; `directed: false`, `multigraph: false`; top keys `directed, multigraph, graph, nodes, links, hyperedges, built_at_commit`; 0 hyperedges |
| Nodes / edges | **3,073 nodes / 4,502 edges**; 255 communities (218 shown, 37 thin omitted) |
| Node types | `file_type` document 1,759 · code 1,314; `_origin` = `ast` for all 3,073; `metadata.kind` only for bash (`bash_function` 25, `file` 7, `bash_entrypoint` 7); TS/JS symbols carry no `kind` |
| Relations (edge `relation`) | contains 2,631 · imports 694 · calls 543 · imports_from 436 · references 78 · method 59 · indirect_call 33 · defines 25 · implements 3 |
| Confidence | EXTRACTED 4,460 · **INFERRED 42** (`indirect_call` 33, `calls` 9; scores 0.5–0.8) · AMBIGUOUS 0; report: "99% EXTRACTED · 1% INFERRED" |
| Provenance | per-edge `source_file`, `source_location` (line), `confidence`, `confidence_score`, `context` (e.g. `call`, `collection`); graph-level `built_at_commit`; per-file `ast_hash` + mtime in `manifest.json` |
| Files | report: 354 files, ~504,258 words; 340 distinct `source_file` values on nodes. Skipped/excluded count: **UNKNOWN** (not printed) |
| Semantic enrichment | not performed; "Token cost: 0 input · 0 output"; report suggests setting `GEMINI_API_KEY`; community labels came from `.graphify_labels.json` (no LLM run by this command) |
| Unresolved relationships | no unresolved/ambiguous state stored (AMBIGUOUS 0); 1,837 isolated nodes reported |
| Errors/warnings | none printed |
| Other report sections | God Nodes, Surprising Connections, Import Cycles, Communities, Knowledge Gaps, Suggested Questions |

**Exclusion behavior (FINDING)**: 0 nodes come from `.gitnexus/` (the intended exclusion holds), 0 from `graphify-out/`, and `repos.json`, lock files and `public/wasm` produced no nodes. But **53 nodes come from `.claude/skills/gitnexus/`** (six GitNexus-generated SKILL.md documents). `.graphifyignore` excludes `.gitnexus/` but not that directory; it was not changed (instruction: do not alter beyond the established exclusions). Graphify therefore treats GitNexus's generated skill docs as repository documents.

**Incremental behavior**: first build here; `manifest.json` stores per-file `ast_hash`; the tool text says `update` re-extracts changed files. The "354/354 uncached" run shows the cache was empty. Behavior on a second run: not observed.

## 10. Graphify Capability Analysis

| Capability | Evidence origin and state | RepoAtlas decision | Reason |
|---|---|---|---|
| Deterministic AST extraction | `[GFY]` all nodes `_origin: ast`; `[SRC research]` tree-sitter, parse once, one walk | ADAPT | Confirms tree-sitter route; RepoAtlas keeps its WASM/snapshot design |
| Graph construction | `[GFY]` undirected, single-relation-per-pair (`multigraph: false`) | IMPROVE | Directed, typed, snapshot-scoped edges; F004 needs direction (source→target) |
| Relationship provenance | `[GFY]` per-edge file+line, confidence, context | ADAPT | RepoAtlas adds snapshot id, repository, commit SHA |
| Semantic extraction | not run here | DEFER | LLM dependency conflicts with deterministic-core principle; optional layer later |
| Documentation knowledge | `[GFY]` 1,759 document nodes (Markdown headings, package deps) | DEFER | Not part of F004's eight relationships |
| Visualization | `[GFY]` `graph.html`; `tree` command (D3 HTML) | REJECT (as dependency) | RepoAtlas has its own 3D atlas; HTML is a reference only |
| MCP | `[SRC]` CLI has `query`, `affected`, `path`, `explain`; MCP server not exercised | ADOPT (principle) | Bounded, budgeted responses (ADOPTION_MATRIX #13/#14) |
| Unresolved relationships | not stored (AMBIGUOUS 0 here) | IMPROVE | Keep explicit UNKNOWN/AMBIGUOUS + candidates |
| Evidence/provenance | `[GFY]` EXTRACTED/INFERRED/AMBIGUOUS + `confidence_score` rubric | ADAPT | Reconcile with RepoAtlas EXTRACTED/RESOLVED/INFERRED/AMBIGUOUS/UNKNOWN (§14) |
| Incremental analysis | `[GFY]` hash manifest + `update` | ADAPT | Content-hash idea suits snapshot re-extraction (matrix #15) |
| Parser architecture | `[SRC research]` hand-rolled `node.type` traversal, one pass | INSPIRE→ADAPT | Single-pass is the structural lever for 004 (§15) |
| Caching | `[GFY]` `cache/ast`, `stat-index.json` (local disk) | REJECT (as implementation) | Local filesystem cache; Workers have none |
| Performance | `[GFY]` 3.9 s for 354 files (local, 14 workers, wall-clock) | not transferable | Says nothing about Workers CPU |
| Ambiguity handling | 42 INFERRED edges with 0.5/0.8 scores; no candidate sets stored | IMPROVE | RepoAtlas retains candidate rows for AMBIGUOUS |

---

## 11. GitNexus vs Graphify vs RepoAtlas (factual comparison; no ranking)

| Dimension | GitNexus `[GN]` | Graphify `[GFY]` | RepoAtlas (F001/F002; F004 = specified, unbuilt) `[SRC]` |
|---|---|---|---|
| Source model | local working tree | local working tree | remote GitHub archive → immutable snapshot in R2/D1 |
| Snapshot/revision | one `lastCommit` per index; dirty tree indexed | one `built_at_commit`; dirty tree indexed | per-snapshot commit SHA; every row snapshot-scoped |
| AST | native tree-sitter 0.21.1 | tree-sitter (Python) | `web-tree-sitter` WASM, 4 Tier-1 languages |
| Symbols | function/method/class/interface/const/var/property | code nodes, no `kind` for TS | `symbols` with stable identity + `is_exported` |
| Relationships | 11 types (§7) | 9 relations (§9) | F004 specifies 8 (`CONTAINS, IMPORTS, EXPORTS, CALLS, EXTENDS, IMPLEMENTS, USES, REFERENCES`); none built |
| Relationship resolution | numeric confidence per edge | EXTRACTED/INFERRED + score | bounded indexed D1 lookup → RESOLVED/AMBIGUOUS/UNKNOWN (specified) |
| Evidence/provenance | reason + confidence | file/line/confidence/context | evidence_state + source location + snapshot + repository + commit (specified) |
| Ambiguity | not stored as a state | AMBIGUOUS label exists, 0 here | AMBIGUOUS + candidate set retained (specified) |
| Unknown state | not observed | not observed | explicit `UNKNOWN` (specified) |
| Communities | Leiden, 38 Community nodes | 255 communities | none |
| Processes | 217 flows | none observed | none |
| Impact / blast radius | `impact`, `detect_changes` | `affected` command | none yet (matrix #8 ADAPT) |
| Semantic search / embeddings | opt-in; 0 present | optional LLM extraction; not run | none |
| MCP | server + tools | not exercised | none yet |
| Incremental | commit-based freshness | hash manifest | content-hash idea specified, not built |
| Parser caching | UNKNOWN | disk cache | none in Workers path |
| Large files | 1 skipped >512 KB | none for source (per research) | `CODE_INTEL_MAX_FILE_SIZE_BYTES`; F004 large-file unit undecided |
| Deterministic core | structural graph deterministic (INFERENCE from CLI docs) | AST path deterministic; semantic optional | deterministic by constitution/CLAUDE.md |
| AI dependency | none for structural graph; embeddings optional | none for `update` | none required |
| Queue architecture | none | none | Cloudflare Queues, per-file unit (undecided under T007) |
| Cloudflare compatibility | native module + local DB: not a Workers runtime | Python/local files | designed for Workers Free (CPU unproven) |

---

## 12. CodeGraph Comparison

Basis: existing RepoAtlas research only (`research/CODEGRAPH_RESEARCH.md`, `docs/investigations/004-relationship-graph-cpu-and-reference-architecture.md`). **CodeGraph was not executed against RepoAtlas.** `[SRC]`

| Idea (CodeGraph) | vs GitNexus / Graphify / RepoAtlas F004 | Decision |
|---|---|---|
| Parse once, derive all edges from one traversal | Graphify does the same; RepoAtlas parses twice (F002 discards tree via `tree.delete()`, F004 re-parses) | INSPIRE→ADAPT; single-pass is decided **DEFER** in 005 §8.2; FR-017 blocks changing F002 |
| Parser reuse (`parserCache`, per language) | portable pattern; recycle interval is Node-specific | ADOPT if `grammar-provider.ts` re-instantiates per file (unchecked) |
| `unresolved_refs` queue + separate `ReferenceResolver` | RepoAtlas F004 resolver resolves within the file unit via bounded lookups | ADAPT (store UNKNOWN/AMBIGUOUS rather than queue) |
| Hard 1 MiB whole-file skip, contained per file | RepoAtlas has a 10 MiB gate; large fixtures already unsafe locally | ADAPT — the ceiling idea maps directly onto the T007 large-file problem; threshold would need evidence |
| Closed versioned `NodeKind`/`EdgeKind`, `provenance` column | RepoAtlas has closed 8-type union + evidence_state | ADAPT/REPOATLAS-NATIVE |
| `worker_threads` parse pool; Rust flat-buffer path | no Workers analogue | REJECT |
| Incremental parsing (`tree.edit`) | neither reference uses it; F004 is fresh-file-per-unit | DEFER |
| Traversal (BFS, impact radius, RWR/PageRank ranking) | belongs to later phases | DEFER |

---

## 13. Feature 004 Relationship Comparison

Equivalence is stated only where edge semantics were observed or documented, not from names. "F002" = what exists today.

| Rel | F002 (current) | GitNexus | Graphify | CodeGraph (research) | Extraction / resolution (F004 spec) | Risk / CPU | Decision |
|---|---|---|---|---|---|---|---|
| CONTAINS | **derivable**: `directories.parent_path`, `file_extractions.directory_path`, `symbols.parent_symbol_id` | closest: CONTAINS (Folder/File/Section) + DEFINES + HAS_METHOD | direct: `contains` 2,631, plus `method`, `defines` | structural `contains` edges from extraction | pure D1 read, no parse (§4) | low; no parse cost | REPOATLAS-NATIVE |
| IMPORTS | missing (declarations only) | direct: IMPORTS 469 | closest: `imports` 694 / `imports_from` 436 (include external package targets) | resolved via import step | parse captures + `findFileByImportPath` → RESOLVED / UNKNOWN (external) | moderate | ADAPT |
| EXPORTS | **derivable**: `symbols.is_exported` | closest: `isExported` property, no edge | none observed | UNKNOWN from existing research | D1 read of `is_exported`, no parse | low | REPOATLAS-NATIVE |
| CALLS | missing | direct: CALLS 1,106 (0.5–0.95) | direct: `calls` 543 + `indirect_call` 33 | calls via resolver | call captures + bounded lookup → RESOLVED / AMBIGUOUS / UNKNOWN | **highest** (resolution-heavy fixtures were own T006 row) | ADAPT / IMPROVE |
| EXTENDS | missing | 0 edges observed; not evidence of incapability (INCOMPLETE) | 0 observed | EdgeKind list includes extends (research) | clause capture + symbol lookup | low–moderate | DEFER (no in-repo test target) |
| IMPLEMENTS | missing | direct: IMPLEMENTS 3 (+ METHOD_IMPLEMENTS 18) | direct: `implements` 3 | in EdgeKind list | clause capture + symbol lookup | low–moderate | ADAPT |
| USES | missing | closest at best: ACCESSES 19 (read/write) — not equivalent by name | none observed | UNKNOWN | same bounded lookup as CALLS | moderate | REPOATLAS-NATIVE |
| REFERENCES | missing | none observed | `references` 78 (semantics differ: many point to package dependency nodes) — closest only | references present | catch-all bounded lookup | moderate | REPOATLAS-NATIVE (define semantics in spec) |

**Source cross-check** `[SRC][GN][GFY]`: `src/` has exactly three `implements` clauses (`MemoryAtlasCache`, `CompositeAtlasCache`, `FileSqliteAtlasCache`); GitNexus IMPLEMENTS = 3; Graphify `implements` = 3 → **AGREEMENT**. `src/` has one `extends` (`AtlasError extends Error`, an external built-in); neither tool emitted an edge → consistent with an unresolved external target, and uninformative about in-repo EXTENDS capability.

---

## 14. Evidence-State Comparison

| Concept | RepoAtlas F004 (specified; 5 states, one canonical column) | GitNexus | Graphify | CodeGraph (research) |
|---|---|---|---|---|
| Extracted fact | `EXTRACTED` | edge exists, conf 1 (structural) | `EXTRACTED` | `[EXTRACTED]` nodes + `contains` edges |
| Resolved reference | `RESOLVED` (exactly one candidate) | edge with `reason import-resolved`, conf 0.8–1 | `EXTRACTED` (no separate resolved state) | concrete edge after `ReferenceResolver` |
| Inferred | `INFERRED` (+confidence); **v1 resolver never emits it** (T070 asserts this) | conf <0.8 (`global`, `interface-dispatch`) | `INFERRED` + score (42 edges) | heuristic provenance |
| Ambiguous | `AMBIGUOUS` + retained candidate rows | not observed as state | label exists; 0 here; no candidate sets stored | resolver picks/queues |
| Unresolved / unknown | `UNKNOWN` (explicit row, never omitted) | not observed | not stored | `unresolved_refs` queue, status `failed` |
| Provenance | file, symbol, snapshot, repository, commit SHA | `reason`, `lastCommit` at index level | file+line, `built_at_commit`, `ast_hash` | `provenance` column, line/col |
| Revision context | per-snapshot | one commit per index | one commit per graph | file sha256 |

**Retain**: the five-state single canonical column, explicit UNKNOWN, retained AMBIGUOUS candidates, per-snapshot provenance. **Adapt**: numeric confidence only for `INFERRED`, Graphify's rubric idea. **Improve** over both tools: snapshot/commit provenance per row. **Defer**: any INFERRED-producing heuristics. **Reject**: representing "unresolved" as absence. UNKNOWN is never collapsed to false.

---

## 15. CPU / Performance Implications

Authoritative source for RepoAtlas's CPU decision remains Feature 005 (`[SRC]` DR §6.4, §14): no numeric Free queue-consumer budget is established; local wall-clock is comparative only. No limit is asserted here.

- Reference architectures show a **structural** lever (single parse, one traversal), not a proven Workers-CPU lever. Both reference projects run as long-lived local processes with no per-invocation CPU ceiling (`[SRC research]`).
- Parse-once/single-pass: relevant to F004's dominant cost (spec research: ~67–70% is the second parse). 005 §8.2 = DEFER; adoption would need an F002 change (FR-017) and separate approval. **This does not contradict any 005 decision** (no direct evidence contradicts one).
- Parser reuse, query compilation: GitNexus/Graphify give no observed data; CodeGraph's `parserCache` is a documented pattern.
- Large-file handling: CodeGraph's hard skip and GitNexus's >512 KB skip are precedent for a size ceiling, which is one of the mitigations Feature 004's own research.md names for the T007 large-fixture failure. Not evidence of safety.
- Incremental parsing, worker parallelism (thread pools), Rust kernels: no Workers analogue or no use in references.
- Indexing cost numbers (GitNexus 4.9 s, Graphify 3.9 s) are local wall-clock on a developer machine and are **not** Cloudflare CPU-ms.
- Memory/process-discovery cost: no measurements exist for Workers.

---

## 16. Graph-Assisted Dependency Findings

Discovery from graphs, verified against source. Graphs authorize nothing.

| Finding | Graph evidence | Source verification | Status |
|---|---|---|---|
| `cloudflare-env.ts` (T008 edit target) has 34 importers, incl. both symbol and snapshot workers and 15+ tests | `[GN]` IMPORTS query: 34 rows; `[GFY]` 34 | `grep` of `from '…cloudflare-env'` = 34 | **AGREEMENT** |
| `atlas-errors.ts` (T010 target) has 19 importers; real path is `src/lib/atlas-errors.ts` not `src/lib/code-intel/atlas-errors.ts` | `[GN]` 19 rows + Class `AtlasError` at that path; `[GFY]` 19 | `grep` = 19; `ls` confirms path | **AGREEMENT**; task text path is wrong |
| `getSymbolQueue` (mirror source for T008) is HIGH risk per GitNexus (6 impacted, 3 processes) | `[GN]` `impact` | additive interface/function change | INFERENCE: an additive new field/function does not alter existing callers |
| `symbol-d1-client.ts` (T009 mirror) importers: 11 (symbol functions, pipeline, worker, tests) | `[GN]` | not independently grepped | UNVERIFIED cross-check |
| `symbol-worker.ts` importers: `plugins/cloudflare-symbol-queue.ts`, `symbol.functions.ts`, 4 tests | `[GN]` | file location confirmed in `symbols/` | FACT (location) |
| `grammar-provider.ts` importers incl. the spike scripts and `tests/support/wasm-test-modules.ts` | `[GN]` | F004 must keep it unchanged (FR-001) | FACT |
| `tests/support/d1-sqlite-adapter.ts` has 22 importers (T012 hotspot) | `[GN]` | — | UNVERIFIED cross-check |
| `config.ts` importers: `nitro.config.ts` + 7 code-intel files | `[GN]` | T002 already added additive constants | FACT |
| Conflict hotspots for a future wave | — | `relationship.functions.ts` chain T025→T030→T046→T048→T053; `relationship-d1-client.ts` (T009, T031); `nitro.config.ts`/`wrangler.toml` (T011); `.scm` files (T014 vs T019); `__root.tsx` (T054) | `[AGENT]` from task text |
| Existing F004 code visible to graphs | GitNexus `relationships/` 5 files; Graphify 13 nodes from `domain/relationship.ts` and `relationship-identity.ts` (`.scm` files not nodes) | files exist | FACT |

---

## 17. Agency Agent Lenses

All roles below were **applied as in-session reasoning lenses**. No independent sub-agent process was launched at any point. (Knowledge Graph Engineer was added because graph-model comparison was central.)

- **Software Architect (primary)**: cross-feature graph, dual T007 blockers, hotspots, wave shape.
- **Codebase Onboarding Engineer**: index structure, module importers, task path discrepancies.
- **Evidence Collector**: register of tool runs, hash/`shasum` checks, evidence origins.
- **Reality Checker**: challenged "index up-to-date" (dirty tree), "[X] = cleared", "Feature 005 done ⇒ 004 ready", the 90-vs-38 community count, and 0 `extends` edges as capability evidence.
- **Knowledge Graph Engineer**: relationship/evidence-state mapping (§13–§14).

---

## 18. Feature 004 Readiness Matrix

Classes: READY / BLOCKED / NOT READY / CONDITIONAL / HUMAN DECISION REQUIRED. Completed tasks are marked "complete" (no class applies). **G** = Phase-2 gate: 004 T007 result is STOP (`likely unsafe`, research.md §1) and 005 DR §14.3 keeps it STOPPED; tasks.md lines 30/43/209–210 gate T008+ on it. **Ready now?** is "No" for every incomplete task. No overall score, no preference ranking.
Columns: Task | Status | Prerequisites (tasks.md; `†` = derived from file dependency, `[AGENT]`) | Cross-feature / CPU / safety | GN·GFY relevance | Class | Reason / next action.

| Task | Status | Prerequisites | Cross-feature · CPU · safety | GN·GFY | Class | Reason / next |
|---|---|---|---|---|---|---|
| T001 | [X] | — | F004 dirs; verified present (empty test dirs) | low | complete | — |
| T002 | [X] | — | `config.ts` +21 additive, uncommitted | GN: 8 importers | complete | — |
| T003 | [X] | — | schema +77 lines, 4 tables; F001/F002 schema unchanged (additive) | low | complete | — |
| T004 | [X] | — | `domain/relationship.ts` exists | GFY node | complete | — |
| T005 | [X] | — | `relationship-identity.ts` exists; untested until T013 | GN/GFY node | complete | — |
| T006 | [X] | — | LOCAL-WALLCLOCK spike; script + results exist | none | complete | evidence is local proxy only |
| **T007** | [X] | T006 | 005 §14.3 STOPPED; 004 research §1 STOP; no waiver | none | **HUMAN DECISION REQUIRED** | `[X]` vs STOPPED unreconciled. Needs one of: explicit FR-038 waiver (names X, M, unit), authorized live measurement (LX-1), or reviewed Feature 004 amendment (e.g. large-file ceiling / narrower unit) |
| T008 | [ ] | T007 gate | edits `cloudflare-env.ts` (34 importers); no CF op | GN HIGH on `getSymbolQueue` | BLOCKED | text "once T007 clears the gate"; additive only |
| T009 | [ ] | T007 gate | mirrors `symbol-d1-client.ts`; F002 D1 | GN 11 importers of mirror | BLOCKED | gate; parallel-capable in a future wave |
| T010 | [ ] | T007 gate | **path wrong in task text** (`src/lib/atlas-errors.ts`); 19 importers | GN·GFY agree | BLOCKED | gate; path needs correction by an approved edit, not by me |
| T011 | [ ] | T007 gate | edits `nitro.config.ts`, `wrangler.toml`; config only, no deploy | low | BLOCKED | gate; serial hotspot; any remote apply needs explicit authorization |
| T012 | [ ] | T003 ✓, T007 gate | `d1-sqlite-adapter.ts` 22 importers; conditional edit | GN hotspot | BLOCKED | gate (body is conditional) |
| T013 | [ ] | T005 ✓, Phase-2 | pure test; CPU none | low | BLOCKED | phase gate; only file dep is done (`†`) but SpecKit gate applies |
| T014 | [ ] | T019† | needs real `.scm`; shares files with T019 | none | BLOCKED | gate; hotspot with T019 |
| T015 | [ ] | T021† | integration test | none | BLOCKED | gate |
| T016 | [ ] | T022† | integration test | none | BLOCKED | gate |
| T017 | [ ] | T022† | integration test | none | BLOCKED | gate |
| T018 | [ ] | T021 | integration test | none | BLOCKED | gate |
| T019 | [ ] | T006 drafts | `.scm` files already exist untracked | none | BLOCKED | gate; INCOMPLETE state (files exist, unchecked) |
| T020 | [ ] | T019 | parse-fact mapping; CPU-relevant | GFY parse pattern | BLOCKED | gate |
| T021 | [ ] | T009 | pure D1; no parse | none | BLOCKED | gate |
| T022 | [ ] | T009, T020 | bounded lookup resolver; CPU | none | BLOCKED | gate |
| T023 | [ ] | T020, T021, T022 | **"one file per invocation per T007's confirmed granularity"** — not confirmed; CPU-critical | none | BLOCKED | gate + unit design undecided (005 §6.4) |
| T024 | [ ] | T021, T023 | queue consumer; **path text mismatch**; CPU | GN: mirror in `symbols/` | BLOCKED | gate + granularity |
| T025 | [ ] | T024 | server fn; `relationship.functions.ts` chain start | none | BLOCKED | gate |
| T026 | [ ] | T025† | test | none | NOT READY | waits on blocked T025 |
| T027 | [ ] | T025† | test | none | NOT READY | same |
| T028 | [ ] | T025† | test | none | NOT READY | same |
| T029 | [ ] | T025† | test | none | NOT READY | same |
| T030 | [ ] | T025 | same file as T025 | none | NOT READY | serial chain |
| T031 | [ ] | T023 | edits T009's client (conditional: "if not already covered") | none | NOT READY | conditional body; serial with T009 |
| T032 | [ ] | T022† | test | none | NOT READY | waits on resolver |
| T033 | [ ] | T022† | test | none | NOT READY | same |
| T034 | [ ] | T022† | test | none | NOT READY | same |
| T035 | [ ] | T022† | test | none | NOT READY | same |
| T036 | [ ] | T022† | test | none | NOT READY | same |
| T037 | [ ] | T023† | test | none | NOT READY | waits on pipeline |
| T038 | [ ] | T023† | test | none | NOT READY | same |
| T039 | [ ] | T046† | test | none | NOT READY | same |
| T040 | [ ] | T031†/T046† | crosses F002 (`SYMBOL_EXTRACTOR_VERSION`) | none | NOT READY | cross-feature check; F002 must stay unmodified (FR-017) |
| T041 | [ ] | T024† | test | none | NOT READY | queue |
| T042 | [ ] | T047† | test | none | NOT READY | queue |
| T043 | [ ] | T046† | test | none | NOT READY | queue/functions |
| T044 | [ ] | T025† | test | none | NOT READY | — |
| T045 | [ ] | T023† | test | none | NOT READY | — |
| T046 | [ ] | T025, T031 | `relationship.functions.ts` | none | NOT READY | serial chain |
| T047 | [ ] | T024 | `relationship-worker.ts` | none | NOT READY | — |
| T048 | [ ] | T009, T025 | `relationship.functions.ts` | none | NOT READY | serial chain |
| T049 | [ ] | T053† | test | none | NOT READY | — |
| T050 | [ ] | T053† | test | none | NOT READY | — |
| T051 | [ ] | T053† | test | none | NOT READY | — |
| T052 | [ ] | T053† | test | none | NOT READY | — |
| T053 | [ ] | T009, T025 | `relationship.functions.ts` | none | NOT READY | serial chain |
| T054 | [ ] | T048, T053 | `__root.tsx` (shared UI root) | GN/GFY: check importers first | NOT READY | additive line |
| T055 | [ ] | all US | `tsc` whole repo | — | NOT READY | serial |
| T056 | [ ] | US files | lint | — | NOT READY | parallel with T057/T058 |
| T057 | [ ] | T003 ✓ | schema load | — | NOT READY | parallel |
| T058 | [ ] | contracts + impl | manual diff | — | NOT READY | parallel |
| T059 | [ ] | Phase 3–6 | full `bun test`; known flake | — | NOT READY | serial |
| T060 | [ ] | Phase 3–6 | 004 tests | — | NOT READY | parallel w/ T061–T063 |
| T061 | [ ] | T059 context | F001 regression | — | NOT READY | parallel |
| T062 | [ ] | same | F002 regression | — | NOT READY | parallel |
| T063 | [ ] | same | F003 regression | — | NOT READY | parallel |
| T064 | [ ] | Phase 7–8 | `bun run build` | — | NOT READY | serial |
| T065 | [ ] | T064 | inspect bundle | — | NOT READY | parallel |
| T066 | [ ] | T064 | size vs F002 baseline | — | NOT READY | parallel |
| T067 | [ ] | T064 | account-assumption grep | — | NOT READY | parallel |
| T068 | [ ] | T065–T067 | remove `.output/` | — | NOT READY | serial; deletes a gitignored dir |
| T069 | [ ] | T015–T018, T032–T036 | confirm coverage | — | NOT READY | — |
| T070 | [ ] | tests | confirm 5 states | — | NOT READY | — |
| T071 | [ ] | T006 harness | new script; local estimate only | — | NOT READY | new measurement (local) |
| T072 | [ ] | T071 | compare to Free caps (docs read) | — | NOT READY | 005 D1 figures UNKNOWN |
| T073 | [ ] | pipeline | 300-file local sim; CPU-relevant | — | NOT READY | new local measurement |
| T074 | [ ] | T073, T007 | re-triage vs T007 | — | NOT READY | needs T007 resolved |
| T075 | [ ] | Phase 7–10 | local-validation summary | — | NOT READY | — |
| T076 | [ ] | T075 | report and WAIT; no push/deploy/live | — | HUMAN DECISION REQUIRED | authorization phase |

**Hypothetical wave shape if the gate were later resolved (analysis only, not authorization)** `[AGENT]`: Wave A (parallel, distinct files): T008, T009, T010, T012 → T011 serial (shared config files). Wave B: T013, T019 parallel; T014 after T019; T020; T021 (after T009). Wave C: T022 → T023 → T024 → T025. Then the `relationship.functions.ts` chain must stay serial; test tasks in Phases 4–6 are file-independent and parallel-capable; Phases 7–10 mix serial gates (T055, T059, T064) with parallel checks.

---

## 19. Safety / Authorization State

- Feature 004 T007: **STOPPED** (unchanged; not cleared, not reinterpreted). `[X]` on the checkbox is not authorization.
- No Cloudflare, Wrangler, remote D1/Queues/R2, dashboard or API operation occurred in this stage. No deployment. No Git mutation (HEAD unchanged, no commit, no push).
- LX-1 live experiment: `NOT AUTHORIZED`. No waiver exists.
- Local tool operations performed and authorized: read-only GitNexus queries; `graphify update .` (user-authorized); `bunx tsc --noEmit`. Registry hash `~/.gitnexus/registry.json` unchanged by my commands.
- `.graphifyignore` retains the four `.gitnexus` patterns; `.gitignore` retains `.gitnexus`. Not weakened.

---

## 20. Unresolved Questions

1. How is T007 to be resolved: FR-038 waiver, authorized LX-1, or a reviewed Feature 004 amendment (e.g. size ceiling or narrower unit)? (human)
2. Reconcile record state (needs an approved edit): 004 T007 `[X]`; 005 tasks.md 0/49 checked; 005 DR header "SKELETON".
3. Should the auto-generated GitNexus blocks in `AGENTS.md` and `CLAUDE.md` stay? They carry imperative rules ("MUST/NEVER", "run `npx gitnexus analyze` when stale") that are stronger than this repo's governance (`docs/AGENT-GOVERNANCE.md` says graphs are derived and advisory; CLAUDE.md forbids unauthorized commits/heavy actions). `analyze` also mutates the index and those files. Left unchanged.
4. Should `.claude/skills/gitnexus/` be excluded from Graphify (53 nodes today)? Requires a `.graphifyignore` edit, which was not authorized.
5. 004 tasks.md path corrections (T010, T024) and T019 status (files exist, unchecked).
6. GitNexus 90 vs 38 community discrepancy; identity of the one skipped >512 KB file.
7. Working-tree staleness of GitNexus/Graphify after 14:32/14:44 (any edit, including this stage's own report and log writes, postdates both).
8. Whether `bun test`/`bun run build` still pass unchanged (not run).
9. EMBEDDING EXPERIMENT: proposed only if a later retrieval feature needs it (§22 note); not executed.

---

## 21. Exact Next Action

**Outcome E (human authorization/decision required), with F-type housekeeping. Not A, B, C or D.**

- **Why blocked**: Feature 004's own T007 result is STOP (large fixtures `likely unsafe` locally), and Feature 005 leaves T007 STOPPED because no authoritative Free-plan queue-consumer CPU budget or telemetry exists, no unit is selectable, and no waiver exists. A local measurement cannot supply the missing evidence (DR §6.4 (a)).
- **Exact evidence/authorization missing**: one of (i) an explicit user waiver naming assumed budget X, margin M and the selected unit (FR-038); (ii) explicit authorization for a live experiment such as LX-1 (Free-plan-safe pre-flight required); (iii) a reviewed amendment of Feature 004 after Feature 005's record is reviewed (FR-037), e.g. a large-file ceiling or narrower unit, which CodeGraph's hard size skip supports as an approach but does not prove safe.
- **Can anything else in Feature 004 proceed independently?** No. Every remaining task is either text-gated by T007 (T008–T025) or depends on gated tasks. T013 depends only on completed T005 by file, but the SpecKit phase gate still applies, and readiness was not inferred.
- **Recommended sequence for the user**: (1) review `decision-record.md` (required before any amendment); (2) decide among (i)–(iii); (3) approve a small record-hygiene edit to fix the three contradictions and the two task-path errors; (4) only then request a dependency-ordered wave for the tasks that become READY.
- **No embedding experiment is recommended now.**

---

## 22. Evidence Register

| Id | Item | Origin | Value |
|---|---|---|---|
| G1 | GitNexus baseline | `[GN]` (user-run) | v1.6.8; `analyze .`; c576310 = HEAD; 4.9 s; 4,706 nodes; 7,289 edges; 90 clusters; 217 flows; 1 skipped >512 KB |
| G2 | `.gitnexus/meta.json` | `[GN]` | files 345, indexedAt 2026-09-24T10:32:12Z, embeddings 0 |
| G3 | Node/edge distribution | `[GN]` cypher | §7 |
| G4 | Community node count | `[GN]` cypher | 38 (vs 90 recorded) |
| F1 | Graphify run | `[GFY]` | 0.9.6; `graphify update .`; 2026-09-24T10:44:05Z; c576310; 3,073/4,502; 255 communities; 3.855 s |
| F2 | Graphify relation/confidence counts | `[GFY]` | §9 |
| F3 | 53 nodes from `.claude/skills/gitnexus/` | `[GFY]` | 0 from `.gitnexus/` |
| S1 | 004 tasks.md | `[SRC]` | 7 [X], 69 [ ] |
| S2 | 004 research.md §1 | `[SRC]` | large fixtures `likely unsafe`; decision STOP |
| S3 | 005 DR §6.4/§13/§14 | `[SRC]` | no unit; no waiver; T007 STOPPED; all FR-028 unsatisfied |
| S4 | 005 tasks.md | `[SRC]` | 0 [X], 49 [ ] |
| S5 | 005 Set A/B hash check (run now) | `[SRC-run]` | 0 mismatches over 150 files |
| S6 | `bunx tsc --noEmit` (run now) | `[SRC-run]` | exit 0, no output |
| S7 | importer counts | `[GN]`,`[GFY]`,`[SRC]` grep | cloudflare-env 34/34/34; atlas-errors 19/19/19 |
| S8 | `implements` clauses | `[SRC]`,`[GN]`,`[GFY]` | 3/3/3 |
| S9 | Stage-3-start snapshot | `[SRC-run]` | `specs/**` 100% byte-identical before/after; CLAUDE.md, AGENTS.md, constitution, AGENT-GOVERNANCE.md, agency mapping unchanged by this stage |

---

## 23. Limitations

- GitNexus statistics for the baseline are as given by the user's run; I did not re-run `analyze`. GitNexus and Graphify both indexed a dirty tree.
- Graphify skipped/excluded file count is UNKNOWN; GitNexus skipped-file identity is INFERENCE.
- No independent semantic or embedding data exists in either tool.
- CodeGraph and Graphify-as-reference statements come from existing RepoAtlas research, not from running them on RepoAtlas.
- Feature 005 "no live operation" rests on the logs and integrity hashes; no independent network audit is possible from here.
- WebFetch-derived Cloudflare statements were not re-read in this stage.
- Local timings anywhere in this report are wall-clock and not Cloudflare CPU-ms.
- Task-level "†" prerequisites are my file-dependency reading, not tasks.md text.

---

## 24. Side Effects / Tooling Mutations

| Item | Detail |
|---|---|
| `graphify-out/` created | By the authorized `graphify update .`; gitignored; artifacts listed in §9 |
| No source, spec, CLAUDE.md, AGENTS.md, constitution, `.graphifyignore`, `.gitignore` edit | Verified by SHA-1 (governed files) and `git status` comparison |
| GitNexus registry | Hash unchanged across this stage's queries. Earlier (Stage 2) incident: `ADLC-KQSE` entry auto-pruned by `gitnexus status`/`list`; **not** reconstructed and previous registry state remains unknown. This stage avoided `list`/`status`. `impact`/`cypher -r` did not alter the registry |
| Pre-existing tool-generated edits | `AGENTS.md`, `CLAUDE.md` GitNexus blocks, `.claude/skills/gitnexus/`, `.gitignore` `.gitnexus`, `.graphifyignore`: not made by me; left as found |
| Files written by this stage | this report; appended entries to `docs/progress/PROGRESS.md`, `docs/prompts/claude-prompts/prompt-log.md`, `docs/audit_reports/audit-log.md` |
| Overwritten by this stage | prior `docs/claude_report/reports.md` (Stage 2 report), as the convention requires |
| Not done | commit, push, deploy, Cloudflare/Wrangler, embeddings, `gitnexus analyze`, semantic Graphify, T007 change |

STOPPED after the Stage 3 analysis and report. Feature 004 and Feature 005 were not executed; T007 remains STOPPED.
