import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const pnpmEntryPoint = process.env.npm_execpath;

function executePnpm(args, options = {}) {
  if (!pnpmEntryPoint) {
    throw new Error('This data pipeline must be run through the repository pnpm scripts');
  }
  return execFileSync(process.execPath, [pnpmEntryPoint, ...args], options);
}

function sqlText(value) {
  if (value === undefined || value === null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Refusing to serialize a non-finite SQL number');
  }
  return String(value);
}

// Normalization function matching @nutriai/localization
export function normalizePersianForComparison(text) {
  if (!text) return '';
  return text
    .replace(/[\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06f0 + 48))
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
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/,
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

const provenanceMethodEnum = z.enum(['laboratory', 'database', 'calculated', 'measured']);

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
  license: z.string().trim().max(250).nullable().optional(),
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
  license: z.string().trim().max(250).nullable().optional(),
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
    status: z.enum(['draft', 'active', 'archived']).default('draft'),
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

      const requiredProvenance = [
        'source_id',
        'external_id',
        'source_url',
        'citation',
        'dataset_version',
        'method',
        'retrieved_at',
        'license',
      ];
      nutrients.forEach((n, idx) => {
        requiredProvenance.forEach((field) => {
          if (!n[field]) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Active food nutrient '${n.nutrient_id}' must have non-empty ${field}`,
              path: ['nutrients', idx, field],
            });
          }
        });
      });

      const servings = data.servings || [];
      servings.forEach((s, idx) => {
        requiredProvenance.forEach((field) => {
          if (!s[field]) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Active food serving '${s.name_en}' must have non-empty ${field}`,
              path: ['servings', idx, field],
            });
          }
        });
      });
    }
  });

function executeD1Command(command) {
  const raw = executePnpm(
    [
      '--filter',
      '@nutriai/worker-api',
      'exec',
      'wrangler',
      'd1',
      'execute',
      'DB',
      '--local',
      '--json',
      '--command',
      command,
    ],
    { cwd: rootDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const jsonStart = raw.indexOf('[');
  if (jsonStart !== -1) {
    const parsed = JSON.parse(raw.substring(jsonStart));
    return (parsed[0]?.results || []).map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value === 'null' ? null : value]),
      ),
    );
  }
  return [];
}

