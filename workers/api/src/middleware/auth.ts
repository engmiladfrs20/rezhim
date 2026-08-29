import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { ApiErrorResponse } from '@nutriai/types';
import type { AppEnv } from '../types';
import { AuthService } from '../services/auth.service';
import { isAllowedOrigin } from './cors';

export const AUTH_COOKIE_PROD = '__Host-nutriai_session';
export const AUTH_COOKIE_DEV = 'nutriai_session';

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const authService = new AuthService(c.env.DB);

  let rawToken: string | undefined;
  let tokenContext: 'cookie' | 'bearer' = 'cookie';

  // 1. Try Bearer Token
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    rawToken = authHeader.substring(7).trim();
    tokenContext = 'bearer';
  } else {
    // 2. Try Cookie
    const isProd = c.env.APP_ENV === 'production';
    const cookieName = isProd ? AUTH_COOKIE_PROD : AUTH_COOKIE_DEV;
    rawToken = getCookie(c, cookieName);
    tokenContext = 'cookie';
  }

  if (!rawToken) {
    const resp: ApiErrorResponse = {
      success: false,
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(resp, 401);
  }

  // 3. CSRF Origin Validation (only for cookie-based unsafe methods)
  if (tokenContext === 'cookie') {
    const method = c.req.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const origin = c.req.header('Origin') || c.req.header('Referer');

      if (!origin) {
        const resp: ApiErrorResponse = {
          success: false,
          error: { code: 'FORBIDDEN', message: 'CSRF token origin missing.' },
          requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
        };
        return c.json(resp, 403);
      }

      if (!isAllowedOrigin(origin, c.env)) {
        const resp: ApiErrorResponse = {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Origin restricted.' },
          requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
        };
        return c.json(resp, 403);
      }
    }
  }

  // 4. Validate Token
  const validated = await authService.validateAndTouchToken(rawToken);
  if (!validated) {
    const resp: ApiErrorResponse = {
      success: false,
      error: { code: 'SESSION_EXPIRED', message: 'Session expired or invalidated.' },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(resp, 401);
  }

  // 5. Inject Context
  c.set('user', validated.user);
  c.set('session', validated.session);
  c.set('tokenContext', tokenContext);

  await next();
  return;
}
