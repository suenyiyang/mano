import { describe, expect, it } from "vitest";
import type { VolcengineChatCompletion, VolcengineResponseMessage } from "../types.js";
import { convertVolcengineResponseToAIMessage } from "./response-to-message.js";

const makeResponse = (
  message: VolcengineResponseMessage,
  overrides?: Partial<VolcengineChatCompletion>,
): VolcengineChatCompletion => ({
  id: "resp-123",
  object: "chat.completion",
  created: 1700000000,
  model: "doubao-seed-2-0-pro-260215",
  choices: [{ index: 0, message, finish_reason: "stop" }],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
  },
  ...overrides,
});

describe("convertVolcengineResponseToAIMessage", () => {
  it("converts a text-only response", () => {
    const message: VolcengineResponseMessage = {
      role: "assistant",
      content: "Hello!",
    };
    const response = makeResponse(message);
    const result = convertVolcengineResponseToAIMessage(message, response, "stop");

    expect(result.content).toBe("Hello!");
    expect(result.id).toBe("resp-123");
    expect(result.tool_calls).toEqual([]);
    expect(result.usage_metadata).toEqual({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      input_token_details: undefined,
      output_token_details: undefined,
    });
    expect(result.response_metadata).toMatchObject({
      model: "doubao-seed-2-0-pro-260215",
      finish_reason: "stop",
    });
  });

  it("converts a response with reasoning_content", () => {
    const message: VolcengineResponseMessage = {
      role: "assistant",
      content: "The answer is 42.",
      reasoning_content: "Let me think step by step...",
    };
    const response = makeResponse(message);
    const result = convertVolcengineResponseToAIMessage(message, response, "stop");

    expect(result.content).toEqual([
      { type: "reasoning", reasoning: "Let me think step by step..." },
      { type: "text", text: "The answer is 42." },
    ]);
    expect(result.additional_kwargs.reasoning_content).toBe("Let me think step by step...");
  });

  it("converts a response with tool_calls", () => {
    const message: VolcengineResponseMessage = {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_abc",
          type: "function",
          function: {
            name: "get_weather",
            arguments: '{"city":"Beijing"}',
          },
        },
      ],
    };
    const response = makeResponse(message);
    const result = convertVolcengineResponseToAIMessage(message, response, "tool_calls");

    expect(result.tool_calls).toEqual([
      {
        id: "call_abc",
        name: "get_weather",
        args: { city: "Beijing" },
        type: "tool_call",
      },
    ]);
    expect(result.content).toBe("");
  });

  it("handles malformed tool call arguments gracefully", () => {
    const message: VolcengineResponseMessage = {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_xyz",
          type: "function",
          function: {
            name: "do_thing",
            arguments: "not-json",
          },
        },
      ],
    };
    const response = makeResponse(message);
    const result = convertVolcengineResponseToAIMessage(message, response, "tool_calls");

    expect(result.tool_calls?.[0].args).toEqual({ __raw: "not-json" });
  });

  it("includes reasoning_tokens in output_token_details", () => {
    const message: VolcengineResponseMessage = {
      role: "assistant",
      content: "Answer",
    };
    const response = makeResponse(message, {
      usage: {
        prompt_tokens: 10,
        completion_tokens: 50,
        total_tokens: 60,
        completion_tokens_details: { reasoning_tokens: 30 },
      },
    });
    const result = convertVolcengineResponseToAIMessage(message, response, "stop");

    expect(result.usage_metadata?.output_token_details).toEqual({
      reasoning: 30,
    });
  });

  it("includes cached_tokens in input_token_details", () => {
    const message: VolcengineResponseMessage = {
      role: "assistant",
      content: "Answer",
    };
    const response = makeResponse(message, {
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        prompt_tokens_details: { cached_tokens: 80 },
      },
    });
    const result = convertVolcengineResponseToAIMessage(message, response, "stop");

    expect(result.usage_metadata?.input_token_details).toEqual({
      cache_read: 80,
    });
  });

  it("includes moderation_hit_type in response_metadata", () => {
    const message: VolcengineResponseMessage = {
      role: "assistant",
      content: "Filtered",
    };
    const response = makeResponse(message, {
      moderation_hit_type: "violence",
    });
    const result = convertVolcengineResponseToAIMessage(message, response, "content_filter");

    expect(result.response_metadata?.moderation_hit_type).toBe("violence");
  });
});
