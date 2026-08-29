import { z } from 'zod';

export const foodStatusEnum = z.enum(['draft', 'active', 'archived']);
export const foodTypeEnum = z.enum(['generic', 'branded']);
export const localeEnum = z.enum(['fa', 'en']);
export const nutrientUnitEnum = z.enum(['kcal', 'g', 'mg', 'mcg', 'IU']);

export const foodServingInputSchema = z.object({
  name_fa: z.string().trim().min(1, 'Persian serving name is required').max(100),
  name_en: z.string().trim().min(1, 'English serving name is required').max(100),
  weight_g: z.number().positive('Serving weight must be strictly greater than 0'),
  household_unit: z.string().trim().max(50).nullable().optional(),
});
export type FoodServingInputDto = z.infer<typeof foodServingInputSchema>;

export const foodNutrientInputSchema = z.object({
  nutrient_id: z.string().min(1, 'Nutrient ID is required'),
  amount_per_100g: z.number().min(0, 'Nutrient amount cannot be negative'),
});
export type FoodNutrientInputDto = z.infer<typeof foodNutrientInputSchema>;

export const foodTranslationInputSchema = z.object({
  locale: localeEnum,
  name: z.string().trim().min(1, 'Food name is required').max(200),
  description: z.string().trim().max(1000).nullable().optional(),
});
export type FoodTranslationInputDto = z.infer<typeof foodTranslationInputSchema>;

export const foodAliasInputSchema = z.object({
  locale: localeEnum,
  alias: z.string().trim().min(1, 'Alias is required').max(100),
});
export type FoodAliasInputDto = z.infer<typeof foodAliasInputSchema>;

export const createFoodCategorySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
  parent_id: z.string().nullable().optional(),
  status: z.enum(['active', 'archived']).default('active'),
  translations: z
    .array(
      z.object({
        locale: localeEnum,
        name: z.string().trim().min(1, 'Category name is required').max(100),
        description: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .min(1, 'At least one translation is required'),
});
export type CreateFoodCategoryDto = z.infer<typeof createFoodCategorySchema>;

export const updateFoodCategorySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  parent_id: z.string().nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
  translations: z
    .array(
      z.object({
        locale: localeEnum,
        name: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .optional(),
});
export type UpdateFoodCategoryDto = z.infer<typeof updateFoodCategorySchema>;

export const createFoodSchema = z.object({
  category_id: z.string().nullable().optional(),
  food_type: foodTypeEnum.default('generic'),
  brand_name: z.string().trim().max(100).nullable().optional(),
  barcode: z
    .string()
    .trim()
    .min(3, 'Barcode must be at least 3 characters')
    .max(50)
    .nullable()
    .optional(),
  status: foodStatusEnum.default('active'),
  source_id: z.string().nullable().optional(),
  external_id: z.string().trim().max(100).nullable().optional(),
  translations: z.array(foodTranslationInputSchema).min(1, 'At least one translation is required'),
  aliases: z.array(foodAliasInputSchema).default([]),
  nutrients: z.array(foodNutrientInputSchema).default([]),
  servings: z.array(foodServingInputSchema).default([]),
});
export type CreateFoodDto = z.infer<typeof createFoodSchema>;

export const updateFoodSchema = z.object({
  category_id: z.string().nullable().optional(),
  food_type: foodTypeEnum.optional(),
  brand_name: z.string().trim().max(100).nullable().optional(),
  barcode: z.string().trim().min(3).max(50).nullable().optional(),
  status: foodStatusEnum.optional(),
  source_id: z.string().nullable().optional(),
  external_id: z.string().trim().max(100).nullable().optional(),
  translations: z.array(foodTranslationInputSchema).optional(),
  aliases: z.array(foodAliasInputSchema).optional(),
  nutrients: z.array(foodNutrientInputSchema).optional(),
  servings: z.array(foodServingInputSchema).optional(),
});
export type UpdateFoodDto = z.infer<typeof updateFoodSchema>;

export const foodListQuerySchema = z.object({
  locale: localeEnum.default('fa'),
  category_id: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
export type FoodListQueryDto = z.infer<typeof foodListQuerySchema>;

export const adminFoodListQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'archived', 'all']).default('all'),
  category_id: z.string().optional(),
  locale: localeEnum.default('fa'),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
export type AdminFoodListQueryDto = z.infer<typeof adminFoodListQuerySchema>;
