# Phase 9 Acceptance — Deterministic Meal Plan Engine

Phase 9 adds a stateless, explainable meal-plan generator on top of the verified food catalog
and Phase 6 nutrition targets.

## Scope

- `POST /api/v1/meal-plans/generate` requires authentication.
- The request contains adult biometrics, 4–50 unique food IDs, a 1–14 day horizon, and locale.
- Every candidate is loaded at 100 g through `NutritionService`; draft, archived, incomplete, or
  non-redistributable nutrition is rejected before a plan is produced.
- Each day contains breakfast, lunch, dinner, and snack budgets (25/35/30/10 percent).
- Food selection is stable by canonical ID order and rotates across days; portions are bounded to
  25–800 g to prevent pathological serving sizes.
- The engine is deterministic and stateless. No meal plan rows or user preferences are persisted.

## Implementation

- `packages/nutrition/src/meal-plan.ts` contains the pure generator and bounded portion scaler.
- `packages/schemas/src/meal-plan.ts` validates target biometrics, candidate IDs, horizon, and locale.
- `workers/api/src/services/meal-plan.service.ts` loads active, provenance-checked candidates.
- `workers/api/src/routes/meal-plans.ts` exposes the authenticated API route.
- `docs/ADR/0012-deterministic-meal-plan-engine.md` records the design decision.

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

## Final local verification snapshot

- Pure planner: 4/4 tests passed; API integration: 2/2 tests passed.
- The full uncached suite and all repository gates must be rerun before the Phase 9 commit.
