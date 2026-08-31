# Phase 12 Acceptance — AI Coach with Diary Context

## Scope

- `@nutriai/ai` provides a deterministic, auditable coach prompt builder.
- `POST /api/v1/ai/coach` is authenticated and reads only the requesting user's diary summary for
  the requested date.
- Nutrition targets are recalculated on the server from validated biometrics; client-supplied totals
  cannot influence the target calculation.
- User questions are bounded and explicitly delimited as untrusted content. The fixed system
  instruction prohibits diagnosis, treatment prescriptions, and outcome guarantees.
- The endpoint returns a clear educational disclaimer and fails closed when `GEMINI_API_KEY` is absent.

## Implementation

- `packages/ai/src/coach.ts` builds the stable prompt and safety instruction.
- `packages/schemas/src/ai.ts` validates coach questions, locale, date, and biometrics.
- `workers/api/src/services/ai.service.ts` loads the provider and recalculates targets.
- `workers/api/src/routes/ai.ts` exposes the authenticated `/coach` route and stable error mapping.
- `workers/api/test/ai.test.ts` verifies authentication, diary-context loading, and unavailable-provider
  behavior; `packages/ai/test/coach.test.ts` verifies prompt boundaries and determinism.
- `docs/ADR/0015-ai-coach.md` records the privacy and safety boundary.

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

- `pnpm format:check`: passed.
- `pnpm exec turbo run lint --force`: 13/13 tasks passed with zero errors and warnings.
- `pnpm exec turbo run typecheck --force`: all 21 tasks passed with zero TypeScript errors.
- `pnpm exec turbo run test:coverage --force`: 19/19 tasks passed; 233/233 tests passed, including
  93 Worker API tests across 11 suites and coach prompt tests.
- `pnpm exec turbo run build --force`: all workspaces built successfully.
- Local D1 migrations, dataset validation, and dry-run completed without pending migrations or data
  mutation.
- `pnpm audit --prod --audit-level=critical`: zero critical advisories; documented high advisories
  remain under the repository policy.
- Expo config parsing and `git diff --check` passed. The remote Expo Doctor schema check remains
  subject to the transient HTML-response limitation documented in Phase 11.
