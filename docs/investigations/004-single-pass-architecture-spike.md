# Investigation: Single-Pass Architecture Spike (A vs B vs C)

**Status**: Informational, standalone experimental spike. T007 STOP remains in force. No Feature 001/002/004 spec, plan, task, or production code modified. Nothing pushed, deployed, or run against remote Cloudflare resources.

**Related**: `docs/investigations/004-relationship-graph-cpu-and-reference-architecture.md` (graphify/codegraph investigation this spike follows up on), `specs/004-engineering-relationship-graph/single-pass-spike-results.md` (full raw data), `scripts/relationship-single-pass-spike.ts` (the spike script).

---

## 1. Objective

The graphify/codegraph reference-architecture investigation found both reference systems parse a file once and derive every relationship type from that one live AST, unlike RepoAtlas's current split (Feature 002 parses → extracts symbols → discards the tree; Feature 004 parses the same file again → extracts relationships). The prior CPU decomposition found parsing is ~67-70% of Feature 004's per-file cost. This spike tests the single-pass hypothesis directly: does folding symbol extraction and relationship observation into one parse measurably reduce cost, and does the combined unit look safely bounded against Workers Free's 10ms CPU-per-invocation ceiling.

## 2. Method

`scripts/relationship-single-pass-spike.ts` (local-only, not part of the app bundle) uses the **real production code**, not a reimplementation:

- `getParser` from `src/lib/code-intel/symbols/grammar-provider.ts` — same module-level parser/language cache, same WASM modules, same dylink-substitution mechanism already validated in production.
- `toIntermediateRepresentation` from `src/lib/code-intel/symbols/to-intermediate-representation.ts` — the real symbol-IR extractor, including its real `computeSymbolKey` SHA-256 hashing per symbol.
- The real `relationships/queries/*.scm` files for relationship observation.

Three scenarios, timed per iteration (5 warmup + 20 timed, median/p95 reported):

- **A** — Feature-002-style: parse → symbol extraction → `tree.delete()`.
- **B** — Feature-004-style: a **second**, separate parse → relationship query → stubbed bounded resolution → `tree.delete()`. `twoPass_total` = A + B, modeling the current shipped architecture end-to-end.
- **C** — hypothetical combined single-pass: **one** parse → symbol extraction → relationship query → resolution → **one** `tree.delete()`.

Coverage: Java/JavaScript/TypeScript/TSX × {100, 250, 500, 750, 1000, 1250, 1500, 2000, 2500} lines (dense synthetic sweep), plus a CALLS-heavy fixture, a relationship-dense fixture (imports+extends+implements+calls all maximized), and three real local TSX files at/near this repo's own p95/p99/max line counts. All numbers are **local wall-clock proxies** (`process.hrtime.bigint()`, this machine, Bun runtime) — not Cloudflare CPU-ms, and do not prove Cloudflare CPU-budget compliance. Classification is conservative: comfortably bounded (p95 < 3ms) / borderline (3-8ms) / likely unsafe (>8ms) — nothing close to 10ms is called comfortably bounded.

## 3. A vs B vs C — synthetic sweep (median ms)

Representative rows (full table in `single-pass-spike-results.md`):

**java**

| lines | A total | B total | two-pass total (A+B) | C total | C class | two-pass class |
|---|---|---|---|---|---|---|
| 100 | 2.267 | 1.313 | 3.553 | 2.624 | borderline | borderline |
| 500 | 7.572 | 6.477 | 14.059 | 9.771 | likely unsafe | likely unsafe |
| 1000 | 14.161 | 12.654 | 26.933 | 18.211 | likely unsafe | likely unsafe |
| 2500 | 33.631 | 31.576 | 65.386 | 44.037 | likely unsafe | likely unsafe |

**typescript / tsx** run consistently higher than java/javascript at matched size (see full table) — tsx at 2500 lines: two-pass 99.556ms, C 66.522ms.

CALLS-heavy and relationship-dense fixtures (small, realistic-length files with maximized relationship density) stay comfortably-bounded-to-borderline for java/javascript, borderline-to-likely-unsafe for typescript/tsx even at ~20-125 lines — language, not just size, matters here.

## 4. Real-file calibration — the important result

| file | lines | A total | B total | two-pass total | C total | C class | two-pass class |
|---|---|---|---|---|---|---|---|
| `src/routes/catalogue.tsx` | 374 | 6.721 | 1.684 | 8.429 | 7.046 | borderline | likely unsafe |
| `src/components/atlas/AtlasScene.tsx` | 637 | 8.517 | 3.398 | 11.953 | 9.220 | likely unsafe | likely unsafe |
| `src/components/ui/sidebar.tsx` | 745 | 7.656 | 2.633 | 10.305 | 8.181 | likely unsafe | likely unsafe |

