# RepoAtlas — Claude Project Instructions

Permanent operating contract for Claude Code in this repository. Keep it short: it points to sources of truth, it does not replace them. Feature-specific rules live in `specs/`, not here.

## Project Identity

RepoAtlas is a standalone TanStack Start app (Bun, React, Three.js/R3F, Cloudflare Workers via Nitro). It shows public GitHub repositories as an interactive 3D atlas and is growing a code-intelligence layer (symbol extraction, then an engineering relationship graph). Trust in displayed data is the product.

## Repository Root

The repo root is `repo-atlas/` (the git root). Claude runs from here. The parent `fib1618agent/` is only a Cursor workspace folder and is not a git repo; nothing there is loaded by Claude Code.

## Instruction Hierarchy

Highest wins:

1. The user's explicit instruction in the current session.
2. Safety and Git rules in this file, plus feature-specific safety rules in `specs/<feature>/` (these win for that feature).
3. `.specify/memory/constitution.md` non-negotiables (data fidelity, secrets, default owner, performance caps).
4. `AGENTS.md` (shared, tool-neutral guidance: commands, conventions) and this file.
5. SpecKit artifacts for the active feature: `spec.md` > `plan.md` > `tasks.md` > contracts/decision records.
6. Agency Agent personas (advisory only).

`AGENTS.md` is the shared base. Do not duplicate it here; if the two disagree, flag it to the user instead of choosing silently.

## SpecKit

- SpecKit governs the feature lifecycle: specify → plan → tasks → analyze → implement, with review gates (`.specify/workflows/speckit/workflow.yml`).
- A feature's `spec.md` is authoritative for that feature's requirements. `tasks.md` governs task order and dependencies.
- Never edit a spec, plan or task list to make execution easier. If one is wrong, stop and report; change it only when the user asks.
- Honor STOP gates and validation gates written in specs, tasks and reports. A checkbox alone does not clear a gate; read the gate's own condition.
- Execute only the task(s) the user authorized. Do not roll on to the next task or feature.

## Agency Agents

- Agency Agents are specialist reasoning/persona overlays, not project authority. Mapping: `docs/agency-agents-for-repo-atlas.md`.
- For non-trivial work, pick the smallest useful set: normally one primary role plus supporting roles only where the task crosses disciplines. Name them in one line (primary, supporting, purpose), then proceed.
- They are in-session lenses unless separate agent processes actually ran. Never claim otherwise.
- They never override the user, this file, SpecKit or a feature spec.

## Multi-Agent Execution

- Read `tasks.md` dependencies first and plan in dependency-aware waves.
- Parallelize only genuinely independent tasks (no shared files, no ordering dependency). Serialize anything that mutates the same files, schema, lockfile or git state.
- Do not narrow to one task when the graph safely allows parallel work; do not parallelize where SpecKit requires serialization.
- Validate after each wave (typecheck, relevant tests, diff review) before starting the next.
- Subagents inherit every rule in this file.

## Evidence Discipline

Label claims with one of: `FACT`, `INCOMPLETE`, `UNVERIFIED`, `CONTRADICTION`, `UNKNOWN`. Never upgrade a label without new supporting evidence. Do not turn `UNKNOWN` into a negative claim, do not infer absence from partial extraction, and do not silently reconcile conflicting sources. Local measurements are not proof of production (Workers) behavior.

## Engineering Principles

- Deterministic, source-derived engineering intelligence (parsing, symbols, relationships with provenance) is the foundation.
- AI/LLM reasoning operates over that foundation. It must not invent core source relationships without evidence, and AI text always keeps a metadata-only fallback.
- Secrets stay server-side; never commit `.env`.

## Safety and Git Rules

- Cloudflare: Free plan only, no unexpected billing. No live Cloudflare operation (Wrangler deploy or remote commands, remote D1/Queues/R2, dashboard or API) without explicit user authorization for that operation. Prefer local validation. No production resource mutation without explicit authorization. Full policy: `../.cursor/rules/cloudflare-free-plan-safety.mdc` (workspace root, outside this repo).
- Git: no push unless explicitly authorized. No commit unless asked. No destructive operations (force-push, reset --hard, rebase/amend/squash of pushed commits, discarding uncommitted work). Conventional commits.
- Do not stage or commit `.env`, secrets or unrelated files.

