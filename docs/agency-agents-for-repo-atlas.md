# Agency Agents × RepoAtlas — Adoption Notes

**Source:** [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) (MIT)  
**RepoAtlas context:** TanStack Start app on Cloudflare Workers (D1, R2, Queues), WASM `web-tree-sitter` code intelligence (Features 001–002), relationship graph in spec (004), CPU/feasibility decision work (005). Delivery is **SpecKit-driven** (`specs/`), with **Claude Code in terminal** as executor, optional **ChatGPT** for prompt drafting, **Cursor** for review/orchestration, and **`docs/`** as the narrative audit trail.

**Date:** 2026-09-24

---

## What Agency Agents is (and is not)

| | |
|---|---|
| **Is** | A large library of **markdown persona prompts** (identity, workflows, deliverables, tone). Installable into Claude Code, Cursor, Codex, etc. via [agency-agents-app](https://agencyagents.app) or `./scripts/install.sh`. |
| **Is not** | Runtime code, MCP servers, or a replacement for SpecKit tasks, contracts, or your `specs/*/tasks.md` gates. |
| **License** | MIT — you may copy/adapt text; attribute upstream if you redistribute verbatim files. |

For RepoAtlas, treat Agency Agents as **optional role overlays** on top of **hard project constraints** (SpecKit scope, Feature 004/005 CPU gates, [Cloudflare Free Plan Safety](../../.cursor/rules/cloudflare-free-plan-safety.mdc) at workspace root, `docs/prompts/claude-prompts/prompt-log.md`).

---

## Why it can help this project

RepoAtlas already splits work across humans and tools:

```text
SpecKit (spec/plan/tasks) → ChatGPT (prompts) → Claude terminal (execute) → docs/ + specs evidence
```

Agency Agents adds **repeatable specialist behavior** when you activate a role, without writing those prompts from scratch. The highest value is **narrow engineering/testing personas** that match recurring RepoAtlas workstreams—not the full “agency” roster.

### Strong fit (recommended subset)

| Agency agent | RepoAtlas use | Tie-in |
|--------------|---------------|--------|
| [Minimal Change Engineer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-minimal-change-engineer.md) | Feature 002/004/005 implementation under STOP gates | Matches small-diff discipline during T007 and waiver-driven work; reduces scope creep in Claude sessions. |
| [Codebase Onboarding Engineer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-codebase-onboarding-engineer.md) | New contributors, handoffs | Complements `docs/session_handoffs/`, `AGENTS.md`, GitNexus/graphify for structure questions. |
| [WebAssembly Engineer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-webassembly-engineer.md) | `grammar-provider.ts`, WASM grammars, Workers embedder rules | Feature 002 remediation (T066–T068 class of issues); cold/warm query and parser caches. |
| [Knowledge Graph Engineer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-knowledge-graph-engineer.md) | Feature 004 relationship graph | Entity/edge modeling, provenance, extraction pipelines—**after** Feature 005 decision clears boundaries. |
| [Database Optimizer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-database-optimizer.md) | D1 schema, symbol/relationship persistence | Indexed lookups, batch writes, idempotent queue units (Features 001–002 patterns). |
| [Prompt Engineer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-prompt-engineer.md) | ChatGPT → Claude executor prompts | Standardizes STOP/scope/REPORT blocks you already use in `prompt-log.md`. |
| [Multi-Agent Systems Architect](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-multi-agent-systems-architect.md) | ChatGPT + Claude + Cursor workflow | Governance for delegation without bypassing SpecKit or Cloudflare safety rules. |
| [Software Architect](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-software-architect.md) | 002/004 single-pass vs two-pass, processing-unit design | Feature 005 `decision-record.md` and amendment policy for Feature 004. |
| [FinOps Engineer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-finops-engineer.md) | Cloudflare Free quotas | **Adapt:** stress cost *avoidance* and quota headroom, not paid upsell; must defer to project Free-plan rule. |
| [Code Reviewer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-code-reviewer.md) | Pre-commit / PR review | Pair with contract tests (`bun test`) and verifier-style passes. |
| [Technical Writer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-technical-writer.md) | `docs/investigations/`, evidence packs, Feature 005 artifacts | Keeps investigation reports aligned with SpecKit evidence tables. |
| [Testing — Evidence Collector](https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-evidence-collector.md) | CPU spikes, cold-isolate scripts, baseline hashes | Feature 005 `evidence/baseline/`, `combined-single-pass-decomposition-results.md`. |
| [Testing — Performance Benchmarker](https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-performance-benchmarker.md) | Local measurement scripts under `scripts/relationship-*.ts` | Methodology: warm vs cold, median/p95, explicit “not Workers CPU-ms”. |
| [Testing — Reality Checker](https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-reality-checker.md) | Gate reviews before declaring GO | Challenges “local wall-clock ⇒ production safe” (E7/E8 in Feature 005 spec). |

### Moderate fit (use ad hoc)

| Agent | When |
|-------|------|
| [Frontend Developer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-frontend-developer.md) | Atlas UI (`AtlasScene`, sources chrome, Feature 003)—not code-intel Workers path. |
| [RAG Pipeline Engineer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-rag-pipeline-engineer.md) | Future retrieval over symbols/relationships—not in current Feature 004 core. |
| [Data Engineer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-data-engineer.md) | Snapshot → queue → D1 pipelines (Feature 001 orchestration). |
| [DevOps Automator](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-devops-automator.md) | Wrangler/build pipelines—only with explicit user auth and Free-plan pre-flight. |
| [SRE](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-sre.md) | After live validation exists; observability gaps documented in Feature 002/005 reports. |

### Poor fit / skip for RepoAtlas

- **Paid media, social, game, support “personality” divisions** — unrelated to code intelligence.
- **Stack-specific agents** (Drupal, WordPress, Laravel/Filament, WeChat, Solidity, etc.) — wrong stack.
- **Autonomous Optimization Architect** (LLM routing/cost) — overlaps AI provider stubs in `.env.example`; easy to conflict with “no scope creep.”
- **Installing the full roster** — hundreds of agents add noise; OpenCode and some tools cap registered agents (~119).

---

## Conflicts to override in every session

Agency personas are generic. RepoAtlas **wins** when they disagree:

1. **SpecKit tasks** — e.g. Feature 004 T007 STOP, Feature 005 decision-only until recorded; agents must not mark tasks complete or deploy without your authorization.
2. **Cloudflare Free Plan Safety** — no paid features, no remote quota burn, no “upgrade for CPU.”
3. **Evidence labels** — local `hrtime` ≠ `CPUTimeMs`; Feature 005 E7/E8 forbid treating 10 ms as proven for queue consumers.
4. **Feature boundaries** — FR-017 (004 must not silently modify 002); single-pass is an architecture decision, not a persona preference.
5. **Git** — `AGENTS.md`: no rewriting published history; conventional commits.

**Practical pattern:** Prepend a **RepoAtlas constraint block** (from `specs/005-*/spec.md` Clarifications or your latest `prompt-log.md` entry) before “activate Minimal Change Engineer.”

---

## How to install (without polluting the repo)

Prefer **user-level** install so `agency-agents` is not vendored into `repo-atlas/`:

```bash
# Clone once (outside repo-atlas)
git clone https://github.com/msitarzewski/agency-agents.git
cd agency-agents

# Cursor — small engineering + testing subset
./scripts/install.sh --tool cursor \
  --agent engineering-minimal-change-engineer,engineering-codebase-onboarding-engineer,engineering-webassembly-engineer,engineering-knowledge-graph-engineer,engineering-prompt-engineer,testing-evidence-collector,testing-performance-benchmarker,testing-reality-checker

# Claude Code (terminal executor)
./scripts/install.sh --tool claude-code --division engineering,testing
# Or copy individuals:
# cp engineering/engineering-minimal-change-engineer.md ~/.claude/agents/
```

Desktop app (optional): [Agency Agents app](https://github.com/msitarzewski/agency-agents-app/releases/latest) — same agents, managed updates.

**Do not** commit upstream agent markdown into `repo-atlas/` unless you fork and **strip/adapt** personas for RepoAtlas (maintenance cost).

---

## Suggested RepoAtlas-native integration (lightweight)

Instead of importing the whole agency:

| Approach | Effort | Benefit |
|----------|--------|---------|
| **A. Reference only** | None | Link this doc; paste agent *workflows* into one-off Claude prompts. |
| **B. User-level install** | Low | Activate agents in Claude/Cursor by name; keep SpecKit in repo. |
| **C. Thin repo wrappers** | Medium | Add `repo-atlas/.cursor/agents/repo-atlas-executor.md` that *imports* Agency tone but **embeds** SpecKit + Cloudflare rules (single source of truth). |
| **D. Speckit skills only** | Already partial | `.cursor/skills/speckit-*` — keep as authoritative for plan/implement; Agency fills gaps (benchmarking, reality check). |

**Recommendation:** **B + A** for now. Move to **C** only if you find yourself re-pasting the same constraint block daily.

---

## Mapping Agency roles to current workstreams

| Workstream | Primary docs/specs | Useful Agency role |
|------------|-------------------|-------------------|
| Symbol extraction (002) | `specs/002-*`, query cache, cold-start results | WebAssembly Engineer, Minimal Change Engineer |
| Relationship graph (004) | `specs/004-*`, investigations in `docs/investigations/` | Knowledge Graph Engineer, Software Architect |
| CPU / queue decision (005) | `specs/005-*`, `evidence/` | Performance Benchmarker, Evidence Collector, Reality Checker |
| UI / sources (003) | `specs/003-*` | Frontend Developer, Technical Writer |
| Prompt factory | `docs/prompts/claude-prompts/prompt-log.md` | Prompt Engineer |
| Live Cloudflare (later) | T068-style gates, waiver in 005 | FinOps (adapted), SRE — **only after explicit authorization** |

---

## Example activation line (Claude terminal)

```text
Activate Minimal Change Engineer. RepoAtlas constraints: Feature 004 T007 STOP;
Feature 005 decision phase only; local-first; no wrangler deploy or remote D1;
only touch files listed in specs/002 tasks for this run. Task: [paste SpecKit task ID + acceptance criteria].
Report: files changed, test counts, evidence paths. STOP after report.
```

---

## Summary

- **Useful:** Specialist **prompt libraries** for benchmarking, architecture, WASM, D1, knowledge graphs, and disciplined execution—aligned with how you already run Claude + SpecKit.
- **Not useful:** Treating Agency as product architecture, installing the full roster, or letting personas override Free-plan safety or T007/T005 gates.
- **Best next step:** Install a **8–10 agent subset** at user level; keep RepoAtlas truth in `specs/` and `docs/`; prepend your existing STOP/scope blocks from `prompt-log.md`.

---

## References

- Upstream: https://github.com/msitarzewski/agency-agents  
- RepoAtlas agent entrypoint: `AGENTS.md`  
- Executor prompt log: `docs/prompts/claude-prompts/prompt-log.md`  
- CPU decision spec: `specs/005-queue-cpu-feasibility-architecture/spec.md`  
- Audit trail: `docs/audit_reports/audit-log.md`, `docs/progress/PROGRESS.md`
