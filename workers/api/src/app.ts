import { Hono } from 'hono';
import type { ApiErrorResponse } from '@nutriai/types';
import type { AppEnv } from './types';
import { requestIdMiddleware } from './middleware/request-id';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/error-handler';
import { databaseMiddleware } from './middleware/database';
import { healthRouter } from './routes/health';
import { readinessRouter } from './routes/readiness';
import { systemRouter } from './routes/system';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { adminUsersRouter } from './routes/admin-users';

const app = new Hono<AppEnv>();

// Core Middleware
app.use('*', requestIdMiddleware);
app.use('*', securityHeadersMiddleware);

// Restrictive CORS
app.use('/api/*', corsMiddleware);
app.use('/api/v1/auth/*', databaseMiddleware);
app.use('/api/v1/users/*', databaseMiddleware);
app.use('/api/v1/admin/users/*', databaseMiddleware);

// Centralized Safe Error Handling
app.onError(errorHandler);

// Routes
app.get('/', (c) => c.text('NutriAI Persia API Worker (Cloudflare Hono)'));

app.route('/health', healthRouter);
app.route('/ready', readinessRouter);
app.route('/api/v1/system', systemRouter);
app.route('/api/v1/auth', authRouter);
app.route('/api/v1/users', usersRouter);
app.route('/api/v1/admin/users', adminUsersRouter);

// Disabled Phase 1 placeholders
app.all('/api/storage/*', (c) => {
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
});

app.all('/api/ai/*', (c) => {
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
});

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
