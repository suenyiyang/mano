import { describe, expect, it, vi } from "vitest";

vi.mock("deepagents", () => ({
  createDeepAgent: vi.fn(
    ({
      model,
      tools,
      systemPrompt,
    }: {
      model: unknown;
      tools: unknown[];
      systemPrompt?: string;
    }) => ({
      model,
      tools,
      systemPrompt,
    }),
  ),
}));

interface MockAgent {
  model: unknown;
  tools: unknown[];
  systemPrompt: string | undefined;
}

describe("createManoAgent", () => {
  it("creates an agent with a model and system prompt", async () => {
    const { createManoAgent } = await import("./agent.js");
    const fakeModel = { _modelType: () => "test" };
    const agent = createManoAgent({
      model: fakeModel as never,
      systemPrompt: "You are a helpful assistant",
    }) as unknown as MockAgent;

    expect(agent).toBeDefined();
    expect(agent.model).toBe(fakeModel);
    expect(agent.systemPrompt).toBe("You are a helpful assistant");
    expect(agent.tools).toEqual([]);
  });

  it("passes custom tools through to createDeepAgent", async () => {
    const { createManoAgent } = await import("./agent.js");
    const fakeTool = { name: "test_tool" };
    const agent = createManoAgent({
      model: {} as never,
      tools: [fakeTool as never],
    }) as unknown as MockAgent;

    expect(agent.tools).toHaveLength(1);
    expect(agent.tools[0]).toBe(fakeTool);
  });
});
