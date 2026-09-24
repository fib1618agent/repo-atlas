# Generic Prompt: /speckit-analyze — Scoped Remediation Report

Reusable template for auditing a specific remediation phase (not the whole
feature) inside an existing `specs/<feature>/` tree. Fill in the bracketed
placeholders and run as a `/speckit-analyze` invocation.

## Prompt Template

```text
Analyze the [FEATURE NAME] [remediation/phase name] only.

Target:
specs/[NNN-feature-slug]/

Verify the [phase/task-range identifier, e.g. "Phase N remediation: T0XX → T0YY → T0ZZ"]:

[Task chain, e.g. T066 → T067 → T068]

Specifically verify:

1. The [task implementing the redesign] is consistent with:
   - plan.md
   - research.md
   - existing [contract/interface name] contract
   - [prior historical task IDs, e.g. T012/T022] decisions

2. [Task] does not accidentally reintroduce [the invalidated mechanism/pattern
   being replaced].

3. [Validation task N] is a genuine [local/staging] validation gate and must
   precede [validation task N+1].

4. [Validation task N+1] is explicitly a [live/production] validation gate.

5. No task incorrectly claims [feature/phase] is complete before
   [final gate task] passes.

6. Existing [historical task IDs] records can remain checked without
   creating contradictory task state.

7. No [out-of-scope feature/area 1] or [out-of-scope feature/area 2] scope is
   introduced.

8. Verify task dependencies, requirement coverage, and absence of
   orphaned/duplicate remediation tasks.

Do not modify files.

Report:
- Critical
- High
- Medium
- Low
- Coverage
- dependency issues
- final PASS/FAIL
```

## Notes on filling placeholders

- **Target directory**: always the feature's `specs/<NNN-slug>/` folder, not
  the repo root — keeps the analysis read-only and scoped.
- **Task chain**: list the exact new/remediation task IDs in dependency
  order. The analyzer checks this chain is strictly sequential unless stated
  otherwise.
- **Historical task IDs**: the tasks the remediation supersedes. State
  explicitly that they may stay checked (`[X]`) — the analyzer's job is to
  confirm superseding a *mechanism* doesn't require reopening or unchecking
  the *task* that recorded what was originally built and later invalidated.
- **Out-of-scope areas**: name every adjacent feature/capability the
  remediation must not touch (other numbered features, deferred capabilities
  like MCP/Settings/UI, etc.) so scope creep is a checkable item, not an
  assumption.
- **Completion-claim check** (item 5) is the one that catches a premature
  "done" status appearing anywhere in tasks.md (a stale summary count, a
  checkpoint note, a coverage table) ahead of the final live/production gate.

## Report shape this prompt produces

- A findings table: `ID | Category | Severity | Location(s) | Summary | Recommendation`
- A pass/fail answer for each of the numbered verification items above
- A coverage table scoped to just the remediation's own concerns (not the
  whole feature's FR/SC inventory)
- Metrics: finding counts by severity, task coverage ratio, dependency-chain
  validity
- A single **Final: PASS/FAIL** line, gated on Critical/High counts only
