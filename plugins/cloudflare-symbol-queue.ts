import { definePlugin } from "nitro";
import {
  processSymbolQueueMessage,
  type SymbolQueueMessage,
} from "../src/lib/code-intel/symbols/symbol-worker";

/**
 * Wires Cloudflare Queues delivery to the Code Intelligence symbol worker.
 * Shares the same `cloudflare:queue` hook as `plugins/cloudflare-queue.ts`
 * (Feature 001) — both listeners fire for every batch, so this one filters
 * on `batch.queue === "repo-atlas-symbol-extraction"` to ignore batches
 * belonging to the other queue.
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
        queue: string;
        messages: { body: SymbolQueueMessage; ack(): void; retry(): void }[];
      };
    }) => {
      if (batch.queue !== "repo-atlas-symbol-extraction") {
        return;
      }
      for (const message of batch.messages) {
        try {
          await processSymbolQueueMessage(message.body);
          message.ack();
        } catch {
          message.retry();
        }
      }
    },
  );
});
