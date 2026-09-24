# Phase 08 — RepoAtlas MCP

## Objective

Expose evidence-backed engineering intelligence to AI agents through MCP.

## Initial tools

`search_symbols`, `search_code`, `search_concepts`, `get_symbol`, `get_file`, `find_callers`, `find_callees`, `find_importers`, `find_dependents`, `find_dependencies`, `find_entry_points`, `trace_execution`, `analyze_blast_radius`, `find_related_symbols`, `get_repository_context`, `get_architecture`, `get_process`, `get_evidence`.

## Requirements

1. Every tool SHALL have documented input/output contracts.
2. Results SHALL be bounded.
3. Structural claims SHALL expose evidence.
4. Source access SHALL respect authorization.
5. Errors SHALL distinguish not-found, ambiguous, unauthorized, unsupported, unavailable, and partial results.
6. MCP SHALL use existing graph/retrieval/process/impact engines.
7. Responses SHALL be stable enough for agent integration.

## Acceptance

An MCP client can perform symbol search, graph traversal, process inspection, evidence retrieval, and impact analysis.

## Non-goals

Autonomous implementation or deployment.
