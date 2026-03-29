import { ChatVolcengine } from "@mano/langchain-volcengine";
import type { VolcengineModelConfig } from "../types.js";

const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

export const createVolcengineModel = (config: VolcengineModelConfig) => {
  return new ChatVolcengine({
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
    useResponsesApi: true,
    caching: {
      type: "enabled",
    },
  });
};