## Feature Boundaries and Cross-Feature Progression

- Do not execute or modify another feature merely because it is related. A feature's spec defines what it may touch (for example, one feature must not silently change another's code).
- A dependent feature does not need its predecessor to be 100% complete. Decide readiness from the actual task and artifact dependencies (and any recorded gate), not from roadmap or numbering order.
- If readiness is unclear, state the dependency you could not verify and ask.

## Reporting and Auditability

Follow the existing conventions; do not invent new ones:

- `docs/claude_report/reports.md`: overwrite each time; self-contained.
- `docs/progress/PROGRESS.md`: update after every task.
- `docs/prompts/claude-prompts/prompt-log.md`: append prompts verbatim.
- `docs/audit_reports/audit-log.md`: append audit reports.

If the user says not to modify files for a task, that instruction wins and no logging is written.

## Minimal-Change Rule

Change only what the task requires. No opportunistic cleanup, renames, formatting sweeps or unrelated refactors. Preserve existing behavior and baselines. Note unrelated problems in the report instead of fixing them.

## Session Continuity

Repository files are the continuity mechanism; the conversation is disposable. Full protocol: `docs/CONTEXT-PROTOCOL.md`.

- **Resuming:** read, in order, this file (auto-loaded), the "Current State" block at the top of `docs/progress/PROGRESS.md`, `docs/session_handoffs/CURRENT.md`, and "Current Stage" in `docs/ROADMAP.md`. Verify with `git status` and `git log -1` before trusting them.
- **Do not read by default:** `docs/prompts/`, `docs/audit_reports/`, `docs/claude_report/reports.md`, superseded handoffs, or `docs/progress/archive/`. Open one only for a specific fact the task needs.
- **Phase boundary** (task complete, investigation finished, feature boundary): persist state first (PROGRESS Current State, ROADMAP, `CURRENT.md`, a report for detailed findings), then tell the user whether `/compact`, `/clear` or a fresh session fits. You cannot run those commands and cannot see current context usage; never state a token figure you were not shown.
- **Gates and authorizations live in files**, never only in conversation.
- Do not copy conversation into repository files (the prompt log is the one standing exception). Subagents get objective, files, constraints, expected output and verification criteria only.

## Compact instructions

When compacting, keep: the current task and its stop conditions, every safety gate or authorization boundary in force, files modified this session and why, decisions with their source paths, and the next action. Drop tool output and exploration detail.

## Source of Truth References

| Topic | Location |
|---|---|
| Shared agent guidance, commands | `AGENTS.md` |
| Constitution (non-negotiables) | `.specify/memory/constitution.md` |
| SpecKit workflow and templates | `.specify/workflows/`, `.specify/templates/` |
| Active feature pointer | `.specify/feature.json` |
| Feature specs, plans, tasks | `specs/<NNN-name>/` |
| Agency Agent mapping | `docs/agency-agents-for-repo-atlas.md` |
| Cloudflare Free plan safety | `../.cursor/rules/cloudflare-free-plan-safety.mdc` |
| Roadmap, plan | `roadmap.md`, `docs/plan.md` |
| Progress, reports, audits, prompts | `docs/progress/`, `docs/claude_report/`, `docs/audit_reports/`, `docs/prompts/` |
| Context protocol, session handoff | `docs/CONTEXT-PROTOCOL.md`, `docs/session_handoffs/CURRENT.md` |

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **repo-atlas** (4706 symbols, 7289 relationships, 217 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/repo-atlas/context` | Codebase overview, check index freshness |
| `gitnexus://repo/repo-atlas/clusters` | All functional areas |
| `gitnexus://repo/repo-atlas/processes` | All execution flows |
| `gitnexus://repo/repo-atlas/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
