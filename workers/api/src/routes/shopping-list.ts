import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { parseJsonBody } from '../lib/validation';
import {
  shoppingListCreateSchema,
  shoppingListQuerySchema,
  shoppingListUpdateSchema,
} from '@nutriai/schemas';
import type { ApiErrorResponse, ApiResponse, ShoppingListItem } from '@nutriai/types';
import { InventoryValidationError, ShoppingListItemNotFoundError } from '../db/errors';
import { ShoppingListService } from '../services/shopping-list.service';

export const shoppingListRouter = new Hono<AppEnv>();
shoppingListRouter.use('/*', authMiddleware);

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
    error: { code: 'SHOPPING_LIST_ITEM_NOT_FOUND', message: 'Shopping list item not found.' },
    requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
  };
  return c.json(response, 404);
}

shoppingListRouter.get('/', async (c) => {
  const parsed = shoppingListQuerySchema.safeParse({ status: c.req.query('status') });
  if (!parsed.success)
    return validationError(c, parsed.error.issues[0]?.message || 'Invalid status.');
  const items = await new ShoppingListService(c.env.DB!).list(c.get('user').id, parsed.data);
  const response: ApiResponse<{ items: ShoppingListItem[] }> = {
    success: true,
    data: { items },
    requestId: c.get('requestId'),
  };
  return c.json(response, 200);
});

shoppingListRouter.post('/', async (c) => {
  const parsed = await parseJsonBody(c, shoppingListCreateSchema);
  if (!parsed.success) return parsed.response;
  try {
    const item = await new ShoppingListService(c.env.DB!).create(c.get('user').id, parsed.data);
    const response: ApiResponse<{ item: ShoppingListItem }> = {
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

shoppingListRouter.patch('/:id', async (c) => {
  const parsed = await parseJsonBody(c, shoppingListUpdateSchema);
  if (!parsed.success) return parsed.response;
  try {
    const item = await new ShoppingListService(c.env.DB!).update(
      c.get('user').id,
      c.req.param('id'),
      parsed.data,
    );
    const response: ApiResponse<{ item: ShoppingListItem }> = {
      success: true,
      data: { item },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof ShoppingListItemNotFoundError) return notFound(c);
    if (err instanceof InventoryValidationError) return validationError(c, err.message);
    throw err;
  }
});

shoppingListRouter.delete('/:id', async (c) => {
  try {
    await new ShoppingListService(c.env.DB!).delete(c.get('user').id, c.req.param('id'));
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Shopping list item deleted.' },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof ShoppingListItemNotFoundError) return notFound(c);
    throw err;
  }
});
