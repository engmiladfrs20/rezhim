import type { NutrientUnit } from './food';
import type { SupportedLocale } from './localization';

export type Gender = 'male' | 'female';

export type LifeStage = 'adult_non_pregnant_non_lactating' | 'pregnant' | 'lactating';

export type ActivityLevel =
  'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';

export type DietGoal =
  | 'weight_loss_aggressive'
  | 'weight_loss_mild'
  | 'maintenance'
  | 'muscle_gain_mild'
  | 'muscle_gain_aggressive';

export type BMRFormula = 'mifflin_st_jeor' | 'harris_benedict' | 'katch_mcardle';

export interface BmrCalculationInput {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercentage?: number | undefined;
  lifeStage?: LifeStage | undefined;
  formula: BMRFormula;
}

export interface TdeeCalculationInput {
  bmr: number;
  activityLevel: ActivityLevel;
}

export interface UserBiometrics {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercentage?: number | undefined;
  lifeStage?: LifeStage | undefined;
  activityLevel: ActivityLevel;
  dietGoal: DietGoal;
  formula: BMRFormula;
}

export type NutritionTargetsInput = UserBiometrics;

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

export interface MicronutrientTargets {
  recommendedWaterMl: number;
  minimumFiberGrams: number;
  maximumSodiumMg: number;
  recommendedCalciumMg: number;
  recommendedIronMg: number;
  recommendedPotassiumMg: number;
}

export interface CalculatedNutritionTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  rawTargetCalories?: number | undefined;
  calorieDelta: number;
  macronutrients: MacronutrientTargets;
  micronutrients: MicronutrientTargets;
  policyVersion?: string | undefined;
  warnings?: string[] | undefined;
}

export interface NutritionAggregateItemInput {
  foodId: string;
  grams?: number | undefined;
  servingId?: string | undefined;
  quantity?: number | undefined;
}

export interface NutritionAggregateRequest {
  items: NutritionAggregateItemInput[];
}

export interface AggregatedNutrientValue {
  nutrientId: string;
  code: string;
  nameFa: string;
  nameEn: string;
  unit: NutrientUnit;
  amount: number;
}

export interface FoodPortionServingDetail {
  id: string;
  nameFa: string;
  nameEn: string;
  weightG: number;
  quantity: number;
}

export interface FoodPortionNutrition {
  foodId: string;
  foodNameFa: string;
  foodNameEn: string;
  portionGrams: number;
  serving?: FoodPortionServingDetail | null | undefined;
  nutrients: AggregatedNutrientValue[];
  energyKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  warnings?: string[] | undefined;
}

export interface AggregatedNutritionResult {
  totalPortionGrams: number;
  totalEnergyKcal: number;
  totalProteinGrams: number;
  totalCarbsGrams: number;
  totalFatGrams: number;
  nutrients: AggregatedNutrientValue[];
  items: FoodPortionNutrition[];
  missingNutrients?: string[] | undefined;
  warnings?: string[] | undefined;
}

export interface RecipeIngredientInput {
  foodId: string;
  grams: number;
}

export interface RecipeNutritionBreakdown {
  portionGrams: number;
  energyKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  nutrients: AggregatedNutrientValue[];
  missingNutrients?: string[] | undefined;
  warnings?: string[] | undefined;
}

export interface RecipeNutritionResult {
  algorithmVersion: string;
  yieldGrams: number;
  servings: number;
  ingredients: FoodPortionNutrition[];
  total: RecipeNutritionBreakdown;
  per100g: RecipeNutritionBreakdown;
  perServing: RecipeNutritionBreakdown;
}

export type PantryLocation = 'pantry' | 'fridge' | 'freezer';

export interface PantryItem {
  id: string;
  userId: string;
  foodId: string;
  location: PantryLocation;
  quantityGrams: number;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ShoppingListStatus = 'planned' | 'purchased';

export interface ShoppingListItem {
  id: string;
  userId: string;
  foodId: string;
  requiredGrams: number;
  purchasedGrams: number;
  status: ShoppingListStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DiaryMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodDiaryEntry {
  id: string;
  userId: string;
  foodId: string;
  servingId: string | null;
  grams: number | null;
  quantity: number;
  mealType: DiaryMealType;
  consumedAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FoodDiaryEntryWithNutrition extends FoodDiaryEntry {
  nutrition: FoodPortionNutrition;
}

export interface DailyDiarySummary {
  date: string;
  entries: FoodDiaryEntryWithNutrition[];
  nutrition: AggregatedNutritionResult;
}

export interface WeightEntry {
  id: string;
  userId: string;
  weightKg: number;
  measuredAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeightTrend {
  entries: WeightEntry[];
  firstWeightKg: number | null;
  latestWeightKg: number | null;
  changeKg: number | null;
  changePercent: number | null;
  lowestWeightKg: number | null;
  highestWeightKg: number | null;
}

export type FastingSessionStatus = 'active' | 'completed';

export interface WaterIntake {
  id: string;
  userId: string;
  amountMl: number;
  consumedAt: string;
  createdAt: string;
}

export interface FastingSession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  goalHours: number;
  status: FastingSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLog {
  id: string;
  userId: string;
  habitKey: string;
  occurredOn: string;
  completed: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLifestyleSummary {
  date: string;
  waterTotalMl: number;
  waterEntries: WaterIntake[];
  activeFast: FastingSession | null;
  fastingSessions: FastingSession[];
  habits: HabitLog[];
}

export type SubscriptionPlan = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due';

export interface UserSubscription {
  id: string | null;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface AdminAnalyticsOverview {
  users: { total: number; active: number; disabled: number; newSince: number };
  foods: { total: number; active: number; draft: number };
  diary: { entries: number; entriesSince: number };
}

export interface MealPlanGenerationInput {
  targets: CalculatedNutritionTargets;
  candidates: FoodPortionNutrition[];
  days: number;
  locale?: SupportedLocale | undefined;
}

export interface MealPlanMeal {
  mealType: DiaryMealType;
  targetCalories: number;
  nutrition: AggregatedNutritionResult;
}

export interface MealPlanDay {
  day: number;
  meals: MealPlanMeal[];
  nutrition: AggregatedNutritionResult;
}

export interface GeneratedMealPlan {
  algorithmVersion: string;
  requestedLocale: SupportedLocale;
  days: MealPlanDay[];
  targetCaloriesPerDay: number;
  candidateFoodIds: string[];
}

export interface FoodSubstitutionRecommendation {
  food: FoodPortionNutrition;
  similarityScore: number;
  reasons: string[];
}

export interface FoodSubstitutionResult {
  algorithmVersion: string;
  reference: FoodPortionNutrition;
  recommendations: FoodSubstitutionRecommendation[];
}

export interface AiGenerationRequest {
  prompt: string;
  systemInstruction?: string | undefined;
  maxOutputTokens?: number | undefined;
  temperature?: number | undefined;
}

export type AiImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface AiVisionRequest extends AiGenerationRequest {
  imageBase64: string;
  mimeType: AiImageMimeType;
}

export interface AiGenerationResponse {
  provider: 'gemini';
  model: string;
  text: string;
}

export interface AiCoachResponse extends AiGenerationResponse {
  disclaimer: string;
  date: string;
}

export interface AiFoodRecognitionResponse extends AiGenerationResponse {
  disclaimer: string;
  locale: SupportedLocale;
}

export interface AiFoodLogResponse extends AiGenerationResponse {
  disclaimer: string;
  date: string;
  locale: SupportedLocale;
}
