import type {
  AggregatedNutritionResult,
  CalculatedNutritionTargets,
  DiaryMealType,
  FoodPortionNutrition,
  GeneratedMealPlan,
  MealPlanDay,
  MealPlanGenerationInput,
  MealPlanMeal,
} from '@nutriai/types';
import { NutritionValidationError } from './errors';
import { aggregateNutrition } from './aggregate';

const MEAL_SLOTS: ReadonlyArray<{ type: DiaryMealType; calorieShare: number }> = [
  { type: 'breakfast', calorieShare: 0.25 },
  { type: 'lunch', calorieShare: 0.35 },
  { type: 'dinner', calorieShare: 0.3 },
  { type: 'snack', calorieShare: 0.1 },
];

const MIN_PORTION_GRAMS = 25;
const MAX_PORTION_GRAMS = 800;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function scaleFoodPortionNutrition(
  base: FoodPortionNutrition,
  grams: number,
): FoodPortionNutrition {
  const factor = grams / base.portionGrams;
  return {
    ...base,
    portionGrams: round(grams, 1),
    serving: null,
    nutrients: base.nutrients.map((nutrient) => ({
      ...nutrient,
      amount: round(nutrient.amount * factor, 2),
    })),
    energyKcal: round(base.energyKcal * factor, 1),
    proteinGrams: round(base.proteinGrams * factor, 1),
    carbsGrams: round(base.carbsGrams * factor, 1),
    fatGrams: round(base.fatGrams * factor, 1),
  };
}

function validateInput(input: MealPlanGenerationInput): void {
  if (!input || typeof input !== 'object') {
    throw new NutritionValidationError('Meal plan input must be an object.');
  }
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 14) {
    throw new NutritionValidationError(
      'Meal plan days must be an integer between 1 and 14.',
      'days',
    );
  }
  if (
    !input.targets ||
    !Number.isFinite(input.targets.targetCalories) ||
    input.targets.targetCalories <= 0
  ) {
    throw new NutritionValidationError(
      'Meal plan targets must contain positive target calories.',
      'targets',
    );
  }
  if (!Array.isArray(input.candidates) || input.candidates.length < 4) {
    throw new NutritionValidationError(
      'At least four active food candidates are required.',
      'candidates',
    );
  }
  const ids = new Set<string>();
  for (const candidate of input.candidates) {
    if (!candidate || typeof candidate.foodId !== 'string' || candidate.foodId.trim() === '') {
      throw new NutritionValidationError(
        'Each meal plan candidate must have a valid food ID.',
        'candidates',
      );
    }
    if (ids.has(candidate.foodId)) {
      throw new NutritionValidationError(
        `Duplicate meal plan candidate: ${candidate.foodId}`,
        'candidates',
      );
    }
    ids.add(candidate.foodId);
    if (
      !Number.isFinite(candidate.portionGrams) ||
      candidate.portionGrams <= 0 ||
      !Number.isFinite(candidate.energyKcal) ||
      candidate.energyKcal <= 0
    ) {
      throw new NutritionValidationError(
        `Candidate ${candidate.foodId} must have positive finite energy data.`,
        'candidates',
      );
    }
  }
}

function buildMeal(
  candidate: FoodPortionNutrition,
  type: DiaryMealType,
  targetCalories: number,
): MealPlanMeal {
  const gramsPerKcal = candidate.portionGrams / candidate.energyKcal;
  const rawGrams = targetCalories * gramsPerKcal;
  const portionGrams = Math.min(MAX_PORTION_GRAMS, Math.max(MIN_PORTION_GRAMS, rawGrams));
  const item = scaleFoodPortionNutrition(candidate, portionGrams);
  const nutrition: AggregatedNutritionResult = aggregateNutrition([item]);
  return { mealType: type, targetCalories, nutrition };
}

function buildDay(
  day: number,
  targets: CalculatedNutritionTargets,
  candidates: FoodPortionNutrition[],
): MealPlanDay {
  const meals = MEAL_SLOTS.map((slot, slotIndex) => {
    const candidate = candidates[((day - 1) * MEAL_SLOTS.length + slotIndex) % candidates.length]!;
    return buildMeal(candidate, slot.type, Math.round(targets.targetCalories * slot.calorieShare));
  });
  const allItems = meals.flatMap((meal) => meal.nutrition.items);
  return { day, meals, nutrition: aggregateNutrition(allItems) };
}

/**
 * Builds a deterministic, explainable meal schedule from verified active foods.
 * It never writes to storage and is intentionally not medical advice.
 */
export function generateDeterministicMealPlan(input: MealPlanGenerationInput): GeneratedMealPlan {
  validateInput(input);
  const candidates = [...input.candidates].sort((a, b) => a.foodId.localeCompare(b.foodId));
  const days = Array.from({ length: input.days }, (_, index) =>
    buildDay(index + 1, input.targets, candidates),
  );
  return {
    algorithmVersion: 'phase9-v1',
    requestedLocale: input.locale ?? 'fa',
    days,
    targetCaloriesPerDay: input.targets.targetCalories,
    candidateFoodIds: candidates.map((candidate) => candidate.foodId),
  };
}
