import { z } from 'zod';
import { localeEnum } from './food';
import { nutritionTargetsInputSchema } from './nutrition';

export const mealPlanGenerateInputSchema = z.object({
  targets: nutritionTargetsInputSchema,
  food_ids: z
    .array(z.string().trim().min(1))
    .min(4, 'At least four food IDs are required')
    .max(50, 'At most 50 food IDs may be supplied')
    .superRefine((ids, ctx) => {
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Food IDs must be unique.' });
      }
    }),
  days: z.number().int().min(1).max(14).default(1),
  locale: localeEnum.default('fa'),
});
export type MealPlanGenerateInputDto = z.infer<typeof mealPlanGenerateInputSchema>;
