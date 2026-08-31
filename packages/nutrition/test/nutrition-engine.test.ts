import { describe, it, expect } from 'vitest';
import {
  calculateBmr,
  calculateTdee,
  calculateNutritionTargets,
  calculateFoodPortionNutrition,
  aggregateNutrition,
  validateBmrInput,
  validateBiometricsInput,
  NutritionValidationError,
  UnsupportedPopulationError,
  FormulaPrerequisiteError,
  InvalidPortionError,
  ACTIVITY_FACTORS,
  DIET_GOAL_CALORIE_DELTAS,
  MICRONUTRIENT_GUIDELINES,
  NUTRIAI_PRODUCT_POLICY_VERSION,
  getCalciumTargetMg,
  getIronTargetMg,
  getPotassiumAiMg,
  validateFoodDataInput,
  validateNutritionInput,
  validateCalculatedOutput,
} from '../src';
import type {
  UserBiometrics,
  Gender,
  BMRFormula,
  ActivityLevel,
  DietGoal,
  FoodPortionNutrition,
} from '@nutriai/types';
import type { FoodDataInput, FoodPortionCalculationInput } from '../src';

describe('Nutrition Engine — BMR & TDEE Calculations', () => {
  // Test Case 1: Mifflin-St Jeor (Standard Male & Female)
  // Male: 10 * 80 + 6.25 * 180 - 5 * 30 + 5 = 800 + 1125 - 150 + 5 = 1780
  it('calculates BMR using Mifflin-St Jeor for male accurately', () => {
    const bmr = calculateBmr({
      gender: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 80,
      formula: 'mifflin_st_jeor',
    });
    expect(bmr).toBe(1780);
  });

  // Female: 10 * 60 + 6.25 * 165 - 5 * 28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25
  it('calculates BMR using Mifflin-St Jeor for female accurately', () => {
    const bmr = calculateBmr({
      gender: 'female',
      age: 28,
      heightCm: 165,
      weightKg: 60,
      formula: 'mifflin_st_jeor',
    });
    expect(bmr).toBeCloseTo(1330.25, 2);
  });

  // Test Case 2: Harris-Benedict Revised (Roza & Shizgal 1984)
  // Male: 88.362 + 13.397 * 80 + 4.799 * 180 - 5.677 * 30 = 88.362 + 1071.76 + 863.82 - 170.31 = 1853.632
  it('calculates BMR using Harris-Benedict Revised for male accurately', () => {
    const bmr = calculateBmr({
      gender: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 80,
      formula: 'harris_benedict',
    });
    expect(bmr).toBeCloseTo(1853.632, 2);
  });

  // Female: 447.593 + 9.247 * 60 + 3.098 * 165 - 4.330 * 28 = 447.593 + 554.82 + 511.17 - 121.24 = 1392.343
  it('calculates BMR using Harris-Benedict Revised for female accurately', () => {
    const bmr = calculateBmr({
      gender: 'female',
      age: 28,
      heightCm: 165,
      weightKg: 60,
      formula: 'harris_benedict',
    });
    expect(bmr).toBeCloseTo(1392.343, 2);
  });

  // Test Case 3: Katch-McArdle (Lean Body Mass based)
  // 80kg with 15% body fat: LBM = 80 * 0.85 = 68 kg -> BMR = 370 + 21.6 * 68 = 370 + 1468.8 = 1838.8
  it('calculates BMR using Katch-McArdle when body fat is provided', () => {
    const bmr = calculateBmr({
      gender: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 80,
      bodyFatPercentage: 15,
      formula: 'katch_mcardle',
    });
    expect(bmr).toBeCloseTo(1838.8, 1);
  });

  // Test Case 4: Katch-McArdle strictly rejects missing body fat without fallback
  it('throws FormulaPrerequisiteError when body fat percentage is missing for Katch-McArdle', () => {
    expect(() =>
      calculateBmr({
        gender: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 80,
        formula: 'katch_mcardle',
      }),
    ).toThrow(FormulaPrerequisiteError);
  });

  // Test Case 5: All 5 Activity Level Multipliers
  it('calculates TDEE across all 5 standard physical activity levels', () => {
    const baseBmr = 1800;
    expect(calculateTdee({ bmr: baseBmr, activityLevel: 'sedentary' })).toBe(
      baseBmr * ACTIVITY_FACTORS.sedentary,
    );
    expect(calculateTdee({ bmr: baseBmr, activityLevel: 'lightly_active' })).toBe(
      baseBmr * ACTIVITY_FACTORS.lightly_active,
    );
    expect(calculateTdee({ bmr: baseBmr, activityLevel: 'moderately_active' })).toBe(
      baseBmr * ACTIVITY_FACTORS.moderately_active,
    );
    expect(calculateTdee({ bmr: baseBmr, activityLevel: 'very_active' })).toBe(
      baseBmr * ACTIVITY_FACTORS.very_active,
    );
    expect(calculateTdee({ bmr: baseBmr, activityLevel: 'extra_active' })).toBe(
      baseBmr * ACTIVITY_FACTORS.extra_active,
    );
  });

  // Test Case 6: Invalid TDEE inputs
  it('rejects invalid or non-positive BMR in TDEE calculation', () => {
    expect(() => calculateTdee({ bmr: 0, activityLevel: 'sedentary' })).toThrow(
      NutritionValidationError,
    );
    expect(() => calculateTdee({ bmr: -100, activityLevel: 'sedentary' })).toThrow(
      NutritionValidationError,
    );
    expect(() => calculateTdee({ bmr: NaN, activityLevel: 'sedentary' })).toThrow(
      NutritionValidationError,
    );
    expect(() => calculateTdee({ bmr: Infinity, activityLevel: 'sedentary' })).toThrow(
      NutritionValidationError,
    );
  });
});

