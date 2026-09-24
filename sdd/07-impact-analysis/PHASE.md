# Phase 07 — Static Impact and Blast-Radius Analysis

## Objective

Determine bounded potential impact from a target symbol/change through evidence-backed graph relationships.

## Requirements

1. Support exact target selection by symbol/file.
2. Support natural-language target locking through hybrid retrieval.
3. Show candidate ambiguity.
4. Traverse incoming dependency relationships.
5. Support depth and entry-bound limits.
6. Preserve relationship evidence.
7. Identify affected nodes, entry points, and processes.
8. Report uncertainty.
9. Never represent static impact as guaranteed runtime/production impact.
10. Results SHALL be reproducible for a snapshot.

## Suggested report

Ground Zero, direct dependents, transitive dependents, affected entry bounds, affected processes, relationship chain, evidence, uncertainty, traversal boundary.

## Non-goals

Runtime prediction, automatic edits, deployment.
