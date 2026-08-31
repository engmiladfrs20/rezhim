import { Hono, type Context } from 'hono';
import type { ApiErrorResponse, ApiResponse, WeightEntry, WeightTrend } from '@nutriai/types';
import {
  weightEntryCreateSchema,
  weightEntryUpdateSchema,
  weightTrendQuerySchema,
} from '@nutriai/schemas';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { parseJsonBody } from '../lib/validation';
import { ProgressService, WeightEntryNotFoundError } from '../services/progress.service';
import { DatabaseError } from '../db/errors';

export const progressRouter = new Hono<AppEnv>();
progressRouter.use('/*', authMiddleware);

function errorResponse(c: Context<AppEnv>, code: string, message: string, status: 400 | 404 | 409) {
  const response: ApiErrorResponse = {
    success: false,
    error: { code, message },
    requestId: c.get('requestId'),
  };
  return c.json(response, status);
}

progressRouter.get('/weight/trend', async (c) => {
  const parsed = weightTrendQuerySchema.safeParse({
    from: c.req.query('from'),
    to: c.req.query('to'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success)
    return errorResponse(c, 'VALIDATION_ERROR', 'Invalid weight trend query.', 400);
  try {
    const result = await ProgressService.fromDatabase(c.env.DB!).list(
      c.get('user').id,
      parsed.data,
    );
    const response: ApiResponse<WeightTrend> = {
      success: true,
      data: result,
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === 'VALIDATION_ERROR') {
      return errorResponse(c, 'VALIDATION_ERROR', error.message, 400);
    }
    throw error;
  }
});

progressRouter.get('/weight', async (c) => {
  const parsed = weightTrendQuerySchema.safeParse({
    from: c.req.query('from'),
    to: c.req.query('to'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success)
    return errorResponse(c, 'VALIDATION_ERROR', 'Invalid weight trend query.', 400);
  const result = await ProgressService.fromDatabase(c.env.DB!).list(c.get('user').id, parsed.data);
  const response: ApiResponse<{ entries: WeightEntry[] }> = {
    success: true,
    data: { entries: result.entries },
    requestId: c.get('requestId'),
  };
  return c.json(response, 200);
});

progressRouter.post('/weight', async (c) => {
  const parsed = await parseJsonBody(c, weightEntryCreateSchema);
  if (!parsed.success) return parsed.response;
  try {
    const entry = await ProgressService.fromDatabase(c.env.DB!).create(
      c.get('user').id,
      parsed.data,
    );
    const response: ApiResponse<{ entry: WeightEntry }> = {
      success: true,
      data: { entry },
      requestId: c.get('requestId'),
    };
    return c.json(response, 201);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === 'CONFLICT')
      return errorResponse(c, 'CONFLICT', error.message, 409);
    throw error;
  }
});

progressRouter.patch('/weight/:id', async (c) => {
  const parsed = await parseJsonBody(c, weightEntryUpdateSchema);
  if (!parsed.success) return parsed.response;
  try {
    const entry = await ProgressService.fromDatabase(c.env.DB!).update(
      c.get('user').id,
      c.req.param('id'),
      parsed.data,
    );
    const response: ApiResponse<{ entry: WeightEntry }> = {
      success: true,
      data: { entry },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (error) {
    if (error instanceof WeightEntryNotFoundError)
      return errorResponse(c, 'WEIGHT_ENTRY_NOT_FOUND', error.message, 404);
    if (error instanceof DatabaseError && error.code === 'CONFLICT')
      return errorResponse(c, 'CONFLICT', error.message, 409);
    throw error;
  }
});

progressRouter.delete('/weight/:id', async (c) => {
  try {
    await ProgressService.fromDatabase(c.env.DB!).delete(c.get('user').id, c.req.param('id'));
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Weight entry deleted.' },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (error) {
    if (error instanceof WeightEntryNotFoundError)
      return errorResponse(c, 'WEIGHT_ENTRY_NOT_FOUND', error.message, 404);
    throw error;
  }
});
