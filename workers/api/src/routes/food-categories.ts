import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { FoodService } from '../services/food.service';
import type { ApiResponse, FoodCategorySummary } from '@nutriai/types';

export const foodCategoriesRouter = new Hono<AppEnv>();

foodCategoriesRouter.use('/*', authMiddleware);

foodCategoriesRouter.get('/', async (c) => {
  const locale = (c.req.query('locale') === 'en' ? 'en' : 'fa') as 'fa' | 'en';
  const foodService = new FoodService(c.env.DB!);
  const categories = await foodService.getCategories(locale);

  const response: ApiResponse<{ categories: FoodCategorySummary[] }> = {
    success: true,
    data: { categories },
    requestId: c.get('requestId'),
  };

  return c.json(response, 200);
});
