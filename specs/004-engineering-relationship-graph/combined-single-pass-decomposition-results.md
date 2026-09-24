# Combined Single-Pass Decomposition (C1-C5)

**Generated**: (session time)

**LOCAL WALL-CLOCK PROXY ONLY** (`process.hrtime.bigint()`, this machine, Bun runtime). NOT Cloudflare Workers CPU-ms. Does not prove Cloudflare CPU-budget compliance. Measurement only — no production code modified, no optimization applied. Uses the REAL production `getParser`, `toIntermediateRepresentation`, `computeSymbolKey`, and real `relationships/queries/*.scm` files. Resolution is entirely excluded (not run, not stubbed) so it cannot contaminate these numbers.

**Definitions**: C1 = parse. C2raw = `toIntermediateRepresentation()` measured as the real production code runs it — this INCLUDES `computeSymbolKey` hashing, since splitting it out would require modifying that function (not permitted here). C3 = relationship-query observation only (no resolution). C4 = `computeSymbolKey()` measured in ISOLATION — same call count as the fixture's real symbol count, run entirely outside the parse/query timeline, to estimate hashing's share of C2raw. C5 = combined single-pass total, timed directly as one continuous parse→symbols→relationships pass (C1+C2raw+C3, measured together, not summed from rounded parts).

## Ordinary-density synthetic sweep — median ms, all phases

### java

| lines | C1 parse | C2raw symbols(+hash) | C3 relObs | C4 hash (isolated) | C5 total | symbols | C5 classification |
|---|---|---|---|---|---|---|---|
| 100 | 0.264 | 1.005 | 0.092 | 0.012 | 1.348 | 20 | comfortably bounded |
| 250 | 0.492 | 1.065 | 0.199 | 0.027 | 1.767 | 50 | comfortably bounded |
| 500 | 0.919 | 1.265 | 0.379 | 0.047 | 2.561 | 100 | comfortably bounded |
| 750 | 1.384 | 1.536 | 0.559 | 0.065 | 3.476 | 150 | borderline |
| 1000 | 1.829 | 1.783 | 0.758 | 0.082 | 4.410 | 200 | borderline |
| 1250 | 2.280 | 2.018 | 0.902 | 0.113 | 5.203 | 250 | borderline |
| 1500 | 2.802 | 2.489 | 1.107 | 0.130 | 6.372 | 300 | borderline |

### javascript

| lines | C1 parse | C2raw symbols(+hash) | C3 relObs | C4 hash (isolated) | C5 total | symbols | C5 classification |
|---|---|---|---|---|---|---|---|
| 101 | 0.284 | 1.198 | 0.073 | 0.009 | 1.562 | 21 | comfortably bounded |
| 251 | 0.694 | 1.409 | 0.178 | 0.028 | 2.282 | 51 | comfortably bounded |
| 501 | 1.391 | 1.615 | 0.359 | 0.049 | 3.383 | 101 | borderline |
| 751 | 2.056 | 1.949 | 0.544 | 0.081 | 4.616 | 151 | borderline |
| 1001 | 2.506 | 2.098 | 0.716 | 0.088 | 5.332 | 201 | borderline |
| 1251 | 3.145 | 2.363 | 0.908 | 0.121 | 6.436 | 251 | borderline |
| 1501 | 3.786 | 2.673 | 1.103 | 0.120 | 7.584 | 301 | borderline |

### typescript

| lines | C1 parse | C2raw symbols(+hash) | C3 relObs | C4 hash (isolated) | C5 total | symbols | C5 classification |
|---|---|---|---|---|---|---|---|
| 101 | 0.292 | 4.550 | 0.080 | 0.010 | 4.931 | 23 | borderline |
| 251 | 0.739 | 4.757 | 0.197 | 0.029 | 5.694 | 53 | borderline |
| 501 | 1.463 | 4.961 | 0.385 | 0.046 | 6.822 | 103 | borderline |
| 751 | 2.194 | 5.285 | 0.589 | 0.075 | 8.086 | 153 | likely unsafe |
| 1001 | 2.918 | 5.550 | 0.811 | 0.087 | 9.297 | 203 | likely unsafe |
| 1251 | 3.658 | 5.865 | 1.022 | 0.118 | 10.562 | 253 | likely unsafe |
| 1501 | 4.441 | 6.190 | 1.238 | 0.157 | 11.871 | 303 | likely unsafe |

