import type { StructuredToolInterface } from "@langchain/core/tools";
import { tool } from "@langchain/core/tools";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import type { Sandbox } from "../sandbox/types.js";
import { SandboxStdioTransport } from "./sandbox-stdio-transport.js";

export interface McpServerConfig {
  name: string;
  transport: "stdio" | "sse" | "streamable-http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface ConnectedServer {
  client: Client;
  tools: StructuredToolInterface[];
}

/**
 * Manages connections to MCP servers and converts their tools to LangChain format.
 *
 * When a `sandbox` is provided, stdio MCP servers are spawned inside the sandbox
 * instead of on the local machine. SSE and streamable-http servers always connect
 * directly (they don't need process spawning).
 */
export class McpClientManager {
  private servers = new Map<string, ConnectedServer>();
  private sandbox?: Sandbox;

  constructor(options?: { sandbox?: Sandbox }) {
    this.sandbox = options?.sandbox;
  }

  /**
   * Connect to an MCP server and register its tools.
   */
  async connect(config: McpServerConfig): Promise<StructuredToolInterface[]> {
    if (this.servers.has(config.name)) {
      return this.servers.get(config.name)!.tools;
    }

    const client = new Client({ name: "mano-agent", version: "0.0.1" }, { capabilities: {} });

    const transport = this.createTransport(config);
    await client.connect(transport);

    const { tools: mcpTools = [] } = await client.listTools();
    const langchainTools = mcpTools.map((mcpTool) => this.convertTool(client, mcpTool));

    this.servers.set(config.name, { client, tools: langchainTools });
    return langchainTools;
  }

  /**
   * Get all tools from all connected servers.
   */
  getAllTools(): StructuredToolInterface[] {
    const allTools: StructuredToolInterface[] = [];
    for (const server of this.servers.values()) {
      allTools.push(...server.tools);
    }
    return allTools;
  }

  /**
   * Disconnect from all MCP servers.
   */
  async disconnectAll(): Promise<void> {
    for (const [name, server] of this.servers) {
      try {
        await server.client.close();
      } catch {
        // Ignore close errors during cleanup
      }
      this.servers.delete(name);
    }
  }

  /**
   * Disconnect from a specific server.
   */
  async disconnect(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server) {
      await server.client.close();
      this.servers.delete(name);
    }
  }

  private createTransport(config: McpServerConfig) {
    switch (config.transport) {
      case "stdio": {
        if (!config.command) {
          throw new Error(`MCP server "${config.name}" requires a command for stdio transport`);
        }

        // When a sandbox is available, spawn MCP stdio servers inside it
        if (this.sandbox) {
          const sandbox = this.sandbox;
          return new SandboxStdioTransport({
            command: config.command,
            args: config.args,
            spawn: (cmd, args) => sandbox.spawn(cmd, args),
          });
        }

        return new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: config.env,
        });
      }
      case "sse": {
        if (!config.url) {
          throw new Error(`MCP server "${config.name}" requires a URL for SSE transport`);
        }
        return new SSEClientTransport(new URL(config.url));
      }
      case "streamable-http": {
        if (!config.url) {
          throw new Error(
            `MCP server "${config.name}" requires a URL for streamable-http transport`,
          );
        }
        return new StreamableHTTPClientTransport(new URL(config.url));
      }
    }
  }

  /**
   * Convert an MCP tool definition to a LangChain StructuredToolInterface.
   */
  private convertTool(
    client: Client,
    mcpTool: { name: string; description?: string; inputSchema: Record<string, unknown> },
  ): StructuredToolInterface {
    // Build a Zod schema from the MCP tool's JSON Schema input
    const properties = (mcpTool.inputSchema.properties ?? {}) as Record<
      string,
      { type?: string; description?: string }
    >;
    const required = (mcpTool.inputSchema.required ?? []) as string[];

    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [key, prop] of Object.entries(properties)) {
      let field: z.ZodTypeAny = z.string();
      if (prop.type === "number" || prop.type === "integer") {
        field = z.number();
      } else if (prop.type === "boolean") {
        field = z.boolean();
      } else if (prop.type === "array") {
        field = z.array(z.unknown());
      } else if (prop.type === "object") {
        field = z.record(z.unknown());
      }
      if (prop.description) {
        field = field.describe(prop.description);
      }
      if (!required.includes(key)) {
        field = field.optional();
      }
      shape[key] = field;
    }

    const schema = z.object(shape);

    return tool(
      async (args) => {
        const result = await client.callTool({ name: mcpTool.name, arguments: args });
        const content = result.content;
        if (Array.isArray(content)) {
          return content
            .map((c) => {
              if (typeof c === "object" && c !== null && "text" in c) {
                return (c as { text: string }).text;
              }
              return JSON.stringify(c);
            })
            .join("\n");
        }
        return typeof content === "string" ? content : JSON.stringify(content);
      },
      {
        name: mcpTool.name,
        description: mcpTool.description ?? `MCP tool: ${mcpTool.name}`,
        schema,
      },
    );
  }
}
