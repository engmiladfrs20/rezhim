# ADR 0017: Voice/Text Food Log Interpretation

## Status

Accepted — Phase 14

## Context

Users need a fast way to describe a meal by typing or by sending a speech-to-text transcript.
Natural language is ambiguous, and directly mutating the diary from a model response could create
incorrect health records. The interpretation step therefore needs a confirmation boundary.

## Decision

- Expose authenticated `POST /api/v1/ai/food-log` with a bounded transcript, RFC3339 calendar date,
  and locale.
- Send the transcript to the existing server-only Gemini text provider with a fixed instruction to
  extract only explicit foods, quantities, units, and meal context. Delimit transcript text as
  untrusted content.
- Return a confirmation-ready model response with date, locale, and an approximation disclaimer.
  Do not calculate nutrition, create foods, or write to the diary automatically.
- Map missing credentials and provider failures to the same stable AI errors as other AI routes.

## Consequences

Voice input can reuse the endpoint after a client-side speech-to-text step, while the user retains
control over every diary mutation. Structured extraction, food matching, and confirmation UI remain
separate concerns and can be added without bypassing the safety boundary.
