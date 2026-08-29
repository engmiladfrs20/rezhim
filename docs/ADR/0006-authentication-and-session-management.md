# 0006: Authentication and Session Management

## Status

Accepted (Phase 3)

## Context

Phase 3 requires an authentication and session management architecture within Cloudflare Workers (`workers/api`) backed by Cloudflare D1 storage. We chose opaque database-backed sessions over stateless JWTs to avoid revocation complexity and token state synchronization issues, while supporting both cookie-based web clients and token-based mobile clients.

## Decision

1. **Opaque Session Tokens**: High-entropy random tokens generated via `crypto.getRandomValues`. Raw tokens are never persisted to D1; only their SHA-256 hashes are stored.
2. **Password Cryptography**: Passwords use `PBKDF2-HMAC-SHA256` via the Web Crypto API with 600,000 iterations, 16-byte random salt, and 32-byte derived key hash. Byte comparisons use constant-time checking to eliminate timing side-channels, and non-existent users trigger dummy verification.
3. **Dual Transport Architecture**:
   - Web and Admin frontends use `HttpOnly; SameSite=Lax` session cookies (`__Host-nutriai_session` with `Secure` in production).
   - Mobile clients receive the bearer token in the JSON response body and store it encrypted in device storage using `expo-secure-store`.
4. **CSRF & Origin Verification**: Mutating cookie requests validate `Origin` and `Referer` headers against configured allowed origins.
5. **HMAC-Keyed Rate Limiting**: Login rate limits are tracked in D1 using HMAC-SHA256 hashed IP and email identifiers (5 attempts per 15-minute sliding window). Plaintext IPs and emails are not persisted in attempt logs.
6. **Data Minimization**: Database records are transformed to `PublicUser` objects before response serialization, stripping all password and token hashes.

## Consequences

- Direct control over session lifecycle, revocation (`logout-all`), and account status.
- Unified backend API supporting web, admin, and mobile clients with appropriate transport security for each platform.
- Cryptographic execution within Cloudflare Worker CPU limits.
