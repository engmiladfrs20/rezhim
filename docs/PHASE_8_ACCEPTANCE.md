# Phase 8 Acceptance — Food Diary

## Scope

Phase 8 provides authenticated, user-owned food diary records backed by D1:

- Create grams- or serving-based entries with positive, finite portions.
- Store meal type, UTC consumed timestamp, optional note, and audit timestamps.
- List one UTC calendar day with per-entry calculations and a daily aggregate.
- Edit metadata or explicitly switch portion modes through PATCH.
- Delete entries and return stable `DIARY_ENTRY_NOT_FOUND` responses.
- Enforce ownership on every read/update/delete and reject unauthenticated access.
- Reuse Phase 6 active-food, provenance, and deterministic nutrition validation.

## Implementation

- `workers/api/migrations/0009_food_diary.sql` creates the constrained diary table and indexes.
- `packages/schemas/src/food.ts` defines date, meal, create, update, and portion validation.
- `workers/api/src/db/food-diary.repository.ts` contains parameterized user-scoped persistence.
- `workers/api/src/services/food-diary.service.ts` validates and calculates via `NutritionService`.
- `workers/api/src/routes/diary.ts` exposes `GET/POST /api/v1/diary` and `PATCH/DELETE /api/v1/diary/:id`.

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
11. `git diff --check`

The worker integration suite must cover authentication, both portion modes, exact totals, date validation, CRUD, and cross-user isolation.

## Final local verification snapshot

- `pnpm exec turbo run test:coverage --force`: 17/17 tasks passed, 217/217 tests passed.
- Worker API: 86 tests passed across 8 suites; diary suite: 4/4.
- `pnpm exec turbo run build --force`: 12/12 workspaces built.
- `pnpm --filter @nutriai/worker-api run db:migrations:apply:local`: migration `0009_food_diary.sql` applied successfully.
- `pnpm data:validate`: 30/30 catalog items valid; `pnpm data:dry-run`: zero mutations.
- `pnpm audit --prod --audit-level=critical`: zero critical advisories (two documented high advisories remain under policy).
