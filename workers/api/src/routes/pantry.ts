import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { parseJsonBody } from '../lib/validation';
import { pantryCreateSchema, pantryListQuerySchema, pantryUpdateSchema } from '@nutriai/schemas';
import type { ApiErrorResponse, ApiResponse, PantryItem } from '@nutriai/types';
import { InventoryValidationError, PantryItemNotFoundError } from '../db/errors';
import { PantryService } from '../services/pantry.service';

export const pantryRouter = new Hono<AppEnv>();
pantryRouter.use('/*', authMiddleware);

function validationError(c: Context<AppEnv>, message: string) {
  const response: ApiErrorResponse = {
    success: false,
    error: { code: 'VALIDATION_ERROR', message },
    requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
  };
  return c.json(response, 400);
}

function notFound(c: Context<AppEnv>) {
  const response: ApiErrorResponse = {
    success: false,
    error: { code: 'PANTRY_ITEM_NOT_FOUND', message: 'Pantry item not found.' },
    requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
  };
  return c.json(response, 404);
}

pantryRouter.get('/', async (c) => {
  const parsed = pantryListQuerySchema.safeParse({ location: c.req.query('location') });
  if (!parsed.success)
    return validationError(c, parsed.error.issues[0]?.message || 'Invalid location.');
  const items = await new PantryService(c.env.DB!).list(c.get('user').id, parsed.data);
  const response: ApiResponse<{ items: PantryItem[] }> = {
    success: true,
    data: { items },
    requestId: c.get('requestId'),
  };
  return c.json(response, 200);
});

pantryRouter.post('/', async (c) => {
  const parsed = await parseJsonBody(c, pantryCreateSchema);
  if (!parsed.success) return parsed.response;
  try {
    const item = await new PantryService(c.env.DB!).create(c.get('user').id, parsed.data);
    const response: ApiResponse<{ item: PantryItem }> = {
      success: true,
      data: { item },
      requestId: c.get('requestId'),
    };
    return c.json(response, 201);
  } catch (err) {
    if (err instanceof InventoryValidationError) return validationError(c, err.message);
    throw err;
  }
});

pantryRouter.patch('/:id', async (c) => {
  const parsed = await parseJsonBody(c, pantryUpdateSchema);
  if (!parsed.success) return parsed.response;
  try {
    const item = await new PantryService(c.env.DB!).update(
      c.get('user').id,
      c.req.param('id'),
      parsed.data,
    );
    const response: ApiResponse<{ item: PantryItem }> = {
      success: true,
      data: { item },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof PantryItemNotFoundError) return notFound(c);
    if (err instanceof InventoryValidationError) return validationError(c, err.message);
    throw err;
  }
});

pantryRouter.delete('/:id', async (c) => {
  try {
    await new PantryService(c.env.DB!).delete(c.get('user').id, c.req.param('id'));
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Pantry item deleted.' },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof PantryItemNotFoundError) return notFound(c);
    throw err;
  }
});
