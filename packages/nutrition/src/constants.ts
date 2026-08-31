import type { ActivityLevel, DietGoal } from '@nutriai/types';

/**
 * Physical activity level multipliers based on FAO/WHO/UNU Expert Consultation on Human Energy Requirements.
 */
export const ACTIVITY_FACTORS: Readonly<Record<ActivityLevel, number>> = Object.freeze({
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
});

/**
 * Calorie adjustments in kcal/day relative to TDEE for each dietary goal.
 * Values reflect evidence-based deficit/surplus protocols (Hall et al. 2011).
 */
export const DIET_GOAL_CALORIE_DELTAS: Readonly<Record<DietGoal, number>> = Object.freeze({
  weight_loss_aggressive: -500,
  weight_loss_mild: -300,
  maintenance: 0,
  muscle_gain_mild: 300,
  muscle_gain_aggressive: 500,
});

/**
 * Standard Atwater general factor energy conversion constants in kcal/gram.
 */
export const ENERGY_CONVERSION = Object.freeze({
  PROTEIN_KCAL_PER_G: 4,
  CARBS_KCAL_PER_G: 4,
  FAT_KCAL_PER_G: 9,
});

export interface MacroRatio {
  proteinPercentage: number;
  carbsPercentage: number;
  fatPercentage: number;
}

/**
 * Evidence-based macronutrient percentage splits per diet goal.
 * Each distribution strictly sums to 100%.
 */
export const DIET_GOAL_MACRO_RATIOS: Readonly<Record<DietGoal, MacroRatio>> = Object.freeze({
  weight_loss_aggressive: Object.freeze({
    proteinPercentage: 35,
    carbsPercentage: 35,
    fatPercentage: 30,
  }),
  weight_loss_mild: Object.freeze({
    proteinPercentage: 30,
    carbsPercentage: 40,
    fatPercentage: 30,
  }),
  maintenance: Object.freeze({
    proteinPercentage: 25,
    carbsPercentage: 50,
    fatPercentage: 25,
  }),
  muscle_gain_mild: Object.freeze({
    proteinPercentage: 30,
    carbsPercentage: 45,
    fatPercentage: 25,
  }),
  muscle_gain_aggressive: Object.freeze({
    proteinPercentage: 30,
    carbsPercentage: 50,
    fatPercentage: 20,
  }),
});

/**
 * Evidence-based micronutrient and fluid guidelines derived from US National Academies DRI & WHO standards.
 */
export const MICRONUTRIENT_GUIDELINES = Object.freeze({
  /** Daily recommended water intake in ml per kg of body weight */
  WATER_ML_PER_KG: 35,
  /** Minimum daily fiber in grams per 1,000 kcal intake (Institute of Medicine DRI) */
  FIBER_GRAMS_PER_1000_KCAL: 14,
  /** Maximum daily sodium intake upper recommendation in mg (AHA / Dietary Guidelines for Americans) */
  SODIUM_MAX_MG: 2300,
  /** Recommended adult calcium intake in mg */
  CALCIUM_RDA_MG: 1000,
  /** Recommended adult iron intake in mg by gender */
  IRON_RDA_MG: Object.freeze({
    male: 8,
    female: 18,
  }),
  /** Recommended adult potassium intake in mg by gender (NASEM 2019) */
  POTASSIUM_RDA_MG: Object.freeze({
    male: 3400,
    female: 2600,
  }),
});

/**
 * Biometric validation limits to enforce physiological plausibility.
 */
export const BIOMETRIC_BOUNDS = Object.freeze({
  MIN_AGE: 10,
  MAX_AGE: 120,
  MIN_HEIGHT_CM: 50,
  MAX_HEIGHT_CM: 260,
  MIN_WEIGHT_KG: 20,
  MAX_WEIGHT_KG: 350,
  MIN_BODY_FAT_PERCENTAGE: 1,
  MAX_BODY_FAT_PERCENTAGE: 70,
  MIN_CALORIE_FLOOR: 1000,
  MIN_CALORIE_FLOOR_FEMALE: 1200,
  MIN_CALORIE_FLOOR_MALE: 1500,
});
