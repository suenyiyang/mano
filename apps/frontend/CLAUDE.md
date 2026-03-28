# Mano Frontend

See root CLAUDE.md for coding conventions and component/hook patterns.

## Tech Stack

- React + TypeScript + Vite
- shadcn/ui + Tailwind CSS
- lucide-react for icons
- Playwright for E2E tests (no happy-dom or testing-library)

## Commands

- `pnpm --filter @mano/frontend dev` — dev server on port 5173
- `pnpm --filter @mano/frontend build` — production build
- `pnpm --filter @mano/frontend test:e2e` — run all E2E tests
- `pnpm --filter @mano/frontend test:e2e -- e2e/specific.spec.ts` — single E2E test

API proxy: `/api/*` routes to `http://localhost:3000` in dev.

## Routing

React Router v7 (client-side). Routes defined in `src/routes.tsx`.

- `/app` — New chat page (centered hero + input)
- `/app/:sessionId` — Session page (topbar + chat history + bottom input)
- Both share a sidebar layout (260px, left)

## Design Rules

When adding or modifying any frontend component, page, or layout, follow the design skill at `/.claude/skills/mano-frontend-design.md`. This is mandatory — do not deviate from the established visual language.

Reference mockups are in `/designs/app-new-chat.html` and `/designs/app-session.html`.
