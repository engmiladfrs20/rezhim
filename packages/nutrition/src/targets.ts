import type {
  UserBiometrics,
  CalculatedNutritionTargets,
  MacronutrientTargets,
  MicronutrientTargets,
} from '@nutriai/types';
import { validateBiometricsInput } from './validation';
import { calculateBmr } from './bmr';
import { calculateTdee } from './tdee';
import {
  DIET_GOAL_CALORIE_DELTAS,
  DIET_GOAL_MACRO_RATIOS,
  ENERGY_CONVERSION,
  MICRONUTRIENT_GUIDELINES,
  BIOMETRIC_BOUNDS,
} from './constants';

/**
 * Calculates complete, personalized daily nutrition targets.
 *
 * Guarantees:
 * - Deterministic, pure calculation without random seeds or external network dependencies.
 * - Strict rounding at output boundary only.
 * - Macronutrient percentages sum to exactly 100%.
 * - Non-negative, finite numbers for all metrics.
 *
 * @param input Validated user biometric and goal parameters
 * @returns Comprehensive calculated targets conforming to CalculatedNutritionTargets
 */
export function calculateNutritionTargets(input: UserBiometrics): CalculatedNutritionTargets {
  validateBiometricsInput(input);

  // 1. Core Energy Requirements
  const rawBmr = calculateBmr(input);
  const rawTdee = calculateTdee({ bmr: rawBmr, activityLevel: input.activityLevel });

  const goalDelta = DIET_GOAL_CALORIE_DELTAS[input.dietGoal];
  const roundedBmr = Math.round(rawBmr);
  const roundedTdee = Math.round(rawTdee);

  // Enforce physiological safety floor
  const targetCalories = Math.max(
    BIOMETRIC_BOUNDS.MIN_CALORIE_FLOOR,
    Math.round(rawTdee + goalDelta),
  );

  const calorieDelta = targetCalories - roundedTdee;

  // 2. Macronutrient Target Distribution
  const ratios = DIET_GOAL_MACRO_RATIOS[input.dietGoal];
  const proteinPercentage = ratios.proteinPercentage;
  const carbsPercentage = ratios.carbsPercentage;
  const fatPercentage = ratios.fatPercentage;

  // Exact percentage check invariant
  if (proteinPercentage + carbsPercentage + fatPercentage !== 100) {
    throw new Error('Internal error: Macronutrient percentage ratios do not sum to 100%');
  }

  const proteinCalories = Math.round((targetCalories * proteinPercentage) / 100);
  const carbsCalories = Math.round((targetCalories * carbsPercentage) / 100);
  const fatCalories = Math.round((targetCalories * fatPercentage) / 100);

  const proteinGrams = Math.round(proteinCalories / ENERGY_CONVERSION.PROTEIN_KCAL_PER_G);
  const carbsGrams = Math.round(carbsCalories / ENERGY_CONVERSION.CARBS_KCAL_PER_G);
  const fatGrams = Math.round(fatCalories / ENERGY_CONVERSION.FAT_KCAL_PER_G);

  const macronutrients: MacronutrientTargets = {
    proteinGrams,
    proteinCalories,
    proteinPercentage,
    fatGrams,
    fatCalories,
    fatPercentage,
    carbsGrams,
    carbsCalories,
    carbsPercentage,
  };

  // 3. Evidence-Based Micronutrient & Fluid Recommendations
  const micronutrients: MicronutrientTargets = {
    recommendedWaterMl: Math.round(input.weightKg * MICRONUTRIENT_GUIDELINES.WATER_ML_PER_KG),
    minimumFiberGrams: Math.round(
      (targetCalories / 1000) * MICRONUTRIENT_GUIDELINES.FIBER_GRAMS_PER_1000_KCAL,
    ),
    maximumSodiumMg: MICRONUTRIENT_GUIDELINES.SODIUM_MAX_MG,
    recommendedCalciumMg: MICRONUTRIENT_GUIDELINES.CALCIUM_RDA_MG,
    recommendedIronMg: MICRONUTRIENT_GUIDELINES.IRON_RDA_MG[input.gender],
    recommendedPotassiumMg: MICRONUTRIENT_GUIDELINES.POTASSIUM_RDA_MG[input.gender],
  };

  return {
    bmr: roundedBmr,
    tdee: roundedTdee,
    targetCalories,
    calorieDelta,
    macronutrients,
    micronutrients,
  };
}
