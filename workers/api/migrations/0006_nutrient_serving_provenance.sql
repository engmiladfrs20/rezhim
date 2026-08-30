-- Migration: 0006_nutrient_serving_provenance
-- Granular Nutrient and Serving Level Provenance Tracking

-- 1. Add provenance columns to food_nutrients
ALTER TABLE food_nutrients ADD COLUMN source_id TEXT REFERENCES food_sources(id);
ALTER TABLE food_nutrients ADD COLUMN external_id TEXT;
ALTER TABLE food_nutrients ADD COLUMN source_url TEXT;
ALTER TABLE food_nutrients ADD COLUMN citation TEXT;
ALTER TABLE food_nutrients ADD COLUMN dataset_version TEXT;
ALTER TABLE food_nutrients ADD COLUMN method TEXT;
ALTER TABLE food_nutrients ADD COLUMN retrieved_at TEXT;
ALTER TABLE food_nutrients ADD COLUMN license TEXT;

-- 2. Add provenance columns to food_servings
ALTER TABLE food_servings ADD COLUMN source_id TEXT REFERENCES food_sources(id);
ALTER TABLE food_servings ADD COLUMN external_id TEXT;
ALTER TABLE food_servings ADD COLUMN source_url TEXT;
ALTER TABLE food_servings ADD COLUMN citation TEXT;
ALTER TABLE food_servings ADD COLUMN dataset_version TEXT;
ALTER TABLE food_servings ADD COLUMN method TEXT;
ALTER TABLE food_servings ADD COLUMN retrieved_at TEXT;
ALTER TABLE food_servings ADD COLUMN license TEXT;

-- 3. Traditional Iranian Culinary Categories Seed
INSERT OR IGNORE INTO food_categories (id, slug, parent_id, status, created_at, updated_at) VALUES
('cat_stews', 'traditional-stews-khoresh', NULL, 'active', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z'),
('cat_soups', 'traditional-soups-ash', NULL, 'active', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z'),
('cat_sweets', 'traditional-sweets-desserts', NULL, 'active', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z');

INSERT OR IGNORE INTO food_category_translations (id, category_id, locale, name, description, created_at, updated_at) VALUES
('cat_trans_stews_fa', 'cat_stews', 'fa', 'خورش‌ها و خوراک‌های سنتی', 'قورمه‌سبزی، قیمه، فسنجان، مسما و انواع خورش‌های اصیل ایرانی', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z'),
('cat_trans_stews_en', 'cat_stews', 'en', 'Traditional Stews (Khoresh)', 'Classic Iranian slow-cooked stews and braises', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z'),
('cat_trans_soups_fa', 'cat_soups', 'fa', 'آش‌ها و سوپ‌های سنتی', 'آش رشته، آش جو، آش دوغ و سوپ‌های سنتی ایرانی', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z'),
('cat_trans_soups_en', 'cat_soups', 'en', 'Traditional Soups & Ash', 'Thick herb, legume and noodle soups (Ash)', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z'),
('cat_trans_sweets_fa', 'cat_sweets', 'fa', 'شیرینی‌ها و دسرهای سنتی', 'حلوا، شله‌زرد، رنگینک، مسقطی و باقلوا', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z'),
('cat_trans_sweets_en', 'cat_sweets', 'en', 'Traditional Sweets & Desserts', 'Traditional Persian confectioneries, halva, and puddings', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z');

-- 4. Update system metadata schema_version
UPDATE system_metadata SET value = '0006_nutrient_serving_provenance', updated_at = '2026-08-30T00:00:00.000Z' WHERE key = 'schema_version';

