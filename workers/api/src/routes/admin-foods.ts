import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/require-role';
import { FoodService } from '../services/food.service';
import { parseJsonBody } from '../lib/validation';
import {
  createFoodSchema,
  updateFoodSchema,
  createFoodCategorySchema,
  adminFoodListQuerySchema,
} from '@nutriai/schemas';
import { FoodNotFoundError, FoodConflictError, FoodValidationError } from '../db/errors';
import type {
  ApiResponse,
  ApiErrorResponse,
  FoodDetail,
  FoodSummary,
  FoodCategoryDetail,
  FoodSource,
  PaginatedResult,
} from '@nutriai/types';

export const adminFoodsRouter = new Hono<AppEnv>();

adminFoodsRouter.use('/*', authMiddleware, requireRole('admin'));

adminFoodsRouter.get('/', async (c) => {
  const queryResult = adminFoodListQuerySchema.safeParse({
    status: c.req.query('status') || 'all',
    category_id: c.req.query('category_id') || undefined,
    locale: c.req.query('locale') || 'fa',
    cursor: c.req.query('cursor') || undefined,
    limit: c.req.query('limit') || 20,
  });

  if (!queryResult.success) {
    const errResp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        details: queryResult.error.flatten(),
      },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(errResp, 400);
  }

  const foodService = new FoodService(c.env.DB!);
  const result = await foodService.getAdminFoodList(queryResult.data);

  const response: ApiResponse<PaginatedResult<FoodSummary>> = {
    success: true,
    data: result,
    requestId: c.get('requestId'),
  };

  return c.json(response, 200);
});

adminFoodsRouter.post('/', async (c) => {
  const parsed = await parseJsonBody(c, createFoodSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const foodService = new FoodService(c.env.DB!);
  try {
    const food = await foodService.createFood(parsed.data);
    const response: ApiResponse<{ food: FoodDetail }> = {
      success: true,
      data: { food },
      requestId: c.get('requestId'),
    };
    return c.json(response, 201);
  } catch (err) {
    if (err instanceof FoodConflictError) {
      const errResp: ApiErrorResponse = {
        success: false,
        error: { code: 'CONFLICT', message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(errResp, 409);
    }
    if (err instanceof FoodValidationError) {
      const errResp: ApiErrorResponse = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(errResp, 400);
    }
    throw err;
  }
});

adminFoodsRouter.get('/categories', async (c) => {
  const foodService = new FoodService(c.env.DB!);
  const categories = await foodService.listAdminCategories();

  const response: ApiResponse<{ categories: FoodCategoryDetail[] }> = {
    success: true,
    data: { categories },
    requestId: c.get('requestId'),
  };

  return c.json(response, 200);
});

adminFoodsRouter.post('/categories', async (c) => {
  const parsed = await parseJsonBody(c, createFoodCategorySchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const foodService = new FoodService(c.env.DB!);
  try {
    const category = await foodService.createCategory(parsed.data);
    const response: ApiResponse<{ category: FoodCategoryDetail }> = {
      success: true,
      data: { category },
      requestId: c.get('requestId'),
    };
    return c.json(response, 201);
  } catch (err) {
    if (err instanceof FoodConflictError) {
      const errResp: ApiErrorResponse = {
        success: false,
        error: { code: 'CONFLICT', message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(errResp, 409);
    }
    throw err;
  }
});

adminFoodsRouter.get('/sources', async (c) => {
  const foodService = new FoodService(c.env.DB!);
  const sources = await foodService.getSources();

  const response: ApiResponse<{ sources: FoodSource[] }> = {
    success: true,
    data: { sources },
    requestId: c.get('requestId'),
  };

  return c.json(response, 200);
});

adminFoodsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const locale = (c.req.query('locale') === 'en' ? 'en' : 'fa') as 'fa' | 'en';

  const foodService = new FoodService(c.env.DB!);
  try {
    const food = await foodService.getAdminFoodDetail(id, locale);
    const response: ApiResponse<{ food: FoodDetail }> = {
      success: true,
      data: { food },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof FoodNotFoundError) {
      const errResp: ApiErrorResponse = {
        success: false,
        error: { code: 'FOOD_NOT_FOUND', message: 'Food item not found' },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(errResp, 404);
    }
    throw err;
  }
});

adminFoodsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const parsed = await parseJsonBody(c, updateFoodSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const foodService = new FoodService(c.env.DB!);
  try {
    const food = await foodService.updateFood(id, parsed.data);
    const response: ApiResponse<{ food: FoodDetail }> = {
      success: true,
      data: { food },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof FoodNotFoundError) {
      const errResp: ApiErrorResponse = {
        success: false,
        error: { code: 'FOOD_NOT_FOUND', message: 'Food item not found' },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(errResp, 404);
    }
    if (err instanceof FoodConflictError) {
      const errResp: ApiErrorResponse = {
        success: false,
        error: { code: 'CONFLICT', message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(errResp, 409);
    }
    if (err instanceof FoodValidationError) {
      const errResp: ApiErrorResponse = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(errResp, 400);
    }
    throw err;
  }
});

adminFoodsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const foodService = new FoodService(c.env.DB!);

  try {
    await foodService.archiveFood(id);
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Food item archived successfully' },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof FoodNotFoundError) {
      const errResp: ApiErrorResponse = {
        success: false,
        error: { code: 'FOOD_NOT_FOUND', message: 'Food item not found' },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(errResp, 404);
    }
    throw err;
  }
});
