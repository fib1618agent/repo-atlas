# Research: Dynamic GitHub Sources

**Feature**: `001-dynamic-github-sources`  
**Date**: 2026-09-16  
**Handoff**: `docs/dynamic-sources-prompt.md`

## 1. GitHub API access pattern

**Decision**: Continue using GitHub REST v3 public endpoints from TanStack Start server functions with optional `GITHUB_TOKEN` bearer auth.

**Rationale**: Matches existing `repositories.functions.ts`; no OAuth scope needed for public repos; token only raises rate limit (60 → 5,000 req/hr).

**Alternatives considered**:
- GraphQL API — fewer round-trips but new query layer and different error shapes; rejected for minimal diff.
- Client-side fetch — exposes rate limits per visitor IP and blocks CORS; rejected per constitution III.

## 2. User vs organization resolution

**Decision**: Try `GET /users/{login}/repos` first; on 404 try `GET /orgs/{login}/repos`. Single-repo URLs use `GET /repos/{owner}/{repo}`.

**Rationale**: GitHub login namespaces overlap; org-only accounts 404 on user endpoint. Documented in implementation handoff.

**Alternatives considered**:
- Always require `/orgs/` prefix for orgs — worse UX for pasted profile URLs.

## 3. Client persistence for source URLs

**Decision**: Zustand store with `localStorage` persist key `repoatlas.sources.v1`; write only after successful Load.

**Rationale**: Spec FR-016/FR-020; no server session or auth; survives refresh; draft rows stay in dialog component state.

**Alternatives considered**:
- URL query params — shareable but leaks in history and breaks on long lists; rejected.
- Cookies — no advantage over localStorage for same-origin SPA.

## 4. Server-side cache strategy

**Decision**: Layered cache — (1) in-memory Map with 15-minute TTL (existing pattern), (2) optional SQLite file on Bun/Node local dev via storage adapter, (3) memory-only on Cloudflare Workers.

**Rationale**: Constitution III + Workers have no filesystem; `bun:sqlite` must be dynamically imported to avoid Worker bundle failures.

**Alternatives considered**:
- Turso/libSQL for production — valid later; out of scope for v1 per handoff Phase 2 optional.
- Client-only cache of full repo payloads — large localStorage footprint; rejected.

## 5. React Query synchronization

**Decision**: Shared `queryKey: ["repositories", sourceKey]` on `/`, `/catalogue`, `/categories`, `/insights`; `placeholderData: keepPreviousData` during refetch.

**Rationale**: Constitution II; clarifications require keeping marbles visible during load (FR-021). Explore uses `AtlasLoading` overlay + `keepPreviousData`; dialog shows `Loading…` while fetching.

**Alternatives considered**:
- Per-route keys — caused stale catalogue vs explore; rejected.

## 6. Ranking and truncation

**Decision**: Sort all fetched repos by `stars` DESC, then `pushedAt` DESC; catalogue cap 2,000; spiral receives top 800 of same sorted list.

**Rationale**: Clarified in spec session 2026-09-16; single ranking function shared by spiral, catalogue, export.

**Alternatives considered**:
- Separate spiral random sample — breaks reproducibility; rejected.

## 7. Custom load vs default fallback

**Decision**: `repositories-fallback.json` used only when `isDefault === true` and live GitHub fails. Custom path never merges default owner or fallback JSON.

**Rationale**: Constitution I + spec FR-014/FR-022.

## 8. AI provider adapter (Phase 3)

**Decision**: `src/lib/ai/providers.ts` with `ProviderId` union; Gemini implemented; OpenAI/Anthropic/Grok stubs; keys server-only via `.env.example`.

**Rationale**: Handoff Phase 3; remove `VITE_GEMINI_API_KEY` leakage.

**Alternatives considered**:
- Visitor settings UI for keys — explicitly out of scope.

## 9. Testing approach

**Decision**: No new test runner in v1; validate via `quickstart.md` scenarios + `bunx tsc --noEmit` + manual browser checks. Optional focused unit tests for `github-url.ts` parsing if time permits in implement phase.

**Rationale**: Repo has no Jest/Vitest harness today; constitution V says avoid trivial tests.

## 10. Implementation phasing

**Decision**: Three implementation phases aligned with handoff:
1. Sources dialog + parameterized fetch + export + error catalog
2. SQLite adapter + `db:*` scripts
3. `.env.example` + AI provider adapter refactor

**Rationale**: Branch stays runnable after phases 1, 2, and 3 per handoff sequence.

**Deferred (Phase 4)**: LLM insight Sheet — spec Out of Scope until explicitly requested.
