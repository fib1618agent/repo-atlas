import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Query, type Language, type Node, type Tree } from "web-tree-sitter";
import {
  CODE_INTEL_RELATIONSHIP_MAX_CANDIDATES,
  RELATIONSHIP_EXTRACTOR_VERSION,
  SYMBOL_EXTRACTOR_VERSION,
} from "../../../src/lib/code-intel/config";
import type { SupportedLanguage } from "../../../src/lib/code-intel/symbols/language-detector";
import { REPO_ROOT } from "./common";

/**
 * PROTOTYPE relationship extraction + resolution (T007-L04). Every output is PROTOTYPE-labeled: T008+ production code
 * (to-relationship-facts, relationship-resolver, relationship-d1-client) does not exist. Reuses the production relationship
 * .scm drafts read-only (src/lib/code-intel/relationships/queries/*.scm) plus a harness-local EXPORTS query (research.md A2).
 * USES / REFERENCES are NOT exercised (no query drafted) — recorded limitation.
 */
export const MAX_CANDIDATES = CODE_INTEL_RELATIONSHIP_MAX_CANDIDATES; // 20
export { RELATIONSHIP_EXTRACTOR_VERSION, SYMBOL_EXTRACTOR_VERSION };
export const PARSED_METHODS = [
  "import-declaration",
  "call-expression",
  "extends-clause",
  "implements-clause",
  "export-declaration",
] as const;
export const CONTAINS_METHODS = [
  "directory-hierarchy",
  "symbol-parent",
] as const;

const EXPORT_QUERY: Record<SupportedLanguage, string> = {
  java: "",
  javascript: `
(export_statement declaration: (class_declaration name: (identifier) @rel.export.name)) @rel.export
(export_statement declaration: (function_declaration name: (identifier) @rel.export.name)) @rel.export`,
  typescript: `
(export_statement declaration: (class_declaration name: (type_identifier) @rel.export.name)) @rel.export
(export_statement declaration: (function_declaration name: (identifier) @rel.export.name)) @rel.export
(export_statement declaration: (interface_declaration name: (type_identifier) @rel.export.name)) @rel.export`,
  tsx: `
(export_statement declaration: (class_declaration name: (type_identifier) @rel.export.name)) @rel.export
(export_statement declaration: (function_declaration name: (identifier) @rel.export.name)) @rel.export
(export_statement declaration: (interface_declaration name: (type_identifier) @rel.export.name)) @rel.export`,
};

const relQuerySource: Partial<Record<SupportedLanguage, string>> = {};
export function relationshipQuerySource(lang: SupportedLanguage): string {
  return (relQuerySource[lang] ??=
    readFileSync(
      resolve(
        REPO_ROOT,
        `src/lib/code-intel/relationships/queries/${lang}.scm`,
      ),
      "utf8",
    ) +
    "\n" +
    EXPORT_QUERY[lang]);
}
const compiled = new WeakMap<Language, Query>();
function getQuery(language: Language, lang: SupportedLanguage): Query {
  let q = compiled.get(language);
  if (!q)
    compiled.set(
      language,
      (q = new Query(language, relationshipQuerySource(lang))),
    );
  return q;
}

export type FactType =
  "IMPORTS" | "CALLS" | "EXTENDS" | "IMPLEMENTS" | "EXPORTS";
export type Fact = {
  type: FactType;
  method: string;
  name: string | null; // target simple name (import: last path/FQN segment for java; null for JS/TS relative import)
  importSpec: string | null;
  enclosing: number | null; // numeric key of the source symbol's start position (or null → file)
  ev: { sl: number; sc: number; el: number; ec: number };
};
export const posKey = (row: number, col: number) => row * 16777216 + col;

function ev(n: Node) {
  return {
    sl: n.startPosition.row,
    sc: n.startPosition.column,
    el: n.endPosition.row,
    ec: n.endPosition.column,
  };
}

