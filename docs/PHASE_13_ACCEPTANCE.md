# Phase 13 Acceptance — Photo Food Recognition Boundary

## Scope

- `@nutriai/ai` supports a typed Gemini multimodal request with JPEG/PNG/WebP inline data.
- `POST /api/v1/ai/food-recognition` requires authentication and rejects malformed or oversized
  images before the provider boundary.
- Image data is limited to 3 MB encoded payloads, is never persisted, and provider credentials stay
  in the Worker environment.
- User clarification text is bounded and delimited as untrusted content. A fixed system instruction
  prohibits diagnosis, treatment advice, invented nutrition values, and instruction hijacking.
- Responses are approximate educational output with locale and a visible disclaimer; no automatic
  catalog, nutrition, or diary mutation occurs.

## Implementation

- `packages/types/src/domain.ts` defines `AiVisionRequest` and `AiFoodRecognitionResponse`.
- `packages/schemas/src/ai.ts` validates image encoding, MIME type, locale, and prompt bounds.
- `packages/ai/src/gemini.ts` implements the bounded `generateVision` provider method.
- `workers/api/src/services/ai.service.ts` applies the safety prompt and disclaimer.
- `workers/api/src/routes/ai.ts` exposes the authenticated endpoint.
- `packages/ai/test/gemini.test.ts` verifies inline-data payload construction and early validation.
- `workers/api/test/ai.test.ts` verifies authentication-bound validation and fail-closed behavior.
- `docs/ADR/0016-photo-food-recognition.md` records the privacy and uncertainty boundary.

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

- Provider and API image-recognition tests pass, including malformed-base64 rejection and unavailable
  provider handling (6 AI package tests and 95 Worker API tests; 237 tests across the monorepo).
- Full lint, typecheck, coverage, and production build pass across all workspaces.
- D1 migrations, data validation, and dry-run complete without pending migrations or mutations.
- Dependency audit reports zero critical advisories; existing documented high advisories remain under
  repository policy.
- Expo config parsing and whitespace checks pass. Expo Doctor's remote schema check is subject to
  the transient HTML-response limitation documented in earlier phase acceptance reports.
