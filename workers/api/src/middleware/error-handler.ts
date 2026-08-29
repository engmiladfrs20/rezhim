import type { ErrorHandler } from 'hono';
import type { ApiErrorResponse } from '@nutriai/types';
import type { AppEnv } from '../types';

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId') || c.req.header('X-Request-Id') || 'unknown';

  // Safe internal structured JSON logging
  console.error(
    JSON.stringify({
      event: 'unhandled_error',
      requestId,
      service: c.env?.SERVICE_NAME || 'nutriai-api',
      environment: c.env?.APP_ENV || 'development',
      message: err.message,
      // Do not log stack traces or secrets
    }),
  );

  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred. Please try again later.',
    },
    requestId,
  };

  return c.json(errorResponse, 500);
};