/** Facts from one parsed tree. `symbolStarts` = start positions (posKey) of function/method symbols (call attribution). Deterministically ordered. */
export function extractFacts(
  tree: Tree,
  language: Language,
  lang: SupportedLanguage,
  fnMethodStarts: Set<number>,
): Fact[] {
  const query = getQuery(language, lang);
  const facts: Fact[] = [];
  const enclosingOf = (node: Node): number | null => {
    let cur: Node | null = node.parent;
    while (cur) {
      const k = posKey(cur.startPosition.row, cur.startPosition.column);
      if (fnMethodStarts.has(k)) return k;
      cur = cur.parent;
    }
    return null;
  };
  for (const m of query.matches(tree.rootNode)) {
    const cap: Record<string, Node> = {};
    for (const c of m.captures) cap[c.name] = c.node;
    if (cap["rel.import"] && cap["rel.import.path"]) {
      const spec = cap["rel.import.path"].text;
      const isJava = lang === "java";
      facts.push({
        type: "IMPORTS",
        method: "import-declaration",
        name: isJava ? spec.slice(spec.lastIndexOf(".") + 1) : null,
        importSpec: spec,
        enclosing: null,
        ev: ev(cap["rel.import"]),
      });
    } else if (cap["rel.call"] && cap["rel.call.name"]) {
      const n = cap["rel.call.name"];
      facts.push({
        type: "CALLS",
        method: "call-expression",
        name: n.text,
        importSpec: null,
        enclosing: enclosingOf(n),
        ev: ev(n),
      });
    } else if (
      cap["rel.extends"] &&
      cap["rel.extends.name"] &&
      cap["rel.subject.name"]
    ) {
      const d = cap["rel.extends"];
      facts.push({
        type: "EXTENDS",
        method: "extends-clause",
        name: cap["rel.extends.name"].text,
        importSpec: null,
        enclosing: posKey(d.startPosition.row, d.startPosition.column),
        ev: ev(cap["rel.extends.name"]),
      });
    } else if (
      cap["rel.implements"] &&
      cap["rel.implements.name"] &&
      cap["rel.subject.name"]
    ) {
      const d = cap["rel.implements"];
      facts.push({
        type: "IMPLEMENTS",
        method: "implements-clause",
        name: cap["rel.implements.name"].text,
        importSpec: null,
        enclosing: posKey(d.startPosition.row, d.startPosition.column),
        ev: ev(cap["rel.implements.name"]),
      });
    } else if (cap["rel.export"] && cap["rel.export.name"]) {
      facts.push({
        type: "EXPORTS",
        method: "export-declaration",
        name: cap["rel.export.name"].text,
        importSpec: null,
        enclosing: null,
        ev: ev(cap["rel.export.name"]),
      });
    }
  }
  facts.sort(
    (a, b) =>
      a.ev.sl - b.ev.sl ||
      a.ev.sc - b.ev.sc ||
      (a.type < b.type ? -1 : a.type > b.type ? 1 : 0) ||
      ((a.name ?? "") < (b.name ?? "") ? -1 : 1),
  );
  return facts;
}

// ------------------------------------------------------------------ resolution

export type Cand = {
  id: number;
  key: string;
  kind: string;
  path: string;
  feId: number;
};
export type Endpoint = {
  kind: "directory" | "file" | "symbol";
  id: number;
  ref: string;
};
export type ResolvedRow = {
  type: string;
  method: string;
  source: Endpoint;
  target: Endpoint | null;
  state: "EXTRACTED" | "RESOLVED" | "AMBIGUOUS" | "UNKNOWN";
  candidates: Endpoint[];
  evFeId: number | null;
  evPath: string | null;
  ev: { sl: number; sc: number; el: number; ec: number } | null;
  targetName: string | null;
  importSpec: string | null;
};

const TS_EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
/** Candidate paths for a relative JS/TS import spec (deterministic precedence order). Non-relative specs → [] (external / alias → UNKNOWN). */
export function importCandidatePaths(fromPath: string, spec: string): string[] {
  if (
    !spec.startsWith("./") &&
    !spec.startsWith("../") &&
    spec !== "." &&
    spec !== ".."
  )
    return [];
  const parts = fromPath.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  const base = parts.join("/");
  const out = [base];
  for (const e of TS_EXT) out.push(base + e);
  const noJs = base.replace(/\.(m|c)?jsx?$/, "");
  if (noJs !== base)
    for (const e of [".ts", ".tsx", ".mts", ".cts"]) out.push(noJs + e);
  for (const e of TS_EXT) out.push(`${base}/index${e}`);
  return out;
}

export type LookupTrace = {
  sameFileMs: number;
  sameFileCalls: number;
  sameFileRows: number;
  byNameMs: number;
  byNameCalls: number;
  byNameRows: number;
  filesMs: number;
  filesCalls: number;
};
export const emptyTrace = (): LookupTrace => ({
  sameFileMs: 0,
  sameFileCalls: 0,
  sameFileRows: 0,
  byNameMs: 0,
  byNameCalls: 0,
  byNameRows: 0,
  filesMs: 0,
  filesCalls: 0,
});

