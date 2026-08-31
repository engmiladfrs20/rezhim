-- Migration: 0009_food_diary
-- User-owned food diary entries with immutable audit timestamps and safe portions.

CREATE TABLE IF NOT EXISTS food_diary_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id TEXT NOT NULL REFERENCES foods(id),
  serving_id TEXT REFERENCES food_servings(id),
  grams REAL,
  quantity REAL NOT NULL DEFAULT 1,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  consumed_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (grams IS NULL OR (grams > 0 AND grams = grams)),
  CHECK (quantity > 0 AND quantity = quantity),
  CHECK (grams IS NOT NULL OR serving_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_food_diary_user_consumed
  ON food_diary_entries(user_id, consumed_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_food_diary_user_food
  ON food_diary_entries(user_id, food_id);

UPDATE system_metadata
SET value = '0009_food_diary', updated_at = '2026-08-31T00:00:00.000Z'
WHERE key = 'schema_version';