### tsx

| lines | C1 parse | C2raw symbols(+hash) | C3 relObs | C4 hash (isolated) | C5 total | symbols | C5 classification |
|---|---|---|---|---|---|---|---|
| 101 | 0.384 | 5.038 | 0.095 | 0.008 | 5.512 | 21 | likely unsafe |
| 251 | 0.821 | 5.019 | 0.216 | 0.022 | 6.064 | 51 | borderline |
| 501 | 1.620 | 5.412 | 0.428 | 0.048 | 7.499 | 101 | likely unsafe |
| 751 | 2.452 | 5.597 | 0.669 | 0.067 | 8.722 | 151 | likely unsafe |
| 1001 | 3.246 | 5.851 | 0.917 | 0.087 | 10.036 | 201 | likely unsafe |
| 1251 | 4.056 | 6.497 | 1.121 | 0.119 | 11.649 | 251 | likely unsafe |
| 1501 | 4.901 | 6.564 | 1.378 | 0.126 | 12.853 | 301 | likely unsafe |

## CALLS-heavy and relationship-dense fixtures

| lang | fixture | lines | C1 | C2raw | C3 | C4 | C5 | symbols | C5 classification |
|---|---|---|---|---|---|---|---|---|---|
| java | calls-heavy | 24 | 0.094 | 0.804 | 0.050 | 0.009 | 0.951 | 21 | comfortably bounded |
| java | relationship-dense | 123 | 0.571 | 1.143 | 0.303 | 0.043 | 2.046 | 101 | comfortably bounded |
| javascript | calls-heavy | 20 | 0.117 | 1.164 | 0.053 | 0.007 | 1.338 | 19 | comfortably bounded |
| javascript | relationship-dense | 123 | 0.785 | 1.516 | 0.343 | 0.042 | 2.645 | 101 | comfortably bounded |
| typescript | calls-heavy | 20 | 0.150 | 4.526 | 0.062 | 0.008 | 4.742 | 19 | borderline |
| typescript | relationship-dense | 125 | 0.904 | 4.902 | 0.358 | 0.045 | 6.157 | 105 | borderline |
| tsx | calls-heavy | 20 | 0.184 | 4.801 | 0.070 | 0.009 | 5.053 | 19 | borderline |
| tsx | relationship-dense | 125 | 0.894 | 5.195 | 0.357 | 0.055 | 6.472 | 105 | borderline |

## Real-file measurements

| file | lang | lines | note | C1 | C2raw | C3 | C4 | C5 | symbols | C5 classification (p95) |
|---|---|---|---|---|---|---|---|---|---|---|
| src/routes/catalogue.tsx | tsx | 374 | real, ~p95 local size | 1.276 | 5.080 | 0.346 | 0.001 | 6.698 | 2 | borderline |
| src/components/atlas/AtlasScene.tsx | tsx | 637 | real, ~p99 local size | 2.524 | 5.470 | 0.751 | 0.007 | 8.775 | 13 | likely unsafe |
| src/components/ui/sidebar.tsx | tsx | 745 | real, local max | 2.064 | 5.241 | 0.506 | 0.000 | 7.850 | 1 | likely unsafe |
| src/lib/code-intel/persistence/symbol-d1-client.ts | typescript | 594 | real, largest local plain .ts | 1.536 | 4.946 | 0.401 | 0.007 | 6.893 | 18 | borderline |
| eslint.config.js | javascript | 41 | real, but only 40 lines — only real local .js file, NOT representative of a large JS file; flagged as a coverage gap | 0.093 | 1.119 | 0.026 | 0.000 | 1.239 | 0 | comfortably bounded |

## Percentage attribution of C5 (ordinary sweep, largest size = 1500 lines) and real files

