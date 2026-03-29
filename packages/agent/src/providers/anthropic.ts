import { ChatAnthropic } from "@langchain/anthropic";
import type { AnthropicModelConfig } from "../types.js";

export const createAnthropicModel = (config: AnthropicModelConfig) => {
  return new ChatAnthropic({
    model: config.model,
    apiKey: config.apiKey,
  });
};
