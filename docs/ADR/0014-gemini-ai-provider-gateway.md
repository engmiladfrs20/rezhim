# ADR 0014: Gemini AI Provider Gateway

## Status

Accepted — Phase 11

## Context

AI capabilities will eventually support coaching and multimodal jobs. Calling a provider directly
from web or mobile would expose credentials, couple clients to one vendor, and make outages hard
to control. The first integration therefore needs a server-side, typed boundary.

## Decision

- Keep provider contracts in the platform-independent `@nutriai/ai` package.
- Use a server-only `GeminiProvider` with API key, model, endpoint, prompt-size, output-token, and
  temperature bounds.
- Expose `POST /api/v1/ai/generate` only through authenticated Worker API requests; return 503 when
  `GEMINI_API_KEY` is absent and never log or return the key.
- Keep the provider response minimal (`provider`, `model`, `text`) and map upstream/network errors
  to a stable `AI_PROVIDER_ERROR` response.
- Keep asynchronous queue work behind the existing typed Cloudflare Queue binding; coaching,
  image recognition, and persistence are separate phases.

## Consequences

Clients cannot accidentally ship a Gemini secret, and provider replacement remains localized. The
gateway is intentionally not a medical advisor and does not yet add prompts, personal health
profiles, image analysis, or background job persistence.
