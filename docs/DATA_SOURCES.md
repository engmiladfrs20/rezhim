# Data Sources & Ingestion Pipeline Guide

This document outlines the data sources, provenance standards, licensing policies, and CLI workflows for the NutriAI Persia food catalog.

---

## 1. Overview & Licensing Policy

NutriAI Persia adheres strictly to open-source licensing and data provenance transparency.

### Principles:

1. **Redistribution Rights**: Only datasets with verifiable open redistribution licenses (e.g. `CC0-1.0`, `Public Domain`, `Open Government`) are committed to this git repository.
2. **Proprietary & Restricted Sources**: Official national food composition tables (such as the _National Nutrition and Food Technology Research Institute (NNFTRI)_ Iranian Food Composition Tables) that do not allow direct public redistribution are **not** committed to git. Instead, NutriAI Persia provides a typed adapter template (`data/sources/iranian-fct-template/`) allowing licensed researchers and local deployments to ingest data privately.
3. **Scientific Integrity**: Nutrient values and serving sizes are never fabricated, guessed, or approximated. Composite traditional recipes lacking official laboratory chemical assays are maintained in `draft` status until official assay references are linked.

---

## 2. Active Data Sources

| Source ID                 | Source Code           | Name & Publisher                                                                                                      | License                              | Redistribution in Git                  | SHA-256 Checksum                                                   |
| :------------------------ | :-------------------- | :-------------------------------------------------------------------------------------------------------------------- | :----------------------------------- | :------------------------------------- | :----------------------------------------------------------------- |
| `src_open_iranian_foods`  | `open_iranian_foods`  | **NutriAI Open Iranian Food Catalog Baseline**<br>_NutriAI Persia Project_                                            | `CC0-1.0`                            | **Allowed (Committed)**                | `babc92f91d78a73958114228b4b990fd6982a405f435ea3844655e454f2f53f6` |
| `src_iranian_fct_adapter` | `iranian_fct_adapter` | **Iranian Food Composition Tables (Adapter)**<br>_NNFTRI (National Nutrition and Food Technology Research Institute)_ | `Proprietary (Official Publication)` | **Restricted (Adapter Template Only)** | `2e28f6dfba2052714d84aea3f8fafe63c9f5d70b6f8e3ca9fa1bfe86c297504d` |
| `src_usda_fdc`            | `usda_fdc`            | **USDA FoodData Central Foundation & SR Legacy**<br>_U.S. Department of Agriculture_                                  | `Public Domain (U.S. Gov)`           | **Allowed**                            | External Reference                                                 |

---

## 3. Directory Layout

```
data/sources/
├── open-iranian-foods/
│   ├── source-manifest.json      # Typed manifest with metadata, license, and SHA-256
│   └── foods.json                # Curated Iranian food catalog records
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
  "publisher": "NutriAI Persia Project",
  "url": "https://github.com/engmiladfrs20/rezhim/tree/main/data/sources/open-iranian-foods",
  "version": "1.0.0",
  "acquisitionDate": "2026-08-30T00:00:00.000Z",
  "license": "CC0-1.0",
  "redistributionAllowed": true,
  "sha256Checksum": "ae66a11ccd0cf4f9c387b7e37342b46c7adfc6a9fdb293653d520b35f31e5be2",
  "language": "fa, en",
  "description": "Open baseline dataset of Iranian traditional foods, breads, and dishes curated from open laboratory food composition references and verified portion weights."
}
```

---

## 5. Ingestion Pipeline & CLI Commands

The repository provides automated pipeline scripts for dataset verification and ingestion.

### 1. Validate Dataset Integrity:

Performs schema validation, verifies SHA-256 hash against manifest, checks positive nutrients, checks positive serving weights, and checks duplicate Persian aliases:

```bash
pnpm data:validate
```

### 2. Dry-Run Simulation:

Simulates dataset ingestion, checking what records would be inserted vs updated vs unchanged without modifying the database:

```bash
pnpm data:dry-run
```

### 3. Ingestion via Service / API:

Ingestion is performed atomically via `FoodImporterService` in `workers/api/src/services/food-importer.service.ts`.

- Multi-item batch transactions rollback completely if any validation error occurs.
- Database records are upserted idempotently on `(source_id, external_id)`.
- Ingestion events are logged in the `food_import_logs` D1 audit table.

---

## 6. Adding a New Dataset Source

To add a new food dataset:

1. Create a subdirectory under `data/sources/<source-name>/`.
2. Author `source-manifest.json` with a valid RFC3339 `acquisitionDate`, `license`, and `redistributionAllowed` status.
3. Author `foods.json` containing the items array. Ensure:
   - All Persian names are localized properly.
   - All serving weights are strictly positive in grams (`weight_g > 0`).
   - All nutrients are normalized per 100g.
   - Composite traditional dishes lacking official lab assays are set to `status: "draft"`.
4. Calculate the SHA-256 checksum of `foods.json`:
   ```bash
   node -e "const fs = require('fs'); const crypto = require('crypto'); console.log(crypto.createHash('sha256').update(fs.readFileSync('data/sources/<source-name>/foods.json')).digest('hex'));"
   ```
5. Update `sha256Checksum` in `source-manifest.json`.
6. Run `pnpm data:validate` to confirm all validation rules pass.
