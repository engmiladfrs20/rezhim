# ADR 0021: User-Owned Pantry, Fridge, and Shopping List

## Status

Accepted — Phase 18.

## Context

Users need a private inventory for food kept in a pantry, fridge, or freezer and a
shopping list for ingredients still required. These records must remain isolated per
user, reference the canonical food catalog, and never accept draft or archived foods.

## Decision

- Persist inventory in D1 tables `pantry_items` and `shopping_list_items` through
  repository classes with parameterized SQL.
- Expose authenticated CRUD endpoints under `/api/v1/pantry` and
  `/api/v1/shopping-list`.
- Validate input at the shared Zod boundary, including positive finite gram amounts,
  bounded notes, enumerated locations/statuses, and RFC3339 expiration timestamps.
- Enforce user ownership in every read, update, and delete query.
- Verify that every referenced food exists and has `status = active` before creating
  or changing an item. Nutrition and catalog records are not copied into inventory.
- Keep purchased quantity independent from required quantity so partial purchases can
  be represented deterministically.

## Consequences

The API is ready for web and mobile clients without exposing another user's inventory.
Foreign keys and indexes provide referential integrity and efficient user/filter
queries. Recipe and meal-plan features can consume these records in a later phase
without changing the ownership model.
