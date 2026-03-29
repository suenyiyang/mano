import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import { convertMessagesToVolcengineParams } from "./messages-to-params.js";

describe("convertMessagesToVolcengineParams", () => {
  it("converts a SystemMessage", () => {
    const messages = [new SystemMessage("You are helpful.")];
    const result = convertMessagesToVolcengineParams(messages);
    expect(result).toEqual([{ role: "system", content: "You are helpful." }]);
  });

  it("converts a HumanMessage with string content", () => {
    const messages = [new HumanMessage("Hello")];
    const result = convertMessagesToVolcengineParams(messages);
    expect(result).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("converts a HumanMessage with multimodal content", () => {
    const messages = [
      new HumanMessage({
        content: [
          { type: "text", text: "What is this?" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/img.png" },
          },
        ],
      }),
    ];
    const result = convertMessagesToVolcengineParams(messages);
    expect(result).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/img.png" },
          },
        ],
      },
    ]);
  });

  it("converts an AIMessage with text content", () => {
    const messages = [new AIMessage("Hi there")];
    const result = convertMessagesToVolcengineParams(messages);
    expect(result).toEqual([{ role: "assistant", content: "Hi there" }]);
  });

  it("converts an AIMessage with tool_calls", () => {
    const messages = [
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call_1",
            name: "get_weather",
            args: { location: "Beijing" },
          },
        ],
      }),
    ];
    const result = convertMessagesToVolcengineParams(messages);
    expect(result).toEqual([
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"location":"Beijing"}',
            },
          },
        ],
      },
    ]);
  });

  it("converts an AIMessage with reasoning_content in additional_kwargs", () => {
    const messages = [
      new AIMessage({
        content: "The answer is 42.",
        additional_kwargs: {
          reasoning_content: "Let me think about this...",
        },
      }),
    ];
    const result = convertMessagesToVolcengineParams(messages);
    expect(result).toEqual([
      {
        role: "assistant",
        content: "The answer is 42.",
        reasoning_content: "Let me think about this...",
      },
    ]);
  });

  it("converts an AIMessage with reasoning content blocks", () => {
    const messages = [
      new AIMessage({
        content: [
          { type: "reasoning", reasoning: "Thinking..." },
          { type: "text", text: "The answer is 42." },
        ],
      }),
    ];
    const result = convertMessagesToVolcengineParams(messages);
    expect(result).toEqual([
      {
        role: "assistant",
        content: "The answer is 42.",
        reasoning_content: "Thinking...",
      },
    ]);
  });

  it("converts a ToolMessage", () => {
    const messages = [
      new ToolMessage({
        content: '{"temp": 20}',
        tool_call_id: "call_1",
      }),
    ];
    const result = convertMessagesToVolcengineParams(messages);
    expect(result).toEqual([
      {
        role: "tool",
        content: '{"temp": 20}',
        tool_call_id: "call_1",
      },
    ]);
  });

  it("converts a multi-message conversation", () => {
    const messages = [
      new SystemMessage("You are a helper."),
      new HumanMessage("What is 1+1?"),
      new AIMessage("2"),
      new HumanMessage("Thanks!"),
    ];
    const result = convertMessagesToVolcengineParams(messages);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ role: "system", content: "You are a helper." });
    expect(result[1]).toEqual({ role: "user", content: "What is 1+1?" });
    expect(result[2]).toEqual({ role: "assistant", content: "2" });
    expect(result[3]).toEqual({ role: "user", content: "Thanks!" });
  });
});
