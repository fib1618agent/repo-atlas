-- Code Intelligence Foundation — D1 schema
-- Fully separate from data/schema.sql (existing atlas cache). No shared table, no cross-FK.
-- Applies to: sdd/01-foundation + sdd/02-source-snapshot scope only. No graph/AST tables.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (provider, owner, name)
);

CREATE TABLE IF NOT EXISTS repository_refs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  ref TEXT NOT NULL,
  resolved_commit_sha TEXT NOT NULL,
  resolved_at TEXT NOT NULL,
  UNIQUE (repository_id, ref)
);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  acquisition_mode TEXT NOT NULL CHECK (acquisition_mode IN ('bulk_archive', 'incremental_api')),
  provider_endpoint TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (repository_id, commit_sha, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_repository_recency
  ON snapshots (repository_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS snapshot_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  UNIQUE (snapshot_id, path)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_files_content_hash
  ON snapshot_files (content_hash);

CREATE TABLE IF NOT EXISTS acquisition_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  unit_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'retrying', 'failed', 'completed')),
  checkpoint_cursor TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  files_processed INTEGER NOT NULL DEFAULT 0,
  bytes_processed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (snapshot_id, unit_index)
);

CREATE TABLE IF NOT EXISTS acquisition_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  provider TEXT NOT NULL,
  acquisition_mode TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,
  duration_ms INTEGER
);

-- AST + Symbol Intelligence (specs/002-ast-symbol-intelligence) — additive.
-- Appended verbatim from contracts/d1-schema-additions.sql (T004). No
-- existing statement above this point is altered.
-- Read-only with respect to repositories/snapshots/snapshot_files above.

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
