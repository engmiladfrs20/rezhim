import { z } from 'zod';

export const foodStatusEnum = z.enum(['draft', 'active', 'archived']);
export const foodTypeEnum = z.enum(['generic', 'branded']);
export const localeEnum = z.enum(['fa', 'en']);
export const nutrientUnitEnum = z.enum(['kcal', 'g', 'mg', 'mcg', 'IU']);

/**
 * Normalizes a raw barcode string by:
 * 1. Converting Persian and Arabic digits to ASCII digits
 * 2. Removing spaces, hyphens, underscores, and periods
 * Returns null if empty/null/undefined.
 */
export function normalizeBarcode(rawBarcode?: string | null): string | null {
  if (rawBarcode === undefined || rawBarcode === null) return null;
  const trimmed = rawBarcode.trim();
  if (!trimmed) return null;

  const ascii = trimmed
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[\s\-_.]/g, '');

  return ascii;
}

export function isValidBarcode(normalized: string): boolean {
  return /^\d{8,18}$/.test(normalized);
}

export const canonicalBarcodeSchema = z
  .string()
  .transform((val, ctx) => {
    const normalized = normalizeBarcode(val);
    if (!normalized) return null;
    if (!isValidBarcode(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Barcode must be between 8 and 18 numeric digits in a standard format',
      });
      return z.NEVER;
    }
    return normalized;
  })
  .nullable()
  .optional();

export const foodServingInputSchema = z.object({
  name_fa: z.string().trim().min(1, 'Persian serving name is required').max(100),
  name_en: z.string().trim().min(1, 'English serving name is required').max(100),
  weight_g: z.number().positive('Serving weight must be strictly greater than 0'),
  household_unit: z.string().trim().max(50).nullable().optional(),
});
export type FoodServingInputDto = z.infer<typeof foodServingInputSchema>;

export const foodNutrientInputSchema = z.object({
  nutrient_id: z.string().trim().min(1, 'Nutrient ID is required'),
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

function validateUniqueLocales<T extends { locale: 'fa' | 'en' }>(
  items: T[],
  ctx: z.RefinementCtx,
  fieldName = 'translations',
) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.locale)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate locale '${item.locale}' found in ${fieldName}`,
        path: [fieldName],
      });
      return false;
    }
    seen.add(item.locale);
  }
  return true;
}

function validateUniqueNutrients(nutrients: FoodNutrientInputDto[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  for (const n of nutrients) {
    if (seen.has(n.nutrient_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate nutrient_id '${n.nutrient_id}' in nutrients array`,
        path: ['nutrients'],
      });
      return false;
    }
    seen.add(n.nutrient_id);
  }
  return true;
}

function validateUniqueAliases(aliases: FoodAliasInputDto[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  for (const a of aliases) {
    const key = `${a.locale}:${a.alias.toLowerCase().trim()}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate alias '${a.alias}' for locale '${a.locale}'`,
        path: ['aliases'],
      });
      return false;
    }
    seen.add(key);
  }
  return true;
}

