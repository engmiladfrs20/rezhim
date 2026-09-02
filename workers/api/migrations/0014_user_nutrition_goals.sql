CREATE TABLE IF NOT EXISTS user_nutrition_goals (
  user_id TEXT PRIMARY KEY,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  age INTEGER NOT NULL CHECK (age BETWEEN 19 AND 120),
  height_cm REAL NOT NULL CHECK (height_cm BETWEEN 50 AND 260),
  weight_kg REAL NOT NULL CHECK (weight_kg BETWEEN 20 AND 350),
  body_fat_percentage REAL CHECK (body_fat_percentage IS NULL OR body_fat_percentage BETWEEN 1 AND 70),
  life_stage TEXT NOT NULL DEFAULT 'adult_non_pregnant_non_lactating',
  activity_level TEXT NOT NULL CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active')),
  diet_goal TEXT NOT NULL CHECK (diet_goal IN ('weight_loss_aggressive', 'weight_loss_mild', 'maintenance', 'muscle_gain_mild', 'muscle_gain_aggressive')),
  formula TEXT NOT NULL CHECK (formula IN ('mifflin_st_jeor', 'harris_benedict', 'katch_mcardle')),
  meals_per_day INTEGER NOT NULL DEFAULT 4 CHECK (meals_per_day BETWEEN 3 AND 6),
  dietary_preferences TEXT NOT NULL DEFAULT '[]',
  allergies TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
