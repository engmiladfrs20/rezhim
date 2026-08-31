# ADR 0009: Deterministic Nutrition Engine Architecture and Provenance-Driven Calculations

## Status

Accepted

## Context

NutriAI Persia requires a deterministic and type-safe calculation engine to compute estimated energy requirements, explicit product-policy targets, adult reference micronutrients, and composite meal nutrition aggregations. The engine is not a clinical decision tool and never substitutes for a qualified clinician.

Phase 6 requires a pure, testable domain engine decoupled from Cloudflare Workers, D1, React, or network layers, capable of:

1. Calculating Basal Metabolic Rate (BMR) using three established scientific formulas:
   - Mifflin-St Jeor (1990)
   - Harris-Benedict Revised (Roza & Shizgal 1984)
   - Katch-McArdle (1996)
2. Computing Total Daily Energy Expenditure (TDEE) via standardized Physical Activity Level (PAL) multipliers.
3. Calculating daily calorie targets and macronutrient distributions (protein, carbohydrates, total fat) based on explicit dietary goals.
4. Generating evidence-based micronutrient and fluid guidelines (water, fiber, sodium, calcium, iron, potassium).
5. Calculating nutrition for food portions scaled from the 100g database convention by grams or serving units.
6. Aggregating nutrition across multiple food items while maintaining strict provenance guarantees and reporting missing data transparently.
7. Exposing authenticated, stateless REST API endpoints in Cloudflare Workers.

The supported target population in this phase is nonpregnant, nonlactating adults aged 19–120. Children, adolescents, pregnancy and lactation are rejected until dedicated reference tables are implemented.

## Decision

### 1. Package Architecture and Isolation

We created the `@nutriai/nutrition` workspace package located at `packages/nutrition`.

- **Pure Functions**: Zero runtime dependencies on Cloudflare, SQLite/D1, React, or browser APIs.
- **Strict Typing**: Powered by `@nutriai/types` interfaces.
- **Fail-Fast Validation**: Direct validation via `validateBmrInput`, `validateBiometricsInput`, and Zod schemas in `@nutriai/schemas`.

### 2. Scientific BMR Formulas and Prerequisites

- **Mifflin-St Jeor (1990)**:
  - Male: `10 × weight(kg) + 6.25 × height(cm) - 5 × age(y) + 5`
  - Female: `10 × weight(kg) + 6.25 × height(cm) - 5 × age(y) - 161`
  - _Reference_: Mifflin MD, St Jeor ST, Hill JO, et al. _A new predictive equation for resting energy expenditure in healthy individuals._ Am J Clin Nutr. 1990;51(2):241-247.

- **Harris-Benedict Revised (Roza & Shizgal 1984)**:
  - Male: `88.362 + 13.397 × weight(kg) + 4.799 × height(cm) - 5.677 × age(y)`
  - Female: `447.593 + 9.247 × weight(kg) + 3.098 × height(cm) - 4.330 × age(y)`
  - _Reference_: Roza AM, Shizgal HM. _The Harris Benedict equation reevaluated: resting energy requirements and the body cell mass._ Am J Clin Nutr. 1984;40(1):168-182.

- **Katch-McArdle (1996)**:
  - `Lean Body Mass (LBM) = weight(kg) × (1 - bodyFatPercentage / 100)`
  - `BMR = 370 + 21.6 × LBM`
  - _Reference_: McArdle WD, Katch FI, Katch VL. _Exercise Physiology: Energy, Nutrition, and Human Performance._ 4th ed. 1996.
  - **Zero Silent Fallback**: If `formula === 'katch_mcardle'` and `bodyFatPercentage` is omitted or null, the engine strictly throws `FormulaPrerequisiteError` (400 VALIDATION_ERROR at API boundary).

### 3. Physical Activity Multipliers

Multipliers are versioned NutriAI product-policy values (v2026.1), informed by energy-requirement literature but not asserted to be the exact FAO PAL categories:

- `sedentary`: `1.2` (desk work, little to no exercise)
- `lightly_active`: `1.375` (light exercise 1–3 days/week)
- `moderately_active`: `1.55` (moderate exercise 3–5 days/week)
- `very_active`: `1.725` (hard exercise 6–7 days/week)
- `extra_active`: `1.9` (heavy physical work or 2x/day training)

`TDEE = BMR × activityFactor`

### 4. Calorie Deltas and Goal Policies

Explicit calorie delta constants are defined in `DIET_GOAL_CALORIE_DELTAS`:

