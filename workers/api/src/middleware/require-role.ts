import type { Context, Next } from 'hono';
import type { ApiErrorResponse } from '@nutriai/types';
import type { AppEnv } from '../types';

export function requireRole(role: 'admin' | 'user') {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      const resp: ApiErrorResponse = {
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(resp, 401);
    }

    if (user.role !== role) {
      const resp: ApiErrorResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient privileges.',
        },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(resp, 403);
    }

    await next();
    return;
  };
}
