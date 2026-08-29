import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { FoodService } from '../services/food.service';
import type { ApiResponse, NutrientDefinition } from '@nutriai/types';

export const nutrientsRouter = new Hono<AppEnv>();

nutrientsRouter.use('/*', authMiddleware);

nutrientsRouter.get('/', async (c) => {
  const foodService = new FoodService(c.env.DB!);
  const nutrients = await foodService.getNutrients();

  const response: ApiResponse<{ nutrients: NutrientDefinition[] }> = {
    success: true,
    data: { nutrients },
    requestId: c.get('requestId'),
  };

  return c.json(response, 200);
});
