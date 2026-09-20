# Phase 05 — Engineering Knowledge and Hybrid Retrieval

## Objective

Create an evidence-aware retrieval layer over structural, lexical, semantic, and metadata information.

## Retrieval modes

Exact identifier lookup, BM25, vector/semantic search, graph traversal, metadata filtering.

## Requirements

1. Exact symbol/path lookup SHALL work.
2. BM25 SHALL support lexical engineering search.
3. Semantic search SHOULD support conceptual queries.
4. Graph retrieval SHALL support structural questions.
5. Metadata filters SHALL constrain repository, language, kind, path, evidence, and snapshot.
6. Evidence fusion SHALL preserve provenance.
7. Results SHALL be bounded.
8. Source snippets SHOULD be hydrated lazily.
9. Authorization SHALL be checked before source content is returned.

## Acceptance

Exact, conceptual, dependency, and architecture queries return bounded, evidence-backed results.

## Non-goals

Autonomous coding, deployment, unlimited LLM context.
