import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { CloudflareEnv, HealthCheckResponse, ApiErrorResponse } from '@nutriai/types';
import { CloudflareEnvSchema } from '@nutriai/schemas';

const REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

export function sanitizeOrGenerateRequestId(clientRequestId: string | undefined | null): string {
  if (clientRequestId && REQUEST_ID_REGEX.test(clientRequestId)) {
    return clientRequestId;
  }
  return crypto.randomUUID();
}

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

  // Exact domain matches for production/staging
  if (
    url.protocol === 'https:' &&
    (url.hostname === 'nutriai.persia' ||
      url.hostname === 'app.nutriai.persia' ||
      url.hostname === 'admin.nutriai.persia')
  ) {
    return true;
  }

  return false;
}

const app = new Hono<{ Bindings: CloudflareEnv }>();

// Request ID & Security Headers Middleware
app.use('*', async (c, next) => {
  const clientHeader = c.req.header('X-Request-Id');
  const requestId = sanitizeOrGenerateRequestId(clientHeader);
  c.header('X-Request-Id', requestId);

  // Essential baseline security headers for Workers
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");

  await next();
});

// Restrictive CORS
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      const env = c.env || {};
      if (isAllowedOrigin(origin, env)) {
        return origin;
      }
      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    maxAge: 86400,
  }),
);

// Safe Centralized Error Handler
app.onError((err, c) => {
  const clientHeader = c.res.headers.get('X-Request-Id') ?? c.req.header('X-Request-Id');
  const requestId = sanitizeOrGenerateRequestId(clientHeader);

  // Safe internal logging without exposing sensitive data/secrets
  console.error(`[Worker Error][Req: ${requestId}]`, err.message);

  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred. Please try again later.',
    },
    requestId,
  };

  return c.json(errorResponse, 500);
});

// Root & Health Check Endpoint
app.get('/', (c) => {
  return c.text('NutriAI Persia API Worker (Cloudflare Hono)');
});

app.get('/health', (c) => {
  const validatedEnv = CloudflareEnvSchema.parse(c.env || {});

  const response: HealthCheckResponse = {
    status: 'ok',
    service: validatedEnv.SERVICE_NAME,
    version: validatedEnv.APP_VERSION,
    timestamp: new Date().toISOString(),
  };

  return c.json(response, 200);
});

// Phase 1 Protected / Disabled Storage & AI Endpoint Placeholders
// (Prevents unauthenticated usage; Phase 2 will implement authenticated routes)
app.all('/api/storage/*', (c) => {
  const clientHeader = c.res.headers.get('X-Request-Id') ?? c.req.header('X-Request-Id');
  const requestId = sanitizeOrGenerateRequestId(clientHeader);
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: 'PHASE_1_PLACEHOLDER',
      message:
        'Direct unauthenticated storage operations are disabled in Phase 1. Authentication and secure authorization will be enabled in Phase 2.',
    },
    requestId,
  };
  return c.json(errorResponse, 501);
});

app.all('/api/ai/*', (c) => {
  const clientHeader = c.res.headers.get('X-Request-Id') ?? c.req.header('X-Request-Id');
  const requestId = sanitizeOrGenerateRequestId(clientHeader);
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: 'PHASE_1_PLACEHOLDER',
      message:
        'AI inference endpoints are disabled in Phase 1 baseline architecture and will be integrated with quota-protected queues in Phase 2.',
    },
    requestId,
  };
  return c.json(errorResponse, 501);
});

// 404 Fallback
app.notFound((c) => {
  const clientHeader = c.res.headers.get('X-Request-Id') ?? c.req.header('X-Request-Id');
  const requestId = sanitizeOrGenerateRequestId(clientHeader);
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested API route was not found.',
    },
    requestId,
  };
  return c.json(errorResponse, 404);
});

export default {
  fetch: app.fetch,
};
