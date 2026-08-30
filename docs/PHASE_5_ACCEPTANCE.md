# Phase 5 Acceptance: Iranian Food Catalog and Provenance Pipeline

## Outcome

Phase 5 provides a provenance-first catalog foundation and an idempotent D1 ingestion pipeline. It does not claim that generic USDA commodities are Iranian recipes or regional products.

The committed open dataset contains 30 records:

- 10 active generic commodities whose public names and nutrient values match the cited USDA FoodData Central records.
- 20 Iranian foods and preparations kept as `draft`, with no nutrient or serving values, until a matching licensed source or laboratory assay is available.
- 0 active records without complete nutrient and serving provenance.

The active records are cooked lentils, cooked chickpeas, raw English walnuts, raw pomegranate, brewed black tea, plain whole-milk yogurt, Deglet Noor dates, grilled chicken breast, cooked 80/20 ground-beef patty, and fresh parsley. Joojeh Kabab, Kabab Koobideh, Sabzi Khordan, Lahijan tea, and Bam Mazafati dates remain separate draft records; they are not aliases for those generic commodities.

## Enforced invariants

- New Admin records default to `draft`.
- Every active record requires energy, protein, carbohydrate, and total-fat values.
- Every active nutrient and serving requires `source_id`, `external_id`, `source_url`, `citation`, `dataset_version`, `method`, `retrieved_at`, and `license`.
- Allowed methods are `laboratory`, `database`, `calculated`, and `measured`.
- Nested provenance sources must exist in `food_sources`.
- The Admin editor preserves all provenance on unchanged values and refuses to publish unverifiable changes.
- Draft records may omit provenance and remain excluded from public food endpoints.

## Database and pipeline

- `0006_nutrient_serving_provenance.sql` adds granular provenance fields.
- `0007_phase5_provenance_integrity.sql` adds D1 guards for provenance methods and UTC timestamps.
- `FoodImporterService` executes each dataset mutation and its success log in one D1 batch. Unchanged records produce no delete, insert, or update statements.
- Failed imports return sanitized messages and do not expose SQL text.
- The local CLI verifies the SHA-256 hash of the exact `foods.json` bytes, compares complete nested state, escapes every SQL text value centrally, and reports inserted, updated, and unchanged counts.
- Restricted datasets require both explicit `--licensed-local` consent and `NUTRIAI_DATA_ENV=development|test`. CI, staging, and production are rejected even when the flag is supplied.

## Dataset integrity

- Open dataset path: `data/sources/open-iranian-foods/foods.json`
- Manifest checksum: `91e3784ca77aa9e056c5092c3c9fabc8b69483e4c1b996a97f8e6426fbe79a43`
- Curation license: CC0-1.0
- Underlying active nutrient source: USDA FoodData Central public-domain records, cited per nutrient and serving
- Restricted NNFTRI data: not committed; only a local adapter template is present

## Verification commands

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm data:validate
pnpm --filter @nutriai/worker-api run db:migrations:apply:local
pnpm data:dry-run
pnpm data:import:local
pnpm data:dry-run
pnpm exec turbo run test:coverage --force
pnpm exec turbo run build --force
pnpm audit --prod --audit-level=critical
npx expo-doctor@latest
git diff --check
```

## Measured acceptance results

The following results were measured from the final local verification on 2026-08-30:

- Frozen install, formatting, lint, TypeScript typecheck, and all local D1 migrations: passed.
- Dataset validation: 30 of 30 records passed and the raw-byte SHA-256 matched the manifest.
- Import cycle: after replacing 80 obsolete USDA detail links, the first dry-run detected exactly 10 changed records without mutating D1; import updated those 10 records; the second dry-run reported 0 inserts, 0 updates, and 30 unchanged records.
- Uncached test coverage: 164 of 164 tests passed across all 15 Turbo tasks.
- Worker API coverage: 74.32% statements, 58.04% branches, 83.50% functions, and 76.15% lines.
- Uncached production build: all 11 workspaces passed.
- Production dependency audit: 0 critical vulnerabilities; 2 documented high-severity transitive findings remain below the configured critical acceptance gate.
- Expo Doctor: 18 of 18 checks passed.
- `git diff --check`: passed.

Final acceptance requires the matching commit to reproduce these gates in GitHub Actions.

Phase 6 is not included in this acceptance document.
