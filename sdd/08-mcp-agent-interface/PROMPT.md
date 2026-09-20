# Claude Code Prompt — Phase 08: RepoAtlas MCP

Read:

- `08-mcp-agent-interface/PHASE.md`
- `.specify/`
- all completed prior phase artifacts
- relevant research and attribution artifacts

This is an existing RepoAtlas repository. Inspect the current implementation before changing anything.

Use the existing GitHub Spec Kit / Specification-Driven Development workflow:
`specify → clarify → plan → checklist → tasks → analyze → implement → converge`.

Do not skip architectural reconnaissance.

Implement ONLY the scope of this phase.
Preserve existing RepoAtlas behavior and avoid unrelated refactoring.

Reference repositories such as Graphify and CodeGraph are research inputs only. Use documented research findings; do not blindly copy implementation or introduce dependencies simply because a reference project uses them.

Preserve:

- evidence states `EXTRACTED`, `RESOLVED`, `INFERRED`, `UNKNOWN`
- source snapshot / commit provenance
- authorization boundaries
- bounded graph traversal and context
- deterministic structural analysis before LLM reasoning

After implementation:

1. run relevant unit/integration tests
2. run lint/type checks
3. inspect the diff
4. check regression against existing RepoAtlas functionality
5. update documentation
6. update attribution/license records if applicable
7. run Spec Kit analysis/convergence as appropriate
8. report changed files, tests, known limitations, and deferred work

Do not implement later-phase capabilities unless required to satisfy this phase's acceptance criteria.
