// @ts-nocheck — createMiddleware mock returns raw config, not full middleware type
import { describe, expect, it, vi } from "vitest";

vi.mock("langchain", () => ({
  createMiddleware: vi.fn((config) => config),
  SystemMessage: class {
    content: string;
    constructor({ content }: { content: string }) {
      this.content = content;
    }
  },
}));

const makeFakeTool = (name: string, description: string) => ({
  name,
  description,
  invoke: vi.fn(),
});

describe("createToolSearchMiddleware", () => {
  it("creates middleware with tool_search tool", async () => {
    const { createToolSearchMiddleware } = await import("./tool-search.js");

    const middleware = createToolSearchMiddleware();

    expect(middleware.name).toBe("toolSearchMiddleware");
    expect(middleware.tools).toHaveLength(1);
    expect(middleware.tools[0].name).toBe("tool_search");
  });

  it("tool_search finds matching tools from extraTools by name", async () => {
    const { createToolSearchMiddleware } = await import("./tool-search.js");

    const fakeTools = [
      makeFakeTool("web_search", "Search the web"),
      makeFakeTool("skill", "Invoke a skill"),
      makeFakeTool("ask_user", "Ask the user a question"),
    ];

    const middleware = createToolSearchMiddleware({ extraTools: fakeTools as never[] });
    const result = await middleware.tools[0].invoke({ keyword: "search" });

    expect(result).toContain("web_search");
    expect(result).toContain("Search the web");
    expect(result).not.toContain("ask_user");
  });

  it("tool_search finds matching tools from extraTools by description", async () => {
    const { createToolSearchMiddleware } = await import("./tool-search.js");

    const fakeTools = [
      makeFakeTool("web_search", "Search the web for information"),
      makeFakeTool("ask_user", "Ask the user a question"),
    ];

    const middleware = createToolSearchMiddleware({ extraTools: fakeTools as never[] });
    const result = await middleware.tools[0].invoke({ keyword: "question" });

    expect(result).toContain("ask_user");
    expect(result).not.toContain("web_search");
  });

  it("tool_search returns no-match message with available tool names", async () => {
    const { createToolSearchMiddleware } = await import("./tool-search.js");

    const fakeTools = [
      makeFakeTool("web_search", "Search the web"),
      makeFakeTool("skill", "Invoke a skill"),
    ];

    const middleware = createToolSearchMiddleware({ extraTools: fakeTools as never[] });
    const result = await middleware.tools[0].invoke({ keyword: "nonexistent" });

    expect(result).toContain('No tools found matching "nonexistent"');
    expect(result).toContain("web_search");
    expect(result).toContain("skill");
  });

  it("tool_search returns no-match when no tools registered", async () => {
    const { createToolSearchMiddleware } = await import("./tool-search.js");

    const middleware = createToolSearchMiddleware();
    const result = await middleware.tools[0].invoke({ keyword: "anything" });

    expect(result).toContain("No tools found");
  });

  it("tool_search is case-insensitive", async () => {
    const { createToolSearchMiddleware } = await import("./tool-search.js");

    const fakeTools = [makeFakeTool("Web_Search", "Search The Web")];

    const middleware = createToolSearchMiddleware({ extraTools: fakeTools as never[] });
    const result = await middleware.tools[0].invoke({ keyword: "WEB" });

    expect(result).toContain("Web_Search");
  });
});
