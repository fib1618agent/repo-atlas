# Checklist: T007 Local Relationship Engine Feasibility — Planning Pass (2026-09-25)

Validates the planning artifacts (`t007-local-feasibility-plan.md`, `t007-local-feasibility-tasks.md`) against the revision instruction and ADR-001. PASS = verified in the written documents during this pass. This checklist does not validate measurements — none exist.

| # | Check | Result |
|---|---|---|
| 1 | All 16 instruction requirements mapped to LRF-01…16 with measurement + gate traceability (plan §2) | PASS |
| 2 | Cloudflare 10 ms CPU is nowhere a pass/fail constraint; F005 methodology reused explicitly and only where applicable (plan §1, §6) | PASS |
| 3 | Rust not forced: TS/SQLite path validates; Rust-repeat register records what must be re-measured (plan §4, §11) | PASS |
| 4 | Complete path measured, not parser benchmarking alone: snapshot → classification → parse → symbols → relationships → resolution → persistence → queries (M-L2, M-L3, M-L5) | PASS |
| 5 | File-size bands B1–B8 defined; 512 KiB judged from curves, never declared; density controlled per R3/A1 lesson; minified-JS fixture included (plan §5.1, G9) | PASS |
| 6 | Repository tiers distinguish file / small / medium / large; real repositories preferred; selection owner-approved (plan §5.2) | PASS |
| 7 | Job-engine tests cover bounded concurrency, persist/recovery, retry, idempotency, partial completion, pause/cancel; "STOP/START must not destroy local intelligence" is G2 mandatory (plan §8, F-1…F-6) | PASS |
| 8 | Incremental: full / no-change / small change / larger change (INC-0…3) with graph-diff correctness (plan §5.3, M-L6, G7/G8) | PASS |
| 9 | Memory/CPU/throughput/SQLite metrics defined without invented universal thresholds; every threshold labeled [ENG] = RepoAtlas engineering decision requiring owner approval by name (plan §7, §9) | PASS |
| 10 | Explicit PASS/CONDITIONAL/FAIL per gate; mandatory gates (G1/G2/G3) have no CONDITIONAL; small-fixture success cannot clear a gate (repo-scale evidence required); clearance rule for T008+ stated (plan §9) | PASS |
| 11 | Durable evidence artifact specified with every required field; no cloud telemetry dependency; limitations section mandatory (plan §10) | PASS |
| 12 | Honest prototype boundary: unbuilt T008+ code represented by labeled scratch harness under `scripts/t007-local/`, contracts implemented exactly, S-L1 review before mass measurement (plan §3, tasks S-L1) | PASS |
| 13 | Reference ideas documented in the 4-point form (reference behavior / applicability / adaptation / avoidance); reference dirs read-only (plan §12) | PASS |
| 14 | Neutral domain examples only (car rental, payment, inventory…); no booking-domain example anywhere in the new artifacts | PASS |
| 15 | Nothing executed, no harness/fixture created, no src/tests/schema/config change, no snapshot acquisition run; T007 outcome unchanged; T008+ NOT AUTHORIZED; execution requires authorization naming plan, [ENG] numbers, repo list, environment (plan §13–14) | PASS |
| 16 | Task breakdown with dependency graph, parallelization boundaries, two stop gates (S-L1 harness review, S-L2 owner gate decision via reviewed amendment A7) | PASS |

**Follow-ups recorded (not defects):** owner must supply the four approval parameters (tasks file, final section) in the execution authorization; the A7 amendment template is drafted only by T007-L14 after measurements exist.
