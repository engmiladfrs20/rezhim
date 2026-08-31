import type { D1Database } from '@cloudflare/workers-types';
import type { FoodSubstitutionResult } from '@nutriai/types';
import type { FoodSubstitutionInputDto } from '@nutriai/schemas';
import { findFoodSubstitutions } from '@nutriai/nutrition';
import { NutritionService } from './nutrition.service';

export class SubstitutionService {
  constructor(private readonly nutritionService: NutritionService) {}

  static fromDatabase(db: D1Database): SubstitutionService {
    return new SubstitutionService(new NutritionService(db));
  }

  async find(input: FoodSubstitutionInputDto): Promise<FoodSubstitutionResult> {
    const reference = (
      await this.nutritionService.aggregateNutrition([
        {
          foodId: input.food_id,
          grams: input.grams ?? undefined,
          servingId: input.serving_id ?? undefined,
          quantity: input.serving_id ? input.quantity : undefined,
        },
      ])
    ).items[0];
    if (!reference) {
      throw new Error('Reference food nutrition could not be calculated.');
    }

    const candidates = (
      await this.nutritionService.aggregateNutrition(
        input.candidate_food_ids.map((foodId) => ({ foodId, grams: 100 })),
      )
    ).items;
    return findFoodSubstitutions({ reference, candidates, limit: input.limit });
  }
}
