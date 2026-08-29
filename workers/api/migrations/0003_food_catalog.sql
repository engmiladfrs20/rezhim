-- Migration: 0003_food_catalog
-- Comprehensive Food Catalog Data Foundation

-- 1. Food Categories
CREATE TABLE IF NOT EXISTS food_categories (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    parent_id TEXT REFERENCES food_categories(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'archived')) DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_categories_parent_id ON food_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_food_categories_status ON food_categories(status);

-- 2. Food Category Translations
CREATE TABLE IF NOT EXISTS food_category_translations (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES food_categories(id) ON DELETE CASCADE,
    locale TEXT NOT NULL CHECK (locale IN ('fa', 'en')),
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(category_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_food_cat_trans_cat_id ON food_category_translations(category_id);
CREATE INDEX IF NOT EXISTS idx_food_cat_trans_locale ON food_category_translations(locale);

-- 3. Food Sources / Provenance
CREATE TABLE IF NOT EXISTS food_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    url TEXT,
    license TEXT,
    acquisition_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_sources_code ON food_sources(code);

-- 4. Nutrient Definitions
CREATE TABLE IF NOT EXISTS nutrient_definitions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name_fa TEXT NOT NULL,
    name_en TEXT NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('kcal', 'g', 'mg', 'mcg', 'IU')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_essential BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nutrient_definitions_code ON nutrient_definitions(code);
CREATE INDEX IF NOT EXISTS idx_nutrient_definitions_sort_order ON nutrient_definitions(sort_order);

-- 5. Foods Foundation
CREATE TABLE IF NOT EXISTS foods (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES food_categories(id) ON DELETE SET NULL,
    food_type TEXT NOT NULL CHECK (food_type IN ('generic', 'branded')) DEFAULT 'generic',
    brand_name TEXT,
    barcode TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')) DEFAULT 'active',
    source_id TEXT REFERENCES food_sources(id) ON DELETE SET NULL,
    external_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_barcode_unique ON foods(barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_source_external_unique ON foods(source_id, external_id) WHERE source_id IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_foods_category_id ON foods(category_id);
CREATE INDEX IF NOT EXISTS idx_foods_status ON foods(status);
CREATE INDEX IF NOT EXISTS idx_foods_created_at ON foods(created_at);

-- 6. Food Translations
CREATE TABLE IF NOT EXISTS food_translations (
    id TEXT PRIMARY KEY,
    food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    locale TEXT NOT NULL CHECK (locale IN ('fa', 'en')),
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(food_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_food_translations_food_id ON food_translations(food_id);
CREATE INDEX IF NOT EXISTS idx_food_translations_locale ON food_translations(locale);
CREATE INDEX IF NOT EXISTS idx_food_translations_name ON food_translations(name);

-- 7. Food Aliases
CREATE TABLE IF NOT EXISTS food_aliases (
    id TEXT PRIMARY KEY,
    food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    locale TEXT NOT NULL CHECK (locale IN ('fa', 'en')),
    alias TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(food_id, locale, alias)
);

CREATE INDEX IF NOT EXISTS idx_food_aliases_food_id ON food_aliases(food_id);
CREATE INDEX IF NOT EXISTS idx_food_aliases_alias ON food_aliases(alias);

-- 8. Food Nutrients (per 100g basis)
CREATE TABLE IF NOT EXISTS food_nutrients (
    id TEXT PRIMARY KEY,
    food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    nutrient_id TEXT NOT NULL REFERENCES nutrient_definitions(id) ON DELETE CASCADE,
    amount_per_100g REAL NOT NULL CHECK (amount_per_100g >= 0 AND amount_per_100g = amount_per_100g),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(food_id, nutrient_id)
);

CREATE INDEX IF NOT EXISTS idx_food_nutrients_food_id ON food_nutrients(food_id);
CREATE INDEX IF NOT EXISTS idx_food_nutrients_nutrient_id ON food_nutrients(nutrient_id);

-- 9. Food Servings
CREATE TABLE IF NOT EXISTS food_servings (
    id TEXT PRIMARY KEY,
    food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    name_fa TEXT NOT NULL,
    name_en TEXT NOT NULL,
    weight_g REAL NOT NULL CHECK (weight_g > 0 AND weight_g = weight_g),
    household_unit TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(food_id, name_fa, name_en)
);

CREATE INDEX IF NOT EXISTS idx_food_servings_food_id ON food_servings(food_id);

-- Standard Nutrient Definitions Seed
INSERT OR IGNORE INTO nutrient_definitions (id, code, name_fa, name_en, unit, sort_order, is_essential, created_at, updated_at) VALUES
('nut_energy', 'energy', 'انرژی', 'Energy', 'kcal', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_protein', 'protein', 'پروتئین', 'Protein', 'g', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_carbohydrate', 'carbohydrate', 'کربوهیدرات', 'Total Carbohydrates', 'g', 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_fat_total', 'fat_total', 'چربی کل', 'Total Fat', 'g', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_fiber', 'fiber', 'فیبر رژیمی', 'Dietary Fiber', 'g', 5, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_sugar', 'sugar', 'قند', 'Sugars', 'g', 6, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_sodium', 'sodium', 'سدیم', 'Sodium', 'mg', 7, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_potassium', 'potassium', 'پتاسیم', 'Potassium', 'mg', 8, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_calcium', 'calcium', 'کلسیم', 'Calcium', 'mg', 9, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_iron', 'iron', 'آهن', 'Iron', 'mg', 10, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_vitamin_a', 'vitamin_a', 'ویتامین آ', 'Vitamin A', 'mcg', 11, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_vitamin_c', 'vitamin_c', 'ویتامین سی', 'Vitamin C', 'mg', 12, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_fat_saturated', 'fat_saturated', 'چربی اشباع', 'Saturated Fat', 'g', 13, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_fat_trans', 'fat_trans', 'چربی ترانس', 'Trans Fat', 'g', 14, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nut_cholesterol', 'cholesterol', 'کلسترول', 'Cholesterol', 'mg', 15, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Standard Sources Seed
INSERT OR IGNORE INTO food_sources (id, name, code, description, url, license, acquisition_date, created_at, updated_at) VALUES
('src_usda_fdc', 'USDA FoodData Central', 'usda_fdc', 'Official U.S. Department of Agriculture food composition database', 'https://fdc.nal.usda.gov', 'Public Domain', '2026-08-29T00:00:00Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('src_manual_admin', 'Manual Entry', 'manual_entry', 'Direct manual entry by system administrators', NULL, 'Proprietary', '2026-08-29T00:00:00Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Standard Categories Seed
INSERT OR IGNORE INTO food_categories (id, slug, parent_id, status, created_at, updated_at) VALUES
('cat_grains', 'grains-cereals', NULL, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_dairy', 'dairy-eggs', NULL, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_meats', 'meat-poultry-fish', NULL, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_fruits', 'fruits', NULL, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_vegetables', 'vegetables', NULL, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_legumes', 'legumes-nuts-seeds', NULL, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_beverages', 'beverages', NULL, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO food_category_translations (id, category_id, locale, name, description, created_at, updated_at) VALUES
('cat_trans_grains_fa', 'cat_grains', 'fa', 'نان و غلات', 'انواع نان، برنج، ماکارونی و غلات', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_grains_en', 'cat_grains', 'en', 'Grains & Cereals', 'Breads, rice, pasta, and whole grains', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_dairy_fa', 'cat_dairy', 'fa', 'لبنیات و تخم‌مرغ', 'شیر، ماست، پنیر، کشک و تخم‌مرغ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_dairy_en', 'cat_dairy', 'en', 'Dairy & Eggs', 'Milk, yogurt, cheese, whey, and eggs', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_meats_fa', 'cat_meats', 'fa', 'گوشت، مرغ و ماهی', 'انواع گوشت قرمز، مرغ، بوقلمون، ماهی و میگو', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_meats_en', 'cat_meats', 'en', 'Meat, Poultry & Fish', 'Red meat, poultry, fish, and seafood', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_fruits_fa', 'cat_fruits', 'fa', 'میوه‌ها', 'انواع میوه‌های تازه و خشک', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_fruits_en', 'cat_fruits', 'en', 'Fruits', 'Fresh and dried fruits', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_vegetables_fa', 'cat_vegetables', 'fa', 'سبزیجات', 'انواع سبزیجات تازه، پخته و صیفی‌جات', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_vegetables_en', 'cat_vegetables', 'en', 'Vegetables', 'Fresh and cooked vegetables, leafy greens', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_legumes_fa', 'cat_legumes', 'fa', 'حبوبات و مغزها', 'عدس، نخود، لوبیا، بادام، گردو و دانه‌ها', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_legumes_en', 'cat_legumes', 'en', 'Legumes, Nuts & Seeds', 'Lentils, chickpeas, beans, nuts, and seeds', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_beverages_fa', 'cat_beverages', 'fa', 'نوشیدنی‌ها', 'آب، چای، قهوه، دمنوش و آبمیوه', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_trans_beverages_en', 'cat_beverages', 'en', 'Beverages', 'Water, tea, coffee, herbal infusions, and juices', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Update Phase 4 tracking record
UPDATE system_metadata SET value = '0003_food_catalog', updated_at = CURRENT_TIMESTAMP WHERE key = 'schema_version';
