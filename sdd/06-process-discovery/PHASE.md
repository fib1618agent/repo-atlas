# Phase 06 — Process Discovery

## Objective

Represent evidence-backed execution/process paths through the engineering graph.

## Entry bounds

HTTP/API endpoints, event/message consumers, publishers, scheduled jobs, workers, CLI entry points, application startup/lifecycle hooks.

## Requirements

1. Entry points SHALL use deterministic source/framework evidence where possible.
2. A process SHALL contain ordered graph relationships.
3. Each step SHALL preserve evidence and confidence.
4. Process traversal SHALL be bounded.
5. Unresolved steps SHALL remain uncertain.
6. Processes SHALL be queryable independently from raw graph traversal.

## Acceptance

Representative processes can be traced from an entry bound through resolved relationships.

## Non-goals

Runtime tracing or guaranteed production execution order.
