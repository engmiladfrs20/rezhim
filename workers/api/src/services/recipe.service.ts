import type { D1Database } from '@cloudflare/workers-types';
import type { RecipeCalculateInputDto } from '@nutriai/schemas';
import type { RecipeNutritionResult } from '@nutriai/types';
import { calculateRecipeNutrition } from '@nutriai/nutrition';
import { NutritionService } from './nutrition.service';

/** Stateless recipe calculation backed by the verified active food catalog. */
export class RecipeService {
  private readonly nutritionService: NutritionService;

  public constructor(db: D1Database) {
    this.nutritionService = new NutritionService(db);
  }

  public async calculate(input: RecipeCalculateInputDto): Promise<RecipeNutritionResult> {
    const aggregate = await this.nutritionService.aggregateNutrition(
      input.ingredients.map((ingredient) => ({
        foodId: ingredient.food_id,
        grams: ingredient.grams,
      })),
    );
    return calculateRecipeNutrition(aggregate, {
      yieldGrams: input.yield_grams,
      servings: input.servings,
    });
  }
}
