-- Migration: 0005_food_dataset_provenance
-- Provenance Tracking and Dataset Ingestion Audit Logs

CREATE TABLE IF NOT EXISTS food_import_logs (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES food_sources(id) ON DELETE CASCADE,
    dataset_name TEXT NOT NULL,
    file_checksum TEXT NOT NULL,
    total_records INTEGER NOT NULL,
    inserted_count INTEGER NOT NULL,
    updated_count INTEGER NOT NULL,
    unchanged_count INTEGER NOT NULL,
    skipped_count INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'dry_run')),
    error_summary TEXT,
    executed_by TEXT NOT NULL DEFAULT 'system',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_import_logs_source_id ON food_import_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_food_import_logs_created_at ON food_import_logs(created_at);

-- Standard Food Sources Seed for Open Baseline and Adapter
INSERT OR IGNORE INTO food_sources (id, name, code, description, url, license, acquisition_date, created_at, updated_at) VALUES
('src_open_iranian_foods', 'NutriAI Open Iranian Food Catalog Baseline', 'open_iranian_foods', 'Open baseline dataset of Iranian traditional foods, breads, and dishes curated from open laboratory food composition references and verified portion weights', 'https://github.com/engmiladfrs20/rezhim/tree/main/data/sources/open-iranian-foods', 'CC0-1.0', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z'),
('src_iranian_fct_adapter', 'Iranian Food Composition Tables (Adapter / Local Import Template)', 'iranian_fct_adapter', 'National Nutrition and Food Technology Research Institute (NNFTRI) Food Composition Tables adapter schema. Note: Proprietary raw database is NOT committed to git repository; template format is provided for licensed local ingestion.', 'https://github.com/engmiladfrs20/rezhim/tree/main/data/sources/iranian-fct-template', 'Proprietary - Official Publication (No Redistribution)', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z');

-- Traditional Iranian Culinary Categories Seed
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

-- Update system metadata schema_version
UPDATE system_metadata SET value = '0005_food_dataset_provenance', updated_at = '2026-08-30T00:00:00.000Z' WHERE key = 'schema_version';