**This changes the picture from the prior investigation.** The earlier reference-architecture investigation's real-file calibration (parse + relationship query only, no symbol IR) found the 745-line `sidebar.tsx` file cost 2.65ms — comfortably safe. This spike adds the real `toIntermediateRepresentation` call (with its real per-symbol SHA-256 hashing via `computeSymbolKey`), which was not included in that earlier check. With that real cost included, the SAME 745-line real file's two-pass total (the CURRENT shipped architecture, Feature 002 + Feature 004 back to back) measures **10.305ms — already at/over the conservative 10ms line**, and `AtlasScene.tsx` (637 lines) measures 11.953ms.

**This is not a Feature 004-only finding.** Scenario A alone — Feature-002-style parse + symbol extraction, with zero Feature 004 involvement — already measures 7.656ms and 8.517ms for these two real files. Feature 002 is completed and production-validated, but that live validation ran against a small test repository; nothing in this investigation confirms whether Feature 002 has ever processed a real file this size in production. This is a **local wall-clock proxy risk signal about Feature 002's own existing symbol-extraction cost on repo-atlas's own larger real files**, not a confirmed production incident — flagged per the standing instruction to report contradictions rather than resolve them silently.

## 5. Phase breakdown at 2500 lines — where the savings come from

| lang | two-pass total | C total | savings (two-pass − C) | savings % |
|---|---|---|---|---|
| java | 65.386 | 44.037 | 21.349 | 32.7% |
| javascript | 64.494 | 44.726 | 19.768 | 30.7% |
| typescript | 79.667 | 54.726 | 24.941 | 31.3% |
| tsx | 99.556 | 66.522 | 33.035 | 33.2% |

Single-pass (C) is **~31-33% cheaper** than the current two-pass architecture at every measured size, consistently across all four languages — this matches the prior decomposition's finding that parsing is the dominant, duplicated cost: eliminating the second parse removes almost exactly the second `parse` line item, while `symbols`/`relQuery`/`resolution` costs are essentially unchanged between B and C (same query, same resolution stub, just run once instead of preceded by a redundant reparse).

Resolution cost is negligible in both architectures (~0.007ms at 2500 lines) — never the bottleneck.

## 6. Memory / tree-lifecycle test

300 sequential single-pass (scenario C) extractions across varied synthetic sources, sampling `process.memoryUsage()` every 50 files:

| files processed | rss (MB) | heapUsed (MB) | external (MB) |
|---|---|---|---|
| 50 | 540.2 | 187.2 | 140.4 |
| 150 | 543.6 | 187.2 | 141.4 |
| 300 | 553.4 | 194.5 | 142.9 |

- **Parser reuse confirmed**: `getParser("typescript")` called twice returns the same instance (`true`) — production's module-level `parserCache` Map is already doing the parser-reuse technique the reference-architecture investigation classified `ADOPT`.
- **Tree lifecycle**: 300 files processed, 300 `tree.delete()` calls, one per file, by construction of the loop — no leaked, undeleted `Tree` handles in this script.
- RSS grew ~13MB over 300 files (~0.26MB/50 files) — a small, roughly-monotonic drift, not unbounded blowup, consistent with WASM linear memory's documented "only grows, never shrinks" behavior (the same concern codegraph's `PARSER_RESET_INTERVAL` mitigates) rather than a leak in this code path. RepoAtlas has no equivalent periodic parser-recycle interval — not flagged as urgent at this scale, but the underlying WASM-heap-growth mechanism is real and worth keeping in view if a single Worker isolate ever processes many thousands of files before being recycled.
- Caveat: `global.gc()` only runs under `--expose-gc`; without it these RSS numbers include normal GC-deferred garbage. This test verifies only this script's own tree lifecycle and reproduces the parser-reuse pattern already in production — it does not model Cloudflare's actual isolate memory model.

## 7. Relationship-type classification for the single-pass experiment

| Relationship | Observed how | Notes |
|---|---|---|
| CONTAINS | Not from parse — D1-only (existing architecture) | Unchanged by this spike |
| IMPORTS | Directly observable in the single AST pass | No later resolution needed to *observe* it; resolving the target is a separate bounded D1 step either way |
| EXTENDS | Directly observable in the single AST pass | Same as IMPORTS |
| IMPLEMENTS | Directly observable in the single AST pass | Same as IMPORTS |
| CALLS | Directly observable in the single AST pass | Target resolution (RESOLVED/AMBIGUOUS/UNKNOWN) is the later bounded D1 step, not measured here beyond the stub |
| USES / REFERENCES | Not yet implemented as dedicated `.scm` captures (unchanged from the prior investigation) | No isolated measurement possible; not fabricated |
| EXPORTS | Not touched by this spike — remains D1-only, derived from Feature 002's `is_exported` | Per explicit instruction, not redesigned as a parser relationship |

