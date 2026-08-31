# ADR 0012: Deterministic Meal Plan Engine

## Status

Accepted — Phase 9

## Context

Users need an explainable meal schedule derived from the Phase 6 nutrition targets and the
verified bilingual catalog. The first release must not silently use draft foods, unlicensed
nutrient data, or random recommendations.

## Decision

- Expose `POST /api/v1/meal-plans/generate` behind the existing authentication middleware.
- Require caller-selected active food IDs and load their 100 g nutrition through
  `NutritionService`, which performs the existing provenance and license checks.
- Generate four daily slots (breakfast, lunch, dinner, snack) using fixed calorie shares of
  25%, 35%, 30%, and 10%.
- Select foods in stable ID order and rotate them by day; calculate portions from energy density,
  with a documented 25–800 g safety bound.
- Keep the engine stateless. Plans are generated on demand and no user profile, food data, or
  recommendation history is persisted by this phase.

## Consequences

The same validated input always yields byte-for-byte equivalent JSON, which makes testing and
auditing straightforward. The output is a planning aid, not medical advice; future phases may
add preferences, substitutions, persistence, and clinician-reviewed constraints.
