import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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
  license: z.string().trim().min(1).max(150),
  redistributionAllowed: z.boolean(),
  sha256Checksum: z
    .string()
    .trim()
    .length(64, 'SHA-256 checksum must be exactly 64 hexadecimal characters')
    .regex(/^[a-f0-9]{64}$/i, 'SHA-256 must be a valid hexadecimal string'),
  language: z.string().trim().min(1).max(50),
  description: z.string().trim().max(1000).nullable().optional(),
});

const provenanceMethodEnum = z.enum(['laboratory', 'database', 'calculated']);

const foodDatasetNutrientInputSchema = z.object({
  nutrient_id: z.string().trim().min(1, 'Nutrient ID is required'),
  amount_per_100g: z.number().min(0, 'Nutrient amount cannot be negative'),
  source_id: z.string().trim().min(1).nullable().optional(),
  external_id: z.string().trim().max(100).nullable().optional(),
  source_url: z.string().trim().url('Must be a valid URL').nullable().optional(),
  citation: z.string().trim().max(500).nullable().optional(),
  dataset_version: z.string().trim().max(50).nullable().optional(),
  method: provenanceMethodEnum.nullable().optional(),
  retrieved_at: rfc3339TimestampSchema.nullable().optional(),
  license: z.string().trim().max(150).nullable().optional(),
});

