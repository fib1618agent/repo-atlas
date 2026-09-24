# T006 — CPU Feasibility Spike Results

**Generated**: 2026-09-21T21:10:57.978Z

**IMPORTANT**: All timings below are **local wall-clock measurements** (`process.hrtime.bigint()`, this machine, Bun runtime), **not Cloudflare Workers CPU-ms**. They do not prove Cloudflare CPU-budget compliance — they provide a comparative local signal only. Real confirmation requires a separate, later, explicitly-authorized live Cloudflare validation phase.

Each row = 20 iterations of: re-parse one fixture (via `web-tree-sitter`, the same grammar Feature 002 uses) → run the relationship `.scm` query for that language → a stubbed bounded-lookup resolution step (in-memory `Map`, standing in for a real indexed D1 lookup — D1 read latency is I/O-bound and excluded from Cloudflare's own CPU-time definition).

Classification: **comfortably bounded** (p95 < 3ms) / **borderline** (3–8ms) / **likely unsafe** (>8ms).

| Language | Fixture tier | min (ms) | median (ms) | p95 (ms) | max (ms) | Classification |
|---|---|---|---|---|---|---|
| java | small | 0.060 | 0.108 | 1.751 | 1.751 | comfortably bounded |
| java | medium | 0.968 | 1.173 | 2.752 | 2.752 | comfortably bounded |
| java | large | 9.089 | 9.482 | 12.216 | 12.216 | likely unsafe |
| java | callsHeavy | 0.155 | 0.160 | 0.194 | 0.194 | comfortably bounded |
| javascript | small | 0.042 | 0.046 | 0.286 | 0.286 | comfortably bounded |
| javascript | medium | 0.528 | 0.559 | 1.041 | 1.041 | comfortably bounded |
| javascript | large | 9.247 | 9.552 | 9.723 | 9.723 | likely unsafe |
| javascript | callsHeavy | 0.188 | 0.195 | 0.269 | 0.269 | comfortably bounded |
| typescript | small | 0.060 | 0.065 | 0.276 | 0.276 | comfortably bounded |
| typescript | medium | 0.647 | 0.677 | 1.226 | 1.226 | comfortably bounded |
| typescript | large | 10.301 | 10.462 | 11.237 | 11.237 | likely unsafe |
| typescript | callsHeavy | 0.214 | 0.220 | 0.248 | 0.248 | comfortably bounded |
| tsx | small | 0.050 | 0.053 | 0.237 | 0.237 | comfortably bounded |
| tsx | medium | 0.830 | 0.868 | 1.600 | 1.600 | comfortably bounded |
| tsx | large | 9.377 | 9.582 | 10.033 | 10.033 | likely unsafe |
| tsx | callsHeavy | 0.266 | 0.270 | 0.302 | 0.302 | comfortably bounded |

**Worst-case fixture**: java/large — p95 12.216ms, classified **likely unsafe**.

**Overall go/no-go input**: At least one fixture classified **likely unsafe** — T007 MUST stop the workflow per tasks.md's gating rule.

---

## Amendment — R3 wording (2026-09-24 16:46 +04:00)

Original content above is preserved unedited. Per user-approved R3 (decision B, wording/reclassification): the **large** tier in this table is a **dense worst-case AST-shape fixture of about 705 lines** (FACT: `scripts/relationship-cpu-spike.ts` builds it with `repeatBlock(…, 700)`), not approximately 2,000 lines; T006 also ran without warm-up. The measured values in this file remain valid as LOCAL MEASUREMENT of that shape. A later local run showed AST node density explains the Java parse-phase discrepancy against the "ordinary" E3 fixtures (Java 0.229–0.238 µs per node in both shapes; dense about 36 nodes per line vs ordinary about 8). Unresolved and preserved: TypeScript per-node difference (about 30%), query-phase and cold-start cost, the E3 tree-count inconsistency (820 vs 1,025), and non-TypeScript re-runs. These are local wall-clock values, not Cloudflare CPU; nothing here claims compliance. See `research.md` Amendments A1. T007 is unchanged (STOPPED).
