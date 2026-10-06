import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** T007-LOCAL harness (PROTOTYPE). All generated artifacts stay inside repo-atlas. */
export const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const SCRATCH = resolve(REPO_ROOT, ".cache/t007-local"); // .cache/ is git-ignored
export const EVIDENCE_DIR = resolve(
  REPO_ROOT,
  "specs/004-engineering-relationship-graph/evidence/t007-local",
);
export const HARNESS_VERSION = "t007-local-harness/1";
export const REF_ROOT = resolve(REPO_ROOT, "../repotlas-references");

export function ensureDir(p: string): string {
  mkdirSync(p, { recursive: true });
  return p;
}

export function writeEvidence(name: string, data: unknown): string {
  ensureDir(EVIDENCE_DIR);
  const path = resolve(EVIDENCE_DIR, name);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  return path;
}

export function readEvidence<T = unknown>(name: string): T | null {
  const path = resolve(EVIDENCE_DIR, name);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as T)
    : null;
}

export type Stats = {
  n: number;
  min: number;
  median: number;
  p95: number;
  max: number;
  mean: number;
  stdev: number;
  cv: number;
};

/** nearest-rank percentile; median = p50 (mean of two middle values for even n). */
export function stats(samples: number[]): Stats {
  const s = [...samples].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0)
    return {
      n: 0,
      min: NaN,
      median: NaN,
      p95: NaN,
      max: NaN,
      mean: NaN,
      stdev: NaN,
      cv: NaN,
    };
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
  const p95 = s[Math.min(n - 1, Math.ceil(0.95 * n) - 1)]!;
  const stdev = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return {
    n,
    min: s[0]!,
    median,
    p95,
    max: s[n - 1]!,
    mean,
    stdev,
    cv: mean ? stdev / mean : 0,
  };
}

export const now = () => performance.now();
export const sleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

export function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}
export const flag = (name: string) => process.argv.includes(`--${name}`);

/** Least-squares slope (y per x) of a series. */
export function slope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return den ? num / den : 0;
}

export interface MemSample {
  t: number;
  rss: number;
  heapUsed: number;
  external: number;
}

/** Process-wide memory sampler (all threads share the process RSS). */
export function startMemSampler(intervalMs = 50) {
  const samples: MemSample[] = [];
  const t0 = now();
  const take = () => {
    const m = process.memoryUsage();
    samples.push({
      t: now() - t0,
      rss: m.rss,
      heapUsed: m.heapUsed,
      external: m.external,
    });
  };
  take();
  const h = setInterval(take, intervalMs);
  return {
    samples,
    stop() {
      clearInterval(h);
      take();
      const rss = samples.map((s) => s.rss);
      return {
        peakRss: Math.max(...rss),
        avgRss: rss.reduce((a, b) => a + b, 0) / rss.length,
        peakHeapUsed: Math.max(...samples.map((s) => s.heapUsed)),
        peakExternal: Math.max(...samples.map((s) => s.external)),
        sampleCount: samples.length,
      };
    },
  };
}

export const mib = (b: number) => Math.round((b / 1048576) * 10) / 10;
