import { Hono } from 'hono';
import type { ApiErrorResponse, ApiResponse, AdminAnalyticsOverview } from '@nutriai/types';
import { adminAnalyticsQuerySchema } from '@nutriai/schemas';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/require-role';

export const adminAnalyticsRouter = new Hono<AppEnv>();
adminAnalyticsRouter.use('/*', authMiddleware, requireRole('admin'));

adminAnalyticsRouter.get('/overview', async (c) => {
  const parsed = adminAnalyticsQuerySchema.safeParse({ since: c.req.query('since') || undefined });
  if (!parsed.success) {
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid since timestamp.' },
      requestId: c.get('requestId'),
    };
    return c.json(response, 400);
  }
  const since = parsed.data.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const db = c.env.DB!;
  const [
    users,
    activeUsers,
    disabledUsers,
    newUsers,
    foods,
    activeFoods,
    draftFoods,
    diary,
    recentDiary,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'active'")
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'disabled'")
      .first<{ count: number }>(),
    db
      .prepare('SELECT COUNT(*) AS count FROM users WHERE created_at >= ?')
      .bind(since)
      .first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) AS count FROM foods').first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM foods WHERE status = 'active'")
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM foods WHERE status = 'draft'")
      .first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) AS count FROM food_diary_entries').first<{ count: number }>(),
    db
      .prepare('SELECT COUNT(*) AS count FROM food_diary_entries WHERE created_at >= ?')
      .bind(since)
      .first<{ count: number }>(),
  ]);
  const data: AdminAnalyticsOverview = {
    users: {
      total: Number(users?.count ?? 0),
      active: Number(activeUsers?.count ?? 0),
      disabled: Number(disabledUsers?.count ?? 0),
      newSince: Number(newUsers?.count ?? 0),
    },
    foods: {
      total: Number(foods?.count ?? 0),
      active: Number(activeFoods?.count ?? 0),
      draft: Number(draftFoods?.count ?? 0),
    },
    diary: {
      entries: Number(diary?.count ?? 0),
      entriesSince: Number(recentDiary?.count ?? 0),
    },
  };
  const response: ApiResponse<AdminAnalyticsOverview> = {
    success: true,
    data,
    requestId: c.get('requestId'),
  };
  return c.json(response, 200);
});
