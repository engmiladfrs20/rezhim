import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { NutritionService } from '../services/nutrition.service';
import { nutritionTargetsInputSchema, nutritionAggregateInputSchema } from '@nutriai/schemas';
import { NutritionValidationError } from '@nutriai/nutrition';
import type {
  ApiResponse,
  ApiErrorResponse,
  CalculatedNutritionTargets,
  AggregatedNutritionResult,
} from '@nutriai/types';

export const nutritionRouter = new Hono<AppEnv>();

nutritionRouter.use('/*', authMiddleware);

/**
 * POST /api/v1/nutrition/targets
 * Calculates personalized BMR, TDEE, target calories, and macro/micronutrient guidelines.
 */
nutritionRouter.post('/targets', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    const errResp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid JSON request payload.',
      },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(errResp, 400);
  }

  const parseResult = nutritionTargetsInputSchema.safeParse(body);
  if (!parseResult.success) {
    const errResp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed for nutrition targets parameters.',
        details: parseResult.error.flatten(),
      },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(errResp, 400);
  }

  const nutritionService = new NutritionService(c.env.DB!);
  try {
    const targets = nutritionService.calculateTargets(parseResult.data);

    const response: ApiResponse<CalculatedNutritionTargets> = {
      success: true,
      data: targets,
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof NutritionValidationError) {
      const errResp: ApiErrorResponse = {
        success: false,
        error: {
          code:
            err.code === 'UNSUPPORTED_POPULATION'
              ? 'UNSUPPORTED_POPULATION'
              : err.code === 'PROVENANCE_REQUIRED'
                ? 'PROVENANCE_REQUIRED'
                : 'VALIDATION_ERROR',
          message: err.message,
        },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(errResp, 400);
    }
    throw err;
  }
});

/**
 * POST /api/v1/nutrition/aggregate
 * Aggregates nutrition values across multiple active food portions.
 */
nutritionRouter.post('/aggregate', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    const errResp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid JSON request payload.',
      },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(errResp, 400);
  }

  const parseResult = nutritionAggregateInputSchema.safeParse(body);
  if (!parseResult.success) {
    const errResp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed for nutrition aggregation items.',
        details: parseResult.error.flatten(),
      },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(errResp, 400);
  }

  const nutritionService = new NutritionService(c.env.DB!);
  try {
    const result = await nutritionService.aggregateNutrition(parseResult.data.items);

    const response: ApiResponse<AggregatedNutritionResult> = {
      success: true,
      data: result,
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof NutritionValidationError) {
      const errResp: ApiErrorResponse = {
        success: false,
        error: {
          code: err.code === 'PROVENANCE_REQUIRED' ? 'PROVENANCE_REQUIRED' : 'VALIDATION_ERROR',
          message: err.message,
        },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(errResp, 400);
    }
    throw err;
  }
});
