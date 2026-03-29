import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { BackendProtocol } from "deepagents";
import type { AgentMiddleware } from "langchain";

export type ModelProvider = "volcengine" | "openai" | "anthropic";

export interface VolcengineModelConfig {
  provider: "volcengine";
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface OpenAIModelConfig {
  provider: "openai";
  model: string;
  apiKey: string;
}

export interface AnthropicModelConfig {
  provider: "anthropic";
  model: string;
  apiKey: string;
}

export type ModelConfig = VolcengineModelConfig | OpenAIModelConfig | AnthropicModelConfig;

export interface ManoAgentConfig {
  model: BaseChatModel;
  systemPrompt?: string;
  tools?: StructuredToolInterface[];
  middleware?: AgentMiddleware[];
  /**
   * DeepAgents filesystem backend.
   * Pass a Sandbox's `backend` property for sandboxed execution.
   * If omitted, DeepAgents uses its default StateBackend (in-memory).
   */
  backend?: BackendProtocol;
}
