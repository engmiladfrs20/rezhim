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

export const rfc3339TimestampSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/,
    'Must be a valid RFC3339 UTC timestamp',
  )
  .refine((ts) => !isNaN(Date.parse(ts)), 'Must be a parseable timestamp');

export const provenanceMethodEnum = z.enum(['laboratory', 'database', 'calculated', 'measured']);
export type ProvenanceMethodDto = z.infer<typeof provenanceMethodEnum>;

export const foodServingInputSchema = z.object({
  name_fa: z.string().trim().min(1, 'Persian serving name is required').max(100),
  name_en: z.string().trim().min(1, 'English serving name is required').max(100),
  weight_g: z.number().positive('Serving weight must be strictly greater than 0'),
  household_unit: z.string().trim().max(50).nullable().optional(),
  source_id: z.string().trim().min(1).nullable().optional(),
  external_id: z.string().trim().max(100).nullable().optional(),
  source_url: z.string().trim().url('Must be a valid URL').nullable().optional(),
  citation: z.string().trim().max(500).nullable().optional(),
  dataset_version: z.string().trim().max(50).nullable().optional(),
  method: provenanceMethodEnum.nullable().optional(),
  retrieved_at: rfc3339TimestampSchema.nullable().optional(),
  license: z.string().trim().max(250).nullable().optional(),
});
export type FoodServingInputDto = z.infer<typeof foodServingInputSchema>;

export const foodNutrientInputSchema = z.object({
  nutrient_id: z.string().trim().min(1, 'Nutrient ID is required'),
  amount_per_100g: z.number().min(0, 'Nutrient amount cannot be negative'),
  source_id: z.string().trim().min(1).nullable().optional(),
  external_id: z.string().trim().max(100).nullable().optional(),
  source_url: z.string().trim().url('Must be a valid URL').nullable().optional(),
  citation: z.string().trim().max(500).nullable().optional(),
  dataset_version: z.string().trim().max(50).nullable().optional(),
  method: provenanceMethodEnum.nullable().optional(),
  retrieved_at: rfc3339TimestampSchema.nullable().optional(),
  license: z.string().trim().max(250).nullable().optional(),
});
export type FoodNutrientInputDto = z.infer<typeof foodNutrientInputSchema>;

export const foodTranslationInputSchema = z.object({
  locale: localeEnum,
  name: z.string().trim().min(1, 'Food name is required').max(200),
  description: z.string().trim().max(1000).nullable().default(null),
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

const REQUIRED_ACTIVE_MACROS = [
  'nut_energy',
  'nut_protein',
  'nut_carbohydrate',
  'nut_fat_total',
] as const;

const REQUIRED_PROVENANCE_FIELDS = [
  'source_id',
  'external_id',
  'source_url',
  'citation',
  'dataset_version',
  'method',
  'retrieved_at',
  'license',
] as const;

type ProvenanceInput = FoodNutrientInputDto | FoodServingInputDto;

function validateCompleteProvenance(
  item: ProvenanceInput,
  ctx: z.RefinementCtx,
  path: 'nutrients' | 'servings',
  index: number,
  label: string,
) {
  for (const field of REQUIRED_PROVENANCE_FIELDS) {
    const value = item[field];
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Active food ${label} must have non-empty ${field}`,
        path: [path, index, field],
      });
    }
  }
}

function validateActiveFoodPublication(
  data: {
    status: z.infer<typeof foodStatusEnum>;
    nutrients?: FoodNutrientInputDto[] | undefined;
    servings?: FoodServingInputDto[] | undefined;
  },
  ctx: z.RefinementCtx,
) {
  if (data.status !== 'active') return;

  const nutrients = data.nutrients ?? [];
  const nutrientIds = new Set(nutrients.map((nutrient) => nutrient.nutrient_id));
  for (const requiredMacro of REQUIRED_ACTIVE_MACROS) {
    if (!nutrientIds.has(requiredMacro)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Active food must have '${requiredMacro}' defined in nutrients array`,
        path: ['nutrients'],
      });
    }
  }

  nutrients.forEach((nutrient, index) => {
    validateCompleteProvenance(
      nutrient,
      ctx,
      'nutrients',
      index,
      `nutrient '${nutrient.nutrient_id}'`,
    );
  });
  (data.servings ?? []).forEach((serving, index) => {
    validateCompleteProvenance(serving, ctx, 'servings', index, `serving '${serving.name_en}'`);
  });
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
    status: foodStatusEnum.default('draft'),
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

    validateActiveFoodPublication(data, ctx);
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
  q: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().trim().max(512).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
export type FoodListQueryDto = z.infer<typeof foodListQuerySchema>;

export const adminFoodListQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'archived', 'all']).default('all'),
  category_id: z.string().trim().min(1).optional(),
  locale: localeEnum.default('fa'),
  q: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().trim().max(512).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
export type AdminFoodListQueryDto = z.infer<typeof adminFoodListQuerySchema>;

// ==========================================
// Phase 8: Food Diary Schemas
// ==========================================

export const diaryMealTypeEnum = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type DiaryMealTypeDto = z.infer<typeof diaryMealTypeEnum>;

export const diaryDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Date must be a valid calendar date');

const diaryPortionFields = {
  grams: z.number().finite().positive('Grams must be strictly positive').optional(),
  serving_id: z.string().trim().min(1).optional(),
  quantity: z.number().finite().positive('Quantity must be strictly positive').default(1),
};