export class Resolver {
  /** Measurement instrumentation only (env T7_TRACE_RESOLVE=1): time/rows per lookup kind; never changes behaviour. */
  trace: LookupTrace | null = process.env["T7_TRACE_RESOLVE"]
    ? emptyTrace()
    : null;
  private symByName;
  private symInFile;
  private fileByPaths: Map<number, ReturnType<Database["query"]>> = new Map();
  constructor(
    private db: Database,
    private snapshotId: number,
  ) {
    this.symByName = new Map<string, ReturnType<Database["query"]>>();
    this.symInFile = db.query(
      `SELECT s.id, s.symbol_key AS key, s.kind, sf.path, fe.id AS feId FROM symbols s JOIN file_extractions fe ON fe.id=s.file_extraction_id JOIN snapshot_files sf ON sf.id=fe.snapshot_file_id WHERE s.file_extraction_id=? AND s.name=? AND s.kind IN (SELECT value FROM json_each(?)) ORDER BY s.start_line, s.start_column`,
    );
  }
  private byName(kinds: string[], langs: string[]) {
    const k = kinds.join(",") + "|" + langs.join(",");
    let q = this.symByName.get(k);
    if (!q) {
      q = this.db.query(
        `SELECT s.id, s.symbol_key AS key, s.kind, sf.path, fe.id AS feId FROM symbols s JOIN file_extractions fe ON fe.id=s.file_extraction_id JOIN snapshot_files sf ON sf.id=fe.snapshot_file_id WHERE s.snapshot_id=? AND s.name=? AND s.kind IN (${kinds.map(() => "?").join(",")}) AND fe.language IN (${langs.map(() => "?").join(",")}) ORDER BY sf.path, s.start_line, s.start_column LIMIT ${MAX_CANDIDATES + 1}`,
      );
      this.symByName.set(k, q);
    }
    return q;
  }
  /** `lang` restricts candidates to the caller's language family (JS/TS/TSX together, Java alone) — cross-language name collisions are not candidates. */
  symbols(
    name: string,
    kinds: string[],
    lang: SupportedLanguage,
    preferFeId?: number,
  ): Cand[] {
    const tr = this.trace;
    if (preferFeId !== undefined) {
      const t0 = tr ? performance.now() : 0;
      const same = this.symInFile.all(
        preferFeId,
        name,
        JSON.stringify(kinds),
      ) as Cand[];
      if (tr) {
        tr.sameFileMs += performance.now() - t0;
        tr.sameFileCalls++;
        tr.sameFileRows += same.length;
      }
      if (same.length > 0) return same;
    }
    const langs =
      lang === "java" ? ["java"] : ["javascript", "typescript", "tsx"];
    const t1 = tr ? performance.now() : 0;
    const rows = this.byName(kinds, langs).all(
      this.snapshotId,
      name,
      ...kinds,
      ...langs,
    ) as Cand[];
    if (tr) {
      tr.byNameMs += performance.now() - t1;
      tr.byNameCalls++;
      tr.byNameRows += rows.length;
    }
    return rows;
  }
  files(paths: string[]): { path: string; feId: number }[] {
    const n = paths.length;
    let q = this.fileByPaths.get(n);
    if (!q) {
      q = this.db.query(
        `SELECT sf.path AS path, fe.id AS feId FROM snapshot_files sf JOIN file_extractions fe ON fe.snapshot_id=sf.snapshot_id AND fe.snapshot_file_id=sf.id WHERE sf.snapshot_id=? AND sf.path IN (${paths.map(() => "?").join(",")})`,
      );
      this.fileByPaths.set(n, q);
    }
    const tf = this.trace ? performance.now() : 0;
    const found = q.all(this.snapshotId, ...paths) as {
      path: string;
      feId: number;
    }[];
    if (this.trace) {
      this.trace.filesMs += performance.now() - tf;
      this.trace.filesCalls++;
    }
    const rank = new Map(paths.map((p, i) => [p, i]));
    return found.sort((a, b) => rank.get(a.path)! - rank.get(b.path)!);
  }
}

const sym = (c: Cand): Endpoint => ({ kind: "symbol", id: c.id, ref: c.key });
function decide(cands: Cand[]): {
  state: "RESOLVED" | "AMBIGUOUS" | "UNKNOWN";
  target: Endpoint | null;
  candidates: Endpoint[];
} {
  if (cands.length === 0)
    return { state: "UNKNOWN", target: null, candidates: [] };
  if (cands.length === 1)
    return { state: "RESOLVED", target: sym(cands[0]!), candidates: [] };
  return {
    state: "AMBIGUOUS",
    target: null,
    candidates: cands.slice(0, MAX_CANDIDATES).map(sym),
  };
}

