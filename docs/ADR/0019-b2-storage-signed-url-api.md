# ADR 0019: Authenticated Backblaze B2 Signed URL API

## Status

Accepted — Phase 16.

## Context

The monorepo already contains a provider-neutral `StorageProvider` abstraction and a
Backblaze B2 S3-compatible implementation. The API needs a safe way for authenticated
clients to upload media without proxying file bytes through the Worker or exposing B2
credentials.

## Decision

- Expose `POST /api/v1/storage/signed-upload-url` and
  `POST /api/v1/storage/signed-download-url` behind the existing authentication and D1
  readiness middleware.
- Require object keys to be under `user-uploads/{authenticatedUserId}/`. A user cannot
  request a URL for another user's namespace.
- Validate MIME type, key characters, and expiry using the shared Zod schemas. Expiry is
  limited to 60 seconds through 24 hours at the API boundary.
- Force upload ACL to `private`, regardless of a client-supplied value.
- Use Backblaze B2 whenever configured and always in staging/production. The memory
  provider is allowed only in development/test, and missing production configuration
  returns a safe error without attempting an external call.
- Return only signed URL metadata (`url`, `expiresAt`, and HTTP method). B2 credentials,
  provider internals, and raw storage exception messages are never returned.

The Worker signs requests; clients upload/download directly to B2. This keeps large
payloads out of Worker memory and preserves the existing provider abstraction for future
storage migrations.

## Consequences

The client must generate a user-scoped key and perform the actual PUT/GET against the
returned URL. Development uses deterministic memory-provider URLs for contract testing;
production deployments must provision B2 secrets through the deployment environment.
