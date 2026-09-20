-- AST + Symbol Intelligence — additive D1 schema.
-- Appended to data/code-intel-schema.sql (Feature 001's shared Code Intelligence
-- schema file), never a new schema file. No existing table is altered.
-- Read-only with respect to repositories/snapshots/snapshot_files (Feature 001).

CREATE TABLE IF NOT EXISTS directories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  parent_path TEXT,
  UNIQUE (snapshot_id, path)
);

CREATE TABLE IF NOT EXISTS file_extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  snapshot_file_id INTEGER NOT NULL REFERENCES snapshot_files(id) ON DELETE CASCADE,
  directory_path TEXT NOT NULL,
  language TEXT,
  status TEXT NOT NULL CHECK (status IN ('extracted', 'skipped_unsupported', 'failed')),
  failure_reason TEXT,
  extractor_version TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (snapshot_id, snapshot_file_id)
);

CREATE INDEX IF NOT EXISTS idx_file_extractions_snapshot_status
  ON file_extractions (snapshot_id, status);

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_extraction_id INTEGER NOT NULL REFERENCES file_extractions(id) ON DELETE CASCADE,
  snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('module', 'class', 'interface', 'function', 'method')),
  name TEXT NOT NULL,
  qualified_name TEXT,
  start_line INTEGER NOT NULL,
  start_column INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  end_column INTEGER NOT NULL,
  parent_symbol_id INTEGER REFERENCES symbols(id) ON DELETE CASCADE,
  is_exported INTEGER CHECK (is_exported IN (0, 1)),
  symbol_key TEXT NOT NULL,
  evidence_state TEXT NOT NULL DEFAULT 'EXTRACTED' CHECK (evidence_state = 'EXTRACTED'),
  extractor_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (file_extraction_id, symbol_key)
);

CREATE INDEX IF NOT EXISTS idx_symbols_snapshot_kind
  ON symbols (snapshot_id, kind);

CREATE INDEX IF NOT EXISTS idx_symbols_file_extraction
  ON symbols (file_extraction_id);

CREATE INDEX IF NOT EXISTS idx_symbols_parent
  ON symbols (parent_symbol_id);

CREATE TABLE IF NOT EXISTS extraction_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  unit_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'retrying', 'failed', 'completed')),
  checkpoint_cursor TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  files_processed INTEGER NOT NULL DEFAULT 0,
  symbols_extracted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (snapshot_id, unit_index)
);

CREATE TABLE IF NOT EXISTS snapshot_extractions (
  snapshot_id INTEGER PRIMARY KEY REFERENCES snapshots(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'completed_partial', 'failed')),
  extractor_version TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT
);