function validateUniqueServings(servings: FoodServingInputDto[], ctx: z.RefinementCtx) {
  const seenFa = new Set<string>();
  const seenEn = new Set<string>();
  for (const s of servings) {
    const faKey = s.name_fa.toLowerCase().trim();
    const enKey = s.name_en.toLowerCase().trim();
    if (seenFa.has(faKey) || seenEn.has(enKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate serving name found in servings array`,
        path: ['servings'],
      });
      return false;
    }
    seenFa.add(faKey);
    seenEn.add(enKey);
  }
  return true;
}

export const createFoodCategorySchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, 'Slug must be at least 2 characters')
      .max(100)
      .regex(
        /^[a-z0-9-]+$/,
        'Slug must only contain lowercase alphanumeric characters and hyphens',
      ),
    parent_id: z.string().trim().min(1).nullable().optional(),
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
  })
  .superRefine((data, ctx) => {
    validateUniqueLocales(data.translations, ctx, 'translations');
  });
export type CreateFoodCategoryDto = z.infer<typeof createFoodCategorySchema>;

export const updateFoodCategorySchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    parent_id: z.string().trim().min(1).nullable().optional(),
    status: z.enum(['active', 'archived']).optional(),
    translations: z
      .array(
        z.object({
          locale: localeEnum,
          name: z.string().trim().min(1).max(100),
          description: z.string().trim().max(500).nullable().optional(),
        }),
      )
      .min(1, 'If provided, translations cannot be empty')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.translations) {
      validateUniqueLocales(data.translations, ctx, 'translations');
    }
  });
export type UpdateFoodCategoryDto = z.infer<typeof updateFoodCategorySchema>;

export const createFoodSchema = z
  .object({
    category_id: z.string().trim().min(1).nullable().optional(),
    food_type: foodTypeEnum.default('generic'),
    brand_name: z.string().trim().max(100).nullable().optional(),
    barcode: canonicalBarcodeSchema,
    status: foodStatusEnum.default('active'),
    source_id: z.string().trim().min(1).nullable().optional(),
    external_id: z.string().trim().max(100).nullable().optional(),
    translations: z
      .array(foodTranslationInputSchema)
      .min(1, 'At least one translation is required'),
    aliases: z.array(foodAliasInputSchema).default([]),
    nutrients: z.array(foodNutrientInputSchema).default([]),
    servings: z.array(foodServingInputSchema).default([]),
  })
  .superRefine((data, ctx) => {
    // 1. Unique nested items
    validateUniqueLocales(data.translations, ctx, 'translations');
    validateUniqueNutrients(data.nutrients, ctx);
    validateUniqueAliases(data.aliases, ctx);
    validateUniqueServings(data.servings, ctx);

    // 2. Branded food requires brand_name
    if (data.food_type === 'branded' && (!data.brand_name || data.brand_name.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Branded food requires a non-empty brand_name',
        path: ['brand_name'],
      });
    }

    // 3. external_id requires source_id
    if (data.external_id && data.external_id.trim().length > 0 && !data.source_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'external_id cannot be provided without a valid source_id',
        path: ['source_id'],
      });
    }
  });
export type CreateFoodDto = z.infer<typeof createFoodSchema>;

export const updateFoodSchema = z
  .object({
    category_id: z.string().trim().min(1).nullable().optional(),
    food_type: foodTypeEnum.optional(),
    brand_name: z.string().trim().max(100).nullable().optional(),
    barcode: canonicalBarcodeSchema,
    status: foodStatusEnum.optional(),
    source_id: z.string().trim().min(1).nullable().optional(),
    external_id: z.string().trim().max(100).nullable().optional(),
    translations: z
      .array(foodTranslationInputSchema)
      .min(1, 'If provided, translations cannot be empty')
      .optional(),
    aliases: z.array(foodAliasInputSchema).optional(),
    nutrients: z.array(foodNutrientInputSchema).optional(),
    servings: z.array(foodServingInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.translations) {
      validateUniqueLocales(data.translations, ctx, 'translations');
    }
    if (data.nutrients) {
      validateUniqueNutrients(data.nutrients, ctx);
    }
    if (data.aliases) {
      validateUniqueAliases(data.aliases, ctx);
    }
    if (data.servings) {
      validateUniqueServings(data.servings, ctx);
    }

    if (
      data.food_type === 'branded' &&
      data.brand_name !== undefined &&
      (!data.brand_name || data.brand_name.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Branded food requires a non-empty brand_name',
        path: ['brand_name'],
      });
    }

    if (data.external_id && data.external_id.trim().length > 0 && data.source_id === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'external_id cannot be provided without a valid source_id',
        path: ['source_id'],
      });
    }
  });
export type UpdateFoodDto = z.infer<typeof updateFoodSchema>;

export const foodListQuerySchema = z.object({
  locale: localeEnum.default('fa'),
  category_id: z.string().trim().min(1).optional(),
  cursor: z.string().trim().max(512).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
export type FoodListQueryDto = z.infer<typeof foodListQuerySchema>;

export const adminFoodListQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'archived', 'all']).default('all'),
  category_id: z.string().trim().min(1).optional(),
  locale: localeEnum.default('fa'),
  cursor: z.string().trim().max(512).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
export type AdminFoodListQueryDto = z.infer<typeof adminFoodListQuerySchema>;
