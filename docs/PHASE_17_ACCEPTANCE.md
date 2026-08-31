# Phase 17 Acceptance — Deterministic Recipe Nutrition

## Scope

The phase adds an authenticated `POST /api/v1/recipes/calculate` boundary and a pure
recipe scaling function. It does not persist recipes, accept draft nutrition, or invent
values for undocumented ingredients.

## Acceptance criteria

- [x] Recipe ingredients are unique, positive measured gram portions.
- [x] Only active foods that pass the existing provenance/license checks are accepted.
- [x] Total, per-100-gram, and per-serving output is deterministic and versioned.
- [x] Yield and servings are validated at the shared Zod/API boundary.
- [x] Unauthenticated, missing, draft, and malformed inputs return stable 4xx responses.
- [x] No database writes occur during recipe calculation.

## Latest local measurement

The final uncached run passed 13 lint tasks, 21 typecheck tasks, 19 coverage tasks, and
13 build tasks. The Worker suite passed 105 tests across 13 files, including four recipe
integration tests; the Nutrition package passed 40 tests, including three pure scaling
tests. D1 migrations, the 30-item data validator, zero-mutation dry-run, critical audit,
mobile Expo config, and whitespace checks also passed. The online Expo Doctor schema
check remains environment-limited by an HTML response from the remote schema endpoint.
