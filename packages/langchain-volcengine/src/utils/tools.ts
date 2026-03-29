import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import type { VolcengineFunctionTool, VolcengineResponsesFunctionTool } from "../types.js";

/**
 * Convert a LangChain BindToolsInput to a Volcengine Chat Completions function tool definition.
 * Chat Completions API uses nested format: { type: "function", function: { name, description, parameters } }
 */
export const convertToVolcengineTool = (tool: BindToolsInput): VolcengineFunctionTool => {
  if (isVolcengineFunctionTool(tool)) {
    return tool;
  }
  const openAITool = convertToOpenAITool(tool);
  return openAITool as VolcengineFunctionTool;
};

/**
 * Convert a Chat Completions tool to a Responses API tool (flat format).
 * Responses API uses flat format: { type: "function", name, description, parameters, strict }
 */
export const convertToResponsesTool = (
  tool: VolcengineFunctionTool,
): VolcengineResponsesFunctionTool => {
  return {
    type: "function",
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
    strict: true,
  };
};

const isVolcengineFunctionTool = (tool: unknown): tool is VolcengineFunctionTool => {
  return (
    typeof tool === "object" &&
    tool !== null &&
    "type" in tool &&
    (tool as { type: string }).type === "function" &&
    "function" in tool &&
    typeof (tool as { function: unknown }).function === "object"
  );
};
