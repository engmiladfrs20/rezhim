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
} from '@nutriai/nutrition';
import { FoodRepository } from '../db/food.repository';

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
        })),
        servings: foodDetail.servings.map((s) => ({
          id: s.id,
          nameFa: s.name_fa,
          nameEn: s.name_en,
          weightG: s.weight_g,
          household_unit: s.household_unit,
        })),
      };

      const portionResult = calculateFoodPortionNutrition(foodData, {
        grams: item.grams ?? undefined,
        servingId: item.servingId ?? undefined,
        quantity: item.quantity ?? 1,
      });

      portionCalculations.push(portionResult);
    }

    return pureAggregateNutrition(portionCalculations);
  }
}
