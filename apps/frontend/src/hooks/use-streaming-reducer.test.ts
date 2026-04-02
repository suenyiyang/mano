import { describe, expect, it } from "vitest";
import type { Message } from "../types/api.js";
import {
  initialState,
  type StreamingAction,
  type StreamingState,
  streamingReducer,
} from "./use-streaming-reducer.js";

const reduce = (actions: StreamingAction[]): StreamingState => {
  return actions.reduce(streamingReducer, initialState);
};

describe("streamingReducer", () => {
  it("returns initial state for unknown action", () => {
    const state = streamingReducer(initialState, { type: "RESET" });
    expect(state).toEqual(initialState);
  });

  describe("RESPONSE_START", () => {
    it("sets isStreaming and responseId", () => {
      const state = reduce([{ type: "RESPONSE_START", responseId: "resp-1" }]);
      expect(state.isStreaming).toBe(true);
      expect(state.responseId).toBe("resp-1");
      expect(state.contentBlocks).toEqual([]);
    });

    it("resets previous state", () => {
      const withError = reduce([{ type: "ERROR", error: "oops" }]);
      expect(withError.error).toBe("oops");

      const restarted = streamingReducer(withError, {
        type: "RESPONSE_START",
        responseId: "resp-2",
      });
      expect(restarted.error).toBeNull();
      expect(restarted.isStreaming).toBe(true);
    });
  });

  describe("TEXT_DELTA", () => {
    it("creates a new text block", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "TEXT_DELTA", text: "Hello" },
      ]);
      expect(state.contentBlocks).toEqual([{ type: "text", content: "Hello" }]);
    });

    it("appends to existing text block", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "TEXT_DELTA", text: "Hello " },
        { type: "TEXT_DELTA", text: "world" },
      ]);
      expect(state.contentBlocks).toEqual([{ type: "text", content: "Hello world" }]);
    });

    it("creates new text block after a tool call", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "TEXT_DELTA", text: "Before" },
        { type: "TOOL_CALL_START", toolCallId: "tc1", name: "read_file" },
        { type: "TEXT_DELTA", text: "After" },
      ]);
      expect(state.contentBlocks).toHaveLength(3);
      expect(state.contentBlocks[0]).toEqual({ type: "text", content: "Before" });
      expect(state.contentBlocks[1]).toMatchObject({ type: "tool_call", name: "read_file" });
      expect(state.contentBlocks[2]).toEqual({ type: "text", content: "After" });
    });
  });

  describe("TOOL_CALL lifecycle", () => {
    it("adds a tool call block on START", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "TOOL_CALL_START", toolCallId: "tc1", name: "write_file" },
      ]);
      expect(state.contentBlocks).toEqual([
        {
          type: "tool_call",
          toolCallId: "tc1",
          name: "write_file",
          label: "",
          status: "running",
        },
      ]);
    });

    it("accumulates label on DELTA", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "TOOL_CALL_START", toolCallId: "tc1", name: "write_file" },
        { type: "TOOL_CALL_DELTA", toolCallId: "tc1", argumentsDelta: '{"path":' },
        { type: "TOOL_CALL_DELTA", toolCallId: "tc1", argumentsDelta: '"index.html"}' },
      ]);
      const block = state.contentBlocks[0];
      expect(block).toMatchObject({
        type: "tool_call",
        label: '{"path":"index.html"}',
      });
    });

    it("keeps running status on END", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "TOOL_CALL_START", toolCallId: "tc1", name: "read_file" },
        { type: "TOOL_CALL_END", toolCallId: "tc1" },
      ]);
      expect(state.contentBlocks[0]).toMatchObject({ status: "running" });
    });

    it("marks done on successful RESULT and stores resultContent", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "TOOL_CALL_START", toolCallId: "tc1", name: "read_file" },
        { type: "TOOL_CALL_END", toolCallId: "tc1" },
        { type: "TOOL_RESULT", toolCallId: "tc1", content: "file contents", isError: false },
      ]);
      expect(state.contentBlocks[0]).toMatchObject({
        status: "done",
        resultContent: "file contents",
      });
    });

    it("marks error on failed RESULT and stores resultContent", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "TOOL_CALL_START", toolCallId: "tc1", name: "read_file" },
        { type: "TOOL_RESULT", toolCallId: "tc1", content: "not found", isError: true },
      ]);
      expect(state.contentBlocks[0]).toMatchObject({
        status: "error",
        resultContent: "not found",
      });
    });
  });

  describe("ASK_USER", () => {
    it("sets askUser state", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        {
          type: "ASK_USER",
          toolCallId: "tc1",
          question: "Which file?",
          options: ["a.ts", "b.ts"],
        },
      ]);
      expect(state.askUser).toEqual({
        toolCallId: "tc1",
        question: "Which file?",
        options: ["a.ts", "b.ts"],
      });
    });
  });

  describe("DONE", () => {
    it("stops streaming and records usage", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "TEXT_DELTA", text: "Hello" },
        { type: "DONE", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
      ]);
      expect(state.isStreaming).toBe(false);
      expect(state.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
      expect(state.contentBlocks).toHaveLength(1);
    });

    it("clears askUser state on DONE", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "ASK_USER", toolCallId: "tc1", question: "Which file?" },
        { type: "DONE", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
      ]);
      expect(state.askUser).toBeNull();
      expect(state.isStreaming).toBe(false);
    });
  });

  describe("ERROR", () => {
    it("stops streaming and records error", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "ERROR", error: "rate limited" },
      ]);
      expect(state.isStreaming).toBe(false);
      expect(state.error).toBe("rate limited");
    });

    it("clears askUser state on ERROR", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "ASK_USER", toolCallId: "tc1", question: "Which file?" },
        { type: "ERROR", error: "something broke" },
      ]);
      expect(state.askUser).toBeNull();
      expect(state.isStreaming).toBe(false);
    });
  });

  describe("MESSAGE_COMPLETE", () => {
    it("is a no-op (state unchanged)", () => {
      const before = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "TEXT_DELTA", text: "Hello" },
      ]);
      const after = streamingReducer(before, {
        type: "MESSAGE_COMPLETE",
        message: { id: "m1" } as Message,
      });
      expect(after).toBe(before);
    });
  });

  describe("full interleaved sequence", () => {
    it("produces correct content blocks for text → tool → text", () => {
      const state = reduce([
        { type: "RESPONSE_START", responseId: "r1" },
        { type: "TEXT_DELTA", text: "Let me check the file." },
        { type: "TOOL_CALL_START", toolCallId: "tc1", name: "read_file" },
        { type: "TOOL_CALL_DELTA", toolCallId: "tc1", argumentsDelta: '{"path":"index.html"}' },
        { type: "TOOL_CALL_END", toolCallId: "tc1" },
        { type: "TOOL_RESULT", toolCallId: "tc1", content: "<html>", isError: false },
        { type: "TEXT_DELTA", text: "The file contains HTML." },
        { type: "DONE", usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } },
      ]);

      expect(state.isStreaming).toBe(false);
      expect(state.contentBlocks).toHaveLength(3);
      expect(state.contentBlocks[0]).toEqual({
        type: "text",
        content: "Let me check the file.",
      });
      expect(state.contentBlocks[1]).toMatchObject({
        type: "tool_call",
        name: "read_file",
        status: "done",
      });
      expect(state.contentBlocks[2]).toEqual({
        type: "text",
        content: "The file contains HTML.",
      });
    });
  });
});
