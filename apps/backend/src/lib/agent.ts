import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { AskUserResolver, ModelConfig, ModelProvider, SkillResolver } from "@mano/agent";
import {
  createAskUserMiddleware,
  createManoAgent,
  createMcpMiddleware,
  createModel,
  createSkillMiddleware,
  createToolSearchMiddleware,
  webSearchMiddleware,
} from "@mano/agent";
import type { AgentMiddleware } from "langchain";
import type { Db } from "../db/index.js";
import { findEnabledMcpServersByUser } from "../db/queries/mcp-servers.js";
import { findSkillByName } from "../db/queries/skills.js";
import type { modelTiers } from "../db/schema.js";
import { getEnv } from "../env.js";

type ModelTierRow = typeof modelTiers.$inferSelect;

// Row type from our messages table
interface DbMessage {
  role: string;
  content: unknown;
  toolCalls?: unknown;
  toolCallId?: string | null;
  toolName?: string | null;
}

export const pickModel = (models: ModelTierRow[]): ModelTierRow => {
  if (models.length === 0) {
    throw new Error("No enabled models available for this tier");
  }
  if (models.length === 1) {
    return models[0];
  }

  const totalWeight = models.reduce((sum, m) => sum + m.weight, 0);
  let random = Math.random() * totalWeight;
  for (const model of models) {
    random -= model.weight;
    if (random <= 0) {
      return model;
    }
  }
  return models[models.length - 1];
};

export const createModelInstance = (row: ModelTierRow): BaseChatModel => {
  const env = getEnv();

  const configs: Record<ModelProvider, () => ModelConfig> = {
    volcengine: () => ({
      provider: "volcengine" as const,
      model: row.apiModelId,
      apiKey: env.VOLCENGINE_API_KEY ?? "",
      baseUrl: env.VOLCENGINE_BASE_URL,
    }),
    openai: () => ({
      provider: "openai" as const,
      model: row.apiModelId,
      apiKey: env.OPENAI_API_KEY ?? "",
    }),
    anthropic: () => ({
      provider: "anthropic" as const,
      model: row.apiModelId,
      apiKey: env.ANTHROPIC_API_KEY ?? "",
    }),
  };

  const factory = configs[row.provider as ModelProvider];
  if (!factory) {
    throw new Error(`Unknown provider: ${row.provider}`);
  }

  return createModel(factory());
};

export interface CreateAgentOptions {
  model: BaseChatModel;
  systemPrompt: string;
  db: Db;
  userId: string;
  askUserResolver?: AskUserResolver;
}

/**
 * Create a fully configured agent with all middleware for a session.
 */
export const createAgentForSession = async (options: CreateAgentOptions) => {
  const { model, systemPrompt, db, userId, askUserResolver } = options;

  const middleware: AgentMiddleware[] = [];

  // Web search middleware
  middleware.push(webSearchMiddleware);

  // Skill middleware — resolves skills from DB
  const skillResolver: SkillResolver = async (name) => {
    const skill = await findSkillByName(db, userId, name);
    if (!skill) return null;
    return {
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      content: skill.content,
    };
  };
  middleware.push(createSkillMiddleware({ resolver: skillResolver }));

  // Ask user middleware — blocks until user responds via /respond
  if (askUserResolver) {
    middleware.push(createAskUserMiddleware({ resolver: askUserResolver }));
  }

  // MCP middleware — connect to user's enabled MCP servers
  let mcpManager: ReturnType<typeof createMcpMiddleware>["mcpManager"] | undefined;
  try {
    const mcpConfigs = await findEnabledMcpServersByUser(db, userId);
    if (mcpConfigs.length > 0) {
      const mcpResult = createMcpMiddleware({
        servers: mcpConfigs.map((config) => ({
          name: config.name,
          transport: config.transport as "stdio" | "sse" | "streamable-http",
          command: config.command ?? undefined,
          args: (config.args as string[]) ?? undefined,
          url: config.url ?? undefined,
          env: (config.env as Record<string, string>) ?? undefined,
        })),
      });
      middleware.push(mcpResult.middleware);
      mcpManager = mcpResult.mcpManager;
    }
  } catch {
    // If MCP loading fails entirely, continue without MCP tools
  }

  // Tool search middleware — should be last so it can discover all other tools
  middleware.push(createToolSearchMiddleware());

  const agent = createManoAgent({ model, middleware, systemPrompt });

  return { agent, mcpManager };
};

export const createSimpleAgent = (model: BaseChatModel, systemPrompt: string) => {
  return createManoAgent({ model, systemPrompt });
};

/**
 * Convert our DB message rows to LangChain BaseMessage instances
 * for feeding into the agent.
 */
export const dbMessagesToLangChain = (rows: DbMessage[]): BaseMessage[] => {
  return rows.map((row) => {
    const content = typeof row.content === "string" ? row.content : JSON.stringify(row.content);

    switch (row.role) {
      case "system":
        return new SystemMessage(content);
      case "user":
        return new HumanMessage(content);
      case "assistant": {
        const toolCalls = Array.isArray(row.toolCalls) ? row.toolCalls : undefined;
        return new AIMessage({
          content,
          tool_calls: toolCalls as AIMessage["tool_calls"],
        });
      }
      case "tool":
        return new ToolMessage({
          content,
          tool_call_id: row.toolCallId ?? "",
          name: row.toolName ?? undefined,
        });
      default:
        return new HumanMessage(content);
    }
  });
};
