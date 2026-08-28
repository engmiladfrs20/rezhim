import { Hono } from 'hono';
import type { CloudflareEnv, ApiErrorResponse } from '@nutriai/types';
import { requestIdMiddleware } from './middleware/request-id';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health';
import { readinessRouter } from './routes/readiness';
import { systemRouter } from './routes/system';
import type { Context } from 'hono';

export type AppEnv = { Bindings: CloudflareEnv; Variables: { requestId: string } };
const app = new Hono<AppEnv>();

// Core Middleware
app.use('*', requestIdMiddleware);
app.use('*', securityHeadersMiddleware);

// Restrictive CORS
app.use('/api/*', corsMiddleware);

// Centralized Safe Error Handling
app.onError(errorHandler);

// Routes
app.get('/', (c) => c.text('NutriAI Persia API Worker (Cloudflare Hono)'));
app.route('/health', healthRouter);
app.route('/ready', readinessRouter);
app.route('/api/v1/system', systemRouter);

// Disabled Phase 1 placeholders
const notAvailableHandler = (c: Context<AppEnv>) => {
  const requestId = c.get('requestId') || c.req.header('X-Request-Id') || 'unknown';
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: 'FEATURE_NOT_AVAILABLE',
      message: 'This feature is disabled during Phase 1 & 2 boundaries.',
    },
    requestId,
  };
  return c.json(errorResponse, 501);
};

app.all('/api/storage/*', notAvailableHandler);
app.all('/api/ai/*', notAvailableHandler);

// 404 Fallback
app.notFound((c) => {
  const requestId = c.get('requestId') || c.req.header('X-Request-Id') || 'unknown';
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

export { app };
