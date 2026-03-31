import { tool } from "@langchain/core/tools";
import { createMiddleware, SystemMessage } from "langchain";
import { z } from "zod";

export interface WebSearchProviderConfig {
  tavily?: {
    apiKey: string;
  };
  volcengine?: {
    apiKey: string;
    baseUrl?: string;
  };
}

export interface WebSearchMiddlewareOptions {
  providers: WebSearchProviderConfig;
}

interface SearchResult {
  title: string;
  url: string;
  content: string;
}

const isChinese = (text: string): boolean => {
  const chineseChars = text.match(/[\u4e00-\u9fff]/g);
  if (!chineseChars) return false;
  return chineseChars.length / text.length > 0.3;
};

const searchWithTavily = async (
  apiKey: string,
  query: string,
  maxResults: number,
): Promise<SearchResult[]> => {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: maxResults,
      include_answer: "basic",
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    answer?: string;
    results: Array<{ title: string; url: string; content: string }>;
  };

  const results: SearchResult[] = (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));

  if (data.answer) {
    results.unshift({ title: "AI Answer", url: "", content: data.answer });
  }

  return results;
};

interface VolcengineWebSearchResponse {
  ResponseMetadata: {
    RequestId: string;
    Error?: { CodeN: number; Code: string; Message: string };
  };
  Result?: {
    ResultCount: number;
    WebResults?: Array<{
      Title: string;
      SiteName?: string;
      Url?: string;
      Snippet: string;
      Summary?: string;
      Content?: string;
    }>;
  };
}

const VOLCENGINE_SEARCH_BASE_URL = "https://open.feedcoopapi.com/search_api";

const searchWithVolcengine = async (
  apiKey: string,
  baseUrl: string,
  query: string,
  maxResults: number,
): Promise<SearchResult[]> => {
  const response = await fetch(`${baseUrl}/web_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      Query: query.slice(0, 100),
      SearchType: "web",
      Count: Math.min(maxResults, 50),
      NeedSummary: true,
      Filter: { NeedUrl: true },
    }),
  });

  if (!response.ok) {
    throw new Error(`Volcengine search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as VolcengineWebSearchResponse;

  if (data.ResponseMetadata.Error) {
    const err = data.ResponseMetadata.Error;
    throw new Error(`Volcengine search error ${err.Code}: ${err.Message}`);
  }

  const webResults = data.Result?.WebResults ?? [];
  return webResults.map((r) => ({
    title: r.Title || r.SiteName || "Untitled",
    url: r.Url ?? "",
    content: r.Summary || r.Content || r.Snippet || "",
  }));
};

const formatResults = (results: SearchResult[]): string => {
  if (results.length === 0) {
    return "No results found.";
  }
  return results
    .map((r, i) => {
      const urlLine = r.url ? `URL: ${r.url}\n` : "";
      return `[${i + 1}] ${r.title}\n${urlLine}${r.content}`;
    })
    .join("\n\n");
};

const WEB_SEARCH_SYSTEM_PROMPT = `## Web Search

You have access to a \`web_search\` tool. Use it when you need up-to-date information, external documentation, or facts not in your training data. Prefer specific, targeted queries. The tool automatically routes Chinese queries to Volcengine search and other queries to Tavily for best results.`;

export const createWebSearchMiddleware = (options: WebSearchMiddlewareOptions) => {
  const { providers } = options;

  const webSearchTool = tool(
    async ({ query, maxResults }) => {
      const hasTavily = !!providers.tavily;
      const hasVolcengine = !!providers.volcengine;

      if (!hasTavily && !hasVolcengine) {
        return `[web_search] No search provider configured. Query: "${query}"`;
      }

      // Route: Chinese queries → Volcengine (if available), otherwise → Tavily
      const preferVolcengine = hasVolcengine && isChinese(query);
      const primary = preferVolcengine ? "volcengine" : "tavily";

      try {
        if (primary === "volcengine" && providers.volcengine) {
          const { apiKey, baseUrl } = providers.volcengine;
          return formatResults(
            await searchWithVolcengine(
              apiKey,
              baseUrl ?? VOLCENGINE_SEARCH_BASE_URL,
              query,
              maxResults,
            ),
          );
        }
        if (primary === "tavily" && providers.tavily) {
          return formatResults(await searchWithTavily(providers.tavily.apiKey, query, maxResults));
        }
      } catch {
        // Primary failed — try fallback
      }

      // Fallback to the other provider
      try {
        if (primary === "volcengine" && providers.tavily) {
          return formatResults(await searchWithTavily(providers.tavily.apiKey, query, maxResults));
        }
        if (primary === "tavily" && providers.volcengine) {
          const { apiKey, baseUrl } = providers.volcengine;
          return formatResults(
            await searchWithVolcengine(
              apiKey,
              baseUrl ?? VOLCENGINE_SEARCH_BASE_URL,
              query,
              maxResults,
            ),
          );
        }
      } catch {
        // Both failed
      }

      return `[web_search] All search providers failed for query: "${query}"`;
    },
    {
      name: "web_search",
      description:
        "Search the web for current information. Automatically routes Chinese queries to Volcengine and other queries to Tavily. Use when you need up-to-date facts, documentation, or answers not in your training data.",
      schema: z.object({
        query: z.string().describe("The search query"),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(5)
          .describe("Maximum number of results to return"),
      }),
    },
  );

  return createMiddleware({
    name: "webSearchMiddleware",
    tools: [webSearchTool],
    wrapModelCall: async (request, handler) => {
      return handler({
        ...request,
        systemMessage: request.systemMessage.concat(
          new SystemMessage({ content: WEB_SEARCH_SYSTEM_PROMPT }),
        ),
      });
    },
  });
};
