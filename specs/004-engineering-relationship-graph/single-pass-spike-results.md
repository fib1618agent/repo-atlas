# Single-Pass Architecture Spike — A vs B vs C

**Generated**: 2026-09-21T21:43:07.723Z

**LOCAL WALL-CLOCK PROXY ONLY** (`process.hrtime.bigint()`, this machine, Bun runtime). NOT Cloudflare Workers CPU-ms. Does not prove Cloudflare CPU-budget compliance. Standalone experimental spike — no production file modified, no D1/R2/network/Cloudflare access. Uses the REAL production `getParser` (grammar-provider.ts) and REAL production `toIntermediateRepresentation` (symbol IR extractor) — not a reimplementation. Relationship observation reuses the real `relationships/queries/*.scm` files.

**Scenarios**: **A** = Feature-002-style (parse → symbol extraction → delete). **B** = Feature-004-style (a SECOND, separate parse → relationship query → resolution → delete) — `twoPass_total` = A + B, modeling the CURRENT two-invocation architecture. **C** = hypothetical combined single-pass (ONE parse → symbol extraction → relationship query → resolution → ONE delete).

**Conservative classification**: comfortably bounded (p95 < 3ms) / borderline (3–8ms) / likely unsafe (>8ms). A result close to 10ms is NEVER classified comfortably bounded, per explicit instruction.

## A vs B vs C — synthetic sweep, median ms, by language and size

### java

| lines | A: parse+symbols | B: parse+relQuery+resolve | two-pass total (A+B) | C: single-pass total | C classification | two-pass classification |
|---|---|---|---|---|---|---|
| 100 | 2.267 | 1.313 | 3.553 | 2.624 | borderline | borderline |
| 250 | 4.073 | 3.130 | 7.198 | 5.030 | borderline | likely unsafe |
| 500 | 7.572 | 6.477 | 14.059 | 9.771 | likely unsafe | likely unsafe |
| 750 | 10.690 | 9.515 | 20.142 | 13.732 | likely unsafe | likely unsafe |
| 1000 | 14.161 | 12.654 | 26.933 | 18.211 | likely unsafe | likely unsafe |
| 1250 | 17.765 | 16.160 | 33.991 | 22.894 | likely unsafe | likely unsafe |
| 1500 | 20.952 | 19.123 | 40.089 | 27.214 | likely unsafe | likely unsafe |
| 2000 | 27.316 | 25.105 | 52.649 | 35.666 | likely unsafe | likely unsafe |
| 2500 | 33.631 | 31.576 | 65.386 | 44.037 | likely unsafe | likely unsafe |

### javascript

| lines | A: parse+symbols | B: parse+relQuery+resolve | two-pass total (A+B) | C: single-pass total | C classification | two-pass classification |
|---|---|---|---|---|---|---|
| 100 | 2.549 | 1.321 | 3.870 | 2.952 | borderline | borderline |
| 250 | 4.481 | 3.107 | 7.585 | 5.419 | borderline | likely unsafe |
| 500 | 7.631 | 6.164 | 13.807 | 9.626 | likely unsafe | likely unsafe |
| 750 | 10.873 | 9.183 | 20.146 | 13.798 | likely unsafe | likely unsafe |
| 1000 | 14.145 | 12.210 | 26.388 | 18.080 | likely unsafe | likely unsafe |
| 1250 | 17.433 | 15.332 | 32.801 | 22.399 | likely unsafe | likely unsafe |
| 1500 | 20.880 | 18.504 | 39.550 | 26.583 | likely unsafe | likely unsafe |
| 2000 | 27.438 | 24.885 | 52.732 | 35.568 | likely unsafe | likely unsafe |
| 2500 | 33.706 | 30.784 | 64.494 | 44.726 | likely unsafe | likely unsafe |

### typescript

