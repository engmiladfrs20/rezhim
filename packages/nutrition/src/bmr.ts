import type { BmrCalculationInput } from '@nutriai/types';
import { validateBmrInput } from './validation';

/**
 * Calculates Basal Metabolic Rate (BMR) in kcal/day.
 *
 * Formulas:
 * 1. Mifflin-St Jeor (1990):
 *    - Men:   10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) + 5
 *    - Women: 10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) - 161
 *
 * 2. Harris-Benedict Revised (Roza & Shizgal 1984):
 *    - Men:   88.362 + 13.397 * weight(kg) + 4.799 * height(cm) - 5.677 * age(y)
 *    - Women: 447.593 + 9.247 * weight(kg) + 3.098 * height(cm) - 4.330 * age(y)
 *
 * 3. Katch-McArdle (1996):
 *    - LBM = weight(kg) * (1 - bodyFatPercentage / 100)
 *    - BMR = 370 + 21.6 * LBM
 *
 * @param input Biometric parameters
 * @returns Raw BMR value in kcal/day with full floating-point precision
 */
export function calculateBmr(input: BmrCalculationInput): number {
  validateBmrInput(input);

  const { gender, age, heightCm, weightKg, formula, bodyFatPercentage } = input;

  switch (formula) {
    case 'mifflin_st_jeor': {
      const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
      return gender === 'male' ? base + 5 : base - 161;
    }

    case 'harris_benedict': {
      if (gender === 'male') {
        return 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
      }
      return 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
    }

    case 'katch_mcardle': {
      // bodyFatPercentage is validated to be non-null and numeric by validateBmrInput
      const leanBodyMassKg = weightKg * (1 - (bodyFatPercentage as number) / 100);
      return 370 + 21.6 * leanBodyMassKg;
    }

    default: {
      const exhaustiveCheck: never = formula;
      throw new Error(`Unhandled formula: ${String(exhaustiveCheck)}`);
    }
  }
}
