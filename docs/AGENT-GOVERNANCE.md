# RepoAtlas Agent & Engineering Intelligence Governance

Reference model for how RepoAtlas's agents, tools and engineering-intelligence sources cooperate. It **describes** the system; it does **not** override `CLAUDE.md`, `AGENTS.md`, the constitution, or any feature spec, and it defines no separate instruction hierarchy. Where this document and one of those disagree, the other one wins and this document should be corrected.

Inventory status below is as observed on 2026-09-24 at `HEAD c576310` (branch `feat/atlas-marble-interaction`, working tree dirty). Labels: **FACT** (observed), **INFERENCE** (reasoned, not observed), **UNKNOWN** (not established).

## 1. Purpose

- Give humans and agents one repository-versioned map of the development environment, because tool-specific configuration (Cursor rules, user-level Claude settings) is not shared automatically.
- Define how derived intelligence (graphs, personas) is weighed against source truth.
- Define how work is parallelized and how features progress, without weakening SpecKit or safety gates.

## 2. System Components

| Component | Role | Location / form |
|---|---|---|
| `CLAUDE.md` | Claude-specific permanent operating contract | `repo-atlas/CLAUDE.md` |
| `AGENTS.md` | Shared, tool-neutral repository instructions | `repo-atlas/AGENTS.md` |
| `AGENT-GOVERNANCE.md` | This reference model | `docs/` |
| SpecKit + constitution | Feature lifecycle framework; non-negotiable principles | `.specify/`, `.claude/skills/speckit-*` |
| Feature specs | Authoritative feature requirements, plans, tasks | `specs/<NNN-name>/` |
| Agency Agents | Specialist reasoning lenses; role catalogue | `docs/agency-agents-for-repo-atlas.md` |
| Claude Code | Terminal executor | this CLI |
| Cursor | Review/orchestration; carries its own rules | `../.cursor/rules/` (workspace root, outside repo), `.cursor/` in repo |
| GitNexus, Graphify | Derived engineering-intelligence tools (§5, §6) | user-level tools; see inventory |
| RepoAtlas-native intelligence | Snapshot + AST + symbol + relationship layers (§7) | `src/lib/code-intel/`, `specs/001`–`004` |
| Source, snapshots, AST evidence | Underlying engineering truth | working tree, immutable snapshots |

## 3. Authority and Precedence

Precedence is defined in `CLAUDE.md` ("Instruction Hierarchy") and, for Cursor, in the Cursor routing rule. This document adds nothing to it. For orientation only:

- User instruction, safety gates and feature-specific safety rules come first.
- The constitution's non-negotiables, `AGENTS.md` and `CLAUDE.md` come next.
- Feature `spec.md` > `plan.md` > `tasks.md` > contracts/decision records follow.
- Agency Agent personas and graph tools are advisory and never override any of the above.

## 4. Source Truth and Evidence

**Truth-to-synthesis flow** (each layer derives from the one above and never outranks it):

```text
SOURCE / SNAPSHOT
  → AST / deterministic extraction
  → RepoAtlas-native evidence
  → GitNexus / Graphify derived intelligence
  → Agency Agent analysis
  → Claude synthesis
```

The order is a default, not an assumption of coverage. Where RepoAtlas has no native capability yet (for example impact analysis, process discovery, community detection), GitNexus or Graphify output may be the best available evidence. Record it with its real provenance and treat it as derived.

**Claim status:** `FACT`, `INCOMPLETE`, `UNVERIFIED`, `CONTRADICTION`, `UNKNOWN`. Never upgrade a status without supporting evidence.

**Evidence origin** (state which one a claim rests on): SOURCE EVIDENCE · AST/DETERMINISTIC EVIDENCE · REPOATLAS GRAPH EVIDENCE · GITNEXUS EVIDENCE · GRAPHIFY EVIDENCE · AGENT INTERPRETATION · MODEL SYNTHESIS.

