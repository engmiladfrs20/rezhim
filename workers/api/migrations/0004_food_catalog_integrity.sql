-- Migration: 0004_food_catalog_integrity
-- Normalize seed timestamps to strict RFC3339 UTC and enforce integrity constraints

-- 1. Normalize seed timestamps in nutrient_definitions to RFC3339 UTC
UPDATE nutrient_definitions
SET created_at = '2026-08-30T00:00:00.000Z',
    updated_at = '2026-08-30T00:00:00.000Z'
WHERE created_at NOT LIKE '%T%Z' OR created_at LIKE '% %';

-- 2. Normalize seed timestamps in food_sources to RFC3339 UTC
UPDATE food_sources
SET created_at = '2026-08-30T00:00:00.000Z',
    updated_at = '2026-08-30T00:00:00.000Z'
WHERE created_at NOT LIKE '%T%Z' OR created_at LIKE '% %';

-- 3. Normalize seed timestamps in food_categories to RFC3339 UTC
UPDATE food_categories
SET created_at = '2026-08-30T00:00:00.000Z',
    updated_at = '2026-08-30T00:00:00.000Z'
WHERE created_at NOT LIKE '%T%Z' OR created_at LIKE '% %';

-- 4. Normalize seed timestamps in food_category_translations to RFC3339 UTC
UPDATE food_category_translations
SET created_at = '2026-08-30T00:00:00.000Z',
    updated_at = '2026-08-30T00:00:00.000Z'
WHERE created_at NOT LIKE '%T%Z' OR created_at LIKE '% %';

-- 5. Normalize system_metadata timestamps
UPDATE system_metadata
SET value = '0004_food_catalog_integrity',
    updated_at = '2026-08-30T00:00:00.000Z'
WHERE key = 'schema_version';
