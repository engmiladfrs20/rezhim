import { Hono } from 'hono';
import { updateProfileSchema, userNutritionGoalSchema } from '@nutriai/schemas';
import { authMiddleware } from '../middleware/auth';
import type { AppEnv } from '../types';
import { UserRepository } from '../db/user.repository';
import { parseJsonBody } from '../lib/validation';
import { toPublicUser } from '../services/auth.mapper';
import type { ApiResponse, PublicUser } from '@nutriai/types';
import { GoalRepository } from '../db/goal.repository';

export const usersRouter = new Hono<AppEnv>();

usersRouter.use('/*', authMiddleware);

usersRouter.patch('/me', async (c) => {
  const parsed = await parseJsonBody(c, updateProfileSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const user = c.get('user');
  const userRepo = new UserRepository(c.env.DB);
  await userRepo.updateProfile(user.id, parsed.data, new Date().toISOString());

  const updatedUser = await userRepo.findById(user.id);
  const response: ApiResponse<{ user: PublicUser | null }> = {
    success: true,
    data: { user: updatedUser ? toPublicUser(updatedUser) : null },
  };

  return c.json(response, 200);
});

usersRouter.get('/me/goals', async (c) => {
  const goal = await new GoalRepository(c.env.DB).findByUserId(c.get('user').id);
  const response: ApiResponse<{ goal: typeof goal }> = {
    success: true,
    data: { goal },
    requestId: c.get('requestId'),
  };
  return c.json(response, 200);
});

usersRouter.put('/me/goals', async (c) => {
  const parsed = await parseJsonBody(c, userNutritionGoalSchema);
  if (!parsed.success) return parsed.response;
  const goal = await new GoalRepository(c.env.DB).upsert(
    c.get('user').id,
    parsed.data,
    new Date().toISOString(),
  );
  const response: ApiResponse<{ goal: typeof goal }> = {
    success: true,
    data: { goal },
    requestId: c.get('requestId'),
  };
  return c.json(response, 200);
});
