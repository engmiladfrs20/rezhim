import { Hono } from 'hono';
import type { ApiErrorResponse, ApiResponse, UserSubscription } from '@nutriai/types';
import { subscriptionCheckoutSchema } from '@nutriai/schemas';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { SubscriptionRepository } from '../db/subscription.repository';
import { parseJsonBody } from '../lib/validation';

export const subscriptionRouter = new Hono<AppEnv>();
subscriptionRouter.use('/*', authMiddleware);

subscriptionRouter.get('/', async (c) => {
  const existing = await new SubscriptionRepository(c.env.DB!).findByUserId(c.get('user').id);
  const subscription: UserSubscription = existing ?? {
    id: null,
    userId: c.get('user').id,
    plan: 'free',
    status: 'active',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
  const response: ApiResponse<{ subscription: UserSubscription }> = {
    success: true,
    data: { subscription },
    requestId: c.get('requestId'),
  };
  return c.json(response, 200);
});

subscriptionRouter.post('/checkout', async (c) => {
  const parsed = await parseJsonBody(c, subscriptionCheckoutSchema);
  if (!parsed.success) return parsed.response;

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code:
        c.env.STRIPE_SECRET_KEY && c.env.STRIPE_PRICE_PRO
          ? 'PAYMENT_NOT_READY'
          : 'PAYMENT_NOT_CONFIGURED',
      message:
        'Subscription checkout is unavailable until a verified billing provider and webhook are configured.',
    },
    requestId: c.get('requestId'),
  };
  return c.json(response, 503);
});
