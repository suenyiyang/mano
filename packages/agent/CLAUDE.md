# Mano Agent

See root CLAUDE.md for coding conventions.

## Tech Stack

- DeepAgents + LangChain + Zod
- `@langchain/openai` (ChatOpenAI with `useResponsesApi`) for Volcengine + OpenAI
- `@langchain/anthropic` (ChatAnthropic) for Anthropic
- `@modelcontextprotocol/sdk` for MCP client

## Commands

- `pnpm --filter @mano/agent typecheck` — type check
- `pnpm vitest run packages/agent/src/path.test.ts` — run a single test

## Architecture

Shared library that exports TypeScript source directly (no transpiled JS build).
Must remain environment-agnostic — no HTTP, no DB, no filesystem assumptions.
SandboxProvider interface abstracts filesystem/exec for web sandbox vs local CLI.

- `src/index.ts` — package exports
- `src/agent.ts` — `createManoAgent()` wrapping `createDeepAgent`
- `src/types.ts` — shared types (AgentEvent, SandboxProvider, etc.)
- `src/providers/` — LLM provider factories (volcengine, openai, anthropic)
- `src/tools/` — custom tools (web_search, tool_search, skill, ask_user)
- `src/mcp/` — MCP client manager
- `src/sandbox/` — SandboxProvider interface and types

## Providers

- `@langchain/openai` ChatOpenAI with `useResponsesApi: true` for Volcengine and OpenAI
- `@langchain/anthropic` ChatAnthropic for Anthropic
- Provider instances created by consumer (backend or CLI), not hardcoded

## Tools

- **Custom**: web_search, tool_search, skill, ask_user
- **Built-in from DeepAgents**: filesystem (read, write, edit, ls, glob, grep, execute), todoList, subagents
- Tool definitions use langchain's `tool()` helper with Zod schemas for input validation
