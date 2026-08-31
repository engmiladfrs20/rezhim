-- Migration: 0010_pantry_shopping_list
-- User-owned pantry/fridge inventory and shopping list.

CREATE TABLE IF NOT EXISTS pantry_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id TEXT NOT NULL REFERENCES foods(id),
  location TEXT NOT NULL CHECK (location IN ('pantry', 'fridge', 'freezer')),
  quantity_grams REAL NOT NULL CHECK (quantity_grams > 0 AND quantity_grams = quantity_grams),
  expires_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_user_location
  ON pantry_items(user_id, location, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pantry_items_user_food
  ON pantry_items(user_id, food_id);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id TEXT NOT NULL REFERENCES foods(id),
  required_grams REAL NOT NULL CHECK (required_grams > 0 AND required_grams = required_grams),
  purchased_grams REAL NOT NULL DEFAULT 0 CHECK (purchased_grams >= 0 AND purchased_grams = purchased_grams),
  status TEXT NOT NULL CHECK (status IN ('planned', 'purchased')) DEFAULT 'planned',
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_user_status
  ON shopping_list_items(user_id, status, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_shopping_list_user_food
  ON shopping_list_items(user_id, food_id);

UPDATE system_metadata
SET value = '0010_pantry_shopping_list', updated_at = '2026-09-01T00:00:00.000Z'
WHERE key = 'schema_version';
