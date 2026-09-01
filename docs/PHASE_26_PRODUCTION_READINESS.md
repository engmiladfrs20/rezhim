# Phase 26 Production Readiness

## Completed in this repository

- Cloudflare OAuth login verified with Wrangler.
- Dedicated D1 databases and KV namespaces provisioned for development, staging, and production.
- Migrations 0001–0013 applied to all three D1 databases.
- Staging API deployed at `https://nutriai-api-staging.rezhimvip.workers.dev` and smoke-tested through registration, login, `/me`, lifestyle water, fasting, and daily summary.
- Production API deployed at `https://nutriai-api-production.rezhimvip.workers.dev`; `/health`, `/ready`, `/api/v1/system`, registration, and token login were smoke-tested.
- `RATE_LIMIT_HMAC_SECRET` is configured as a Worker secret for staging and production; the value is never committed.
- Backblaze B2 bucket `rezhim` is configured for both environments through non-secret endpoint/region/bucket variables; signed upload URL smoke tests returned 200 in staging and production.
- `B2_KEY_ID`, `B2_APPLICATION_KEY`, and `GEMINI_API_KEY` are stored as Worker secrets and are not present in the repository or client bundles.
- Local format, lint, typecheck, test/coverage, build, audit, and diff gates pass.

## Explicit blockers before public production traffic

- Keep the B2 bucket private, restrict the application key to the bucket and required operations, and rotate the test credentials that were exposed during setup.
- Gemini calls currently return `502 AI_PROVIDER_ERROR` from both deployed Workers and require verification of the supplied provider key/account or an approved egress endpoint before public traffic.
- Configure and verify the production allowed custom origins and billing provider/webhooks through secret management.
- Add a real browser/mobile end-to-end run and EAS signing/build credentials.
- Configure queue retry and dead-letter policy and deploy the AI jobs consumer after its job persistence contract is approved.
- Point DNS/custom domains at the production Worker only after the above checks and a rollback window are approved.