- `weight_loss_aggressive`: `-500 kcal/day` (~0.5 kg fat loss/week)
- `weight_loss_mild`: `-300 kcal/day` (~0.3 kg fat loss/week)
- `maintenance`: `0 kcal/day`
- `muscle_gain_mild`: `+300 kcal/day` (~0.3 kg lean gain/week)
- `muscle_gain_aggressive`: `+500 kcal/day` (~0.5 kg gain/week)

The `1,000 kcal/day` lower bound is a product-policy floor, not a physiological or clinical safety guarantee. When applied, the response includes `rawTargetCalories`, `policyVersion` and a warning. `calorieDelta = targetCalories - roundedTdee`.

### 5. Macronutrient Distributions and Rounding Invariants

- **Standard Energy Conversions (Atwater General Factors)**:
  - Protein: `4 kcal/g`
  - Carbohydrates: `4 kcal/g`
  - Total Fat: `9 kcal/g`

- **Macronutrient Percentage Splits (Protein% / Carbs% / Fat%)**:
  - `weight_loss_aggressive`: 35% / 35% / 30% (Sum: 100%)
  - `weight_loss_mild`: 30% / 40% / 30% (Sum: 100%)
  - `maintenance`: 25% / 50% / 25% (Sum: 100%)
  - `muscle_gain_mild`: 30% / 45% / 25% (Sum: 100%)
  - `muscle_gain_aggressive`: 30% / 50% / 20% (Sum: 100%)

- **Rounding Rules**:
  - Internal calculations maintain full IEEE 754 floating point precision.
  - Final metrics are rounded at the output boundary.
  - Aggregations retain unrounded internal values and use a canonical nutrient-ID sort before final rounding.
  - Percentage invariant: `proteinPercentage + carbsPercentage + fatPercentage === 100` strictly guaranteed.

### 6. Adult Reference Micronutrient Guidelines

Reference values are drawn from the cited NIH Office of Dietary Supplements and National Academies tables; hydration, fiber and product-policy values are explicitly labeled as references or policy rather than clinical prescriptions:

- **Hydration**: `35 ml/kg` of body weight.
- **Dietary Fiber**: `14 g per 1,000 kcal` intake (IOM DRI standard).
- **Sodium**: Maximum `2,300 mg/day` (AHA / Dietary Guidelines for Americans).
- **Calcium**: Adult age/sex-banded RDA (1,000 or 1,200 mg/day).
- **Iron**: Adult age/sex-banded RDA (8 or 18 mg/day).
- **Potassium**: Gender-differentiated Adequate Intake (AI), not RDA (3,400 mg/day for men, 2,600 mg/day for women; NASEM 2019).

### 7. Food Nutrition Calculation and Aggregation

All nutrient values in the catalog are stored per 100 grams.

- **Portion by Grams**: `nutrientAmount = amountPer100g × grams / 100`
- **Portion by Serving**: `nutrientAmount = amountPer100g × serving.weight_g × quantity / 100`
- **Data Gate**: Only `active` foods with complete provenance on every used nutrient and selected serving are permitted. Every provenance source must exist and have a publicly usable license. Requests referencing `draft`, `archived`, incomplete or restricted data are rejected with a stable 400 error.
- **4/4/9 Consistency Check**: If reported energy diverges from macro calculation by >20 kcal and >15%, a non-blocking `warnings` flag is emitted for transparency.
- **Missing Nutrient Transparency**: If optional micronutrients (fiber, sodium, potassium, calcium, iron, vitamins) are not reported in any aggregated items, they are explicitly listed in `missingNutrients` rather than silently zeroed.

### 8. Stateless API Endpoints in Cloudflare Workers

Two authenticated REST endpoints in `workers/api`:

- `POST /api/v1/nutrition/targets`: Computes daily BMR, TDEE, calorie target, and macro/micro targets.
- `POST /api/v1/nutrition/aggregate`: Aggregates nutrition across a list of portion specifications using active D1 catalog items.
- **Security**: Authenticated via existing JWT bearer token or HttpOnly cookie with CSRF validation. Zero database writes (100% stateless).

### 9. Medical and Health Disclaimer

All outputs from `@nutriai/nutrition` and `/api/v1/nutrition/*` represent mathematical estimates and nutritional guidelines for product features. They do not constitute personalized medical advice, diagnostic evaluations, or clinical dietetic prescriptions.

## Consequences

- Completely modular and reusable nutrition engine across Cloudflare Workers, mobile app, and background jobs.
- 100% deterministic and testable with zero reliance on AI models for core mathematics.
- Strict data provenance and transparency around missing nutritional data.
