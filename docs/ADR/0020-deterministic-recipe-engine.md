# ADR 0020: Deterministic Recipe Nutrition Engine

## Status

Accepted — Phase 17.

## Decision

Recipes are calculated as a stateless composition of active, provenance-verified food
portions. The API accepts unique food IDs and measured gram weights, then returns total,
per-100-gram, and per-serving breakdowns. The calculation uses the existing nutrition
aggregation engine and a versioned algorithm identifier (`recipe-nutrition-v1`).

Recipe yield may differ from raw ingredient weight to represent cooking loss or water
absorption, but no nutrient value is inferred. Draft, archived, missing, or
provenance-incomplete foods are rejected by the existing nutrition service. The first
iteration intentionally does not persist recipes or ingredient bytes in D1; persistence
and user-owned recipe management can be added after the calculation contract stabilizes.

## Consequences

Clients must provide measured ingredient weights and a positive final yield. Results are
reproducible for the same catalog revision and inputs, while provenance remains attached
to the underlying food records.
