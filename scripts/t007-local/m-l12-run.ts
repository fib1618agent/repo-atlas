/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BANDS,
  EXT,
  generate,
  generateProbe,
  type Density,
  type Probe,
} from "./lib/fixtures";
import {
  EVIDENCE_DIR,
  REPO_ROOT,
  SCRATCH,
  arg,
  ensureDir,
  now,
  sleep,
  writeEvidence,
} from "./lib/common";
import { captureEnvironment } from "./lib/env";
import type { SupportedLanguage } from "../../src/lib/code-intel/symbols/language-detector";

/**
 * M-L1/M-L2 orchestrator. One fresh child process per fixture (m-l12-child.ts). STALL GUARD (harness parameter, NOT a protocol threshold; the protocol
 * defines none): a child whose phase heartbeat has not changed for --stall-s (default 300 s) is SIGKILLed and recorded as STALL with its last phase.
 * Once a family (language × density) stalls, its larger bands are recorded NOT_ATTEMPTED (cost discipline; resolver causes are characterized by the probes).
 * usage: bun m-l12-run.ts [--bands B1,B2,…] [--langs java,javascript,typescript,tsx] [--densities ordinary,dense] [--stall-s 300] [--budget-s 120] [--probes] [--minified]
 */
const bands = arg("bands", BANDS.map((b) => b.id).join(","))!.split(",");
const langs = arg("langs", "java,javascript,typescript,tsx")!.split(
  ",",
) as SupportedLanguage[];
const densities = arg("densities", "ordinary,dense")!.split(",") as Density[];
const stallS = Number(arg("stall-s", "300")),
  budgetS = arg("budget-s", "120")!;
const tag = arg("tag", "")!;
const FIX = ensureDir(resolve(SCRATCH, "fixtures"));
const OUTDIR = ensureDir(resolve(EVIDENCE_DIR, "m-l12"));

