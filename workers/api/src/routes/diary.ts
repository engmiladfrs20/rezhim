import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { parseJsonBody } from '../lib/validation';
import {
  createDiaryEntrySchema,
  diaryListQuerySchema,
  updateDiaryEntrySchema,
} from '@nutriai/schemas';
import { NutritionValidationError } from '@nutriai/nutrition';
import { DiaryEntryNotFoundError } from '../db/errors';
import { FoodDiaryService } from '../services/food-diary.service';
import type {
  ApiErrorResponse,
  ApiResponse,
  DailyDiarySummary,
  FoodDiaryEntryWithNutrition,
} from '@nutriai/types';

export const diaryRouter = new Hono<AppEnv>();
diaryRouter.use('/*', authMiddleware);

function validationError(c: Context<AppEnv>, message: string) {
  const response: ApiErrorResponse = {
    success: false,
    error: { code: 'VALIDATION_ERROR', message },
    requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
  };
  return c.json(response, 400);
}

diaryRouter.get('/', async (c) => {
  const queryResult = diaryListQuerySchema.safeParse({
    date: c.req.query('date') || new Date().toISOString().slice(0, 10),
    locale: c.req.query('locale') || 'fa',
  });
  if (!queryResult.success) {
    return validationError(c, 'Invalid diary date or locale.');
  }

  try {
    const service = new FoodDiaryService(c.env.DB!);
    const summary = await service.list(c.get('user').id, queryResult.data);
    const response: ApiResponse<DailyDiarySummary> = {
      success: true,
      data: summary,
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof NutritionValidationError) {
      return validationError(c, err.message);
    }
    throw err;
  }
});

diaryRouter.post('/', async (c) => {
  const parsed = await parseJsonBody(c, createDiaryEntrySchema);
  if (!parsed.success) return parsed.response;

  try {
    const service = new FoodDiaryService(c.env.DB!);
    const entry = await service.create(c.get('user').id, parsed.data);
    const response: ApiResponse<{ entry: FoodDiaryEntryWithNutrition }> = {
      success: true,
      data: { entry },
      requestId: c.get('requestId'),
    };
    return c.json(response, 201);
  } catch (err) {
    if (err instanceof NutritionValidationError) return validationError(c, err.message);
    throw err;
  }
});

diaryRouter.patch('/:id', async (c) => {
  const parsed = await parseJsonBody(c, updateDiaryEntrySchema);
  if (!parsed.success) return parsed.response;

  try {
    const service = new FoodDiaryService(c.env.DB!);
    const entry = await service.update(c.get('user').id, c.req.param('id'), parsed.data);
    const response: ApiResponse<{ entry: FoodDiaryEntryWithNutrition }> = {
      success: true,
      data: { entry },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof DiaryEntryNotFoundError) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'DIARY_ENTRY_NOT_FOUND', message: 'Food diary entry not found.' },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(response, 404);
    }
    if (err instanceof NutritionValidationError) return validationError(c, err.message);
    throw err;
  }
});

diaryRouter.delete('/:id', async (c) => {
  try {
    const service = new FoodDiaryService(c.env.DB!);
    await service.delete(c.get('user').id, c.req.param('id'));
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Food diary entry deleted.' },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof DiaryEntryNotFoundError) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'DIARY_ENTRY_NOT_FOUND', message: 'Food diary entry not found.' },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(response, 404);
    }
    throw err;
  }
});