| lines | A: parse+symbols | B: parse+relQuery+resolve | two-pass total (A+B) | C: single-pass total | C classification | two-pass classification |
|---|---|---|---|---|---|---|
| 100 | 6.353 | 1.510 | 7.857 | 6.815 | borderline | likely unsafe |
| 250 | 8.584 | 3.678 | 12.227 | 9.641 | likely unsafe | likely unsafe |
| 500 | 12.518 | 7.287 | 19.794 | 14.601 | likely unsafe | likely unsafe |
| 750 | 16.161 | 10.925 | 27.094 | 19.409 | likely unsafe | likely unsafe |
| 1000 | 20.000 | 14.619 | 34.611 | 24.304 | likely unsafe | likely unsafe |
| 1250 | 23.817 | 18.216 | 42.222 | 29.478 | likely unsafe | likely unsafe |
| 1500 | 27.523 | 21.741 | 49.343 | 34.656 | likely unsafe | likely unsafe |
| 2000 | 35.371 | 29.051 | 64.538 | 44.496 | likely unsafe | likely unsafe |
| 2500 | 43.272 | 36.373 | 79.667 | 54.726 | likely unsafe | likely unsafe |

### tsx

| lines | A: parse+symbols | B: parse+relQuery+resolve | two-pass total (A+B) | C: single-pass total | C classification | two-pass classification |
|---|---|---|---|---|---|---|
| 100 | 6.939 | 1.897 | 8.827 | 7.456 | likely unsafe | likely unsafe |
| 250 | 9.842 | 4.620 | 14.474 | 11.204 | likely unsafe | likely unsafe |
| 500 | 14.480 | 9.129 | 23.583 | 17.114 | likely unsafe | likely unsafe |
| 750 | 19.393 | 13.723 | 32.986 | 23.380 | likely unsafe | likely unsafe |
| 1000 | 24.035 | 18.264 | 42.489 | 29.435 | likely unsafe | likely unsafe |
| 1250 | 28.809 | 22.937 | 51.842 | 35.495 | likely unsafe | likely unsafe |
| 1500 | 33.496 | 27.375 | 60.778 | 41.190 | likely unsafe | likely unsafe |
| 2000 | 43.686 | 36.857 | 80.551 | 53.967 | likely unsafe | likely unsafe |
| 2500 | 52.758 | 46.298 | 99.556 | 66.522 | likely unsafe | likely unsafe |

## CALLS-heavy and relationship-dense fixtures

| lang | fixture | lines | A total | B total | two-pass total | C total | C classification | two-pass classification |
|---|---|---|---|---|---|---|---|---|
| java | calls-heavy | 24 | 0.917 | 0.153 | 1.070 | 0.970 | comfortably bounded | comfortably bounded |
| java | relationship-dense | 123 | 1.769 | 0.949 | 2.736 | 2.128 | comfortably bounded | comfortably bounded |
| javascript | calls-heavy | 20 | 1.322 | 0.179 | 1.501 | 1.389 | comfortably bounded | comfortably bounded |
| javascript | relationship-dense | 123 | 2.366 | 1.183 | 3.572 | 2.756 | comfortably bounded | borderline |
| typescript | calls-heavy | 20 | 4.946 | 0.223 | 5.163 | 5.012 | borderline | borderline |
| typescript | relationship-dense | 125 | 6.073 | 1.316 | 7.390 | 6.490 | borderline | borderline |
| tsx | calls-heavy | 20 | 5.280 | 0.279 | 5.564 | 5.349 | borderline | borderline |
| tsx | relationship-dense | 125 | 6.416 | 1.327 | 7.725 | 6.803 | borderline | likely unsafe |

## Real-file calibration (repo-atlas's own TSX source, at/near local p95/p99/max)

| file | lines | A total | B total | two-pass total | C total | C classification | two-pass classification |
|---|---|---|---|---|---|---|---|
| src/routes/catalogue.tsx | 374 | 6.721 | 1.684 | 8.429 | 7.046 | borderline | likely unsafe |
| src/components/atlas/AtlasScene.tsx | 637 | 8.517 | 3.398 | 11.953 | 9.220 | likely unsafe | likely unsafe |
| src/components/ui/sidebar.tsx | 745 | 7.656 | 2.633 | 10.305 | 8.181 | likely unsafe | likely unsafe |

## Phase breakdown at 2500 lines (median ms) — full detail

