import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  R2BucketLike,
  R2ObjectBodyLike,
} from "../../../src/lib/code-intel/persistence/cloudflare-env";

/** Local-filesystem stand-in for the R2 SNAPSHOTS bucket: key's last segment is the content hash → <blobsDir>/<hash>. No Cloudflare. */
export function createFsR2(blobsDir: string): R2BucketLike {
  const pathFor = (key: string) =>
    resolve(blobsDir, key.slice(key.lastIndexOf("/") + 1));
  return {
    async get(key): Promise<R2ObjectBodyLike | null> {
      const p = pathFor(key);
      if (!existsSync(p)) return null;
      const buf = readFileSync(p);
      return {
        async arrayBuffer() {
          return buf.buffer.slice(
            buf.byteOffset,
            buf.byteOffset + buf.byteLength,
          ) as ArrayBuffer;
        },
      };
    },
    async put() {
      throw new Error("fsr2: read-only in harness");
    },
    async head(key) {
      return existsSync(pathFor(key)) ? {} : null;
    },
  };
}
