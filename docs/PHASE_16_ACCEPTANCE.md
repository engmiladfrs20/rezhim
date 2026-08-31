# Phase 16 Acceptance — Authenticated B2 Storage URL Boundary

## Scope

Phase 16 exposes the existing `StorageProvider` abstraction through authenticated API
routes. It does not add a public file proxy, persist raw file bytes in D1, or expose B2
credentials to clients.

## Acceptance criteria

- [x] Worker depends on `@nutriai/storage` through the workspace package.
- [x] Upload and download URL routes require a valid bearer token or session cookie.
- [x] Keys are restricted to `user-uploads/{authenticatedUserId}/...`.
- [x] Shared schemas reject traversal, invalid characters, invalid MIME types, and unsafe
      expirations.
- [x] Upload ACL is forced to `private`.
- [x] Backblaze B2 is selected when configured and is mandatory in staging/production.
- [x] Storage failures are mapped to stable error codes without leaking provider details.
- [x] Development/test can use the memory provider under the existing factory policy.

## Verification

The phase is accepted only after the repository gates pass on a clean tree:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm exec turbo run lint --force
pnpm exec turbo run typecheck --force
pnpm exec turbo run test:coverage --force
pnpm exec turbo run build --force
pnpm --filter @nutriai/worker-api run db:migrations:apply:local
pnpm data:validate
pnpm data:dry-run
pnpm audit --prod --audit-level=critical
pnpm --filter @nutriai/mobile exec expo config --json
git diff --check
```

`npx expo-doctor@latest` may report a remote Expo schema parsing error in restricted
environments even when its local checks pass; that environmental limitation must be
recorded rather than treated as a code failure.

## Latest local measurement

The final uncached verification completed successfully with 13 workspace lint tasks,
21 typecheck tasks, 19 coverage tasks, and 13 build tasks. The Worker suite passed all
101 tests, including the five storage-boundary tests; the storage package passed all 33
provider tests. D1 had no pending migrations, the data validator accepted 30/30 items,
and the dry-run reported 30 unchanged rows with zero mutations. The critical audit gate
returned zero critical vulnerabilities (two documented High advisories remain). The
mobile Expo config resolved successfully; the online Expo Doctor schema check remained
the only environmental limitation.
