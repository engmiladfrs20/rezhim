import type { MiddlewareHandler } from 'hono';

const REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

export function sanitizeOrGenerateRequestId(clientRequestId: string | undefined | null): string {
  if (clientRequestId && REQUEST_ID_REGEX.test(clientRequestId)) {
    return clientRequestId;
  }
  return crypto.randomUUID();
}

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const clientHeader = c.req.header('X-Request-Id');
  const requestId = sanitizeOrGenerateRequestId(clientHeader);
  c.header('X-Request-Id', requestId);
  c.set('requestId', requestId);
  await next();
};
