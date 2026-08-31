import { Hono } from 'hono';
import { recipeCalculateInputSchema } from '@nutriai/schemas';
import { NutritionValidationError } from '@nutriai/nutrition';
import type { ApiErrorResponse, ApiResponse, RecipeNutritionResult } from '@nutriai/types';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { parseJsonBody } from '../lib/validation';
import { RecipeService } from '../services/recipe.service';

export const recipesRouter = new Hono<AppEnv>();
recipesRouter.use('/*', authMiddleware);

recipesRouter.post('/calculate', async (c) => {
  const parsed = await parseJsonBody(c, recipeCalculateInputSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await new RecipeService(c.env.DB!).calculate(parsed.data);
    const response: ApiResponse<RecipeNutritionResult> = {
      success: true,
      data: result,
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (error) {
    if (error instanceof NutritionValidationError) {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: error.code === 'PROVENANCE_REQUIRED' ? 'PROVENANCE_REQUIRED' : 'VALIDATION_ERROR',
          message: error.message,
        },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(response, 400);
    }
    throw error;
  }
});
