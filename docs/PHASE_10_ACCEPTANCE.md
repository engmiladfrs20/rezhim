# Phase 10 Acceptance — Deterministic Food Substitution

## Scope

- `POST /api/v1/substitutions` requires authentication and exactly one reference portion mode.
- Candidate IDs are unique, bounded, and resolved only from active catalog records.
- Nutrition and licenses are verified by the existing Phase 6 `NutritionService` before scoring.
- Alternatives are ranked by fixed energy/macro-density weights, tie-broken by ID, and scaled to
  comparable reference energy within 25–800 g.
- Every response includes human-readable reasons and `algorithmVersion: phase10-v1`.
- No substitutions, user profiles, or recommendation history are persisted.

## Implementation

- `packages/nutrition/src/substitution.ts` contains the pure scorer and bounded scaler.
- `packages/schemas/src/substitution.ts` validates portions, candidates, and result limits.
- `workers/api/src/services/substitution.service.ts` loads provenance-checked D1 nutrition.
- `workers/api/src/routes/substitutions.ts` exposes the authenticated endpoint.
- `docs/ADR/0013-deterministic-food-substitution.md` records the decision and limitations.

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

- Pure substitution tests: 3/3 passed; API integration tests: 2/2 passed.
- `pnpm install --frozen-lockfile`: lockfile is up to date.
- `pnpm format:check`: all files match Prettier style; `pnpm exec turbo run lint --force`: 12/12 passed.
- `pnpm exec turbo run typecheck --force`: 19/19 passed; `pnpm exec turbo run test:coverage --force`: 17/17 tasks passed.
- Full test count: 226/226 passed; Worker API 90 tests across 10 suites and nutrition 37 tests across 3 files.
- `pnpm exec turbo run build --force`: 12/12 workspaces built; mobile Expo export completed.
- Local migrations: no pending migrations; `pnpm data:validate`: 30/30 valid; `pnpm data:dry-run`: zero mutations.
- `pnpm audit --prod --audit-level=critical`: zero critical advisories (two documented high advisories remain under policy).
- `git diff --check`: clean.
