# Phase 0 Research: Queue CPU Feasibility and Processing-Unit Architecture

Planning-method research. It decides *how the decision record will be produced*. It does not resolve the Cloudflare unknowns; those stay UNKNOWN (FR-025). No Cloudflare access was made for this document; all facts cite existing repository artifacts.

## Technical Context unknowns → resolutions

No `NEEDS CLARIFICATION` remained in the Technical Context. The five platform unknowns are subject matter of the decision, not planning blockers, and are carried as UNKNOWN.

| ID | Unknown | Status | Where it is decided/answered |
|---|---|---|---|
| U1 | Free-plan Queue Consumer CPU limit | UNKNOWN — three official pages disagree or are silent (Workers Limits: no queue row; Workers Pricing: "15 minutes" Paid only; Queues Limits: "Configurable to 5 minutes" both plans). Source: `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-research-report.md` F1, F10, F11. | Phase B; resolvable only by doc update or observed measurement |
| U2 | CPU accounting unit for queue consumers | UNKNOWN — docs say "per invocation"; one invocation receives a batch (F12/F18); per-message not stated (report §5 Q2). | Phase B |
| U3 | CPU telemetry for queue invocations on Free | UNKNOWN — Workers Logs/Query Builder documented for Free with `$workers.cpuTimeMs` as example field; queue availability not established; Trace Events/Logpush/Tail Workers documented Paid (observability report D1–D4, D10, §16). | Phase C/E |
| U4 | Does reported CPU include startup/global/WASM init | UNKNOWN (observability report Q3; research report Q4). | Phase C/D2 |
| U5 | Isolate reuse guarantees | UNKNOWN — not guaranteed (F16, F18, F19). | Phase D2 |

## Decisions

### R1 — Deliverable shape: one decision record with fixed sections
- **Decision**: Produce a single `decision-record.md` whose sections map 1:1 to Phases A–F and to spec SCs; supporting proposal/waiver files only when needed.
- **Rationale**: SCs are each verifiable by inspecting one section; one document keeps FR→section traceability and simplifies review.
- **Alternatives**: Multiple documents per user story (harder to check completeness); extending Feature 004 `research.md` (rejected: FR-035 forbids modifying Feature 004 now).

### R2 — Evidence provenance classes
- **Decision**: Four classes: OFFICIAL-DOC, PLATFORM-TELEMETRY, LOCAL-WALLCLOCK, REPO-BEHAVIOR. Only OFFICIAL-DOC and PLATFORM-TELEMETRY may support platform-limit or CPU-safety claims; LOCAL-WALLCLOCK supports relative comparisons only (FR-019, FR-024); in-Worker timers are excluded (observability report §6).
- **Rationale**: Prevents the recorded failure mode of clearing Feature 004 T007 on local proxies.
- **Alternatives**: A single "confidence score" (rejected: hides provenance).

### R3 — Budgets are conditional until a limit is evidenced
- **Decision** (confirmed D-A4; strengthened by remediation H2): No numeric budget is invented or assumed. A unit may be selected only when the relevant budget X is established by authoritative evidence or explicitly waived under FR-038; if X is UNKNOWN and no valid waiver exists the outcome is "no unit selectable yet". The conditional statement is analysis only and is never a selection basis. Express budgets conditionally: "if the authoritative execution model establishes budget X for unit Y, the unit must stay within X × margin". Candidate limits are listed as unverified only (HTTP/Cron 10 ms — not a queue budget without authoritative evidence; 15 min/5 min statements — unverified for Free). "No unit selectable yet" is an acceptable outcome. A selected unit requires a budget whose limit is evidenced or explicitly waived; otherwise the record states "no unit defensible yet" (FR-003, FR-007, FR-026).
- **Rationale**: FR-026 forbids encoding 10 ms as fact; FR-007 forbids selecting a unit without an evidence-backed budget.
- **Alternatives**: Assume 10 ms as conservative floor (rejected: violates FR-026, and would silently become the gate).

### R4 — Evaluation matrix under every plausible accounting boundary
- **Decision**: Evaluate each of the five unit shapes (FR-005) × accounting boundary {file, message, batch/invocation} × the eight canonical FR-006 criteria (CPU exposure, queue ops, D1 read/write volume, R2 reads, retry granularity, duplicate-delivery, determinism, implementation complexity); "budget fit" is a derived conclusion, not a ninth criterion. Unresolved boundary ⇒ report exposure under each; do not pick one.
- **Rationale**: Prior artifacts assumed "one file per invocation"; this is listed in "Assumptions Explicitly Removed". The existing consumer loops all messages of a batch in one invocation (research report §2).
- **Alternatives**: Evaluate only under the per-invocation reading (rejected: hides message-in-batch exposure).

### R5 — Cold-start decomposition uses existing local numbers as ratios only
- **Decision**: Reuse E5/E6 values (grammar/parser init ≈ 4.4–4.7 ms; first TS/TSX file ≈ 22–23 ms; warm ≈ 0.8–1.5 ms; Query compile TS ≈ 4.36 ms, TSX ≈ 4.75 ms, Java ≈ 0.79, JS ≈ 1.06 warm) as line items labeled LOCAL-WALLCLOCK, cold vs warm separate, never averaged (FR-021). Used to rank costs and find dominant terms, not to assert Cloudflare CPU.
- **Rationale**: Adequate for architecture comparison (parse dominates; Query compile large; hashing negligible); no new measurement needed to fill the table.
- **Alternatives**: New local runs (D-A2: only for a named evidence gap; none currently planned).

