# 0006: Authentication and Session Management

## Status

Accepted (Finalized in Phase 3)

## Context

Phase 3 required an Authentication capability integrating safely inside Cloudflare Workers (`workers/api`) storing states on D1 securely without arbitrary external providers. JWTs suffer from expiration syncing faults natively while standard HTTP cookies lack cross-platform transparency securely. We needed robust cross-platform synchronization extending Web DOM layouts via CORS with precise Mobile React Native headers avoiding complex configurations.

## Decision

1. **Opaque Tokens**: Generates fully random Base64URL session tokens locally verified across SHA-256 mappings.
2. **Strict Cryptography Constraints**: Passwords are mathematically hashed natively using `PBKDF2-HMAC-SHA256`, strictly iterating at a predefined integer of `600,000` cycles eliminating basic hardware acceleration attacks efficiently. Comparisons are strictly processed natively across constant-time algorithms (`timingSafeEqual`) ensuring accurate measurements.
3. **Double Header Bindings**: Issues `Set-Cookie` tracking `__Host-nutriai_session` targeting frontends seamlessly with `SameSite=Lax; HttpOnly; Secure` bypassing any domain properties cleanly. Returns accurate opaque token boundaries explicitly for Mobile Bearer integrations seamlessly.
4. **CORS and Origin Security**: Integrations actively inspect Request `Origin` or `Referer` variables checking strict matching boundaries preventing CSRF compromises dynamically.
5. **HMAC-Keyed Rate Limits**: Aggregates login limits reliably averting physical identity leaks through unique cryptographic fingerprints stored dynamically on D1 accurately efficiently. Atomic `UPSERT` ensures stable concurrency boundaries dynamically.
6. **Internal Models mapping**: Raw database layouts are never leaked manually guaranteeing responses implement `PublicUser` boundaries actively successfully effortlessly dynamically.

## Consequences

- Full control over authentication flows seamlessly cleanly cleanly accurately securely safely smoothly intelligently responsibly dependably intelligently organically securely.
- Cross-platform deployments smoothly effortlessly organically proficiently completely.