| lang | a.parse | a.symbols | b.parse | b.relQuery | b.resolution | c.parse | c.symbols | c.relQuery | c.resolution | two-pass total | C total | savings (two-pass − C) | savings % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| java | 21.445 | 12.165 | 21.743 | 9.863 | 0.007 | 21.744 | 12.351 | 9.877 | 0.007 | 65.386 | 44.037 | 21.349 | 32.7% |
| javascript | 21.082 | 12.585 | 21.084 | 9.555 | 0.007 | 21.471 | 12.840 | 9.944 | 0.007 | 64.494 | 44.726 | 19.768 | 30.7% |
| typescript | 25.600 | 17.371 | 25.580 | 10.724 | 0.007 | 25.693 | 17.851 | 11.033 | 0.007 | 79.667 | 54.726 | 24.941 | 31.3% |
| tsx | 32.959 | 19.600 | 32.940 | 13.213 | 0.008 | 33.434 | 19.678 | 12.764 | 0.007 | 99.556 | 66.522 | 33.035 | 33.2% |

## Full stats (min/median/p95/max) — all cells, synthetic sweep

| lang | lines | two-pass total | C total |
|---|---|---|---|
| java | 100 | min 3.250 / median 3.553 / p95 4.947 / max 4.947 | min 2.404 / median 2.624 / p95 3.673 / max 3.673 |
| java | 250 | min 6.936 / median 7.198 / p95 8.174 / max 8.174 | min 4.887 / median 5.030 / p95 5.377 / max 5.377 |
| java | 500 | min 13.267 / median 14.059 / p95 22.445 / max 22.445 | min 8.871 / median 9.771 / p95 14.159 / max 14.159 |
| java | 750 | min 19.663 / median 20.142 / p95 23.515 / max 23.515 | min 13.446 / median 13.732 / p95 15.473 / max 15.473 |
| java | 1000 | min 26.098 / median 26.933 / p95 31.627 / max 31.627 | min 17.470 / median 18.211 / p95 19.615 / max 19.615 |
| java | 1250 | min 33.011 / median 33.991 / p95 36.216 / max 36.216 | min 22.201 / median 22.894 / p95 23.580 / max 23.580 |
| java | 1500 | min 39.336 / median 40.089 / p95 41.460 / max 41.460 | min 26.206 / median 27.214 / p95 29.410 / max 29.410 |
| java | 2000 | min 51.758 / median 52.649 / p95 54.544 / max 54.544 | min 34.606 / median 35.666 / p95 45.843 / max 45.843 |
| java | 2500 | min 64.515 / median 65.386 / p95 67.022 / max 67.022 | min 43.073 / median 44.037 / p95 45.931 / max 45.931 |
| javascript | 100 | min 3.785 / median 3.870 / p95 4.132 / max 4.132 | min 2.878 / median 2.952 / p95 3.442 / max 3.442 |
| javascript | 250 | min 7.403 / median 7.585 / p95 8.194 / max 8.194 | min 5.048 / median 5.419 / p95 5.733 / max 5.733 |
| javascript | 500 | min 13.428 / median 13.807 / p95 14.199 / max 14.199 | min 9.513 / median 9.626 / p95 14.918 / max 14.918 |
| javascript | 750 | min 19.883 / median 20.146 / p95 20.606 / max 20.606 | min 13.599 / median 13.798 / p95 15.134 / max 15.134 |
| javascript | 1000 | min 26.147 / median 26.388 / p95 26.991 / max 26.991 | min 17.709 / median 18.080 / p95 19.732 / max 19.732 |
| javascript | 1250 | min 32.232 / median 32.801 / p95 34.370 / max 34.370 | min 21.767 / median 22.399 / p95 23.473 / max 23.473 |
| javascript | 1500 | min 39.031 / median 39.550 / p95 41.446 / max 41.446 | min 26.120 / median 26.583 / p95 28.103 / max 28.103 |
| javascript | 2000 | min 51.258 / median 52.732 / p95 57.663 / max 57.663 | min 34.561 / median 35.568 / p95 37.428 / max 37.428 |
| javascript | 2500 | min 63.645 / median 64.494 / p95 72.721 / max 72.721 | min 42.790 / median 44.726 / p95 47.978 / max 47.978 |
| typescript | 100 | min 7.697 / median 7.857 / p95 8.021 / max 8.021 | min 6.414 / median 6.815 / p95 7.717 / max 7.717 |
| typescript | 250 | min 12.044 / median 12.227 / p95 12.518 / max 12.518 | min 9.302 / median 9.641 / p95 10.150 / max 10.150 |
| typescript | 500 | min 19.032 / median 19.794 / p95 20.592 / max 20.592 | min 14.279 / median 14.601 / p95 18.724 / max 18.724 |
| typescript | 750 | min 26.731 / median 27.094 / p95 29.823 / max 29.823 | min 19.038 / median 19.409 / p95 23.182 / max 23.182 |
| typescript | 1000 | min 34.077 / median 34.611 / p95 36.077 / max 36.077 | min 24.051 / median 24.304 / p95 26.180 / max 26.180 |
| typescript | 1250 | min 41.264 / median 42.222 / p95 45.365 / max 45.365 | min 28.791 / median 29.478 / p95 32.966 / max 32.966 |
| typescript | 1500 | min 48.387 / median 49.343 / p95 51.209 / max 51.209 | min 33.695 / median 34.656 / p95 36.050 / max 36.050 |
| typescript | 2000 | min 63.731 / median 64.538 / p95 70.943 / max 70.943 | min 42.678 / median 44.496 / p95 48.251 / max 48.251 |
| typescript | 2500 | min 78.528 / median 79.667 / p95 87.859 / max 87.859 | min 53.147 / median 54.726 / p95 58.045 / max 58.045 |
| tsx | 100 | min 8.680 / median 8.827 / p95 9.415 / max 9.415 | min 7.376 / median 7.456 / p95 8.112 / max 8.112 |
| tsx | 250 | min 14.283 / median 14.474 / p95 15.869 / max 15.869 | min 10.836 / median 11.204 / p95 14.271 / max 14.271 |
| tsx | 500 | min 23.183 / median 23.583 / p95 24.932 / max 24.932 | min 16.818 / median 17.114 / p95 18.582 / max 18.582 |
| tsx | 750 | min 32.673 / median 32.986 / p95 34.943 / max 34.943 | min 22.662 / median 23.380 / p95 24.477 / max 24.477 |
| tsx | 1000 | min 41.562 / median 42.489 / p95 56.781 / max 56.781 | min 28.610 / median 29.435 / p95 31.183 / max 31.183 |
| tsx | 1250 | min 50.928 / median 51.842 / p95 53.690 / max 53.690 | min 34.739 / median 35.495 / p95 37.586 / max 37.586 |
| tsx | 1500 | min 59.967 / median 60.778 / p95 63.036 / max 63.036 | min 40.472 / median 41.190 / p95 44.487 / max 44.487 |
| tsx | 2000 | min 78.752 / median 80.551 / p95 82.668 / max 82.668 | min 52.522 / median 53.967 / p95 59.169 / max 59.169 |
| tsx | 2500 | min 97.343 / median 99.556 / p95 103.692 / max 103.692 | min 64.709 / median 66.522 / p95 75.815 / max 75.815 |

