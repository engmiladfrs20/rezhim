import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { FoodRepository } from '../db/food.repository';
import { FoodCategoryRepository } from '../db/food-category.repository';
import { NutrientRepository } from '../db/nutrient.repository';
import { FoodImportLogRepository } from '../db/food-import-log.repository';
import { foodSourceManifestSchema, foodDatasetFileSchema } from '@nutriai/schemas';
import { normalizePersianForComparison } from '@nutriai/localization';
import type { FoodDatasetFile, FoodDatasetItem, ImportMode, ImportResult } from '@nutriai/types';
import type {
  FoodRecord,
  FoodTranslationRecord,
  FoodAliasRecord,
  FoodServingRecord,
} from '../db/models';
import { validateFoodInvariants } from './food.service';

export interface PipelineOptions {
  allowLicensedLocal?: boolean;
  executedBy?: string;
}

export class FoodImporterService {
  private readonly db: D1Database;
  private readonly foodRepo: FoodRepository;
  private readonly catRepo: FoodCategoryRepository;
  private readonly nutrientRepo: NutrientRepository;
  private readonly importLogRepo: FoodImportLogRepository;

  constructor(db: D1Database) {
    this.db = db;
    this.foodRepo = new FoodRepository(db);
    this.catRepo = new FoodCategoryRepository(db);
    this.nutrientRepo = new NutrientRepository(db);
    this.importLogRepo = new FoodImportLogRepository(db);
  }

