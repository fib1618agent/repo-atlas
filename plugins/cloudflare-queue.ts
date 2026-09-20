import { definePlugin } from "nitro";
import {
  processSnapshotQueueMessage,
  type SnapshotQueueMessage,
} from "../src/lib/code-intel/queue/snapshot-worker";

/**
 * Wires Cloudflare Queues delivery to the Code Intelligence snapshot worker.
 * Nitro's `cloudflare-module` preset dispatches queue batches via the
 * `cloudflare:queue` runtime hook (see `node_modules/nitro/dist/docs/0.docs/12.plugins.md`
 * and `.../presets/cloudflare/runtime/_module-handler.mjs`). Registered via
 * `nitro.config.ts` (`plugins` array) — Nitro 3 + vite does not scan root
 * `plugins/` unless configured.
 *
 * NOTE: this wiring is implemented per Nitro's documented plugin/hook API but
 * has not been exercised against a live `wrangler dev`/deployed Queues
 * consumer in this environment (no Cloudflare account available in this
 * session) — see PROGRESS.md / implementation report for the explicit
 * verification gap.
 */
export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook(
    "cloudflare:queue",
    async ({
      batch,
    }: {
      batch: {
        messages: { body: SnapshotQueueMessage; ack(): void; retry(): void }[];
      };
    }) => {
      for (const message of batch.messages) {
        try {
          await processSnapshotQueueMessage(message.body);
          message.ack();
        } catch {
          message.retry();
        }
      }
    },
  );
});
