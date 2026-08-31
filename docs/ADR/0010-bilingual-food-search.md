# 0010: Deterministic Bilingual Food Search

## Status

Accepted (Phase 7)

## Context

The public and administrative food lists already supported category filters and stable cursors, but users could not find foods by Persian names, English names, aliases, or barcodes. Persian text also has equivalent Arabic letter forms, optional diacritics, zero-width joiners, and localized digits that must not produce different search results.

## Decision

- Accept a bounded `q` query parameter (1–100 characters) on public and admin food list endpoints.
- Normalize query and write-time names/aliases with `normalizePersianForComparison` from `@nutriai/localization`.
- Persist canonical `search_text` values on translations and aliases, with indexes in migration `0008_food_search.sql`.
- Match every query token against food names, aliases, brand names, or canonical barcodes. Public search remains limited to `status = 'active'`; admin search preserves its status filter.
- Keep the existing versioned cursor ordering (`created_at DESC, id DESC`) so filtering cannot create duplicate or unstable pages.
- Treat search as a discovery aid, not a ranking or medical recommendation. SQL remains parameterized for every user-provided token.

## Consequences

- Persian variants such as `كته`, `کته`, and diacritic/spacing variants resolve to the same canonical search form.
- Imported and admin-created records are searchable immediately; existing records are backfilled by the migration.
- Search scans only the bounded token set and indexed canonical columns, while the existing lifecycle and authorization boundaries remain unchanged.
