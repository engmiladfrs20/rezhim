export type Gender = 'male' | 'female';

export type ActivityLevel =
  'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';

export type DietGoal =
  | 'weight_loss_aggressive'
  | 'weight_loss_mild'
  | 'maintenance'
  | 'muscle_gain_mild'
  | 'muscle_gain_aggressive';

export type BMRFormula = 'mifflin_st_jeor' | 'harris_benedict' | 'katch_mcardle';

export interface UserBiometrics {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercentage?: number;
  activityLevel: ActivityLevel;
  dietGoal: DietGoal;
  formula: BMRFormula;
}

export interface MacronutrientTargets {
  proteinGrams: number;
  proteinCalories: number;
  proteinPercentage: number;
  fatGrams: number;
  fatCalories: number;
  fatPercentage: number;
  carbsGrams: number;
  carbsCalories: number;
  carbsPercentage: number;
}

export interface CalculatedNutritionTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  calorieDelta: number;
  macronutrients: MacronutrientTargets;
  micronutrients: {
    recommendedWaterMl: number;
    minimumFiberGrams: number;
    maximumSodiumMg: number;
    recommendedCalciumMg: number;
    recommendedIronMg: number;
    recommendedPotassiumMg: number;
  };
}
