import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { parseJsonBody } from '../lib/validation';
import { foodSubstitutionInputSchema } from '@nutriai/schemas';
import { NutritionValidationError } from '@nutriai/nutrition';
import { SubstitutionService } from '../services/substitution.service';
import type { ApiErrorResponse, ApiResponse, FoodSubstitutionResult } from '@nutriai/types';

export const substitutionsRouter = new Hono<AppEnv>();
substitutionsRouter.use('/*', authMiddleware);

substitutionsRouter.post('/', async (c) => {
  const parsed = await parseJsonBody(c, foodSubstitutionInputSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await SubstitutionService.fromDatabase(c.env.DB!).find(parsed.data);
    const response: ApiResponse<FoodSubstitutionResult> = {
      success: true,
      data: result,
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