  /**
   * Computes SHA-256 hex digest for a string buffer using Web Crypto API.
   */
  async computeChecksum(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validates dataset manifest, schema integrity, referenced entities, granular provenance, and license restrictions.
   */
  async validateDataset(
    dataset: FoodDatasetFile,
    rawContent?: string,
    options?: PipelineOptions,
  ): Promise<{ valid: boolean; errors: string[]; checksum: string }> {
    const errors: string[] = [];

    // 1. Validate File Schema via Zod
    const fileParsed = foodDatasetFileSchema.safeParse(dataset);
    if (!fileParsed.success) {
      errors.push(
        `Dataset schema validation failed: ${fileParsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      );
    }

    // 2. Validate Manifest Schema
    const manifestParsed = foodSourceManifestSchema.safeParse(dataset.manifest);
    if (!manifestParsed.success) {
      errors.push(
        `Manifest validation failed: ${manifestParsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      );
    }

    // 3. Validate Checksum if raw content is provided
    let computedChecksum = dataset.manifest?.sha256Checksum || '';
    if (rawContent !== undefined) {
      computedChecksum = await this.computeChecksum(rawContent);
      if (
        dataset.manifest?.sha256Checksum &&
        computedChecksum.toLowerCase() !== dataset.manifest.sha256Checksum.toLowerCase()
      ) {
        errors.push(
          `SHA-256 checksum mismatch. Expected ${dataset.manifest.sha256Checksum}, computed ${computedChecksum}`,
        );
      }
    }

    // 4. License redistribution check
    if (dataset.manifest && dataset.manifest.redistributionAllowed === false) {
      if (!options?.allowLicensedLocal) {
        errors.push(
          `Dataset license "${dataset.manifest.license}" disallows redistribution. Direct ingestion is restricted to licensed local environments with explicit --licensed-local flag.`,
        );
      }
    }

    // 5. Validate Dataset Items Array
    if (!Array.isArray(dataset.foods) || dataset.foods.length === 0) {
      errors.push('Dataset must contain at least one food item array in "foods" property.');
      return { valid: false, errors, checksum: computedChecksum };
    }

    // 6. Pre-load valid Categories and Nutrients for fast lookup
    const [allCategories, allNutrients] = await Promise.all([
      this.catRepo.listAll('active'),
      this.nutrientRepo.listAll(),
    ]);
    const validCategoryIds = new Set(allCategories.map((c) => c.category.id));
    const validCategorySlugs = new Map(allCategories.map((c) => [c.category.slug, c.category.id]));
    const validNutrientIds = new Set(allNutrients.map((n) => n.id));

    // Duplicate detection trackers
    const seenExternalIds = new Set<string>();
    const seenAliases = new Map<string, string>(); // normalizedAlias -> externalId

    for (let i = 0; i < dataset.foods.length; i++) {
      const item = dataset.foods[i];
      if (!item) continue;
      const itemContext = `Item [${i}] (external_id: "${item.external_id || 'unknown'}")`;

      // Check external_id uniqueness in this batch
      if (seenExternalIds.has(item.external_id)) {
        errors.push(`${itemContext} duplicate external_id in dataset: "${item.external_id}"`);
      }
      seenExternalIds.add(item.external_id);

      // Check source_id matching manifest ID
      if (dataset.manifest && item.source_id !== dataset.manifest.id) {
        errors.push(
          `${itemContext} source_id "${item.source_id}" does not match manifest ID "${dataset.manifest.id}"`,
        );
      }

      // Check Category existence (either by category_id or category_slug)
      let resolvedCatId = item.category_id;
      if (!resolvedCatId && item.category_slug) {
        resolvedCatId = validCategorySlugs.get(item.category_slug) || null;
      }
      if (resolvedCatId && !validCategoryIds.has(resolvedCatId)) {
        errors.push(`${itemContext} references non-existent category ID: "${resolvedCatId}"`);
      }

      // Check Invariants (e.g. branded food requires brand_name, external_id requires source_id)
      try {
        validateFoodInvariants({
          food_type: item.food_type,
          brand_name: item.brand_name,
          source_id: item.source_id,
          external_id: item.external_id,
        });
      } catch (invErr) {
        errors.push(
          `${itemContext} invariant violation: ${invErr instanceof Error ? invErr.message : String(invErr)}`,
        );
      }

      // Check Nutrients existence & validation
      if (item.nutrients && item.nutrients.length > 0) {
        for (const n of item.nutrients) {
          if (!validNutrientIds.has(n.nutrient_id)) {
            errors.push(`${itemContext} references invalid nutrient ID: "${n.nutrient_id}"`);
          }
          if (n.amount_per_100g < 0) {
            errors.push(
              `${itemContext} negative nutrient amount for "${n.nutrient_id}": ${n.amount_per_100g}`,
            );
          }
        }
      }

      // Check Servings
      if (item.servings && item.servings.length > 0) {
        for (const s of item.servings) {
          if (s.weight_g <= 0) {
            errors.push(`${itemContext} zero or negative serving weight: ${s.weight_g}`);
          }
        }
      }

      // Check Normalized Alias Collision
      if (item.aliases && item.aliases.length > 0) {
        for (const a of item.aliases) {
          const norm = normalizePersianForComparison(a.alias);
          if (norm.length > 0) {
            const existingItem = seenAliases.get(norm);
            if (existingItem && existingItem !== item.external_id) {
              errors.push(
                `${itemContext} normalized alias "${a.alias}" collides with item "${existingItem}"`,
              );
            } else {
              seenAliases.set(norm, item.external_id);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      checksum: computedChecksum,
    };
  }

  /**
   * Executes the import pipeline in validate, dry-run, or import mode with true single-batch atomicity.
   */
  async runPipeline(
    dataset: FoodDatasetFile,
    rawContent?: string,
    mode: ImportMode = 'import',
    options?: PipelineOptions,
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const executedBy = options?.executedBy || 'system';
    const datasetName = dataset.manifest?.name || 'unknown_dataset';
    const sourceId = dataset.manifest?.id || 'unknown_source';

    // 1. Validation Phase
    const valResult = await this.validateDataset(dataset, rawContent, options);
    if (!valResult.valid) {
      const failedResult: ImportResult = {
        sourceId,
        datasetName,
        mode,
        fileChecksum: valResult.checksum,
        totalRecords: dataset.foods?.length || 0,
        insertedCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        skippedCount: 0,
        failedCount: dataset.foods?.length || 0,
        status: 'failed',
        errors: valResult.errors,
        executionTimeMs: Date.now() - startTime,
      };

      if (mode === 'import') {
        // Record failed import log
        try {
          await this.importLogRepo.create({
            id: `imp_${crypto.randomUUID()}`,
            source_id: sourceId,
            dataset_name: datasetName,
            file_checksum: valResult.checksum || 'unknown',
            total_records: dataset.foods?.length || 0,
            inserted_count: 0,
            updated_count: 0,
            unchanged_count: 0,
            skipped_count: 0,
            status: 'failed',
            error_summary: valResult.errors.slice(0, 3).join('; '),
            executed_by: executedBy,
            created_at: new Date().toISOString(),
          });
        } catch {
          // ignore logging failure
        }
      }

      return failedResult;
    }

    // 2. Dry-Run / Validate Mode
    if (mode === 'validate' || mode === 'dry-run') {
      let insertedCount = 0;
      let updatedCount = 0;
      let unchangedCount = 0;

      for (const item of dataset.foods) {
        const existing = await this.foodRepo.findBySourceAndExternalId(
          item.source_id,
          item.external_id,
        );
        if (!existing) {
          insertedCount++;
        } else {
          // Compare if data changed
          const fullExisting = await this.foodRepo.findFullDetailById(existing.id);
          if (this.isItemIdentical(item, fullExisting)) {
            unchangedCount++;
          } else {
            updatedCount++;
          }
        }
      }

      return {
        sourceId,
        datasetName,
        mode,
        fileChecksum: valResult.checksum,
        totalRecords: dataset.foods.length,
        insertedCount,
        updatedCount,
        unchangedCount,
        skippedCount: 0,
        failedCount: 0,
        status: mode === 'dry-run' ? 'dry_run' : 'success',
        errors: [],
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 3. Import Mode (Execute ALL operations in a single atomic D1 batch)
    const now = new Date().toISOString();
    const manifest = dataset.manifest;
    const statements: D1PreparedStatement[] = [];

    // Statement 1: Upsert Food Source
    statements.push(
      this.db
        .prepare(
          `INSERT INTO food_sources (id, name, code, description, url, license, acquisition_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             code = excluded.code,
             description = excluded.description,
             url = excluded.url,
             license = excluded.license,
             acquisition_date = excluded.acquisition_date,
             updated_at = excluded.updated_at`,
        )
        .bind(
          manifest.id,
          manifest.name,
          manifest.code,
          manifest.description ?? null,
          manifest.url ?? null,
          manifest.license ?? null,
          manifest.acquisitionDate,
          now,
          now,
        ),
    );

    let insertedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    // Load category slugs mapping
    const allCategories = await this.catRepo.listAll('active');
    const slugToCatId = new Map(allCategories.map((c) => [c.category.slug, c.category.id]));

    for (const item of dataset.foods) {
      let categoryId = item.category_id;
      if (!categoryId && item.category_slug) {
        categoryId = slugToCatId.get(item.category_slug) || null;
      }

      const existing = await this.foodRepo.findBySourceAndExternalId(
        item.source_id,
        item.external_id,
      );

      const foodId = existing ? existing.id : item.id || `food_${crypto.randomUUID()}`;

      if (!existing) {
        insertedCount++;
      } else {
        const fullExisting = await this.foodRepo.findFullDetailById(existing.id);
        if (this.isItemIdentical(item, fullExisting)) {
          unchangedCount++;
        } else {
          updatedCount++;
        }
      }

      // Upsert Food Record
      statements.push(
        this.db
          .prepare(
            `INSERT INTO foods (id, category_id, food_type, brand_name, barcode, status, source_id, external_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               category_id = excluded.category_id,
               food_type = excluded.food_type,
               brand_name = excluded.brand_name,
               barcode = excluded.barcode,
               status = excluded.status,
               source_id = excluded.source_id,
               external_id = excluded.external_id,
               updated_at = excluded.updated_at`,
          )
          .bind(
            foodId,
            categoryId ?? null,
            item.food_type,
            item.brand_name ?? null,
            item.barcode ?? null,
            item.status,
            item.source_id,
            item.external_id,
            existing ? existing.created_at : now,
            now,
          ),
      );

      // Clean existing child relations
      statements.push(
        this.db.prepare('DELETE FROM food_translations WHERE food_id = ?').bind(foodId),
      );
      statements.push(this.db.prepare('DELETE FROM food_aliases WHERE food_id = ?').bind(foodId));
      statements.push(this.db.prepare('DELETE FROM food_nutrients WHERE food_id = ?').bind(foodId));
      statements.push(this.db.prepare('DELETE FROM food_servings WHERE food_id = ?').bind(foodId));

      // Insert Translations
      for (const t of item.translations) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO food_translations (id, food_id, locale, name, description, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              `ft_${crypto.randomUUID()}`,
              foodId,
              t.locale,
              t.name,
              t.description ?? null,
              now,
              now,
            ),
        );
      }

      // Insert Aliases
      for (const a of item.aliases || []) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO food_aliases (id, food_id, locale, alias, created_at)
               VALUES (?, ?, ?, ?, ?)`,
            )
            .bind(`fa_${crypto.randomUUID()}`, foodId, a.locale, a.alias, now),
        );
      }

      // Insert Nutrients with Granular Provenance
      for (const n of item.nutrients || []) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO food_nutrients (id, food_id, nutrient_id, amount_per_100g, source_id, external_id, source_url, citation, dataset_version, method, retrieved_at, license, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              `fn_${crypto.randomUUID()}`,
              foodId,
              n.nutrient_id,
              n.amount_per_100g,
              n.source_id ?? item.source_id,
              n.external_id ?? item.external_id,
              n.source_url ?? manifest.url,
              n.citation ?? manifest.name,
              n.dataset_version ?? manifest.version,
              n.method ?? 'database',
              n.retrieved_at ?? manifest.acquisitionDate,
              n.license ?? manifest.license,
              now,
              now,
            ),
        );
      }

      // Insert Servings with Granular Provenance
      for (const s of item.servings || []) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO food_servings (id, food_id, name_fa, name_en, weight_g, household_unit, source_id, external_id, source_url, citation, dataset_version, method, retrieved_at, license, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              `fs_${crypto.randomUUID()}`,
              foodId,
              s.name_fa,
              s.name_en,
              s.weight_g,
              s.household_unit ?? null,
              s.source_id ?? item.source_id,
              s.external_id ?? null,
              s.source_url ?? manifest.url,
              s.citation ?? manifest.name,
              s.dataset_version ?? manifest.version,
              s.method ?? 'database',
              s.retrieved_at ?? manifest.acquisitionDate,
              s.license ?? manifest.license,
              now,
              now,
            ),
        );
      }
    }

    // Success import log statement included inside atomic batch
    const importLogId = `imp_${crypto.randomUUID()}`;
    statements.push(
      this.db
        .prepare(
          `INSERT INTO food_import_logs (id, source_id, dataset_name, file_checksum, total_records, inserted_count, updated_count, unchanged_count, skipped_count, status, error_summary, executed_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', NULL, ?, ?)`,
        )
        .bind(
          importLogId,
          sourceId,
          datasetName,
          valResult.checksum,
          dataset.foods.length,
          insertedCount,
          updatedCount,
          unchangedCount,
          0,
          executedBy,
          now,
        ),
    );

    // 4. Atomic Execution of entire batch
    try {
      await this.db.batch(statements);

      return {
        sourceId,
        datasetName,
        mode: 'import',
        fileChecksum: valResult.checksum,
        totalRecords: dataset.foods.length,
        insertedCount,
        updatedCount,
        unchangedCount,
        skippedCount: 0,
        failedCount: 0,
        status: 'success',
        errors: [],
        executionTimeMs: Date.now() - startTime,
      };
    } catch (batchErr) {
      const rawMsg = batchErr instanceof Error ? batchErr.message : String(batchErr);
      let safeSummary = 'Database batch transaction failed';
      if (rawMsg.includes('UNIQUE constraint failed')) {
        safeSummary =
          'Database constraint violation: duplicate unique value encountered during ingestion';
      } else if (rawMsg.includes('CHECK constraint failed')) {
        safeSummary = 'Database constraint violation: invalid value failed check constraint';
      } else if (rawMsg.includes('FOREIGN KEY constraint failed')) {
        safeSummary = 'Database constraint violation: referenced foreign key not found';
      }

      // Record failed import log safely outside the failed transaction
      try {
        await this.importLogRepo.create({
          id: `imp_${crypto.randomUUID()}`,
          source_id: sourceId,
          dataset_name: datasetName,
          file_checksum: valResult.checksum || 'unknown',
          total_records: dataset.foods.length,
          inserted_count: 0,
          updated_count: 0,
          unchanged_count: 0,
          skipped_count: 0,
          status: 'failed',
          error_summary: safeSummary,
          executed_by: executedBy,
          created_at: now,
        });
      } catch {
        // ignore logging error
      }

      return {
        sourceId,
        datasetName,
        mode: 'import',
        fileChecksum: valResult.checksum,
        totalRecords: dataset.foods.length,
        insertedCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        skippedCount: 0,
        failedCount: dataset.foods.length,
        status: 'failed',
        errors: [safeSummary],
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Compares dataset item against existing database record to detect changes.
   */
  private isItemIdentical(
    item: FoodDatasetItem,
    existing: {
      food: FoodRecord;
      translations: FoodTranslationRecord[];
      aliases: FoodAliasRecord[];
      nutrients: Array<{ nutrient_id: string; amount_per_100g: number }>;
      servings: FoodServingRecord[];
    } | null,
  ): boolean {
    if (!existing) return false;

    // Check core fields
    if (item.food_type !== existing.food.food_type) return false;
    if ((item.brand_name ?? null) !== existing.food.brand_name) return false;
    if ((item.barcode ?? null) !== existing.food.barcode) return false;
    if (item.status !== existing.food.status) return false;

    // Check translations length and content
    if (item.translations.length !== existing.translations.length) return false;
    for (const t of item.translations) {
      const match = existing.translations.find((et) => et.locale === t.locale);
      if (!match) return false;
      if (match.name !== t.name || (match.description ?? null) !== (t.description ?? null)) {
        return false;
      }
    }

    // Check aliases
    const itemAliases = item.aliases || [];
    if (itemAliases.length !== existing.aliases.length) return false;
    for (const a of itemAliases) {
      const match = existing.aliases.find((ea) => ea.locale === a.locale && ea.alias === a.alias);
      if (!match) return false;
    }

    // Check nutrients
    const itemNutrients = item.nutrients || [];
    if (itemNutrients.length !== existing.nutrients.length) return false;
    for (const n of itemNutrients) {
      const match = existing.nutrients.find((en) => en.nutrient_id === n.nutrient_id);
      if (!match || match.amount_per_100g !== n.amount_per_100g) return false;
    }

    // Check servings
    const itemServings = item.servings || [];
    if (itemServings.length !== existing.servings.length) return false;
    for (const s of itemServings) {
      const match = existing.servings.find((es) => es.name_fa === s.name_fa);
      if (!match || match.name_en !== s.name_en || match.weight_g !== s.weight_g) {
        return false;
      }
    }

    return true;
  }
}
