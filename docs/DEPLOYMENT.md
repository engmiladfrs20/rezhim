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

```bash
wrangler secret put B2_KEY_ID
wrangler secret put B2_APPLICATION_KEY
wrangler secret put B2_BUCKET_NAME
wrangler secret put B2_ENDPOINT
wrangler secret put B2_REGION
```

## 3. Web & Admin Apps Deployment

Deploy static assets generated from `pnpm run build` in `apps/web/dist` and `apps/admin/dist` to Cloudflare Pages or any static CDN host.
