import { ChatOpenAI } from "@langchain/openai";
import type { VolcengineModelConfig } from "../types.js";

const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

export const createVolcengineModel = (config: VolcengineModelConfig) => {
  return new ChatOpenAI({
    model: config.model,
    configuration: {
      baseURL: config.baseUrl ?? DEFAULT_BASE_URL,
      apiKey: config.apiKey,
    },
    useResponsesApi: false,
  });
};
