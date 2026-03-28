# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Monorepo with pnpm workspaces:
- `apps/frontend` — React SPA (`@mano/frontend`)
- `apps/backend` — Hono API server (`@mano/backend`)
- `packages/agent` — AI agent library (`@mano/agent`)

**When modifying a specific project, read its CLAUDE.md first.**

## Commands

- `pnpm dev` — run all projects in parallel
- `pnpm build` — build all
- `pnpm check` / `pnpm check:fix` — biome check / autofix
- `pnpm typecheck` — typecheck all projects
- `pnpm test` — unit tests (backend + agent, vitest)
- `pnpm test:e2e` — frontend E2E (Playwright)
- Single test: `pnpm vitest run path/to/file.test.ts`

## Naming Conventions

- Files: `kebab-case`
- Variables: `camelCase`
- Constants: `UPPER_CASE`
- Components, types, interfaces: `PascalCase`

## Coding Style

- Prefer `if` blocks over inline ternaries
- Prefer `const fn = () => {}` over `function fn() {}`
- Biome enforces: double quotes, semicolons, 2-space indent, 100-char line width, organized imports

## Frontend Component & Hook Patterns

Hooks: `useXxxLogic` with `UseXxxLogicProps` interface.
Components: arrow function with `FC<Props>` generic, props interface named `XxxProps`.

```ts
interface ChatInputProps {
  // ...
}

const ChatInput: FC<ChatInputProps> = (props) => {
  // ...
};
```

Write pure components and logic hooks separately. Combine them in a container component (e.g., the route's page). Do not destructure returned props from sub-hooks:

```ts
const usePageLogic = (props: UsePageLogicProps) => {
  const chatInputProps = useChatInputLogic();
  const messageListProps = useMessageListLogic();

  return {
    chatInputProps,
    messageListProps,
  };
};
```
