import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ModelConfig } from "../types.js";
import { createAnthropicModel } from "./anthropic.js";
import { createOpenAIModel } from "./openai.js";
import { createVolcengineModel } from "./volcengine.js";

export const createModel = (config: ModelConfig): BaseChatModel => {
  switch (config.provider) {
    case "volcengine":
      return createVolcengineModel(config);
    case "openai":
      return createOpenAIModel(config);
    case "anthropic":
      return createAnthropicModel(config);
  }
};

export { createAnthropicModel } from "./anthropic.js";
export { createOpenAIModel } from "./openai.js";
export { createVolcengineModel } from "./volcengine.js";