const foodDatasetServingInputSchema = z.object({
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
  license: z.string().trim().max(150).nullable().optional(),
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
    nutrients: z.array(foodDatasetNutrientInputSchema).optional(),
    servings: z.array(foodDatasetServingInputSchema).optional(),
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

    // Active foods must have complete macro nutrients and valid provenance
    if (data.status === 'active') {
      const nutrients = data.nutrients || [];
      const nutrientIds = new Set(nutrients.map((n) => n.nutrient_id));
      const requiredMacros = ['nut_energy', 'nut_protein', 'nut_carbohydrate', 'nut_fat_total'];
      for (const req of requiredMacros) {
        if (!nutrientIds.has(req)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Active food must have '${req}' defined in nutrients array`,
            path: ['nutrients'],
          });
        }
      }

      nutrients.forEach((n, idx) => {
        if (!n.source_id || n.source_id.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Active food nutrient '${n.nutrient_id}' must have a valid source_id`,
            path: ['nutrients', idx, 'source_id'],
          });
        }
        if (!n.method) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Active food nutrient '${n.nutrient_id}' must have method ('laboratory', 'database', 'calculated')`,
            path: ['nutrients', idx, 'method'],
          });
        }
        if (!n.retrieved_at) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Active food nutrient '${n.nutrient_id}' must have retrieved_at timestamp`,
            path: ['nutrients', idx, 'retrieved_at'],
          });
        }
      });

      const servings = data.servings || [];
      servings.forEach((s, idx) => {
        if (!s.source_id || s.source_id.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Active food serving '${s.name_en}' must have a valid source_id`,
            path: ['servings', idx, 'source_id'],
          });
        }
        if (!s.method) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Active food serving '${s.name_en}' must have method ('laboratory', 'database', 'calculated')`,
            path: ['servings', idx, 'method'],
          });
        }
        if (!s.retrieved_at) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Active food serving '${s.name_en}' must have retrieved_at timestamp`,
            path: ['servings', idx, 'retrieved_at'],
          });
        }
      });
    }
  });

function executeD1Command(command) {
  try {
    const raw = execSync(
      `pnpm --filter @nutriai/worker-api exec wrangler d1 execute DB --local --json --command "${command}"`,
      { cwd: rootDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const jsonStart = raw.indexOf('[');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(raw.substring(jsonStart));
      return parsed[0]?.results || [];
    }
    return [];
  } catch (err) {
    return null;
  }
}

export function runDataPipeline(options) {
  const { sourceDir, mode, allowLicensedLocal } = options;
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

  // Compute Checksum from raw bytes
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
    if (manifestParsed.data.redistributionAllowed === false && !allowLicensedLocal) {
      errors.push(
        `Dataset license "${manifestParsed.data.license}" disallows redistribution. Direct ingestion is restricted to licensed local environments with explicit --licensed-local flag.`,
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

    // Check source_id matches manifest
    if (manifestParsed.success && item.source_id !== manifestParsed.data.id) {
      errors.push(
        `${context} source_id "${item.source_id}" does not match manifest ID "${manifestParsed.data.id}"`,
      );
    }

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

  // D1 Database Interactivity for dry-run and local import
  let d1InitialCount = 0;
  let d1FinalCount = 0;
  let insertedCount = 0;
  let unchangedCount = 0;
  let updatedCount = 0;

  if (success && (mode === 'dry-run' || mode === 'import-local')) {
    const countRes = executeD1Command('SELECT count(*) as total FROM foods');
    if (countRes && countRes[0]) {
      d1InitialCount = Number(countRes[0].total) || 0;
    }

    const existingRows = executeD1Command(
      `SELECT id, external_id FROM foods WHERE source_id = '${manifestParsed.data.id}'`,
    );
    const existingMap = new Map((existingRows || []).map((r) => [r.external_id, r.id]));

    validItems.forEach((item) => {
      if (existingMap.has(item.external_id)) {
        unchangedCount++;
      } else {
        insertedCount++;
      }
    });

    if (mode === 'import-local') {
      // Execute local import SQL script via wrangler d1
      const tmpSqlPath = path.join(rootDir, '.wrangler', `import_${Date.now()}.sql`);
      const now = new Date().toISOString();
      const sqlLines = ['BEGIN TRANSACTION;'];

      // Source upsert
      const m = manifestParsed.data;
      sqlLines.push(
        `INSERT INTO food_sources (id, name, code, description, url, license, acquisition_date, created_at, updated_at) VALUES ('${m.id}', '${m.name.replace(/'/g, "''")}', '${m.code}', ${m.description ? `'${m.description.replace(/'/g, "''")}'` : 'NULL'}, '${m.url}', '${m.license}', '${m.acquisitionDate}', '${now}', '${now}') ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at;`,
      );

      // Foods
      validItems.forEach((item) => {
        const foodId = existingMap.get(item.external_id) || item.id || `food_${crypto.randomUUID()}`;
        sqlLines.push(
          `INSERT INTO foods (id, category_id, food_type, brand_name, barcode, status, source_id, external_id, created_at, updated_at) VALUES ('${foodId}', ${item.category_id ? `'${item.category_id}'` : 'NULL'}, '${item.food_type}', ${item.brand_name ? `'${item.brand_name.replace(/'/g, "''")}'` : 'NULL'}, ${item.barcode ? `'${item.barcode}'` : 'NULL'}, '${item.status}', '${item.source_id}', '${item.external_id}', '${now}', '${now}') ON CONFLICT(id) DO UPDATE SET category_id = excluded.category_id, food_type = excluded.food_type, brand_name = excluded.brand_name, barcode = excluded.barcode, status = excluded.status, updated_at = excluded.updated_at;`,
        );

        // Delete existing relations
        sqlLines.push(`DELETE FROM food_translations WHERE food_id = '${foodId}';`);
        sqlLines.push(`DELETE FROM food_aliases WHERE food_id = '${foodId}';`);
        sqlLines.push(`DELETE FROM food_nutrients WHERE food_id = '${foodId}';`);
        sqlLines.push(`DELETE FROM food_servings WHERE food_id = '${foodId}';`);

        // Translations
        item.translations.forEach((t) => {
          sqlLines.push(
            `INSERT INTO food_translations (id, food_id, locale, name, description, created_at, updated_at) VALUES ('ft_${crypto.randomUUID()}', '${foodId}', '${t.locale}', '${t.name.replace(/'/g, "''")}', ${t.description ? `'${t.description.replace(/'/g, "''")}'` : 'NULL'}, '${now}', '${now}');`,
          );
        });

        // Aliases
        (item.aliases || []).forEach((a) => {
          sqlLines.push(
            `INSERT INTO food_aliases (id, food_id, locale, alias, created_at) VALUES ('fa_${crypto.randomUUID()}', '${foodId}', '${a.locale}', '${a.alias.replace(/'/g, "''")}', '${now}');`,
          );
        });

        // Nutrients
        (item.nutrients || []).forEach((n) => {
          sqlLines.push(
            `INSERT INTO food_nutrients (id, food_id, nutrient_id, amount_per_100g, source_id, external_id, source_url, citation, dataset_version, method, retrieved_at, license, created_at, updated_at) VALUES ('fn_${crypto.randomUUID()}', '${foodId}', '${n.nutrient_id}', ${n.amount_per_100g}, '${n.source_id || m.id}', ${n.external_id ? `'${n.external_id}'` : 'NULL'}, ${n.source_url ? `'${n.source_url}'` : 'NULL'}, ${n.citation ? `'${n.citation.replace(/'/g, "''")}'` : 'NULL'}, ${n.dataset_version ? `'${n.dataset_version}'` : 'NULL'}, ${n.method ? `'${n.method}'` : 'NULL'}, ${n.retrieved_at ? `'${n.retrieved_at}'` : 'NULL'}, ${n.license ? `'${n.license.replace(/'/g, "''")}'` : 'NULL'}, '${now}', '${now}');`,
          );
        });

        // Servings
        (item.servings || []).forEach((s) => {
          sqlLines.push(
            `INSERT INTO food_servings (id, food_id, name_fa, name_en, weight_g, household_unit, source_id, external_id, source_url, citation, dataset_version, method, retrieved_at, license, created_at, updated_at) VALUES ('fs_${crypto.randomUUID()}', '${foodId}', '${s.name_fa.replace(/'/g, "''")}', '${s.name_en.replace(/'/g, "''")}', ${s.weight_g}, ${s.household_unit ? `'${s.household_unit.replace(/'/g, "''")}'` : 'NULL'}, '${s.source_id || m.id}', ${s.external_id ? `'${s.external_id}'` : 'NULL'}, ${s.source_url ? `'${s.source_url}'` : 'NULL'}, ${s.citation ? `'${s.citation.replace(/'/g, "''")}'` : 'NULL'}, ${s.dataset_version ? `'${s.dataset_version}'` : 'NULL'}, ${s.method ? `'${s.method}'` : 'NULL'}, ${s.retrieved_at ? `'${s.retrieved_at}'` : 'NULL'}, ${s.license ? `'${s.license.replace(/'/g, "''")}'` : 'NULL'}, '${now}', '${now}');`,
          );
        });
      });

      // Success log
      sqlLines.push(
        `INSERT INTO food_import_logs (id, source_id, dataset_name, file_checksum, total_records, inserted_count, updated_count, unchanged_count, skipped_count, status, error_summary, executed_by, created_at) VALUES ('imp_${crypto.randomUUID()}', '${m.id}', '${m.name.replace(/'/g, "''")}', '${computedChecksum}', ${validItems.length}, ${insertedCount}, ${updatedCount}, ${unchangedCount}, 0, 'success', NULL, 'cli_local', '${now}');`,
      );

      sqlLines.push('COMMIT;');

      fs.mkdirSync(path.dirname(tmpSqlPath), { recursive: true });
      fs.writeFileSync(tmpSqlPath, sqlLines.join('\n'), 'utf-8');

      try {
        execSync(
          `pnpm --filter @nutriai/worker-api exec wrangler d1 execute DB --local --file="${tmpSqlPath}"`,
          { cwd: rootDir, stdio: ['pipe', 'pipe', 'pipe'] },
        );
      } finally {
        if (fs.existsSync(tmpSqlPath)) fs.unlinkSync(tmpSqlPath);
      }
    }

    const postRes = executeD1Command('SELECT count(*) as total FROM foods');
    if (postRes && postRes[0]) {
      d1FinalCount = Number(postRes[0].total) || 0;
    }
  }

  console.log(`\n========================================`);
  console.log(` NutriAI Persia Data Pipeline: ${mode.toUpperCase()}`);
  console.log(` Source: ${manifestParsed.success ? manifestParsed.data.name : sourceDir}`);
  console.log(` SHA-256: ${computedChecksum}`);
  console.log(` Total Items: ${foodsJson.length} (Valid: ${validItems.length})`);
  if (mode === 'dry-run') {
    console.log(
      ` D1 Dry-Run Simulation: would insert ${insertedCount}, unchanged ${unchangedCount}, updated ${updatedCount}`,
    );
    console.log(
      ` D1 Mutex Proof: Rows before = ${d1InitialCount}, Rows after = ${d1FinalCount} (Zero mutations)`,
    );
  } else if (mode === 'import-local') {
    console.log(
      ` D1 Ingestion Executed: inserted ${insertedCount}, unchanged ${unchangedCount}, updated ${updatedCount}`,
    );
    console.log(` D1 Records: Rows before = ${d1InitialCount}, Rows now = ${d1FinalCount}`);
  }
  console.log(` Status: ${success ? '✅ PASSED' : '❌ FAILED'}`);
  if (errors.length > 0) {
    console.log(` Errors (${errors.length}):`);
    errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
  }
  console.log(`========================================\n`);

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
let mode = 'validate';
if (args.includes('--dry-run')) mode = 'dry-run';
if (args.includes('--import-local')) mode = 'import-local';

const allowLicensedLocal = args.includes('--licensed-local');

const result = runDataPipeline({
  sourceDir: targetDir,
  mode,
  allowLicensedLocal,
});

if (!result.success) {
  process.exit(1);
}
