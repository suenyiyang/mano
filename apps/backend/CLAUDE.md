# Mano Backend

See root CLAUDE.md for coding conventions.

## Tech Stack

- Hono + Node.js + Vite (via @hono/vite-build and @hono/vite-dev-server)
- Depends on `@mano/agent` workspace package

## Commands

- `pnpm --filter @mano/backend dev` — dev server on port 3000
- `pnpm --filter @mano/backend build && pnpm --filter @mano/backend start` — build and run production
- `pnpm vitest run apps/backend/src/path.test.ts` — run a single test

## Architecture

- `src/app.ts` — Hono app setup, mounts route modules under `/api`
- `src/index.ts` — Server entry point (port 3000)
- `src/routes/` — Route handlers, one file per resource
