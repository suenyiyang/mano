import { tool } from "@langchain/core/tools";
import { createMiddleware, SystemMessage } from "langchain";
import { z } from "zod";

const WEB_SEARCH_SYSTEM_PROMPT = `## Web Search

You have access to a \`web_search\` tool. Use it when you need up-to-date information, external documentation, or facts not in your training data. Prefer specific, targeted queries.`;

const webSearchTool = tool(
  async ({ query }) => {
    // TODO: Wire to actual search provider (SerpAPI, Tavily, or Volcengine search)
    return `[web_search] No search provider configured. Query: "${query}"`;
  },
  {
    name: "web_search",
    description:
      "Search the web for current information. Use this when you need up-to-date facts, documentation, or answers that may not be in your training data.",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  },
);

export const webSearchMiddleware = createMiddleware({
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
