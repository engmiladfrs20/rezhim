-- Migration: 0007_phase5_provenance_integrity
-- Database-level guards for provenance values. Cross-table active-publication
-- requirements are enforced by the canonical schemas and FoodService.

CREATE TRIGGER IF NOT EXISTS trg_food_nutrients_provenance_insert
BEFORE INSERT ON food_nutrients
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NEW.method IS NOT NULL
      AND NEW.method NOT IN ('laboratory', 'database', 'calculated', 'measured')
    THEN RAISE(ABORT, 'invalid nutrient provenance method')
  END;
  SELECT CASE
    WHEN NEW.retrieved_at IS NOT NULL
      AND (length(NEW.retrieved_at) < 20 OR substr(NEW.retrieved_at, -1, 1) <> 'Z' OR julianday(NEW.retrieved_at) IS NULL)
    THEN RAISE(ABORT, 'invalid nutrient provenance timestamp')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_food_nutrients_provenance_update
BEFORE UPDATE OF method, retrieved_at ON food_nutrients
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NEW.method IS NOT NULL
      AND NEW.method NOT IN ('laboratory', 'database', 'calculated', 'measured')
    THEN RAISE(ABORT, 'invalid nutrient provenance method')
  END;
  SELECT CASE
    WHEN NEW.retrieved_at IS NOT NULL
      AND (length(NEW.retrieved_at) < 20 OR substr(NEW.retrieved_at, -1, 1) <> 'Z' OR julianday(NEW.retrieved_at) IS NULL)
    THEN RAISE(ABORT, 'invalid nutrient provenance timestamp')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_food_servings_provenance_insert
BEFORE INSERT ON food_servings
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NEW.method IS NOT NULL
      AND NEW.method NOT IN ('laboratory', 'database', 'calculated', 'measured')
    THEN RAISE(ABORT, 'invalid serving provenance method')
  END;
  SELECT CASE
    WHEN NEW.retrieved_at IS NOT NULL
      AND (length(NEW.retrieved_at) < 20 OR substr(NEW.retrieved_at, -1, 1) <> 'Z' OR julianday(NEW.retrieved_at) IS NULL)
    THEN RAISE(ABORT, 'invalid serving provenance timestamp')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_food_servings_provenance_update
BEFORE UPDATE OF method, retrieved_at ON food_servings
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NEW.method IS NOT NULL
      AND NEW.method NOT IN ('laboratory', 'database', 'calculated', 'measured')
    THEN RAISE(ABORT, 'invalid serving provenance method')
  END;
  SELECT CASE
    WHEN NEW.retrieved_at IS NOT NULL
      AND (length(NEW.retrieved_at) < 20 OR substr(NEW.retrieved_at, -1, 1) <> 'Z' OR julianday(NEW.retrieved_at) IS NULL)
    THEN RAISE(ABORT, 'invalid serving provenance timestamp')
  END;
END;

UPDATE system_metadata
SET value = '0007_phase5_provenance_integrity', updated_at = '2026-08-30T00:00:00.000Z'
WHERE key = 'schema_version';