export type FileCtx = {
  feId: number;
  path: string;
  lang: SupportedLanguage;
  symByStart: Map<number, { id: number; key: string }>;
};

export function resolveFact(r: Resolver, f: FileCtx, fact: Fact): ResolvedRow {
  const file: Endpoint = { kind: "file", id: f.feId, ref: f.path };
  const base = {
    type: fact.type,
    method: fact.method,
    evFeId: f.feId,
    evPath: f.path,
    ev: fact.ev,
    targetName: fact.name,
    importSpec: fact.importSpec,
  };
  const srcSym =
    fact.enclosing !== null ? f.symByStart.get(fact.enclosing) : undefined;
  const source: Endpoint = srcSym
    ? { kind: "symbol", id: srcSym.id, ref: srcSym.key }
    : file;
  switch (fact.type) {
    case "IMPORTS": {
      if (f.lang === "java") {
        const spec = fact.importSpec!;
        const suffix = spec.replace(/\./g, "/") + ".java";
        const cands = r
          .symbols(fact.name!, ["class", "interface"], "java")
          .filter((c) => c.path === suffix || c.path.endsWith("/" + suffix));
        if (cands.length === 0)
          return {
            ...base,
            source,
            target: null,
            state: "UNKNOWN",
            candidates: [],
          };
        const fileCands = [...new Map(cands.map((c) => [c.path, c])).values()];
        if (fileCands.length === 1)
          return {
            ...base,
            source,
            target: {
              kind: "file",
              id: fileCands[0]!.feId,
              ref: fileCands[0]!.path,
            },
            state: "RESOLVED",
            candidates: [],
          };
        return {
          ...base,
          source,
          target: null,
          state: "AMBIGUOUS",
          candidates: fileCands
            .slice(0, MAX_CANDIDATES)
            .map((c) => ({ kind: "file", id: c.feId, ref: c.path })),
        };
      }
      const paths = importCandidatePaths(f.path, fact.importSpec!);
      const found = paths.length ? r.files(paths) : [];
      if (found.length === 0)
        return {
          ...base,
          source,
          target: null,
          state: "UNKNOWN",
          candidates: [],
        };
      return {
        ...base,
        source,
        target: { kind: "file", id: found[0]!.feId, ref: found[0]!.path },
        state: "RESOLVED",
        candidates: [],
      }; // first by deterministic precedence
    }
    case "CALLS":
      return {
        ...base,
        source,
        ...decide(
          r.symbols(fact.name!, ["function", "method"], f.lang, f.feId),
        ),
      };
    case "EXTENDS":
    case "IMPLEMENTS":
      return {
        ...base,
        source,
        ...decide(
          r.symbols(fact.name!, ["class", "interface"], f.lang, f.feId),
        ),
      };
    case "EXPORTS": {
      const cands = r
        .symbols(fact.name!, ["class", "function", "interface"], f.lang, f.feId)
        .filter((c) => c.feId === f.feId);
      const d = decide(cands.slice(0, 1));
      return { ...base, source: file, ...d };
    }
  }
}

// ------------------------------------------------------------------ identity + persistence

/** A3 identity basis (research.md A3 Resolution; data-model.md R6 D-R6-3): refs by symbol_key / path; no row ids, no extractor version. */
export function relationshipKey(snapshotId: number, row: ResolvedRow): string {
  const s = `${snapshotId} ${row.type} ${row.source.kind} ${row.source.ref} ${row.target?.kind ?? "∅"} ${row.target?.ref ?? "∅"} ${row.evPath ?? "∅"} ${row.ev?.sl ?? "∅"} ${row.ev?.sc ?? "∅"}`;
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function persistRows(
  db: Database,
  snapshotId: number,
  rows: ResolvedRow[],
  nowIso: string,
  keys?: string[],
): { inserted: number; duplicateKeys: number; candidates: number } {
  const ins = db.query(
    `INSERT INTO relationships (snapshot_id, relationship_type, source_kind, source_id, target_kind, target_id, evidence_state, confidence, evidence_file_extraction_id, evidence_start_line, evidence_start_column, evidence_end_line, evidence_end_column, extraction_method, relationship_extractor_version, symbol_extractor_version, relationship_key, created_at, t7_target_name, t7_import_spec) VALUES (?,?,?,?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (snapshot_id, relationship_key) DO NOTHING`,
  );
  const insC = db.query(
    `INSERT INTO relationship_candidates (relationship_id, candidate_kind, candidate_id) VALUES (?,?,?) ON CONFLICT DO NOTHING`,
  );
  let inserted = 0,
    duplicateKeys = 0,
    candidates = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const key = keys ? keys[i]! : relationshipKey(snapshotId, r);
    const info = ins.run(
      snapshotId,
      r.type,
      r.source.kind,
      r.source.id,
      r.target?.kind ?? null,
      r.target?.id ?? null,
      r.state,
      r.evFeId,
      r.ev?.sl ?? null,
      r.ev?.sc ?? null,
      r.ev?.el ?? null,
      r.ev?.ec ?? null,
      r.method,
      RELATIONSHIP_EXTRACTOR_VERSION,
      SYMBOL_EXTRACTOR_VERSION,
      key,
      nowIso,
      r.targetName,
      r.importSpec,
    );
    if (info.changes === 0) {
      duplicateKeys++;
      continue;
    }
    inserted++;
    const id = Number(info.lastInsertRowid);
    for (const c of r.candidates) {
      insC.run(id, c.kind, c.id);
      candidates++;
    }
  }
  return { inserted, duplicateKeys, candidates };
}

