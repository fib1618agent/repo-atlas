-- Engineering Relationship Graph (specs/004-engineering-relationship-graph) — additive.
-- Appended to data/code-intel-schema.sql. No existing statement is altered.
-- Read-only with respect to repositories/snapshots/snapshot_files/directories/
-- file_extractions/symbols/extraction_jobs/snapshot_extractions above.

CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'CONTAINS', 'IMPORTS', 'EXPORTS', 'CALLS', 'EXTENDS', 'IMPLEMENTS', 'USES', 'REFERENCES'
  )),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('directory', 'file', 'symbol')),
  source_id INTEGER NOT NULL,
  target_kind TEXT CHECK (target_kind IN ('directory', 'file', 'symbol')),
  target_id INTEGER,
  evidence_state TEXT NOT NULL CHECK (evidence_state IN (
    'EXTRACTED', 'RESOLVED', 'INFERRED', 'AMBIGUOUS', 'UNKNOWN'
  )),
  confidence REAL CHECK (
    (evidence_state = 'INFERRED' AND confidence IS NOT NULL)
    OR (evidence_state != 'INFERRED' AND confidence IS NULL)
  ),
  evidence_file_extraction_id INTEGER REFERENCES file_extractions(id) ON DELETE CASCADE,
  evidence_start_line INTEGER,
  evidence_start_column INTEGER,
  evidence_end_line INTEGER,
  evidence_end_column INTEGER,
  extraction_method TEXT NOT NULL,
  relationship_extractor_version TEXT NOT NULL,
  symbol_extractor_version TEXT NOT NULL,
  relationship_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (snapshot_id, relationship_key)
);

CREATE INDEX IF NOT EXISTS idx_relationships_snapshot_source
  ON relationships (snapshot_id, source_kind, source_id, relationship_type);

CREATE INDEX IF NOT EXISTS idx_relationships_snapshot_target
  ON relationships (snapshot_id, target_kind, target_id, relationship_type);

CREATE INDEX IF NOT EXISTS idx_relationships_evidence_file
  ON relationships (evidence_file_extraction_id);

CREATE TABLE IF NOT EXISTS relationship_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  relationship_id INTEGER NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  candidate_kind TEXT NOT NULL CHECK (candidate_kind IN ('symbol', 'file')),
  candidate_id INTEGER NOT NULL,
  UNIQUE (relationship_id, candidate_kind, candidate_id)
);

CREATE TABLE IF NOT EXISTS relationship_extraction_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  unit_index INTEGER NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('contains', 'parsed')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'retrying', 'failed', 'completed')),
  checkpoint_cursor TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  files_processed INTEGER NOT NULL DEFAULT 0,
  relationships_extracted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (snapshot_id, unit_index)
);

CREATE TABLE IF NOT EXISTS snapshot_relationship_extractions (
  snapshot_id INTEGER PRIMARY KEY REFERENCES snapshots(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'completed_partial', 'failed')),
  relationship_extractor_version TEXT NOT NULL,
  symbol_extractor_version TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT
);
