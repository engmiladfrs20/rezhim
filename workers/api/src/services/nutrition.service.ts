import type { D1Database } from '@cloudflare/workers-types';
import type {
  CalculatedNutritionTargets,
  AggregatedNutritionResult,
  FoodPortionNutrition,
} from '@nutriai/types';
import type { NutritionTargetsInputDto, NutritionAggregateItemDto } from '@nutriai/schemas';
import {
  calculateNutritionTargets,
  calculateFoodPortionNutrition,
  aggregateNutrition as pureAggregateNutrition,
  NutritionValidationError,
  NutritionProvenanceError,
} from '@nutriai/nutrition';
import { FoodRepository } from '../db/food.repository';

const PROVENANCE_METHODS = new Set(['laboratory', 'database', 'calculated', 'measured']);
const PROVENANCE_FIELDS = [
  'source_id',
  'external_id',
  'source_url',
  'citation',
  'dataset_version',
  'method',
  'retrieved_at',
  'license',
] as const;

type ProvenanceRecord = Partial<
  Record<(typeof PROVENANCE_FIELDS)[number], string | null | undefined>
>;

function assertCompleteProvenance(record: ProvenanceRecord, label: string): void {
  for (const field of PROVENANCE_FIELDS) {
    const value = record[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new NutritionProvenanceError(
        `Nutrition data for ${label} is not publishable because provenance is incomplete.`,
        field,
      );
    }
  }
  if (!PROVENANCE_METHODS.has(record.method!)) {
    throw new NutritionProvenanceError(
      `Nutrition data for ${label} has an unsupported provenance method.`,
      'method',
    );
  }
  if (!/^https?:\/\/[^\s]+$/i.test(record.source_url!)) {
    throw new NutritionProvenanceError(
      `Nutrition data for ${label} has an invalid provenance URL.`,
      'source_url',
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(record.retrieved_at!)) {
    throw new NutritionProvenanceError(
      `Nutrition data for ${label} has an invalid UTC retrieval timestamp.`,
      'retrieved_at',
    );
  }
}

function isPubliclyUsableLicense(license: string | null): boolean {
  if (!license || license.trim() === '') return false;
  return !/(restricted|proprietary|no\s+redistribution|redistribution\s*[:=]\s*false)/i.test(
    license,
  );
}

export class NutritionService {
  private readonly foodRepo: FoodRepository;

  constructor(db: D1Database) {
    this.foodRepo = new FoodRepository(db);
  }

  /**
   * Pure calculation of user daily calorie, macronutrient, and micronutrient targets.
   * Completely stateless, deterministic, zero database writes.
   */
  calculateTargets(input: NutritionTargetsInputDto): CalculatedNutritionTargets {
    return calculateNutritionTargets({
      gender: input.gender,
      age: input.age,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      bodyFatPercentage: input.bodyFatPercentage ?? undefined,
      lifeStage: input.lifeStage,
      activityLevel: input.activityLevel,
      dietGoal: input.dietGoal,
      formula: input.formula,
    });
  }

  /**
   * Aggregates nutrition across multiple active food portions.
   * Fetches accurate 100g nutrient and serving definitions from D1.
   * Completely stateless, zero database writes.
   */
  async aggregateNutrition(items: NutritionAggregateItemDto[]): Promise<AggregatedNutritionResult> {
    if (!items || items.length === 0) {
      return pureAggregateNutrition([]);
    }

    // Process each item and fetch full detail from D1
    const portionCalculations: FoodPortionNutrition[] = [];

    for (const item of items) {
      const foodDetail = await this.foodRepo.findFullDetailById(item.foodId);

      if (!foodDetail) {
        throw new NutritionValidationError(
          `Food with ID "${item.foodId}" was not found.`,
          'foodId',
        );
      }

      if (foodDetail.food.status !== 'active') {
        throw new NutritionValidationError(
          `Food "${item.foodId}" has status "${foodDetail.food.status}". Only active foods can be used in nutrition aggregation.`,
          'status',
        );
      }

      const selectedServing = item.servingId
        ? foodDetail.servings.find((serving) => serving.id === item.servingId)
        : undefined;
      const provenanceRecords: Array<{ label: string; record: ProvenanceRecord }> =
        foodDetail.nutrients.map((nutrient) => ({
          label: `food ${item.foodId} nutrient ${nutrient.nutrient_id}`,
          record: nutrient,
        }));
      if (selectedServing) {
        provenanceRecords.push({
          label: `food ${item.foodId} serving ${selectedServing.id}`,
          record: selectedServing,
        });
      }
      provenanceRecords.forEach(({ label, record }) => assertCompleteProvenance(record, label));

      const sourceIds = provenanceRecords.map(({ record }) => record.source_id!);
      const sources = await this.foodRepo.findSourcesByIds(sourceIds);
      const sourceById = new Map(sources.map((source) => [source.id, source]));
      for (const sourceId of sourceIds) {
        const source = sourceById.get(sourceId);
        if (!source || !isPubliclyUsableLicense(source.license)) {
          throw new NutritionProvenanceError(
            `Nutrition data for food ${item.foodId} references a source that is missing or not eligible for public use.`,
            'source_id',
          );
        }
      }

      // Map translations to localized names
      const faTrans = foodDetail.translations.find((t) => t.locale === 'fa');
      const enTrans = foodDetail.translations.find((t) => t.locale === 'en');

      const foodData = {
        id: foodDetail.food.id,
        status: foodDetail.food.status,
        nameFa: faTrans?.name || '',
        nameEn: enTrans?.name || '',
        nutrients: foodDetail.nutrients.map((n) => ({
          nutrient_id: n.nutrient_id,
          code: n.code,
          name_fa: n.name_fa,
          name_en: n.name_en,
          unit: n.unit,
          amount_per_100g: n.amount_per_100g,
          source_id: n.source_id,
          external_id: n.external_id,
          source_url: n.source_url,
          citation: n.citation,
          dataset_version: n.dataset_version,
          method: n.method,
          retrieved_at: n.retrieved_at,
          license: n.license,
        })),
        servings: foodDetail.servings.map((s) => ({
          id: s.id,
          nameFa: s.name_fa,
          nameEn: s.name_en,
          weightG: s.weight_g,
          household_unit: s.household_unit,
          source_id: s.source_id,
          external_id: s.external_id,
          source_url: s.source_url,
          citation: s.citation,
          dataset_version: s.dataset_version,
          method: s.method,
          retrieved_at: s.retrieved_at,
          license: s.license,
        })),
      };

      const portionResult = calculateFoodPortionNutrition(foodData, {
        grams: item.grams ?? undefined,
        servingId: item.servingId ?? undefined,
        quantity: item.quantity ?? undefined,
      });

      portionCalculations.push(portionResult);
    }

    return pureAggregateNutrition(portionCalculations);
  }
}
