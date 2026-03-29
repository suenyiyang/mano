import { createMiddleware, SystemMessage } from "langchain";
import type { McpServerConfig } from "../mcp/index.js";
import { McpClientManager } from "../mcp/index.js";
import type { Sandbox } from "../sandbox/types.js";

const MCP_SYSTEM_PROMPT = `## MCP Tools

Some of your tools are provided by external MCP (Model Context Protocol) servers. These tools work the same as built-in tools — invoke them normally by name.`;

export interface McpMiddlewareOptions {
  /**
   * MCP server configurations to connect to.
   * Tools from all connected servers will be available to the agent.
   */
  servers: McpServerConfig[];
  /**
   * Optional sandbox for running MCP stdio servers.
   * When provided, stdio MCP servers are spawned inside the sandbox.
   */
  sandbox?: Sandbox;
}

/**
 * Creates a middleware that connects to MCP servers and registers their tools.
 * The MCP client manager handles connection lifecycle; callers should use the
 * returned mcpManager reference for cleanup.
 */
export const createMcpMiddleware = (options: McpMiddlewareOptions) => {
  const { servers, sandbox } = options;
  const mcpManager = new McpClientManager({ sandbox });

  // We need to connect synchronously with the middleware creation,
  // but MCP connection is async. The tools will be loaded in beforeAgent.
  let mcpToolsLoaded = false;

  const middleware = createMiddleware({
    name: "mcpMiddleware",
    beforeAgent: async () => {
      if (mcpToolsLoaded) return;
      for (const config of servers) {
        try {
          await mcpManager.connect(config);
        } catch {
          // Log but don't fail if a single MCP server fails to connect
        }
      }
      mcpToolsLoaded = true;
    },
    wrapModelCall: async (request, handler) => {
      // Inject MCP tools into the model request
      const mcpTools = mcpManager.getAllTools();
      if (mcpTools.length === 0) {
        return handler(request);
      }

      return handler({
        ...request,
        tools: [...request.tools, ...mcpTools],
        systemMessage: request.systemMessage.concat(
          new SystemMessage({ content: MCP_SYSTEM_PROMPT }),
        ),
      });
    },
  });

  return { middleware, mcpManager };
};
