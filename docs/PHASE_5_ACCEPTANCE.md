# Phase 5 Acceptance: Iranian Food Database & Provenance Pipeline

## 1. Overview

Phase 5 establishes the authoritative baseline dataset of traditional Iranian foods and an automated, idempotent data ingestion pipeline with provenance tracking, cryptographic checksum verification, and strict license compliance for NutriAI Persia.

---

## 2. Technical Architecture & Invariant Enforcement

### 1. Relational Database Migration (`0005_food_dataset_provenance.sql`)

- Created `food_import_logs` table for tracking audit logs of all dataset ingestion runs (`id`, `source_id`, `dataset_name`, `file_checksum`, `total_records`, `inserted_count`, `updated_count`, `unchanged_count`, `skipped_count`, `status`, `error_summary`, `executed_by`, `created_at`).
- Seeded standard sources: `src_open_iranian_foods` (CC0-1.0) and `src_iranian_fct_adapter` (Proprietary NNFTRI adapter).
- Updated `system_metadata` schema version to `0005_food_dataset_provenance`.

### 2. Typed Source Manifests & Licensing Policy

- Every dataset source includes a strictly validated `source-manifest.json` with publisher, version, RFC3339 UTC acquisition timestamp, license, redistribution status, and SHA-256 integrity checksum.
- **License Boundary Management**:
  - `src_open_iranian_foods` (CC0-1.0 open baseline) is committed directly to git under `data/sources/open-iranian-foods/`.
  - `src_iranian_fct_adapter` (NNFTRI Iranian FCT) provides a typed ingestion adapter template without committing proprietary raw databases to git (`redistributionAllowed: false`).
  - Public ingestion automatically rejects sources with restricted redistribution policies.

### 3. Iranian Food Dataset Integrity

- Authentic items spanning all traditional categories:
  - **Breads & Grains**: Sangak, Barbari, Taftoon, Lavash, Barley Bread, Cooked Kateh Rice, Cooked Chelow Rice.
  - **Dairy**: Full-fat Yogurt, Strained Labneh, Kashk (fermented whey), Doogh, Tabriz Sheep Milk Cheese.
  - **Legumes & Nuts**: Brown Lentils, Chickpeas, Pinto Beans, Persian Walnuts, Pistachios, Almonds.
  - **Meats, Poultry & Fish**: Joojeh Kebab, Koobideh Kebab, Grilled Trout, Caspian White Fish.
  - **Fruits & Vegetables**: Fresh Pomegranate, Bam Mazafati Dates, Persian Melon, Shiraz Figs, Sabzi Khordan herb platter, Grilled Tomato, Smoked Eggplant.
  - **Beverages**: Brewed Persian Black Tea, Saffron Sharbat, Mint Distillate, Borage Tea.
  - **Draft Composite Recipes**: Traditional composite dishes lacking single laboratory chemical values (Ghormeh Sabzi, Gheimeh, Fesenjan, Ash Reshteh) are maintained in `draft` status without guessing nutrient values.

### 4. Persian Typography Normalization

- Implemented `normalizePersianText` and `normalizePersianForComparison` in `packages/localization`.
- Standardizes Arabic letter variants (ي/ى -> ی, ك -> ک), digits (۰-۹ / ٠-٩ -> 0-9), diacritics (اعراب), and zero-width non-joiners (ZWNJ).
- Detects semantic alias collisions across dataset items during pre-ingestion validation.

### 5. Idempotent Ingestion Pipeline & CLI Tooling

- Implemented `FoodImporterService` in `workers/api/src/services/food-importer.service.ts` with `validate`, `dry-run`, and `import` execution modes.
- Multi-item batch ingestion rollback: corrupted or invalid batches abort atomically with zero partial records inserted.
- Re-running ingestion is 100% idempotent: zero duplicate records created, accurate tracking of `inserted`, `updated`, and `unchanged` counts.
- Created `scripts/data-pipeline.mjs` with `pnpm data:validate` and `pnpm data:dry-run` commands, integrated into the GitHub Actions CI pipeline.

---

## 3. Monorepo Quality Gates & Test Summary

| Package / Workspace      | Tests Passed  | Pass Rate | Test Framework & Runner                      |
| :----------------------- | :------------ | :-------- | :------------------------------------------- |
| `@nutriai/worker-api`    | 62 / 62       | 100%      | Vitest + Cloudflare Miniflare D1 Worker Pool |
| `@nutriai/schemas`       | 8 / 8         | 100%      | Vitest + Zod Type Testing                    |
| `@nutriai/localization`  | 10 / 10       | 100%      | Vitest + Persian Text & Intl Engine          |
| `@nutriai/storage`       | 6 / 6         | 100%      | Vitest + S3 / B2 Mock Providers              |
| `@nutriai/admin`         | 11 / 11       | 100%      | Vitest + React Testing Library               |
| `@nutriai/web`           | 8 / 8         | 100%      | Vitest + React Testing Library               |
| `@nutriai/mobile`        | 4 / 4         | 100%      | Vitest + React Native Testing Library        |
| **Total Monorepo Tests** | **160 / 160** | **100%**  | **Turborepo Monorepo Pipeline**              |

---

## 4. Acceptance Criteria Verification Checklist

- [x] **Relational Schema Migration**: `0005_food_dataset_provenance.sql` applied cleanly from scratch with `food_import_logs` and source seeds.
- [x] **Source Manifest Validation**: Manifest schema validated via Zod, SHA-256 checksums verified, and license restrictions enforced.
- [x] **License Compliance**: Only CC0-1.0 open baseline committed to git; proprietary NNFTRI tables provided as local adapter templates.
- [x] **Zero Nutrient Fabrication**: Authentic laboratory and portion values; traditional composite dishes kept in `draft` status.
- [x] **Persian Text Normalization**: Arabic/Persian letter variants, digits, diacritics, and ZWNJs normalized for search indexing and collision detection.
- [x] **Idempotent Ingestion**: Repeated dataset runs produce `0 inserted, 0 updated, 25 unchanged` with zero duplicates.
- [x] **Atomic Batch Rollback**: Invalid batches (negative nutrients, zero servings, bad categories) abort cleanly without corrupting D1.
- [x] **API Compatibility**: Active Iranian foods served via `/api/v1/foods` and `/api/v1/foods/:id` with Persian and English translations and `resolvedLocale`.
- [x] **Public Draft Filtering**: Draft composite dishes excluded from public consumer queries and visible in admin endpoints.
- [x] **CLI Tooling & CI Integration**: `pnpm data:validate` and `pnpm data:dry-run` operational and enforced in CI workflow.
- [x] **Documentation**: ADR-0008, `docs/DATA_SOURCES.md`, `docs/PHASE_5_ACCEPTANCE.md`, and `README.md` updated.
- [x] **Monorepo Quality Gates**: Typecheck, ESLint, Prettier, Turbo build, D1 migrations, dependency audit, and Expo doctor all passing.
