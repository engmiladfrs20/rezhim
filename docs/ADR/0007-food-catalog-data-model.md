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

4. **Provenance, Source Tracking and Barcode Normalization**:
   - `food_sources` records authoritative data origins (e.g., USDA FoodData Central, Iranian national food composition tables, admin entries) with licensing and acquisition timestamps.
   - `(source_id, external_id)` pairs are constrained by unique conditional indexes, preventing duplicate imports from external registries.
   - Barcodes are canonicalized: Arabic (`٠-٩`) and Persian (`۰-۹`) digits are converted to ASCII (`0-9`), separators (`\s\-_.]`) stripped, and validated as 8–18 digit numeric strings. Barcode uniqueness is enforced across active and draft foods.

5. **Soft Archive Lifecycle & Non-Destructive Admin Edit**:
   - Physical deletion is not permitted for foods in production.
   - A three-state status lifecycle (`draft`, `active`, `archived`) is enforced.
   - Public consumer endpoints (`/api/v1/foods`) filter strictly on `status = 'active'`, while administrative endpoints allow viewing and filtering across all lifecycle states.
   - Partial updates via `PATCH /api/v1/admin/foods/:id` preserve omitted relational arrays (`aliases`, `nutrients`, `servings`, `translations`) without deleting them.

6. **Secure Versioned Cursor Codec**:
   - Pagination uses versioned Base64URL encoded `v1:${created_at}:${id}` composite cursors capped at 512 characters.
   - The cursor decoder strictly validates RFC3339 timestamp formats. Malformed, invalid-version, or tampered cursors are rejected with HTTP 400 `INVALID_CURSOR`.

7. **Schema-Level Duplicate Pre-Checks & D1 Error Translation**:
   - Zod schemas reject duplicate locales in `translations`, duplicate `nutrient_id`s in `nutrients`, duplicate `(locale, alias)` in `aliases`, and duplicate serving names in `servings` before hitting D1.
   - Database constraint violations are safely translated into HTTP 409 `CONFLICT` or HTTP 400 `VALIDATION_ERROR` responses without leaking internal SQLite error traces.
   - Seed timestamps in migration `0004_food_catalog_integrity.sql` are normalized to strict RFC3339 UTC strings.

## Consequences

- Full referential integrity through foreign keys and composite unique constraints in D1.
- Clean separation between internal database representations and API responses (`FoodSummary`, `FoodDetail`, `FoodCategorySummary`).
- Strong foundation for future phases (fuzzy search, Persian NLP, nutrition calculator engine, dietary logging).
