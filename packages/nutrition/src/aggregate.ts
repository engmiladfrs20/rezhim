import type {
  FoodPortionNutrition,
  AggregatedNutritionResult,
  AggregatedNutrientValue,
  NutrientUnit,
} from '@nutriai/types';
import { NutritionValidationError } from './errors';

const TRACKED_OPTIONAL_NUTRIENTS = [
  { id: 'nut_fiber', nameFa: 'فیبر رژیمی', nameEn: 'Dietary Fiber', unit: 'g' as NutrientUnit },
  { id: 'nut_sugar', nameFa: 'قند', nameEn: 'Sugars', unit: 'g' as NutrientUnit },
  { id: 'nut_sodium', nameFa: 'سدیم', nameEn: 'Sodium', unit: 'mg' as NutrientUnit },
  { id: 'nut_potassium', nameFa: 'پتاسیم', nameEn: 'Potassium', unit: 'mg' as NutrientUnit },
  { id: 'nut_calcium', nameFa: 'کلسیم', nameEn: 'Calcium', unit: 'mg' as NutrientUnit },
  { id: 'nut_iron', nameFa: 'آهن', nameEn: 'Iron', unit: 'mg' as NutrientUnit },
  { id: 'nut_vitamin_a', nameFa: 'ویتامین آ', nameEn: 'Vitamin A', unit: 'mcg' as NutrientUnit },
  { id: 'nut_vitamin_c', nameFa: 'ویتامین سی', nameEn: 'Vitamin C', unit: 'mg' as NutrientUnit },
  {
    id: 'nut_fat_saturated',
    nameFa: 'چربی اشباع',
    nameEn: 'Saturated Fat',
    unit: 'g' as NutrientUnit,
  },
  { id: 'nut_fat_trans', nameFa: 'چربی ترانس', nameEn: 'Trans Fat', unit: 'g' as NutrientUnit },
  { id: 'nut_cholesterol', nameFa: 'کلسترول', nameEn: 'Cholesterol', unit: 'mg' as NutrientUnit },
];

/**
 * Aggregates nutrition across multiple calculated food portions.
 *
 * @param items List of individually calculated food portion nutrition records
 * @returns Total aggregated macronutrients, micronutrients, and data transparency reports
 */
export function aggregateNutrition(items: FoodPortionNutrition[]): AggregatedNutritionResult {
  if (!Array.isArray(items)) {
    throw new NutritionValidationError('Items must be an array of food portion nutrition records');
  }

  if (items.length === 0) {
    return {
      totalPortionGrams: 0,
      totalEnergyKcal: 0,
      totalProteinGrams: 0,
      totalCarbsGrams: 0,
      totalFatGrams: 0,
      nutrients: [],
      items: [],
      missingNutrients: [],
      warnings: [],
    };
  }

  let totalPortionGrams = 0;
  let totalEnergyKcal = 0;
  let totalProteinGrams = 0;
  let totalCarbsGrams = 0;
  let totalFatGrams = 0;

  const nutrientAggregationMap = new Map<
    string,
    {
      nutrientId: string;
      code: string;
      nameFa: string;
      nameEn: string;
      unit: NutrientUnit;
      totalAmount: number;
    }
  >();

  const allWarnings: string[] = [];
  const foodPresenceMap = new Map<string, Set<string>>(); // nutrientId -> Set<foodId>

  items.forEach((item) => {
    totalPortionGrams += item.portionGrams;
    totalEnergyKcal += item.energyKcal;
    totalProteinGrams += item.proteinGrams;
    totalCarbsGrams += item.carbsGrams;
    totalFatGrams += item.fatGrams;

    if (item.warnings && item.warnings.length > 0) {
      allWarnings.push(...item.warnings);
    }

    item.nutrients.forEach((n) => {
      const existing = nutrientAggregationMap.get(n.nutrientId);
      if (existing) {
        existing.totalAmount += n.amount;
      } else {
        nutrientAggregationMap.set(n.nutrientId, {
          nutrientId: n.nutrientId,
          code: n.code,
          nameFa: n.nameFa,
          nameEn: n.nameEn,
          unit: n.unit,
          totalAmount: n.amount,
        });
      }

      if (!foodPresenceMap.has(n.nutrientId)) {
        foodPresenceMap.set(n.nutrientId, new Set());
      }
      foodPresenceMap.get(n.nutrientId)!.add(item.foodId);
    });
  });

  // Check for tracked optional nutrients that are missing from any item
  const missingNutrientsList: string[] = [];
  TRACKED_OPTIONAL_NUTRIENTS.forEach((opt) => {
    const presentFoods = foodPresenceMap.get(opt.id);
    if (!presentFoods || presentFoods.size < items.length) {
      const missingCount = items.length - (presentFoods ? presentFoods.size : 0);
      missingNutrientsList.push(
        `${opt.nameEn} (${opt.nameFa}) is not reported for ${missingCount} of ${items.length} items.`,
      );
    }
  });

  // Convert nutrient map to sorted array
  const aggregatedNutrients: AggregatedNutrientValue[] = Array.from(
    nutrientAggregationMap.values(),
  ).map((n) => ({
    nutrientId: n.nutrientId,
    code: n.code,
    nameFa: n.nameFa,
    nameEn: n.nameEn,
    unit: n.unit,
    amount: Math.round(n.totalAmount * 100) / 100,
  }));

  return {
    totalPortionGrams: Math.round(totalPortionGrams * 10) / 10,
    totalEnergyKcal: Math.round(totalEnergyKcal * 10) / 10,
    totalProteinGrams: Math.round(totalProteinGrams * 10) / 10,
    totalCarbsGrams: Math.round(totalCarbsGrams * 10) / 10,
    totalFatGrams: Math.round(totalFatGrams * 10) / 10,
    nutrients: aggregatedNutrients,
    items,
    missingNutrients: missingNutrientsList.length > 0 ? missingNutrientsList : undefined,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  };
}
