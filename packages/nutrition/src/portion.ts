import type {
  FoodPortionNutrition,
  FoodPortionServingDetail,
  AggregatedNutrientValue,
  NutrientUnit,
} from '@nutriai/types';
import { NutritionValidationError, InvalidPortionError } from './errors';
import { ENERGY_CONVERSION } from './constants';
import { validateFoodDataInput, validateFiniteNonNegative } from './validation';

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
  source_id?: string | null | undefined;
  external_id?: string | null | undefined;
  source_url?: string | null | undefined;
  citation?: string | null | undefined;
  dataset_version?: string | null | undefined;
  method?: string | null | undefined;
  retrieved_at?: string | null | undefined;
  license?: string | null | undefined;
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
  source_id?: string | null | undefined;
  external_id?: string | null | undefined;
  source_url?: string | null | undefined;
  citation?: string | null | undefined;
  dataset_version?: string | null | undefined;
  method?: string | null | undefined;
  retrieved_at?: string | null | undefined;
  license?: string | null | undefined;
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

interface RawPortionValues {
  portionGrams: number;
  nutrients: AggregatedNutrientValue[];
  energyKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

// Keeps full precision available to aggregateNutrition without exposing internal values in API JSON.
export const rawPortionValues = new WeakMap<FoodPortionNutrition, RawPortionValues>();

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

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
  // 1. Food State and data validation
  try {
    validateFoodDataInput(food);
  } catch (error) {
    if (
      error instanceof NutritionValidationError &&
      (error.field === 'weight_g' || error.message.includes('serving'))
    ) {
      throw new InvalidPortionError(error.message, error.field ?? 'servingId');
    }
    throw error;
  }

  // 2. Portion Validation
  if (!portion || typeof portion !== 'object') {
    throw new InvalidPortionError('Portion specification must be a valid object');
  }

  const hasGrams = portion.grams !== undefined && portion.grams !== null;
  const hasServing = portion.servingId !== undefined && portion.servingId !== null;
  const hasQuantity = portion.quantity !== undefined && portion.quantity !== null;

  if (hasGrams && (hasServing || hasQuantity)) {
    throw new InvalidPortionError(
      'In grams mode, "grams" must be provided alone; "servingId" and "quantity" are forbidden.',
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

    const calculatedGrams = servingWeight * quantity;
    if (!Number.isFinite(calculatedGrams) || calculatedGrams <= 0) {
      throw new InvalidPortionError(
        'Serving grams overflowed the finite numeric range.',
        'quantity',
      );
    }
    portionGrams = calculatedGrams;
    servingDetail = {
      id: matchedServing.id,
      nameFa: matchedServing.name_fa ?? matchedServing.nameFa ?? '',
      nameEn: matchedServing.name_en ?? matchedServing.nameEn ?? '',
      weightG: servingWeight,
      quantity,
    };
  }

  // 3. Macronutrient & Nutrient Verification
  const nutrientsList = food.nutrients;
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
    validateFiniteNonNegative(rawScaled, `${n.nutrient_id}.scaledAmount`);

    computedNutrients.push({
      nutrientId: n.nutrient_id,
      code: n.code,
      nameFa: n.name_fa || '',
      nameEn: n.name_en || '',
      unit: n.unit,
      amount: round(rawScaled, 2),
    });
  });

  const energyNutrient = nutrientMap.get('nut_energy')!;
  const proteinNutrient = nutrientMap.get('nut_protein')!;
  const carbsNutrient = nutrientMap.get('nut_carbohydrate')!;
  const fatNutrient = nutrientMap.get('nut_fat_total')!;

  const rawEnergyKcal = energyNutrient.amount_per_100g * factor;
  const rawProteinGrams = proteinNutrient.amount_per_100g * factor;
  const rawCarbsGrams = carbsNutrient.amount_per_100g * factor;
  const rawFatGrams = fatNutrient.amount_per_100g * factor;
  validateFiniteNonNegative(rawEnergyKcal, 'energyKcal');
  validateFiniteNonNegative(rawProteinGrams, 'proteinGrams');
  validateFiniteNonNegative(rawCarbsGrams, 'carbsGrams');
  validateFiniteNonNegative(rawFatGrams, 'fatGrams');

  const energyKcal = round(rawEnergyKcal, 1);
  const proteinGrams = round(rawProteinGrams, 1);
  const carbsGrams = round(rawCarbsGrams, 1);
  const fatGrams = round(rawFatGrams, 1);

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

  const result: FoodPortionNutrition = {
    foodId: food.id,
    foodNameFa: food.name_fa ?? food.nameFa ?? '',
    foodNameEn: food.name_en ?? food.nameEn ?? '',
    portionGrams: round(portionGrams, 1),
    serving: servingDetail,
    nutrients: computedNutrients,
    energyKcal,
    proteinGrams,
    carbsGrams,
    fatGrams,
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  rawPortionValues.set(result, {
    portionGrams,
    nutrients: nutrientsList.map((n) => ({
      nutrientId: n.nutrient_id,
      code: n.code,
      nameFa: n.name_fa ?? '',
      nameEn: n.name_en ?? '',
      unit: n.unit,
      amount: n.amount_per_100g * factor,
    })),
    energyKcal: rawEnergyKcal,
    proteinGrams: rawProteinGrams,
    carbsGrams: rawCarbsGrams,
    fatGrams: rawFatGrams,
  });
  return result;
}
