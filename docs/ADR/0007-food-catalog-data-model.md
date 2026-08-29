# 0007: Food Catalog Data Model and Extensible Nutrition Foundation

## Status

Accepted (Phase 4)

## Context

Phase 4 establishes the food catalog data architecture for NutriAI Persia. The system requires a relational, type-safe, and extensible foundation for foods, nutrient profiles, hierarchical categories, multilingual translations (Persian and English), household serving sizes, and data provenance. The model must operate on Cloudflare D1 (SQLite-based serverless database) while enforcing integrity, preventing duplicate or corrupted records, and enabling predictable multi-page cursor pagination.

## Decision

1. **Normalized Multilingual Entity Model**:
   - Foods (`foods`) and Categories (`food_categories`) maintain language-agnostic core metadata (identifiers, types, barcodes, sources, statuses, timestamps).
   - Localized names and descriptions reside in dedicated translation tables (`food_translations`, `food_category_translations`) keyed on `(food_id, locale)` with explicit `fa` and `en` support.
   - Deterministic locale fallback: When a requested locale is unavailable, the repository falls back to Persian (`fa`), followed by the first available translation.
   - Aliases (`food_aliases`) provide secondary common names and colloquial terms per locale.

2. **100g Base Nutrient Normalization**:
   - All nutritional values in `food_nutrients` are strictly normalized per 100 grams of food.
   - Standard nutrient definitions (`nutrient_definitions`) define fixed codes (`energy`, `protein`, `carbohydrate`, `fat_total`, etc.), bilingual names, standard units (`kcal`, `g`, `mg`, `mcg`, `IU`), and display sort order.
   - Database check constraints (`CHECK (amount_per_100g >= 0 AND amount_per_100g = amount_per_100g)`) prevent negative values and `NaN` entries.

3. **Serving Sizes and Household Units**:
   - `food_servings` associates positive weight in grams (`CHECK (weight_g > 0 AND weight_g = weight_g)`) with bilingual labels (`name_fa`, `name_en`) and optional household units (e.g., "لیوان", "قاشق غذاخوری", "کف دست", "قرص", "slice", "cup").
   - This separates user portion estimation from mathematical nutrient calculations.

4. **Provenance and Source Tracking**:
   - `food_sources` records authoritative data origins (e.g., USDA FoodData Central, Iranian national food composition tables, admin entries) with licensing and acquisition timestamps.
   - `(source_id, external_id)` pairs are constrained by unique conditional indexes, preventing duplicate imports from external registries.
   - `barcode` values are normalized and uniqueness-enforced across all branded and packaged foods.

5. **Soft Archive Lifecycle**:
   - Physical deletion is not permitted for foods in production.
   - A three-state status lifecycle (`draft`, `active`, `archived`) is enforced.
   - Public consumer endpoints (`/api/v1/foods`) filter strictly on `status = 'active'`, while administrative endpoints allow viewing and filtering across all lifecycle states.

6. **Stable Cursor-Based Pagination**:
   - Pagination uses base64-encoded `(created_at, id)` composite cursors.
   - This guarantees stable deterministic traversal across pages under active catalog modifications without dropped or duplicated items.

## Consequences

- Full referential integrity through foreign keys and composite unique constraints in D1.
- Clean separation between internal database representations and API responses (`FoodSummary`, `FoodDetail`, `FoodCategorySummary`).
- Strong foundation for future phases (fuzzy search, Persian NLP, nutrition calculator engine, dietary logging).
