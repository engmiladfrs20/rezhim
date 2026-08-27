# NutriAI Persia - Deployment & Environment Guide

## 1. Cloudflare Workers Deployment

To deploy the API worker to Cloudflare:

```bash
# Staging Deployment
cd workers/api
pnpm run wrangler deploy --env staging

# Production Deployment
cd workers/api
pnpm run wrangler deploy --env production
```

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
