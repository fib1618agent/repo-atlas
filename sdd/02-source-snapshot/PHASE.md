# Phase 02 — Immutable Source Snapshot

## Objective

Create a reproducible source snapshot boundary identified by repository and commit SHA.

## Requirements

1. Every analysis SHALL bind to a commit SHA.
2. Authorized repository content SHALL be acquired through the provider abstraction.
3. File metadata SHALL include path, language, size, content hash, and commit SHA.
4. Repeated analysis of the same commit/configuration SHALL be reproducible.
5. Partial acquisition failures SHALL be explicit.
6. Snapshots SHOULD be cacheable.
7. Analyzer version/configuration SHALL be recorded.
8. Derived indexes SHALL not be treated as source authority.

## Acceptance

A repository produces a commit-bound snapshot, file index, reproducible analysis identity, cache behavior, and explicit partial failures.

## Non-goals

Semantic symbols, graph, vector indexing, MCP, UI.
