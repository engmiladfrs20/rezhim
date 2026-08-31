# Phase 6 Acceptance Report — Deterministic Nutrition Engine

## Overview

Phase 6 implements a scientific, deterministic, type-safe, and AI-independent **Nutrition Engine** for NutriAI Persia. The engine computes Basal Metabolic Rate (BMR), Total Daily Energy Expenditure (TDEE), daily macronutrient and micronutrient targets, scaled single-item food portions, and composite meal nutrition aggregations.

## Summary of Completed Capabilities

### 1. Pure Domain Engine (`@nutriai/nutrition`)

- Located at `packages/nutrition`.
- Zero external runtime dependencies on Cloudflare, SQLite/D1, React, or network APIs.
- Pure calculation functions:
  - `calculateBmr(input: BmrCalculationInput): number`
  - `calculateTdee(input: TdeeCalculationInput): number`
  - `calculateNutritionTargets(input: UserBiometrics): CalculatedNutritionTargets`
  - `calculateFoodPortionNutrition(food: FoodDataInput, portion: FoodPortionCalculationInput): FoodPortionNutrition`
  - `aggregateNutrition(items: FoodPortionNutrition[]): AggregatedNutritionResult`
  - `validateBmrInput(input: BmrCalculationInput): void`
  - `validateBiometricsInput(input: UserBiometrics): void`

### 2. Scientific Formula Verification

- **Mifflin-St Jeor (1990)**:
  - Male: `10W + 6.25H - 5A + 5`
  - Female: `10W + 6.25H - 5A - 161`
- **Harris-Benedict Revised (Roza & Shizgal 1984)**:
  - Male: `88.362 + 13.397W + 4.799H - 5.677A`
  - Female: `447.593 + 9.247W + 3.098H - 4.330A`
- **Katch-McArdle (1996)**:
  - `LBM = weightKg × (1 - bodyFatPercentage / 100)`
  - `BMR = 370 + 21.6 × LBM`
  - Strict failure (`FormulaPrerequisiteError`) if `bodyFatPercentage` is missing. Zero silent fallback.

### 3. Physical Activity Multipliers & Diet Goal Policies

- **Activity Multipliers**:
  - `sedentary: 1.2`
  - `lightly_active: 1.375`
  - `moderately_active: 1.55`
  - `very_active: 1.725`
  - `extra_active: 1.9`
- **Calorie Deltas**:
  - `weight_loss_aggressive`: `-500 kcal`
  - `weight_loss_mild`: `-300 kcal`
  - `maintenance`: `0 kcal`
  - `muscle_gain_mild`: `+300 kcal`
  - `muscle_gain_aggressive`: `+500 kcal`
- **Macronutrient Distributions**:
  - Protein: `4 kcal/g`, Carbs: `4 kcal/g`, Fat: `9 kcal/g`
  - Exact 100% macro percentage sum guaranteed across all goals.
  - Rounding performed strictly at the output boundary.

### 4. Evidence-Based Micronutrient Guidelines

- Water: `35 ml/kg`
- Fiber: Minimum `14 g / 1000 kcal`
- Sodium: Maximum `2300 mg`
- Calcium: `1000 mg`
- Iron: `8 mg` (male) / `18 mg` (female pre-menopausal)
- Potassium: `3400 mg` (male) / `2600 mg` (female)

### 5. Food Portion Nutrition & Aggregation

- Per 100g database scaling by grams or serving and quantity.
- Strictly restricted to `active` foods with verified provenance.
- Rejects `draft` and `archived` foods.
- Checks Atwater 4/4/9 calorie consistency against reported energy.
- Reports missing optional micronutrients transparently.

### 6. Authenticated Stateless API Endpoints (`workers/api`)

- `POST /api/v1/nutrition/targets`: Calculates user targets.
- `POST /api/v1/nutrition/aggregate`: Aggregates nutrition across active food items.
- Protected by JWT Bearer and HttpOnly Cookie session authentication.
- Stateless with zero database writes.

## Test Matrix and Execution Results

| Test Suite                 | Tests |  Status   | Scope                                                                                     |
| :------------------------- | :---: | :-------: | :---------------------------------------------------------------------------------------- |
| `@nutriai/nutrition`       |  23   | ✅ PASSED | All BMR formulas, TDEE, all goals, edge cases, portion calculation, aggregation           |
| `workers/api` (All suites) |  78   | ✅ PASSED | Authentication, PBKDF2, Foods, Categories, Nutrients, Provenance Ingestion, Nutrition API |
| Total Tests                |  101  | ✅ PASSED | 100% passing across monorepo                                                              |

## Monorepo Quality Gates

All quality gates executed uncached:

1. `pnpm install --frozen-lockfile`: Clean
2. `pnpm format:check`: Passed
3. `pnpm exec turbo run lint --force`: Passed
4. `pnpm exec turbo run typecheck --force`: Passed
5. `pnpm data:validate`: Passed (30 valid catalog items)
6. `pnpm exec turbo run test:coverage --force`: Passed (All packages)
7. `pnpm exec turbo run build --force`: Passed (All packages and apps)
8. `pnpm audit --prod --audit-level=critical`: 0 critical vulnerabilities
9. `npx expo-doctor@latest`: Passed
10. `git diff --check`: Passed
