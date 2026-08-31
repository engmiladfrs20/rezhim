import { z } from 'zod';

export const recipeIngredientSchema = z.object({
  food_id: z.string({ required_error: 'food_id is required' }).trim().min(1),
  grams: z
    .number()
    .finite('Ingredient grams must be finite')
    .positive('Ingredient grams must be greater than 0')
    .max(1_000_000),
});

export const recipeCalculateInputSchema = z.object({
  ingredients: z
    .array(recipeIngredientSchema, { required_error: 'Ingredients are required' })
    .min(1, 'At least one recipe ingredient is required')
    .max(100, 'A recipe cannot contain more than 100 ingredients')
    .superRefine((ingredients, ctx) => {
      const ids = ingredients.map((ingredient) => ingredient.food_id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Recipe ingredients must reference unique food IDs.',
          path: ['ingredients'],
        });
      }
    }),
  yield_grams: z
    .number({ required_error: 'yield_grams is required' })
    .finite('Recipe yield must be finite')
    .positive('Recipe yield must be greater than 0')
    .max(1_000_000),
  servings: z
    .number()
    .int('Servings must be an integer')
    .positive('Servings must be greater than 0')
    .max(1000)
    .default(1),
});

export type RecipeCalculateInputDto = z.infer<typeof recipeCalculateInputSchema>;