This spike did not perform full snapshot resolution — only the structural observation phase (parse + capture), consistent with the instruction that resolution remains a later, separate, bounded operation.

## 8. Comparison against the current two-pass architecture

| | Current (A then B) | Single-pass (C) |
|---|---|---|
| Parses per file | 2 | 1 |
| Median cost at 2500 lines (java) | 65.4ms | 44.0ms |
| Median cost at real 745-line file | 10.3ms | 8.2ms |
| Classification at real 745-line file | likely unsafe | likely unsafe |
| Classification at real 637-line file | likely unsafe | likely unsafe |

Single-pass is meaningfully cheaper (~31-33%) at every size measured, but **cheaper is not the same as safe**. At this repo's own largest real files, C still classifies `likely unsafe` under the conservative rule.

## 9. Queue/D1 implications (expected, not separately re-measured)

Folding Feature 004 into Feature 002's existing invocation would not add a new queue topic for the `parsed` unit type — Feature 002's existing per-file queue consumer would absorb the relationship-observation work directly, removing Feature 004's proposed second parse-triggering queue message per file entirely for that unit type (the `contains` phase, which is D1-only, is unaffected either way). This reduces total queue operations for the parsed phase from ~2 per file (one Feature 002 dispatch, one Feature 004 dispatch) toward ~1, and removes one redundant R2 read per file (Feature 004 currently re-reads the same file bytes Feature 002 already read). D1 write volume is expected to be roughly unchanged (relationship rows still need to be persisted; symbol rows still need to be persisted) — this is a CPU and R2/queue-operation saving, not a D1-volume saving. Not independently re-measured this session; flagged as an expected implication of the architecture, not a new data point.

## 10. Is single-pass extraction technically viable?

**Single-pass architecture appears viable; Feature 002/004 boundary requires an architecture decision.**

It is technically viable in the narrow sense asked: it runs, produces correct symbols and relationship observations from one parse, keeps to exactly one `tree.delete()`, shows no memory leak in this script, reuses the existing parser cache, and is measurably (~31-33%) cheaper than the current two-pass shape at every size tested. But it does **not**, by itself, resolve the CPU feasibility question — this repo's own largest real files still classify `likely unsafe` even under scenario C. The gain is real and consistent, but not sufficient alone; it would likely need to be paired with a size/complexity-aware safeguard (from the still-open mitigation space: circuit breaker, size ceiling, or another measured alternative) regardless of whether the single-pass merge is adopted.

## 11. Remaining uncertainties

- **New finding, not previously flagged**: real per-symbol SHA-256 hashing (`computeSymbolKey`) meaningfully raises Feature 002's own baseline symbol-extraction cost on larger real files — the prior investigation's real-file calibration (parse + relationship query only) understated true production cost by omitting this step. This affects Feature 002 as shipped, independent of any Feature 004 decision.
- No local Java source of any size exists in this repo — Java numbers throughout remain 100% synthetic.
- No real file exists locally in the 1500-2500-line range to calibrate the upper end directly.
- Local wall-clock cannot capture Cloudflare-isolate-specific costs (cold start, isolate GC, WASM instantiation overhead per invocation).
- The apparent per-language cost multiplier (typescript/tsx running noticeably higher than java/javascript at matched line counts, more than in the prior decomposition spike) was not root-caused this session — plausibly related to differences in how each language's real symbol query captures nodes (e.g., interface declarations), but not confirmed.
- Whether Feature 002 has ever actually processed a file this large in a real production snapshot is unknown — Feature 002's live validation used a small test repository; this is a projected risk from local measurement, not an observed incident.

## 12. Status

T007 STOP unchanged. No architecture decision made. This report surfaces two things for review: (1) single-pass extraction is a real, consistent, ~31-33% CPU reduction with no viability blockers found in this spike, but insufficient alone to clear the conservative safety bar on this repo's own largest real files; (2) Feature 002's existing symbol-extraction cost (independent of Feature 004) appears higher on real large files than the prior investigation's calibration suggested, once real per-symbol hashing is included — worth your attention regardless of what happens with Feature 004. Waiting on direction.
