# ADR 0013: Deterministic Food Substitution

## Status

Accepted — Phase 10

## Context

The diary and meal-plan flows need a safe way to suggest alternatives without silently
recommending draft foods or pretending that a heuristic is medical advice. A first release can
serve callers best with transparent nutrition similarity and no AI or random dependency.

## Decision

- Expose `POST /api/v1/substitutions` behind authentication.
- Require a reference portion and an explicit candidate list; every food is loaded through the
  provenance-checked `NutritionService`.
- Score energy, protein, carbohydrate, and fat density with fixed weights (45/25/15/15), break
  ties by canonical food ID, and scale each result to the reference energy with a 25–800 g bound.
- Return reasons and a versioned algorithm identifier so clients can explain and audit results.

## Consequences

Identical inputs produce identical rankings and no external model or network call is required.
The heuristic does not account for allergies, clinical conditions, taste, or cultural preferences;
those constraints remain explicit future work and the response is not medical advice.
