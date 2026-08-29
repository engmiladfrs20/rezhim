import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

export const securityHeadersMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
  await next();
};
