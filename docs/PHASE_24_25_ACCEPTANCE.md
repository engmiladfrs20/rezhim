# Phases 24–25 Acceptance — Subscription Boundary & Security Analytics

## Subscription boundary

`GET /api/v1/subscription` returns a provider-neutral free entitlement when no subscription exists. `POST /api/v1/subscription/checkout` fails closed with HTTP 503 until a real billing provider, signed webhook verification, idempotency, and refund/cancellation policy are configured. The API never grants a paid entitlement based on a client request.

## Admin analytics

`GET /api/v1/admin/analytics/overview` is protected by the existing session, CSRF, and admin-role middleware. It reports aggregate counts only (users, foods, diary entries) and accepts an optional RFC3339 `since` window. It does not return passwords, tokens, email hashes, or row-level private diary data.

Production billing and analytics retention still require an explicit provider/data-retention decision before Phase 26 sign-off.