export function runDataPipeline(options) {
  const { sourceDir, mode, allowLicensedLocal, environment } = options;
  const manifestPath = path.join(sourceDir, 'source-manifest.json');
  const standardFoodsPath = path.join(sourceDir, 'foods.json');
  const templateFoodsPath = path.join(sourceDir, 'sample-template.json');
  const foodsPath = fs.existsSync(standardFoodsPath) ? standardFoodsPath : templateFoodsPath;

  const errors = [];

  if (!fs.existsSync(manifestPath)) {
    errors.push(`Manifest not found at ${manifestPath}`);
    return { success: false, totalItems: 0, errors, manifest: null, checksum: '' };
  }

  if (!fs.existsSync(foodsPath)) {
    errors.push(`Foods dataset not found at ${standardFoodsPath} or ${templateFoodsPath}`);
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
    const isExplicitLicensedLocal =
      allowLicensedLocal === true && (environment === 'development' || environment === 'test');
    if (manifestParsed.data.redistributionAllowed === false && !isExplicitLicensedLocal) {
      errors.push(
        `Dataset license "${manifestParsed.data.license}" disallows redistribution. Import requires --licensed-local and NUTRIAI_DATA_ENV=development|test; CI, staging, and production are prohibited.`,
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

    const sourceId = manifestParsed.data.id;
    const existingFoods = executeD1Command(
      `SELECT * FROM foods WHERE source_id = ${sqlText(sourceId)}`,
    );
    const existingTranslations = executeD1Command(
      `SELECT * FROM food_translations WHERE food_id IN (SELECT id FROM foods WHERE source_id = ${sqlText(sourceId)})`,
    );
    const existingAliases = executeD1Command(
      `SELECT * FROM food_aliases WHERE food_id IN (SELECT id FROM foods WHERE source_id = ${sqlText(sourceId)})`,
    );
    const existingNutrients = executeD1Command(
      `SELECT * FROM food_nutrients WHERE food_id IN (SELECT id FROM foods WHERE source_id = ${sqlText(sourceId)})`,
    );
    const existingServings = executeD1Command(
      `SELECT * FROM food_servings WHERE food_id IN (SELECT id FROM foods WHERE source_id = ${sqlText(sourceId)})`,
    );
    const categoryRows = executeD1Command(
      "SELECT id, slug FROM food_categories WHERE status = 'active'",
    );
    const categoryIdsBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]));
    const resolveCategoryId = (item) =>
      item.category_id ??
      (item.category_slug ? categoryIdsBySlug.get(item.category_slug) ?? null : null);

    const existingMap = new Map();
    existingFoods.forEach((f) => {
      existingMap.set(f.external_id, {
        food: f,
        translations: existingTranslations.filter((t) => t.food_id === f.id),
        aliases: existingAliases.filter((a) => a.food_id === f.id),
        nutrients: existingNutrients.filter((n) => n.food_id === f.id),
        servings: existingServings.filter((s) => s.food_id === f.id),
      });
    });

    function isItemIdentical(item, fullExisting) {
      if (!fullExisting) return false;
      const f = fullExisting.food;
      if (item.food_type !== f.food_type) return false;
      if ((item.brand_name ?? null) !== (f.brand_name ?? null)) return false;
      if ((item.barcode ?? null) !== (f.barcode ?? null)) return false;
      if (item.status !== f.status) return false;
      if (resolveCategoryId(item) !== (f.category_id ?? null)) return false;

      // Translations
      if (item.translations.length !== fullExisting.translations.length) return false;
      for (const t of item.translations) {
        const et = fullExisting.translations.find((x) => x.locale === t.locale);
        if (!et || et.name !== t.name || (et.description ?? null) !== (t.description ?? null)) {
          return false;
        }
      }

      // Aliases
      const itemAliases = item.aliases || [];
      if (itemAliases.length !== fullExisting.aliases.length) return false;
      for (const a of itemAliases) {
        const ea = fullExisting.aliases.find((x) => x.locale === a.locale && x.alias === a.alias);
        if (!ea) return false;
      }

      // Nutrients & granular provenance
      const itemNutrients = item.nutrients || [];
      if (itemNutrients.length !== fullExisting.nutrients.length) return false;
      for (const n of itemNutrients) {
        const en = fullExisting.nutrients.find((x) => x.nutrient_id === n.nutrient_id);
        if (!en || Number(en.amount_per_100g) !== Number(n.amount_per_100g)) return false;
        if ((en.source_id ?? null) !== (n.source_id ?? null)) return false;
        if ((en.external_id ?? null) !== (n.external_id ?? null)) return false;
        if ((en.source_url ?? null) !== (n.source_url ?? null)) return false;
        if ((en.citation ?? null) !== (n.citation ?? null)) return false;
        if ((en.dataset_version ?? null) !== (n.dataset_version ?? null)) return false;
        if ((en.method ?? null) !== (n.method ?? null)) return false;
        if ((en.retrieved_at ?? null) !== (n.retrieved_at ?? null)) return false;
        if ((en.license ?? null) !== (n.license ?? null)) return false;
      }

      // Servings & granular provenance
      const itemServings = item.servings || [];
      if (itemServings.length !== fullExisting.servings.length) return false;
      for (const s of itemServings) {
        const es = fullExisting.servings.find(
          (x) => x.name_fa === s.name_fa && x.name_en === s.name_en,
        );
        if (!es || Number(es.weight_g) !== Number(s.weight_g)) return false;
        if ((es.household_unit ?? null) !== (s.household_unit ?? null)) return false;
        if ((es.source_id ?? null) !== (s.source_id ?? null)) return false;
        if ((es.external_id ?? null) !== (s.external_id ?? null)) return false;
        if ((es.source_url ?? null) !== (s.source_url ?? null)) return false;
        if ((es.citation ?? null) !== (s.citation ?? null)) return false;
        if ((es.dataset_version ?? null) !== (s.dataset_version ?? null)) return false;
        if ((es.method ?? null) !== (s.method ?? null)) return false;
        if ((es.retrieved_at ?? null) !== (s.retrieved_at ?? null)) return false;
        if ((es.license ?? null) !== (s.license ?? null)) return false;
      }

      return true;
    }

    const itemsToMutate = [];
    validItems.forEach((item) => {
      const fullExisting = existingMap.get(item.external_id);
      if (!fullExisting) {
        insertedCount++;
        itemsToMutate.push({
          item,
          categoryId: resolveCategoryId(item),
          isNew: true,
          foodId: item.id || `food_${crypto.randomUUID()}`,
        });
      } else if (isItemIdentical(item, fullExisting)) {
        unchangedCount++;
      } else {
        updatedCount++;
        itemsToMutate.push({
          item,
          categoryId: resolveCategoryId(item),
          isNew: false,
          foodId: fullExisting.food.id,
        });
      }
    });

    if (mode === 'import-local') {
      const tmpSqlPath = path.join(rootDir, '.wrangler', `import_${Date.now()}.sql`);
      const now = new Date().toISOString();
      const sqlLines = ['BEGIN TRANSACTION;'];

      // Source upsert
      const m = manifestParsed.data;
      sqlLines.push(
        `INSERT INTO food_sources (id, name, code, description, url, license, acquisition_date, created_at, updated_at) VALUES (${sqlText(m.id)}, ${sqlText(m.name)}, ${sqlText(m.code)}, ${sqlText(m.description)}, ${sqlText(m.url)}, ${sqlText(m.license)}, ${sqlText(m.acquisitionDate)}, ${sqlText(now)}, ${sqlText(now)}) ON CONFLICT(id) DO UPDATE SET name = excluded.name, code = excluded.code, description = excluded.description, url = excluded.url, license = excluded.license, acquisition_date = excluded.acquisition_date, updated_at = excluded.updated_at;`,
      );

      // Only write mutating items
      itemsToMutate.forEach(({ item, categoryId, isNew, foodId }) => {
        const fullExisting = existingMap.get(item.external_id);
        const createdAt = isNew ? now : fullExisting.food.created_at;
        sqlLines.push(
          `INSERT INTO foods (id, category_id, food_type, brand_name, barcode, status, source_id, external_id, created_at, updated_at) VALUES (${sqlText(foodId)}, ${sqlText(categoryId)}, ${sqlText(item.food_type)}, ${sqlText(item.brand_name)}, ${sqlText(item.barcode)}, ${sqlText(item.status)}, ${sqlText(item.source_id)}, ${sqlText(item.external_id)}, ${sqlText(createdAt)}, ${sqlText(now)}) ON CONFLICT(id) DO UPDATE SET category_id = excluded.category_id, food_type = excluded.food_type, brand_name = excluded.brand_name, barcode = excluded.barcode, status = excluded.status, source_id = excluded.source_id, external_id = excluded.external_id, updated_at = excluded.updated_at;`,
        );

        if (!isNew) {
          sqlLines.push(`DELETE FROM food_translations WHERE food_id = ${sqlText(foodId)};`);
          sqlLines.push(`DELETE FROM food_aliases WHERE food_id = ${sqlText(foodId)};`);
          sqlLines.push(`DELETE FROM food_nutrients WHERE food_id = ${sqlText(foodId)};`);
          sqlLines.push(`DELETE FROM food_servings WHERE food_id = ${sqlText(foodId)};`);
        }

        item.translations.forEach((t) => {
          sqlLines.push(
            `INSERT INTO food_translations (id, food_id, locale, name, description, search_text, created_at, updated_at) VALUES (${sqlText(`ft_${crypto.randomUUID()}`)}, ${sqlText(foodId)}, ${sqlText(t.locale)}, ${sqlText(t.name)}, ${sqlText(t.description)}, ${sqlText(normalizePersianForComparison(t.name))}, ${sqlText(now)}, ${sqlText(now)});`,
          );
        });

        (item.aliases || []).forEach((a) => {
          sqlLines.push(
            `INSERT INTO food_aliases (id, food_id, locale, alias, search_text, created_at) VALUES (${sqlText(`fa_${crypto.randomUUID()}`)}, ${sqlText(foodId)}, ${sqlText(a.locale)}, ${sqlText(a.alias)}, ${sqlText(normalizePersianForComparison(a.alias))}, ${sqlText(now)});`,
          );
        });

        (item.nutrients || []).forEach((n) => {
          sqlLines.push(
            `INSERT INTO food_nutrients (id, food_id, nutrient_id, amount_per_100g, source_id, external_id, source_url, citation, dataset_version, method, retrieved_at, license, created_at, updated_at) VALUES (${sqlText(`fn_${crypto.randomUUID()}`)}, ${sqlText(foodId)}, ${sqlText(n.nutrient_id)}, ${sqlNumber(n.amount_per_100g)}, ${sqlText(n.source_id)}, ${sqlText(n.external_id)}, ${sqlText(n.source_url)}, ${sqlText(n.citation)}, ${sqlText(n.dataset_version)}, ${sqlText(n.method)}, ${sqlText(n.retrieved_at)}, ${sqlText(n.license)}, ${sqlText(now)}, ${sqlText(now)});`,
          );
        });

        (item.servings || []).forEach((s) => {
          sqlLines.push(
            `INSERT INTO food_servings (id, food_id, name_fa, name_en, weight_g, household_unit, source_id, external_id, source_url, citation, dataset_version, method, retrieved_at, license, created_at, updated_at) VALUES (${sqlText(`fs_${crypto.randomUUID()}`)}, ${sqlText(foodId)}, ${sqlText(s.name_fa)}, ${sqlText(s.name_en)}, ${sqlNumber(s.weight_g)}, ${sqlText(s.household_unit)}, ${sqlText(s.source_id)}, ${sqlText(s.external_id)}, ${sqlText(s.source_url)}, ${sqlText(s.citation)}, ${sqlText(s.dataset_version)}, ${sqlText(s.method)}, ${sqlText(s.retrieved_at)}, ${sqlText(s.license)}, ${sqlText(now)}, ${sqlText(now)});`,
          );
        });
      });

      sqlLines.push(
        `INSERT INTO food_import_logs (id, source_id, dataset_name, file_checksum, total_records, inserted_count, updated_count, unchanged_count, skipped_count, status, error_summary, executed_by, created_at) VALUES (${sqlText(`imp_${crypto.randomUUID()}`)}, ${sqlText(m.id)}, ${sqlText(m.name)}, ${sqlText(computedChecksum)}, ${validItems.length}, ${insertedCount}, ${updatedCount}, ${unchangedCount}, 0, 'success', NULL, 'cli_local', ${sqlText(now)});`,
      );
      sqlLines.push('COMMIT;');

      fs.mkdirSync(path.dirname(tmpSqlPath), { recursive: true });
      fs.writeFileSync(tmpSqlPath, sqlLines.join('\n'), 'utf-8');

      try {
        executePnpm(
          [
            '--filter',
            '@nutriai/worker-api',
            'exec',
            'wrangler',
            'd1',
            'execute',
            'DB',
            '--local',
            `--file=${tmpSqlPath}`,
          ],
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
const detectedEnvironment =
  process.env.CI === 'true'
    ? 'ci'
    : process.env.NODE_ENV === 'production'
      ? 'production'
      : process.env.NUTRIAI_DATA_ENV || 'development';

const result = runDataPipeline({
  sourceDir: targetDir,
  mode,
  allowLicensedLocal,
  environment: detectedEnvironment,
});

if (!result.success) {
  process.exit(1);
}
