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

**IMPORTANT:** Before any real deployment, you must explicitly replace the placeholder database IDs (`<database_id_staging>`, `<database_id_production>`) and domains inside `wrangler.jsonc`.

## 2. Cloudflare Secrets Management

Set the required Backblaze B2 credentials via Wrangler secrets:

````bash
wrangler secret put B2_KEY_ID
wrangler secret put B2_APPLICATION_KEY
wrangler secret put B2_BUCKET_NAME
wrangler secret put B2_ENDPOINT
wrangler secret put B2_REGION
wrangler secret put RATE_LIMIT_HMAC_SECRET

## 3. Initial Admin Bootstrap (No Default Passwords)

For security reasons, there are NO default admin credentials or automatic seed passwords. To create the first platform administrator:
1. Ensure the backend environment is deployed and migrations are applied.
2. Register a regular account via the frontend UX natively (e.g. `admin@yourdomain.com`).
3. Escalate the boundary explicitly leveraging Cloudflare D1 Shell:
```bash
# Staging / Remote D1
pnpm exec wrangler d1 execute DB --env production --remote --command "UPDATE users SET role = 'admin' WHERE email_normalized = 'admin@yourdomain.com';"
````

4. Subsequent administrators can now be managed efficiently through the Admin Web Interface independently.

```

## 3. Web & Admin Apps Deployment

Deploy static assets generated from `pnpm run build` in `apps/web/dist` and `apps/admin/dist` to Cloudflare Pages or any static CDN host.
```
