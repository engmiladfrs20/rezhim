-- Phase 21: authenticated weight history for progress and trend views.

CREATE TABLE IF NOT EXISTS user_weight_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  weight_kg REAL NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 350 AND weight_kg = weight_kg),
  measured_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, measured_at),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_weight_entries_user_measured
  ON user_weight_entries(user_id, measured_at ASC, id ASC);

UPDATE system_metadata
SET value = '0011_progress_weight_trend', updated_at = '2026-09-01T00:00:00.000Z'
WHERE key = 'schema_version';
