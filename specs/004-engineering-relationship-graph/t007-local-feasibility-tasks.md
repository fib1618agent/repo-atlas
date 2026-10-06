# T007 — Local Relationship Engine Feasibility: Task Breakdown

**Status: DEFINED — EXECUTION NOT AUTHORIZED.** Governing plan: `t007-local-feasibility-plan.md`. Every task below is `[ ]` and stays unchecked until the user authorizes execution of `T007-LOCAL` by name (plan §14). No task modifies `src/` or `tests/` for implementation; harness code lives under `scripts/t007-local/` (throwaway-but-promotable). T008+ NOT AUTHORIZED.

## Phase A — Harness and datasets

- [ ] **T007-L01** Environment capture + smoke: record the reference environment (plan §4); run one hand-checkable fixture through parse → symbols → relationship facts → resolution → persist → query; verify the harness output against manually derived expected relationships (M-L0). *Blocks everything.*
- [ ] **T007-L02** Fixture generator: file-size bands B1–B8 × 4 languages × 2 densities, neutral domains only; records actual bytes/lines/AST nodes per fixture; plus one real minified-JS fixture. (Depends: L01.)
- [ ] **T007-L03** Real-repository snapshots: acquire the owner-approved repository list (repo-atlas confirmed; others named in the authorization) through the Feature 001 pipeline into the sqlite adapter — public GitHub read-only, no Cloudflare. Record file counts, language mix, size distribution per tier R-S/R-M/R-L. (Depends: L01.)
- [ ] **T007-L04** Scratch relationship harness: draft relationship `.scm` queries (T006 spike as starting point, EXPORTS per A2), `to-relationship-facts` prototype, resolver prototype (indexed SQLite lookups only, FR-001 boundary), persistence via the F004 schema from `contracts/d1-schema-additions.sql` applied to a scratch SQLite DB (never `data/` production schema). Every output labeled PROTOTYPE. (Depends: L01.)
- [ ] **T007-L05** Prototype durable job runner implementing `contracts/local-job-engine.md` exactly: seven states, claims with lease timeout, bounded retry/backoff, checkpointing, pause/cancel, `contains`-before-`parsed` ordering. (Depends: L01, L04.)

**STOP GATE S-L1** — harness review: owner (or an explicitly delegated review) confirms L04/L05 faithfully represent the contracts before mass measurement. Measurements taken before S-L1 clears are void for gate purposes.

## Phase B — Measurements

- [ ] **T007-L06** M-L1 file-band sweep (bands × languages × densities; ≥ 20 iterations; median/p95/max; memory). (Depends: S-L1, L02.)
- [ ] **T007-L07** M-L2 per-file pipeline with phase attribution + evidence-state distribution. (Depends: S-L1, L02, L04.)
- [ ] **T007-L08** M-L3 SQLite: batch inserts, resolution lookups, bounded traversal (FR-014 shapes), WAL vs rollback, DB size. (Depends: S-L1, L04.)
- [ ] **T007-L09** M-L4 job engine: overhead vs inline; concurrency 1/2/4/8; failure suite F-1…F-6 including the F-1 determinism cross-check. (Depends: S-L1, L05.)
- [ ] **T007-L10** M-L5 repository-scale runs R-S/R-M/R-L at concurrency 1 and 2: wall, CPU, peak/avg RSS, RSS slope, totals; ≥ 3 runs per tier. (Depends: L03, L07, L09.)
- [ ] **T007-L11** M-L6 incremental INC-0…INC-3 on R-M with graph-diff correctness. (Depends: L10.)
- [ ] **T007-L12** M-L7 cold start: fresh-process line items per language vs warm (E6 method). (Depends: S-L1, L02.)

## Phase C — Evidence and gate decision

- [ ] **T007-L13** Evidence artifact: `t007-local-feasibility-results.md` + `evidence/t007-local/*.json` with every required field (plan §10), including failures, retries, limitations, and the Rust-repeat register annotations. (Depends: L06–L12.)
- [ ] **T007-L14** Gate evaluation: score G1–G9 (PASS/CONDITIONAL/FAIL per plan §9), derive the file-size default + ceiling recommendation, and draft the reviewed amendment (research.md **A7**) recording the T007 outcome. **This task does not clear T007 and does not authorize T008+** — the owner reviews A7 and decides. (Depends: L13.)

**STOP GATE S-L2** — owner review of L14: only an explicit owner decision on the A7 amendment changes the T007 gate outcome. Any mandatory-gate FAIL (G1/G2/G3) → outcome NOT FEASIBLE AS DESIGNED → re-design decision (including Rust-preference escalation), never a silent retry.

## Dependency summary

```text
L01 → L02, L03, L04 → L05 → S-L1 → {L06, L07, L08, L09, L12} → L10 → L11 → L13 → L14 → S-L2
```

Parallelizable after S-L1: L06/L07/L08/L09/L12 (independent datasets/harness paths; serialize anything sharing a scratch DB file). L10/L11 serialize (same snapshots, load-sensitive timing).

## Owner-approval parameters (named in the execution authorization)

1. [ENG] thresholds: G4 (5 min R-M / 30 min R-L), G5 (1.5 GiB), G6 (30% / 15%), G7 (95%), G8 (10%).
2. Real-repository list beyond repo-atlas (one Java-dominant, one JS/TS R-L candidate).
3. Reference environment (machine).
4. Concurrency ladder (1/2/4/8) if different from the default.
