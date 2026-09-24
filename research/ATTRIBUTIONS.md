# Attributions & License Analysis

Not legal advice. Facts as observed in each repository's own license files, with uncertainty flagged explicitly. Categories used: **ADOPT** (reuse as-is), **ADAPT** (architectural adaptation, no code copy), **INSPIRE** (conceptual inspiration only), **DEFER** (revisit later), **REJECT** (do not use). Distinguished separately: conceptual inspiration / architectural adaptation / source-code reuse / dependency reuse.

## Graphify

**License facts** [EXTRACTED]:

- `LICENSE` — full Apache License 2.0 text.
- `LICENSE-MIT` — secondary MIT license, copyright "(c) 2026 Safi Shamsi."
- `NOTICE`:
  ```
  Graphify
  Copyright 2026 Safi Shamsi and the Graphify contributors.
  This product is licensed under the Apache License, Version 2.0 (see LICENSE).
  Portions of this software were contributed under the MIT License prior to the
  relicensing and remain available under those terms. The original MIT license
  text is retained in LICENSE-MIT.
  ```
- `pyproject.toml:10-11`: `license = "Apache-2.0"`, `license-files = ["LICENSE", "LICENSE-MIT", "NOTICE"]`.
- No per-file copyright/SPDX headers observed in sampled modules (`extract.py`, `build.py`, `serve.py`, `affected.py`, `cluster.py`, `ids.py`, `resolver_registry.py`, `models.py`, `base.py`).

**Interpretation** [RESOLVED from license text]:

- Apache-2.0 grants a perpetual, worldwide, royalty-free copyright license including the right to prepare and distribute Derivative Works, plus an express patent grant (§2, §3).
- Attribution requirement: Apache-2.0 §4 requires retaining copyright/patent/trademark notices and reproducing readable `NOTICE`-file attributions in any _distributed_ Derivative Works. This repo ships a `NOTICE` file, so that obligation is live for redistribution.
- No copyleft — derivative works may be closed/proprietary.
- Dual-heritage nuance: some portions remain available under plain MIT per the `NOTICE` file; no file-level boundary is specified in the repo between "Apache-only" and "MIT-and-Apache" code. [UNKNOWN] which specific files/modules fall under the MIT carryover — flagged for human/legal review if literal code reuse is ever considered.

**Recommendation**:

- Reading, studying, and building an independently-implemented, architecturally-inspired feature: **permitted**, no attribution obligation triggered (architecture/ideas are not copyrightable subject matter regardless of license).
- Copying literal source code or the `NOTICE` file content: would require carrying forward the Apache-2.0 notice and `NOTICE` file per §4. **Not currently planned** by this research task (which is read-only and non-implementing).

## CodeGraph

**License facts** [EXTRACTED]:

- `LICENSE` — full standard MIT License text, `Copyright (c) 2026 Colby Mchenry`.
- `package.json`: `"license": "MIT"` — matches.
- No per-file copyright headers observed in sampled source files.

**Interpretation** [RESOLVED from license text]:

- Fully permissive: free-of-charge permission to use/copy/modify/merge/publish/distribute/sublicense/sell, no field-of-use or commercial-use restriction.
- Only condition: the copyright notice and permission notice must be included "in all copies or substantial portions of the Software." This only binds when the Software itself (or a substantial portion of its literal code) is copied/redistributed.
- No copyleft, no share-alike, no restriction on relicensing a derivative.
- Standard "AS IS" warranty/liability disclaimer.

**Recommendation**:

- Studying architecture (schema design, MCP tool shapes, hybrid-retrieval heuristics, dual-backend extraction strategy) and building an independent implementation: **permitted**, no licensing entanglement, no attribution obligation (no code copied).
- Copying actual source files or substantial code blocks: would require carrying the MIT notice with the copied portion. **Not currently planned**.

## Adoption categories applied to specific capability classes

| Capability class                                                             | Graphify                                  | CodeGraph                                       | Category                                                  | Type of reuse                                                                                                                                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Evidence/confidence label vocabulary (EXTRACTED/INFERRED/AMBIGUOUS + rubric) | Present, mature, tested                   | Weaker (binary provenance only)                 | **ADAPT**                                                 | Architectural adaptation — design own EXTRACTED/RESOLVED/INFERRED/UNKNOWN vocabulary informed by Graphify's, not copied                                            |
| Reverse-BFS blast-radius algorithm shape (`affected.py`)                     | Present, mature                           | Present, simpler                                | **ADAPT**                                                 | Architectural adaptation                                                                                                                                           |
| `LanguageConfig` declarative per-language extraction pattern                 | Present                                   | N/A (per-language TS modules, less declarative) | **INSPIRE**                                               | Conceptual inspiration for a future polyglot extractor design                                                                                                      |
| Closed `NodeKind`/`EdgeKind` taxonomy w/ wire-format ABI discipline          | N/A (open relation strings)               | Present                                         | **INSPIRE**                                               | Conceptual inspiration — the discipline of a closed, append-only vocabulary is a design lesson, not code to copy                                                   |
| SQLite + FTS5 + `bm25()` lexical search                                      | N/A (custom IDF scorer)                   | Present                                         | **ADAPT**, with caveat                                    | Architectural adaptation, blocked pending an edge-compatible substitute (Workers has no `node:sqlite`) — see `SOURCE_PROVIDER_ANALYSIS.md` §5                      |
| Rejection of vector/embedding search                                         | Explicit                                  | Explicit                                        | **INSPIRE**                                               | Both independently arrived at the same conclusion — strong conceptual signal, not code                                                                             |
| MCP tool "sufficiency" / error-shape design principles                       | Present (implicitly, via token budgeting) | Present (explicitly documented)                 | **ADOPT** (as design principle, not code)                 | Conceptual — these are stated engineering principles, freely adoptable as guidance regardless of license, since principles/ideas aren't the copyrighted expression |
| PR-integration MCP tools (`list_prs`/`get_pr_impact`/`triage_prs`)           | Present, unique to Graphify               | Absent                                          | **DEFER**                                                 | Interesting but out of scope for the current Code Intelligence phase roadmap; revisit for a later "Process/Impact Intelligence" phase                              |
| Native-code (Rust) performance kernels with parity gating                    | Native clustering only                    | Full dual WASM/native extraction backend        | **DEFER**                                                 | Premature for RepoAtlas's initial phases; revisit only if a TypeScript/WASM-only extraction proves a measured bottleneck                                           |
| Adaptive per-repo-size context budget (`getExploreBudget`)                   | Simpler flat token budget                 | Present, tiered                                 | **ADAPT**                                                 | Architectural adaptation for RepoAtlas's future MCP/agent interface phase                                                                                          |
| Commit-SHA-addressable source snapshot store                                 | Absent                                    | Absent (change-detection only)                  | **REJECT** (as a source of adaptation — nothing to adapt) | Neither project solves this; RepoAtlas must design it independently                                                                                                |
| Flat-file (`graph.json`) primary graph storage                               | Present                                   | N/A (SQLite primary)                            | **REJECT** for RepoAtlas                                  | Incompatible with Workers' lack of persistent local filesystem in production                                                                                       |

## Ambiguous areas requiring human/legal review

- [UNKNOWN] Graphify's exact MIT-vs-Apache file-level boundary, relevant only if literal code copying is ever proposed (not currently planned).
- [UNKNOWN] Whether any third-party dependency of either reference project carries its own restrictive license that would matter if that _dependency_ (not the reference project's own code) were adopted directly by RepoAtlas — dependency-level license audits were not performed in this pass; flag before adding any dependency literally sourced from either reference's `package.json`/`pyproject.toml`.
