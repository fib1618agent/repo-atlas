/**
 * Pure resolution of the selected repository's provider context (Feature 009
 * FR-002, FR-004): decides among ready / not_found / provider_error /
 * identity_mismatch from data the Feature 003 provider already returned. No
 * network, store or React access.
 */
import type { Repository } from "../repositories";
import { parseAtlasError } from "../atlas-errors";
import { matchesFullName } from "./identity";

export type RepositoryContext =
  | { status: "loading" }
  | { status: "ready"; repository: Repository; owner: string; name: string }
  | { status: "not_found" }
  | { status: "provider_error" }
  | { status: "identity_mismatch"; canonicalFullName: string };

export interface ProviderResponseLike {
  repositories: Repository[];
  source?: string;
  meta?: { sourceFailures?: { code?: string }[] };
}

const ready = (repository: Repository): RepositoryContext => {
  const [owner = "", name = ""] = repository.fullName.split("/");
  return { status: "ready", repository, owner, name };
};

/** Looks in an already-loaded catalogue for the route's repository. */
export function findLoaded(
  params: { owner: string; name: string },
  repositories: Repository[],
): Repository | undefined {
  return repositories.find((r) => matchesFullName(params, r.fullName));
}

/**
 * Resolves the isolated single-repository provider lookup:
 * - match → ready (canonical casing from the provider);
 * - one repository returned that does not match → identity_mismatch;
 * - failures reported (or a stale fallback answer) → provider_error;
 * - otherwise → not_found.
 */
export function resolveProviderResponse(
  params: { owner: string; name: string },
  response: ProviderResponseLike | undefined,
  failed: boolean,
  error?: unknown,
): RepositoryContext {
  if (failed || !response) {
    // The provider throws (serialized AtlasError) when every source fails, so a
    // lone missing repository arrives here, not in `meta.sourceFailures`.
    const code = parseAtlasError(error)?.code;
    return code === "SOURCE_NOT_FOUND" || code === "SOURCE_FORBIDDEN"
      ? { status: "not_found" }
      : { status: "provider_error" };
  }
  const match = findLoaded(params, response.repositories);
  if (match) return ready(match);
  const failures = response.meta?.sourceFailures ?? [];
  if (failures.length > 0) {
    // A missing or inaccessible repository is not a provider outage.
    const allMissing = failures.every(
      (f) => f.code === "SOURCE_NOT_FOUND" || f.code === "SOURCE_FORBIDDEN",
    );
    return allMissing ? { status: "not_found" } : { status: "provider_error" };
  }
  if (response.source === "fallback") return { status: "provider_error" };
  if (response.repositories.length === 1) {
    return {
      status: "identity_mismatch",
      canonicalFullName: response.repositories[0]!.fullName,
    };
  }
  return { status: "not_found" };
}

export function readyFromLoaded(repository: Repository): RepositoryContext {
  return ready(repository);
}
