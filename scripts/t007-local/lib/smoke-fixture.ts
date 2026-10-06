import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createScratchDb } from "./db";
import { BLOBS, dsDir } from "./datasets";
import { ingestLocalSnapshot } from "./snapshot";

/** Hand-checkable fixture (T007-L01 / M-L0). Neutral domain. The EXPECTED list below was derived by hand from the source text BEFORE the harness was run. */
export const SMOKE_FILES: Record<string, string> = {
  "src/a.ts": `import { B } from './b';
import fs from 'fs';
export class A extends B implements I {
  run(): void { helper(); this.go(); }
  go(): void {}
}
export function helper(): void {}
`,
  "src/b.ts": `export class B { base(): void {} }
export interface I { run(): void; }
`,
  "src/c.ts": `import { A } from './a';
export function main(): void { run(); unknownFn(); }
`,
  "pkg/Util.java": `package pkg;
public class Util { public static void help() {} }
`,
  "app/Main.java": `package app;
import pkg.Util;
import java.util.List;
public class Main extends Base implements Runnable {
  public void run() { Util.help(); }
}
`,
  "README.md": `# smoke\n`,
};

export const SMOKE_EXPECTED_RELATIONSHIPS: string[] = [
  // CONTAINS (structure)
  "CONTAINS dir: -> dir:app [EXTRACTED]",
  "CONTAINS dir: -> dir:pkg [EXTRACTED]",
  "CONTAINS dir: -> dir:src [EXTRACTED]",
  "CONTAINS dir: -> file:README.md [EXTRACTED]",
  "CONTAINS dir:app -> file:app/Main.java [EXTRACTED]",
  "CONTAINS dir:pkg -> file:pkg/Util.java [EXTRACTED]",
  "CONTAINS dir:src -> file:src/a.ts [EXTRACTED]",
  "CONTAINS dir:src -> file:src/b.ts [EXTRACTED]",
  "CONTAINS dir:src -> file:src/c.ts [EXTRACTED]",
  "CONTAINS file:src/a.ts -> src/a.ts#class:A [EXTRACTED]",
  "CONTAINS file:src/a.ts -> src/a.ts#function:helper [EXTRACTED]",
  "CONTAINS src/a.ts#class:A -> src/a.ts#method:A.run [EXTRACTED]",
  "CONTAINS src/a.ts#class:A -> src/a.ts#method:A.go [EXTRACTED]",
  "CONTAINS file:src/b.ts -> src/b.ts#class:B [EXTRACTED]",
  "CONTAINS file:src/b.ts -> src/b.ts#interface:I [EXTRACTED]",
  "CONTAINS src/b.ts#class:B -> src/b.ts#method:B.base [EXTRACTED]",
  "CONTAINS src/b.ts#interface:I -> src/b.ts#method:I.run [EXTRACTED]",
  "CONTAINS file:src/c.ts -> src/c.ts#function:main [EXTRACTED]",
  "CONTAINS file:pkg/Util.java -> pkg/Util.java#class:Util [EXTRACTED]",
  "CONTAINS pkg/Util.java#class:Util -> pkg/Util.java#method:Util.help [EXTRACTED]",
  "CONTAINS file:app/Main.java -> app/Main.java#class:Main [EXTRACTED]",
  "CONTAINS app/Main.java#class:Main -> app/Main.java#method:Main.run [EXTRACTED]",
  // IMPORTS
  "IMPORTS file:src/a.ts -> file:src/b.ts [RESOLVED]",
  "IMPORTS file:src/a.ts -> ∅ [UNKNOWN]",
  "IMPORTS file:src/c.ts -> file:src/a.ts [RESOLVED]",
  "IMPORTS file:app/Main.java -> file:pkg/Util.java [RESOLVED]",
  "IMPORTS file:app/Main.java -> ∅ [UNKNOWN]",
  // EXTENDS / IMPLEMENTS
  "EXTENDS src/a.ts#class:A -> src/b.ts#class:B [RESOLVED]",
  "IMPLEMENTS src/a.ts#class:A -> src/b.ts#interface:I [RESOLVED]",
  "EXTENDS app/Main.java#class:Main -> ∅ [UNKNOWN]",
  "IMPLEMENTS app/Main.java#class:Main -> ∅ [UNKNOWN]",
  // CALLS
  "CALLS src/a.ts#method:A.run -> src/a.ts#function:helper [RESOLVED]",
  "CALLS src/a.ts#method:A.run -> src/a.ts#method:A.go [RESOLVED]",
  "CALLS src/c.ts#function:main -> ∅ [AMBIGUOUS] cands=src/a.ts#method:A.run|src/b.ts#method:I.run",
  "CALLS src/c.ts#function:main -> ∅ [UNKNOWN]",
  "CALLS app/Main.java#method:Main.run -> pkg/Util.java#method:Util.help [RESOLVED]",
  // EXPORTS
  "EXPORTS file:src/a.ts -> src/a.ts#class:A [RESOLVED]",
  "EXPORTS file:src/a.ts -> src/a.ts#function:helper [RESOLVED]",
  "EXPORTS file:src/b.ts -> src/b.ts#class:B [RESOLVED]",
  "EXPORTS file:src/b.ts -> src/b.ts#interface:I [RESOLVED]",
  "EXPORTS file:src/c.ts -> src/c.ts#function:main [RESOLVED]",
].sort();

export async function buildSmokeDataset() {
  const dir = dsDir("smoke");
  rmSync(dir, { recursive: true, force: true });
  for (const [p, c] of Object.entries(SMOKE_FILES)) {
    const f = resolve(dir, "tree", p);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, c);
  }
  const db = createScratchDb(resolve(dir, "template.db"));
  const ing = await ingestLocalSnapshot(db, {
    treeDir: resolve(dir, "tree"),
    blobsDir: BLOBS,
    identity: { provider: "github", owner: "local", name: "smoke" },
    commitSha: "0".repeat(39) + "1",
  });
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  return ing;
}
