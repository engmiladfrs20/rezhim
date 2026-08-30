# 0008: Iranian Food Database, Granular Provenance Pipeline, and Dataset Atomicity

## Status

Accepted (Phase 5)

## Context

Phase 5 introduces a verified baseline dataset of traditional Iranian foods and an automated, idempotent data ingestion pipeline with granular nutrient and serving level provenance, true single-batch dataset atomicity, and strict license compliance.

Key architectural requirements:

- Provide an authentic baseline of Iranian food commodities referencing verified USDA FoodData Central records.
- Establish an immutable provenance trail: publisher metadata, license classification, RFC3339 acquisition timestamp, and cryptographic raw-bytes SHA-256 integrity checksums.
- Granular nutrient and serving provenance: link every nutrient and serving to external IDs (e.g. FDC ID), direct source URLs, citations, dataset versions, methods (`laboratory`, `database`, `calculated`), retrieval timestamps, and license terms.
- Enforce strict license boundary management: only commit open-license data (CC0-1.0 / Public Domain) to git. For proprietary sources (such as national Iranian Food Composition Tables from NNFTRI), provide a typed ingestion adapter template for authorized local environments without committing proprietary raw databases.
- Prevent unscientific nutrient fabrication: composite dishes with variable culinary preparation must remain in `draft` status without guessing laboratory values, and remain excluded from public consumer API queries.
- Persian typography normalization: standardize Arabic/Persian letter variants (ي/ى -> ی, ك -> ک), digits (۰-۹ / ٠-٩ -> 0-9), diacritics (اعراب), and zero-width non-joiners (ZWNJ) for semantic collision detection and UI rendering.
- Idempotent and single-batch atomic D1 ingestion: execute entire dataset imports in a single `db.batch([ ... ])` transaction with zero duplicates created, accurate counts (`inserted`, `updated`, `unchanged`), complete rollback on failure without SQLite error leakage, and audit logging (`food_import_logs`).

## Decision

1. **Typed Source Manifest Architecture**:
   - Every dataset source contains a typed manifest (`source-manifest.json`) validated via Zod (`foodSourceManifestSchema`).
   - Fields: `id` (`src_<name>`), `name`, `code`, `publisher`, `url`, `version`, `acquisitionDate` (RFC3339 UTC), `license`, `redistributionAllowed` (boolean), `sha256Checksum` (64 hex characters), `language`, and `description`.
   - Datasets are rejected during ingestion if the file raw bytes SHA-256 hash does not match the manifest checksum, or if `redistributionAllowed === false` in public/direct environments without explicit `--licensed-local` approval.

2. **Curated Open Iranian Foods Baseline & Rights Waiver**:
   - Location: `data/sources/open-iranian-foods/` with dedicated `LICENSE.md` waiver.
   - 10 active generic commodities (Cooked Lentils, Cooked Chickpeas, Raw Walnuts, Fresh Pomegranate, Brewed Black Tea, Whole Milk Yogurt, Fresh Sabzi Khordan herbs, Grilled Joojeh chicken, Grilled Koobideh meat, Bam Mazafati dates) with full macros and granular USDA FoodData Central provenance.
   - 15 draft traditional items (Sangak, Barbari, Taftoon, Lavash, Barley Bread, Kateh, Chelow, Labneh, Kashk, Doogh, Tabriz Cheese, Ghormeh Sabzi, Gheimeh, Fesenjan, Ash Reshteh) without unverified nutrient values.

3. **Granular Nutrient and Serving Provenance**:
   - Database migration `0006_nutrient_serving_provenance.sql` adds `source_id`, `external_id`, `source_url`, `citation`, `dataset_version`, `method`, `retrieved_at`, and `license` to `food_nutrients` and `food_servings`.
   - API endpoints (`GET /api/v1/foods/:id`) map granular provenance into `FoodDetail` response payloads.

4. **True Dataset-Level Atomicity (`db.batch`)**:
   - `FoodImporterService` in `workers/api/src/services/food-importer.service.ts` builds all insert/update statements for the entire dataset and executes them in a single `db.batch(statements)`.
   - If any constraint or runtime error occurs, SQLite rolls back 100% of statements, leaving zero partial rows in D1.
   - Ingestion errors are sanitized and logged safely in `food_import_logs`.

5. **Persian Typography Normalization**:
   - `packages/localization` exports `normalizePersianText` and `normalizePersianForComparison`.
   - `normalizePersianForComparison` unifies punctuation and ZWNJ with spaces to detect semantic collisions before ingestion.

6. **CLI Tooling & Local D1 Pipeline**:
   - `pnpm data:validate`: Schema, raw-bytes SHA-256 checksum, manifest matching, and license validation.
   - `pnpm data:dry-run`: Runs against local Miniflare D1 database, simulating insertion/update counts with mutex proof of zero database mutations.
   - `pnpm data:import:local`: Executes atomic ingestion into local D1 database.
   - `--licensed-local`: Explicit confirmation flag for local restricted datasets.

## Consequences

- Complete provenance and licensing transparency for all nutritional data in NutriAI Persia.
- High-quality, culturally authentic Iranian traditional food catalog available immediately in Persian and English.
- True atomic resilience against corrupted or colliding dataset imports.
- Zero unverified or self-referential scientific claims.
