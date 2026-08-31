# Phase 15 Acceptance — Barcode Food Lookup Boundary

## Scope

- Authenticated clients can resolve a food by canonical barcode through `GET /api/v1/foods/barcode/:barcode`.
- Persian/Arabic digits and supported separators are normalized before the 8–18 digit validation.
- Only `active` catalog records are returned; unknown, draft, and archived records are not inferred or
  exposed.
- Locale selection uses the existing bilingual mapper and preserves provenance fields.
- Invalid values return `400 VALIDATION_ERROR`; valid but unknown values return `404 FOOD_NOT_FOUND`.

## Implementation

- `workers/api/src/services/food.service.ts` validates and resolves canonical barcodes.
- `workers/api/src/routes/foods.ts` exposes the route and stable error mapping before the `/:id` route.
- `workers/api/test/food.test.ts` verifies localized digits/separators, locale mapping, and invalid
  barcode handling.
- `docs/ADR/0018-barcode-food-lookup.md` records the deterministic lookup boundary.

## Required verification

1. `pnpm install --frozen-lockfile`
2. `pnpm format:check`
3. `pnpm exec turbo run lint --force`
4. `pnpm exec turbo run typecheck --force`
5. `pnpm exec turbo run test:coverage --force`
6. `pnpm exec turbo run build --force`
7. `pnpm --filter @nutriai/worker-api run db:migrations:apply:local`
8. `pnpm data:validate`
9. `pnpm data:dry-run`
10. `pnpm audit --prod --audit-level=critical`
11. `pnpm --filter @nutriai/mobile exec expo config --json`
12. `git diff --check`

## Final local verification snapshot

- Barcode integration tests pass for canonicalization, locale-aware detail lookup, invalid values,
  and unpublished-food protection.
- Full lint, typecheck, coverage, and production build pass across all workspaces.
- D1 migrations, dataset validation, and dry-run complete without pending migrations or mutation.
- Dependency audit reports zero critical advisories; existing documented high advisories remain under
  repository policy.
- Expo config parsing and whitespace checks pass; the remote Expo Doctor schema limitation remains
  documented from earlier phases.
