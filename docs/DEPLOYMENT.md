# NutriAI Persia - Deployment & Environment Guide

## 1. Cloudflare Workers Deployment

To deploy the API worker to Cloudflare:

```bash
# Staging Deployment & Migrations
cd workers/api
pnpm exec wrangler d1 migrations apply DB --env staging --remote
pnpm exec wrangler deploy --env staging

# Production Deployment & Migrations
cd workers/api
pnpm exec wrangler d1 migrations apply DB --env production --remote
pnpm exec wrangler deploy --env production
```

**IMPORTANT:** The repository configuration contains the provisioned D1/KV/Queue IDs and the non-secret B2 endpoint, region, and bucket name. Review them before deploying to a different account.

## 2. Cloudflare Secrets Management

Only credentials belong in Worker secrets. The B2 endpoint, region, and bucket name are non-secret environment variables in `workers/api/wrangler.jsonc`:

```bash
wrangler secret put B2_KEY_ID --env staging
wrangler secret put B2_APPLICATION_KEY --env staging
wrangler secret put GEMINI_API_KEY --env staging
wrangler secret put RATE_LIMIT_HMAC_SECRET --env staging

wrangler secret put B2_KEY_ID --env production
wrangler secret put B2_APPLICATION_KEY --env production
wrangler secret put GEMINI_API_KEY --env production
wrangler secret put RATE_LIMIT_HMAC_SECRET --env production
```

Never place any of these values in the repository, a web bundle, a mobile `.env` file, or a client request. Rotate keys immediately if they are pasted into chat, logs, or source control.

## 3. Initial Admin Bootstrap (No Default Passwords)

For security reasons, there are NO default admin credentials or automatic seed passwords. To create the first platform administrator:

1. Ensure the backend environment is deployed and migrations are applied.
2. Register a regular account via the frontend UX natively (e.g. `admin@yourdomain.com`).
3. Escalate the boundary explicitly leveraging Cloudflare D1 Shell:

```bash
# Staging / Remote D1
pnpm exec wrangler d1 execute DB --env production --remote --command "UPDATE users SET role = 'admin' WHERE email_normalized = 'admin@yourdomain.com';"
```

4. Subsequent administrators can now be managed efficiently through the Admin Web Interface independently.

## 4. Web & Admin Apps Deployment

Deploy static assets generated from `pnpm run build` in `apps/web/dist` and `apps/admin/dist` to Cloudflare Pages or any static CDN host.
