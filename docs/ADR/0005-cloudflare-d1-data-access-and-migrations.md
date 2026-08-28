# 5. Cloudflare D1 Data Access and Migrations

Date: 2026-08-28

## Status

Accepted

## Context

The NutriAI Persia monorepo leverages Cloudflare Workers as its primary edge API. We require a highly distributed, serverless relational database to map complex application state (such as tracking users, scanning histories, and application analytics). Cloudflare D1 provides native SQLite-based database access globally partitioned by Cloudflare's edge network. We must decide how to handle the integration layer, types boundaries, database schema migrations, and CI workflows to guarantee consistent and stable releases.

## Decision

We will integrate Cloudflare D1 natively through the `@cloudflare/workers-types` providing typed `D1Database` bindings inside our Hono Workers (`Env.DB`).

1. **Typing & Validation**: D1 interactions will be strictly typed and mapped across `@nutriai/types`. To reconcile mismatched underlying database implementations (e.g. SQLite returning `CURRENT_TIMESTAMP` as "YYYY-MM-DD HH:MM:SS" rather than Zod-compatible strict RFC3339 timestamps), we will wrap all edge results iteratively over isolated Zod schemas (`@nutriai/schemas`).
2. **Architecture**: Implement the Repository Pattern (e.g., `src/db/system.repository.ts`). Controllers/Handlers will never execute raw database statements. Instead, they interact efficiently through strongly typed functions enforcing safe parametric binding to prevent SQL injection.
3. **Migrations Workflow**: We will manage schema structure via pure native SQLite `.sql` files orchestrated through Wrangler `d1 migrations apply`. In Phase 2, `migrations_dir` is mapped securely under `./migrations` mapped locally with `--local`. Our continuous integration automates schemas application strictly to the test environment directly using native `cloudflare:test` abstractions exposing `applyD1Migrations()`.

## Consequences

- **Pros**:
  - Complete serverless scaling seamlessly matching deployment footprints natively.
  - Zero arbitrary middleware overheads leveraging pure SQLite bounds dynamically.
  - CI test assertions run explicitly mapping production equivalents effectively utilizing `D1Database` real local bound test databases via the native `@cloudflare/vitest-plugin` safely.
- **Cons**:
  - Restricts schema ORM adoptions due to rigid Cloudflare driver integration limits preventing native Prisma executions easily.