Rules:
- Derived graph output is never source truth. Verify critical conclusions against source.
- Local wall-clock measurements are not platform CPU guarantees.
- Do not invent missing limits or relationships. `UNKNOWN` stays `UNKNOWN`.
- Do not infer absence from incomplete extraction.

## 5. GitNexus

**Observed:**
- FACT: `gitnexus` CLI 1.6.8 is installed (`~/.nvm/versions/node/v22.22.3/bin/gitnexus`). Commands include `analyze`, `status`, `query`, `context`, `impact`, `trace`, `cypher`, `detect-changes`, `check`, `mcp`.
- FACT: an MCP entry `gitnexus` exists in `~/.cursor/mcp.json`. No `gitnexus` entry was found in `~/.claude.json` or `~/.claude/settings.json`.
- FACT: `~/.gitnexus/registry.json` lists 6 indexed repositories (skillset, app, memory, observability, JavaClaw, universl-adlc). **RepoAtlas is not among them.** (A 7th entry, `ADLC-KQSE`, whose path no longer exists, was auto-pruned by the `gitnexus status`/`list` read commands during this inventory.)
- FACT: GitNexus read commands can rewrite the global registry as a side effect; treat even `status`/`list` as non-read-only when a task forbids touching GitNexus state.
- FACT: `repo-atlas/.gitnexus/` does not exist, and `gitnexus status` inside the repo reports "Repository not indexed."
- FACT: `.gitignore` has no `.gitnexus` entry.

**Consequence:** no GitNexus graph, symbols, relationships or process data currently exists for RepoAtlas. It represents no RepoAtlas revision, so freshness is not applicable. No RepoAtlas regeneration command or script was found.

