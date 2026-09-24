/**
 * Repository identity for the Repository Intelligence view (Feature 009,
 * FR-002, SEC-001). Pure: no React, store or network access. Route params are
 * validated here and only ever used as provider inputs or bound SQL params.
 */
import type { RepositoryIdentity } from "../code-intel/domain/repository-identity";

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

export function isValidOwner(owner: string): boolean {
  return OWNER_RE.test(owner);
}

export function isValidName(name: string): boolean {
  return NAME_RE.test(name) && name !== "." && name !== "..";
}

/** GitHub identity from route params, or `null` when either param is malformed. */
export function toIdentity(
  owner: string,
  name: string,
): RepositoryIdentity | null {
  if (!isValidOwner(owner) || !isValidName(name)) return null;
  return { provider: "github", owner, name };
}

/** Splits a provider `full_name` ("owner/name"); `null` if it is not exactly that shape. */
export function splitFullName(
  fullName: string,
): { owner: string; name: string } | null {
  const parts = fullName.split("/");
  if (parts.length !== 2) return null;
  const [owner, name] = parts as [string, string];
  return isValidOwner(owner) && isValidName(name) ? { owner, name } : null;
}

/** Case-insensitive comparison (GitHub owner/name are case-insensitive) of route params with a provider `full_name`. */
export function matchesFullName(
  params: { owner: string; name: string },
  fullName: string,
): boolean {
  const canonical = splitFullName(fullName);
  if (!canonical) return false;
  return (
    canonical.owner.toLowerCase() === params.owner.toLowerCase() &&
    canonical.name.toLowerCase() === params.name.toLowerCase()
  );
}

export function repositoryUrl(identity: {
  owner: string;
  name: string;
}): string {
  return `https://github.com/${identity.owner}/${identity.name}`;
}
