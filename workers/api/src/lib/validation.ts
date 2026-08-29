import type { Context } from 'hono';
import type { ApiErrorResponse } from '@nutriai/types';
import type { AppEnv } from '../types';

export type ParseJsonResult<T> =
  { success: true; data: T } | { success: false; response: Response };

export interface SchemaValidator<T> {
  safeParse(data: unknown):
    | { success: true; data: T }
    | {
        success: false;
        error: {
          issues: Array<{ message?: string }>;
          flatten: () => unknown;
        };
      };
}

/**
 * Validates request JSON body against a Zod schema.
 * Returns typed data or a 400 Bad Request error response.
 */
export async function parseJsonBody<T>(
  c: Context<AppEnv>,
  schema: SchemaValidator<T>,
): Promise<ParseJsonResult<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    const resp: ApiErrorResponse = {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON payload in request body.' },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return { success: false, response: c.json(resp, 400) };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const message = firstIssue?.message || 'Validation failed.';
    const resp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details: result.error.flatten(),
      },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return { success: false, response: c.json(resp, 400) };
  }

  return { success: true, data: result.data };
}