**UNKNOWN:** whether it was ever run on RepoAtlas and later removed; how a new index would behave on this repo (not run, per the task's constraint).

**INFERENCE:** if indexed later, the index would be local-only and generated. Add `.gitnexus/` to `.gitignore` first if it should stay uncommitted.

## 6. Graphify

**Observed:**
- FACT: `graphify` CLI is installed (`~/.local/bin/graphify`) and a `graphify` skill exists at `~/.claude/skills/graphify` (the user-level `CLAUDE.md` routes `/graphify` to it). `~/.claude.json` records one prior use of that skill, with no record of which directory.
- FACT: `.gitignore` ignores `graphify-out/` (line 63–64). **No `graphify-out/` exists in `repo-atlas/`.**
- FACT: no Graphify graph, report, HTML or index artifact was found for RepoAtlas, so no nodes, relationships, symbol or call data are established for it.
- FACT: separately, the **Graphify source repository** is cloned at `../repotlas-references/graphify` (commit `26b02b5`) and was studied read-only as a **reference architecture** (`research/GRAPHIFY_RESEARCH.md`, `docs/investigations/004-relationship-graph-cpu-and-reference-architecture.md`). That study describes Graphify's design; it is not a Graphify run over RepoAtlas.

**UNKNOWN:** whether Graphify was ever run on RepoAtlas; regeneration procedure specific to this repo (the generic skill usage would be `/graphify <path>`, not yet performed).

## 7. RepoAtlas Native Intelligence

- FACT: Features 001–002 provide the immutable `Repository → Snapshot → SnapshotFile` model and AST symbol extraction (`evidence_state = EXTRACTED`) in `src/lib/code-intel/`.
- FACT: Feature 004 specifies a relationship graph (`specs/004-engineering-relationship-graph/`) with stable identity, evidence state and provenance. Its CPU-feasibility gate is unresolved (see §12 and §13).
- FACT: Feature 005 is a decision-only CPU-feasibility workstream; it does not implement graph features.
- Native evidence is deterministic and snapshot-addressable. That is what makes it the preferred basis when it covers the question.
- No claim is made that native capability is complete or equals Graphify/CodeGraph (see §16).

## 8. Graph Conflict and Staleness

When Graphify, GitNexus and source/AST disagree, do not silently pick one. Classify, then resolve with source where available:

| Class | Meaning | Action |
|---|---|---|
| AGREEMENT | Independent sources concur | Still verify anything decision-critical against source |
| GRAPH DISAGREEMENT | Graphify and GitNexus differ; no source check yet | Check source/AST; record both claims until resolved |
| SOURCE-CONTRADICTED | Source/AST evidence contradicts a graph claim | Source wins; record the graph error |
| STALE GRAPH | Graph revision ≠ working tree/`HEAD` (or revision unknown) | Treat as `UNVERIFIED`; re-index only with user approval, or verify in source |
| UNKNOWN | No source available and graphs cannot be judged | Report `UNKNOWN`; do not decide |

Staleness check before relying on a graph: compare its recorded commit/index time to `git rev-parse HEAD` and uncommitted changes. Registry entries with an empty `lastCommit` cannot be checked and are `UNVERIFIED`.

## 9. Agency Agents

Operating model:

```text
Task → smallest useful specialist set → primary → supporting (only if needed)
     → challenge / reality check → synthesis → controlled execution → validation
```

- Normally one primary role plus supporting roles only where the task crosses disciplines. Do not activate the roster. The role catalogue is `docs/agency-agents-for-repo-atlas.md`.
- Personas applied inside one session are **in-session reasoning lenses** and are reported as such. Never claim independent sub-agent processes ran unless they actually ran.
- Personas never override user instructions, SpecKit, the constitution, feature specs, safety gates or source evidence.

Graph use by role (discovery layer, then verify against source):

| Role | Use of graph intelligence |
|---|---|
| Software Architect | Understand dependency structure |
| Codebase Onboarding Engineer | Find symbols, modules, relationships before reading detail |
| Impact analysis (any role) | Graph as discovery only; verify critical conclusions in source |
| Task conflict analysis | Graph relationships supplement file-level conflict checks |
| Feature readiness | Graph may reveal dependencies not obvious from filenames |
| Reality Checker | Challenge graph-derived conclusions against source |

Graph tools are optional. Do not require them where they add nothing, and per §5–§6 they currently have no RepoAtlas data.

## 10. SpecKit

```text
Specification → Clarification/Research → Plan → Tasks → Analyze → Execute → Validate → Report
```

- Framework in `.specify/`; workflow `.specify/workflows/speckit/workflow.yml` (specify → review-spec gate → plan → review-plan gate → tasks → implement).
- Feature artifacts are authoritative; `tasks.md` controls dependencies and order. Never bypass task dependencies to gain parallelism, and never edit specs to ease execution.
- FACT: the installed integration is `cursor-agent` (`.specify/init-options.json`); the `.claude/skills/speckit-*` skills are the Claude-facing entry points.

## 11. Multi-Agent Task Waves

```text
Feature/task graph → READY tasks → agent assignment → conflict analysis
                   → safe execution wave → validation → next wave
```

- **Parallel reasoning does not imply parallel repository mutation.**
- Parallel reasoning (analysis, review, research) is encouraged.
- Parallel mutation only for tasks with disjoint files, no ordering dependency and no shared logical section or artifact. Tasks touching the same logical section or artifact are serialized by default.
- SpecKit serialization requirements win. Otherwise, do not force one-at-a-time when the graph safely allows more.
- Validate (typecheck, relevant tests, diff review) after every wave before starting the next.

## 12. Cross-Feature Progression

A feature does **not** necessarily need to be 100% complete before another begins.

```text
Feature A ├─ completed prerequisite tasks ─► Feature B READY
          └─ unrelated unfinished tasks
```

Feature B may begin when its actual prerequisites are resolved:
- required predecessor artifacts exist;
- required tasks/decisions are complete and no approved safety gate remains blocking;
- feature order in `roadmap.md` is not evidence (that file is a generic checklist and does not track Features 001–005);
- no feature starts merely because it appears "next".

**Known state-model inconsistency (recorded, not reconciled):** `specs/004-engineering-relationship-graph/tasks.md` line 36 shows **T007 as `[X]`**, while Feature 005 governance (`specs/005-…/decision-record.md`) and its final report state **Feature 004 T007 is STOPPED / not cleared**. Safety interpretation: **T007 remains STOPPED** unless the explicit Feature 004/005 governance process clears it. This document does not resolve or reinterpret it.

## 13. Safety and Authorization

- No live Cloudflare operation, and no production resource mutation, without explicit authorization for that operation. Cloudflare Free plan only.
- No Git push without explicit authorization. No destructive Git operations. No commit unless asked.
- Local-first validation where specified. Feature-specific safety rules in `specs/` stay authoritative for that feature.
- **Feature 004 T007 = STOPPED** (see §12).
- Graph tools and personas confer no authorization.

## 14. Claude / Cursor Relationship

- Cursor rules (`../.cursor/rules/*.mdc`, `alwaysApply`) are Cursor-specific. FACT: Claude Code does not automatically consume them.
- Cursor and Claude do not automatically share configuration. Shared governance is therefore versioned in the repository: `AGENTS.md` (shared), `CLAUDE.md` (Claude), and this document (reference).
- The Cursor rules currently sit at the workspace root, outside the git repo, so they are unversioned. Anything both tools must obey belongs in the repo, not only in `.cursor/`.

## 15. Reporting and Auditability

Follow existing conventions (do not invent new ones): `docs/claude_report/reports.md` (overwrite; self-contained), `docs/progress/PROGRESS.md`, `docs/prompts/claude-prompts/prompt-log.md`, `docs/audit_reports/audit-log.md`. When a task forbids modifying other files, that instruction wins. Reports state which evidence origin each claim uses and whether personas were in-session lenses.

## 16. Graphify / CodeGraph / RepoAtlas Evolution Strategy

**Intent:** RepoAtlas selectively adopts and improves capabilities demonstrated by systems such as Graphify and CodeGraph, and adds RepoAtlas-native capabilities.

```text
Graphify capabilities + CodeGraph capabilities + RepoAtlas-native capabilities
   → RepoAtlas engineering intelligence
```

Decision vocabulary: **ADOPT · ADAPT · IMPROVE · DEFER · REJECT · REPOATLAS-NATIVE**. (`research/ADOPTION_MATRIX.md` also uses INSPIRE and "Build independently"; map them to ADAPT-conceptual and REPOATLAS-NATIVE when citing.) The recorded matrix lives in `research/ADOPTION_MATRIX.md` and `research/COMPARATIVE_ANALYSIS.md`.

Rules:
- FACT: RepoAtlas is **not** a complete superset of Graphify or CodeGraph, and this document makes no feature-completeness claim.
- Compare implementations against these systems where relevant. Do not copy blindly; the adoption matrix records no direct source-code reuse, only architectural adaptation.
- Reference systems' capabilities are cited only from what was read in their source, not from marketing claims.
- Scope and licensing constraints in `research/ATTRIBUTIONS.md` apply.

## 17. Governance Principles

1. Source and deterministic evidence over derived graphs; derived graphs over persona opinion.
2. Deterministic, source-derived intelligence is the foundation; AI reasons over it and does not invent core source relationships.
3. Preserve evidence labels and origins; never upgrade without evidence.
4. One authority chain: this document describes, `CLAUDE.md`/`AGENTS.md`/constitution/specs decide.
5. Smallest useful specialist set; report personas honestly.
6. Parallel reasoning freely, parallel mutation only when provably independent.
7. Readiness from actual dependencies, not order or appearance.
8. Safety gates and explicit authorization are never implied by tooling or personas.
9. Minimal change; report unrelated problems instead of fixing them.
10. Keep shared governance in the repo; do not assume tool-specific config is shared.