## Memory / tree-lifecycle test

Runs 300 sequential single-pass (scenario C) extractions across varied synthetic sources (different content per file, avoiding any identical-source shortcut), sampling `process.memoryUsage()` every 50 files. Verifies: parser identity is stable (production `getParser`'s module-level cache is reused, not re-instantiated per file — confirms an existing ADOPT-classified technique from the reference-architecture investigation is already production behavior), tree.delete() called exactly once per file, and RSS/external memory does not grow unboundedly.

**Parser reuse check**: `getParser("typescript")` called twice — same instance returned: **true** (production `grammar-provider.ts`'s module-level `parserCache` Map).

| files processed | rss (MB) | heapUsed (MB) | external (MB) | trees deleted (cumulative) |
|---|---|---|---|---|
| 50 | 540.2 | 187.2 | 140.4 | 50 |
| 100 | 540.7 | 187.2 | 140.9 | 100 |
| 150 | 543.6 | 187.2 | 141.4 | 150 |
| 200 | 552.3 | 194.5 | 141.9 | 200 |
| 250 | 552.8 | 194.5 | 142.4 | 250 |
| 300 | 553.4 | 194.5 | 142.9 | 300 |

Total files processed: 300. Total `tree.delete()` calls: 300 (exactly one per file — no leaked, undeleted trees by construction of this loop).

**Caveat**: `global.gc()` is only invoked if the script was run with `--expose-gc`; if unavailable, RSS numbers include normal GC-deferred garbage and should be read as a trend across the row, not an exact per-file figure. This test does not run under Cloudflare's actual isolate memory model — it only verifies THIS script's own tree lifecycle (no leaked `Tree` handles) and reproduces the parser-reuse pattern production already uses.
