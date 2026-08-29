# Phase 3 Acceptance: Authentication and Roles Foundation

## 1. Overview

Phase 3 establishes the authentication, authorization, session management, and role-based access control (RBAC) foundation across the monorepo. The implementation covers the Cloudflare Worker API (`workers/api`), Web application (`apps/web`), Admin portal (`apps/admin`), React Native mobile client (`apps/mobile`), shared schemas (`packages/schemas`), and localization packages.

---

## 2. Technical Architecture & Cryptographic Boundaries

### Password Hashing & Verification

- **Algorithm**: `PBKDF2-HMAC-SHA256` using the Web Crypto API (`crypto.subtle`).
- **Iteration Bounds**: Clamped between `600,000` and `2,000,000` iterations. Out-of-range iteration values fail immediately before key derivation.
- **Salt & Hash Parameters**: 16-byte random salt, 32-byte derived key hash.
- **Comparison**: Constant-time byte-by-byte comparison (`crypto.subtle.timingSafeEqual` with length guard) to prevent timing side-channels.
- **Timing Equalization (`dummyVerify`)**: Fixed-cost dummy verification executed for non-existent users and disabled accounts to maintain consistent response latency.
- **Measured Benchmark**: Measured runtime for 600,000 PBKDF2 iterations in the Cloudflare Worker runtime is 465 ms to 474 ms.

### Session Management & Dual Transport

- **Opaque Session Tokens**: 32-byte cryptographically random tokens generated via `crypto.getRandomValues` and Base64URL-encoded.
- **D1 Storage**: Raw tokens are never persisted in the database; only SHA-256 hashes (`token_hash`) are stored in Cloudflare D1.
- **Web & Admin Transport**: `HttpOnly; SameSite=Lax` cookies with `__Host-nutriai_session` prefix and `Secure` flag in production, and `nutriai_session` in development. All client requests specify `credentials: 'include'`.
- **Mobile Transport**: Bearer token headers stored encrypted in device storage using `expo-secure-store`. Automatic token cleanup occurs exclusively on HTTP 401 Unauthorized responses. Session tokens are retained during network errors, timeouts, or 5xx server responses.
- **Mobile API Layer**: `MobileAuthApi` dynamically reads `EXPO_PUBLIC_API_URL` with a development fallback for non-production environments and throws an error if unconfigured in production. Errors are typed with HTTP status, error code, and details via `MobileApiError`.
- **Session Lifecycle**: Endpoints support single session termination (`POST /api/v1/auth/logout`) and multi-session revocation (`POST /api/v1/auth/logout-all`). Expired sessions return 401 `SESSION_EXPIRED`.

### Rate Limiting & Abuse Mitigation

- **Sliding Window**: Maximum 5 failed attempts per 15-minute sliding window per IP and email combination.
- **HMAC Identifier Hashing**: Plaintext IP and email addresses are never written to `auth_login_attempts`. All identifiers are hashed using `HMAC-SHA256` with `RATE_LIMIT_HMAC_SECRET`.
- **Stale Attempt Cleanup**: Login attempts older than the sliding window (15 minutes) are pruned from D1 during login processing and cleanup routines.
- **Environment Handling**: Missing `RATE_LIMIT_HMAC_SECRET` is permitted with a fallback in development and test environments, and fails closed with HTTP 503 `NOT_READY` in production and staging environments.

### CORS & CSRF Protections

- **CORS Configuration**: `Access-Control-Allow-Credentials: true` with explicit origin matching.
- **Preflight Support**: Handles `OPTIONS` preflight requests for `PATCH`, `POST`, and `DELETE`.
- **CSRF Defense**: Origin and Referer validation enforced on all cookie-authenticated mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).

### Shared Worker Environment (`AppEnv`)

- Strongly typed Hono context variables: `requestId`, `user` (`UserRecord`), `session` (`AuthSessionRecord`), and `tokenContext` (`cookie` | `bearer`).
- Elimination of untyped `any` and `as any` casts across routes, middleware, and database repositories.
- Safe D1 binding checks that return HTTP 503 `NOT_READY` if the database binding is unavailable.

---

## 3. Verified Monorepo Test Metrics & Coverage

All test suites execute real Vitest commands without placeholder, skipped, empty, or synthetic tests. Results are derived from a full, uncached execution (`turbo run test:coverage --force`):

| Workspace / Package     | Test Files | Passed Tests   | Stmts %  | Branch % | Funcs %  | Lines %  |
| :---------------------- | :--------- | :------------- | :------- | :------- | :------- | :------- |
| `packages/schemas`      | 1          | 6 passed       | 94.73%   | 100.00%  | 50.00%   | 94.73%   |
| `packages/localization` | 1          | 9 passed       | 95.00%   | 93.93%   | 100.00%  | 94.82%   |
| `packages/storage`      | 2          | 33 passed      | 98.13%   | 80.29%   | 100.00%  | 99.51%   |
| `packages/testing`      | 1          | 2 passed       | 100.00%  | 100.00%  | 100.00%  | 100.00%  |
| `workers/ai-jobs`       | 1          | 2 passed       | 100.00%  | 100.00%  | 100.00%  | 100.00%  |
| `workers/api`           | 4          | 36 passed      | 79.57%   | 57.87%   | 90.36%   | 79.86%   |
| `apps/web`              | 1          | 12 passed      | 93.10%   | 70.16%   | 92.68%   | 93.66%   |
| `apps/admin`            | 1          | 11 passed      | 94.06%   | 75.00%   | 96.77%   | 95.49%   |
| `apps/mobile`           | 1          | 17 passed      | 93.06%   | 78.50%   | 92.30%   | 94.92%   |
| **Total Monorepo**      | **13**     | **128 passed** | **PASS** | **PASS** | **PASS** | **PASS** |

_Note on Mobile Coverage_: Mobile coverage measures all executable application source files under `apps/mobile/src` (`src/App.tsx`, `src/auth/api.ts`, `src/auth/MobileAuthProvider.tsx`, `src/auth/MobileLoginScreen.tsx`, `src/auth/MobileRegisterScreen.tsx`), excluding only the entry point (`src/index.ts`) and TypeScript declaration/config files.

---

## 4. Verification Gate Results

1. `pnpm install --frozen-lockfile`: **PASS** (Lockfile is synchronized)
2. `pnpm format:check`: **PASS** (All files match Prettier standards)
3. `pnpm lint`: **PASS** (0 errors, 0 warnings across 11 packages)
4. `pnpm typecheck`: **PASS** (0 TypeScript errors across 11 packages)
5. `pnpm exec turbo run test:coverage --force`: **PASS** (128/128 tests passed across 13 test files)
6. `pnpm exec turbo run build --force`: **PASS** (All 11 packages and bundles built)
7. Fresh D1 Migrations: **PASS** (Applied `0001_system_metadata.sql` and `0002_auth_users.sql` to clean local persistence directory)
8. `pnpm audit --prod --audit-level=critical`: **PASS** (0 critical vulnerabilities, 2 high documented build-time dependencies)
9. `npx expo-doctor@latest`: **PASS** (18/18 checks passed)
10. `git diff --check`: **PASS** (0 whitespace or merge conflict markers)

---

## 5. Acceptance Status

Phase 3 is complete and verified against all functional, security, and architectural specifications.
