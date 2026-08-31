import { z } from 'zod';

export const subscriptionCheckoutSchema = z.object({
  plan: z.literal('pro'),
});

export type SubscriptionCheckoutInputDto = z.infer<typeof subscriptionCheckoutSchema>;
