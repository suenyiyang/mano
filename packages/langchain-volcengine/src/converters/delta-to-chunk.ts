import { AIMessageChunk } from "@langchain/core/messages";
import type { VolcengineChatCompletionChunk, VolcengineStreamDelta } from "../types.js";
import { buildUsageMetadata } from "./response-to-message.js";

/**
 * Convert a Volcengine streaming delta to a LangChain AIMessageChunk.
 */
export const convertVolcengineDeltaToAIMessageChunk = (
  delta: VolcengineStreamDelta,
  chunk: VolcengineChatCompletionChunk,
  finishReason: string | null,
): AIMessageChunk => {
  const content = buildDeltaContent(delta);
  const toolCallChunks = buildToolCallChunks(delta);

  const additionalKwargs: Record<string, unknown> = {};
  if (delta.reasoning_content) {
    additionalKwargs.reasoning_content = delta.reasoning_content;
  }
  if (delta.tool_calls) {
    additionalKwargs.tool_calls = delta.tool_calls;
  }

  const responseMetadata: Record<string, unknown> = {};
  if (finishReason) {
    responseMetadata.finish_reason = finishReason;
  }

  const usageMetadata = chunk.usage ? buildUsageMetadata(chunk.usage) : undefined;

  return new AIMessageChunk({
    content,
    tool_call_chunks: toolCallChunks,
    additional_kwargs: additionalKwargs,
    usage_metadata: usageMetadata,
    response_metadata: responseMetadata,
    id: chunk.id,
  });
};

const buildDeltaContent = (
  delta: VolcengineStreamDelta,
): string | Array<{ type: string; [key: string]: unknown }> => {
  const hasReasoning = delta.reasoning_content != null && delta.reasoning_content !== "";
  const hasContent = delta.content != null && delta.content !== "";

  if (hasReasoning && hasContent) {
    return [
      { type: "reasoning", reasoning: delta.reasoning_content as string },
      { type: "text", text: delta.content as string },
    ];
  }

  if (hasReasoning) {
    return [{ type: "reasoning", reasoning: delta.reasoning_content as string }];
  }

  if (hasContent) {
    return delta.content as string;
  }

  return "";
};

const buildToolCallChunks = (delta: VolcengineStreamDelta) => {
  if (!delta.tool_calls?.length) {
    return [];
  }

  return delta.tool_calls.map((tc) => ({
    index: tc.index,
    id: tc.id,
    name: tc.function?.name,
    args: tc.function?.arguments ?? "",
    type: "tool_call_chunk" as const,
  }));
};