function validateDiaryPortion(
  data: {
    grams?: number | null | undefined;
    serving_id?: string | null | undefined;
    quantity?: number | undefined;
  },
  ctx: z.RefinementCtx,
) {
  const hasGrams = data.grams !== undefined && data.grams !== null;
  const hasServing = data.serving_id !== undefined && data.serving_id !== null;
  if (hasGrams === hasServing) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Specify exactly one of grams or serving_id',
      path: ['grams'],
    });
  }
  if (hasGrams && data.quantity !== undefined && data.quantity !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Quantity is only supported with serving_id; grams entries must use quantity 1.',
      path: ['quantity'],
    });
  }
}

export const createDiaryEntrySchema = z
  .object({
    food_id: z.string().trim().min(1),
    ...diaryPortionFields,
    meal_type: diaryMealTypeEnum.default('snack'),
    consumed_at: rfc3339TimestampSchema.optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => validateDiaryPortion(data, ctx));
export type CreateDiaryEntryDto = z.infer<typeof createDiaryEntrySchema>;

export const updateDiaryEntrySchema = z
  .object({
    grams: z.number().finite().positive('Grams must be strictly positive').nullable().optional(),
    serving_id: z.string().trim().min(1).nullable().optional(),
    quantity: z.number().finite().positive('Quantity must be strictly positive').optional(),
    meal_type: diaryMealTypeEnum.optional(),
    consumed_at: rfc3339TimestampSchema.optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.grams !== undefined || data.serving_id !== undefined) {
      validateDiaryPortion(data, ctx);
    }
  });
export type UpdateDiaryEntryDto = z.infer<typeof updateDiaryEntrySchema>;

export const diaryListQuerySchema = z.object({
  date: diaryDateSchema,
  locale: localeEnum.default('fa'),
});
export type DiaryListQueryDto = z.infer<typeof diaryListQuerySchema>;

// ==========================================
// Phase 5: Dataset Manifest & Import Schemas
// ==========================================

export const foodSourceManifestSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^src_[a-z0-9_]+$/, 'Source ID must follow "src_<name>" format'),
  name: z.string().trim().min(1).max(150),
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'Source code must be snake_case'),
  publisher: z.string().trim().min(1).max(150),
  url: z.string().trim().url('Must be a valid URL'),
  version: z.string().trim().min(1).max(50),
  acquisitionDate: rfc3339TimestampSchema,
  license: z.string().trim().min(1).max(250),
  redistributionAllowed: z.boolean(),
  sha256Checksum: z
    .string()
    .trim()
    .length(64, 'SHA-256 checksum must be exactly 64 hexadecimal characters')
    .regex(/^[a-f0-9]{64}$/i, 'SHA-256 must be a valid hexadecimal string'),
  language: z.string().trim().min(1).max(50),
  description: z.string().trim().max(1000).nullable().optional(),
});
export type FoodSourceManifestDto = z.infer<typeof foodSourceManifestSchema>;

export const foodDatasetNutrientInputSchema = foodNutrientInputSchema;
export type FoodDatasetNutrientInputDto = z.infer<typeof foodDatasetNutrientInputSchema>;

export const foodDatasetServingInputSchema = foodServingInputSchema;
export type FoodDatasetServingInputDto = z.infer<typeof foodDatasetServingInputSchema>;

export const foodDatasetItemSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).max(100).optional(),
    category_id: z.string().trim().min(1).nullable().optional(),
    category_slug: z.string().trim().min(1).max(100).nullable().optional(),
    food_type: foodTypeEnum.default('generic'),
    brand_name: z.string().trim().max(100).nullable().optional(),
    barcode: canonicalBarcodeSchema,
    status: foodStatusEnum.default('draft'),
    source_id: z.string().trim().min(1),
    external_id: z.string().trim().min(1).max(100),
    translations: z
      .array(foodTranslationInputSchema)
      .min(1, 'At least one translation is required'),
    aliases: z.array(foodAliasInputSchema).optional(),
    nutrients: z.array(foodDatasetNutrientInputSchema).optional(),
    servings: z.array(foodDatasetServingInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    validateUniqueLocales(data.translations, ctx, 'translations');
    if (data.nutrients) {
      validateUniqueNutrients(data.nutrients, ctx);
    }
    if (data.aliases) {
      validateUniqueAliases(data.aliases, ctx);
    }
    if (data.servings) {
      validateUniqueServings(data.servings, ctx);
    }

    if (data.food_type === 'branded' && (!data.brand_name || data.brand_name.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Branded food requires a valid brand_name',
        path: ['brand_name'],
      });
    }

    validateActiveFoodPublication(data, ctx);
  });
export type FoodDatasetItemDto = z.infer<typeof foodDatasetItemSchema>;

export const foodDatasetFileSchema = z
  .object({
    manifest: foodSourceManifestSchema,
    foods: z.array(foodDatasetItemSchema).min(1, 'Dataset must contain at least one food item'),
  })
  .superRefine((file, ctx) => {
    file.foods.forEach((food, idx) => {
      if (food.source_id !== file.manifest.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Item source_id '${food.source_id}' does not match dataset manifest ID '${file.manifest.id}'`,
          path: ['foods', idx, 'source_id'],
        });
      }
    });
  });
export type FoodDatasetFileDto = z.infer<typeof foodDatasetFileSchema>;

export const importModeEnum = z.enum(['validate', 'dry-run', 'import']);
export type ImportModeDto = z.infer<typeof importModeEnum>;

export const importResultSchema = z.object({
  sourceId: z.string(),
  datasetName: z.string(),
  mode: importModeEnum,
  fileChecksum: z.string(),
  totalRecords: z.number().int().nonnegative(),
  insertedCount: z.number().int().nonnegative(),
  updatedCount: z.number().int().nonnegative(),
  unchangedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  status: z.enum(['success', 'failed', 'dry_run']),
  errors: z.array(z.string()),
  executionTimeMs: z.number().nonnegative(),
});
export type ImportResultDto = z.infer<typeof importResultSchema>;
