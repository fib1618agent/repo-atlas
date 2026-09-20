# Phase 01 — Repository Source Abstraction

## Objective

Make RepoAtlas repository-provider agnostic so GitHub and GitLab feed one normalized repository-source contract.

## Requirements

1. A repository source SHALL identify provider, owner/group, repository, visibility, default branch, and source identity.
2. GitHub and GitLab adapters SHALL map provider responses into the normalized model.
3. Downstream analysis SHALL depend on the normalized model rather than provider-specific objects.
4. Provider-specific authentication SHALL remain inside adapters.
5. The design SHALL support future providers without changing the analysis engine.
6. Existing GitHub behavior SHALL remain functional.
7. Existing GitLab behavior SHALL remain functional.
8. Authorization failures SHALL be distinguishable from missing repositories.

## Acceptance

- GitHub and GitLab repositories enter the same pipeline.
- The analyzer receives the same normalized contract from either provider.
- Existing atlas behavior is not regressed.
- Tests cover both adapters.

## Non-goals

AST, graph, MCP, and UI work.
