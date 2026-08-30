# Data Sources & Ingestion Pipeline Guide

This document outlines the data sources, provenance standards, licensing policies, and CLI workflows for the NutriAI Persia food catalog.

---

## 1. Overview & Licensing Policy

NutriAI Persia adheres strictly to open-source licensing and data provenance transparency.

### Principles:

1. **Redistribution Rights**: Only datasets with verifiable open redistribution licenses (e.g. `CC0-1.0`, `Public Domain`, `Open Government`) are committed to this git repository.
2. **Proprietary & Restricted Sources**: Official national food composition tables (such as the _National Nutrition and Food Technology Research Institute (NNFTRI)_ Iranian Food Composition Tables) that do not allow direct public redistribution are **not** committed to git. Instead, NutriAI Persia provides a typed adapter template (`data/sources/iranian-fct-template/`) allowing licensed researchers and local deployments to ingest data privately using `--licensed-local`.
3. **Scientific Integrity & Traceability**: Nutrient values and serving sizes are never fabricated, guessed, or approximated.
   - Every active commodity defines complete macro nutrients (`nut_energy`, `nut_protein`, `nut_carbohydrate`, `nut_fat_total`) with granular provenance referencing USDA FoodData Central records with direct URLs and FDC IDs.
   - Traditional composite dishes lacking single laboratory chemical assays (e.g. Ghormeh Sabzi, Gheimeh, Fesenjan, Ash Reshteh) are maintained strictly in `draft` status and excluded from public consumer API endpoints until verified assays are linked.

---

## 2. Active Data Sources

| Source ID                 | Source Code           | Name & Publisher                                                                                                      | License                              | Redistribution in Git                  | SHA-256 Checksum                                                   |
| :------------------------ | :-------------------- | :-------------------------------------------------------------------------------------------------------------------- | :----------------------------------- | :------------------------------------- | :----------------------------------------------------------------- |
| `src_open_iranian_foods`  | `open_iranian_foods`  | **NutriAI Open Iranian Food Catalog Baseline**<br>_NutriAI Open Food Project & Open Data Contributors_                | `CC0-1.0` (Curated open data)        | **Allowed (Committed)**                | `2be3d3d51d2281365beac43e97c703196b9e2d4d1d2a5953b3eb345c459bb372` |
| `src_iranian_fct_adapter` | `iranian_fct_adapter` | **Iranian Food Composition Tables (Adapter)**<br>_NNFTRI (National Nutrition and Food Technology Research Institute)_ | `Proprietary (Official Publication)` | **Restricted (Adapter Template Only)** | `2e28f6dfba2052714d84aea3f8fafe63c9f5d70b6f8e3ca9fa1bfe86c297504d` |
| `src_usda_fdc`            | `usda_fdc`            | **USDA FoodData Central Foundation & SR Legacy**<br>_U.S. Department of Agriculture_                                  | `Public Domain (U.S. Gov)`           | **Allowed (External Reference)**       | Linked per-record (FDC IDs)                                        |

---

## 3. Directory Layout

```
data/sources/
├── open-iranian-foods/
│   ├── LICENSE.md                # Rights waiver and USDA FDC provenance notice
│   ├── source-manifest.json      # Typed manifest with metadata, license, and SHA-256
│   └── foods.json                # Curated baseline (10 active commodities, 15 draft dishes)
└── iranian-fct-template/
    ├── source-manifest.json      # Adapter manifest (redistributionAllowed: false)
    └── sample-template.json      # Schema template for local licensed ingestion
```

---

## 4. Source Manifest Schema

Every data source must provide a `source-manifest.json` adhering to the `@nutriai/schemas` `foodSourceManifestSchema`:

```json
{
  "id": "src_open_iranian_foods",
  "name": "NutriAI Open Iranian Food Catalog Baseline",
  "code": "open_iranian_foods",
  "publisher": "NutriAI Open Food Project & Open Data Contributors",
  "url": "https://github.com/engmiladfrs20/rezhim/tree/main/data/sources/open-iranian-foods",
  "version": "1.1.0",
  "acquisitionDate": "2026-08-30T00:00:00.000Z",
  "license": "CC0-1.0 (Dataset structure & curation; underlying nutrition data derived from USDA FoodData Central and public domain records)",
  "redistributionAllowed": true,
  "sha256Checksum": "2be3d3d51d2281365beac43e97c703196b9e2d4d1d2a5953b3eb345c459bb372",
  "language": "fa, en",
  "description": "Curated baseline dataset of Iranian food items with granular nutrient and serving provenance referencing USDA FoodData Central records for active commodities and draft state for unverified composite dishes."
}
```

---

## 5. Ingestion Pipeline & CLI Commands

The repository provides automated pipeline scripts for dataset verification and ingestion.

### 1. Validate Dataset Integrity:

Performs schema validation, verifies raw bytes SHA-256 hash against manifest, checks macro nutrients and granular provenance for active items, checks positive serving weights, and checks duplicate Persian aliases:

```bash
pnpm data:validate
```

### 2. Dry-Run Simulation:

Simulates dataset ingestion against local Miniflare D1 database, verifying what records would be inserted vs updated vs unchanged, and proving zero mutations to D1:

```bash
pnpm data:dry-run
```

### 3. Local D1 Ingestion:

Performs single-batch atomic ingestion into local D1 database:

```bash
pnpm data:import:local
```

### 4. Restricted Source Local Ingestion:

To validate or ingest a licensed local dataset (e.g. NNFTRI tables):

```bash
node scripts/data-pipeline.mjs data/sources/iranian-fct-template --licensed-local
```

---

## 6. Adding a New Dataset Source

To add a new food dataset:

1. Create a subdirectory under `data/sources/<source-name>/`.
2. Create `source-manifest.json` with mandatory fields: `id`, `name`, `code`, `publisher`, `url`, `version`, `acquisitionDate` (RFC3339 UTC), `license`, `redistributionAllowed`, and `sha256Checksum`.
3. Create `foods.json` adhering to the `foodDatasetItemSchema`.
4. Ensure all active foods contain full macros and granular provenance (`source_id`, `method`, `retrieved_at`).
5. Run `pnpm data:validate data/sources/<source-name>` to verify integrity.
