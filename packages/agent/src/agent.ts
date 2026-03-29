import { createDeepAgent } from "deepagents";
import type { ManoAgentConfig } from "./types.js";

export const createManoAgent = (config: ManoAgentConfig) => {
  return createDeepAgent({
    model: config.model,
    tools: config.tools ?? [],
    middleware: config.middleware ?? [],
    systemPrompt: config.systemPrompt,
  });
};
