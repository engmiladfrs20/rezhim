import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/require-role';
import { UserRepository } from '../db/user.repository';
import type { ApiErrorResponse, ApiResponse, PublicUser } from '@nutriai/types';
import { toPublicUser } from '../services/auth.mapper';
import type { AppEnv } from '../types';
import { SessionRepository } from '../db/session.repository';
import { parseJsonBody } from '../lib/validation';

export const adminUsersRouter = new Hono<AppEnv>();

adminUsersRouter.use('/*', authMiddleware, requireRole('admin'));

const statusSchema = z.object({
  status: z.enum(['active', 'disabled']),
});

adminUsersRouter.get('/', async (c) => {
  const userRepo = new UserRepository(c.env.DB);

  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10), 1), 100);
  const cursor = c.req.query('cursor') || null;
  const role = c.req.query('role') || null;
  const status = c.req.query('status') || null;

  const results = await userRepo.listUsers(limit, cursor, role, status);
  const safeUsers: PublicUser[] = results.map((user) => toPublicUser(user));
  const nextCursor: string | null =
    safeUsers.length === limit ? (safeUsers[safeUsers.length - 1]?.id ?? null) : null;

  const response: ApiResponse<{ users: PublicUser[]; nextCursor: string | null }> = {
    success: true,
    data: { users: safeUsers, nextCursor },
  };

  return c.json(response, 200);
});

adminUsersRouter.get('/:id', async (c) => {
  const targetId = c.req.param('id');
  const userRepo = new UserRepository(c.env.DB);

  const targetUser = await userRepo.findById(targetId);
  if (!targetUser) {
    const errorResp: ApiErrorResponse = {
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(errorResp, 404);
  }

  const response: ApiResponse<{ user: PublicUser }> = {
    success: true,
    data: { user: toPublicUser(targetUser) },
  };

  return c.json(response, 200);
});

adminUsersRouter.patch('/:id/status', async (c) => {
  const parsed = await parseJsonBody(c, statusSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const user = c.get('user');
  const userRepo = new UserRepository(c.env.DB);
  const targetId = c.req.param('id');
  const data = parsed.data;

  if (targetId === user.id) {
    const resp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Administrators cannot disable their own account.',
      },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(resp, 403);
  }

  const targetUser = await userRepo.findById(targetId);
  if (!targetUser) {
    const errorResp: ApiErrorResponse = {
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
    };
    return c.json(errorResp, 404);
  }

  await userRepo.updateStatus(targetId, data.status, new Date().toISOString());

  if (data.status === 'disabled') {
    const sessionRepo = new SessionRepository(c.env.DB);
    await sessionRepo.revokeAllUserSessions(targetId, new Date().toISOString());
  }

  const response: ApiResponse<null> = {
    success: true,
    data: null,
  };

  return c.json(response, 200);
});
