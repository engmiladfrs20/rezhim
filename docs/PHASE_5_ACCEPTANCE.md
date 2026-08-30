# Phase 5 Acceptance: Iranian Food Database & Provenance Pipeline

## 1. Overview

Phase 5 establishes a verified baseline dataset of traditional Iranian foods and an automated, idempotent data ingestion pipeline with granular nutrient and serving level provenance, cryptographic checksum verification, dataset-level atomicity, and strict license compliance for NutriAI Persia.

---

## 2. Technical Architecture & Invariant Enforcement

### 1. Granular Provenance Relational Schema (`0006_nutrient_serving_provenance.sql`)

- Added granular provenance columns to `food_nutrients` and `food_servings`:
  - `source_id`: Foreign key referencing `food_sources(id)`.
  - `external_id`: External record identifier (e.g. USDA FoodData Central FDC ID `172420`, portion ID).
  - `source_url`: Direct URL to external record page or API.
  - `citation`: Full citation text.
  - `dataset_version`: Version of source dataset.
  - `method`: Ingestion method (`laboratory`, `database`, `calculated`).
  - `retrieved_at`: RFC3339 UTC timestamp when data was retrieved from source.
  - `license`: Rights notice of external reference.
- Relational audit logs via `food_import_logs` table (`id`, `source_id`, `dataset_name`, `file_checksum`, `total_records`, `inserted_count`, `updated_count`, `unchanged_count`, `skipped_count`, `status`, `error_summary`, `executed_by`, `created_at`).
- Seeded standard sources: `src_open_iranian_foods` (CC0-1.0 structure/curation with USDA FDC public domain underlying data) and `src_iranian_fct_adapter` (Proprietary NNFTRI adapter template).
- Updated `system_metadata` schema version to `0006_nutrient_serving_provenance`.

### 2. Scientific Truth & Dataset Rights Policy

- **No Self-Referencing Claims**: Repository is not claimed as the scientific authority for nutrient values.
- **Active Foods Invariant**: Active foods (`status: 'active'`) must define complete macro nutrients (`nut_energy`, `nut_protein`, `nut_carbohydrate`, `nut_fat_total`) and valid granular provenance (`source_id`, `method`, `retrieved_at`).
- **Dataset Composition (25 Foods Total)**:
  - **10 Active Generic Commodities**: Cooked brown lentils, cooked chickpeas, raw walnuts, fresh pomegranate, brewed Persian black tea, whole milk yogurt, fresh greens (Sabzi Khordan), grilled chicken breast (Joojeh), grilled minced beef/lamb (Koobideh), and fresh dates (Bam Mazafati) mapped to verified USDA FoodData Central laboratory records with direct URLs and FDC IDs.
  - **15 Draft Traditional Items**: Sangak, Barbari, Taftoon, Lavash, Barley Bread, Kateh, Chelow, Strained Labneh, Kashk, Doogh, Tabriz Lighvan cheese, Ghormeh Sabzi, Gheimeh, Fesenjan, and Ash Reshteh are strictly maintained in `draft` status without unverified nutrient numbers.
  - **0 Active Foods without Provenance**.
- **License Boundary Management**:
  - `data/sources/open-iranian-foods/LICENSE.md` contains an explicit rights waiver and provenance documentation.
  - `src_iranian_fct_adapter` (NNFTRI Iranian FCT) provides a typed ingestion adapter template without committing proprietary raw databases to git (`redistributionAllowed: false`).
  - Public ingestion automatically rejects sources with restricted redistribution policies unless `--licensed-local` is explicitly passed in a local environment.

### 3. True Dataset-Level Atomicity (`db.batch`)

- Multi-item batch ingestion rollback: all operations of a dataset import (source upsert, food upserts, deletions of old relations, insertions of translations, aliases, nutrients with provenance, servings with provenance, and success log) execute in a single Cloudflare D1 `db.batch(statements)` transaction.
- If a constraint failure or SQLite error occurs mid-dataset, the entire batch rolls back completely with zero partial rows left in D1.
- Ingestion errors are sanitized to prevent leaking internal SQLite SQL strings, and failed logs are recorded safely in a separate statement.

### 4. Persian Typography Normalization

- Implemented `normalizePersianText` and `normalizePersianForComparison` in `packages/localization`.
- Standardizes Arabic letter variants (ي/ى -> ی, ك -> ک), digits (۰-۹ / ٠-٩ -> 0-9), diacritics (اعراب), and zero-width non-joiners (ZWNJ).
- Detects semantic alias collisions across dataset items during pre-ingestion validation.

### 5. CLI Tooling & Local D1 Operations

- Implemented `FoodImporterService` in `workers/api/src/services/food-importer.service.ts` with `validate`, `dry-run`, and `import` execution modes.
- Created `scripts/data-pipeline.mjs` CLI tool:
  - `pnpm data:validate`: Verifies schema, raw-bytes SHA-256 checksum, manifest match, and license compliance.
  - `pnpm data:dry-run`: Runs against local Miniflare D1 database, simulates insertion/update counts, and proves zero database mutation.
  - `pnpm data:import:local`: Executes atomic ingestion into local D1 database.
  - `--licensed-local`: Explicit confirmation flag for local restricted datasets.

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

- [x] **Relational Schema Migration**: `0006_nutrient_serving_provenance.sql` applied cleanly with granular provenance columns on `food_nutrients` and `food_servings`, `food_import_logs`, and category seeds.
- [x] **Granular Provenance**: Active foods contain valid `source_id`, `external_id`, `source_url`, `citation`, `dataset_version`, `method`, `retrieved_at`, and `license` on all nutrients and servings.
- [x] **Scientific Provenance Traceability**: Active commodities reference verifiable USDA FoodData Central records; composite dishes kept strictly in `draft` status without guessed values.
- [x] **License Compliance**: CC0-1.0 open baseline with explicit `LICENSE.md`; proprietary NNFTRI tables restricted to `--licensed-local` environments without raw data in git.
- [x] **Dataset-Level Atomicity**: Full dataset ingestion executed in single `db.batch()` transaction; mid-batch constraint failure rolls back 100% with zero partial writes in D1.
- [x] **Persian Text Normalization**: Arabic/Persian letter variants, digits, diacritics, and ZWNJs normalized for search indexing and collision detection.
- [x] **Idempotent Ingestion**: Repeated dataset runs produce `0 inserted, 0 updated, 25 unchanged` with zero duplicates.
- [x] **Public & Admin API Compatibility**: Active Iranian foods served via `/api/v1/foods` and `/api/v1/foods/:id` with Persian and English translations and `resolvedLocale`; draft items excluded from public endpoint and accessible in admin API.
- [x] **CLI Tooling & Local D1 Operations**: `pnpm data:validate`, `pnpm data:dry-run`, and `pnpm data:import:local` operational with zero-mutation dry-run verification.
- [x] **Monorepo Quality Gates**: Typecheck, ESLint, Prettier, Turbo build, D1 migrations, dependency audit, and Expo doctor all passing.