### R6 — Single-pass and Query cache evaluated as independent candidates
- **Decision**: Compare two-pass vs single-pass first (E2, ≈31–33% cheaper locally) and decide the cache separately (E4/E5, warm 6.70→1.79 ms etc., cold cost unchanged). Both name their Feature 002/004 boundary impact and require separate approval to change Feature 002 (FR-013(d), FR-017, G6).
- **Rationale**: They interact but have different risk (cache is a per-isolate memoization safety question; single-pass moves the Feature 002/004 boundary).
- **Alternatives**: Bundle as one "optimization" decision (rejected: hides which supplies which benefit; cache benefit is steady-state only).

### R7 — Live-measurement path documented, never executed
- **Decision**: Base the proposal on the observability report §16 "smallest safe experiment" (enable Workers Logs with no code change, trigger one tiny then one larger unit, read `$workers.cpuTimeMs`/outcome, correlate with D1 file counts, disable observability afterward). Mark NOT AUTHORIZED; note that enabling observability is a configuration change and redeploy, i.e. a deployment (G2). Include partial-revert handling (edge case: cleanup fails).
- **Rationale**: It is the only Free-plan-compatible telemetry route identified; Trace Events/Tail Workers are Paid-only.
- **Alternatives**: Paid-tier telemetry (out of constraint per FR-027); reasoning from design margin alone (forbidden by FR-029).

### R8 — Disposition rule is mechanical
- **Decision**: Feature 004 T007 disposition = CLEARED (a recommendation only; the record itself never clears the gate, FR-030) iff FR-028 (a)–(e) are all satisfied or waived per FR-038; REDEFINED iff the architecture/execution model has materially changed so that the original gate wording no longer tests the right thing (criteria in `contracts/decision-record.md`; effective only through a reviewed Feature 004 amendment, G5); otherwise STOPPED (including insufficient evidence). Later reviewed changes are recorded in the append-only revision log (Appendix C). Forecast from current evidence: STOPPED.
- **Rationale**: Avoids discretionary clearing.
- **Alternatives**: Graded risk rating (rejected: violates FR-029).

### R9 — Documentation currency handling
- **Decision** (D-A1): Phase A re-reads official public Cloudflare documentation and records date read; no API/dashboard/Wrangler access.
- **Rationale**: Honors the strict "no remote Cloudflare access" rule without silently dropping FR-025.

### R10 — Protected-path baseline uses three sets
- **Decision**: Set A enforced (Feature 001–004 spec dirs, `src/lib/code-intel/**` excluding Set B files, `plugins/`, `nitro.config.ts`, `wrangler.toml`, `data/code-intel-schema.sql`, relevant scripts and code-intel tests, `package.json`/`tsconfig.json`/`bun.lock`/`bunfig.toml`, `.specify/feature.json`) with an exact file list plus SHA-256 hashes so additions, deletions and modifications are all detected; Set B the Query-cache experiment files tracked separately (hashes + saved diff + hunk classification); Set C unrelated working-tree state (UI routes, `routeTree.gen.ts`, etc.) recorded but never enforced. Baseline includes the `bunx tsc --noEmit` result.
- **Rationale**: `specs/004*` is untracked; `src/` mixes Feature 004 scaffolding, the Query-cache experiment and unrelated UI work; `shasum -c` alone cannot detect added files; the Feature 001/002 queue consumers live in `plugins/`.
- **Alternatives**: hash all of `src/` (rejected: false positives from unrelated/generated files); rely on `git diff` (rejected: untracked/uncommitted state).

### R11 — Documentation research is documentation-only
- **Decision**: Public Cloudflare documentation may be read (WebFetch/WebSearch of public documentation pages) as documentation only. Prohibited during it: Cloudflare MCP/API execution (including the Cloudflare MCP tools), dashboard, Wrangler, remote D1/Queues/R2, deployments, production/live validation.
- **Rationale**: D-A1 permits research, not resource access; the Cloudflare MCP tools available in some sessions can execute API calls.

### R12 — Batching quantities are recorded separately, never inferred
- **Decision**: The repository consumer mapping records four distinct quantities in a four-row table (Queue configuration; consumer invocation/message batch; files-per-message configuration; files processed per invocation), each with value, source, what is established and what remains unknown. "Files per invocation" is filled only if the code establishes it. Whether the repository establishes "one file per invocation" is stated explicitly from code, not from Feature 004 planning language.

## Existing evidence relied on (no new claims)

| Source | Used for |
|---|---|
| `specs/004-engineering-relationship-graph/{feasibility-results,single-pass-spike-results,cpu-decomposition-results,combined-single-pass-decomposition-results}.md` | E1–E3 |
| `specs/002-ast-symbol-intelligence/query-cold-start-results.md` | E4–E6 |
| `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-research-report.md` | E7 (F1–F20, unresolved Q1–Q8) |
| `specs/002-ast-symbol-intelligence/cloudflare-queue-cpu-observability-report.md` | E8 (D1–D16, C1–C4, §16) |
| `specs/004-engineering-relationship-graph/tasks.md` | Feature 004 T007 wording, Feature 004 T073/T074 scale |

## Result

All Technical Context items resolved to a decision or an explicit UNKNOWN. No live operation required or performed. Proceed to Phase 1.
