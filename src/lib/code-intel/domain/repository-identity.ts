/**
 * Provider-qualified repository identity (FR-001, FR-002). Two repositories
 * with identical owner/name but different provider are distinct values with
 * no shared key — see data-model.md `repositories.UNIQUE(provider, owner, name)`.
 */
export type Provider = "github" | "gitlab";

export type RepositoryIdentity = {
  provider: Provider;
  owner: string;
  name: string;
};

/** A mutable pointer (branch/tag/already-known-SHA) as submitted by a caller. Never persisted as a snapshot key. */
export type RepositoryRef = {
  repository: RepositoryIdentity;
  ref: string;
};

const COMMIT_SHA_BRAND = Symbol("CommitSha");

/**
 * Nominal/branded type: a bare ref string can never satisfy `CommitSha` at
 * the type level (FR-006). Only `toCommitSha` may mint one, and it runtime-
 * validates its input (SC-002 defense-in-depth) — the brand alone is a
 * compile-time-only guarantee.
 */
export type CommitSha = string & { readonly [COMMIT_SHA_BRAND]: true };

const SHA_SHAPE = /^[0-9a-f]{40}$/;

export function isCommitShaShape(value: string): boolean {
  return SHA_SHAPE.test(value);
}

/** The only function permitted to produce a `CommitSha` value. Throws if `value` isn't 40-char-hex-shaped. */
export function toCommitSha(value: string): CommitSha {
  if (!isCommitShaShape(value)) {
    throw new Error(`Not a valid commit SHA shape: "${value}"`);
  }
  return value as CommitSha;
}

export function repositoryKey(repository: RepositoryIdentity): string {
  return `${repository.provider}:${repository.owner}/${repository.name}`;
}
