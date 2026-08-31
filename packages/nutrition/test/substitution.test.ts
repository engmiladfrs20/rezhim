import { describe, expect, it } from 'vitest';
import type { FoodPortionNutrition } from '@nutriai/types';
import { findFoodSubstitutions, NutritionValidationError } from '../src';

function food(
  id: string,
  energy: number,
  protein: number,
  carbs: number,
  fat: number,
): FoodPortionNutrition {
  return {
    foodId: id,
    foodNameFa: id,
    foodNameEn: id,
    portionGrams: 100,
    serving: null,
    nutrients: [],
    energyKcal: energy,
    proteinGrams: protein,
    carbsGrams: carbs,
    fatGrams: fat,
  };
}

describe('Deterministic food substitution engine', () => {
  const reference = food('reference', 200, 20, 25, 8);
  const candidates = [
    food('far', 500, 3, 80, 20),
    food('close-b', 205, 19, 26, 8),
    food('close-a', 198, 21, 24, 9),
  ];

  it('ranks alternatives by weighted macro and energy similarity', () => {
    const result = findFoodSubstitutions({ reference, candidates, limit: 2 });
    expect(result.algorithmVersion).toBe('phase10-v1');
    expect(result.recommendations.map((item) => item.food.foodId)).toEqual(['close-b', 'close-a']);
    expect(result.recommendations[0]?.food.energyKcal).toBe(200);
    expect(result.recommendations[0]?.reasons.length).toBeGreaterThan(0);
  });

  it('excludes the reference, scales alternatives to comparable energy, and is stable', () => {
    const withReference = findFoodSubstitutions({
      reference,
      candidates: [reference, ...candidates],
    });
    const repeated = findFoodSubstitutions({ reference, candidates: [reference, ...candidates] });
    expect(withReference.recommendations.every((item) => item.food.foodId !== 'reference')).toBe(
      true,
    );
    expect(withReference).toEqual(repeated);
    expect(withReference.recommendations[0]?.food.energyKcal).toBeCloseTo(reference.energyKcal, 1);
  });

  it('validates limits, duplicate candidates, and invalid nutrition', () => {
    expect(() => findFoodSubstitutions({ reference, candidates, limit: 11 })).toThrow(
      NutritionValidationError,
    );
    expect(() =>
      findFoodSubstitutions({ reference, candidates: [candidates[0]!, candidates[0]!] }),
    ).toThrow('unique');
    expect(() =>
      findFoodSubstitutions({ reference, candidates: [food('bad', 0, 1, 1, 1)] }),
    ).toThrow('invalid nutrition');
  });
});
