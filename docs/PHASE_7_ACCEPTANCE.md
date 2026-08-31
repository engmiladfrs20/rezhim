# Phase 7 Acceptance — Bilingual Food Search

## Scope

Phase 7 adds deterministic food discovery to both authenticated food list APIs:

- Persian and English translation-name search.
- Alias, brand, and canonical barcode search.
- Persian/Arabic letter, digit, diacritic, punctuation, whitespace, and ZWNJ normalization.
- Multi-token AND matching with a 100-character input bound.
- Public active-only visibility and admin status-aware visibility.
- Stable cursor pagination after filtering and parameterized SQL.
- Admin catalog search control wired to `q`.

## Implementation

- `workers/api/migrations/0008_food_search.sql` adds indexed canonical search columns and backfills existing rows.
- `packages/schemas/src/food.ts` validates `q` on public and admin list queries.
- `workers/api/src/db/food.repository.ts` applies tokenized, parameterized matching.
- `workers/api/src/services/food.service.ts` and routes pass the search term through the typed boundary.
- `apps/admin/src/foods/FoodCatalogManager.tsx` exposes Persian/English search in the catalog UI.

## Required verification

The phase is accepted only when all of the following pass from a clean checkout:

1. `pnpm install --frozen-lockfile`
2. `pnpm format:check`
3. `pnpm exec turbo run lint --force`
4. `pnpm exec turbo run typecheck --force`
5. `pnpm exec turbo run test:coverage --force`
6. `pnpm exec turbo run build --force`
7. `pnpm --filter @nutriai/worker-api run db:migrations:apply:local`
8. `pnpm data:validate`
9. `pnpm audit --prod --audit-level=critical`
10. `git diff --check`

The worker integration suite must cover normalized Persian aliases, English names, barcodes, multi-token matching, draft visibility, and overlong-query rejection.

## Final local verification snapshot

- `pnpm exec turbo run test:coverage --force`: 17/17 tasks passed, 213/213 tests passed.
- `pnpm exec turbo run build --force`: 12/12 workspaces built.
- Worker food catalog suite: 22 tests passed, including the Phase 7 search cases.
- `pnpm data:validate`: 30/30 catalog items valid.
- `pnpm data:dry-run`: 30 unchanged, zero D1 mutations.
- `pnpm audit --prod --audit-level=critical`: zero critical advisories (two documented high advisories remain under policy).
