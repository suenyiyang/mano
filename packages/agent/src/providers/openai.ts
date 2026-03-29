import { ChatOpenAI } from "@langchain/openai";
import type { OpenAIModelConfig } from "../types.js";

export const createOpenAIModel = (config: OpenAIModelConfig) => {
  return new ChatOpenAI({
    model: config.model,
    apiKey: config.apiKey,
    useResponsesApi: true,
  });
};
