# Phase 6 Acceptance Report — Deterministic Nutrition Engine

## Overview

Phase 6 implements a deterministic, type-safe, AI-independent **Nutrition Engine** for NutriAI Persia. It computes BMR, TDEE, product-policy calorie/macronutrient targets, adult reference micronutrients, scaled portions, and composite meal aggregations. Outputs are estimates and are not medical advice.

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
  - `validateNutritionInput(input: unknown): void`

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

- **Activity Multipliers (NutriAI Product Policy v2026.1)**:
  - `sedentary: 1.2`
  - `lightly_active: 1.375`
  - `moderately_active: 1.55`
  - `very_active: 1.725`
  - `extra_active: 1.9`
- **Calorie Deltas (NutriAI Product Policy v2026.1)**:
  - `weight_loss_aggressive`: `-500 kcal`
  - `weight_loss_mild`: `-300 kcal`
  - `maintenance`: `0 kcal`
  - `muscle_gain_mild`: `+300 kcal`
  - `muscle_gain_aggressive`: `+500 kcal`
- **Macronutrient Distributions**:
  - Protein: `4 kcal/g`, Carbs: `4 kcal/g`, Fat: `9 kcal/g`
  - Exact 100% macro percentage sum guaranteed across all goals.
  - Rounding performed strictly at the output boundary.

### 4. Adult Reference Micronutrient Guidelines

- Supported population: nonpregnant, nonlactating adults aged 19–120.
- Water: product reference `35 ml/kg`.
- Fiber: AI `14 g / 1000 kcal`.
- Sodium: CDRR reference `2300 mg`.
- Calcium: adult age/sex bands (1000/1200 mg).
- Iron: adult age/sex bands (8/18 mg).
- Potassium: AI, not RDA; 3400 mg for men and 2600 mg for women.
- Children, adolescents, pregnancy and lactation are rejected explicitly.

### 5. Food Portion Nutrition & Aggregation

- Per 100g database scaling by grams or serving and quantity.
- Strictly restricted to `active` foods whose every used nutrient and selected serving has complete provenance and a present, publicly usable source.
- Rejects `draft` and `archived` foods.
- Checks Atwater 4/4/9 calorie consistency against reported energy.
- Reports missing optional micronutrients transparently.

### 6. Authenticated Stateless API Endpoints (`workers/api`)

- `POST /api/v1/nutrition/targets`: Calculates user targets.
- `POST /api/v1/nutrition/aggregate`: Aggregates nutrition across active food items.
- Protected by JWT Bearer and HttpOnly Cookie session authentication.
- Stateless with zero database writes.

## Test Matrix and Execution Results

| Test Suite                 | Tests |  Status   | Scope                                                                         |
| :------------------------- | :---: | :-------: | :---------------------------------------------------------------------------- |
| `@nutriai/nutrition`       |  30   | ✅ PASSED | Formulas, adult policy bands, validation, precision, portions and aggregation |
| `workers/api` (All suites) |  79   | ✅ PASSED | Authentication, PBKDF2, catalog, provenance ingestion and Nutrition API       |
| `@nutriai/schemas`         |   9   | ✅ PASSED | Nutrition target and portion schema boundaries                                |
| Other workspaces           |  92   | ✅ PASSED | Existing package/application suites                                           |
| Total Tests                |  210  | ✅ PASSED | 100% passing across monorepo                                                  |

Coverage from the uncached run: `@nutriai/nutrition` statements 90.11%, branches 85.79%, functions 97.22%, lines 90.05%; `workers/api` statements 75.09%, branches 58.67%, functions 84.93%, lines 76.75%.

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
9. `npx expo config --json`: Passed. `npx expo-doctor@latest` reached 17 checks but its remote Expo schema check returned HTML instead of JSON in this local environment; this is an external tooling/network failure, not a project validation failure.
10. `git diff --check`: Passed

The nutrition package enforces uncached coverage thresholds of 90% statements, 90% lines, 85% branches and 95% functions. Precision is retained internally and rounded only at the final result boundary; nutrient output ordering is canonical by nutrient ID.
