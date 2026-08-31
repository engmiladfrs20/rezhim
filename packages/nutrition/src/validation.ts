import type {
  BmrCalculationInput,
  UserBiometrics,
  Gender,
  BMRFormula,
  ActivityLevel,
  DietGoal,
  NutrientUnit,
} from '@nutriai/types';
import {
  NutritionValidationError,
  UnsupportedPopulationError,
  FormulaPrerequisiteError,
} from './errors';
import { BIOMETRIC_BOUNDS, ACTIVITY_FACTORS, DIET_GOAL_CALORIE_DELTAS } from './constants';
import type { FoodDataInput } from './portion';

const VALID_GENDERS: readonly Gender[] = ['male', 'female'];
const VALID_FORMULAS: readonly BMRFormula[] = [
  'mifflin_st_jeor',
  'harris_benedict',
  'katch_mcardle',
];
const VALID_NUTRIENT_UNITS: readonly NutrientUnit[] = ['kcal', 'g', 'mg', 'mcg', 'IU'];

export function validateFiniteNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new NutritionValidationError(`${field} must be a finite number.`, field);
  }
}

export function validateFiniteNonNegative(value: unknown, field: string): asserts value is number {
  validateFiniteNumber(value, field);
  if (value < 0) {
    throw new NutritionValidationError(`${field} must be non-negative.`, field);
  }
}

/**
 * Validates BMR input parameters, enforcing physiological limits and population restrictions.
 */
export function validateBmrInput(input: BmrCalculationInput): void {
  if (!input || typeof input !== 'object') {
    throw new NutritionValidationError('Input must be a valid object');
  }

  // 1. Gender
  if (!input.gender || !VALID_GENDERS.includes(input.gender)) {
    throw new NutritionValidationError(
      `Invalid gender: "${String(input.gender)}". Must be 'male' or 'female'.`,
      'gender',
    );
  }

  // 2. Supported Population & Age Bounds
  if (typeof input.age !== 'number' || !Number.isFinite(input.age)) {
    throw new NutritionValidationError('Age must be a valid finite number.', 'age');
  }

  if (input.age < BIOMETRIC_BOUNDS.MIN_AGE) {
    throw new UnsupportedPopulationError(
      `Nutrition target calculations are restricted to adults aged 19 years or older. Children and adolescents (< 19) are not supported. Received: ${input.age}`,
      'age',
    );
  }

  if (input.age > BIOMETRIC_BOUNDS.MAX_AGE) {
    throw new NutritionValidationError(
      `Age exceeds maximum supported biometric limit of ${BIOMETRIC_BOUNDS.MAX_AGE}. Received: ${input.age}`,
      'age',
    );
  }

  // 3. Life Stage Restriction
  if (
    input.lifeStage !== undefined &&
    input.lifeStage !== null &&
    input.lifeStage !== 'adult_non_pregnant_non_lactating'
  ) {
    throw new UnsupportedPopulationError(
      `Nutrition target calculations currently only support nonpregnant and nonlactating adults. Life stage "${String(input.lifeStage)}" is not supported.`,
      'lifeStage',
    );
  }

  // 4. Height
  if (
    typeof input.heightCm !== 'number' ||
    !Number.isFinite(input.heightCm) ||
    input.heightCm < BIOMETRIC_BOUNDS.MIN_HEIGHT_CM ||
    input.heightCm > BIOMETRIC_BOUNDS.MAX_HEIGHT_CM
  ) {
    throw new NutritionValidationError(
      `Height must be a valid finite number between ${BIOMETRIC_BOUNDS.MIN_HEIGHT_CM} cm and ${BIOMETRIC_BOUNDS.MAX_HEIGHT_CM} cm. Received: ${String(input.heightCm)}`,
      'heightCm',
    );
  }

  // 5. Weight
  if (
    typeof input.weightKg !== 'number' ||
    !Number.isFinite(input.weightKg) ||
    input.weightKg < BIOMETRIC_BOUNDS.MIN_WEIGHT_KG ||
    input.weightKg > BIOMETRIC_BOUNDS.MAX_WEIGHT_KG
  ) {
    throw new NutritionValidationError(
      `Weight must be a valid finite number between ${BIOMETRIC_BOUNDS.MIN_WEIGHT_KG} kg and ${BIOMETRIC_BOUNDS.MAX_WEIGHT_KG} kg. Received: ${String(input.weightKg)}`,
      'weightKg',
    );
  }

  // 6. Formula
  if (!input.formula || !VALID_FORMULAS.includes(input.formula)) {
    throw new NutritionValidationError(
      `Invalid BMR formula: "${String(input.formula)}". Must be one of: ${VALID_FORMULAS.join(', ')}.`,
      'formula',
    );
  }

  // 7. Body Fat Percentage validation
  if (input.formula === 'katch_mcardle') {
    if (
      input.bodyFatPercentage === undefined ||
      input.bodyFatPercentage === null ||
      typeof input.bodyFatPercentage !== 'number' ||
      !Number.isFinite(input.bodyFatPercentage)
    ) {
      throw new FormulaPrerequisiteError(
        'Body fat percentage is strictly required for the Katch-McArdle formula.',
        'bodyFatPercentage',
      );
    }
  }

  if (input.bodyFatPercentage !== undefined && input.bodyFatPercentage !== null) {
    if (
      typeof input.bodyFatPercentage !== 'number' ||
      !Number.isFinite(input.bodyFatPercentage) ||
      input.bodyFatPercentage < BIOMETRIC_BOUNDS.MIN_BODY_FAT_PERCENTAGE ||
      input.bodyFatPercentage > BIOMETRIC_BOUNDS.MAX_BODY_FAT_PERCENTAGE
    ) {
      throw new NutritionValidationError(
        `Body fat percentage must be a finite number between ${BIOMETRIC_BOUNDS.MIN_BODY_FAT_PERCENTAGE}% and ${BIOMETRIC_BOUNDS.MAX_BODY_FAT_PERCENTAGE}%. Received: ${String(input.bodyFatPercentage)}`,
        'bodyFatPercentage',
      );
    }
  }
}

