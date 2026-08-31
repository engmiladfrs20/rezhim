import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { parseJsonBody } from '../lib/validation';
import {
  aiCoachInputSchema,
  aiFoodRecognitionInputSchema,
  aiGenerateInputSchema,
} from '@nutriai/schemas';
import { AiError } from '@nutriai/ai';
import { NutritionValidationError } from '@nutriai/nutrition';
import { AiService } from '../services/ai.service';
import { FoodDiaryService } from '../services/food-diary.service';
import type {
  AiCoachResponse,
  AiFoodRecognitionResponse,
  AiGenerationResponse,
  ApiErrorResponse,
  ApiResponse,
} from '@nutriai/types';

export const aiRouter = new Hono<AppEnv>();
aiRouter.use('/*', authMiddleware);

aiRouter.post('/generate', async (c) => {
  const parsed = await parseJsonBody(c, aiGenerateInputSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await new AiService(c.env).generate(parsed.data);
    const response: ApiResponse<AiGenerationResponse> = {
      success: true,
      data: result,
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof AiError) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: err.code, message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(response, err.code === 'AI_UNAVAILABLE' ? 503 : 502);
    }
    if (err instanceof NutritionValidationError) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(response, 400);
    }
    throw err;
  }
});

aiRouter.post('/coach', async (c) => {
  const parsed = await parseJsonBody(c, aiCoachInputSchema);
  if (!parsed.success) return parsed.response;

  try {
    const userId = c.get('user').id;
    const diary = await new FoodDiaryService(c.env.DB!).list(userId, {
      date: parsed.data.date,
      locale: parsed.data.locale,
    });
    const result = await new AiService(c.env).coach(parsed.data, diary.nutrition);
    const response: ApiResponse<AiCoachResponse> = {
      success: true,
      data: result,
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof AiError) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: err.code, message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(response, err.code === 'AI_UNAVAILABLE' ? 503 : 502);
    }
    if (err instanceof NutritionValidationError) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(response, 400);
    }
    throw err;
  }
});

aiRouter.post('/food-recognition', async (c) => {
  const parsed = await parseJsonBody(c, aiFoodRecognitionInputSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await new AiService(c.env).recognizeFood(parsed.data);
    const response: ApiResponse<AiFoodRecognitionResponse> = {
      success: true,
      data: result,
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (err) {
    if (err instanceof AiError) {
      const response: ApiErrorResponse = {
        success: false,
        error: { code: err.code, message: err.message },
        requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
      };
      return c.json(response, err.code === 'AI_UNAVAILABLE' ? 503 : 502);
    }
    throw err;
  }
});
