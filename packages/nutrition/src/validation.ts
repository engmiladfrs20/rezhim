import type {
  BmrCalculationInput,
  UserBiometrics,
  Gender,
  BMRFormula,
  ActivityLevel,
  DietGoal,
} from '@nutriai/types';
import { NutritionValidationError, FormulaPrerequisiteError } from './errors';
import { BIOMETRIC_BOUNDS, ACTIVITY_FACTORS, DIET_GOAL_CALORIE_DELTAS } from './constants';

const VALID_GENDERS: readonly Gender[] = ['male', 'female'];
const VALID_FORMULAS: readonly BMRFormula[] = [
  'mifflin_st_jeor',
  'harris_benedict',
  'katch_mcardle',
];

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

  // 2. Age
  if (
    typeof input.age !== 'number' ||
    !Number.isFinite(input.age) ||
    input.age < BIOMETRIC_BOUNDS.MIN_AGE ||
    input.age > BIOMETRIC_BOUNDS.MAX_AGE
  ) {
    throw new NutritionValidationError(
      `Age must be a valid number between ${BIOMETRIC_BOUNDS.MIN_AGE} and ${BIOMETRIC_BOUNDS.MAX_AGE}. Received: ${String(input.age)}`,
      'age',
    );
  }

  // 3. Height
  if (
    typeof input.heightCm !== 'number' ||
    !Number.isFinite(input.heightCm) ||
    input.heightCm < BIOMETRIC_BOUNDS.MIN_HEIGHT_CM ||
    input.heightCm > BIOMETRIC_BOUNDS.MAX_HEIGHT_CM
  ) {
    throw new NutritionValidationError(
      `Height must be a valid number between ${BIOMETRIC_BOUNDS.MIN_HEIGHT_CM} cm and ${BIOMETRIC_BOUNDS.MAX_HEIGHT_CM} cm. Received: ${String(input.heightCm)}`,
      'heightCm',
    );
  }

  // 4. Weight
  if (
    typeof input.weightKg !== 'number' ||
    !Number.isFinite(input.weightKg) ||
    input.weightKg < BIOMETRIC_BOUNDS.MIN_WEIGHT_KG ||
    input.weightKg > BIOMETRIC_BOUNDS.MAX_WEIGHT_KG
  ) {
    throw new NutritionValidationError(
      `Weight must be a valid number between ${BIOMETRIC_BOUNDS.MIN_WEIGHT_KG} kg and ${BIOMETRIC_BOUNDS.MAX_WEIGHT_KG} kg. Received: ${String(input.weightKg)}`,
      'weightKg',
    );
  }

  // 5. Formula
  if (!input.formula || !VALID_FORMULAS.includes(input.formula)) {
    throw new NutritionValidationError(
      `Invalid BMR formula: "${String(input.formula)}". Must be one of: ${VALID_FORMULAS.join(', ')}.`,
      'formula',
    );
  }

  // 6. Body Fat Percentage validation
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
        `Body fat percentage must be between ${BIOMETRIC_BOUNDS.MIN_BODY_FAT_PERCENTAGE}% and ${BIOMETRIC_BOUNDS.MAX_BODY_FAT_PERCENTAGE}%. Received: ${String(input.bodyFatPercentage)}`,
        'bodyFatPercentage',
      );
    }
  }
}

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
