import { cors } from 'hono/cors';
import type { CloudflareEnv } from '@nutriai/types';

export function isAllowedOrigin(origin: string | undefined | null, env: CloudflareEnv): boolean {
  if (!origin) return false;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const appEnv = env.APP_ENV ?? 'development';

  // In development and test environments, allow exact localhost / loopback origins
  if (appEnv === 'development' || appEnv === 'test') {
    const isLocalhost =
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      (url.protocol === 'http:' || url.protocol === 'https:');
    if (isLocalhost) {
      return true;
    }
  }

  // Check against explicitly configured allowed origins in env
  if (env.ALLOWED_ORIGINS) {
    const allowedList = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
    for (const allowed of allowedList) {
      try {
        const allowedUrl = new URL(allowed);
        if (
          url.protocol === allowedUrl.protocol &&
          url.hostname === allowedUrl.hostname &&
          url.port === allowedUrl.port
        ) {
          return true;
        }
      } catch {
        // Skip malformed entries in allowedList
      }
    }
  }

  // Cloudflare Pages creates a new, immutable hostname for every production
  // deployment (for example, `9e41d4b7.nutriai-web.pages.dev`). These
  // hostnames are the same application as the canonical Pages domain and are
  // used for smoke testing before the custom/canonical alias is refreshed.
  // Allow only a single, DNS-label subdomain of our own Pages projects over
  // HTTPS; never accept arbitrary `pages.dev` origins or nested subdomains.
  if (
    url.protocol === 'https:' &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.(?:nutriai-web|nutriai-admin)\.pages\.dev$/i.test(
      url.hostname,
    )
  ) {
    return true;
  }

  return false;
}

export const corsMiddleware = cors({
  origin: (origin, c) => {
    const env = c.env as CloudflareEnv;
    if (isAllowedOrigin(origin, env)) {
      return origin;
    }
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  credentials: true,
  maxAge: 86400,
});
