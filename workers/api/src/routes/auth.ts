import { Hono } from 'hono';
import type { Context } from 'hono';
import { toPublicUser } from '../services/auth.mapper';
import { setCookie, deleteCookie } from 'hono/cookie';
import { registerSchema, loginSchema, changePasswordSchema } from '@nutriai/schemas';
import { AuthService, AppError } from '../services/auth.service';
import { authMiddleware } from '../middleware/auth';
import type { CloudflareEnv, ApiErrorResponse } from '@nutriai/types';
import type { AppEnv } from '../types';
import { SessionRepository } from '../db/session.repository';
import { PasswordService } from '../services/password.service';
import { UserRepository } from '../db/user.repository';
import { parseJsonBody } from '../lib/validation';

export const authRouter = new Hono<AppEnv>();

export const AUTH_COOKIE_PROD = '__Host-nutriai_session';
export const AUTH_COOKIE_DEV = 'nutriai_session';

function isDeployedEnvironment(c: Context<AppEnv>): boolean {
  return c.env.APP_ENV === 'staging' || c.env.APP_ENV === 'production';
}

export function applyAuthCookie(c: Context<AppEnv>, token: string): void {
  const isProd = c.env.APP_ENV === 'production';
  const isDeployed = isDeployedEnvironment(c);
  const cookieName = isProd ? AUTH_COOKIE_PROD : AUTH_COOKIE_DEV;
  setCookie(c, cookieName, token, {
    path: '/',
    // Pages and the Worker live on different sites in the hosted setup. A
    // cross-site credentialed fetch requires SameSite=None and Secure.
    secure: isDeployed,
    httpOnly: true,
    sameSite: isDeployed ? 'None' : 'Lax',
    maxAge: 14 * 24 * 60 * 60, // 14 Days
  });
}

export function clearAuthCookie(c: Context<AppEnv>): void {
  const isProd = c.env.APP_ENV === 'production';
  const isDeployed = isDeployedEnvironment(c);
  const cookieName = isProd ? AUTH_COOKIE_PROD : AUTH_COOKIE_DEV;
  deleteCookie(c, cookieName, {
    path: '/',
    secure: isDeployed,
    sameSite: isDeployed ? 'None' : 'Lax',
  });
}

/**
 * Returns HMAC secret for rate limiting.
 * In staging/production, a missing secret returns null and causes a 503 response.
 */
export function getRateLimitHmacSecret(env: CloudflareEnv): string | null {
  if (env.RATE_LIMIT_HMAC_SECRET) {
    return env.RATE_LIMIT_HMAC_SECRET;
  }
  const appEnv = env.APP_ENV ?? 'development';
  if (appEnv === 'staging' || appEnv === 'production') {
    return null;
  }
  return 'fallback-dev-hmac-secret';
}

authRouter.post('/register', async (c) => {
  const parsed = await parseJsonBody(c, registerSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const authService = new AuthService(c.env.DB);
  try {
    const user = await authService.register(parsed.data);
    return c.json({ success: true, data: { user } }, 201);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      const resp: ApiErrorResponse = {
        success: false,
        error: { code: err.code, message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(resp, err.code === 'EMAIL_ALREADY_EXISTS' ? 409 : 400);
    }
    throw err;
  }
});

authRouter.post('/login', async (c) => {
  const parsed = await parseJsonBody(c, loginSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const secret = getRateLimitHmacSecret(c.env);
  if (!secret) {
    const resp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'NOT_READY',
        message: 'Server configuration error: RATE_LIMIT_HMAC_SECRET missing.',
      },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(resp, 503);
  }

  const authService = new AuthService(c.env.DB);
  const ipStr = c.req.header('CF-Connecting-IP') || 'unknown';

  try {
    const { rawToken, user } = await authService.login(parsed.data, ipStr, secret);
    applyAuthCookie(c, rawToken);
    return c.json({ success: true, data: { user } }, 200);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      const isRateLimited = err.code === 'RATE_LIMITED';
      const isInvalidCredentials = err.code === 'INVALID_CREDENTIALS';
      const statusCode = isRateLimited ? 429 : isInvalidCredentials ? 401 : 400;

      if (isRateLimited) {
        c.header('Retry-After', '900');
      }

      const resp: ApiErrorResponse = {
        success: false,
        error: { code: err.code, message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(resp, statusCode);
    }
    throw err;
  }
});

authRouter.post('/token', async (c) => {
  const parsed = await parseJsonBody(c, loginSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const secret = getRateLimitHmacSecret(c.env);
  if (!secret) {
    const resp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'NOT_READY',
        message: 'Server configuration error: RATE_LIMIT_HMAC_SECRET missing.',
      },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(resp, 503);
  }

  const authService = new AuthService(c.env.DB);
  const ipStr = c.req.header('CF-Connecting-IP') || 'unknown-native';

  try {
    const { rawToken, user } = await authService.login(parsed.data, ipStr, secret);
    return c.json({ success: true, data: { user, token: rawToken } }, 200);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      const isRateLimited = err.code === 'RATE_LIMITED';
      const isInvalidCredentials = err.code === 'INVALID_CREDENTIALS';
      const statusCode = isRateLimited ? 429 : isInvalidCredentials ? 401 : 400;

      if (isRateLimited) {
        c.header('Retry-After', '900');
      }

      const resp: ApiErrorResponse = {
        success: false,
        error: { code: err.code, message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(resp, statusCode);
    }
    throw err;
  }
});

authRouter.use('/*', authMiddleware);

authRouter.get('/me', async (c) => {
  const user = c.get('user');
  return c.json({ success: true, data: { user: toPublicUser(user) } }, 200);
});

authRouter.post('/logout', async (c) => {
  const session = c.get('session');
  const sessionRepo = new SessionRepository(c.env.DB);

  await sessionRepo.revokeSession(session.id, new Date().toISOString());
  clearAuthCookie(c);

  return c.json({ success: true, data: null }, 200);
});

authRouter.post('/logout-all', async (c) => {
  const user = c.get('user');
  const sessionRepo = new SessionRepository(c.env.DB);

  await sessionRepo.revokeAllUserSessions(user.id, new Date().toISOString());
  clearAuthCookie(c);

  return c.json({ success: true, data: null }, 200);
});

authRouter.post('/change-password', async (c) => {
  const parsed = await parseJsonBody(c, changePasswordSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const user = c.get('user');
  const session = c.get('session');
  const data = parsed.data;

  const userRepo = new UserRepository(c.env.DB);
  const sessionRepo = new SessionRepository(c.env.DB);

  const fullAccount = await userRepo.findById(user.id);
  if (!fullAccount) {
    const errorResp: ApiErrorResponse = {
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(errorResp, 404);
  }

  const matched = await PasswordService.verify(
    data.current_password,
    fullAccount.password_hash,
    fullAccount.password_salt,
    fullAccount.password_iterations,
    fullAccount.password_algorithm,
  );

  if (!matched) {
    const errorResp: ApiErrorResponse = {
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Current password provided is incorrect.' },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(errorResp, 401);
  }

  const { hash, salt, iterations, algorithm } = await PasswordService.hash(data.new_password);

  const nowTs = new Date().toISOString();
  await userRepo.updatePassword(user.id, hash, salt, iterations, algorithm, nowTs);
  await sessionRepo.revokeOtherUserSessions(user.id, session.id, nowTs);

  return c.json({ success: true, data: null }, 200);
});
