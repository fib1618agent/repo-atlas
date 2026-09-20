import type {
  R2BucketLike,
  R2ObjectBodyLike,
} from "../../src/lib/code-intel/persistence/cloudflare-env";

/** In-memory R2 stand-in for tests — no live Cloudflare account needed. */
export function createMemoryR2(): R2BucketLike & { size: number } {
  const store = new Map<string, Uint8Array>();
  return {
    get size() {
      return store.size;
    },
    async put(key, value) {
      const bytes =
        value instanceof Uint8Array
          ? value
          : new Uint8Array(await new Response(value).arrayBuffer());
      store.set(key, bytes);
      return null;
    },
    async get(key): Promise<R2ObjectBodyLike | null> {
      const bytes = store.get(key);
      if (!bytes) return null;
      return {
        async arrayBuffer() {
          return new Uint8Array(bytes).buffer as ArrayBuffer;
        },
      };
    },
    async head(key) {
      return store.has(key) ? {} : null;
    },
  };
}

export function createMemoryQueue() {
  const messages: unknown[] = [];
  return {
    messages,
    async send(message: unknown) {
      messages.push(message);
    },
  };
}
