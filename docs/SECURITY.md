# Security Policy

## Identified Risks & Temporary Acceptances

### React Native & Metro inherited vulnerabilities

**Advisory:** CVE-2025-71329 / GHSA-5p2g-fcmc-qvqq & CVE-2025-71330 / GHSA-w3rx-r6r6-pgpr
**Component:** `image-size@2.0.2` used by `@react-native/community-cli-plugin` and `metro` (via `expo`)
**Severity:** High
**Practical Exposure:** Extremely Low. This dependency is only used indirectly in build-time CLI tools for resolving bundling and assets (Expo, Metro bundler). The application does not use this dependency to process untrusted images in server-side request paths. Malicious image vectors are strictly contained to developer workstations overriding the bundler pipeline.
**Currently Cannot Be Upgraded:** Expo/React Native strictly binds to a dependency resolution tree where `image-size` patches have not natively cascaded to an uncompromised version for `metro`.
**Compensating Controls:** Developer workstation antivirus policies. The library is absent from runtime APIs, cloud edge environments, or any backend logic processing untrusted inputs.
**Owner:** Core Maintainers (Milad)
**Review Date:** 2026-08-27
**Expiration Date:** 2026-10-27
**Upgrade/Removal Condition:** When `expo` or `@react-native` releases a patched `metro` dependency pipeline that adopts a secure version of `image-size`, or the underlying CLI plugins migrate from the affected package, the `image-size` overrides and exemptions will be pulled.

## Authentication and Session Management (Phase 3)

### Cryptographic Configuration

- **Hashing Algorithm:** PBKDF2 with HMAC-SHA256 (`PBKDF2-HMAC-SHA256`)
- **Iteration Count:** 600,000 minimum
- **Salt Generation:** 16-bytes securely random (`crypto.getRandomValues`)
- **Hash Dimensions:** 32-bytes securely random (`crypto.getRandomValues`)
- **Comparison Method:** Constant-time comparison (`crypto.subtle.timingSafeEqual`)

### Session Management Strategy

- Cloudflare D1 Database session storage
- Standardized opaque tokens generated with `crypto.getRandomValues(32)` encoded as Base64URL
- Origin/Referer CSRF protection for cookie-authenticated mutating requests

### Rate-Limiting Framework

- HMAC-SHA256 keyed IP and email identifiers mapped to a 15-minute sliding window.
- Atomic D1 UPSERT operations rejecting attempts beyond 5 failures per window.
