# Mano Backend

See root CLAUDE.md for coding conventions.

## Tech Stack

- Hono + Node.js + Vite (via @hono/vite-build and @hono/vite-dev-server)
- PostgreSQL + Drizzle ORM
- Depends on `@mano/agent` workspace package

## Commands

- `pnpm --filter @mano/backend dev` — dev server on port 3000
- `pnpm --filter @mano/backend build && pnpm --filter @mano/backend start` — build and run production
- `pnpm vitest run apps/backend/src/path.test.ts` — run a single test
- `pnpm --filter @mano/backend drizzle-kit generate` — generate migration from schema changes
- `pnpm --filter @mano/backend drizzle-kit migrate` — apply migrations

## Architecture

No Rails-like layers (no controllers/services/repositories). Feature-based modules:

- `src/app.ts` — Hono app setup, middleware, route mounting
- `src/index.ts` — Server entry point (port 3000), DB initialization
- `src/env.ts` — Environment variable validation (Zod). Use `getEnv()` (lazy).
- `src/routes/` — Hono route handlers with inline business logic. One file per feature.
- `src/db/schema.ts` — Drizzle schema (all tables).
- `src/db/queries/` — Shared DB query functions. Plain functions taking `db` as first arg.
- `src/middleware/` — Auth (JWT), error handling, request IDs.
- `src/lib/` — Focused utilities (JWT, password, storage, SSE helpers, agent factory).

## Patterns

- **Inline handlers**: Define handlers directly on route definitions for type inference.
- **No classes**: All functions are plain exports. No service classes, no repository classes.
- **DB via context**: Drizzle db set on Hono context in `index.ts`, accessed via `c.var.db`.
- **Complex logic**: Extract to plain functions in `lib/` or `db/queries/`, not a "service layer".
- **API style**: Verb-based paths (`/api/sessions/list`, `/api/sessions/:id/fork`).
- **Pagination**: Cursor-based, not offset/limit.

## Adding a New Feature

1. Add Drizzle schema in `db/schema.ts`, run `pnpm drizzle-kit generate`
2. Add query functions in `db/queries/` if reusable across routes
3. Create route in `routes/` with inline handlers, mount in `app.ts`
4. Tests: route integration tests via Hono `app.request()`
