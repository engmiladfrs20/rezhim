import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { parseJsonBody } from '../lib/validation';
import { mealPlanGenerateInputSchema } from '@nutriai/schemas';
import { NutritionValidationError } from '@nutriai/nutrition';
import { MealPlanService } from '../services/meal-plan.service';
import type { ApiErrorResponse, ApiResponse, GeneratedMealPlan } from '@nutriai/types';

export const mealPlansRouter = new Hono<AppEnv>();
mealPlansRouter.use('/*', authMiddleware);

mealPlansRouter.post('/generate', async (c) => {
  const parsed = await parseJsonBody(c, mealPlanGenerateInputSchema);
  if (!parsed.success) return parsed.response;

  try {
    const service = MealPlanService.fromDatabase(c.env.DB!);
    const plan = await service.generate(parsed.data);
    const response: ApiResponse<GeneratedMealPlan> = {
      success: true,
      data: plan,
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof NutritionValidationError) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: err.code === 'PROVENANCE_REQUIRED' ? 'PROVENANCE_REQUIRED' : 'VALIDATION_ERROR',
          message: err.message,
        },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(response, 400);
    }
    throw err;
  }
});
