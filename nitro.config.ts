import { defineConfig } from "nitro/config";

/**
 * Nitro 3 + `nitro/vite` does not scan the repo-root `plugins/` directory by
 * default (`scanDirs` is empty). Register both Cloudflare Queue consumers
 * explicitly: `cloudflare-queue.ts` (Feature 001, snapshot acquisition) and
 * `cloudflare-symbol-queue.ts` (Feature 002, symbol extraction) — both
 * listen on the same `cloudflare:queue` hook and coexist, each filtering on
 * its own queue name.
 */
export default defineConfig({
  plugins: ["./plugins/cloudflare-queue.ts", "./plugins/cloudflare-symbol-queue.ts"],
});
