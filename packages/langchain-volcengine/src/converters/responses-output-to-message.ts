import { AIMessage } from "@langchain/core/messages";
import type {
  VolcengineResponsesFunctionCall,
  VolcengineResponsesObject,
  VolcengineResponsesOutputMessage,
  VolcengineResponsesReasoning,
  VolcengineUsage,
} from "../types.js";

/**
 * Convert a Volcengine Responses API response to a LangChain AIMessage.
 */
export const convertResponsesOutputToAIMessage = (
  response: VolcengineResponsesObject,
): AIMessage => {
  let textContent = "";
  let reasoningContent = "";
  const toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    type: "tool_call";
  }> = [];

  for (const item of response.output) {
    if (item.type === "message") {
      textContent += extractMessageText(item);
    } else if (item.type === "reasoning") {
      reasoningContent += extractReasoningText(item);
    } else if (item.type === "function_call") {
      toolCalls.push(convertFunctionCall(item));
    }
  }

  // Build content
  const content = buildContent(textContent, reasoningContent);

  // Build additional_kwargs
  const additionalKwargs: Record<string, unknown> = {};
  if (reasoningContent) {
    additionalKwargs.reasoning_content = reasoningContent;
  }
  // Store the raw output items for function calls
  const rawToolCalls = response.output.filter((i) => i.type === "function_call");
  if (rawToolCalls.length > 0) {
    additionalKwargs.tool_calls = rawToolCalls;
  }

  // Build usage_metadata
  const usageMetadata = response.usage ? buildUsageMetadata(response.usage) : undefined;

  // Build response_metadata - include response id for previous_response_id chaining
  const responseMetadata: Record<string, unknown> = {
    model: response.model,
    status: response.status,
    response_id: response.id,
  };
  if (response.service_tier) {
    responseMetadata.service_tier = response.service_tier;
  }

  return new AIMessage({
    content,
    tool_calls: toolCalls,
    additional_kwargs: additionalKwargs,
    usage_metadata: usageMetadata,
    response_metadata: responseMetadata,
    id: response.id,
  });
};

const extractMessageText = (item: VolcengineResponsesOutputMessage): string => {
  return item.content.map((c) => c.text).join("");
};

const extractReasoningText = (item: VolcengineResponsesReasoning): string => {
  return item.summary.map((s) => s.text).join("");
};

const convertFunctionCall = (
  item: VolcengineResponsesFunctionCall,
): { id: string; name: string; args: Record<string, unknown>; type: "tool_call" } => {
  return {
    id: item.call_id,
    name: item.name,
    args: safeParseJson(item.arguments),
    type: "tool_call",
  };
};

const buildContent = (
  textContent: string,
  reasoningContent: string,
): string | Array<{ type: string; [key: string]: unknown }> => {
  if (reasoningContent) {
    return [
      { type: "reasoning", reasoning: reasoningContent },
      { type: "text", text: textContent },
    ];
  }
  return textContent;
};

const buildUsageMetadata = (usage: VolcengineUsage) => {
  const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;
  const cachedTokens =
    usage.input_tokens_details?.cached_tokens ?? usage.prompt_tokens_details?.cached_tokens;
  const reasoningTokens =
    usage.output_tokens_details?.reasoning_tokens ??
    usage.completion_tokens_details?.reasoning_tokens;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: usage.total_tokens,
    input_token_details: cachedTokens != null ? { cache_read: cachedTokens } : undefined,
    output_token_details: reasoningTokens != null ? { reasoning: reasoningTokens } : undefined,
  };
};

const safeParseJson = (str: string): Record<string, unknown> => {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return { __raw: str };
  }
};
