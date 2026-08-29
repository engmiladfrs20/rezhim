import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { FoodService } from '../services/food.service';
import { foodListQuerySchema } from '@nutriai/schemas';
import { FoodNotFoundError } from '../db/errors';
import type {
  ApiResponse,
  ApiErrorResponse,
  FoodDetail,
  FoodSummary,
  PaginatedResult,
} from '@nutriai/types';

export const foodsRouter = new Hono<AppEnv>();

foodsRouter.use('/*', authMiddleware);

foodsRouter.get('/', async (c) => {
  const queryResult = foodListQuerySchema.safeParse({
    locale: c.req.query('locale') || 'fa',
    category_id: c.req.query('category_id') || undefined,
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
  const result = await foodService.getPublicFoodList(queryResult.data);

  const response: ApiResponse<PaginatedResult<FoodSummary>> = {
    success: true,
    data: result,
    requestId: c.get('requestId'),
  };

  return c.json(response, 200);
});

foodsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const locale = (c.req.query('locale') === 'en' ? 'en' : 'fa') as 'fa' | 'en';

  const foodService = new FoodService(c.env.DB!);
  try {
    const food = await foodService.getPublicFoodDetail(id, locale);
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
        error: {
          code: 'FOOD_NOT_FOUND',
          message: 'Food item not found or is not active',
        },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(errResp, 404);
    }
    throw err;
  }
});
