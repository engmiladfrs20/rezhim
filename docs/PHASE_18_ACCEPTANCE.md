# Phase 18 Acceptance — Pantry, Fridge, and Shopping List

## Scope

Phase 18 adds authenticated, user-owned inventory and shopping-list CRUD backed by
Cloudflare D1. It does not add automatic replenishment, barcode scanning, or recipe
planning logic.

## Acceptance criteria

- [x] Migration `0010_pantry_shopping_list.sql` creates constrained tables and indexes.
- [x] Pantry records support pantry, fridge, and freezer locations, expiration, notes,
      positive gram quantities, filtering, update, and delete.
- [x] Shopping-list records support required/purchased grams, planned/purchased status,
      notes, filtering, update, and delete.
- [x] Every endpoint requires authentication and scopes all operations to the user.
- [x] Only active canonical foods can be referenced; missing, draft, and archived foods
      return `400 VALIDATION_ERROR`.
- [x] Invalid payloads and empty updates return stable validation responses.
- [x] Missing records return stable 404 error codes without leaking SQL details.

## Verification

The Worker integration suite contains five real D1 tests covering authentication,
CRUD/filter behavior, active-food validation, malformed payloads, stable not-found
responses, and ownership boundaries. Run the repository quality gates before release:

```text
pnpm format:check
pnpm exec turbo run lint --force
pnpm exec turbo run typecheck --force
pnpm exec turbo run test:coverage --force
pnpm exec turbo run build --force
pnpm --filter @nutriai/worker-api run db:migrations:apply:local
```

The online Expo Doctor schema check may remain environment-limited when its remote
schema endpoint returns HTML; the local Expo configuration check remains the source
of truth for this backend-only phase.
