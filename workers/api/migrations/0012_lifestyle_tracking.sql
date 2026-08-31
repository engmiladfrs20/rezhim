-- Migration: 0012_lifestyle_tracking
-- Water, fasting, and daily habit tracking for authenticated users.

CREATE TABLE IF NOT EXISTS water_intakes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_ml INTEGER NOT NULL CHECK (amount_ml > 0 AND amount_ml <= 10000),
  consumed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_water_intakes_user_consumed
  ON water_intakes(user_id, consumed_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS fasting_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  goal_hours REAL NOT NULL CHECK (goal_hours >= 1 AND goal_hours <= 168),
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fasting_one_active_per_user
  ON fasting_sessions(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_fasting_sessions_user_started
  ON fasting_sessions(user_id, started_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_key TEXT NOT NULL CHECK (length(habit_key) BETWEEN 2 AND 64),
  occurred_on TEXT NOT NULL,
  completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, habit_key, occurred_on)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date
  ON habit_logs(user_id, occurred_on DESC, habit_key ASC);

UPDATE system_metadata
SET value = '0012_lifestyle_tracking', updated_at = '2026-09-01T00:00:00.000Z'
WHERE key = 'schema_version';