describe('Nutrition Engine — Targets, Goals & Micronutrients', () => {
  const baseBiometrics: UserBiometrics = {
    gender: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 80,
    activityLevel: 'moderately_active',
    dietGoal: 'maintenance',
    formula: 'mifflin_st_jeor',
  };

  it('calculates full nutrition targets for maintenance goal', () => {
    const targets = calculateNutritionTargets(baseBiometrics);

    // BMR = 1780, TDEE = 1780 * 1.55 = 2759
    expect(targets.bmr).toBe(1780);
    expect(targets.tdee).toBe(2759);
    expect(targets.targetCalories).toBe(2759);
    expect(targets.calorieDelta).toBe(0);

    // Macro sums
    const { macronutrients } = targets;
    expect(
      macronutrients.proteinPercentage +
        macronutrients.carbsPercentage +
        macronutrients.fatPercentage,
    ).toBe(100);
    expect(macronutrients.proteinPercentage).toBe(25);
    expect(macronutrients.carbsPercentage).toBe(50);
    expect(macronutrients.fatPercentage).toBe(25);

    // Micronutrient targets
    expect(targets.micronutrients.recommendedWaterMl).toBe(
      80 * MICRONUTRIENT_GUIDELINES.WATER_ML_PER_KG,
    );
    expect(targets.micronutrients.maximumSodiumMg).toBe(2300);
    expect(targets.micronutrients.recommendedIronMg).toBe(8); // Male iron
  });

  it('calculates full nutrition targets across all 5 diet goals with exact 100% macro sums', () => {
    const goals: UserBiometrics['dietGoal'][] = [
      'weight_loss_aggressive',
      'weight_loss_mild',
      'maintenance',
      'muscle_gain_mild',
      'muscle_gain_aggressive',
    ];

    for (const goal of goals) {
      const targets = calculateNutritionTargets({ ...baseBiometrics, dietGoal: goal });
      const delta = DIET_GOAL_CALORIE_DELTAS[goal];
      expect(targets.targetCalories).toBe(Math.max(1000, targets.tdee + delta));

      const { macronutrients } = targets;
      expect(
        macronutrients.proteinPercentage +
          macronutrients.carbsPercentage +
          macronutrients.fatPercentage,
      ).toBe(100);
      expect(macronutrients.proteinGrams).toBeGreaterThan(0);
      expect(macronutrients.carbsGrams).toBeGreaterThan(0);
      expect(macronutrients.fatGrams).toBeGreaterThan(0);
    }
  });

  it('calculates female specific micronutrient recommendations (Iron & Potassium)', () => {
    const femaleBiometrics: UserBiometrics = {
      gender: 'female',
      age: 26,
      heightCm: 165,
      weightKg: 55,
      activityLevel: 'lightly_active',
      dietGoal: 'weight_loss_mild',
      formula: 'mifflin_st_jeor',
    };

    const targets = calculateNutritionTargets(femaleBiometrics);
    expect(targets.micronutrients.recommendedIronMg).toBe(18); // Female pre-menopausal RDA
    expect(targets.micronutrients.recommendedPotassiumMg).toBe(2600); // Female potassium RDA
  });
});