/**
 * Validates complete user biometrics and goals.
 */
export function validateBiometricsInput(input: UserBiometrics): void {
  validateBmrInput(input);

  // Activity Level
  const validActivityLevels = Object.keys(ACTIVITY_FACTORS) as ActivityLevel[];
  if (!input.activityLevel || !validActivityLevels.includes(input.activityLevel)) {
    throw new NutritionValidationError(
      `Invalid activity level: "${String(input.activityLevel)}". Must be one of: ${validActivityLevels.join(', ')}.`,
      'activityLevel',
    );
  }

  // Diet Goal
  const validDietGoals = Object.keys(DIET_GOAL_CALORIE_DELTAS) as DietGoal[];
  if (!input.dietGoal || !validDietGoals.includes(input.dietGoal)) {
    throw new NutritionValidationError(
      `Invalid diet goal: "${String(input.dietGoal)}". Must be one of: ${validDietGoals.join(', ')}.`,
      'dietGoal',
    );
  }
}

/**
 * Validates a food data record used for portion and aggregation calculations.
 * Enforces finite numbers, non-negative amounts, duplicate nutrient rejection, and valid units.
 */
export function validateFoodDataInput(food: FoodDataInput): void {
  if (!food || typeof food !== 'object') {
    throw new NutritionValidationError('Food data must be a valid object.');
  }

  if (!food.id || typeof food.id !== 'string' || food.id.trim() === '') {
    throw new NutritionValidationError('Food item must have a valid non-empty string ID.', 'id');
  }

  if (food.status !== 'active') {
    throw new NutritionValidationError(
      `Cannot calculate nutrition for food "${food.id}" with status "${food.status}". Only active foods are allowed.`,
      'status',
    );
  }

  if (!Array.isArray(food.nutrients)) {
    throw new NutritionValidationError(
      `Food "${food.id}" nutrients list must be an array.`,
      'nutrients',
    );
  }

  const seenNutrientIds = new Set<string>();
  const nutrientUnits = new Map<string, NutrientUnit>();

  for (const n of food.nutrients) {
    if (!n || typeof n !== 'object') {
      throw new NutritionValidationError(
        `Food "${food.id}" contains an invalid nutrient entry.`,
        'nutrients',
      );
    }

    if (!n.nutrient_id || typeof n.nutrient_id !== 'string' || n.nutrient_id.trim() === '') {
      throw new NutritionValidationError(
        `Food "${food.id}" contains a nutrient with a missing or empty nutrient_id.`,
        'nutrient_id',
      );
    }

    // Duplicate nutrient check
    if (seenNutrientIds.has(n.nutrient_id)) {
      throw new NutritionValidationError(
        `Food "${food.id}" contains duplicate nutrient ID "${n.nutrient_id}".`,
        'nutrient_id',
      );
    }
    seenNutrientIds.add(n.nutrient_id);

    // Unit validation
    if (!n.unit || !VALID_NUTRIENT_UNITS.includes(n.unit)) {
      throw new NutritionValidationError(
        `Food "${food.id}" nutrient "${n.nutrient_id}" has unsupported unit "${String(n.unit)}". Supported units: ${VALID_NUTRIENT_UNITS.join(', ')}.`,
        'unit',
      );
    }

    const prevUnit = nutrientUnits.get(n.nutrient_id);
    if (prevUnit && prevUnit !== n.unit) {
      throw new NutritionValidationError(
        `Food "${food.id}" nutrient "${n.nutrient_id}" has conflicting unit representation: ${prevUnit} vs ${n.unit}.`,
        'unit',
      );
    }
    nutrientUnits.set(n.nutrient_id, n.unit);

    // Amount validation
    if (
      typeof n.amount_per_100g !== 'number' ||
      !Number.isFinite(n.amount_per_100g) ||
      n.amount_per_100g < 0
    ) {
      throw new NutritionValidationError(
        `Food "${food.id}" nutrient "${n.nutrient_id}" amount must be a finite non-negative number. Received: ${String(n.amount_per_100g)}`,
        'amount_per_100g',
      );
    }
  }

  // Servings validation if provided
  if (food.servings !== undefined && food.servings !== null) {
    if (!Array.isArray(food.servings)) {
      throw new NutritionValidationError(
        `Food "${food.id}" servings list must be an array.`,
        'servings',
      );
    }

    const seenServingIds = new Set<string>();
    for (const s of food.servings) {
      if (!s || typeof s !== 'object') {
        throw new NutritionValidationError(
          `Food "${food.id}" contains an invalid serving entry.`,
          'servings',
        );
      }

      if (!s.id || typeof s.id !== 'string' || s.id.trim() === '') {
        throw new NutritionValidationError(
          `Food "${food.id}" contains a serving with a missing or empty ID.`,
          'servings',
        );
      }

      if (seenServingIds.has(s.id)) {
        throw new NutritionValidationError(
          `Food "${food.id}" contains duplicate serving ID "${s.id}".`,
          'servings',
        );
      }
      seenServingIds.add(s.id);

      const weight = s.weight_g ?? s.weightG;
      if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
        throw new NutritionValidationError(
          `Food "${food.id}" serving "${s.id}" weight must be a strictly positive finite number. Received: ${String(weight)}`,
          'weight_g',
        );
      }
    }
  }
}

