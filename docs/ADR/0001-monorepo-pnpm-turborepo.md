# ADR 0001: Monorepo Architecture with pnpm Workspaces and Turborepo

## Status

Accepted

## Context

NutriAI Persia is an ecosystem comprising a web user interface, an admin dashboard, a mobile client (Expo / React Native), serverless edge API workers (Cloudflare Workers), and asynchronous AI queue processors. Maintaining separate repositories would lead to duplicated type declarations, drifting schemas, decoupled localization keys, and complex cross-repo release management.

## Decision

Adopt a unified TypeScript Monorepo powered by:

1. **pnpm Workspaces**: Fast, deterministic package resolution using strict symlinking without phantom dependencies.
2. **Turborepo**: High-performance build caching and task orchestration across workspaces (`apps/*`, `workers/*`, `packages/*`).

## Consequences

- **Positive**: Strict compile-time boundary enforcement, shared Zod validation schemas (`@nutriai/schemas`), shared type declarations (`@nutriai/types`), and unified localization (`@nutriai/localization`).
- **Considerations**: Requires strict TypeScript configuration across browser, React Native, and Cloudflare Worker targets.