/** CONTAINS rows for one file: directory→file, file→symbol (top-level), symbol→symbol (parent). Parse-free. */
export function deriveContainsForFile(
  db: Database,
  snapshotId: number,
  feId: number,
): ResolvedRow[] {
  const fe = db
    .query(
      `SELECT fe.id AS feId, fe.directory_path AS dir, fe.status AS status, sf.path AS path, d.id AS dirId FROM file_extractions fe JOIN snapshot_files sf ON sf.id=fe.snapshot_file_id JOIN directories d ON d.snapshot_id=fe.snapshot_id AND d.path=fe.directory_path WHERE fe.id=?`,
    )
    .get(feId) as {
    feId: number;
    dir: string;
    status: string;
    path: string;
    dirId: number;
  } | null;
  if (!fe) return [];
  const rows: ResolvedRow[] = [];
  const evBase = {
    evFeId: fe.feId,
    evPath: fe.path,
    targetName: null,
    importSpec: null,
    candidates: [] as Endpoint[],
    state: "EXTRACTED" as const,
  };
  rows.push({
    ...evBase,
    type: "CONTAINS",
    method: "directory-hierarchy",
    source: { kind: "directory", id: fe.dirId, ref: fe.dir },
    target: { kind: "file", id: fe.feId, ref: fe.path },
    ev: null,
  });
  const syms = db
    .query(
      `SELECT s.id, s.symbol_key AS key, s.start_line AS sl, s.start_column AS sc, s.end_line AS el, s.end_column AS ec, s.parent_symbol_id AS pid, p.symbol_key AS pkey FROM symbols s LEFT JOIN symbols p ON p.id=s.parent_symbol_id WHERE s.file_extraction_id=? ORDER BY s.start_line, s.start_column, s.id`,
    )
    .all(feId) as {
    id: number;
    key: string;
    sl: number;
    sc: number;
    el: number;
    ec: number;
    pid: number | null;
    pkey: string | null;
  }[];
  for (const s of syms) {
    const source: Endpoint =
      s.pid === null
        ? { kind: "file", id: fe.feId, ref: fe.path }
        : { kind: "symbol", id: s.pid, ref: s.pkey! };
    rows.push({
      ...evBase,
      type: "CONTAINS",
      method: s.pid === null ? "directory-hierarchy" : "symbol-parent",
      source,
      target: { kind: "symbol", id: s.id, ref: s.key },
      ev: { sl: s.sl, sc: s.sc, el: s.el, ec: s.ec },
    });
  }
  return rows;
}

/** directory→directory CONTAINS rows for the whole snapshot (root dir '' is parent of top-level dirs). */
export function deriveDirectoryContains(
  db: Database,
  snapshotId: number,
): ResolvedRow[] {
  const dirs = db
    .query(
      `SELECT c.id AS cid, c.path AS cpath, p.id AS pid, p.path AS ppath FROM directories c JOIN directories p ON p.snapshot_id=c.snapshot_id AND p.path=c.parent_path WHERE c.snapshot_id=? ORDER BY c.path`,
    )
    .all(snapshotId) as {
    cid: number;
    cpath: string;
    pid: number;
    ppath: string;
  }[];
  return dirs.map((d) => ({
    type: "CONTAINS",
    method: "directory-hierarchy",
    source: { kind: "directory" as const, id: d.pid, ref: d.ppath },
    target: { kind: "directory" as const, id: d.cid, ref: d.cpath },
    state: "EXTRACTED" as const,
    candidates: [],
    evFeId: null,
    evPath: null,
    ev: null,
    targetName: null,
    importSpec: null,
  }));
}