/**
 * Validates calculated output metrics to guarantee finite, non-NaN, non-negative numbers.
 */
export function validateCalculatedOutput(output: object, label = 'Calculation output'): void {
  if (!output || typeof output !== 'object') {
    throw new NutritionValidationError(`${label} must be a valid object.`);
  }

  for (const [key, value] of Object.entries(output as Record<string, unknown>)) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || Number.isNaN(value)) {
        throw new NutritionValidationError(
          `${label} metric "${key}" produced a non-finite number: ${String(value)}`,
          key,
        );
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      validateCalculatedOutput(value as Record<string, unknown>, `${label}.${key}`);
    } else if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (typeof entry === 'number') {
          validateFiniteNumber(entry, `${label}.${key}[${index}]`);
        } else if (entry && typeof entry === 'object') {
          validateCalculatedOutput(entry, `${label}.${key}[${index}]`);
        }
      });
    }
  }
}

/**
 * Exported unified runtime validator wrapper.
 */
export function validateNutritionInput(input: unknown): void {
  if (!input || typeof input !== 'object') {
    throw new NutritionValidationError('Input payload must be a valid object.');
  }
  if ('gender' in input && 'formula' in input) {
    validateBiometricsInput(input as UserBiometrics);
    return;
  }
  if ('status' in input && 'nutrients' in input) {
    validateFoodDataInput(input as FoodDataInput);
    return;
  }
  throw new NutritionValidationError('Input payload does not match a supported nutrition input.');
}
