# RepoAtlas Context Budget and Session Continuity Protocol

Reference protocol. It **describes** how repository files carry project state across Claude Code sessions. It does not override `CLAUDE.md`, `AGENTS.md`, the constitution or any feature spec, and it cannot change how Claude Code manages its own context window.

Runtime statements in §1 come from the Claude Code documentation (`code.claude.com/docs/en/{memory,context-window,costs,sub-agents}`), read 2026-09-24 through an extraction-based fetch, Claude Code 2.1.281. Labels: **DOCUMENTED** (stated by those pages), **OBSERVED** (seen in this repository's sessions), **UNKNOWN** (not established). Re-check the docs when Claude Code is upgraded.

---

## 1. What is actually known about Claude Code context

| Layer | What is established | Label | Who controls it |
|---|---|---|---|
| **A. Runtime / startup context** | Every session starts with a fresh context window. Loaded before the first prompt: hidden system prompt, environment info, git status snapshot, MCP tool names, one-line skill descriptions, project and user `CLAUDE.md`, auto memory (`MEMORY.md`, first 200 lines or 25 KB). | DOCUMENTED | Automatic. Repo controls only file contents. |
| A. `AGENTS.md` | With a `CLAUDE.md` present, the default loads `CLAUDE.md` files only. `AGENTS.md` is **not** auto-loaded here (it did not appear in this repo's startup context). It loads only if read on demand or imported with `@AGENTS.md`. | DOCUMENTED + OBSERVED | User (`/config` "Project instructions") and repo. |
| A. Hooks and plugins | Session-start hooks and plugins add text (mode banners, skill index, per-prompt reminders). | OBSERVED | User-level settings. |
| **B. Conversation history** | The full conversation is resent with each request (prompt-cached). Long sessions therefore cost more per message. | DOCUMENTED | User (`/clear`, `/compact`). |
| **C. Tool results** | Stay in history until compaction. Compaction drops full tool outputs; afterwards up to five most recently modified files are re-read (a file over 5,000 tokens returns as a path reference only). | DOCUMENTED | Agent (read narrowly), user. |
| **D. Compaction** | `/compact` and auto-compact replace history with a structured summary (requests, files, errors, pending tasks, current work). Project-root `CLAUDE.md` and auto memory are re-injected from disk. Invoked skill bodies are re-injected (5,000 tokens each, 25,000 total). Path-scoped rules, nested `CLAUDE.md` files and hook-added context are summarized away. A `# Compact instructions` section in `CLAUDE.md` steers the summary. | DOCUMENTED | User (`/compact <focus>`), repo (`# Compact instructions`). |
| **`/clear`** | Starts a new session with an empty history. Startup content (`CLAUDE.md`, memory) reloads. Session cost totals reset. | DOCUMENTED | User. |
| **F. Subagents** | A non-fork subagent starts in a fresh, isolated window with its own system prompt, the task message, the `CLAUDE.md` hierarchy (Explore and Plan skip it), and a git status snapshot. It does not receive the parent conversation, invoked skills or files already read. Its result returns to the parent. A **fork** inherits the parent conversation. | DOCUMENTED | Agent (what it writes in the prompt). |
| **E. Repository memory** | Reaches context only when read, or when imported into `CLAUDE.md` with `@path` (imports load at launch, four hops maximum). | DOCUMENTED | Repo. |
| **G. Git state** | The startup git snapshot is refreshed after compaction. Files and history on disk are unaffected by any context command. | DOCUMENTED | Repo, user. |

**Not established (UNKNOWN):**

- **How much conversation history the current session holds.** The agent has no reliable introspection. The `<total_tokens>` counter shown to the agent is a session budget; how it relates to window occupancy is undocumented in the pages read.
- **The window size actually configured.** The docs say some models, including Sonnet 5, run a 1M-token window, and give auto-compact thresholds per model on a page not read here. The effective value depends on model and `/autocompact`.
- **What a specific summary kept.** Compaction is lossy and its output is not visible in advance.

**Reliable inspection is user-side:** `/context` (live breakdown by category, including which `CLAUDE.md` and memory files loaded), `/usage`, the status line's context field, `/memory`. The agent cannot run slash commands. It must not state a token figure it has not been shown.

**Rule that follows:** anything that must survive a reset lives in a repository file. Instructions given only in conversation are lost on `/clear` and may be lost on compaction.

---

## 2. Context hierarchy

| Level | Content | Loaded | Read rule |
|---|---|---|---|
| **L0 Permanent** | `CLAUDE.md` (auto), `AGENTS.md`, `docs/AGENT-GOVERNANCE.md`, `.specify/memory/constitution.md` | `CLAUDE.md` automatically; the rest on demand | Do not re-read `CLAUDE.md`. Read the others only when their subject is in play. |
| **L1 Current state** | `docs/progress/PROGRESS.md` "Current State" block; `docs/session_handoffs/CURRENT.md` | On resume | Read the block (top of file), not the body. |
| **L2 Direction** | `docs/ROADMAP.md` | On resume, then when sequencing matters | "Current Stage" first. |
| **L3 Stable knowledge** | `specs/<NNN>/`, decision records, `research/`, `docs/investigations/` (dated records; historical evidence, not state) | On demand | Targeted section reads. |
| **L4 Task context** | Files the current task edits or checks | On demand | Search, then read only the needed range. |
| **L5 Conversation** | Current reasoning | Temporary | Disposable. |
| **L6 History** | `prompt-log.md`, `audit-log.md`, `docs/claude_report/reports.md`, `docs/progress/archive/`, superseded handoffs | Never by default | Only when a specific fact cannot be recovered from L0–L4. |

**Fresh-session read order (ESSENTIAL):** `CLAUDE.md` (already loaded) → PROGRESS "Current State" → `session_handoffs/CURRENT.md` → ROADMAP "Current Stage" → verify with `git status` and `git log -1`. Then load only the spec, task or decision-record sections the next action names.

---

## 3. Information ownership

| Artifact | Owns | Must not contain |
|---|---|---|
| `CLAUDE.md` | Permanent operating rules, safety, git rules, precedence | Task state, gate status, dates |
| `AGENTS.md` | Shared commands and conventions (tool-neutral) | Claude-specific rules, task state |
| `PROGRESS.md` | **Current State block** (overwritten each task): feature, blocker, last completed, next action, last verification. Below it: a few recent dated entries. Older history: `docs/progress/archive/`. | Transcripts, copied reports |
| `ROADMAP.md` | Sequence, dependencies, status table, open findings | Session memory, evidence |
| `docs/session_handoffs/CURRENT.md` | Delta needed to resume: in-flight work, unpersisted findings, pending decisions, pointers | Restated specs or reports |
| `specs/<NNN>/` | Feature requirements, plans, tasks | Session notes |
| Decision records | Why a significant decision was made, with evidence ids | Task chatter |
| `docs/investigations/`, research | Detailed investigation evidence | Current state |
| `docs/claude_report/reports.md` | Latest self-contained task report (overwritten) | Anything a later session must rely on for state |
| `prompt-log.md`, `audit-log.md` | Write-only archives | Nothing relied on for state |
| Conversation | Temporary reasoning | Anything not also persisted |

**Authority for a gate:** the decision record or spec that defines it (for Feature 004 T007: `specs/005-…/decision-record.md` §14.3). PROGRESS, ROADMAP and the handoff point to it and never redefine it.

---

## 4. Reset policy

The agent cannot run `/compact` or `/clear`. At a boundary it persists state, then **tells the user which fits and why**. Choose by what is still needed, not by transcript length.

| Situation | Action |
|---|---|
| Same task continues; recent exchanges still matter; durable state already written | Stay, or `/compact <focus>` with the focus named (task, open decision, files touched) |
| Compaction imminent and there are decisions or findings not yet in a file | Persist first (PROGRESS, `CURRENT.md`, report), then compact |
| A meaningful task is complete and persisted | `/clear` |
| Next task is substantially different, or a feature boundary is crossed | `/clear` |
| Investigation finished and persisted, moving to implementation | Fresh session started from the read order in §2 |
| Architecture research moving to unrelated work | `/clear` |
| The agent finds itself re-deriving facts a file already records, or a reset would lose nothing that is not written down | Recommend `/clear` |
| A gated, safety-critical task is in flight and the gate lives only in conversation | Do not reset until the gate is written to a file |

**Limits of these rules:** `/compact` keeps what the summarizer judges important, so it is never the place where a gate, decision or authorization is recorded. `/clear` removes all history, so anything not on disk is gone. Neither command's internal implementation is assumed beyond §1.

---

## 5. Session handoff contract

`docs/session_handoffs/CURRENT.md` is **overwritten** at each phase boundary. Target: under ~60 lines. It references reports; it never copies them. It records date, branch and HEAD so a later session can detect drift.

```markdown
# Session Handoff (CURRENT)
Written: <date> · Branch: <branch> · HEAD: <sha> · Tree: <clean|dirty>
Trust order: git state > this file > conversation. Verify before acting.

## Current Objective
## Current State        (pointer to PROGRESS "Current State"; one line of delta only)
## Completed            (this session, one line each, with path)
## In Progress
## Decisions            (made this session, with source path; or "none")
## Blockers             (gate, authority path)
## Verification         (what was run, result, date; what was NOT run)
## Next Action          (one action, or the decision the user owes)
## Relevant Files       (paths only)
## Not Yet Persisted    (findings that exist only in conversation; empty is the goal)
```

Older handoffs are marked SUPERSEDED and never used for state.

---

## 6. Context budget policy

No token number is defined. Tiers are qualitative.

- **ESSENTIAL** (load first): `CLAUDE.md`, PROGRESS "Current State", `CURRENT.md`, ROADMAP "Current Stage", the one spec/task/decision-record section the next action names.
- **USEFUL** (load when justified): `AGENT-GOVERNANCE.md`, constitution, `plan.md`/`data-model.md` for the feature in play, code files to be edited, targeted search output.
- **HISTORICAL** (load only if a specific fact is unrecoverable): `docs/progress/archive/`, `prompt-log.md`, `audit-log.md`, `reports.md`, superseded handoffs, earlier features' task lists.

Rules:

1. Load ESSENTIAL first, USEFUL only with a stated reason, HISTORICAL almost never.
2. Never re-read completed work for continuity.
3. Never read the whole repository. Search, then read the matching range (`offset`/`limit`).
4. Do not paste large reports into PROGRESS; link them.
5. Do not copy conversation into repository files. The prompt log is the one standing exception (user rule) and is write-only.
6. Read a large file once and record what mattered in a durable file rather than re-reading it.
7. Do not send unrelated context to subagents.

---

## 7. Subagent policy

A subagent prompt contains only: **objective · relevant files · constraints (including every safety gate that applies) · expected output shape · verification criteria.** Nothing from the parent conversation is forwarded.

Delegate when it lowers total context: verbose read-only work (broad search, log or output triage, large-file surveys) where only a summary must return. Do not delegate small tasks, work that needs the parent's decisions, or work another subagent is already doing. A fork inherits the whole parent conversation, so it does not save context. Every non-fork subagent except Explore and Plan also loads the `CLAUDE.md` hierarchy, so several spawns repeat that cost. Never ask two subagents to rediscover the same repository context; pass the paths instead. Subagents inherit every rule in `CLAUDE.md` (safety and git rules included).

---

## 8. Transition lifecycle

```text
DISCOVER → PLAN → IMPLEMENT → VERIFY → PERSIST DURABLE STATE → STOP
                                                  │
                          (major phase boundary)  ▼
                         PERSIST → /compact or /clear → FRESH TASK CONTEXT
```

Persist means: PROGRESS Current State updated, ROADMAP updated, `CURRENT.md` overwritten, any detailed finding written to a report or decision record, `reports.md` overwritten per convention. Then report which reset fits. The repository is the continuity mechanism; the conversation is disposable.

---

## 9. Duplication analysis (as of 2026-09-24)

Actions: **KEEP** (intentional), **MOVE**, **REFERENCE** (point to the owner), **REMOVE**. Nothing was changed merely to shorten a file.

| Information | Where it repeats | Action |
|---|---|---|
| GitNexus block (~2.5 KB) | `CLAUDE.md` and `AGENTS.md`, identical, tool-generated. Only `CLAUDE.md` auto-loads, so it is not loaded twice. | KEEP both (`gitnexus analyze` regenerates them). Do not add `@AGENTS.md` to `CLAUDE.md`, which would load the block twice. |
| Instruction precedence | `CLAUDE.md` "Instruction Hierarchy"; `AGENT-GOVERNANCE.md` §3 | REFERENCE (governance already points to `CLAUDE.md`) |
| Reporting file list | `CLAUDE.md`; `AGENT-GOVERNANCE.md` §15; user memory | KEEP in `CLAUDE.md`; others REFERENCE |
| Current state, blocker, next action | PROGRESS tail, ROADMAP "Current Stage", `reports.md`, decision record §14, earlier handoffs | Single owner: PROGRESS "Current State". ROADMAP "Current Stage" mirrors it (REFERENCE). `reports.md` and old handoffs are HISTORICAL. |
| T007 status | 004 `tasks.md` `[X]`; decision record §14.3; ROADMAP; governance; PROGRESS | Authority is decision record §14.3. Others REFERENCE. The `[X]` versus STOPPED conflict stays recorded, not reconciled. |
| Superseded handoffs (2026-09-21, Feature 003) | `docs/session_handoffs/SESSION_HANDOFF*.md` | Banner added marking them SUPERSEDED (kept as history). |
| PROGRESS body (was 137 KB; old Phase 0–7 checklists show 2026-09 UI-era status) | itself | MOVED unedited on 2026-09-24 to `docs/progress/archive/PROGRESS-2026-09-19_to_2026-09-24.md`. `PROGRESS.md` keeps the Current State block and three recent entries. |
| `reports.md` | Latest full report, overwritten per task | KEEP (output artifact, not state) |
| `prompt-log.md`, `audit-log.md` | Archives, 82 KB and 18 KB | KEEP write-only; never read by default |
| User global `~/.claude/CLAUDE.md` | `@include …yml#Section` lines (~4.8 KB). Not the `@path` import syntax, and no expanded content appeared in the session context. | OBSERVED inert. User-level: reported, not edited. |

---

## 10. Recommendations (status as of 2026-09-24)

1. **Split PROGRESS.md history:** DONE. Historical body archived unedited in `docs/progress/archive/`.
2. **Persist the two 2026-09-24 analyses:** DONE. `docs/investigations/2026-09-24-f002-f004-parse-boundary-investigation.md` and `docs/investigations/2026-09-24-f004-t007-evidence-reconciliation.md`.
3. **Optional `SessionStart` hook** matching the `compact` source that re-injects `CURRENT.md` after compaction (documented mechanism; a user-level settings change). Not done; needs a user decision.
4. **Tidy user-level context**: the inert `@include` lines in `~/.claude/CLAUDE.md`, and unused skills (`skillOverrides`), if `/context` shows them costly. Not done; user level.
