import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { ModelConfig, ModelProvider } from "@mano/agent";
import { createManoAgent, createModel } from "@mano/agent";
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

export const createAgentForSession = (model: BaseChatModel, systemPrompt: string) => {
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
