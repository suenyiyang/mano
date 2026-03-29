// @ts-nocheck — createMiddleware mock returns raw config, not full middleware type
import { describe, expect, it } from "vitest";

vi.mock("langchain", () => ({
  createMiddleware: vi.fn((config) => config),
  SystemMessage: class {
    content: string;
    constructor({ content }: { content: string }) {
      this.content = content;
    }
  },
}));

describe("webSearchMiddleware", () => {
  it("creates middleware with web_search tool", async () => {
    const { webSearchMiddleware } = await import("./web-search.js");

    expect(webSearchMiddleware).toBeDefined();
    expect(webSearchMiddleware.name).toBe("webSearchMiddleware");
    expect(webSearchMiddleware.tools).toHaveLength(1);
    expect(webSearchMiddleware.tools[0].name).toBe("web_search");
  });

  it("web_search tool returns placeholder with query", async () => {
    const { webSearchMiddleware } = await import("./web-search.js");
    const webSearchTool = webSearchMiddleware.tools[0];

    const result = await webSearchTool.invoke({ query: "test query" });
    expect(result).toContain("No search provider configured");
    expect(result).toContain("test query");
  });

  it("wrapModelCall appends system prompt", async () => {
    const { webSearchMiddleware } = await import("./web-search.js");

    const messages: unknown[] = [];
    const request = {
      systemMessage: { concat: (msg: unknown) => [...messages, msg] },
    };

    let capturedRequest: unknown;
    const handler = async (req: unknown) => {
      capturedRequest = req;
      return {};
    };

    await webSearchMiddleware.wrapModelCall(request, handler);

    const modified = capturedRequest as { systemMessage: { content: string }[] };
    expect(modified.systemMessage).toHaveLength(1);
    expect(modified.systemMessage[0].content).toContain("Web Search");
  });
});
