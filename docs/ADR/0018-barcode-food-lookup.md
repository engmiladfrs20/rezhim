# ADR 0018: Barcode Food Lookup Boundary

## Status

Accepted — Phase 15

## Context

Barcode scanning is a deterministic lookup problem and should not depend on an AI guess. The
catalog already stores canonical 8–18 digit barcodes, while mobile cameras and Persian keyboards can
produce localized digits and formatting separators.

## Decision

- Expose authenticated `GET /api/v1/foods/barcode/:barcode` with an optional `locale` query.
- Normalize Persian and Arabic digits and remove supported separators before validating the canonical
  8–18 digit form.
- Look up the canonical value in D1 and return only `active` food details through the existing
  provenance-aware mapper. Draft and archived foods remain unavailable to public clients.
- Return `400 VALIDATION_ERROR` for malformed values and `404 FOOD_NOT_FOUND` for valid but unknown or
  unpublished values. Do not infer a product, nutrition value, or brand from a barcode.

## Consequences

Clients receive a stable, locale-aware catalog result without model hallucination. External barcode
databases, camera permissions, and nutrition-label OCR remain separate integrations that must pass
their own provenance and confirmation checks.
