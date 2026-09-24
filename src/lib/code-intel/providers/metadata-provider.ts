import type { Repository } from "../../repositories";

/**
 * Metadata-acquisition capability (research/ARCHITECTURE_DECISION_GATE.md §1
 * Option B) — documents the existing `src/lib/github-fetch.ts` capability
 * retroactively. No behavior change to `github-fetch.ts`; this interface
 * exists only so Code Intelligence code that happens to also need repository
 * *metadata* (stars, topics, description — not in scope for this feature's
 * own components) depends on a provider-neutral shape rather than importing
 * `github-fetch.ts` directly.
 */
export interface MetadataProvider {
  fetchDefaultOwnerRepositories(owner: string): Promise<Repository[]>;
  fetchCustomRepositories(
    sources: string[],
  ): Promise<{ repositories: Repository[] }>;
}
