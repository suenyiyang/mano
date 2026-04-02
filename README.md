# Mano

A full-stack AI chat application with multi-turn conversations, configurable agents, and extensible tool support.

![Home](docs/screenshots/home.png)

![Chat](docs/screenshots/chat.png)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | Hono 4, Node.js, Drizzle ORM, PostgreSQL |
| Agent | DeepAgents, LangChain, MCP SDK |
| LLM Providers | Volcengine, OpenAI, Anthropic |

## Project Structure

```
mano/
├── apps/
│   ├── frontend/              React SPA (@mano/frontend)
│   └── backend/               Hono API server (@mano/backend)
├── packages/
│   ├── agent/                 AI agent library (@mano/agent)
│   └── langchain-volcengine/  Custom Volcengine LLM provider
├── biome.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

## Features

- **Multi-session chat** with persistent history
- **SSE streaming** with resumable event replay
- **Agent interrupts** — agents can pause and ask users for input
- **Session forking** — branch conversations from any message
- **Message compaction** — summarize history to reduce token usage
- **Custom skills** — user-defined reusable prompts and tools
- **MCP integration** — connect to Model Context Protocol servers
- **Multiple LLM providers** — Volcengine, OpenAI, Anthropic
- **OAuth** — GitHub and Google sign-in
- **Rate limiting** — per-tier, per-day, per-minute controls
- **i18n** — multi-language support

## Getting Started

### Prerequisites

- Node.js ≥ 24
- pnpm 10
- PostgreSQL

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment variables (see below)
cp apps/backend/.env.example apps/backend/.env

# Run database migrations
pnpm --filter @mano/backend drizzle-kit migrate

# Start all projects in dev mode
pnpm dev
```

The frontend runs at `http://localhost:5173` and the backend at `http://localhost:3000`.

### Environment Variables

```bash
# Required
DATABASE_URL=postgres://user:password@localhost:5432/mano

# LLM Providers (at least one required)
VOLCENGINE_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Web Search (optional)
TAVILY_API_KEY=
VOLCENGINE_SEARCH_API_KEY=

# OAuth (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Defaults
PORT=3000
FRONTEND_URL=http://localhost:5173
```

## Development

```bash
pnpm dev          # Run all projects in parallel
pnpm build        # Build all
pnpm check        # Biome lint & format check
pnpm check:fix    # Auto-fix lint & format issues
pnpm typecheck    # TypeScript check all projects
pnpm test         # Unit tests (backend + agent, vitest)
pnpm test:e2e     # Frontend E2E tests (Playwright)
```

### Running individual packages

```bash
pnpm --filter @mano/frontend dev
pnpm --filter @mano/backend dev
pnpm --filter @mano/backend drizzle-kit generate   # Generate migration
pnpm --filter @mano/backend drizzle-kit migrate     # Apply migrations
```

## License

Private
