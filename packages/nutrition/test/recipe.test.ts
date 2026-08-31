import { describe, expect, it } from 'vitest';
import type { AggregatedNutritionResult } from '@nutriai/types';
import { calculateRecipeNutrition, NutritionValidationError } from '../src';

const aggregate: AggregatedNutritionResult = {
  totalPortionGrams: 200,
  totalEnergyKcal: 300,
  totalProteinGrams: 20,
  totalCarbsGrams: 30,
  totalFatGrams: 10,
  nutrients: [
    {
      nutrientId: 'nut_fiber',
      code: 'fiber',
      nameFa: 'فیبر',
      nameEn: 'Fiber',
      unit: 'g',
      amount: 8,
    },
  ],
  items: [],
};

describe('Deterministic recipe nutrition scaling', () => {
  it('returns total, per-100g, and per-serving values deterministically', () => {
    const result = calculateRecipeNutrition(aggregate, { yieldGrams: 160, servings: 2 });

    expect(result.algorithmVersion).toBe('recipe-nutrition-v1');
    expect(result.total.energyKcal).toBe(300);
    expect(result.per100g.energyKcal).toBe(187.5);
    expect(result.perServing.energyKcal).toBe(150);
    expect(result.per100g.nutrients[0]?.amount).toBe(5);
    expect(result.perServing.portionGrams).toBe(80);
  });

  it('preserves transparency arrays without mutating the source aggregate', () => {
    const result = calculateRecipeNutrition(
      { ...aggregate, missingNutrients: ['Iron missing'], warnings: ['Yield is estimated'] },
      { yieldGrams: 200, servings: 4 },
    );

    expect(result.total.missingNutrients).toEqual(['Iron missing']);
    expect(result.perServing.warnings).toEqual(['Yield is estimated']);
    expect(result.total.nutrients).not.toBe(aggregate.nutrients);
  });

  it('rejects zero, fractional, and non-finite recipe dimensions', () => {
    expect(() => calculateRecipeNutrition(aggregate, { yieldGrams: 0, servings: 1 })).toThrow(
      NutritionValidationError,
    );
    expect(() => calculateRecipeNutrition(aggregate, { yieldGrams: 100, servings: 1.5 })).toThrow(
      NutritionValidationError,
    );
    expect(() =>
      calculateRecipeNutrition(aggregate, { yieldGrams: Number.NaN, servings: 1 }),
    ).toThrow(NutritionValidationError);
  });
});
