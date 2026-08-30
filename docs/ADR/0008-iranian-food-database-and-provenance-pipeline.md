# 0008: Food Catalog Provenance and Atomic D1 Ingestion

## Status

Accepted for Phase 5.

## Context

Nutrition data can be technically traceable yet scientifically misleading when a generic reference food is renamed as a culturally specific preparation. Dataset rights also differ: USDA FoodData Central records are public domain, while Iranian national composition tables may require a private license.

## Decision

1. The catalog separates food identity from nutrient provenance. A source record must describe the same food that the public name claims.
2. The committed baseline contains 10 exact generic USDA commodities as active records and 20 Iranian identities as drafts without nutrient or serving values.
3. Joojeh Kabab, Kabab Koobideh, Sabzi Khordan, Lahijan tea, and Bam Mazafati dates are not aliases for grilled chicken breast, a ground-beef patty, parsley, generic brewed black tea, or Deglet Noor dates.
4. Active publication requires four macros plus complete provenance on every nutrient and serving: source, external ID, URL, citation, version, method, retrieval time, and license.
5. New Admin records default to draft. The Admin UI preserves provenance on unchanged data and cannot promote an unverifiable record.
6. Dataset imports use exact raw-byte SHA-256 verification and a single D1 batch for all mutations and the success log. Identical records are skipped without writes.
7. The local CLI uses argument-array process execution and centralized SQL literal encoding. Production Worker paths use D1 prepared statements.
8. Restricted datasets require explicit licensed-local consent and an explicit development/test environment. CI, staging, and production always reject them.
9. Persian comparison normalization is used for alias-collision detection, including Arabic/Persian character variants, digits, diacritics, and ZWNJ handling.

## Consequences

- Public records remain traceable and semantically honest.
- Iranian foods can be curated before scientific data is available without exposing guessed nutrition values.
- Repeated imports are idempotent, failures roll back as a unit, and error responses do not leak SQL internals.
- Licensed national datasets remain outside git and outside remote automation.
