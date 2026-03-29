import { describe, expect, it } from "vitest";
import type { VolcengineChatCompletionChunk, VolcengineStreamDelta } from "../types.js";
import { convertVolcengineDeltaToAIMessageChunk } from "./delta-to-chunk.js";

const makeChunk = (
  delta: VolcengineStreamDelta,
  overrides?: Partial<VolcengineChatCompletionChunk>,
): VolcengineChatCompletionChunk => ({
  id: "chunk-1",
  object: "chat.completion.chunk",
  created: 1700000000,
  model: "doubao-seed-2-0-pro-260215",
  choices: [{ index: 0, delta, finish_reason: null }],
  ...overrides,
});

describe("convertVolcengineDeltaToAIMessageChunk", () => {
  it("converts a delta with text content", () => {
    const delta: VolcengineStreamDelta = { content: "Hello" };
    const chunk = makeChunk(delta);
    const result = convertVolcengineDeltaToAIMessageChunk(delta, chunk, null);

    expect(result.content).toBe("Hello");
    expect(result.id).toBe("chunk-1");
  });

  it("converts a delta with reasoning_content", () => {
    const delta: VolcengineStreamDelta = {
      reasoning_content: "Thinking...",
    };
    const chunk = makeChunk(delta);
    const result = convertVolcengineDeltaToAIMessageChunk(delta, chunk, null);

    expect(result.content).toEqual([{ type: "reasoning", reasoning: "Thinking..." }]);
    expect(result.additional_kwargs.reasoning_content).toBe("Thinking...");
  });

  it("converts a delta with both reasoning and text content", () => {
    const delta: VolcengineStreamDelta = {
      reasoning_content: "Let me think",
      content: "Answer",
    };
    const chunk = makeChunk(delta);
    const result = convertVolcengineDeltaToAIMessageChunk(delta, chunk, null);

    expect(result.content).toEqual([
      { type: "reasoning", reasoning: "Let me think" },
      { type: "text", text: "Answer" },
    ]);
  });

  it("converts a delta with tool_calls", () => {
    const delta: VolcengineStreamDelta = {
      tool_calls: [
        {
          index: 0,
          id: "call_1",
          type: "function",
          function: { name: "search", arguments: '{"q":' },
        },
      ],
    };
    const chunk = makeChunk(delta);
    const result = convertVolcengineDeltaToAIMessageChunk(delta, chunk, null);

    expect(result.tool_call_chunks).toEqual([
      {
        index: 0,
        id: "call_1",
        name: "search",
        args: '{"q":',
        type: "tool_call_chunk",
      },
    ]);
  });

  it("handles an empty delta", () => {
    const delta: VolcengineStreamDelta = {};
    const chunk = makeChunk(delta);
    const result = convertVolcengineDeltaToAIMessageChunk(delta, chunk, null);

    expect(result.content).toBe("");
    expect(result.tool_call_chunks).toEqual([]);
  });

  it("includes finish_reason in response_metadata", () => {
    const delta: VolcengineStreamDelta = { content: "" };
    const chunk = makeChunk(delta);
    const result = convertVolcengineDeltaToAIMessageChunk(delta, chunk, "stop");

    expect(result.response_metadata?.finish_reason).toBe("stop");
  });

  it("includes usage_metadata when present", () => {
    const delta: VolcengineStreamDelta = {};
    const chunk = makeChunk(delta, {
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        completion_tokens_details: { reasoning_tokens: 5 },
      },
    });
    const result = convertVolcengineDeltaToAIMessageChunk(delta, chunk, null);

    expect(result.usage_metadata).toEqual({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      input_token_details: undefined,
      output_token_details: { reasoning: 5 },
    });
  });
});
