import { describe, expect, it } from "vitest";
import type { Message } from "../types/api.js";
import { groupMessages } from "./group-messages.js";

const makeMsg = (overrides: Partial<Message> & Pick<Message, "id" | "role">): Message => ({
  sessionId: "s1",
  content: "",
  toolCalls: null,
  toolCallId: null,
  toolName: null,
  ordinal: 0,
  modelId: null,
  responseId: null,
  tokenUsage: null,
  isCompacted: false,
  createdAt: "2025-01-01T00:00:00Z",
  ...overrides,
});

describe("groupMessages", () => {
  it("returns empty array for empty input", () => {
    expect(groupMessages([])).toEqual([]);
  });

  it("groups a single user message as a user turn", () => {
    const msg = makeMsg({ id: "m1", role: "user", content: "Hello" });
    const turns = groupMessages([msg]);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toEqual({ type: "user", message: msg });
  });

  it("groups a single assistant message as an agent turn", () => {
    const msg = makeMsg({
      id: "m1",
      role: "assistant",
      content: "Hi there",
      responseId: "r1",
    });
    const turns = groupMessages([msg]);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      type: "agent",
      responseId: "r1",
      blocks: [{ type: "text", content: "Hi there" }],
    });
  });

  it("groups user → assistant as two turns", () => {
    const turns = groupMessages([
      makeMsg({ id: "m1", role: "user", content: "Hello", ordinal: 1 }),
      makeMsg({
        id: "m2",
        role: "assistant",
        content: "Hi",
        responseId: "r1",
        ordinal: 2,
      }),
    ]);
    expect(turns).toHaveLength(2);
    expect(turns[0]?.type).toBe("user");
    expect(turns[1]?.type).toBe("agent");
  });

  it("groups assistant + tool messages with same responseId", () => {
    const turns = groupMessages([
      makeMsg({
        id: "m1",
        role: "assistant",
        content: "Let me read the file.",
        responseId: "r1",
        toolCalls: [{ id: "tc1", name: "read_file", arguments: '{"path":"a.ts"}' }],
        ordinal: 1,
      }),
      makeMsg({
        id: "m2",
        role: "tool",
        content: "file contents",
        responseId: "r1",
        toolCallId: "tc1",
        toolName: "read_file",
        ordinal: 2,
      }),
    ]);

    expect(turns).toHaveLength(1);
    const agentTurn = turns[0];
    expect(agentTurn?.type).toBe("agent");
    if (agentTurn?.type === "agent") {
      expect(agentTurn.blocks).toHaveLength(2);
      expect(agentTurn.blocks[0]).toEqual({ type: "text", content: "Let me read the file." });
      expect(agentTurn.blocks[1]).toMatchObject({
        type: "tool_call",
        name: "read_file",
        status: "done",
        resultContent: "file contents",
      });
    }
  });

  it("handles tool calls with args field (LangChain format from DB)", () => {
    const turns = groupMessages([
      makeMsg({
        id: "m1",
        role: "assistant",
        content: "",
        responseId: "r1",
        toolCalls: [{ id: "tc1", name: "read_file", args: { path: "a.ts" } }] as never,
        ordinal: 1,
      }),
      makeMsg({
        id: "m2",
        role: "tool",
        content: "file contents",
        responseId: "r1",
        toolCallId: "tc1",
        toolName: "read_file",
        ordinal: 2,
      }),
    ]);

    expect(turns).toHaveLength(1);
    if (turns[0]?.type === "agent") {
      expect(turns[0].blocks[0]).toMatchObject({
        type: "tool_call",
        name: "read_file",
        label: { path: "a.ts" },
        resultContent: "file contents",
      });
    }
  });

  it("handles interleaved assistant → tool → assistant within same responseId", () => {
    const turns = groupMessages([
      makeMsg({
        id: "m1",
        role: "assistant",
        content: "Checking...",
        responseId: "r1",
        toolCalls: [{ id: "tc1", name: "read_file", arguments: "{}" }],
        ordinal: 1,
      }),
      makeMsg({
        id: "m2",
        role: "tool",
        responseId: "r1",
        toolCallId: "tc1",
        content: "data",
        ordinal: 2,
      }),
      makeMsg({
        id: "m3",
        role: "assistant",
        content: "Here is the result.",
        responseId: "r1",
        ordinal: 3,
      }),
    ]);

    expect(turns).toHaveLength(1);
    if (turns[0]?.type === "agent") {
      // text + tool_call + text
      expect(turns[0].blocks).toHaveLength(3);
      expect(turns[0].blocks[0]?.type).toBe("text");
      expect(turns[0].blocks[1]?.type).toBe("tool_call");
      expect(turns[0].blocks[2]?.type).toBe("text");
    }
  });

  it("separates turns with different responseIds", () => {
    const turns = groupMessages([
      makeMsg({ id: "m1", role: "user", content: "Q1", ordinal: 1 }),
      makeMsg({
        id: "m2",
        role: "assistant",
        content: "A1",
        responseId: "r1",
        ordinal: 2,
      }),
      makeMsg({ id: "m3", role: "user", content: "Q2", ordinal: 3 }),
      makeMsg({
        id: "m4",
        role: "assistant",
        content: "A2",
        responseId: "r2",
        ordinal: 4,
      }),
    ]);

    expect(turns).toHaveLength(4);
    expect(turns.map((t) => t.type)).toEqual(["user", "agent", "user", "agent"]);
  });

  it("uses message id as responseId fallback when responseId is null", () => {
    const turns = groupMessages([
      makeMsg({ id: "m1", role: "assistant", content: "No response ID" }),
    ]);

    expect(turns).toHaveLength(1);
    if (turns[0]?.type === "agent") {
      expect(turns[0].responseId).toBe("m1");
    }
  });

  it("skips orphaned tool messages", () => {
    const turns = groupMessages([
      makeMsg({ id: "m1", role: "tool", content: "orphan", toolCallId: "tc1" }),
    ]);
    expect(turns).toHaveLength(0);
  });

  it("handles assistant message with no content (only tool calls)", () => {
    const turns = groupMessages([
      makeMsg({
        id: "m1",
        role: "assistant",
        content: "",
        responseId: "r1",
        toolCalls: [{ id: "tc1", name: "write_file", arguments: '{"path":"x"}' }],
      }),
    ]);

    expect(turns).toHaveLength(1);
    if (turns[0]?.type === "agent") {
      expect(turns[0].blocks).toHaveLength(1);
      expect(turns[0].blocks[0]?.type).toBe("tool_call");
    }
  });
});
