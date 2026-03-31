// @ts-nocheck — createMiddleware mock returns raw config, not full middleware type
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("langchain", () => ({
  createMiddleware: vi.fn((config) => config),
  SystemMessage: class {
    content: string;
    constructor({ content }: { content: string }) {
      this.content = content;
    }
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

afterEach(() => {
  mockFetch.mockReset();
});

describe("createWebSearchMiddleware", () => {
  it("creates middleware with web_search tool", async () => {
    const { createWebSearchMiddleware } = await import("./web-search.js");
    const middleware = createWebSearchMiddleware({ providers: {} });

    expect(middleware).toBeDefined();
    expect(middleware.name).toBe("webSearchMiddleware");
    expect(middleware.tools).toHaveLength(1);
    expect(middleware.tools[0].name).toBe("web_search");
  });

  it("returns no-provider message when none configured", async () => {
    const { createWebSearchMiddleware } = await import("./web-search.js");
    const middleware = createWebSearchMiddleware({ providers: {} });
    const webSearchTool = middleware.tools[0];

    const result = await webSearchTool.invoke({ query: "test query" });
    expect(result).toContain("No search provider configured");
    expect(result).toContain("test query");
  });

  it("calls Tavily for non-Chinese queries", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ title: "Result 1", url: "https://example.com", content: "Content 1" }],
      }),
    });

    const { createWebSearchMiddleware } = await import("./web-search.js");
    const middleware = createWebSearchMiddleware({
      providers: {
        tavily: { apiKey: "tvly-test" },
        volcengine: { apiKey: "search-api-key" },
      },
    });

    const result = await middleware.tools[0].invoke({ query: "what is TypeScript" });
    expect(result).toContain("Result 1");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls Volcengine for Chinese queries", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ResponseMetadata: { RequestId: "test-123" },
        Result: {
          ResultCount: 1,
          WebResults: [
            {
              Title: "天气预报",
              SiteName: "weather.com.cn",
              Url: "https://weather.com.cn",
              Snippet: "北京天气简要",
              Summary: "北京今天晴天，最高温度25度",
            },
          ],
        },
      }),
    });

    const { createWebSearchMiddleware } = await import("./web-search.js");
    const middleware = createWebSearchMiddleware({
      providers: {
        tavily: { apiKey: "tvly-test" },
        volcengine: { apiKey: "search-api-key" },
      },
    });

    const result = await middleware.tools[0].invoke({ query: "北京今天天气怎么样" });
    expect(result).toContain("天气预报");
    expect(result).toContain("北京今天晴天");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("web_search"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("falls back to Tavily when Volcengine fails on Chinese query", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { title: "Fallback", url: "https://fallback.com", content: "Fallback content" },
          ],
        }),
      });

    const { createWebSearchMiddleware } = await import("./web-search.js");
    const middleware = createWebSearchMiddleware({
      providers: {
        tavily: { apiKey: "tvly-test" },
        volcengine: { apiKey: "search-api-key" },
      },
    });

    const result = await middleware.tools[0].invoke({ query: "北京今天天气怎么样" });
    expect(result).toContain("Fallback");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("falls back when Volcengine returns API-level error", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ResponseMetadata: {
            RequestId: "test-err",
            Error: { CodeN: 10400, Code: "10400", Message: "query or search type is empty" },
          },
          Result: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { title: "Fallback", url: "https://fallback.com", content: "Fallback content" },
          ],
        }),
      });

    const { createWebSearchMiddleware } = await import("./web-search.js");
    const middleware = createWebSearchMiddleware({
      providers: {
        tavily: { apiKey: "tvly-test" },
        volcengine: { apiKey: "search-api-key" },
      },
    });

    const result = await middleware.tools[0].invoke({ query: "北京今天天气怎么样" });
    expect(result).toContain("Fallback");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("uses only Tavily when Volcengine not configured", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ title: "Only Tavily", url: "https://t.com", content: "Result" }],
      }),
    });

    const { createWebSearchMiddleware } = await import("./web-search.js");
    const middleware = createWebSearchMiddleware({
      providers: { tavily: { apiKey: "tvly-test" } },
    });

    const result = await middleware.tools[0].invoke({ query: "北京天气" });
    expect(result).toContain("Only Tavily");
    expect(mockFetch).toHaveBeenCalledWith("https://api.tavily.com/search", expect.anything());
  });

  it("wrapModelCall appends system prompt", async () => {
    const { createWebSearchMiddleware } = await import("./web-search.js");
    const middleware = createWebSearchMiddleware({ providers: {} });

    const messages: unknown[] = [];
    const request = {
      systemMessage: { concat: (msg: unknown) => [...messages, msg] },
    };

    let capturedRequest: unknown;
    const handler = async (req: unknown) => {
      capturedRequest = req;
      return {};
    };

    await middleware.wrapModelCall(request, handler);

    const modified = capturedRequest as { systemMessage: { content: string }[] };
    expect(modified.systemMessage).toHaveLength(1);
    expect(modified.systemMessage[0].content).toContain("Web Search");
  });
});
