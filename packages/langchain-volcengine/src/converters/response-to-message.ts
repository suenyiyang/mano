import { AIMessage } from "@langchain/core/messages";
import type {
  VolcengineChatCompletion,
  VolcengineResponseMessage,
  VolcengineUsage,
} from "../types.js";

/**
 * Convert a Volcengine response message to a LangChain AIMessage.
 */
export const convertVolcengineResponseToAIMessage = (
  message: VolcengineResponseMessage,
  rawResponse: VolcengineChatCompletion,
  finishReason: string,
): AIMessage => {
  // Build content: if reasoning_content exists, use content block array
  const content = buildContent(message);

  // Parse tool_calls into LangChain format
  const toolCalls = message.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    args: safeParseJson(tc.function.arguments),
    type: "tool_call" as const,
  }));

  // Build additional_kwargs
  const additionalKwargs: Record<string, unknown> = {};
  if (message.reasoning_content) {
    additionalKwargs.reasoning_content = message.reasoning_content;
  }
  if (message.tool_calls) {
    additionalKwargs.tool_calls = message.tool_calls;
  }

  // Build usage_metadata
  const usageMetadata = rawResponse.usage ? buildUsageMetadata(rawResponse.usage) : undefined;

  // Build response_metadata
  const responseMetadata: Record<string, unknown> = {
    model: rawResponse.model,
    finish_reason: finishReason,
  };
  if (rawResponse.moderation_hit_type) {
    responseMetadata.moderation_hit_type = rawResponse.moderation_hit_type;
  }
  if (rawResponse.service_tier) {
    responseMetadata.service_tier = rawResponse.service_tier;
  }

  return new AIMessage({
    content,
    tool_calls: toolCalls ?? [],
    additional_kwargs: additionalKwargs,
    usage_metadata: usageMetadata,
    response_metadata: responseMetadata,
    id: rawResponse.id,
  });
};

const buildContent = (
  message: VolcengineResponseMessage,
): string | Array<{ type: string; [key: string]: unknown }> => {
  if (message.reasoning_content) {
    const blocks: Array<{ type: string; [key: string]: unknown }> = [];
    blocks.push({
      type: "reasoning",
      reasoning: message.reasoning_content,
    });
    blocks.push({
      type: "text",
      text: message.content ?? "",
    });
    return blocks;
  }
  return message.content ?? "";
};

export const buildUsageMetadata = (usage: VolcengineUsage) => {
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
