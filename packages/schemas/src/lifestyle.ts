import { z } from 'zod';
import { rfc3339TimestampSchema } from './food';

const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.');

export const lifestyleDateQuerySchema = z.object({
  date: calendarDateSchema.optional(),
});

export const waterIntakeCreateSchema = z.object({
  amount_ml: z.number().int().min(1).max(10_000),
  consumed_at: rfc3339TimestampSchema,
});

export const fastingStartSchema = z.object({
  started_at: rfc3339TimestampSchema.optional(),
  goal_hours: z.number().finite().min(1).max(168).default(16),
});

export const habitCreateSchema = z.object({
  habit_key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_-]{1,63}$/, 'Invalid habit key.'),
  occurred_on: calendarDateSchema,
  completed: z.boolean().default(true),
  note: z.string().trim().max(500).nullable().optional(),
});

export const habitUpdateSchema = z
  .object({
    completed: z.boolean().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one habit field is required.');

export type LifestyleDateQueryDto = z.infer<typeof lifestyleDateQuerySchema>;
export type WaterIntakeCreateInputDto = z.infer<typeof waterIntakeCreateSchema>;
export type FastingStartInputDto = z.infer<typeof fastingStartSchema>;
export type HabitCreateInputDto = z.infer<typeof habitCreateSchema>;
export type HabitUpdateInputDto = z.infer<typeof habitUpdateSchema>;
