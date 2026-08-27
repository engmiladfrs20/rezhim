# ADR 0002: Cloudflare Workers & Hono Web Framework

## Status

Accepted

## Context

Traditional persistent Node.js servers (e.g., Express) introduce regional latency, high idle resource costs, and complex container orchestration. NutriAI Persia requires ultra-low-latency edge responses across distributed geographic users and seamless integration with Cloudflare D1, KV, and Queues.

## Decision

- Replace Node/Express servers with **Cloudflare Workers** utilizing the **Hono** web framework.
- Export standard Web `fetch` handlers (`export default { fetch: app.fetch }`) without binding long-running Node TCP listeners.
- Utilize Hono's lightweight router, built-in security middleware, and zero-overhead JSON serialization.

## Consequences

- **Positive**: Sub-millisecond cold starts, zero idle server cost, standard Web APIs (`Request`, `Response`, `Uint8Array`, `crypto.randomUUID()`), native compatibility with Cloudflare ecosystem bindings.
- **Negative**: Strict prohibition against Node.js runtime primitives (`Buffer`, `fs`, `http.createServer`).
