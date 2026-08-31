import { describe, expect, it } from 'vitest';
import type { CalculatedNutritionTargets, FoodPortionNutrition } from '@nutriai/types';
import { generateDeterministicMealPlan, NutritionValidationError } from '../src';

const targets: CalculatedNutritionTargets = {
  bmr: 1600,
  tdee: 2400,
  targetCalories: 2400,
  calorieDelta: 0,
  macronutrients: {
    proteinGrams: 150,
    proteinCalories: 600,
    proteinPercentage: 25,
    fatGrams: 67,
    fatCalories: 600,
    fatPercentage: 25,
    carbsGrams: 300,
    carbsCalories: 1200,
    carbsPercentage: 50,
  },
  micronutrients: {
    recommendedWaterMl: 2800,
    minimumFiberGrams: 30,
    maximumSodiumMg: 2300,
    recommendedCalciumMg: 1000,
    recommendedIronMg: 8,
    recommendedPotassiumMg: 3400,
  },
};

function candidate(id: string, energyKcal: number): FoodPortionNutrition {
  return {
    foodId: id,
    foodNameFa: `غذای ${id}`,
    foodNameEn: `Food ${id}`,
    portionGrams: 100,
    serving: null,
    nutrients: [
      {
        nutrientId: 'nut_energy',
        code: 'energy',
        nameFa: 'انرژی',
        nameEn: 'Energy',
        unit: 'kcal',
        amount: energyKcal,
      },
      {
        nutrientId: 'nut_protein',
        code: 'protein',
        nameFa: 'پروتئین',
        nameEn: 'Protein',
        unit: 'g',
        amount: 20,
      },
    ],
    energyKcal,
    proteinGrams: 20,
    carbsGrams: 20,
    fatGrams: 10,
  };
}

const candidates = [
  candidate('food-d', 200),
  candidate('food-a', 300),
  candidate('food-c', 250),
  candidate('food-b', 150),
];

describe('Deterministic meal plan engine', () => {
  it('creates four calorie-budgeted meals per day with stable ordering', () => {
    const plan = generateDeterministicMealPlan({ targets, candidates, days: 1, locale: 'fa' });
    expect(plan.algorithmVersion).toBe('phase9-v1');
    expect(plan.requestedLocale).toBe('fa');
    expect(plan.candidateFoodIds).toEqual(['food-a', 'food-b', 'food-c', 'food-d']);
    expect(plan.days[0]?.meals.map((meal) => meal.mealType)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'snack',
    ]);
    expect(plan.days[0]?.meals.map((meal) => meal.targetCalories)).toEqual([600, 840, 720, 240]);
  });

  it('is deterministic for the same input across repeated calls and days', () => {
    const first = generateDeterministicMealPlan({ targets, candidates, days: 3 });
    const second = generateDeterministicMealPlan({ targets, candidates, days: 3 });
    expect(second).toEqual(first);
    expect(first.days).toHaveLength(3);
    expect(first.days[0]?.nutrition.totalEnergyKcal).toBeGreaterThan(0);
  });

  it('caps unsafe portions while retaining a positive nutrition result', () => {
    const plan = generateDeterministicMealPlan({
      targets: { ...targets, targetCalories: 10000 },
      candidates: [candidate('a', 1), candidate('b', 1), candidate('c', 1), candidate('d', 1)],
      days: 1,
    });
    expect(plan.days[0]?.meals[0]?.nutrition.items[0]?.portionGrams).toBe(800);
    expect(plan.days[0]?.nutrition.totalEnergyKcal).toBeGreaterThan(0);
  });

  it('rejects fewer than four candidates, duplicate IDs, and invalid days', () => {
    expect(() =>
      generateDeterministicMealPlan({ targets, candidates: candidates.slice(0, 3), days: 1 }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      generateDeterministicMealPlan({
        targets,
        candidates: [
          candidate('a', 100),
          candidate('a', 100),
          candidate('b', 100),
          candidate('c', 100),
        ],
        days: 1,
      }),
    ).toThrow('Duplicate meal plan candidate');
    expect(() => generateDeterministicMealPlan({ targets, candidates, days: 15 })).toThrow(
      'between 1 and 14',
    );
  });
});
