/* eslint-disable @typescript-eslint/no-explicit-any -- T007 throwaway measurement harness (PROTOTYPE) */
import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";

type Row = Record<string, any>;
function maps(db: Database, snapshotId: number) {
  const syms = new Map<number, Row>();
  const files = new Map<number, Row>();
  const dirs = new Map<number, Row>();
  for (const s of db
    .query(
      `SELECT s.id, s.symbol_key AS key, s.kind, s.name, s.qualified_name AS q, s.start_line sl, s.start_column sc, s.end_line el, s.end_column ec, sf.path, p.symbol_key AS pkey FROM symbols s JOIN file_extractions fe ON fe.id=s.file_extraction_id JOIN snapshot_files sf ON sf.id=fe.snapshot_file_id LEFT JOIN symbols p ON p.id=s.parent_symbol_id WHERE s.snapshot_id=?`,
    )
    .all(snapshotId) as Row[])
    syms.set(s["id"], s);
  for (const f of db
    .query(
      `SELECT fe.id, sf.path, fe.status, fe.language FROM file_extractions fe JOIN snapshot_files sf ON sf.id=fe.snapshot_file_id WHERE fe.snapshot_id=?`,
    )
    .all(snapshotId) as Row[])
    files.set(f["id"], f);
  for (const d of db
    .query(`SELECT id, path, parent_path FROM directories WHERE snapshot_id=?`)
    .all(snapshotId) as Row[])
    dirs.set(d["id"], d);
  return { syms, files, dirs };
}
const ref = (
  m: ReturnType<typeof maps>,
  kind: string | null,
  id: number | null,
  mode: "key" | "desc",
): string => {
  if (kind === null || id === null) return "∅";
  if (kind === "symbol") {
    const s = m.syms.get(id);
    return !s
      ? `MISSING-SYMBOL#${id}`
      : mode === "key"
        ? s["key"]
        : `${s["path"]}#${s["kind"]}:${s["q"] ?? s["name"]}`;
  }
  if (kind === "file") {
    const f = m.files.get(id);
    return !f
      ? `MISSING-FILE#${id}`
      : mode === "key"
        ? f["path"]
        : `file:${f["path"]}`;
  }
  const d = m.dirs.get(id);
  return !d
    ? `MISSING-DIR#${id}`
    : mode === "key"
      ? d["path"]
      : `dir:${d["path"]}`;
};

/** Row-id-free canonical dump for byte-identity comparison (G1): symbols, file extractions, directories, relationships (+ sorted candidate refs). */
export function canonicalGraph(db: Database, snapshotId: number) {
  const m = maps(db, snapshotId);
  const lines: string[] = [];
  for (const s of m.syms.values())
    lines.push(
      `sym|${s["key"]}|${s["kind"]}|${s["name"]}|${s["q"] ?? "∅"}|${s["sl"]}:${s["sc"]}-${s["el"]}:${s["ec"]}|${s["pkey"] ?? "∅"}`,
    );
  for (const f of m.files.values())
    lines.push(`fe|${f["path"]}|${f["status"]}|${f["language"] ?? "∅"}`);
  for (const d of m.dirs.values())
    lines.push(`dir|${d["path"]}|${d["parent_path"] ?? "∅"}`);
  const cand = new Map<number, string[]>();
  for (const c of db
    .query(
      `SELECT c.relationship_id rid, c.candidate_kind k, c.candidate_id cid FROM relationship_candidates c JOIN relationships r ON r.id=c.relationship_id WHERE r.snapshot_id=?`,
    )
    .all(snapshotId) as Row[]) {
    const a = cand.get(c["rid"]) ?? [];
    a.push(ref(m, c["k"], c["cid"], "key"));
    cand.set(c["rid"], a);
  }
  const rels = db
    .query(
      `SELECT id, relationship_key key, relationship_type type, evidence_state st, extraction_method meth, source_kind sk, source_id si, target_kind tk, target_id ti FROM relationships WHERE snapshot_id=?`,
    )
    .all(snapshotId) as Row[];
  for (const r of rels)
    lines.push(
      `rel|${r["key"]}|${r["type"]}|${r["st"]}|${r["meth"]}|${ref(m, r["sk"], r["si"], "key")}|${ref(m, r["tk"], r["ti"], "key")}|${(cand.get(r["id"]) ?? []).sort().join(",")}`,
    );
  lines.sort();
  const hash = createHash("sha256").update(lines.join("\n")).digest("hex");
  const relLines = lines.filter((l) => l.startsWith("rel|"));
  return {
    lines,
    hash,
    relHash: createHash("sha256").update(relLines.join("\n")).digest("hex"),
    counts: {
      symbols: m.syms.size,
      files: m.files.size,
      dirs: m.dirs.size,
      relationships: rels.length,
      candidates: [...cand.values()].reduce((a, b) => a + b.length, 0),
    },
  };
}

