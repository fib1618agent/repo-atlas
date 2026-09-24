import { getR2 } from "./cloudflare-env";

/**
 * Thin R2 get/put/head wrapper. Writes are put()-only, never overwritten —
 * content-addressing (content-address.ts) makes any two writes to the same
 * key byte-identical by construction, so re-putting on retry is always safe.
 */

export async function putObject(key: string, bytes: Uint8Array): Promise<void> {
  await getR2().put(key, bytes);
}

export async function getObject(key: string): Promise<Uint8Array | null> {
  const obj = await getR2().get(key);
  if (!obj) return null;
  return new Uint8Array(await obj.arrayBuffer());
}

export async function objectExists(key: string): Promise<boolean> {
  return (await getR2().head(key)) !== null;
}

/** Bounded-concurrency map, reused from `mapWithConcurrency`'s pattern in github-fetch.ts (not imported — that function is module-private there). Caps simultaneous in-flight R2 puts (research Feasibility Ratification's documented connection limit). */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}
