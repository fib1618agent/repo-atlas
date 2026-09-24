# Quickstart: Reviewing the Feature 005 Decision Record

A review guide, not a run guide. Nothing here touches Cloudflare or modifies code. Validation is document inspection.

## Prerequisites
- Read [spec.md](./spec.md) (Clarifications Session 1), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/).
- Repo state unchanged: the protected-path baseline (three sets, task T002) shows no drift in Set A (enforced) or Set B (Query-cache experiment). Set C (unrelated working-tree state) is recorded but not enforced.

## Local-only checks (safe)

```bash
# Feature 005 writes only under its own directory (plus three append-only logs)
git status --short specs/005-queue-cpu-feasibility-architecture

# Protected-path integrity: repeat the exact commands recorded in
# specs/005-queue-cpu-feasibility-architecture/evidence/baseline/README.md (task T046):
#   Set A: regenerate the file list and diff it against the stored list (detects additions/deletions),
#          then check SHA-256 hashes (detects modifications). `shasum -c` alone is not sufficient.
#   Set B: compare experiment-file hashes and the saved diff.
#   Set C: informational only.

# No forbidden numeric-limit claims as fact in the record (manual review of hits)
grep -n "10 ms" specs/005-queue-cpu-feasibility-architecture/decision-record.md

# Typecheck: compare against the baseline recorded in task T002 (evidence/baseline/tsc-baseline.txt);
# pre-existing diagnostics are not a Feature 005 failure, new ones are reported
bunx tsc --noEmit
```

## Review checklist (decision-record.md vs spec)
- [ ] SC-001 every accounting boundary sourced or `UNKNOWN`; no unsourced numeric limit
- [ ] SC-002 five shapes × the 8 canonical FR-006 criteria (budget fit derived); ≤1 selected ONLY if budget X is established/waived and FR-031/032/033 shown, otherwise "no unit selectable yet"; oversize-file / fits-no-unit case stated
- [ ] Repository consumer table (Queue configuration / consumer invocation-message batch / files-per-message configuration / files per invocation) present with value, source, established, unknown; "one file per invocation" stated explicitly from code
- [ ] SC-003 grammar/parser/Query/first-file/warm-file separate; isolate reuse = none guaranteed
- [ ] SC-004 single-pass vs two-pass table covers every FR-016 criterion; one verdict
- [ ] SC-005 query-cache decision with 4 distinctions + working-tree status
- [ ] SC-006 resource bounds (four scale tiers; 300-file run not called a worst case and used for lifecycle/memory only; counts-only arithmetic, no CPU-ms conclusions from it) against 10k queue ops/day and D1 free tier
- [ ] SC-007 per-shape retry re-execution bounded
- [ ] SC-008 duplicate delivery → identical persisted state
- [ ] SC-009 determinism across batch composition, order, cold/warm
- [ ] SC-010 Feature 001/002 impact list; zero artifacts modified
- [ ] SC-011 exactly one Feature 004 T007 disposition; FR-028 (a)–(e) each marked; not cleared unless all satisfied/waived
- [ ] SC-012 all Cloudflare claims have title/section/URL; all measurements have basis, warmth, unit, sample size
- [ ] SC-013 amend-in-place policy stated; every live proposal marked NOT AUTHORIZED and FR-036-conformant; any waiver FR-038-conformant

## Live operations
None are part of this guide. Any live experiment follows [contracts/live-experiment-proposal.md](./contracts/live-experiment-proposal.md) and needs your explicit authorization of that specific experiment first.

## Expected outcome given current evidence
Feature 004 T007 remains STOPPED (no authoritative queue-consumer CPU telemetry; no waiver; no live authorization). The record's value is the defined path to change that.
