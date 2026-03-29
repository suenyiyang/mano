import { describe, expect, it } from "vitest";
import type { VolcengineResponsesObject } from "../types.js";
import { convertResponsesOutputToAIMessage } from "./responses-output-to-message.js";

const makeResponse = (
  overrides?: Partial<VolcengineResponsesObject>,
): VolcengineResponsesObject => ({
  id: "resp-001",
  object: "response",
  created_at: 1700000000,
  model: "doubao-seed-2-0-pro-260215",
  status: "completed",
  output: [],
  usage: {
    input_tokens: 10,
    output_tokens: 20,
    total_tokens: 30,
  },
  ...overrides,
});

describe("convertResponsesOutputToAIMessage", () => {
  it("converts a text-only response", () => {
    const response = makeResponse({
      output: [
        {
          type: "message",
          id: "msg-1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Hello!" }],
        },
      ],
    });

    const result = convertResponsesOutputToAIMessage(response);

    expect(result.content).toBe("Hello!");
    expect(result.id).toBe("resp-001");
    expect(result.tool_calls).toEqual([]);
    expect(result.response_metadata?.response_id).toBe("resp-001");
    expect(result.response_metadata?.status).toBe("completed");
  });

  it("converts a response with reasoning", () => {
    const response = makeResponse({
      output: [
        {
          type: "reasoning",
          id: "reasoning-1",
          status: "completed",
          summary: [{ type: "summary_text", text: "Let me think..." }],
        },
        {
          type: "message",
          id: "msg-1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "42" }],
        },
      ],
    });

    const result = convertResponsesOutputToAIMessage(response);

    expect(result.content).toEqual([
      { type: "reasoning", reasoning: "Let me think..." },
      { type: "text", text: "42" },
    ]);
    expect(result.additional_kwargs.reasoning_content).toBe("Let me think...");
  });

  it("converts a response with function calls", () => {
    const response = makeResponse({
      output: [
        {
          type: "function_call",
          id: "fc-1",
          call_id: "call_abc",
          name: "get_weather",
          arguments: '{"city":"Beijing"}',
          status: "completed",
        },
      ],
    });

    const result = convertResponsesOutputToAIMessage(response);

    expect(result.tool_calls).toEqual([
      {
        id: "call_abc",
        name: "get_weather",
        args: { city: "Beijing" },
        type: "tool_call",
      },
    ]);
  });

  it("includes cached_tokens in usage metadata", () => {
    const response = makeResponse({
      output: [
        {
          type: "message",
          id: "msg-1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Cached response" }],
        },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        total_tokens: 120,
        input_tokens_details: { cached_tokens: 80 },
      },
    });

    const result = convertResponsesOutputToAIMessage(response);

    expect(result.usage_metadata?.input_token_details).toEqual({ cache_read: 80 });
  });

  it("includes reasoning_tokens in usage metadata", () => {
    const response = makeResponse({
      output: [
        {
          type: "message",
          id: "msg-1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Answer" }],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 50,
        total_tokens: 60,
        output_tokens_details: { reasoning_tokens: 30 },
      },
    });

    const result = convertResponsesOutputToAIMessage(response);

    expect(result.usage_metadata?.output_token_details).toEqual({ reasoning: 30 });
  });

  it("handles malformed function call arguments", () => {
    const response = makeResponse({
      output: [
        {
          type: "function_call",
          id: "fc-1",
          call_id: "call_xyz",
          name: "do_thing",
          arguments: "not-json",
          status: "completed",
        },
      ],
    });

    const result = convertResponsesOutputToAIMessage(response);

    expect(result.tool_calls?.[0].args).toEqual({ __raw: "not-json" });
  });

  it("handles multiple output text parts", () => {
    const response = makeResponse({
      output: [
        {
          type: "message",
          id: "msg-1",
          role: "assistant",
          status: "completed",
          content: [
            { type: "output_text", text: "Part 1. " },
            { type: "output_text", text: "Part 2." },
          ],
        },
      ],
    });

    const result = convertResponsesOutputToAIMessage(response);

    expect(result.content).toBe("Part 1. Part 2.");
  });
});
