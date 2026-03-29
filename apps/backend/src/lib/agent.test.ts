import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { describe, expect, it, vi } from "vitest";

// Mock the env module before imports
vi.mock("../env.js", () => ({
  getEnv: () => ({
    VOLCENGINE_API_KEY: "test-volcengine-key",
    VOLCENGINE_BASE_URL: "https://ark.cn-beijing.volces.com/api/v3",
    OPENAI_API_KEY: "test-openai-key",
    ANTHROPIC_API_KEY: "test-anthropic-key",
  }),
}));

vi.mock("@mano/agent", () => ({
  createModel: vi.fn(() => ({ _modelType: () => "mock" })),
  createManoAgent: vi.fn(({ model }) => ({ model })),
  webSearchMiddleware: { name: "webSearchMiddleware" },
  createSkillMiddleware: vi.fn(() => ({ name: "skillMiddleware" })),
  createAskUserMiddleware: vi.fn(() => ({ name: "askUserMiddleware" })),
  createMcpMiddleware: vi.fn(() => ({
    middleware: { name: "mcpMiddleware" },
    mcpManager: {},
  })),
  createToolSearchMiddleware: vi.fn(() => ({ name: "toolSearchMiddleware" })),
}));

vi.mock("../db/queries/mcp-servers.js", () => ({
  findEnabledMcpServersByUser: vi.fn(async () => []),
}));

vi.mock("../db/queries/skills.js", () => ({
  findSkillByName: vi.fn(async () => null),
}));

describe("pickModel", () => {
  it("returns the only model when array has one element", async () => {
    const { pickModel } = await import("./agent.js");
    const models = [makeModel("pro", "volcengine", "doubao-pro", 1)];

    expect(pickModel(models)).toBe(models[0]);
  });

  it("throws when no models available", async () => {
    const { pickModel } = await import("./agent.js");

    expect(() => pickModel([])).toThrow("No enabled models");
  });

  it("returns a model from weighted selection", async () => {
    const { pickModel } = await import("./agent.js");
    const models = [
      makeModel("pro", "volcengine", "doubao-pro", 3),
      makeModel("pro", "openai", "gpt-4o", 1),
    ];

    // Run many times to verify both can be selected
    const selected = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const model = pickModel(models);
      selected.add(model.apiModelId);
    }

    expect(selected.has("doubao-pro")).toBe(true);
    // With weight 1/4, gpt-4o should be selected at least once in 100 trials
    expect(selected.has("gpt-4o")).toBe(true);
  });
});

describe("createModelInstance", () => {
  it("creates a volcengine model", async () => {
    const { createModelInstance } = await import("./agent.js");
    const { createModel } = await import("@mano/agent");

    const row = makeModel("pro", "volcengine", "doubao-pro", 1);
    createModelInstance(row);

    expect(createModel).toHaveBeenCalledWith({
      provider: "volcengine",
      model: "doubao-pro",
      apiKey: "test-volcengine-key",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    });
  });

  it("creates an openai model", async () => {
    const { createModelInstance } = await import("./agent.js");
    const { createModel } = await import("@mano/agent");

    const row = makeModel("pro", "openai", "gpt-4o", 1);
    createModelInstance(row);

    expect(createModel).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-4o",
      apiKey: "test-openai-key",
    });
  });

  it("creates an anthropic model", async () => {
    const { createModelInstance } = await import("./agent.js");
    const { createModel } = await import("@mano/agent");

    const row = makeModel("pro", "anthropic", "claude-sonnet-4-5-20250929", 1);
    createModelInstance(row);

    expect(createModel).toHaveBeenCalledWith({
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      apiKey: "test-anthropic-key",
    });
  });

  it("throws for unknown provider", async () => {
    const { createModelInstance } = await import("./agent.js");
    const row = makeModel("pro", "unknown", "model-x", 1);

    expect(() => createModelInstance(row)).toThrow("Unknown provider");
  });
});

describe("dbMessagesToLangChain", () => {
  it("converts system message", async () => {
    const { dbMessagesToLangChain } = await import("./agent.js");
    const result = dbMessagesToLangChain([{ role: "system", content: "You are helpful" }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(SystemMessage);
    expect(result[0].content).toBe("You are helpful");
  });

  it("converts user message", async () => {
    const { dbMessagesToLangChain } = await import("./agent.js");
    const result = dbMessagesToLangChain([{ role: "user", content: "Hello" }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(HumanMessage);
    expect(result[0].content).toBe("Hello");
  });

  it("converts assistant message with tool calls", async () => {
    const { dbMessagesToLangChain } = await import("./agent.js");
    const toolCalls = [{ id: "tc1", name: "search", args: { q: "test" } }];
    const result = dbMessagesToLangChain([
      { role: "assistant", content: "Let me search", toolCalls },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(AIMessage);
    expect(result[0].content).toBe("Let me search");
    expect((result[0] as AIMessage).tool_calls).toEqual(toolCalls);
  });

  it("converts tool message", async () => {
    const { dbMessagesToLangChain } = await import("./agent.js");
    const result = dbMessagesToLangChain([
      { role: "tool", content: "result data", toolCallId: "tc1", toolName: "search" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(ToolMessage);
    expect(result[0].content).toBe("result data");
    expect((result[0] as ToolMessage).tool_call_id).toBe("tc1");
  });

  it("converts JSONB content to string", async () => {
    const { dbMessagesToLangChain } = await import("./agent.js");
    const result = dbMessagesToLangChain([
      { role: "user", content: { blocks: [{ type: "text", text: "hi" }] } },
    ]);

    expect(result).toHaveLength(1);
    expect(typeof result[0].content).toBe("string");
    expect(result[0].content).toContain("blocks");
  });

  it("handles unknown role as HumanMessage", async () => {
    const { dbMessagesToLangChain } = await import("./agent.js");
    const result = dbMessagesToLangChain([{ role: "unknown", content: "fallback" }]);

    expect(result[0]).toBeInstanceOf(HumanMessage);
  });

  it("converts multiple messages in order", async () => {
    const { dbMessagesToLangChain } = await import("./agent.js");
    const result = dbMessagesToLangChain([
      { role: "system", content: "Be helpful" },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);

    expect(result).toHaveLength(3);
    expect(result[0]).toBeInstanceOf(SystemMessage);
    expect(result[1]).toBeInstanceOf(HumanMessage);
    expect(result[2]).toBeInstanceOf(AIMessage);
  });
});

// Helper to create model tier rows matching the Drizzle schema shape
function makeModel(tier: string, provider: string, apiModelId: string, weight: number) {
  return {
    tier,
    provider,
    apiModelId,
    displayName: apiModelId,
    weight,
    isEnabled: true,
    config: {},
  };
}
