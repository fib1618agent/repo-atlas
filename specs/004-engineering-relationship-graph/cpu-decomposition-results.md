# CPU Decomposition Investigation — supplement to T006/T007

**Generated**: 2026-09-21T21:24:02.967Z

**LOCAL WALL-CLOCK PROXY ONLY** (`process.hrtime.bigint()`, this machine, Bun runtime). Not Cloudflare Workers CPU-ms. Does not prove Cloudflare CPU-budget compliance. Informational supplement to T006 — does not modify `feasibility-results.md` or the T007 STOP decision.

CONTAINS and EXPORTS excluded from parse/query measurement by design (both D1-only derivations, zero parse cost — research.md §4 and the EXPORTS 2026-09-22 correction). USES/REFERENCES have no dedicated `.scm` captures yet (implementation has not proceeded past T007's gate) — not measured in isolation here.

**Column semantics**: `parse+query` and `complete` reflect the REAL single-invocation pipeline shape — one parse, one combined query (all families run together in one `Query.matches()` call, exactly what the real `.scm` files do), one resolution pass. The per-family columns (imports/extends/implements/calls) are a SEPARATE diagnostic measurement — each family's query re-run in isolation against the same already-parsed tree, timed after the real-pipeline numbers are captured, purely to attribute query cost across families. Family costs are not additive into `parse+query`/`complete` (running 4 isolated queries costs more than 1 combined query over the same patterns, due to per-call overhead) — use them only for relative attribution, not as a second route to the pipeline total.

**Warmup**: 5 untimed parse+query iterations discarded before the 20 timed iterations per fixture, to remove JIT/module-cache warmup noise from the first call. These are STEADY-STATE numbers (repeated invocations of the same parser/query object) — a genuinely cold Worker isolate's first invocation could run slower than steady-state; that cold-start tail is a separate, real, unmeasured risk this script does not quantify.

## Per-language, per-size decomposition (20 iterations each; all times ms)

### java

| lines | parse (p95) | imports (p95) | extends (p95) | implements (p95) | calls (p95) | combined query (p95) | resolution (p95) | parse+query (p95) | complete (p95) |
|---|---|---|---|---|---|---|---|---|---|
| 500 | 5.896 | 1.640 | 1.458 | 1.496 | 2.056 | 3.035 | 0.177 | 8.941 | 9.126 |
| 750 | 6.872 | 2.488 | 2.540 | 2.416 | 2.763 | 3.246 | 0.068 | 10.042 | 10.111 |
| 1000 | 9.036 | 3.325 | 2.961 | 3.325 | 3.662 | 4.637 | 0.134 | 13.454 | 13.529 |
| 1250 | 11.188 | 4.144 | 4.206 | 3.894 | 4.514 | 5.443 | 0.110 | 16.442 | 16.556 |
| 1500 | 15.429 | 6.391 | 4.691 | 4.962 | 7.976 | 12.770 | 0.152 | 28.203 | 28.308 |
| 1750 | 15.999 | 5.640 | 5.323 | 5.210 | 6.471 | 8.079 | 0.142 | 23.983 | 24.102 |
| 2000 | 18.212 | 6.217 | 6.391 | 6.304 | 7.779 | 9.696 | 0.154 | 27.454 | 27.598 |
| 2500 | 28.497 | 7.588 | 8.213 | 7.620 | 9.201 | 12.347 | 0.196 | 40.847 | 41.021 |

### javascript

| lines | parse (p95) | imports (p95) | extends (p95) | implements (p95) | calls (p95) | combined query (p95) | resolution (p95) | parse+query (p95) | complete (p95) |
|---|---|---|---|---|---|---|---|---|---|
| 500 | 4.742 | 1.468 | 1.650 | 0.000 | 2.044 | 2.291 | 0.040 | 7.034 | 7.068 |
| 750 | 7.265 | 2.658 | 2.513 | 0.000 | 3.013 | 3.278 | 0.069 | 10.544 | 10.597 |
| 1000 | 9.641 | 3.296 | 3.036 | 0.000 | 4.157 | 4.540 | 0.082 | 14.121 | 14.189 |
| 1250 | 11.828 | 4.244 | 3.772 | 0.000 | 4.801 | 5.838 | 0.118 | 17.213 | 17.298 |
| 1500 | 18.590 | 5.048 | 4.915 | 0.000 | 6.523 | 7.073 | 0.117 | 25.664 | 25.782 |
| 1750 | 16.686 | 5.886 | 5.341 | 0.000 | 7.147 | 8.110 | 0.147 | 24.227 | 24.350 |
| 2000 | 18.781 | 6.875 | 6.147 | 0.000 | 8.133 | 8.914 | 0.169 | 27.680 | 27.812 |
| 2500 | 27.290 | 8.170 | 8.023 | 0.000 | 10.103 | 11.632 | 0.192 | 38.627 | 38.802 |

### typescript

| lines | parse (p95) | imports (p95) | extends (p95) | implements (p95) | calls (p95) | combined query (p95) | resolution (p95) | parse+query (p95) | complete (p95) |
|---|---|---|---|---|---|---|---|---|---|
| 500 | 5.405 | 1.639 | 1.888 | 1.584 | 2.024 | 2.668 | 0.043 | 7.767 | 7.803 |
| 750 | 7.920 | 2.922 | 2.686 | 2.384 | 3.222 | 3.642 | 0.068 | 11.427 | 11.496 |
| 1000 | 10.735 | 3.306 | 3.792 | 3.675 | 4.127 | 4.664 | 0.078 | 15.340 | 15.424 |
| 1250 | 13.370 | 4.760 | 4.479 | 4.302 | 5.236 | 6.129 | 0.095 | 19.500 | 19.583 |
| 1500 | 20.267 | 5.786 | 5.474 | 5.237 | 6.735 | 7.945 | 0.131 | 28.100 | 28.205 |
| 1750 | 18.616 | 6.900 | 6.375 | 6.618 | 7.342 | 8.971 | 0.151 | 27.406 | 27.526 |
| 2000 | 22.436 | 7.497 | 6.844 | 7.007 | 10.536 | 10.085 | 0.144 | 32.525 | 32.672 |
| 2500 | 26.802 | 11.150 | 9.119 | 9.413 | 11.539 | 14.737 | 0.453 | 41.242 | 41.405 |

### tsx

| lines | parse (p95) | imports (p95) | extends (p95) | implements (p95) | calls (p95) | combined query (p95) | resolution (p95) | parse+query (p95) | complete (p95) |
|---|---|---|---|---|---|---|---|---|---|
| 500 | 6.934 | 1.975 | 1.963 | 2.078 | 2.560 | 3.087 | 0.042 | 9.677 | 9.716 |
| 750 | 10.610 | 3.349 | 3.147 | 3.178 | 3.712 | 4.439 | 0.069 | 14.667 | 14.729 |
| 1000 | 13.429 | 4.376 | 3.896 | 3.909 | 4.717 | 5.602 | 0.087 | 18.997 | 19.077 |
| 1250 | 17.634 | 5.384 | 5.177 | 4.870 | 6.286 | 7.321 | 0.092 | 24.654 | 24.744 |
| 1500 | 20.385 | 6.636 | 6.580 | 6.424 | 7.268 | 8.748 | 0.125 | 28.925 | 29.032 |
| 1750 | 24.381 | 7.463 | 7.552 | 7.220 | 12.081 | 10.888 | 0.140 | 35.271 | 35.397 |
| 2000 | 26.713 | 8.421 | 8.452 | 8.195 | 10.043 | 11.208 | 0.153 | 37.714 | 37.852 |
| 2500 | 34.123 | 10.464 | 10.400 | 11.143 | 12.195 | 15.213 | 0.189 | 48.836 | 49.006 |

## Full stats (min/median/p95/max) — complete pipeline only, all lang/size cells

| lang | lines | parse | combined query | resolution | complete |
|---|---|---|---|---|---|
| java | 500 | min 4.333 / median 4.406 / p95 5.896 / max 5.896 | min 1.989 / median 2.117 / p95 3.035 / max 3.035 | min 0.038 / median 0.044 / p95 0.177 / max 0.177 | min 6.363 / median 6.612 / p95 9.126 / max 9.126 |
| java | 750 | min 6.452 / median 6.625 / p95 6.872 / max 6.872 | min 2.905 / median 3.065 / p95 3.246 / max 3.246 | min 0.052 / median 0.057 / p95 0.068 / max 0.068 | min 9.530 / median 9.728 / p95 10.111 / max 10.111 |
| java | 1000 | min 8.609 / median 8.761 / p95 9.036 / max 9.036 | min 3.924 / median 4.063 / p95 4.637 / max 4.637 | min 0.070 / median 0.073 / p95 0.134 / max 0.134 | min 12.686 / median 12.894 / p95 13.529 / max 13.529 |
| java | 1250 | min 10.782 / median 10.897 / p95 11.188 / max 11.188 | min 4.954 / median 5.171 / p95 5.443 / max 5.443 | min 0.079 / median 0.083 / p95 0.110 / max 0.110 | min 15.830 / median 16.121 / p95 16.556 / max 16.556 |
| java | 1500 | min 13.002 / median 13.160 / p95 15.429 / max 15.429 | min 6.013 / median 6.285 / p95 12.770 / max 12.770 | min 0.098 / median 0.102 / p95 0.152 / max 0.152 | min 19.182 / median 19.584 / p95 28.308 / max 28.308 |
| java | 1750 | min 15.135 / median 15.374 / p95 15.999 / max 15.999 | min 7.021 / median 7.244 / p95 8.079 / max 8.079 | min 0.110 / median 0.121 / p95 0.142 / max 0.142 | min 22.348 / median 22.773 / p95 24.102 / max 24.102 |
| java | 2000 | min 17.278 / median 17.758 / p95 18.212 / max 18.212 | min 7.898 / median 8.173 / p95 9.696 / max 9.696 | min 0.127 / median 0.133 / p95 0.154 / max 0.154 | min 25.454 / median 26.131 / p95 27.598 / max 27.598 |
| java | 2500 | min 21.633 / median 22.029 / p95 28.497 / max 28.497 | min 9.987 / median 10.561 / p95 12.347 / max 12.347 | min 0.158 / median 0.169 / p95 0.196 / max 0.196 | min 32.075 / median 32.930 / p95 41.021 / max 41.021 |
| javascript | 500 | min 4.537 / median 4.640 / p95 4.742 / max 4.742 | min 1.935 / median 2.046 / p95 2.291 / max 2.291 | min 0.032 / median 0.033 / p95 0.040 / max 0.040 | min 6.505 / median 6.721 / p95 7.068 / max 7.068 |
| javascript | 750 | min 6.591 / median 6.973 / p95 7.265 / max 7.265 | min 2.960 / median 3.150 / p95 3.278 / max 3.278 | min 0.049 / median 0.054 / p95 0.069 / max 0.069 | min 9.678 / median 10.156 / p95 10.597 / max 10.597 |
| javascript | 1000 | min 8.572 / median 9.256 / p95 9.641 / max 9.641 | min 3.891 / median 4.136 / p95 4.540 / max 4.540 | min 0.063 / median 0.067 / p95 0.082 / max 0.082 | min 12.897 / median 13.485 / p95 14.189 / max 14.189 |
| javascript | 1250 | min 10.469 / median 10.794 / p95 11.828 / max 11.828 | min 4.933 / median 5.090 / p95 5.838 / max 5.838 | min 0.080 / median 0.086 / p95 0.118 / max 0.118 | min 15.705 / median 16.252 / p95 17.298 / max 17.298 |
| javascript | 1500 | min 12.855 / median 13.248 / p95 18.590 / max 18.590 | min 5.862 / median 6.101 / p95 7.073 / max 7.073 | min 0.094 / median 0.103 / p95 0.117 / max 0.117 | min 18.909 / median 19.609 / p95 25.782 / max 25.782 |
| javascript | 1750 | min 15.093 / median 15.688 / p95 16.686 / max 16.686 | min 6.841 / median 7.321 / p95 8.110 / max 8.110 | min 0.111 / median 0.118 / p95 0.147 / max 0.147 | min 22.104 / median 23.125 / p95 24.350 / max 24.350 |
| javascript | 2000 | min 17.173 / median 17.458 / p95 18.781 / max 18.781 | min 7.798 / median 8.206 / p95 8.914 / max 8.914 | min 0.127 / median 0.133 / p95 0.169 / max 0.169 | min 25.226 / median 26.035 / p95 27.812 / max 27.812 |
| javascript | 2500 | min 21.445 / median 21.721 / p95 27.290 / max 27.290 | min 9.779 / median 10.152 / p95 11.632 / max 11.632 | min 0.157 / median 0.164 / p95 0.192 / max 0.192 | min 31.574 / median 32.296 / p95 38.802 / max 38.802 |
| typescript | 500 | min 5.012 / median 5.187 / p95 5.405 / max 5.405 | min 2.171 / median 2.229 / p95 2.668 / max 2.668 | min 0.032 / median 0.034 / p95 0.043 / max 0.043 | min 7.216 / median 7.470 / p95 7.803 / max 7.803 |
| typescript | 750 | min 7.658 / median 7.731 / p95 7.920 / max 7.920 | min 3.278 / median 3.389 / p95 3.642 / max 3.642 | min 0.047 / median 0.053 / p95 0.068 / max 0.068 | min 11.021 / median 11.201 / p95 11.496 / max 11.496 |
| typescript | 1000 | min 10.055 / median 10.196 / p95 10.735 / max 10.735 | min 4.387 / median 4.497 / p95 4.664 / max 4.664 | min 0.066 / median 0.069 / p95 0.078 / max 0.078 | min 14.572 / median 14.771 / p95 15.424 / max 15.424 |
| typescript | 1250 | min 12.699 / median 12.905 / p95 13.370 / max 13.370 | min 5.418 / median 5.616 / p95 6.129 / max 6.129 | min 0.079 / median 0.082 / p95 0.095 / max 0.095 | min 18.318 / median 18.624 / p95 19.583 / max 19.583 |
| typescript | 1500 | min 15.344 / median 15.707 / p95 20.267 / max 20.267 | min 6.544 / median 6.989 / p95 7.945 / max 7.945 | min 0.096 / median 0.101 / p95 0.131 / max 0.131 | min 22.036 / median 22.690 / p95 28.205 / max 28.205 |
| typescript | 1750 | min 17.948 / median 18.206 / p95 18.616 / max 18.616 | min 7.832 / median 8.096 / p95 8.971 / max 8.971 | min 0.113 / median 0.120 / p95 0.151 / max 0.151 | min 25.894 / median 26.475 / p95 27.526 / max 27.526 |
| typescript | 2000 | min 20.390 / median 20.612 / p95 22.436 / max 22.436 | min 8.893 / median 9.122 / p95 10.085 / max 10.085 | min 0.125 / median 0.133 / p95 0.144 / max 0.144 | min 29.537 / median 29.986 / p95 32.672 / max 32.672 |
| typescript | 2500 | min 25.545 / median 26.031 / p95 26.802 / max 26.802 | min 11.212 / median 12.108 / p95 14.737 / max 14.737 | min 0.156 / median 0.167 / p95 0.453 / max 0.453 | min 36.963 / median 38.441 / p95 41.405 / max 41.405 |
| tsx | 500 | min 6.332 / median 6.545 / p95 6.934 / max 6.934 | min 2.585 / median 2.664 / p95 3.087 / max 3.087 | min 0.033 / median 0.035 / p95 0.042 / max 0.042 | min 9.054 / median 9.270 / p95 9.716 / max 9.716 |
| tsx | 750 | min 9.640 / median 9.914 / p95 10.610 / max 10.610 | min 3.857 / median 4.138 / p95 4.439 / max 4.439 | min 0.049 / median 0.055 / p95 0.069 / max 0.069 | min 13.613 / median 14.250 / p95 14.729 / max 14.729 |
| tsx | 1000 | min 12.863 / median 13.166 / p95 13.429 / max 13.429 | min 5.124 / median 5.263 / p95 5.602 / max 5.602 | min 0.064 / median 0.069 / p95 0.087 / max 0.087 | min 18.128 / median 18.545 / p95 19.077 / max 19.077 |
| tsx | 1250 | min 16.094 / median 16.508 / p95 17.634 / max 17.634 | min 6.424 / median 6.708 / p95 7.321 / max 7.321 | min 0.081 / median 0.084 / p95 0.092 / max 0.092 | min 22.902 / median 23.242 / p95 24.744 / max 24.744 |
| tsx | 1500 | min 19.246 / median 19.776 / p95 20.385 / max 20.385 | min 7.809 / median 8.046 / p95 8.748 / max 8.748 | min 0.094 / median 0.104 / p95 0.125 / max 0.125 | min 27.236 / median 27.958 / p95 29.032 / max 29.032 |
| tsx | 1750 | min 22.587 / median 22.840 / p95 24.381 / max 24.381 | min 9.024 / median 9.404 / p95 10.888 / max 10.888 | min 0.112 / median 0.122 / p95 0.140 / max 0.140 | min 31.827 / median 32.505 / p95 35.397 / max 35.397 |
| tsx | 2000 | min 25.746 / median 26.073 / p95 26.713 / max 26.713 | min 10.280 / median 10.683 / p95 11.208 / max 11.208 | min 0.128 / median 0.135 / p95 0.153 / max 0.153 | min 36.294 / median 36.953 / p95 37.852 / max 37.852 |
| tsx | 2500 | min 32.428 / median 33.368 / p95 34.123 / max 34.123 | min 13.037 / median 13.847 / p95 15.213 / max 15.213 | min 0.158 / median 0.167 / p95 0.189 / max 0.189 | min 45.943 / median 47.417 / p95 49.006 / max 49.006 |

## Bottleneck attribution at largest measured size (2500 lines)

| lang | parse % of complete | query % of complete | resolution % of complete |
|---|---|---|---|
| java | 66.9% | 32.1% | 0.5% |
| javascript | 67.3% | 31.4% | 0.5% |
| typescript | 67.7% | 31.5% | 0.4% |
| tsx | 70.4% | 29.2% | 0.4% |
