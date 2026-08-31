import { z } from 'zod';

export const genderEnum = z.enum(['male', 'female']);
export type GenderDto = z.infer<typeof genderEnum>;

export const activityLevelEnum = z.enum([
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extra_active',
]);
export type ActivityLevelDto = z.infer<typeof activityLevelEnum>;

export const dietGoalEnum = z.enum([
  'weight_loss_aggressive',
  'weight_loss_mild',
  'maintenance',
  'muscle_gain_mild',
  'muscle_gain_aggressive',
]);
export type DietGoalDto = z.infer<typeof dietGoalEnum>;

export const bmrFormulaEnum = z.enum(['mifflin_st_jeor', 'harris_benedict', 'katch_mcardle']);
export type BmrFormulaDto = z.infer<typeof bmrFormulaEnum>;

export const nutritionTargetsInputSchema = z
  .object({
    gender: genderEnum,
    age: z
      .number({ required_error: 'Age is required' })
      .int('Age must be an integer')
      .min(10, 'Age must be at least 10')
      .max(120, 'Age must be at most 120'),
    heightCm: z
      .number({ required_error: 'Height in cm is required' })
      .min(50, 'Height must be at least 50 cm')
      .max(260, 'Height must be at most 260 cm'),
    weightKg: z
      .number({ required_error: 'Weight in kg is required' })
      .min(20, 'Weight must be at least 20 kg')
      .max(350, 'Weight must be at most 350 kg'),
    bodyFatPercentage: z
      .number()
      .min(1, 'Body fat percentage must be at least 1%')
      .max(70, 'Body fat percentage must be at most 70%')
      .optional()
      .nullable(),
    activityLevel: activityLevelEnum,
    dietGoal: dietGoalEnum,
    formula: bmrFormulaEnum,
  })
  .superRefine((data, ctx) => {
    if (
      data.formula === 'katch_mcardle' &&
      (data.bodyFatPercentage === undefined || data.bodyFatPercentage === null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Body fat percentage is strictly required for the Katch-McArdle formula.',
        path: ['bodyFatPercentage'],
      });
    }
  });

export type NutritionTargetsInputDto = z.infer<typeof nutritionTargetsInputSchema>;

export const nutritionAggregateItemSchema = z
  .object({
    foodId: z.string({ required_error: 'foodId is required' }).trim().min(1, 'foodId is required'),
    grams: z
      .number()
      .positive('Grams must be greater than 0')
      .finite('Grams must be finite')
      .optional()
      .nullable(),
    servingId: z.string().trim().min(1).optional().nullable(),
    quantity: z
      .number()
      .positive('Quantity must be greater than 0')
      .finite('Quantity must be finite')
      .optional()
      .default(1),
  })
  .superRefine((data, ctx) => {
    const hasGrams = data.grams !== undefined && data.grams !== null;
    const hasServing = data.servingId !== undefined && data.servingId !== null;

    if (hasGrams && hasServing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ambiguous portion: specify either "grams" or "servingId", not both.',
      });
    }

    if (!hasGrams && !hasServing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Incomplete portion: either "grams" or "servingId" must be provided.',
      });
    }
  });

export type NutritionAggregateItemDto = z.infer<typeof nutritionAggregateItemSchema>;

export const nutritionAggregateInputSchema = z.object({
  items: z
    .array(nutritionAggregateItemSchema, { required_error: 'Items array is required' })
    .min(1, 'At least one food item must be provided for nutrition aggregation')
    .max(100, 'Cannot aggregate more than 100 food items in a single request'),
});

export type NutritionAggregateInputDto = z.infer<typeof nutritionAggregateInputSchema>;