async function runChild(id: string, file: string) {
  const out = resolve(OUTDIR, `${id}.json`);
  const hb = `${out}.phase`;
  for (const f of [out, hb]) if (existsSync(f)) Bun.spawnSync(["rm", "-f", f]);
  const t = now();
  const child = Bun.spawn(
    [
      "bun",
      resolve(import.meta.dir, "m-l12-child.ts"),
      "--file",
      file,
      "--id",
      id,
      "--out",
      out,
      "--budget-s",
      budgetS,
    ],
    { stdout: "ignore", stderr: "pipe" },
  );
  let done = false,
    last = "",
    lastChange = Date.now(),
    status = "OK",
    lastBeat: any = null;
  child.exited.then(() => {
    done = true;
  });
  while (!done) {
    await sleep(1000);
    try {
      const b = JSON.parse(readFileSync(hb, "utf8"));
      lastBeat = b;
      const key = `${b.phase}#${b.iter}`;
      if (key !== last) {
        last = key;
        lastChange = Date.now();
      }
    } catch {
      /* not yet */
    }
    if (Date.now() - lastChange > stallS * 1000) {
      process.kill(child.pid, "SIGKILL");
      status = "STALL";
      break;
    }
  }
  const code = await child.exited;
  const wallMs = now() - t;
  if (status === "OK" && (code !== 0 || !existsSync(out)))
    status = "CHILD_FAILED";
  const stderr =
    status === "OK"
      ? ""
      : (await new Response(child.stderr).text()).slice(0, 400);
  if (status === "OK")
    return {
      id,
      status,
      wallMs,
      result: JSON.parse(readFileSync(out, "utf8")),
    };
  const salvaged = existsSync(`${out}.partial`)
    ? JSON.parse(readFileSync(`${out}.partial`, "utf8"))
    : null;
  const partial = {
    id,
    status,
    wallMs,
    salvagedBeforeFailure: salvaged,
    exitCode: code,
    stallGuardS: stallS,
    lastHeartbeat: lastBeat,
    stderr,
  };
  writeFileSync(out, JSON.stringify(partial, null, 2));
  return partial;
}
const manifest: any[] = [];
const stalledFamily = new Set<string>();
if (!process.argv.includes("--probes")) {
  const jobs: { id: string; file: string; meta: any }[] = [];
  for (const lang of langs)
    for (const d of densities)
      for (const b of BANDS.filter((x) => bands.includes(x.id))) {
        const id = `${b.id}-${lang}-${d}`;
        const file = resolve(FIX, `${id}.${EXT[lang]}`);
        writeFileSync(file, generate(lang, d, b.bytes));
        jobs.push({
          id,
          file,
          meta: {
            band: b.id,
            bandLabel: b.label,
            lang,
            density: d,
            targetBytes: b.bytes,
          },
        });
      }
  if (process.argv.includes("--minified")) {
    const src = resolve(REPO_ROOT, "node_modules/hls.js/dist/hls.min.js");
    const file = resolve(FIX, "real-minified-js.js");
    copyFileSync(src, file);
    jobs.push({
      id: "real-minified-js",
      file,
      meta: {
        band: "real",
        bandLabel:
          "real minified JS (node_modules/hls.js/dist/hls.min.js, read-only copy)",
        lang: "javascript",
        density: "minified",
      },
    });
  }
  for (const j of jobs) {
    const fam = `${j.meta.lang}-${j.meta.density}`;
    if (stalledFamily.has(fam)) {
      manifest.push({
        ...j.meta,
        id: j.id,
        status: "NOT_ATTEMPTED (smaller band of the same family stalled)",
      });
      console.log(`${j.id}: NOT_ATTEMPTED`);
      continue;
    }
    const r: any = await runChild(j.id, j.file);
    if (r.status === "STALL") stalledFamily.add(fam);
    const s = r.result;
    manifest.push({
      ...j.meta,
      id: j.id,
      status: r.status,
      wallMs: r.wallMs,
      ...(s
        ? {
            bytes: s.bytes,
            lines: s.lines,
            astNodes: s.mL1.astNodes,
            nodesPerLine: s.mL1.nodesPerLine,
            extraction: s.mL2.extraction.status,
            extractionReason: s.mL2.extraction.r ?? null,
            parsedTotalMedianMs: s.mL2.stages.parsed.phases.total.median,
            parseMedianMs: s.mL1.parseMs.median,
            iterations: s.mL2.stages.parsed.iterations,
            insufficientN: s.mL2.stages.parsed.insufficientN,
            rssGrowthMiB: s.memory.rssGrowthMiB,
          }
        : { lastHeartbeat: r.lastHeartbeat }),
    });
    console.log(
      `${j.id}: ${r.status} wall ${(r.wallMs / 1000).toFixed(1)}s${s ? ` bytes ${s.bytes} nodes/line ${s.mL1.nodesPerLine.toFixed(1)} parse ${s.mL1.parseMs.median.toFixed(1)}ms parsedUnit ${s.mL2.stages.parsed.phases.total.median.toFixed(1)}ms iters ${s.mL2.stages.parsed.iterations}` : ` last ${JSON.stringify(r.lastHeartbeat)}`}`,
    );
  }
  writeEvidence(`m-l12-bands${tag ? "-" + tag : ""}.json`, {
    measurement: "M-L1/M-L2 file-size bands",
    basis:
      "LOCAL-RUNTIME (WASM Tree-sitter under Bun) + production symbols pipeline + PROTOTYPE relationship stage",
    warmth: "process-cold per fixture; in-process iterations warm",
    stallGuardS: stallS,
    perStageBudgetS: Number(budgetS),
    iterationRule:
      "20 iterations when affordable; else as many as fit the per-stage budget (min 3), flagged insufficientN, p95 withheld",
    environmentHash: captureEnvironment().envHash,
    loadAvg: captureEnvironment().dynamic.loadAvg,
    power: captureEnvironment().dynamic.power,
    manifest,
  });
} else {
  const kinds: Probe[] = [
    "P1-unique-symbols-calls-in-file",
    "P2-external-calls",
    "P3-same-name-candidates",
    "P4-fixed-symbols-growing-calls",
    "P5-fixed-calls-growing-symbols",
  ];
  const sizes = arg("sizes", "250,500,1000,2000,4000,8000")!
    .split(",")
    .map(Number);
  for (const k of kinds)
    for (const n of sizes) {
      const id = `${k.split("-")[0]}-n${n}`;
      const file = resolve(FIX, `${id}.ts`);
      writeFileSync(file, generateProbe(k, n));
      const r: any = await runChild(id, file);
      const s = r.result;
      manifest.push({
        probe: k,
        n,
        id,
        status: r.status,
        wallMs: r.wallMs,
        ...(s
          ? {
              bytes: s.bytes,
              astNodes: s.mL1.astNodes,
              symbols: s.mL2.tables.symbols,
              relationships: s.mL2.tables.relationships,
              phases: Object.fromEntries(
                Object.entries<any>(s.mL2.stages.parsed.phases).map(
                  ([p, v]) => [p, v.median],
                ),
              ),
              iterations: s.mL2.stages.parsed.iterations,
            }
          : { lastHeartbeat: r.lastHeartbeat }),
      });
      console.log(
        `${id}: ${r.status} ${s ? `resolve ${s.mL2.stages.parsed.phases.resolve.median.toFixed(1)}ms sameFile ${s.mL2.stages.parsed.phases.resolveSameFile.median.toFixed(1)}ms byName ${s.mL2.stages.parsed.phases.resolveByName.median.toFixed(1)}ms` : JSON.stringify(r.lastHeartbeat)}`,
      );
    }
  writeEvidence(`m-l12-resolver-probes${tag ? "-" + tag : ""}.json`, {
    measurement: "M-L2 resolver scaling probes",
    note: "Each probe varies ONE input (symbols in file, calls in file, same-name candidates) with the resolver UNMODIFIED; lookup time/rows are traced (T7_TRACE_RESOLVE) — instrumentation only",
    stallGuardS: stallS,
    environmentHash: captureEnvironment().envHash,
    manifest,
  });
}