describe('Nutrition Engine — Input Validation Edge Cases', () => {
  it('rejects out of range age, height, weight, and body fat', () => {
    expect(() =>
      validateBmrInput({
        gender: 'male',
        age: 5,
        heightCm: 180,
        weightKg: 70,
        formula: 'mifflin_st_jeor',
      }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      validateBmrInput({
        gender: 'male',
        age: 150,
        heightCm: 180,
        weightKg: 70,
        formula: 'mifflin_st_jeor',
      }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      validateBmrInput({
        gender: 'male',
        age: 30,
        heightCm: 30,
        weightKg: 70,
        formula: 'mifflin_st_jeor',
      }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      validateBmrInput({
        gender: 'male',
        age: 30,
        heightCm: 300,
        weightKg: 70,
        formula: 'mifflin_st_jeor',
      }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      validateBmrInput({
        gender: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 10,
        formula: 'mifflin_st_jeor',
      }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      validateBmrInput({
        gender: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 500,
        formula: 'mifflin_st_jeor',
      }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      validateBmrInput({
        gender: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 70,
        bodyFatPercentage: 90,
        formula: 'mifflin_st_jeor',
      }),
    ).toThrow(NutritionValidationError);
  });

  it('rejects invalid union values for gender, formula, activity level, and diet goal', () => {
    expect(() =>
      validateBmrInput({
        gender: 'other' as unknown as Gender,
        age: 30,
        heightCm: 180,
        weightKg: 70,
        formula: 'mifflin_st_jeor',
      }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      validateBmrInput({
        gender: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 70,
        formula: 'unknown_formula' as unknown as BMRFormula,
      }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      validateBiometricsInput({
        gender: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 70,
        formula: 'mifflin_st_jeor',
        activityLevel: 'couch_potato' as unknown as ActivityLevel,
        dietGoal: 'maintenance',
      }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      validateBiometricsInput({
        gender: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 70,
        formula: 'mifflin_st_jeor',
        activityLevel: 'sedentary',
        dietGoal: 'infinite_bulk' as unknown as DietGoal,
      }),
    ).toThrow(NutritionValidationError);
  });
});

describe('Nutrition Engine — Food Portion & Multi-Item Aggregation', () => {
  const activeChickenFood = {
    id: 'food_chicken',
    status: 'active',
    nameFa: 'سینه مرغ گریل شده',
    nameEn: 'Grilled Chicken Breast',
    nutrients: [
      {
        nutrient_id: 'nut_energy',
        code: 'energy',
        name_fa: 'انرژی',
        name_en: 'Energy',
        unit: 'kcal' as const,
        amount_per_100g: 165,
      },
      {
        nutrient_id: 'nut_protein',
        code: 'protein',
        name_fa: 'پروتئین',
        name_en: 'Protein',
        unit: 'g' as const,
        amount_per_100g: 31.0,
      },
      {
        nutrient_id: 'nut_carbohydrate',
        code: 'carbohydrate',
        name_fa: 'کربوهیدرات',
        name_en: 'Total Carbohydrates',
        unit: 'g' as const,
        amount_per_100g: 0.0,
      },
      {
        nutrient_id: 'nut_fat_total',
        code: 'fat_total',
        name_fa: 'چربی کل',
        name_en: 'Total Fat',
        unit: 'g' as const,
        amount_per_100g: 3.6,
      },
      {
        nutrient_id: 'nut_sodium',
        code: 'sodium',
        name_fa: 'سدیم',
        name_en: 'Sodium',
        unit: 'mg' as const,
        amount_per_100g: 74,
      },
    ],
    servings: [
      {
        id: 'srv_breast_half',
        nameFa: 'نصف سینه مرغ',
        nameEn: '1/2 breast fillet',
        weightG: 120,
        household_unit: 'piece',
      },
    ],
  };

  const activeRiceFood = {
    id: 'food_rice',
    status: 'active',
    nameFa: 'برنج سفید پخته',
    nameEn: 'Cooked White Rice',
    nutrients: [
      {
        nutrient_id: 'nut_energy',
        code: 'energy',
        name_fa: 'انرژی',
        name_en: 'Energy',
        unit: 'kcal' as const,
        amount_per_100g: 130,
      },
      {
        nutrient_id: 'nut_protein',
        code: 'protein',
        name_fa: 'پروتئین',
        name_en: 'Protein',
        unit: 'g' as const,
        amount_per_100g: 2.7,
      },
      {
        nutrient_id: 'nut_carbohydrate',
        code: 'carbohydrate',
        name_fa: 'کربوهیدرات',
        name_en: 'Total Carbohydrates',
        unit: 'g' as const,
        amount_per_100g: 28.2,
      },
      {
        nutrient_id: 'nut_fat_total',
        code: 'fat_total',
        name_fa: 'چربی کل',
        name_en: 'Total Fat',
        unit: 'g' as const,
        amount_per_100g: 0.3,
      },
      {
        nutrient_id: 'nut_fiber',
        code: 'fiber',
        name_fa: 'فیبر رژیمی',
        name_en: 'Dietary Fiber',
        unit: 'g' as const,
        amount_per_100g: 0.4,
      },
    ],
    servings: [
      {
        id: 'srv_rice_cup',
        nameFa: 'یک لیوان پخته',
        nameEn: '1 cup cooked',
        weightG: 158,
        household_unit: 'cup',
      },
    ],
  };

  it('calculates portion nutrition by grams accurately', () => {
    const res = calculateFoodPortionNutrition(activeChickenFood, { grams: 200 });

    expect(res.portionGrams).toBe(200);
    expect(res.energyKcal).toBe(330); // 165 * 2
    expect(res.proteinGrams).toBe(62.0); // 31 * 2
    expect(res.fatGrams).toBe(7.2); // 3.6 * 2
    expect(res.serving).toBeNull();
  });

  it('calculates portion nutrition by serving and quantity accurately', () => {
    const res = calculateFoodPortionNutrition(activeChickenFood, {
      servingId: 'srv_breast_half',
      quantity: 1.5,
    });

    // 120g * 1.5 = 180g
    expect(res.portionGrams).toBe(180);
    expect(res.energyKcal).toBe(297); // 165 * 1.8
    expect(res.proteinGrams).toBe(55.8); // 31 * 1.8
    expect(res.serving).toEqual({
      id: 'srv_breast_half',
      nameFa: 'نصف سینه مرغ',
      nameEn: '1/2 breast fillet',
      weightG: 120,
      quantity: 1.5,
    });
  });

  it('rejects draft or archived food items', () => {
    const draftFood = { ...activeChickenFood, status: 'draft' };
    expect(() => calculateFoodPortionNutrition(draftFood, { grams: 100 })).toThrow(
      NutritionValidationError,
    );
  });

  it('rejects ambiguous or missing portion specifications', () => {
    expect(() =>
      calculateFoodPortionNutrition(activeChickenFood, {
        grams: 100,
        servingId: 'srv_breast_half',
      }),
    ).toThrow(InvalidPortionError);
    expect(() => calculateFoodPortionNutrition(activeChickenFood, {})).toThrow(InvalidPortionError);
    expect(() => calculateFoodPortionNutrition(activeChickenFood, { grams: -50 })).toThrow(
      InvalidPortionError,
    );
    expect(() =>
      calculateFoodPortionNutrition(activeChickenFood, { servingId: 'non_existent' }),
    ).toThrow(InvalidPortionError);
  });

  it('emits a calorie consistency warning when reported energy diverges from 4/4/9 macro calculation', () => {
    const divergentFood = {
      ...activeChickenFood,
      nutrients: [
        { nutrient_id: 'nut_energy', code: 'energy', unit: 'kcal' as const, amount_per_100g: 300 }, // Stated 300
        { nutrient_id: 'nut_protein', code: 'protein', unit: 'g' as const, amount_per_100g: 20 }, // 80 kcal
        {
          nutrient_id: 'nut_carbohydrate',
          code: 'carbohydrate',
          unit: 'g' as const,
          amount_per_100g: 10,
        }, // 40 kcal
        { nutrient_id: 'nut_fat_total', code: 'fat_total', unit: 'g' as const, amount_per_100g: 5 }, // 45 kcal -> sum = 165 kcal != 300 kcal
      ],
    };

    const res = calculateFoodPortionNutrition(divergentFood, { grams: 100 });
    expect(res.warnings).toBeDefined();
    expect(res.warnings![0]).toContain('Calorie consistency warning');
  });

  it('aggregates nutrition across multiple portions and tracks missing optional nutrients', () => {
    const portion1 = calculateFoodPortionNutrition(activeChickenFood, { grams: 150 });
    const portion2 = calculateFoodPortionNutrition(activeRiceFood, { grams: 200 });

    const aggregated = aggregateNutrition([portion1, portion2]);

    expect(aggregated.totalPortionGrams).toBe(350);
    expect(aggregated.totalEnergyKcal).toBeCloseTo(portion1.energyKcal + portion2.energyKcal, 1);
    expect(aggregated.totalProteinGrams).toBeCloseTo(
      portion1.proteinGrams + portion2.proteinGrams,
      1,
    );
    expect(aggregated.totalCarbsGrams).toBeCloseTo(portion1.carbsGrams + portion2.carbsGrams, 1);
    expect(aggregated.totalFatGrams).toBeCloseTo(portion1.fatGrams + portion2.fatGrams, 1);

    expect(aggregated.items.length).toBe(2);
    // Chicken is missing fiber; Rice is missing sodium -> missingNutrients lists them
    expect(aggregated.missingNutrients).toBeDefined();
    expect(aggregated.missingNutrients!.some((m) => m.includes('Dietary Fiber'))).toBe(true);
    expect(aggregated.missingNutrients!.some((m) => m.includes('Sodium'))).toBe(true);
  });

  it('handles empty items array in aggregateNutrition', () => {
    const emptyRes = aggregateNutrition([]);
    expect(emptyRes.items).toEqual([]);
    expect(emptyRes.totalEnergyKcal).toBe(0);
    expect(emptyRes.nutrients).toEqual([]);
  });

  it('rejects invalid inputs to aggregateNutrition and calculateFoodPortionNutrition', () => {
    expect(() => aggregateNutrition(null as unknown as FoodPortionNutrition[])).toThrow(
      NutritionValidationError,
    );
    expect(() =>
      calculateFoodPortionNutrition(null as unknown as FoodDataInput, { grams: 100 }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      calculateFoodPortionNutrition(
        activeChickenFood,
        null as unknown as FoodPortionCalculationInput,
      ),
    ).toThrow(InvalidPortionError);
  });

  it('rejects active food missing core macronutrients', () => {
    const incompleteFood = {
      id: 'food_incomplete',
      status: 'active',
      nutrients: [
        { nutrient_id: 'nut_energy', code: 'energy', unit: 'kcal' as const, amount_per_100g: 100 },
        // Missing protein, carbs, fat
      ],
    };
    expect(() => calculateFoodPortionNutrition(incompleteFood, { grams: 100 })).toThrow(
      NutritionValidationError,
    );
  });

  it('rejects invalid serving weight or quantity', () => {
    const invalidWeightServingFood = {
      ...activeChickenFood,
      servings: [{ id: 'srv_invalid', weightG: 0 }],
    };
    expect(() =>
      calculateFoodPortionNutrition(invalidWeightServingFood, { servingId: 'srv_invalid' }),
    ).toThrow(InvalidPortionError);

    expect(() =>
      calculateFoodPortionNutrition(activeChickenFood, {
        servingId: 'srv_breast_half',
        quantity: -1,
      }),
    ).toThrow(InvalidPortionError);
  });

  it('rejects quantity when grams mode is used', () => {
    expect(() =>
      calculateFoodPortionNutrition(activeChickenFood, { grams: 100, quantity: 2 }),
    ).toThrow(InvalidPortionError);
  });

  it('rejects non-finite scaling and invalid nutrient records', () => {
    expect(() =>
      calculateFoodPortionNutrition(activeChickenFood, { grams: Number.MAX_VALUE }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      validateFoodDataInput({
        ...activeChickenFood,
        nutrients: [
          ...activeChickenFood.nutrients,
          { ...activeChickenFood.nutrients[0], amount_per_100g: 1 },
        ],
      }),
    ).toThrow(NutritionValidationError);
    expect(() =>
      validateFoodDataInput({
        ...activeChickenFood,
        nutrients: [{ ...activeChickenFood.nutrients[0], unit: 'stone' as never }],
      }),
    ).toThrow(NutritionValidationError);
  });

  it('keeps missing nutrient tracking per item occurrence when the same food repeats', () => {
    const first = calculateFoodPortionNutrition(activeChickenFood, { grams: 100 });
    const second = calculateFoodPortionNutrition(activeChickenFood, { grams: 250 });
    const result = aggregateNutrition([first, second]);
    expect(result.missingNutrients?.some((message) => message.includes('Sodium'))).toBe(false);
    expect(result.missingNutrients?.find((message) => message.includes('Dietary Fiber'))).toContain(
      '2 of 2',
    );
  });

  it('aggregates full precision before rounding the final public result', () => {
    const portions = Array.from({ length: 100 }, () =>
      calculateFoodPortionNutrition(activeRiceFood, { grams: 0.1 }),
    );
    const result = aggregateNutrition(portions);
    expect(result.totalPortionGrams).toBe(10);
    expect(result.totalEnergyKcal).toBe(13);
  });
});

describe('Nutrition Engine — Population, policy and runtime invariants', () => {
  it('applies adult age and sex micronutrient bands', () => {
    expect(getCalciumTargetMg('female', 50)).toBe(1000);
    expect(getCalciumTargetMg('female', 51)).toBe(1200);
    expect(getCalciumTargetMg('male', 70)).toBe(1000);
    expect(getCalciumTargetMg('male', 71)).toBe(1200);
    expect(getIronTargetMg('female', 50)).toBe(18);
    expect(getIronTargetMg('female', 51)).toBe(8);
    expect(getIronTargetMg('male', 71)).toBe(8);
    expect(getPotassiumAiMg('male')).toBe(3400);
    expect(getPotassiumAiMg('female')).toBe(2600);
  });

  it('rejects unsupported life stages and emits a versioned policy warning when floor applies', () => {
    expect(() =>
      calculateNutritionTargets({
        gender: 'female',
        age: 30,
        heightCm: 165,
        weightKg: 60,
        activityLevel: 'sedentary',
        dietGoal: 'maintenance',
        formula: 'mifflin_st_jeor',
        lifeStage: 'pregnant',
      }),
    ).toThrow(UnsupportedPopulationError);
    const target = calculateNutritionTargets({
      gender: 'male',
      age: 100,
      heightCm: 100,
      weightKg: 20,
      activityLevel: 'sedentary',
      dietGoal: 'weight_loss_aggressive',
      formula: 'mifflin_st_jeor',
    });
    expect(target.targetCalories).toBe(1000);
    expect(target.rawTargetCalories).toBeLessThan(1000);
    expect(target.policyVersion).toBe(NUTRIAI_PRODUCT_POLICY_VERSION);
    expect(target.warnings?.[0]).toContain('not a clinical safety guarantee');
  });

  it('validates finite outputs and supported nutrition input variants', () => {
    expect(() => validateCalculatedOutput({ value: Infinity })).toThrow(NutritionValidationError);
    expect(() => validateNutritionInput({ unknown: true })).toThrow(NutritionValidationError);
    expect(() => validateNutritionInput({ gender: 'male', formula: 'mifflin_st_jeor' })).toThrow(
      NutritionValidationError,
    );
    expect(() =>
      validateNutritionInput({ ...activeFoodForValidation, status: 'active' }),
    ).not.toThrow();
  });
});

const activeFoodForValidation: FoodDataInput = {
  id: 'validation-food',
  status: 'active',
  nutrients: [
    { nutrient_id: 'nut_energy', code: 'energy', unit: 'kcal', amount_per_100g: 100 },
    { nutrient_id: 'nut_protein', code: 'protein', unit: 'g', amount_per_100g: 10 },
    { nutrient_id: 'nut_carbohydrate', code: 'carbohydrate', unit: 'g', amount_per_100g: 10 },
    { nutrient_id: 'nut_fat_total', code: 'fat_total', unit: 'g', amount_per_100g: 1 },
  ],
};
