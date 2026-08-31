import { z } from 'zod';
import { rfc3339TimestampSchema } from './food';

const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.');

export const weightEntryCreateSchema = z.object({
  weight_kg: z.number().finite().min(20).max(350),
  measured_at: rfc3339TimestampSchema,
  note: z.string().trim().max(500).nullable().optional(),
});

export const weightEntryUpdateSchema = z
  .object({
    weight_kg: z.number().finite().min(20).max(350).optional(),
    measured_at: rfc3339TimestampSchema.optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one weight field is required');

export const weightTrendQuerySchema = z.object({
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type WeightEntryCreateInputDto = z.infer<typeof weightEntryCreateSchema>;
export type WeightEntryUpdateInputDto = z.infer<typeof weightEntryUpdateSchema>;
export type WeightTrendQueryDto = z.infer<typeof weightTrendQuerySchema>;
