import { z } from 'zod';

export const genderEnum = z.enum(['male', 'female']);
export type GenderDto = z.infer<typeof genderEnum>;

export const lifeStageEnum = z.enum(['adult_non_pregnant_non_lactating', 'pregnant', 'lactating']);
export type LifeStageDto = z.infer<typeof lifeStageEnum>;

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
      .finite('Age must be finite')
      .int('Age must be an integer')
      .min(19, 'Nutrition target calculations are restricted to adults aged 19 years or older.')
      .max(120, 'Age must be at most 120'),
    heightCm: z
      .number({ required_error: 'Height in cm is required' })
      .finite('Height must be finite')
      .min(50, 'Height must be at least 50 cm')
      .max(260, 'Height must be at most 260 cm'),
    weightKg: z
      .number({ required_error: 'Weight in kg is required' })
      .finite('Weight must be finite')
      .min(20, 'Weight must be at least 20 kg')
      .max(350, 'Weight must be at most 350 kg'),
    bodyFatPercentage: z
      .number()
      .finite('Body fat percentage must be finite')
      .min(1, 'Body fat percentage must be at least 1%')
      .max(70, 'Body fat percentage must be at most 70%')
      .optional()
      .nullable(),
    lifeStage: lifeStageEnum.optional().default('adult_non_pregnant_non_lactating'),
    activityLevel: activityLevelEnum,
    dietGoal: dietGoalEnum,
    formula: bmrFormulaEnum,
  })
  .superRefine((data, ctx) => {
    if (data.age < 19) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Nutrition target calculations are restricted to adults aged 19 years or older. Children and adolescents (< 19) are not supported.',
        path: ['age'],
      });
    }

    if (data.lifeStage && data.lifeStage !== 'adult_non_pregnant_non_lactating') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Nutrition target calculations currently only support nonpregnant and nonlactating adults. Pregnancy and lactation are not supported.',
        path: ['lifeStage'],
      });
    }

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

/** Persisted onboarding preferences used to recreate a user's plan on any device. */
export const userNutritionGoalSchema = nutritionTargetsInputSchema.and(
  z.object({
    mealsPerDay: z.number().int().min(3).max(6).default(4),
    dietaryPreferences: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    allergies: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  }),
);
export type UserNutritionGoalDto = z.infer<typeof userNutritionGoalSchema>;

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
      .nullable(),
  })
  .superRefine((data, ctx) => {
    const hasGrams = data.grams !== undefined && data.grams !== null;
    const hasServing = data.servingId !== undefined && data.servingId !== null;
    const hasQuantity = data.quantity !== undefined && data.quantity !== null;

    if (hasGrams && (hasServing || hasQuantity)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'In grams mode, "grams" must be provided alone; "servingId" and "quantity" are forbidden.',
      });
    }

    if (!hasGrams && !hasServing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Incomplete portion: specify either "grams" alone or "servingId" with optional "quantity".',
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
