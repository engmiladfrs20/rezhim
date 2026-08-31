# 0011: User-Owned Food Diary Entries

## Status

Accepted (Phase 8)

## Context

The nutrition engine can calculate a meal, but users need a durable, private record of what they consumed. Diary records must be scoped to the authenticated user, preserve the original consumed time, and reuse the same deterministic portion and provenance rules as the calculator.

## Decision

- Store diary entries in D1 with `user_id`, `food_id`, optional `serving_id`, or explicit positive `grams`; a database check requires at least one portion mode.
- Use UTC RFC3339 timestamps and a bounded meal type (`breakfast`, `lunch`, `dinner`, `snack`).
- Keep entries user-owned with `ON DELETE CASCADE` for account deletion and parameterized queries for every lookup/update/delete.
- Validate and calculate nutrition before writing an entry. Daily reads recalculate through `NutritionService`, so draft/archived or incomplete-provenance foods fail closed rather than returning unsafe estimates.
- List by a validated UTC calendar date and return both per-entry nutrition and a deterministic daily aggregate.
- Permit partial metadata edits; switching portion modes requires explicitly clearing the previous mode (`serving_id: null` or `grams: null`).

## Consequences

- A user cannot read, edit, or delete another user's entry, even when an ID is known.
- Diary totals remain consistent with the canonical active food catalog and Phase 6 Atwater/provenance checks.
- Nutrition is recalculated on read rather than stored as an untrusted snapshot; future catalog corrections are therefore visible in the diary.
