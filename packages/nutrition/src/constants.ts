import type { ActivityLevel, DietGoal, Gender } from '@nutriai/types';

/**
 * Current version of the NutriAI Product Policy rules.
 */
export const NUTRIAI_PRODUCT_POLICY_VERSION = '2026.1';

/**
 * Physical activity level (PAL) multipliers.
 * These discrete values are labeled as NutriAI Product Policy multipliers (v2026.1),
 * adapted from standard energy requirements literature (FAO/WHO/UNU 2004; Black et al. 1996).
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
 * NutriAI Product Policy (v2026.1) versioned protocol deltas.
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
 * (Merrill & Watt, USDA Handbook 74, 1973).
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
 * NutriAI Product Policy (v2026.1) macronutrient percentage splits per diet goal.
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
 * Primary authoritative reference citations for micronutrient reference values.
 */
export const PRIMARY_NUTRITION_REFERENCES = Object.freeze({
  CALCIUM:
    'Institute of Medicine (IOM) Dietary Reference Intakes for Calcium and Vitamin D (2011); NIH Office of Dietary Supplements.',
  IRON: 'Institute of Medicine (IOM) Dietary Reference Intakes for Vitamin A, Vitamin K, Arsenic, Boron, Chromium, Copper, Iodine, Iron, Manganese, Molybdenum, Nickel, Silicon, Vanadium, and Zinc (2001); NIH Office of Dietary Supplements.',
  POTASSIUM:
    'National Academies of Sciences, Engineering, and Medicine (NASEM) Dietary Reference Intakes for Sodium and Potassium (2019). Note: Potassium value is Adequate Intake (AI), not RDA.',
  FIBER:
    'Institute of Medicine (IOM) Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids (2002/2005). Note: Fiber value is Adequate Intake (AI), 14g / 1,000 kcal.',
  SODIUM:
    'National Academies of Sciences, Engineering, and Medicine (NASEM) 2019 CDRR / Dietary Guidelines for Americans 2020-2025.',
});

/**
 * Calculates recommended daily Calcium RDA (in mg) applying age and sex bands.
 * - Adults 19-50 (male & female): 1000 mg
 * - Men 51-70: 1000 mg
 * - Women 51-70: 1200 mg
 * - Men & Women 71+: 1200 mg
 * Source: NIH ODS / IOM 2011.
 */
export function getCalciumTargetMg(gender: Gender, age: number): number {
  if (age >= 71) {
    return 1200;
  }
  if (gender === 'female' && age >= 51) {
    return 1200;
  }
  return 1000;
}

/**
 * Calculates recommended daily Iron RDA (in mg) applying age and sex bands.
 * - Men 19+: 8 mg
 * - Women 19-50: 18 mg
 * - Women 51+: 8 mg (postmenopausal baseline)
 * Source: NIH ODS / IOM 2001.
 */
export function getIronTargetMg(gender: Gender, age: number): number {
  if (gender === 'male') {
    return 8;
  }
  if (age >= 51) {
    return 8;
  }
  return 18;
}

/**
 * Calculates recommended daily Potassium Adequate Intake (AI) in mg by sex.
 * - Men 19+: 3400 mg (AI)
 * - Women 19+: 2600 mg (AI)
 * Source: NASEM 2019 DRI Update.
 */
export function getPotassiumAiMg(gender: Gender): number {
  return gender === 'male' ? 3400 : 2600;
}

/**
 * Evidence-based micronutrient and fluid guidelines for supported adult populations (19+).
 */
export const MICRONUTRIENT_GUIDELINES = Object.freeze({
  /** Daily recommended water intake in ml per kg of body weight */
  WATER_ML_PER_KG: 35,
  /** Minimum daily fiber Adequate Intake (AI) in grams per 1,000 kcal intake (IOM DRI) */
  FIBER_GRAMS_PER_1000_KCAL: 14,
  /** Maximum daily sodium intake CDRR upper recommendation in mg (NASEM 2019) */
  SODIUM_MAX_MG: 2300,
  /** Function helpers for age/sex banded targets */
  getCalciumTargetMg,
  getIronTargetMg,
  getPotassiumAiMg,
});

/**
 * Biometric validation limits to enforce physiological plausibility and supported adult population.
 * Target population is restricted to adults aged 19 to 120 years.
 */
export const BIOMETRIC_BOUNDS = Object.freeze({
  MIN_AGE: 19,
  MAX_AGE: 120,
  MIN_HEIGHT_CM: 50,
  MAX_HEIGHT_CM: 260,
  MIN_WEIGHT_KG: 20,
  MAX_WEIGHT_KG: 350,
  MIN_BODY_FAT_PERCENTAGE: 1,
  MAX_BODY_FAT_PERCENTAGE: 70,
  /** Product policy floor; not a clinical safety guarantee. */
  MIN_CALORIE_POLICY_FLOOR: 1000,
});
