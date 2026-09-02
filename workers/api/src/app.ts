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
import { foodsRouter } from './routes/foods';
import { foodCategoriesRouter } from './routes/food-categories';
import { nutrientsRouter } from './routes/nutrients';
import { adminFoodsRouter } from './routes/admin-foods';
import { nutritionRouter } from './routes/nutrition';
import { diaryRouter } from './routes/diary';
import { mealPlansRouter } from './routes/meal-plans';
import { substitutionsRouter } from './routes/substitutions';
import { aiRouter } from './routes/ai';
import { storageRouter } from './routes/storage';
import { recipesRouter } from './routes/recipes';
import { pantryRouter } from './routes/pantry';
import { shoppingListRouter } from './routes/shopping-list';
import { progressRouter } from './routes/progress';
import { lifestyleRouter } from './routes/lifestyle';
import { subscriptionRouter } from './routes/subscription';
import { adminAnalyticsRouter } from './routes/admin-analytics';

const app = new Hono<AppEnv>();

// Core Middleware
app.use('*', requestIdMiddleware);
app.use('*', securityHeadersMiddleware);

// Restrictive CORS
app.use('/api/*', corsMiddleware);
// The public liveness/readiness probes are called directly from the web dashboard.
// Apply the same origin policy here as for API routes so browsers do not fall back
// to a misleading local mock when the real health endpoint is reachable.
app.use('/health', corsMiddleware);
app.use('/ready', corsMiddleware);
app.use('/api/v1/auth/*', databaseMiddleware);
app.use('/api/v1/users/*', databaseMiddleware);
app.use('/api/v1/admin/users/*', databaseMiddleware);
app.use('/api/v1/foods/*', databaseMiddleware);
app.use('/api/v1/food-categories/*', databaseMiddleware);
app.use('/api/v1/nutrients/*', databaseMiddleware);
app.use('/api/v1/admin/foods/*', databaseMiddleware);
app.use('/api/v1/nutrition/*', databaseMiddleware);
app.use('/api/v1/diary/*', databaseMiddleware);
app.use('/api/v1/meal-plans/*', databaseMiddleware);
app.use('/api/v1/substitutions/*', databaseMiddleware);
app.use('/api/v1/ai/*', databaseMiddleware);
app.use('/api/v1/storage/*', databaseMiddleware);
app.use('/api/v1/recipes/*', databaseMiddleware);
app.use('/api/v1/pantry/*', databaseMiddleware);
app.use('/api/v1/shopping-list/*', databaseMiddleware);
app.use('/api/v1/progress/*', databaseMiddleware);
app.use('/api/v1/lifestyle/*', databaseMiddleware);
app.use('/api/v1/subscription/*', databaseMiddleware);
app.use('/api/v1/admin/analytics/*', databaseMiddleware);

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
app.route('/api/v1/foods', foodsRouter);
app.route('/api/v1/food-categories', foodCategoriesRouter);
app.route('/api/v1/nutrients', nutrientsRouter);
app.route('/api/v1/admin/foods', adminFoodsRouter);
app.route('/api/v1/nutrition', nutritionRouter);
app.route('/api/v1/diary', diaryRouter);
app.route('/api/v1/meal-plans', mealPlansRouter);
app.route('/api/v1/substitutions', substitutionsRouter);
app.route('/api/v1/ai', aiRouter);
app.route('/api/v1/storage', storageRouter);
app.route('/api/v1/recipes', recipesRouter);
app.route('/api/v1/pantry', pantryRouter);
app.route('/api/v1/shopping-list', shoppingListRouter);
app.route('/api/v1/progress', progressRouter);
app.route('/api/v1/lifestyle', lifestyleRouter);
app.route('/api/v1/subscription', subscriptionRouter);
app.route('/api/v1/admin/analytics', adminAnalyticsRouter);

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
