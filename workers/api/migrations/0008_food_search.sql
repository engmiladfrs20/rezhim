-- Migration: 0008_food_search
-- Canonical search material used by the bilingual food catalog search API.

ALTER TABLE food_translations ADD COLUMN search_text TEXT;
ALTER TABLE food_aliases ADD COLUMN search_text TEXT;

CREATE INDEX IF NOT EXISTS idx_food_translations_search_text
  ON food_translations(search_text);
CREATE INDEX IF NOT EXISTS idx_food_aliases_search_text
  ON food_aliases(search_text);

-- Backfill the common Arabic/Persian letter and digit variants for existing rows.
-- Runtime writes use the canonical @nutriai/localization implementation, while
-- this SQL keeps already-imported rows searchable after the migration.
UPDATE food_translations SET search_text = lower(name) WHERE search_text IS NULL;
UPDATE food_aliases SET search_text = lower(alias) WHERE search_text IS NULL;

-- Normalize Arabic/Persian letters, joiners, and all localized digits.
UPDATE food_translations SET search_text = replace(search_text, 'ي', 'ی');
UPDATE food_translations SET search_text = replace(search_text, 'ى', 'ی');
UPDATE food_translations SET search_text = replace(search_text, 'ك', 'ک');
UPDATE food_translations SET search_text = replace(search_text, 'ة', 'ه');
UPDATE food_translations SET search_text = replace(search_text, '‌', ' ');
UPDATE food_aliases SET search_text = replace(search_text, 'ي', 'ی');
UPDATE food_aliases SET search_text = replace(search_text, 'ى', 'ی');
UPDATE food_aliases SET search_text = replace(search_text, 'ك', 'ک');
UPDATE food_aliases SET search_text = replace(search_text, 'ة', 'ه');
UPDATE food_aliases SET search_text = replace(search_text, '‌', ' ');

UPDATE food_translations SET search_text = replace(search_text, '۰', '0');
UPDATE food_translations SET search_text = replace(search_text, '۱', '1');
UPDATE food_translations SET search_text = replace(search_text, '۲', '2');
UPDATE food_translations SET search_text = replace(search_text, '۳', '3');
UPDATE food_translations SET search_text = replace(search_text, '۴', '4');
UPDATE food_translations SET search_text = replace(search_text, '۵', '5');
UPDATE food_translations SET search_text = replace(search_text, '۶', '6');
UPDATE food_translations SET search_text = replace(search_text, '۷', '7');
UPDATE food_translations SET search_text = replace(search_text, '۸', '8');
UPDATE food_translations SET search_text = replace(search_text, '۹', '9');
UPDATE food_translations SET search_text = replace(search_text, '٠', '0');
UPDATE food_translations SET search_text = replace(search_text, '١', '1');
UPDATE food_translations SET search_text = replace(search_text, '٢', '2');
UPDATE food_translations SET search_text = replace(search_text, '٣', '3');
UPDATE food_translations SET search_text = replace(search_text, '٤', '4');
UPDATE food_translations SET search_text = replace(search_text, '٥', '5');
UPDATE food_translations SET search_text = replace(search_text, '٦', '6');
UPDATE food_translations SET search_text = replace(search_text, '٧', '7');
UPDATE food_translations SET search_text = replace(search_text, '٨', '8');
UPDATE food_translations SET search_text = replace(search_text, '٩', '9');
UPDATE food_aliases SET search_text = replace(search_text, '۰', '0');
UPDATE food_aliases SET search_text = replace(search_text, '۱', '1');
UPDATE food_aliases SET search_text = replace(search_text, '۲', '2');
UPDATE food_aliases SET search_text = replace(search_text, '۳', '3');
UPDATE food_aliases SET search_text = replace(search_text, '۴', '4');
UPDATE food_aliases SET search_text = replace(search_text, '۵', '5');
UPDATE food_aliases SET search_text = replace(search_text, '۶', '6');
UPDATE food_aliases SET search_text = replace(search_text, '۷', '7');
UPDATE food_aliases SET search_text = replace(search_text, '۸', '8');
UPDATE food_aliases SET search_text = replace(search_text, '۹', '9');
UPDATE food_aliases SET search_text = replace(search_text, '٠', '0');
UPDATE food_aliases SET search_text = replace(search_text, '١', '1');
UPDATE food_aliases SET search_text = replace(search_text, '٢', '2');
UPDATE food_aliases SET search_text = replace(search_text, '٣', '3');
UPDATE food_aliases SET search_text = replace(search_text, '٤', '4');
UPDATE food_aliases SET search_text = replace(search_text, '٥', '5');
UPDATE food_aliases SET search_text = replace(search_text, '٦', '6');
UPDATE food_aliases SET search_text = replace(search_text, '٧', '7');
UPDATE food_aliases SET search_text = replace(search_text, '٨', '8');
UPDATE food_aliases SET search_text = replace(search_text, '٩', '9');

UPDATE system_metadata
SET value = '0008_food_search', updated_at = '2026-08-31T00:00:00.000Z'
WHERE key = 'schema_version';