/** Human-readable relationship list (no keys) for hand-checked comparison (M-L0). */
export function describeRelationships(
  db: Database,
  snapshotId: number,
): string[] {
  const m = maps(db, snapshotId);
  const cand = new Map<number, string[]>();
  for (const c of db
    .query(
      `SELECT c.relationship_id rid, c.candidate_kind k, c.candidate_id cid FROM relationship_candidates c JOIN relationships r ON r.id=c.relationship_id WHERE r.snapshot_id=?`,
    )
    .all(snapshotId) as Row[]) {
    const a = cand.get(c["rid"]) ?? [];
    a.push(ref(m, c["k"], c["cid"], "desc"));
    cand.set(c["rid"], a);
  }
  return (
    db
      .query(
        `SELECT id, relationship_type type, evidence_state st, source_kind sk, source_id si, target_kind tk, target_id ti, evidence_start_line sl FROM relationships WHERE snapshot_id=?`,
      )
      .all(snapshotId) as Row[]
  )
    .map(
      (r) =>
        `${r["type"]} ${ref(m, r["sk"], r["si"], "desc")} -> ${ref(m, r["tk"], r["ti"], "desc")} [${r["st"]}]${cand.has(r["id"]) ? " cands=" + cand.get(r["id"])!.sort().join("|") : ""}`,
    )
    .sort();
}

/** Referential/consistency invariants (SQLite persistence correctness). Returns violations (empty = OK). */
export function checkInvariants(db: Database, snapshotId: number): string[] {
  const v: string[] = [];
  const one = (sql: string, ...a: unknown[]) =>
    db.query(sql).get(...(a as never[])) as Row;
  const ic = db.query("PRAGMA integrity_check").all() as Row[];
  if (ic.length !== 1 || ic[0]!["integrity_check"] !== "ok")
    v.push(`integrity_check: ${JSON.stringify(ic).slice(0, 200)}`);
  const fk = db.query("PRAGMA foreign_key_check").all();
  if (fk.length) v.push(`foreign_key_check: ${fk.length} violations`);
  const chk = (label: string, sql: string) => {
    const n = one(sql, snapshotId)["n"] as number;
    if (n) v.push(`${label}: ${n}`);
  };
  chk(
    "dangling source symbol",
    `SELECT COUNT(*) n FROM relationships r WHERE r.snapshot_id=? AND r.source_kind='symbol' AND NOT EXISTS (SELECT 1 FROM symbols s WHERE s.id=r.source_id)`,
  );
  chk(
    "dangling source file",
    `SELECT COUNT(*) n FROM relationships r WHERE r.snapshot_id=? AND r.source_kind='file' AND NOT EXISTS (SELECT 1 FROM file_extractions s WHERE s.id=r.source_id)`,
  );
  chk(
    "dangling source dir",
    `SELECT COUNT(*) n FROM relationships r WHERE r.snapshot_id=? AND r.source_kind='directory' AND NOT EXISTS (SELECT 1 FROM directories s WHERE s.id=r.source_id)`,
  );
  chk(
    "dangling target symbol",
    `SELECT COUNT(*) n FROM relationships r WHERE r.snapshot_id=? AND r.target_kind='symbol' AND NOT EXISTS (SELECT 1 FROM symbols s WHERE s.id=r.target_id)`,
  );
  chk(
    "dangling target file",
    `SELECT COUNT(*) n FROM relationships r WHERE r.snapshot_id=? AND r.target_kind='file' AND NOT EXISTS (SELECT 1 FROM file_extractions s WHERE s.id=r.target_id)`,
  );
  chk(
    "dangling target dir",
    `SELECT COUNT(*) n FROM relationships r WHERE r.snapshot_id=? AND r.target_kind='directory' AND NOT EXISTS (SELECT 1 FROM directories s WHERE s.id=r.target_id)`,
  );
  chk(
    "AMBIGUOUS/UNKNOWN with target",
    `SELECT COUNT(*) n FROM relationships WHERE snapshot_id=? AND evidence_state IN ('AMBIGUOUS','UNKNOWN') AND target_id IS NOT NULL`,
  );
  chk(
    "RESOLVED/EXTRACTED without target",
    `SELECT COUNT(*) n FROM relationships WHERE snapshot_id=? AND evidence_state IN ('RESOLVED','EXTRACTED') AND target_id IS NULL`,
  );
  chk(
    "candidates on non-AMBIGUOUS",
    `SELECT COUNT(*) n FROM relationship_candidates c JOIN relationships r ON r.id=c.relationship_id WHERE r.snapshot_id=? AND r.evidence_state<>'AMBIGUOUS'`,
  );
  chk(
    "AMBIGUOUS without candidates",
    `SELECT COUNT(*) n FROM relationships r WHERE r.snapshot_id=? AND r.evidence_state='AMBIGUOUS' AND NOT EXISTS (SELECT 1 FROM relationship_candidates c WHERE c.relationship_id=r.id)`,
  );
  chk(
    "AMBIGUOUS with >20 candidates",
    `SELECT COUNT(*) n FROM (SELECT relationship_id FROM relationship_candidates c JOIN relationships r ON r.id=c.relationship_id WHERE r.snapshot_id=? GROUP BY relationship_id HAVING COUNT(*)>20)`,
  );
  chk(
    "duplicate symbol_key",
    `SELECT COUNT(*) n FROM (SELECT symbol_key FROM symbols WHERE snapshot_id=? GROUP BY symbol_key HAVING COUNT(*)>1)`,
  );
  chk(
    "target of wrong kind for its relationship type",
    `SELECT COUNT(*) n FROM relationships r LEFT JOIN symbols t ON r.target_kind='symbol' AND t.id=r.target_id WHERE r.snapshot_id=? AND r.evidence_state='RESOLVED' AND ((r.relationship_type='CALLS' AND (r.target_kind<>'symbol' OR t.kind NOT IN ('function','method'))) OR (r.relationship_type IN ('EXTENDS','IMPLEMENTS') AND (r.target_kind<>'symbol' OR t.kind NOT IN ('class','interface'))) OR (r.relationship_type='IMPORTS' AND r.target_kind<>'file') OR (r.relationship_type='EXPORTS' AND r.target_kind<>'symbol'))`,
  );
  chk(
    "RESOLVED symbol target in a different language family than its evidence file",
    `SELECT COUNT(*) n FROM relationships r JOIN file_extractions ev ON ev.id=r.evidence_file_extraction_id JOIN symbols t ON r.target_kind='symbol' AND t.id=r.target_id JOIN file_extractions tf ON tf.id=t.file_extraction_id WHERE r.snapshot_id=? AND r.relationship_type IN ('CALLS','EXTENDS','IMPLEMENTS') AND ((ev.language='java') <> (tf.language='java'))`,
  );
  chk(
    "AMBIGUOUS with fewer than 2 candidates",
    `SELECT COUNT(*) n FROM (SELECT r.id FROM relationships r LEFT JOIN relationship_candidates c ON c.relationship_id=r.id WHERE r.snapshot_id=? AND r.evidence_state='AMBIGUOUS' GROUP BY r.id HAVING COUNT(c.id)<2)`,
  );
  chk(
    "dangling relationship candidate",
    `SELECT COUNT(*) n FROM relationship_candidates c JOIN relationships r ON r.id=c.relationship_id WHERE r.snapshot_id=? AND ((c.candidate_kind='symbol' AND NOT EXISTS (SELECT 1 FROM symbols s WHERE s.id=c.candidate_id)) OR (c.candidate_kind='file' AND NOT EXISTS (SELECT 1 FROM file_extractions f WHERE f.id=c.candidate_id)))`,
  );
  chk(
    "orphan directory (parent_path has no directory row)",
    `SELECT COUNT(*) n FROM directories d WHERE d.snapshot_id=? AND d.parent_path IS NOT NULL AND NOT EXISTS (SELECT 1 FROM directories p WHERE p.snapshot_id=d.snapshot_id AND p.path=d.parent_path)`,
  );
  chk(
    "CONTAINS with a state other than EXTRACTED",
    `SELECT COUNT(*) n FROM relationships WHERE snapshot_id=? AND relationship_type='CONTAINS' AND evidence_state<>'EXTRACTED'`,
  );
  chk(
    "file_extractions without snapshot file",
    `SELECT COUNT(*) n FROM file_extractions fe WHERE fe.snapshot_id=? AND NOT EXISTS (SELECT 1 FROM snapshot_files sf WHERE sf.id=fe.snapshot_file_id)`,
  );
  return v;
}

