import { describe, expect, it, vi } from "vitest";

const mockClient = {
  connect: vi.fn(),
  listTools: vi.fn(),
  callTool: vi.fn(),
  close: vi.fn(),
};

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => {
  return {
    Client: class MockClient {
      connect = mockClient.connect;
      listTools = mockClient.listTools;
      callTool = mockClient.callTool;
      close = mockClient.close;
    },
  };
});

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: vi.fn(),
}));

describe("McpClientManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.listTools.mockResolvedValue({
      tools: [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: {
            type: "object",
            properties: {
              input: { type: "string", description: "The input" },
            },
            required: ["input"],
          },
        },
      ],
    });
  });

  it("connects to a stdio MCP server and returns tools", async () => {
    const { McpClientManager } = await import("./client.js");
    const manager = new McpClientManager();

    const tools = await manager.connect({
      name: "test-server",
      transport: "stdio",
      command: "node",
      args: ["server.js"],
    });

    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.listTools).toHaveBeenCalledTimes(1);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("test_tool");
  });

  it("returns cached tools on second connect with same name", async () => {
    const { McpClientManager } = await import("./client.js");
    const manager = new McpClientManager();

    await manager.connect({ name: "s1", transport: "stdio", command: "node" });
    const tools2 = await manager.connect({ name: "s1", transport: "stdio", command: "node" });

    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(tools2).toHaveLength(1);
  });

  it("getAllTools returns tools from all servers", async () => {
    const { McpClientManager } = await import("./client.js");
    const manager = new McpClientManager();

    await manager.connect({ name: "s1", transport: "stdio", command: "node" });

    mockClient.connect.mockClear();
    mockClient.listTools.mockResolvedValueOnce({
      tools: [
        {
          name: "other_tool",
          description: "Another tool",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    });

    await manager.connect({ name: "s2", transport: "stdio", command: "python" });

    const allTools = manager.getAllTools();
    expect(allTools).toHaveLength(2);
    expect(allTools.map((t) => t.name)).toEqual(["test_tool", "other_tool"]);
  });

  it("converted tool invokes MCP callTool and returns text content", async () => {
    mockClient.callTool.mockResolvedValue({
      content: [{ type: "text", text: "tool result here" }],
    });

    const { McpClientManager } = await import("./client.js");
    const manager = new McpClientManager();

    const tools = await manager.connect({ name: "s1", transport: "stdio", command: "node" });
    const result = await tools[0].invoke({ input: "hello" });

    expect(mockClient.callTool).toHaveBeenCalledWith({
      name: "test_tool",
      arguments: { input: "hello" },
    });
    expect(result).toBe("tool result here");
  });

  it("disconnect removes server and closes client", async () => {
    const { McpClientManager } = await import("./client.js");
    const manager = new McpClientManager();

    await manager.connect({ name: "s1", transport: "stdio", command: "node" });
    await manager.disconnect("s1");

    expect(mockClient.close).toHaveBeenCalledTimes(1);
    expect(manager.getAllTools()).toHaveLength(0);
  });

  it("disconnectAll cleans up all servers", async () => {
    const { McpClientManager } = await import("./client.js");
    const manager = new McpClientManager();

    await manager.connect({ name: "s1", transport: "stdio", command: "node" });
    await manager.disconnectAll();

    expect(mockClient.close).toHaveBeenCalled();
    expect(manager.getAllTools()).toHaveLength(0);
  });

  it("throws when stdio transport has no command", async () => {
    const { McpClientManager } = await import("./client.js");
    const manager = new McpClientManager();

    await expect(manager.connect({ name: "bad", transport: "stdio" })).rejects.toThrow(
      "requires a command",
    );
  });

  it("throws when SSE transport has no url", async () => {
    const { McpClientManager } = await import("./client.js");
    const manager = new McpClientManager();

    await expect(manager.connect({ name: "bad", transport: "sse" })).rejects.toThrow(
      "requires a URL",
    );
  });

  it("throws when streamable-http transport has no url", async () => {
    const { McpClientManager } = await import("./client.js");
    const manager = new McpClientManager();

    await expect(manager.connect({ name: "bad", transport: "streamable-http" })).rejects.toThrow(
      "requires a URL",
    );
  });

  it("handles multiple content blocks by joining text", async () => {
    mockClient.callTool.mockResolvedValue({
      content: [
        { type: "text", text: "line one" },
        { type: "text", text: "line two" },
      ],
    });

    const { McpClientManager } = await import("./client.js");
    const manager = new McpClientManager();

    const tools = await manager.connect({ name: "s1", transport: "stdio", command: "node" });
    const result = await tools[0].invoke({ input: "test" });

    expect(result).toBe("line one\nline two");
  });

  it("converts number and boolean input schema types", async () => {
    mockClient.listTools.mockResolvedValue({
      tools: [
        {
          name: "typed_tool",
          description: "Tool with types",
          inputSchema: {
            type: "object",
            properties: {
              count: { type: "number" },
              flag: { type: "boolean" },
              label: { type: "string" },
            },
            required: ["count"],
          },
        },
      ],
    });

    mockClient.callTool.mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
    });

    const { McpClientManager } = await import("./client.js");
    const manager = new McpClientManager();

    const tools = await manager.connect({ name: "typed", transport: "stdio", command: "node" });
    expect(tools[0].name).toBe("typed_tool");

    const result = await tools[0].invoke({ count: 5 });
    expect(result).toBe("ok");
  });
});
