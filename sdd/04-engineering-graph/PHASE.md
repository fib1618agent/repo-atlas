# Phase 04 — RepoAtlas Engineering Intelligence Graph

## Objective

Connect structural entities into an evidence-backed graph.

## Initial relationships

CONTAINS, IMPORTS, EXPORTS, CALLS, EXTENDS, IMPLEMENTS, USES, DECORATED_BY, ANNOTATED_WITH, ROUTES, PUBLISHES, CONSUMES, READS, WRITES.

## Requirements

1. Nodes SHALL be language-neutral.
2. Edges SHALL identify source, target, relationship type, evidence, confidence where applicable, source location, and commit SHA.
3. Deterministic relationships SHALL be distinguished from inference.
4. Ambiguous relationships SHALL not be falsely promoted.
5. Traversal SHALL support bounded depth, direction, relationship filters, and snapshot boundaries.
6. Graph persistence SHALL be queryable and reproducible.
7. Existing SQLite conventions should be reused where appropriate.

## Acceptance

Imports, inheritance/implementation, deterministic calls, and bounded callers/callees/dependents/dependencies work and trace to evidence.

## Non-goals

Graph visualization, MCP, autonomous changes.
