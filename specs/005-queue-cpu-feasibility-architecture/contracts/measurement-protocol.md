# Contract: Evidence Standard and Measurement Protocol

Activity classes: documentation research (public Cloudflare docs read as documentation only), local-only measurement (only for a named evidence gap), and future live validation (NOT authorized; separate explicit authorization per experiment). These are never mixed. No existing evidence/measurement script may be executed (each hardcodes an output path that overwrites a protected Feature 002/004 results file); a local measurement, if ever needed, uses a new script under `evidence/local-measurements/` that writes only there, after a recorded write-side-effect check.

## Evidence acceptability

| Class | Example | May support | May NOT support |
|---|---|---|---|
| OFFICIAL-DOC | Current Cloudflare docs page (title, section, URL) | Statements the page explicitly makes | Anything the page is silent on; reconciled contradictions |
| PLATFORM-TELEMETRY | Platform-reported per-invocation CPU for a queue-consumer invocation (e.g., Workers Logs `$workers.cpuTimeMs` with outcome, if present) | Observed CPU of that invocation, if scope/inclusions recorded | General limits; other plans/invocation types; anything from a single sample |
| LOCAL-WALLCLOCK | `scripts/relationship-*.ts`, `query-cold-start-experiment.ts` numbers | Relative comparison (X is n% cheaper than Y), dominant-cost ranking | Compliance/violation of any Cloudflare limit (either direction) |
| REPO-BEHAVIOR | Reading current consumer code | Describing what the code does | Platform behavior |
| Not accepted | In-Worker `performance.now()`/`Date.now()` timing | — | Platform CPU (documented as unreliable in production) |

## Required protocol fields (every measurement)
Basis (local-wallclock | platform-cpu); warmth (cold | warm — reported separately, never averaged, FR-021); unit (file | message | batch | full queue invocation); what it includes (startup, grammar/parser/Query init, parse, extraction, D1/R2 wait excluded) or `UNKNOWN`; sample size; statistic (median AND a tail, e.g., p95/max); variability; environment (plan, runtime, commit sha); label "comparative only" for local wall-clock.

## Required measurement set (definitions only; none executed by this plan)

| ID | Basis | Warmth | Unit | Purpose |
|---|---|---|---|---|
| M1 | local-wallclock | cold | first file per language | cold-init line items (existing E6) |
| M2 | local-wallclock | warm | file | steady-state per-file (existing E2/E4) |
| M3 | local-wallclock | both, separate | file, two-pass vs single-pass | architecture comparison (existing E2/E3) |
| M4 | local-wallclock | warm vs cold | file, cache off vs on | Query-cache benefit vs cold cost (existing E4/E5) |
| M5 | platform-cpu | cold | full queue invocation, one tiny unit | telemetry availability; init inclusion (UNKNOWN U3/U4) — requires live authorization |
| M6 | platform-cpu | cold and warm if reachable | full queue invocation, one larger unit | scale of CPU with unit size; limit behavior |
| M7 | platform-cpu | repeated | full queue invocation, ≥ N samples | variability; "consistently over limit" tolerance (F3) |

M1–M4 exist as local evidence. The existing 300-file sequential run (Feature 004 single-pass spike) recorded lifecycle/memory only (rss/heap/external, tree deletes); it is NOT one of M1–M4 and provides no CPU time, CPU budget compliance, per-invocation CPU, or production worst-case CPU. The "300" column in the decomposition sweep tables is a symbol count, not a file count. M5–M7 are platform measurements: status `defined`, NOT authorized.

## Gate-conclusion rules
- A single sample never establishes a gate conclusion (FR-020).
- Platform-cpu conclusions apply only to the invocation type, plan, and unit measured.
- Absent M5–M7 (or a documented limit for the path), gate condition (e) is unsatisfied, and Feature 004 T007 stays STOPPED unless waived (FR-029, FR-038).
