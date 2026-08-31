import type { D1Database } from '@cloudflare/workers-types';
import type { GeneratedMealPlan } from '@nutriai/types';
import type { MealPlanGenerateInputDto } from '@nutriai/schemas';
import { generateDeterministicMealPlan } from '@nutriai/nutrition';
import { NutritionService } from './nutrition.service';

/**
 * Loads only caller-selected active foods from D1, validates their provenance through
 * NutritionService, and delegates schedule construction to the pure Phase 9 engine.
 */
export class MealPlanService {
  constructor(private readonly nutritionService: NutritionService) {}

  static fromDatabase(db: D1Database): MealPlanService {
    return new MealPlanService(new NutritionService(db));
  }

  async generate(input: MealPlanGenerateInputDto): Promise<GeneratedMealPlan> {
    const targets = this.nutritionService.calculateTargets(input.targets);
    const baseNutrition = await this.nutritionService.aggregateNutrition(
      input.food_ids.map((foodId) => ({ foodId, grams: 100 })),
    );

    return generateDeterministicMealPlan({
      targets,
      candidates: baseNutrition.items,
      days: input.days,
      locale: input.locale,
    });
  }
}
