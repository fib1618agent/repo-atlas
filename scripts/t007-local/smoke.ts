/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import { openDb } from "./lib/db";
import { BLOBS } from "./lib/datasets";
import {
  canonicalGraph,
  checkInvariants,
  describeRelationships,
} from "./lib/graph";
import { freshRunDb, dbBytes } from "./lib/run";
import { runEngine } from "./engine";
import {
  buildSmokeDataset,
  SMOKE_EXPECTED_RELATIONSHIPS,
} from "./lib/smoke-fixture";
import { captureEnvironment } from "./lib/env";
import { writeEvidence } from "./lib/common";

/** M-L0 / T007-L01: environment capture + smoke of the full path with hand-checked expected relationships. */
const ing = await buildSmokeDataset();
const runs: any[] = [];
const hashes: string[] = [];
let diffs: { missing: string[]; unexpected: string[] } = {
  missing: [],
  unexpected: [],
};
for (const workers of [1, 2, 1]) {
  const { dbPath, snapshotId } = freshRunDb(
    "smoke",
    `w${workers}-${runs.length}`,
  );
  const r = await runEngine({
    dbPath,
    snapshotId,
    blobsDir: BLOBS,
    workers,
    label: "smoke",
  });
  const db = openDb(dbPath);
  const g = canonicalGraph(db, snapshotId);
  const got = describeRelationships(db, snapshotId);
  const inv = checkInvariants(db, snapshotId);
  db.close();
  hashes.push(g.hash);
  const exp = new Set(SMOKE_EXPECTED_RELATIONSHIPS),
    gotSet = new Set(got);
  diffs = {
    missing: [...exp].filter((x) => !gotSet.has(x)),
    unexpected: got.filter((x) => !exp.has(x)),
  };
  runs.push({
    workers,
    wallMs: r.wallMs,
    jobs: r.jobsAfter,
    snapshotStatus: r.snapshotStatus,
    graphHash: g.hash,
    counts: g.counts,
    invariantViolations: inv,
    missingVsExpected: diffs.missing,
    unexpectedVsExpected: diffs.unexpected,
    dbBytes: dbBytes(dbPath),
  });
}
const pass =
  runs.every(
    (r) =>
      r.missingVsExpected.length === 0 &&
      r.unexpectedVsExpected.length === 0 &&
      r.invariantViolations.length === 0,
  ) && new Set(hashes).size === 1;
const out = {
  task: "T007-L01 / M-L0",
  basis: "PROTOTYPE-BEHAVIOR",
  ingest: ing,
  expectedCount: SMOKE_EXPECTED_RELATIONSHIPS.length,
  runs,
  deterministicAcrossRuns: new Set(hashes).size === 1,
  pass,
  environment: captureEnvironment(),
};
writeEvidence("m-l0-smoke.json", out);
console.log(
  JSON.stringify(
    {
      pass,
      deterministic: out.deterministicAcrossRuns,
      expected: out.expectedCount,
      got: runs[0].counts.relationships,
      missing: runs[0].missingVsExpected,
      unexpected: runs[0].unexpectedVsExpected,
      inv: runs[0].invariantViolations,
      jobs: runs[0].jobs,
    },
    null,
    1,
  ),
);
process.exit(pass ? 0 : 1);
