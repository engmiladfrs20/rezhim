import type { D1Database } from '@cloudflare/workers-types';
import { FoodRepository } from '../db/food.repository';
import { FoodCategoryRepository } from '../db/food-category.repository';
import { NutrientRepository } from '../db/nutrient.repository';
import { FoodSourceRepository } from '../db/food-source.repository';
import { FoodImportLogRepository } from '../db/food-import-log.repository';
import { foodSourceManifestSchema, foodDatasetItemSchema } from '@nutriai/schemas';
import { normalizePersianForComparison } from '@nutriai/localization';
import type { FoodDatasetFile, FoodDatasetItem, ImportMode, ImportResult } from '@nutriai/types';
import type {
  FoodRecord,
  FoodTranslationRecord,
  FoodAliasRecord,
  FoodNutrientRecord,
  FoodServingRecord,
  FoodSourceRecord,
  FoodImportLogRecord,
} from '../db/models';
import { validateFoodInvariants } from './food.service';

export class FoodImporterService {
  private readonly foodRepo: FoodRepository;
  private readonly catRepo: FoodCategoryRepository;
  private readonly nutrientRepo: NutrientRepository;
  private readonly sourceRepo: FoodSourceRepository;
  private readonly importLogRepo: FoodImportLogRepository;

  constructor(db: D1Database) {
    this.foodRepo = new FoodRepository(db);
    this.catRepo = new FoodCategoryRepository(db);
    this.nutrientRepo = new NutrientRepository(db);
    this.sourceRepo = new FoodSourceRepository(db);
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
   * Validates dataset manifest, schema integrity, referenced entities, and license restrictions.
   */
  async validateDataset(
    dataset: FoodDatasetFile,
    rawContent?: string,
  ): Promise<{ valid: boolean; errors: string[]; checksum: string }> {
    const errors: string[] = [];

    // 1. Validate Manifest Schema
    const manifestParsed = foodSourceManifestSchema.safeParse(dataset.manifest);
    if (!manifestParsed.success) {
      errors.push(
        `Manifest validation failed: ${manifestParsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      );
    }

    // 2. Validate Checksum if raw content is provided
    let computedChecksum = dataset.manifest?.sha256Checksum || '';
    if (rawContent) {
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

    // 3. License redistribution check
    if (dataset.manifest && dataset.manifest.redistributionAllowed === false) {
      errors.push(
        `Dataset license "${dataset.manifest.license}" disallows redistribution. Ingestion is restricted to licensed local environments.`,
      );
    }

    // 4. Validate Dataset Items Array
    if (!Array.isArray(dataset.foods) || dataset.foods.length === 0) {
      errors.push('Dataset must contain at least one food item array in "foods" property.');
      return { valid: false, errors, checksum: computedChecksum };
    }

    // 5. Pre-load valid Categories and Nutrients for fast lookup
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

      // Validate Item Schema
      const itemParsed = foodDatasetItemSchema.safeParse(item);
      if (!itemParsed.success) {
        errors.push(
          `${itemContext} schema validation error: ${itemParsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        );
        continue;
      }

      // Check external_id uniqueness in this batch
      if (seenExternalIds.has(item.external_id)) {
        errors.push(`${itemContext} duplicate external_id in dataset: "${item.external_id}"`);
      }
      seenExternalIds.add(item.external_id);

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

      // Check Nutrients existence
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
   * Executes the import pipeline in validate, dry-run, or import mode with full atomicity and logging.
   */
  async runPipeline(
    dataset: FoodDatasetFile,
    rawContent?: string,
    mode: ImportMode = 'import',
    executedBy = 'system',
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const datasetName = dataset.manifest?.name || 'unknown_dataset';
    const sourceId = dataset.manifest?.id || 'unknown_source';

    // 1. Validation Phase
    const valResult = await this.validateDataset(dataset, rawContent);
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
      }

      return failedResult;
    }

    // 2. Validate / Dry-Run Mode
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

    // 3. Import Mode (Execute upsert atomically)
    const now = new Date().toISOString();

    // Ensure Food Source exists in database
    const manifest = dataset.manifest;
    const sourceRecord: FoodSourceRecord = {
      id: manifest.id,
      name: manifest.name,
      code: manifest.code,
      description: manifest.description ?? null,
      url: manifest.url ?? null,
      license: manifest.license ?? null,
      acquisition_date: manifest.acquisitionDate,
      created_at: now,
      updated_at: now,
    };
    await this.sourceRepo.upsert(sourceRecord);

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

      if (!existing) {
        // Create new item atomically
        const foodId = item.id || `food_${crypto.randomUUID()}`;
        const foodRecord: FoodRecord = {
          id: foodId,
          category_id: categoryId ?? null,
          food_type: item.food_type,
          brand_name: item.brand_name ?? null,
          barcode: item.barcode ?? null,
          status: item.status,
          source_id: item.source_id,
          external_id: item.external_id,
          created_at: now,
          updated_at: now,
        };

        const translationRecords: FoodTranslationRecord[] = item.translations.map((t) => ({
          id: `ft_${crypto.randomUUID()}`,
          food_id: foodId,
          locale: t.locale,
          name: t.name,
          description: t.description ?? null,
          created_at: now,
          updated_at: now,
        }));

        const aliasRecords: FoodAliasRecord[] = (item.aliases || []).map((a) => ({
          id: `fa_${crypto.randomUUID()}`,
          food_id: foodId,
          locale: a.locale,
          alias: a.alias,
          created_at: now,
        }));

        const nutrientRecords: FoodNutrientRecord[] = (item.nutrients || []).map((n) => ({
          id: `fn_${crypto.randomUUID()}`,
          food_id: foodId,
          nutrient_id: n.nutrient_id,
          amount_per_100g: n.amount_per_100g,
          created_at: now,
          updated_at: now,
        }));

        const servingRecords: FoodServingRecord[] = (item.servings || []).map((s) => ({
          id: `fs_${crypto.randomUUID()}`,
          food_id: foodId,
          name_fa: s.name_fa,
          name_en: s.name_en,
          weight_g: s.weight_g,
          household_unit: s.household_unit ?? null,
          created_at: now,
          updated_at: now,
        }));

        await this.foodRepo.createAtomic(
          foodRecord,
          translationRecords,
          aliasRecords,
          nutrientRecords,
          servingRecords,
        );
        insertedCount++;
      } else {
        // Existing food: check if modified
        const fullExisting = await this.foodRepo.findFullDetailById(existing.id);
        if (this.isItemIdentical(item, fullExisting)) {
          unchangedCount++;
        } else {
          // Perform atomic update
          const updatedRecord: FoodRecord = {
            id: existing.id,
            category_id: categoryId ?? null,
            food_type: item.food_type,
            brand_name: item.brand_name ?? null,
            barcode: item.barcode ?? null,
            status: item.status,
            source_id: item.source_id,
            external_id: item.external_id,
            created_at: existing.created_at,
            updated_at: now,
          };

          const translationRecords: FoodTranslationRecord[] = item.translations.map((t) => ({
            id: `ft_${crypto.randomUUID()}`,
            food_id: existing.id,
            locale: t.locale,
            name: t.name,
            description: t.description ?? null,
            created_at: now,
            updated_at: now,
          }));

          const aliasRecords: FoodAliasRecord[] = (item.aliases || []).map((a) => ({
            id: `fa_${crypto.randomUUID()}`,
            food_id: existing.id,
            locale: a.locale,
            alias: a.alias,
            created_at: now,
          }));

          const nutrientRecords: FoodNutrientRecord[] = (item.nutrients || []).map((n) => ({
            id: `fn_${crypto.randomUUID()}`,
            food_id: existing.id,
            nutrient_id: n.nutrient_id,
            amount_per_100g: n.amount_per_100g,
            created_at: now,
            updated_at: now,
          }));

          const servingRecords: FoodServingRecord[] = (item.servings || []).map((s) => ({
            id: `fs_${crypto.randomUUID()}`,
            food_id: existing.id,
            name_fa: s.name_fa,
            name_en: s.name_en,
            weight_g: s.weight_g,
            household_unit: s.household_unit ?? null,
            created_at: now,
            updated_at: now,
          }));

          await this.foodRepo.updateAtomic(
            updatedRecord,
            translationRecords,
            aliasRecords,
            nutrientRecords,
            servingRecords,
          );
          updatedCount++;
        }
      }
    }

    // 4. Log Successful Import
    const importLog: FoodImportLogRecord = {
      id: `imp_${crypto.randomUUID()}`,
      source_id: sourceId,
      dataset_name: datasetName,
      file_checksum: valResult.checksum,
      total_records: dataset.foods.length,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      unchanged_count: unchangedCount,
      skipped_count: 0,
      status: 'success',
      error_summary: null,
      executed_by: executedBy,
      created_at: now,
    };
    await this.importLogRepo.create(importLog);

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
