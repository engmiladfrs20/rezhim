import { Hono, type Context } from 'hono';
import type {
  ApiErrorResponse,
  ApiResponse,
  DailyLifestyleSummary,
  FastingSession,
  HabitLog,
  WaterIntake,
} from '@nutriai/types';
import {
  fastingStartSchema,
  habitCreateSchema,
  habitUpdateSchema,
  lifestyleDateQuerySchema,
  waterIntakeCreateSchema,
} from '@nutriai/schemas';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { parseJsonBody } from '../lib/validation';
import { DatabaseError } from '../db/errors';
import {
  LifestyleConflictError,
  LifestyleNotFoundError,
  LifestyleService,
} from '../services/lifestyle.service';

export const lifestyleRouter = new Hono<AppEnv>();
lifestyleRouter.use('/*', authMiddleware);

function errorResponse(c: Context<AppEnv>, code: string, message: string, status: 400 | 404 | 409) {
  const response: ApiErrorResponse = {
    success: false,
    error: { code, message },
    requestId: c.get('requestId'),
  };
  return c.json(response, status);
}

function query(c: Context<AppEnv>) {
  return lifestyleDateQuerySchema.safeParse({ date: c.req.query('date') });
}

lifestyleRouter.get('/summary', async (c) => {
  const parsed = query(c);
  if (!parsed.success) return errorResponse(c, 'VALIDATION_ERROR', 'Invalid calendar date.', 400);
  const data = await LifestyleService.fromDatabase(c.env.DB!).summary(
    c.get('user').id,
    parsed.data,
  );
  const response: ApiResponse<DailyLifestyleSummary> = {
    success: true,
    data,
    requestId: c.get('requestId'),
  };
  return c.json(response, 200);
});

lifestyleRouter.get('/water', async (c) => {
  const parsed = query(c);
  if (!parsed.success) return errorResponse(c, 'VALIDATION_ERROR', 'Invalid calendar date.', 400);
  const data = await LifestyleService.fromDatabase(c.env.DB!).listWater(
    c.get('user').id,
    parsed.data,
  );
  const response: ApiResponse<{ entries: WaterIntake[] }> = {
    success: true,
    data: { entries: data },
    requestId: c.get('requestId'),
  };
  return c.json(response, 200);
});

lifestyleRouter.post('/water', async (c) => {
  const parsed = await parseJsonBody(c, waterIntakeCreateSchema);
  if (!parsed.success) return parsed.response;
  try {
    const entry = await LifestyleService.fromDatabase(c.env.DB!).createWater(
      c.get('user').id,
      parsed.data,
    );
    const response: ApiResponse<{ entry: WaterIntake }> = {
      success: true,
      data: { entry },
      requestId: c.get('requestId'),
    };
    return c.json(response, 201);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === 'VALIDATION_ERROR') {
      return errorResponse(c, 'VALIDATION_ERROR', error.message, 400);
    }
    throw error;
  }
});

lifestyleRouter.get('/fasting', async (c) => {
  const parsed = query(c);
  if (!parsed.success) return errorResponse(c, 'VALIDATION_ERROR', 'Invalid calendar date.', 400);
  const data = await LifestyleService.fromDatabase(c.env.DB!).listFasting(
    c.get('user').id,
    parsed.data,
  );
  const response: ApiResponse<{ sessions: FastingSession[] }> = {
    success: true,
    data: { sessions: data },
    requestId: c.get('requestId'),
  };
  return c.json(response, 200);
});

lifestyleRouter.post('/fasting/start', async (c) => {
  const parsed = await parseJsonBody(c, fastingStartSchema);
  if (!parsed.success) return parsed.response;
  try {
    const session = await LifestyleService.fromDatabase(c.env.DB!).startFasting(
      c.get('user').id,
      parsed.data,
    );
    const response: ApiResponse<{ session: FastingSession }> = {
      success: true,
      data: { session },
      requestId: c.get('requestId'),
    };
    return c.json(response, 201);
  } catch (error) {
    if (error instanceof LifestyleConflictError)
      return errorResponse(c, 'CONFLICT', error.message, 409);
    if (error instanceof DatabaseError && error.code === 'VALIDATION_ERROR')
      return errorResponse(c, 'VALIDATION_ERROR', error.message, 400);
    throw error;
  }
});

lifestyleRouter.post('/fasting/:id/stop', async (c) => {
  try {
    const session = await LifestyleService.fromDatabase(c.env.DB!).stopFasting(
      c.get('user').id,
      c.req.param('id'),
    );
    const response: ApiResponse<{ session: FastingSession }> = {
      success: true,
      data: { session },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (error) {
    if (error instanceof LifestyleNotFoundError)
      return errorResponse(c, 'FASTING_NOT_FOUND', error.message, 404);
    throw error;
  }
});

lifestyleRouter.get('/habits', async (c) => {
  const parsed = query(c);
  if (!parsed.success) return errorResponse(c, 'VALIDATION_ERROR', 'Invalid calendar date.', 400);
  const data = await LifestyleService.fromDatabase(c.env.DB!).listHabits(
    c.get('user').id,
    parsed.data,
  );
  const response: ApiResponse<{ habits: HabitLog[] }> = {
    success: true,
    data: { habits: data },
    requestId: c.get('requestId'),
  };
  return c.json(response, 200);
});

lifestyleRouter.post('/habits', async (c) => {
  const parsed = await parseJsonBody(c, habitCreateSchema);
  if (!parsed.success) return parsed.response;
  try {
    const habit = await LifestyleService.fromDatabase(c.env.DB!).createHabit(
      c.get('user').id,
      parsed.data,
    );
    const response: ApiResponse<{ habit: HabitLog }> = {
      success: true,
      data: { habit },
      requestId: c.get('requestId'),
    };
    return c.json(response, 201);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === 'CONFLICT')
      return errorResponse(c, 'CONFLICT', error.message, 409);
    throw error;
  }
});

lifestyleRouter.patch('/habits/:id', async (c) => {
  const parsed = await parseJsonBody(c, habitUpdateSchema);
  if (!parsed.success) return parsed.response;
  try {
    const habit = await LifestyleService.fromDatabase(c.env.DB!).updateHabit(
      c.get('user').id,
      c.req.param('id'),
      parsed.data,
    );
    const response: ApiResponse<{ habit: HabitLog }> = {
      success: true,
      data: { habit },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (error) {
    if (error instanceof LifestyleNotFoundError)
      return errorResponse(c, 'HABIT_NOT_FOUND', error.message, 404);
    throw error;
  }
});

lifestyleRouter.delete('/habits/:id', async (c) => {
  try {
    await LifestyleService.fromDatabase(c.env.DB!).deleteHabit(c.get('user').id, c.req.param('id'));
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Habit log deleted.' },
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (error) {
    if (error instanceof LifestyleNotFoundError)
      return errorResponse(c, 'HABIT_NOT_FOUND', error.message, 404);
    throw error;
  }
});
