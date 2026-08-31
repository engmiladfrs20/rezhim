# ADR 0016: Photo Food Recognition Boundary

## Status

Accepted — Phase 13

## Context

Photo-based food recognition is inherently probabilistic and can expose sensitive user content.
The application needs a narrow multimodal boundary before adding storage, nutrition estimation, or
automatic diary writes. Provider credentials must remain server-side, image sizes must be bounded,
and the result must not be presented as medical or scientific fact.

## Decision

- Expose an authenticated `POST /api/v1/ai/food-recognition` endpoint that accepts only a bounded
  base64 JPEG, PNG, or WebP image and an optional bounded clarification prompt.
- Validate the MIME type and base64 syntax at the API boundary; reject payloads larger than 3 MB
  before contacting the provider.
- Send image bytes as Gemini inline data through the server-only `AiProvider.generateVision` method.
  Do not persist the image, prompt, or response and never return provider credentials.
- Delimit the optional clarification as untrusted text and apply a fixed system safety instruction.
  The provider may identify visible foods and uncertainty only; it may not diagnose, prescribe, or
  invent nutrition values.
- Return the provider's text with locale and an explicit approximation disclaimer. No automatic
  food creation, nutrition calculation, or diary mutation occurs in this phase.

## Consequences

The endpoint provides a privacy-bounded foundation for future recognition UX while keeping model
uncertainty visible and preventing unverified nutrition data from entering the catalog or diary.
Storage, structured candidate extraction, and human confirmation remain separate follow-up work.
