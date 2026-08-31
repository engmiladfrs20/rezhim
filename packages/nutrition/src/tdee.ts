import type { TdeeCalculationInput } from '@nutriai/types';
import { ACTIVITY_FACTORS } from './constants';
import { NutritionValidationError } from './errors';

/**
 * Calculates Total Daily Energy Expenditure (TDEE) in kcal/day.
 *
 * TDEE = BMR * Physical Activity Level (PAL) Factor
 *
 * @param input BMR and physical activity level
 * @returns Raw TDEE in kcal/day with full floating-point precision
 */
export function calculateTdee(input: TdeeCalculationInput): number {
  const { bmr, activityLevel } = input;

  if (typeof bmr !== 'number' || !Number.isFinite(bmr) || bmr <= 0) {
    throw new NutritionValidationError(
      `BMR must be a positive finite number. Received: ${String(bmr)}`,
      'bmr',
    );
  }

  const factor = ACTIVITY_FACTORS[activityLevel];
  if (factor === undefined) {
    throw new NutritionValidationError(
      `Invalid activity level: "${String(activityLevel)}".`,
      'activityLevel',
    );
  }

  return bmr * factor;
}
