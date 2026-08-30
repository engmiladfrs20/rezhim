# Data Sources and Ingestion Guide

## Policy

Only data with documented redistribution rights may be committed. A record may be public only when its identity matches its source and every nutrient and serving has complete provenance.

Generic reference foods must not be relabeled as culturally specific foods. For example, a USDA grilled chicken breast record is not Joojeh Kabab, a ground-beef patty is not Kabab Koobideh, parsley is not Sabzi Khordan, and Deglet Noor is not Bam Mazafati. Those Iranian identities remain independent drafts until directly supported.

## Sources

| Source                    | Purpose                                                                  | Rights                                |
| ------------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| `src_open_iranian_foods`  | CC0 catalog structure, Persian/English names, and draft identities       | Committed                             |
| `src_usda_fdc`            | Per-record nutrient and portion references for exact generic commodities | U.S. Government public domain         |
| `src_iranian_fct_adapter` | Local adapter for authorized Iranian Food Composition Table data         | Restricted; raw data is not committed |

The open dataset has 30 entries: 10 active exact USDA commodities and 20 unpublished Iranian drafts. Its raw-byte SHA-256 is `91e3784ca77aa9e056c5092c3c9fabc8b69483e4c1b996a97f8e6426fbe79a43`.

## Layout

```text
data/sources/
├── open-iranian-foods/
│   ├── LICENSE.md
│   ├── source-manifest.json
│   └── foods.json
└── iranian-fct-template/
    ├── source-manifest.json
    └── sample-template.json
```

## Required active-record provenance

Active foods require all four macros and, on every nutrient and serving:

- `source_id`
- `external_id`
- `source_url`
- `citation`
- `dataset_version`
- `method`
- `retrieved_at` as RFC3339 UTC
- `license`

Supported methods are `laboratory`, `database`, `calculated`, and `measured`. `database` means the value was transcribed from a cited database; it must not be presented as a project-run laboratory assay.

## Commands

```bash
pnpm data:validate
pnpm --filter @nutriai/worker-api run db:migrations:apply:local
pnpm data:dry-run
pnpm data:import:local
pnpm data:dry-run
```

The second dry-run must report `0 inserted`, `0 updated`, and `30 unchanged` for the open baseline.

For an authorized restricted dataset, place the licensed records in a local source directory as `foods.json` with a matching manifest checksum, then run only in a local development or test environment:

```bash
NUTRIAI_DATA_ENV=development pnpm data:validate /private/path/to/source --licensed-local
NUTRIAI_DATA_ENV=development pnpm data:import:local /private/path/to/source --licensed-local
```

On PowerShell, set `$env:NUTRIAI_DATA_ENV = 'development'` before the command. The pipeline blocks restricted imports in CI, staging, and production regardless of the flag.

## Adding an open source

1. Create `data/sources/<source>/source-manifest.json` and `foods.json`.
2. Record publisher, URL, version, acquisition time, license, redistribution decision, and the exact raw-file SHA-256.
3. Keep uncertain or culturally non-equivalent records as `draft` without guessed values.
4. Run validation, migrations, dry-run, import, and a second dry-run.
5. Add integration tests that prove identity, provenance completeness, atomic rollback, and public draft filtering.
