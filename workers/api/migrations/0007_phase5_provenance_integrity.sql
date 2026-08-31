-- Migration: 0007_phase5_provenance_integrity
-- Keep trigger bodies free of nested CASE/END expressions. Wrangler's D1
-- migration parser recognises the outer BEGIN/END block, while the simple
-- SELECT RAISE statements preserve database-level fail-closed guards.

CREATE TRIGGER IF NOT EXISTS trg_food_nutrients_provenance_insert
BEFORE INSERT ON food_nutrients
FOR EACH ROW
WHEN NOT (
  (NEW.method IS NULL OR NEW.method IN ('laboratory', 'database', 'calculated', 'measured'))
  AND (NEW.retrieved_at IS NULL OR (length(NEW.retrieved_at) >= 20 AND substr(NEW.retrieved_at, -1, 1) = 'Z' AND julianday(NEW.retrieved_at) IS NOT NULL))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid nutrient provenance');
END;

CREATE TRIGGER IF NOT EXISTS trg_food_nutrients_provenance_update
BEFORE UPDATE OF method, retrieved_at ON food_nutrients
FOR EACH ROW
WHEN NOT (
  (NEW.method IS NULL OR NEW.method IN ('laboratory', 'database', 'calculated', 'measured'))
  AND (NEW.retrieved_at IS NULL OR (length(NEW.retrieved_at) >= 20 AND substr(NEW.retrieved_at, -1, 1) = 'Z' AND julianday(NEW.retrieved_at) IS NOT NULL))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid nutrient provenance');
END;

CREATE TRIGGER IF NOT EXISTS trg_food_servings_provenance_insert
BEFORE INSERT ON food_servings
FOR EACH ROW
WHEN NOT (
  (NEW.method IS NULL OR NEW.method IN ('laboratory', 'database', 'calculated', 'measured'))
  AND (NEW.retrieved_at IS NULL OR (length(NEW.retrieved_at) >= 20 AND substr(NEW.retrieved_at, -1, 1) = 'Z' AND julianday(NEW.retrieved_at) IS NOT NULL))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid serving provenance');
END;

CREATE TRIGGER IF NOT EXISTS trg_food_servings_provenance_update
BEFORE UPDATE OF method, retrieved_at ON food_servings
FOR EACH ROW
WHEN NOT (
  (NEW.method IS NULL OR NEW.method IN ('laboratory', 'database', 'calculated', 'measured'))
  AND (NEW.retrieved_at IS NULL OR (length(NEW.retrieved_at) >= 20 AND substr(NEW.retrieved_at, -1, 1) = 'Z' AND julianday(NEW.retrieved_at) IS NOT NULL))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid serving provenance');
END;

UPDATE system_metadata
SET value = '0007_phase5_provenance_integrity', updated_at = '2026-08-30T00:00:00.000Z'
WHERE key = 'schema_version';

UPDATE system_metadata
SET value = '0007_phase5_provenance_integrity', updated_at = '2026-08-30T00:00:00.000Z'
WHERE key = 'schema_version';
