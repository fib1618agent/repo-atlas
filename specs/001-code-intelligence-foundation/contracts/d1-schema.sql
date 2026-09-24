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
