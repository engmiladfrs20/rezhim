# Phase 14 Acceptance — Voice/Text Food Log Interpretation

## Scope

- `POST /api/v1/ai/food-log` requires authentication and validates a bounded transcript, date, and
  locale.
- The endpoint works for typed text or a speech-to-text transcript and uses the server-only Gemini
  provider; no client receives credentials.
- Prompt instructions extract only facts explicitly present in the transcript, treat transcript text
  as untrusted, and prohibit diagnosis, invented ingredients, or nutrition estimates.
- The response is confirmation-ready and includes an approximation disclaimer. No automatic diary,
  food catalog, or nutrition mutation is performed.

## Implementation

- `packages/types/src/domain.ts` defines `AiFoodLogResponse`.
- `packages/schemas/src/ai.ts` validates transcript size, date, and locale.
- `workers/api/src/services/ai.service.ts` builds the safe interpretation prompt.
- `workers/api/src/routes/ai.ts` exposes the authenticated endpoint and stable AI errors.
- `workers/api/test/ai.test.ts` verifies validation and fail-closed behavior when Gemini is absent.
- `docs/ADR/0017-voice-text-food-log.md` records the confirmation and privacy boundary.

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

- AI and Worker API transcript tests pass for invalid input and missing-provider behavior (238 tests
  across the monorepo; 96 Worker API tests across 11 suites).
- Full lint, typecheck, coverage, and production build pass across all workspaces.
- D1 migrations, dataset validation, and dry-run complete without pending migrations or mutations.
- Dependency audit reports zero critical advisories; existing documented high advisories remain under
  repository policy.
- Expo config parsing and whitespace checks pass; Expo Doctor's remote schema limitation is tracked
  in earlier acceptance reports.
