import type { StructuredToolInterface } from "@langchain/core/tools";
import { tool } from "@langchain/core/tools";
import { createMiddleware, SystemMessage } from "langchain";
import { z } from "zod";

const TOOL_SEARCH_SYSTEM_PROMPT = `## Tool Search

You have access to a \`tool_search\` tool. Use it to discover available tools by searching with keywords when you're unsure which tool to use for a task.`;

export interface ToolSearchMiddlewareOptions {
  /**
   * Additional tools to include in the search index beyond those registered by middleware.
   * This is useful for including tools from external sources like MCP servers.
   */
  extraTools?: StructuredToolInterface[];
}

/**
 * Creates a middleware that provides a tool_search tool for discovering available tools.
 * The search indexes tool names and descriptions from all registered tools.
 */
export const createToolSearchMiddleware = (options: ToolSearchMiddlewareOptions = {}) => {
  const { extraTools = [] } = options;

  const toolSearchTool = tool(
    async ({ keyword }, config) => {
      // Collect all tools available in the runtime
      const runtimeTools = (config?.configurable?.tools ?? []) as StructuredToolInterface[];
      const allTools = [...runtimeTools, ...extraTools];

      const lower = keyword.toLowerCase();
      const matches = allTools.filter(
        (t) => t.name.toLowerCase().includes(lower) || t.description.toLowerCase().includes(lower),
      );

      if (matches.length === 0) {
        return `No tools found matching "${keyword}". Available tools: ${allTools.map((t) => t.name).join(", ")}`;
      }

      return matches.map((t) => `- **${t.name}**: ${t.description}`).join("\n");
    },
    {
      name: "tool_search",
      description:
        "Search through available tools by keyword. Returns matching tool names and descriptions.",
      schema: z.object({
        keyword: z.string().describe("Keyword to search for in tool names and descriptions"),
      }),
    },
  );

  return createMiddleware({
    name: "toolSearchMiddleware",
    tools: [toolSearchTool],
    wrapModelCall: async (request, handler) => {
      return handler({
        ...request,
        systemMessage: request.systemMessage.concat(
          new SystemMessage({ content: TOOL_SEARCH_SYSTEM_PROMPT }),
        ),
      });
    },
  });
};
