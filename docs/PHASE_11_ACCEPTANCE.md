# Phase 11 Acceptance — Gemini AI Provider Gateway

## Scope

- `@nutriai/ai` defines a typed provider interface and Gemini HTTP adapter with no UI/database dependency.
- Requests are bounded (prompt 12,000 chars, system instruction 4,000 chars, output 16–4,096 tokens,
  temperature 0–1) and credentials remain server-side.
- `POST /api/v1/ai/generate` is authenticated, returns stable provider errors, and fails closed with
  `503 AI_UNAVAILABLE` when `GEMINI_API_KEY` is not configured.
- No client app receives provider credentials; no AI response or prompt is persisted in this phase.
- The adapter is mock-tested without external network calls; future coaching and multimodal jobs can
  reuse the same contract.

## Implementation

- `packages/ai/src/gemini.ts` implements the bounded Gemini adapter.
- `packages/ai/src/factory.ts` creates the provider only when a server secret exists.
- `packages/schemas/src/ai.ts` validates public request payloads.
- `workers/api/src/services/ai.service.ts` and `workers/api/src/routes/ai.ts` provide the authenticated gateway.
- `docs/ADR/0014-gemini-ai-provider-gateway.md` records the boundary and limitations.

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

- Provider unit tests: 2/2; gateway integration tests: 2/2.
- `pnpm install --frozen-lockfile`: lockfile is up to date.
- `pnpm format:check`: all files match Prettier style; `pnpm exec turbo run lint --force`: 13/13 passed.
- `pnpm exec turbo run typecheck --force`: 21/21 passed; `pnpm exec turbo run test:coverage --force`: 19/19 tasks passed.
- Full test count: 230/230 passed; Worker API 92 tests across 11 suites, nutrition 37 tests, and AI 2 tests.
- `pnpm exec turbo run build --force`: 13/13 workspaces built; mobile Expo export completed.
- Local migrations: no pending migrations; `pnpm data:validate`: 30/30 valid; `pnpm data:dry-run`: zero mutations.
- `pnpm audit --prod --audit-level=critical`: zero critical advisories (two documented high advisories remain under policy).
- `pnpm --filter @nutriai/mobile exec expo config --json`: valid SDK 52 configuration.
- `npx expo-doctor@latest`: 17/18 checks passed; the schema check received an HTML response from the remote Expo service (`Unexpected token '<'`), while local config parsing and all other checks passed.
- `git diff --check`: clean.
