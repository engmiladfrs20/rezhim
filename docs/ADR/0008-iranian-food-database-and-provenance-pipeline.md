# 0008: Iranian Food Database, Provenance Pipeline, and License Boundary Management

## Status

Accepted (Phase 5)

## Context

Phase 5 introduces the authentic baseline dataset of traditional Iranian foods and an automated, idempotent data ingestion pipeline with provenance tracking and strict license compliance.

Key architectural requirements:

- Provide an authentic, laboratory-grade baseline of Iranian breads, grains, dairy, legumes, meats, fruits, vegetables, and beverages.
- Establish an immutable provenance trail: publisher metadata, license classification, RFC3339 acquisition timestamp, and cryptographic SHA-256 integrity checksums.
- Enforce strict license boundary management: only commit open-license data (CC0-1.0 / Open Government / Public Domain) to git. For proprietary sources (such as national Iranian Food Composition Tables from NNFTRI), provide a typed ingestion adapter template for authorized local environments without committing proprietary raw databases.
- Prevent unscientific nutrient fabrication: composite dishes with variable culinary preparation must remain in `draft` status without guessing laboratory values.
- Persian typography normalization: standardize Arabic/Persian letter variants (ي/ي -> ی, ك -> ک), digits (۰-۹ / ٠-٩ -> 0-9), diacritics (اعراب), and zero-width non-joiners (ZWNJ) for semantic collision detection and UI rendering.
- Idempotent and atomic D1 ingestion: ensure multi-item batch ingestion can be executed repeatedly with zero duplicates created, accurate counts (`inserted`, `updated`, `unchanged`), atomic rollback on failure, and complete audit logging (`food_import_logs`).

## Decision

1. **Typed Source Manifest Architecture**:
   - Every dataset source contains a typed manifest (`source-manifest.json`) validated via Zod (`foodSourceManifestSchema`).
   - Fields: `id` (`src_<name>`), `name`, `code`, `publisher`, `url`, `version`, `acquisitionDate` (RFC3339 UTC), `license`, `redistributionAllowed` (boolean), `sha256Checksum` (64 hex characters), `language`, and `description`.
   - Datasets are rejected during ingestion if the file SHA-256 hash does not match the manifest checksum, or if `redistributionAllowed === false` in public/direct environments.

2. **Curated Open Iranian Foods Baseline**:
   - Location: `data/sources/open-iranian-foods/`.
   - Authentic items covering all core food groups: traditional breads (_Sangak_, _Barbari_, _Taftoon_, _Lavash_, _Barley Bread_), cooked rice (_Kateh_, _Chelow_), dairy (_Full-fat Yogurt_, _Strained Labneh_, _Kashk_, _Doogh_, _Tabriz Cheese_), legumes & nuts (_Lentils_, _Chickpeas_, _Pinto Beans_, _Walnuts_, _Pistachios_, _Almonds_), meats (_Joojeh Kebab_, _Koobideh Kebab_, _Grilled Trout_, _White Fish_), fresh fruits & vegetables (_Pomegranate_, _Mazafati Dates_, _Sabzi Khordan_, _Grilled Tomato_, _Smoked Eggplant_), and beverages (_Brewed Black Tea_, _Saffron Sharbat_, _Mint Distillate_, _Borage Infusion_).
   - Authentic household serving portions with positive weights (e.g. "۱ کف دست", "۱ استکان", "۱ سیخ", "۱ کاسه").
   - Composite traditional dishes (_Ghormeh Sabzi_, _Gheimeh_, _Fesenjan_, _Ash Reshteh_) are marked with `status: 'draft'` to prevent unscientific nutrient guessing.

3. **Persian Typography Normalization**:
   - `packages/localization` exports `normalizePersianText` and `normalizePersianForComparison`.
   - `normalizePersianText`: Replaces Arabic Yeh and Kaf, standardizes Teh Marbuta, converts Eastern Arabic and Persian numerals to ASCII digits, strips diacritics (اعراب), and standardizes ZWNJ (`\u200C`).
   - `normalizePersianForComparison`: Strips punctuation and unifies ZWNJ with spaces to detect semantic collisions (e.g., matching `قورمه‌سبزی سنتی` with `قورمه سبزي سنّتي`).

4. **Idempotent Ingestion Engine & CLI Pipeline**:
   - `FoodImporterService` in `workers/api/src/services/food-importer.service.ts` supports three operational modes: `validate`, `dry-run`, and `import`.
   - Ingestion is keyed on unique `(source_id, external_id)` pairs. Re-running imports checks existing data across translations, aliases, nutrients, and servings to increment `unchangedCount` without creating duplicate records.
   - Any schema validation error, negative nutrient amount, zero serving weight, invalid invariant, or alias collision triggers an atomic transaction abort with zero partial records inserted.
   - Ingestion runs are logged in `food_import_logs` with status, counts, and checksum.
   - CLI commands: `pnpm data:validate` and `pnpm data:dry-run` via `scripts/data-pipeline.mjs`, integrated into CI workflow.

5. **API Compatibility & Public Filtering**:
   - Public consumer endpoints (`GET /api/v1/foods`) filter strictly on `status = 'active'`, serving verified catalog items in Persian (`fa`) and English (`en`) with `resolvedLocale` indicators.
   - Administrative endpoints (`GET /api/v1/admin/foods?status=draft`) allow searching and managing draft composite dishes.

## Consequences

- Complete provenance and licensing transparency for all nutritional data in NutriAI Persia.
- High-quality, culturally authentic Iranian traditional food catalog available immediately in Persian and English.
- Safe, reproducible pipeline for ingesting future food composition datasets.
- No unauthenticated or public import endpoints exposed to unauthorized actors.
