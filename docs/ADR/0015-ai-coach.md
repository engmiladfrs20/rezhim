# ADR 0015: AI Coach with Diary Context

## Status

Accepted — Phase 12

## Context

The provider gateway from Phase 11 is intentionally generic. A useful coaching endpoint needs
limited daily context, but must not turn the model into a medical decision-maker or trust client-
calculated nutrition values. The endpoint also has to preserve the provider boundary and fail closed
when no server credential is configured.

## Decision

- Add an authenticated `POST /api/v1/ai/coach` route in the Worker API.
- Accept a bounded question, an RFC3339 calendar date, locale, and validated biometric inputs.
- Load the authenticated user's diary summary for that date from D1. Calculate daily targets on the
  server with `@nutriai/nutrition`; never accept calculated targets from the client.
- Build a deterministic prompt containing only date, locale, daily macro/calorie targets, and diary
  totals. Delimit the question as untrusted content and use a fixed safety instruction that prohibits
  diagnosis, treatment, or promises of outcomes.
- Return the provider response with the date and a clear educational disclaimer. Keep credentials,
  prompts, and responses out of logs and persistence.
- Map an absent Gemini key to `503 AI_UNAVAILABLE`, upstream failures to `502 AI_PROVIDER_ERROR`,
  and invalid nutrition prerequisites to a stable `400 VALIDATION_ERROR`.

## Consequences

The coach can answer practical questions using current daily totals while retaining the same typed,
server-only provider boundary as the generic gateway. Responses remain educational and are not a
substitute for clinical care. Future phases may add response persistence, streaming, or multimodal
inputs only behind separate contracts and privacy review.
