/** Shared atlas limits — safe on client and server (no secrets). */
export const ATLAS_DEFAULT_OWNER = "imdadareeph";
export const ATLAS_MAX_SOURCES = 5;
export const ATLAS_MAX_SPIRAL_REPOS = 800;
export const ATLAS_MAX_STORED_REPOS = 2000;
export const ATLAS_CACHE_TTL_MS = 900_000;

export function serverAtlasConfig() {
  return {
    defaultOwner: process.env["ATLAS_DEFAULT_OWNER"] ?? ATLAS_DEFAULT_OWNER,
    maxSources: Number(process.env["ATLAS_MAX_SOURCES"] ?? ATLAS_MAX_SOURCES),
    maxSpiralRepos: Number(process.env["ATLAS_MAX_SPIRAL_REPOS"] ?? ATLAS_MAX_SPIRAL_REPOS),
    maxStoredRepos: Number(process.env["ATLAS_MAX_STORED_REPOS"] ?? ATLAS_MAX_STORED_REPOS),
    cacheTtlMs: Number(process.env["ATLAS_CACHE_TTL_MS"] ?? ATLAS_CACHE_TTL_MS),
  };
}
