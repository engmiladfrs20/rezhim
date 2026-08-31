import type {
  AggregatedNutritionResult,
  RecipeNutritionBreakdown,
  RecipeNutritionResult,
} from '@nutriai/types';
import { NutritionValidationError } from './errors';
import { validateFiniteNonNegative } from './validation';

const RECIPE_ALGORITHM_VERSION = 'recipe-nutrition-v1';

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function scaleBreakdown(
  aggregate: AggregatedNutritionResult,
  factor: number,
  portionGrams: number,
): RecipeNutritionBreakdown {
  const nutrients = aggregate.nutrients.map((nutrient) => ({
    ...nutrient,
    amount: round(nutrient.amount * factor, 2),
  }));
  const result: RecipeNutritionBreakdown = {
    portionGrams: round(portionGrams, 1),
    energyKcal: round(aggregate.totalEnergyKcal * factor, 1),
    proteinGrams: round(aggregate.totalProteinGrams * factor, 1),
    carbsGrams: round(aggregate.totalCarbsGrams * factor, 1),
    fatGrams: round(aggregate.totalFatGrams * factor, 1),
    nutrients,
  };
  if (aggregate.missingNutrients !== undefined) {
    result.missingNutrients = [...aggregate.missingNutrients];
  }
  if (aggregate.warnings !== undefined) {
    result.warnings = [...aggregate.warnings];
  }
  return result;
}

/**
 * Calculates deterministic recipe totals from already-calculated ingredients.
 * Yield can differ from raw ingredient weight to model cooking loss or water
 * absorption; no nutrient values are inferred or invented.
 */
export function calculateRecipeNutrition(
  aggregate: AggregatedNutritionResult,
  input: { yieldGrams: number; servings: number },
): RecipeNutritionResult {
  validateFiniteNonNegative(input.yieldGrams, 'yieldGrams');
  validateFiniteNonNegative(input.servings, 'servings');
  if (input.yieldGrams <= 0) {
    throw new NutritionValidationError('Recipe yield must be greater than zero.', 'yieldGrams');
  }
  if (!Number.isInteger(input.servings) || input.servings <= 0) {
    throw new NutritionValidationError('Recipe servings must be a positive integer.', 'servings');
  }
  if (!aggregate || !Array.isArray(aggregate.items)) {
    throw new NutritionValidationError('Recipe aggregate must contain ingredient items.', 'items');
  }

  const total = scaleBreakdown(aggregate, 1, aggregate.totalPortionGrams);
  const per100g = scaleBreakdown(aggregate, 100 / input.yieldGrams, 100);
  const perServing = scaleBreakdown(
    aggregate,
    1 / input.servings,
    input.yieldGrams / input.servings,
  );

  return {
    algorithmVersion: RECIPE_ALGORITHM_VERSION,
    yieldGrams: round(input.yieldGrams, 1),
    servings: input.servings,
    ingredients: aggregate.items,
    total,
    per100g,
    perServing,
  };
}
