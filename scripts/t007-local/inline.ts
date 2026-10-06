import { rmSync } from "node:fs";
import { arg, now } from "./lib/common";
import { runInline } from "./lib/run";

/** Inline (no job engine) baseline child process for G6 job-overhead: same unit code, sequential, main thread, no job-table writes. usage: bun inline.ts --db p --snapshot n --out f.json */
const t = now();
const res = await runInline(arg("db")!, Number(arg("snapshot")), {
  sample: !process.argv.includes("--nosample"),
});
await Bun.write(
  arg("out")!,
  JSON.stringify({ ...res, childTotalMs: now() - t }, null, 2),
);
process.exit(0);
