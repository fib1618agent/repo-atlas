# Architecture Revision 2026-09-25 — Validation Checklist

Cross-artifact consistency check for the local-first revision (ADR-001). Every item verified against the written documents in this pass. Legend: PASS = verified in this pass.

| # | Check | Result |
|---|---|---|
| 1 | ADR-001 records all six user decisions D-ARCH-1…6 verbatim in effect | PASS (§2) |
| 2 | Discovery ≠ graphification ≠ visualization separation stated once (ADR-001 §3) and referenced, not restated divergently, in F003 A1 / F009 A1 | PASS |
| 3 | Capacity: `ATLAS_MAX_DEEP_ANALYSIS_REPOS` (5, configurable) appears in ADR-001 §5.3 and F003 FR-A1-05 with identical semantics (no silent eviction, no silent first-N, visibility independent) and explicit disambiguation from `ATLAS_MAX_SOURCES` | PASS |
| 4 | Lifecycle: same nine states in ADR-001 §5.2, F003 FR-A1-03, F009 FR-A1-01; QUEUED/ANALYZING/GRAPHIFIED/FAILED defined as projections of F004 job state exactly once (job-engine contract guarantee 7, referenced by F003) | PASS |
| 5 | Job engine: seven job states identical in ADR-001 §9 and `specs/004-…/contracts/local-job-engine.md`; engine owned by F004 (D-ARCH-1); F003 A1 references, does not redefine | PASS |
| 6 | T007: redefinition text consistent across research.md A6, tasks.md T007 note, plan.md header note, AGENT-GOVERNANCE §12–13, ROADMAP Current Stage + row 005 — all say NOT STARTED / NOT AUTHORIZED, T008+ NOT AUTHORIZED, Cloudflare gate SUPERSEDED not satisfied | PASS |
| 7 | F005: supersession note is append-only in §1; record body, evidence, LX-1, T007-CAL-1 untouched; COMPLETE status unchanged; "not wasted" evidence chain stated (ADR-001 §7) | PASS |
| 8 | Evidence model preserved: five evidence states and eight relationship types unweakened in every touched document (F004 spec FRs untouched except FR-012/assumptions; F009 FR-A1-05 re-affirms) | PASS |
| 9 | No graph DB / no vector DB / no remote LLM in core; semantic index optional local-only (ADR-001 §1/§10; F004 assumptions amendment keeps "no graph database") | PASS |
| 10 | F001/F002/F006 specs untouched; F002 symbol contracts declared preserved (ADR-001 §6); F006 read-only classification extended only by naming new keys category B (no F006 file edited) | PASS |
| 11 | Amendment markers: every new requirement block is dated, marked SPECIFIED NOT IMPLEMENTED (F003 A1, F009 A1) or explicitly documentation-only (job-engine contract); nothing retro-claimed as delivered | PASS |
| 12 | Identity/dedup: provider repo ID canonical, `(provider, owner, name)` kept as lookup — stated identically in ADR-001 §5.4, F003 FR-A1-06, catalogue contract | PASS |
| 13 | Remove ≠ purge with purge manifest; `Clear Sources` never permanent deletion (F003 FR-A1-07 + catalogue contract; ADR-001 §5.2) | PASS |
| 14 | Universe/Repository scopes, zoom transition, state restore, breadcrumb, perspectives: specified once in F009 A1, summarized (not diverging) in ADR-001 §5.1 | PASS |
| 15 | Reference implementations: adopt/change/avoid recorded per reference (ADR-001 §11); nothing in `../repotlas-references/` modified, copied, or depended on | PASS |
| 16 | Neutral-example rule recorded (ADR-001 §12); no booking-domain example introduced anywhere in this revision | PASS |
| 17 | No production implementation: no `src/`, `scripts/`, `data/`, `wrangler.toml`, `package.json`, test or schema change in this pass | PASS (git diff scope) |
| 18 | Numbering: no feature renumbered, no Feature 010 created; Seq/Feature distinction untouched | PASS |
| 19 | Cloudflare kept as optional deployment adapter (D-ARCH-4) wherever the queue design is superseded (plan note, contracts note, ADR-001) | PASS |
| 20 | Config naming: all new keys use `ATLAS_` prefix (D-ARCH-5); 512 KiB recorded as proposed pending T007 (D-ARCH-6), `CODE_INTEL_MAX_FILE_SIZE_BYTES` unchanged | PASS |

**Known follow-ups (not defects):** (a) F003/F009 Amendment A1 scopes need their own `/speckit-plan` + `/speckit-tasks` passes before implementation; (b) the redefined T007 needs a definition/measurement plan (Feature 005's protocol reused); (c) F004 plan/tasks phases referencing the Cloudflare queue are annotated, not replanned — replanning happens with T007 evidence, per plan.md header note.