/** Final-state completeness (NOT valid mid-run / after a kill): every symbol has exactly one CONTAINS parent, every non-root file/dir has a CONTAINS parent. */
export function checkCompleteness(db: Database, snapshotId: number): string[] {
  const v: string[] = [];
  const n = (sql: string) => (db.query(sql).get(snapshotId) as { n: number }).n;
  const noParent = n(
    `SELECT COUNT(*) n FROM symbols s WHERE s.snapshot_id=?1 AND (SELECT COUNT(*) FROM relationships r WHERE r.snapshot_id=?1 AND r.relationship_type='CONTAINS' AND r.target_kind='symbol' AND r.target_id=s.id)<>1`,
  );
  if (noParent)
    v.push(`symbols without exactly one CONTAINS parent: ${noParent}`);
  const fileNoParent = n(
    `SELECT COUNT(*) n FROM file_extractions fe WHERE fe.snapshot_id=?1 AND (SELECT COUNT(*) FROM relationships r WHERE r.snapshot_id=?1 AND r.relationship_type='CONTAINS' AND r.target_kind='file' AND r.target_id=fe.id)<>1`,
  );
  if (fileNoParent)
    v.push(`files without exactly one CONTAINS parent: ${fileNoParent}`);
  const dirNoParent = n(
    `SELECT COUNT(*) n FROM directories d WHERE d.snapshot_id=?1 AND d.parent_path IS NOT NULL AND (SELECT COUNT(*) FROM relationships r WHERE r.snapshot_id=?1 AND r.relationship_type='CONTAINS' AND r.target_kind='directory' AND r.target_id=d.id)<>1`,
  );
  if (dirNoParent)
    v.push(`directories without exactly one CONTAINS parent: ${dirNoParent}`);
  return v;
}