| target | C1 % | C2raw % (symbols+hash) | C3 % | C4 as % of C2raw (hashing's share within symbol step) | pure-discovery estimate (C2raw − C4) |
|---|---|---|---|---|---|
| java/ordinary-1500 | 44.0% | 39.1% | 17.4% | 5.2% | 2.359ms |
| javascript/ordinary-1500 | 49.9% | 35.2% | 14.5% | 4.5% | 2.553ms |
| typescript/ordinary-1500 | 37.4% | 52.1% | 10.4% | 2.5% | 6.033ms |
| tsx/ordinary-1500 | 38.1% | 51.1% | 10.7% | 1.9% | 6.437ms |
| tsx/src/routes/catalogue.tsx | 19.0% | 75.8% | 5.2% | 0.0% | 5.080ms |
| tsx/src/components/atlas/AtlasScene.tsx | 28.8% | 62.3% | 8.6% | 0.1% | 5.464ms |
| tsx/src/components/ui/sidebar.tsx | 26.3% | 66.8% | 6.4% | 0.0% | 5.241ms |
| typescript/src/lib/code-intel/persistence/symbol-d1-client.ts | 22.3% | 71.7% | 5.8% | 0.1% | 4.938ms |
| javascript/eslint.config.js | 7.5% | 90.3% | 2.1% | 0.0% | 1.119ms |

## Recoverable time if computeSymbolKey were removed/deferred from the hot path (estimate)

| target | C5 total (current) | C4 (hashing) | C5 if hashing removed (estimate) | new classification |
|---|---|---|---|---|
| java/ordinary-1500 | 6.372 | 0.130 | 6.243 | borderline |
| javascript/ordinary-1500 | 7.584 | 0.120 | 7.464 | borderline |
| typescript/ordinary-1500 | 11.871 | 0.157 | 11.714 | likely unsafe |
| tsx/ordinary-1500 | 12.853 | 0.126 | 12.727 | likely unsafe |
| tsx/src/routes/catalogue.tsx | 6.698 | 0.001 | 6.697 | borderline |
| tsx/src/components/atlas/AtlasScene.tsx | 8.775 | 0.007 | 8.769 | likely unsafe |
| tsx/src/components/ui/sidebar.tsx | 7.850 | 0.000 | 7.849 | likely unsafe |
| typescript/src/lib/code-intel/persistence/symbol-d1-client.ts | 6.893 | 0.007 | 6.886 | borderline |
| javascript/eslint.config.js | 1.239 | 0.000 | 1.239 | comfortably bounded |

## Tree lifecycle / memory

Total trees created across this run: **820**. Total `tree.delete()` calls: **820**. Difference: **0** (0 expected — one delete per created tree, by construction of `runCell`'s loop; no lifecycle anomaly observed).

| | rss (MB) | heapUsed (MB) | external (MB) |
|---|---|---|---|
| start | 70.8 | 4.7 | 6.3 |
| end | 471.8 | 89.1 | 77.1 |

Files/fixtures processed this run: 41 (each parsed 20 timed iterations + 5 warmup iterations = 25 trees per fixture).

## Full stats (min/median/p95/max) — real files

| file | phase | min | median | p95 | max |
|---|---|---|---|---|---|
| src/routes/catalogue.tsx | C1 parse | 1.173 | 1.276 | 1.359 | 1.359 |
| src/routes/catalogue.tsx | C2raw symbols(+hash) | 4.876 | 5.080 | 5.933 | 5.933 |
| src/routes/catalogue.tsx | C3 relObs | 0.333 | 0.346 | 0.408 | 0.408 |
| src/routes/catalogue.tsx | C4 hash isolated | 0.001 | 0.001 | 0.028 | 0.028 |
| src/routes/catalogue.tsx | C5 total | 6.465 | 6.698 | 7.443 | 7.443 |
| src/components/atlas/AtlasScene.tsx | C1 parse | 2.401 | 2.524 | 2.997 | 2.997 |
| src/components/atlas/AtlasScene.tsx | C2raw symbols(+hash) | 5.270 | 5.470 | 6.207 | 6.207 |
| src/components/atlas/AtlasScene.tsx | C3 relObs | 0.695 | 0.751 | 0.809 | 0.809 |
| src/components/atlas/AtlasScene.tsx | C4 hash isolated | 0.004 | 0.007 | 0.021 | 0.021 |
| src/components/atlas/AtlasScene.tsx | C5 total | 8.533 | 8.775 | 9.443 | 9.443 |
| src/components/ui/sidebar.tsx | C1 parse | 1.958 | 2.064 | 2.352 | 2.352 |
| src/components/ui/sidebar.tsx | C2raw symbols(+hash) | 5.017 | 5.241 | 8.471 | 8.471 |
| src/components/ui/sidebar.tsx | C3 relObs | 0.479 | 0.506 | 0.655 | 0.655 |
| src/components/ui/sidebar.tsx | C4 hash isolated | 0.000 | 0.000 | 0.003 | 0.003 |
| src/components/ui/sidebar.tsx | C5 total | 7.718 | 7.850 | 11.090 | 11.090 |
| src/lib/code-intel/persistence/symbol-d1-client.ts | C1 parse | 1.488 | 1.536 | 1.665 | 1.665 |
| src/lib/code-intel/persistence/symbol-d1-client.ts | C2raw symbols(+hash) | 4.777 | 4.946 | 5.520 | 5.520 |
| src/lib/code-intel/persistence/symbol-d1-client.ts | C3 relObs | 0.386 | 0.401 | 0.645 | 0.645 |
| src/lib/code-intel/persistence/symbol-d1-client.ts | C4 hash isolated | 0.006 | 0.007 | 0.014 | 0.014 |
| src/lib/code-intel/persistence/symbol-d1-client.ts | C5 total | 6.659 | 6.893 | 7.453 | 7.453 |
| eslint.config.js | C1 parse | 0.087 | 0.093 | 0.114 | 0.114 |
| eslint.config.js | C2raw symbols(+hash) | 1.037 | 1.119 | 1.364 | 1.364 |
| eslint.config.js | C3 relObs | 0.025 | 0.026 | 0.031 | 0.031 |
| eslint.config.js | C4 hash isolated | 0.000 | 0.000 | 0.000 | 0.000 |
| eslint.config.js | C5 total | 1.149 | 1.239 | 1.489 | 1.489 |

## Unplanned side-finding: C2raw's constant floor is Query COMPILATION, not symbol walking or hashing

The real-file measurements above show something the synthetic sweep alone would not: real TS/TSX files with almost no symbols (catalogue.tsx: 2 symbols, sidebar.tsx: 1 symbol) still cost ~5ms in C2raw — nearly identical to files with 13-18 symbols. C4 (hashing, isolated) is near-zero for these files (0.000-0.007ms) because there are so few symbols to hash. Symbol count cannot explain a ~5ms floor that barely moves.

Root cause, confirmed by reading the source and isolating the cost directly: `toIntermediateRepresentation()` (`src/lib/code-intel/symbols/to-intermediate-representation.ts:48`) does `const query = new Query(language, querySource);` — it **compiles a fresh Tree-sitter `Query` object on every single call**, i.e. once per file, every file, forever. This is unrelated to parsing (the parser itself IS cached, per `grammar-provider.ts`'s `parserCache`) and unrelated to `computeSymbolKey`. It is pure query-compilation overhead, paid on every file regardless of that file's size or symbol count.

Isolated measurement (compiling each language's real symbol `.scm` query in a loop, nothing else):

| language | query-compile median | query-compile p95 |
|---|---|---|
| java | 0.793ms | 1.741ms |
| javascript | 1.062ms | 1.486ms |
| typescript | 4.359ms | 4.549ms |
| tsx | 4.752ms | 5.280ms |

This is not a synthetic-fixture artifact — it is a fixed, unconditional per-call cost paid by the real, already-shipped production code path, independent of file content. It fully explains the "typescript/tsx run ~2x higher than java/javascript" pattern flagged as an open uncertainty in the prior single-pass spike, and it explains why real files with almost no symbols still cost ~5ms in the C2raw column above: for typescript/tsx, query compilation alone accounts for roughly 85-95% of C2raw's real-file measurements in this dataset.

This was not modified, patched, or worked around — this script only measures the real function as shipped. Reported as a finding, not acted on, per the instruction that this is measurement only.

---

## Post query-cache mitigation

**Change applied (Feature 002 scope only)**: `src/lib/code-intel/symbols/to-intermediate-representation.ts` now memoizes compiled Tree-sitter `Query` objects in a module-level `WeakMap<Language, Map<querySource, Query>>` instead of calling `new Query(...)` on every file. Same lifetime semantics as `grammar-provider.ts`'s `parserCache`/`languageCache` (per Worker isolate, never evicted). No IR semantics, `computeSymbolKey`, `.scm` files, or Feature 004 paths changed. Test added: one contract test proving the cache is keyed by query source. Same script, same methodology, re-run unmodified; the sections below replace the numbers above for the post-mitigation state — the baseline sections above are preserved intact.

**Important measurement caveat**: this script's 5 warmup iterations prime the cache, so every timed iteration below is a WARM-cache, steady-state number. It does not include the one-time per-isolate compile cost — see the cold-vs-warm table.

### Cold vs warm symbol-extraction call (production `toIntermediateRepresentation`, trivial file, 20 calls)

| language | call #1 (cold: compiles + first-call warmup) | calls #2-20 median | calls #2-20 max |
|---|---|---|---|
| java | 4.813ms | 0.051ms | 0.214ms |
| javascript | 3.530ms | 0.016ms | 0.059ms |
| typescript | 10.305ms | 0.015ms | 0.035ms |
| tsx | 10.097ms | 0.010ms | 0.022ms |

Warm per-call compile cost is effectively zero. The first call per language per isolate still pays compile (plus first-call JIT/warmup, so cold ts/tsx is ~10ms locally — above the 4.4-4.8ms compile-only figure measured earlier).

### Before vs after — real files (C5 median ms; classification uses p95)

| file | lines | C5 before | C5 after | class before | class after |
|---|---|---|---|---|---|
| catalogue.tsx | 374 | 6.698 | 1.788 | borderline | comfortably bounded |
| AtlasScene.tsx | 637 | 8.775 | 3.743 | likely unsafe | borderline |
| sidebar.tsx | 745 | 7.850 | 2.709 | likely unsafe | borderline |
| symbol-d1-client.ts | 594 | 6.893 | 2.107 | borderline | comfortably bounded |
| eslint.config.js | 41 | 1.239 | 0.133 | comfortably bounded | comfortably bounded |

### After — full tables (warm cache)

#### Ordinary-density synthetic sweep — median ms, all phases

##### java

| lines | C1 parse | C2raw symbols(+hash) | C3 relObs | C4 hash (isolated) | C5 total | symbols | C5 classification |
|---|---|---|---|---|---|---|---|
| 100 | 0.274 | 0.193 | 0.144 | 0.013 | 0.607 | 20 | comfortably bounded |
| 250 | 0.606 | 0.296 | 0.198 | 0.025 | 1.106 | 50 | comfortably bounded |
| 500 | 0.880 | 0.483 | 0.370 | 0.047 | 1.742 | 100 | comfortably bounded |
| 750 | 1.333 | 0.747 | 0.546 | 0.058 | 2.646 | 150 | comfortably bounded |
| 1000 | 1.765 | 0.956 | 0.704 | 0.089 | 3.421 | 200 | borderline |
| 1250 | 2.276 | 1.205 | 0.897 | 0.112 | 4.351 | 250 | borderline |
| 1500 | 2.596 | 1.434 | 1.052 | 0.119 | 5.062 | 300 | borderline |

##### javascript

| lines | C1 parse | C2raw symbols(+hash) | C3 relObs | C4 hash (isolated) | C5 total | symbols | C5 classification |
|---|---|---|---|---|---|---|---|
| 101 | 0.267 | 0.097 | 0.067 | 0.010 | 0.435 | 21 | comfortably bounded |
| 251 | 0.678 | 0.250 | 0.174 | 0.029 | 1.111 | 51 | comfortably bounded |
| 501 | 1.318 | 0.496 | 0.339 | 0.051 | 2.144 | 101 | comfortably bounded |
| 751 | 1.981 | 0.752 | 0.526 | 0.078 | 3.266 | 151 | borderline |
| 1001 | 2.672 | 1.026 | 0.708 | 0.094 | 4.476 | 201 | borderline |
| 1251 | 3.033 | 1.233 | 0.852 | 0.107 | 5.093 | 251 | borderline |
| 1501 | 3.581 | 1.465 | 1.038 | 0.117 | 6.101 | 301 | borderline |

##### typescript

| lines | C1 parse | C2raw symbols(+hash) | C3 relObs | C4 hash (isolated) | C5 total | symbols | C5 classification |
|---|---|---|---|---|---|---|---|
| 101 | 0.284 | 0.119 | 0.084 | 0.009 | 0.495 | 23 | comfortably bounded |
| 251 | 0.692 | 0.289 | 0.209 | 0.026 | 1.187 | 53 | comfortably bounded |
| 501 | 1.361 | 0.561 | 0.375 | 0.052 | 2.314 | 103 | comfortably bounded |
| 751 | 2.034 | 0.815 | 0.567 | 0.074 | 3.417 | 153 | borderline |
| 1001 | 2.726 | 1.058 | 0.771 | 0.092 | 4.562 | 203 | borderline |
| 1251 | 3.424 | 1.341 | 0.946 | 0.120 | 5.703 | 253 | borderline |
| 1501 | 4.083 | 1.635 | 1.166 | 0.168 | 6.877 | 303 | borderline |

##### tsx

| lines | C1 parse | C2raw symbols(+hash) | C3 relObs | C4 hash (isolated) | C5 total | symbols | C5 classification |
|---|---|---|---|---|---|---|---|
| 101 | 0.307 | 0.115 | 0.083 | 0.009 | 0.503 | 21 | comfortably bounded |
| 251 | 0.763 | 0.274 | 0.206 | 0.023 | 1.240 | 51 | comfortably bounded |
| 501 | 1.533 | 0.552 | 0.413 | 0.044 | 2.509 | 101 | comfortably bounded |
| 751 | 2.310 | 0.849 | 0.641 | 0.066 | 3.798 | 151 | borderline |
| 1001 | 3.030 | 1.112 | 0.851 | 0.086 | 4.994 | 201 | borderline |
| 1251 | 3.797 | 1.428 | 1.064 | 0.111 | 6.280 | 251 | borderline |
| 1501 | 4.576 | 1.694 | 1.284 | 0.131 | 7.558 | 301 | likely unsafe |

#### CALLS-heavy and relationship-dense fixtures

| lang | fixture | lines | C1 | C2raw | C3 | C4 | C5 | symbols | C5 classification |
|---|---|---|---|---|---|---|---|---|---|
| java | calls-heavy | 24 | 0.088 | 0.068 | 0.047 | 0.008 | 0.203 | 21 | comfortably bounded |
| java | relationship-dense | 123 | 0.548 | 0.377 | 0.297 | 0.039 | 1.241 | 101 | comfortably bounded |
| javascript | calls-heavy | 20 | 0.112 | 0.062 | 0.049 | 0.007 | 0.225 | 19 | comfortably bounded |
| javascript | relationship-dense | 123 | 0.736 | 0.404 | 0.324 | 0.042 | 1.461 | 101 | comfortably bounded |
| typescript | calls-heavy | 20 | 0.135 | 0.075 | 0.060 | 0.011 | 0.275 | 19 | comfortably bounded |
| typescript | relationship-dense | 125 | 0.818 | 0.445 | 0.348 | 0.051 | 1.611 | 105 | comfortably bounded |
| tsx | calls-heavy | 20 | 0.170 | 0.080 | 0.066 | 0.007 | 0.318 | 19 | comfortably bounded |
| tsx | relationship-dense | 125 | 0.842 | 0.453 | 0.346 | 0.053 | 1.651 | 105 | comfortably bounded |

#### Real-file measurements

| file | lang | lines | note | C1 | C2raw | C3 | C4 | C5 | symbols | C5 classification (p95) |
|---|---|---|---|---|---|---|---|---|---|---|
| src/routes/catalogue.tsx | tsx | 374 | real, ~p95 local size | 1.137 | 0.310 | 0.331 | 0.001 | 1.788 | 2 | comfortably bounded |
| src/components/atlas/AtlasScene.tsx | tsx | 637 | real, ~p99 local size | 2.316 | 0.698 | 0.699 | 0.005 | 3.743 | 13 | borderline |
| src/components/ui/sidebar.tsx | tsx | 745 | real, local max | 1.791 | 0.443 | 0.471 | 0.000 | 2.709 | 1 | borderline |
| src/lib/code-intel/persistence/symbol-d1-client.ts | typescript | 594 | real, largest local plain .ts | 1.348 | 0.372 | 0.380 | 0.008 | 2.107 | 18 | comfortably bounded |
| eslint.config.js | javascript | 41 | real, but only 40 lines — only real local .js file, NOT representative of a large JS file; flagged as a coverage gap | 0.084 | 0.023 | 0.024 | 0.000 | 0.133 | 0 | comfortably bounded |

#### Tree lifecycle / memory

Total trees created across this run: **820**. Total `tree.delete()` calls: **820**. Difference: **0** (0 expected — one delete per created tree, by construction of `runCell`'s loop; no lifecycle anomaly observed).

| | rss (MB) | heapUsed (MB) | external (MB) |
|---|---|---|---|
| start | 73.0 | 4.7 | 6.3 |
| end | 491.5 | 89.0 | 77.1 |

Files/fixtures processed this run: 41 (each parsed 20 timed iterations + 5 warmup iterations = 25 trees per fixture).

