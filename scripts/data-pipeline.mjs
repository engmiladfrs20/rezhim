import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Normalization function matching @nutriai/localization
export function normalizePersianForComparison(text) {
  if (!text) return '';
  return text
    .replace(/[\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48))
    .replace(/[\u0660-\u0669]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
    .replace(/[\u064A\u0649\u06D0\u06D1]/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/[\u0629\u06C0]/g, 'ه')
    .replace(/\u0626/g, 'ی')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u200C/g, ' ')
    .replace(/[-_.,/\\()[\]{}:;!?"'«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Schemas matching @nutriai/schemas
const rfc3339TimestampSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/,
    'Must be a valid RFC3339 UTC timestamp',
  )
  .refine((ts) => !isNaN(Date.parse(ts)), 'Must be a parseable timestamp');

const foodSourceManifestSchema = z.object({
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
  license: z.string().trim().min(1).max(100),
  redistributionAllowed: z.boolean(),
  sha256Checksum: z
    .string()
    .trim()
    .length(64, 'SHA-256 checksum must be exactly 64 hexadecimal characters')
    .regex(/^[a-f0-9]{64}$/i, 'SHA-256 must be a valid hexadecimal string'),
  language: z.string().trim().min(1).max(50),
  description: z.string().trim().max(1000).nullable().optional(),
});

const foodDatasetItemSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).max(100).optional(),
    category_id: z.string().trim().min(1).nullable().optional(),
    category_slug: z.string().trim().min(1).max(100).nullable().optional(),
    food_type: z.enum(['generic', 'branded']).default('generic'),
    brand_name: z.string().trim().max(100).nullable().optional(),
    barcode: z.string().trim().nullable().optional(),
    status: z.enum(['draft', 'active', 'archived']).default('active'),
    source_id: z.string().trim().min(1),
    external_id: z.string().trim().min(1).max(100),
    translations: z
      .array(
        z.object({
          locale: z.enum(['fa', 'en']),
          name: z.string().trim().min(1).max(150),
          description: z.string().trim().max(1000).nullable().optional(),
        }),
      )
      .min(1, 'At least one translation is required'),
    aliases: z
      .array(
        z.object({
          locale: z.enum(['fa', 'en']),
          alias: z.string().trim().min(1).max(100),
        }),
      )
      .optional(),
    nutrients: z
      .array(
        z.object({
          nutrient_id: z.string().trim().min(1),
          amount_per_100g: z.number().min(0, 'Nutrient amount cannot be negative'),
        }),
      )
      .optional(),
    servings: z
      .array(
        z.object({
          name_fa: z.string().trim().min(1).max(100),
          name_en: z.string().trim().min(1).max(100),
          weight_g: z.number().positive('Serving weight must be strictly positive'),
          household_unit: z.string().trim().max(50).nullable().optional(),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Unique translation locales
    const seenLocales = new Set();
    data.translations.forEach((t) => {
      if (seenLocales.has(t.locale)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate translation locale "${t.locale}"`,
        });
      }
      seenLocales.add(t.locale);
    });

    // Unique nutrient IDs
    if (data.nutrients) {
      const seenNutrients = new Set();
      data.nutrients.forEach((n) => {
        if (seenNutrients.has(n.nutrient_id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate nutrient ID "${n.nutrient_id}"`,
          });
        }
        seenNutrients.add(n.nutrient_id);
      });
    }

    // Branded food rule
    if (data.food_type === 'branded' && (!data.brand_name || data.brand_name.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Branded food requires a valid brand_name',
        path: ['brand_name'],
      });
    }
  });

