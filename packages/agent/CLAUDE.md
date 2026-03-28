# Mano Agent

See root CLAUDE.md for coding conventions.

## Tech Stack

- LangChain + DeepAgents + Zod

## Commands

- `pnpm --filter @mano/agent typecheck` — type check
- `pnpm vitest run packages/agent/src/path.test.ts` — run a single test

## Architecture

Shared library that exports TypeScript source directly (no transpiled JS build).

- `src/index.ts` — package exports
- `src/agent.ts` — agent creation with `createAgent()`
- Tool definitions use langchain's `tool()` helper with Zod schemas for input validation
