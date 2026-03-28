import { describe, expect, it, vi } from "vitest";

vi.mock("deepagents", () => ({
  createDeepAgent: vi.fn(({ tools, systemPrompt }: { tools: unknown[]; systemPrompt: string }) => ({
    tools,
    systemPrompt,
  })),
}));

vi.mock("langchain", async () => {
  return {
    tool: vi.fn((fn: (...args: unknown[]) => unknown, config: Record<string, unknown>) => ({
      fn,
      ...config,
    })),
  };
});

interface MockAgent {
  tools: { name: string; fn: (input: { query: string }) => Promise<string> }[];
  systemPrompt: string;
}

describe("createAgent", () => {
  it("creates an agent with the echo tool", async () => {
    const { createAgent } = await import("./agent.js");
    const agent = createAgent("Test system prompt") as unknown as MockAgent;

    expect(agent).toBeDefined();
    expect(agent.systemPrompt).toBe("Test system prompt");
    expect(agent.tools).toHaveLength(1);
    expect(agent.tools[0].name).toBe("echo");
  });

  it("echo tool returns expected format", async () => {
    const { createAgent } = await import("./agent.js");
    const agent = createAgent("Test prompt") as unknown as MockAgent;

    const echoTool = agent.tools[0];
    const result = await echoTool.fn({ query: "hello" });
    expect(result).toBe("Echo: hello");
  });
});