export function runDataPipeline(options) {
  const { sourceDir, mode } = options;
  const manifestPath = path.join(sourceDir, 'source-manifest.json');
  const foodsPath = path.join(sourceDir, 'foods.json');

  const errors = [];

  if (!fs.existsSync(manifestPath)) {
    errors.push(`Manifest not found at ${manifestPath}`);
    return { success: false, totalItems: 0, errors, manifest: null, checksum: '' };
  }

  if (!fs.existsSync(foodsPath)) {
    errors.push(`Foods dataset not found at ${foodsPath}`);
    return { success: false, totalItems: 0, errors, manifest: null, checksum: '' };
  }

  // 1. Read files
  const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
  const foodsRaw = fs.readFileSync(foodsPath, 'utf-8');

  // Compute Checksum
  const computedChecksum = crypto.createHash('sha256').update(foodsRaw).digest('hex');

  // 2. Validate Manifest
  let manifestJson;
  try {
    manifestJson = JSON.parse(manifestRaw);
  } catch (err) {
    errors.push(`Invalid manifest JSON: ${err.message}`);
    return { success: false, totalItems: 0, errors, manifest: null, checksum: computedChecksum };
  }

  const manifestParsed = foodSourceManifestSchema.safeParse(manifestJson);
  if (!manifestParsed.success) {
    errors.push(
      `Manifest schema error: ${manifestParsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
    );
  } else {
    if (manifestParsed.data.sha256Checksum.toLowerCase() !== computedChecksum.toLowerCase()) {
      errors.push(
        `SHA-256 Checksum mismatch! Manifest specified: ${manifestParsed.data.sha256Checksum}, Actual file: ${computedChecksum}`,
      );
    }
  }

  // 3. Validate Foods Array
  let foodsJson;
  try {
    foodsJson = JSON.parse(foodsRaw);
  } catch (err) {
    errors.push(`Invalid foods.json: ${err.message}`);
    return {
      success: false,
      totalItems: 0,
      errors,
      manifest: manifestParsed.success ? manifestParsed.data : null,
      checksum: computedChecksum,
    };
  }

  if (!Array.isArray(foodsJson)) {
    errors.push('foods.json must contain an array of food items');
    return {
      success: false,
      totalItems: 0,
      errors,
      manifest: manifestParsed.success ? manifestParsed.data : null,
      checksum: computedChecksum,
    };
  }

  const seenExternalIds = new Set();
  const seenAliases = new Map();
  const validItems = [];

  foodsJson.forEach((rawItem, index) => {
    const context = `[Item ${index + 1} / ${rawItem?.external_id || 'unknown'}]`;
    const parsed = foodDatasetItemSchema.safeParse(rawItem);
    if (!parsed.success) {
      errors.push(
        `${context} validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
      );
      return;
    }

    const item = parsed.data;
    if (seenExternalIds.has(item.external_id)) {
      errors.push(`${context} duplicate external_id: ${item.external_id}`);
    }
    seenExternalIds.add(item.external_id);

    // Check alias collisions
    if (item.aliases) {
      for (const a of item.aliases) {
        const norm = normalizePersianForComparison(a.alias);
        if (norm) {
          const existing = seenAliases.get(norm);
          if (existing && existing !== item.external_id) {
            errors.push(
              `${context} alias "${a.alias}" collides with item "${existing}" after Persian normalization`,
            );
          } else {
            seenAliases.set(norm, item.external_id);
          }
        }
      }
    }

    validItems.push(item);
  });

  const success = errors.length === 0;

  if (mode !== 'report') {
    console.log(`\n========================================`);
    console.log(` NutriAI Persia Data Pipeline: ${mode.toUpperCase()}`);
    console.log(` Source: ${manifestParsed.success ? manifestParsed.data.name : sourceDir}`);
    console.log(` SHA-256: ${computedChecksum}`);
    console.log(` Total Items: ${foodsJson.length} (Valid: ${validItems.length})`);
    console.log(` Status: ${success ? '✅ PASSED' : '❌ FAILED'}`);
    if (errors.length > 0) {
      console.log(` Errors (${errors.length}):`);
      errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    }
    console.log(`========================================\n`);
  }

  return {
    success,
    totalItems: validItems.length,
    errors,
    manifest: manifestParsed.success ? manifestParsed.data : null,
    checksum: computedChecksum,
  };
}

// CLI Execution entrypoint
const args = process.argv.slice(2);
const positionalArgs = args.filter((a) => !a.startsWith('--'));
const targetDir =
  positionalArgs[0] || path.join(__dirname, '..', 'data', 'sources', 'open-iranian-foods');
const mode = args.includes('--dry-run') ? 'dry-run' : 'validate';

const result = runDataPipeline({
  sourceDir: targetDir,
  mode,
});

if (!result.success) {
  process.exit(1);
}
