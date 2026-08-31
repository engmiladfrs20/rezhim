import type {
  FoodPortionNutrition,
  FoodPortionServingDetail,
  AggregatedNutrientValue,
  NutrientUnit,
} from '@nutriai/types';
import { NutritionValidationError, InvalidPortionError } from './errors';
import { ENERGY_CONVERSION } from './constants';

export interface FoodPortionCalculationInput {
  grams?: number | undefined;
  servingId?: string | undefined;
  quantity?: number | undefined;
}

export interface FoodNutrientData {
  nutrient_id: string;
  code: string;
  name_fa?: string | undefined;
  name_en?: string | undefined;
  unit: NutrientUnit;
  amount_per_100g: number;
}

export interface FoodServingData {
  id: string;
  name_fa?: string | undefined;
  name_en?: string | undefined;
  nameFa?: string | undefined;
  nameEn?: string | undefined;
  weight_g?: number | undefined;
  weightG?: number | undefined;
  household_unit?: string | null | undefined;
}

export interface FoodDataInput {
  id: string;
  status: string;
  name_fa?: string | undefined;
  name_en?: string | undefined;
  nameFa?: string | undefined;
  nameEn?: string | undefined;
  nutrients: FoodNutrientData[];
  servings?: FoodServingData[] | undefined;
}

const REQUIRED_CORE_MACROS = ['nut_energy', 'nut_protein', 'nut_carbohydrate', 'nut_fat_total'];

/**
 * Calculates portion nutrition for a single active food item.
 *
 * @param food Food metadata including 100g nutrients and servings
 * @param portion Portion specification (either grams or servingId + optional quantity)
 * @returns Comprehensive portion nutrition breakdown
 */
export function calculateFoodPortionNutrition(
  food: FoodDataInput,
  portion: FoodPortionCalculationInput,
): FoodPortionNutrition {
  // 1. Food State Validation
  if (!food || typeof food !== 'object') {
    throw new NutritionValidationError('Food data must be a valid object');
  }

  if (food.status !== 'active') {
    throw new NutritionValidationError(
      `Cannot calculate nutrition for food "${food.id}" with status "${food.status}". Only active foods are allowed.`,
      'status',
    );
  }

  // 2. Portion Validation
  if (!portion || typeof portion !== 'object') {
    throw new InvalidPortionError('Portion specification must be a valid object');
  }

  const hasGrams = portion.grams !== undefined && portion.grams !== null;
  const hasServing = portion.servingId !== undefined && portion.servingId !== null;

  if (hasGrams && hasServing) {
    throw new InvalidPortionError(
      'Ambiguous portion: specify either "grams" or "servingId", not both.',
    );
  }

  if (!hasGrams && !hasServing) {
    throw new InvalidPortionError(
      'Incomplete portion: either "grams" or "servingId" must be provided.',
    );
  }

  let portionGrams: number;
  let servingDetail: FoodPortionServingDetail | null = null;

  if (hasGrams) {
    const g = portion.grams as number;
    if (typeof g !== 'number' || !Number.isFinite(g) || g <= 0) {
      throw new InvalidPortionError(
        `Portion grams must be a strictly positive finite number. Received: ${String(g)}`,
        'grams',
      );
    }
    portionGrams = g;
  } else {
    const sId = portion.servingId as string;
    const availableServings = food.servings || [];
    const matchedServing = availableServings.find((s) => s.id === sId);

    if (!matchedServing) {
      throw new InvalidPortionError(
        `Serving with ID "${sId}" does not exist on food "${food.id}".`,
        'servingId',
      );
    }

    const servingWeight = matchedServing.weight_g ?? matchedServing.weightG;
    if (
      typeof servingWeight !== 'number' ||
      !Number.isFinite(servingWeight) ||
      servingWeight <= 0
    ) {
      throw new InvalidPortionError(
        `Serving "${sId}" has an invalid weight: ${String(servingWeight)}`,
        'servingId',
      );
    }

    const quantity = portion.quantity ?? 1;
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
      throw new InvalidPortionError(
        `Serving quantity must be a strictly positive finite number. Received: ${String(quantity)}`,
        'quantity',
      );
    }

    portionGrams = servingWeight * quantity;
    servingDetail = {
      id: matchedServing.id,
      nameFa: matchedServing.name_fa ?? matchedServing.nameFa ?? '',
      nameEn: matchedServing.name_en ?? matchedServing.nameEn ?? '',
      weightG: servingWeight,
      quantity,
    };
  }

  // 3. Macronutrient & Nutrient Verification
  const nutrientsList = food.nutrients || [];
  const nutrientMap = new Map<string, FoodNutrientData>();
  nutrientsList.forEach((n) => nutrientMap.set(n.nutrient_id, n));

  for (const reqMacro of REQUIRED_CORE_MACROS) {
    if (!nutrientMap.has(reqMacro)) {
      throw new NutritionValidationError(
        `Active food "${food.id}" is missing required core nutrient "${reqMacro}".`,
        reqMacro,
      );
    }
  }

  // 4. Calculate Scaled Nutrients
  const factor = portionGrams / 100;
  const computedNutrients: AggregatedNutrientValue[] = [];

  nutrientsList.forEach((n) => {
    const rawScaled = n.amount_per_100g * factor;
    const roundedAmount = Math.round(rawScaled * 100) / 100;

    computedNutrients.push({
      nutrientId: n.nutrient_id,
      code: n.code,
      nameFa: n.name_fa || '',
      nameEn: n.name_en || '',
      unit: n.unit,
      amount: roundedAmount,
    });
  });

  const energyNutrient = nutrientMap.get('nut_energy')!;
  const proteinNutrient = nutrientMap.get('nut_protein')!;
  const carbsNutrient = nutrientMap.get('nut_carbohydrate')!;
  const fatNutrient = nutrientMap.get('nut_fat_total')!;

  const energyKcal = Math.round(energyNutrient.amount_per_100g * factor * 10) / 10;
  const proteinGrams = Math.round(proteinNutrient.amount_per_100g * factor * 10) / 10;
  const carbsGrams = Math.round(carbsNutrient.amount_per_100g * factor * 10) / 10;
  const fatGrams = Math.round(fatNutrient.amount_per_100g * factor * 10) / 10;

  // 5. Calorie Consistency Verification (4/4/9 Atwater Check)
  const expectedKcal =
    proteinGrams * ENERGY_CONVERSION.PROTEIN_KCAL_PER_G +
    carbsGrams * ENERGY_CONVERSION.CARBS_KCAL_PER_G +
    fatGrams * ENERGY_CONVERSION.FAT_KCAL_PER_G;

  const warnings: string[] = [];
  const calorieDiff = Math.abs(energyKcal - expectedKcal);

  // If difference is significant (>20 kcal and >15%), flag a non-blocking warning
  if (calorieDiff > 20 && calorieDiff / Math.max(1, energyKcal) > 0.15) {
    warnings.push(
      `Calorie consistency warning: Reported energy is ${energyKcal} kcal, but macronutrient sum (4/4/9) is ${expectedKcal.toFixed(1)} kcal.`,
    );
  }

  return {
    foodId: food.id,
    foodNameFa: food.name_fa ?? food.nameFa ?? '',
    foodNameEn: food.name_en ?? food.nameEn ?? '',
    portionGrams: Math.round(portionGrams * 10) / 10,
    serving: servingDetail,
    nutrients: computedNutrients,
    energyKcal,
    proteinGrams,
    carbsGrams,
    fatGrams,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
