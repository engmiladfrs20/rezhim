import type { MiddlewareHandler } from 'hono';
import type { ApiErrorResponse } from '@nutriai/types';
import type { AppEnv } from '../types';

/** Fail closed when a route that needs D1 is started without its binding. */
export const databaseMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.env.DB) {
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'NOT_READY', message: 'Database binding is unavailable.' },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(response, 503);
  }

  await next();
  return;
};
