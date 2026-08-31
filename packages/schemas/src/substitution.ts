import { z } from 'zod';

export const foodSubstitutionInputSchema = z
  .object({
    food_id: z.string().trim().min(1),
    grams: z.number().finite().positive().nullable().optional(),
    serving_id: z.string().trim().min(1).nullable().optional(),
    quantity: z.number().finite().positive().default(1),
    candidate_food_ids: z
      .array(z.string().trim().min(1))
      .min(2, 'At least two candidate food IDs are required')
      .max(50, 'At most 50 candidate food IDs may be supplied'),
    limit: z.number().int().min(1).max(10).default(5),
  })
  .superRefine((data, ctx) => {
    const hasGrams = data.grams !== undefined && data.grams !== null;
    const hasServing = data.serving_id !== undefined && data.serving_id !== null;
    if (hasGrams === hasServing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Specify exactly one of grams or serving_id.',
      });
    }
    if (hasGrams && data.quantity !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Grams mode requires quantity 1.',
        path: ['quantity'],
      });
    }
    if (new Set(data.candidate_food_ids).size !== data.candidate_food_ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Candidate food IDs must be unique.',
        path: ['candidate_food_ids'],
      });
    }
  });
export type FoodSubstitutionInputDto = z.infer<typeof foodSubstitutionInputSchema>;
