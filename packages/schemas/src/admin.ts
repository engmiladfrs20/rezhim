import { z } from 'zod';

export const adminAnalyticsQuerySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
});

export type AdminAnalyticsQueryDto = z.infer<typeof adminAnalyticsQuerySchema>;
