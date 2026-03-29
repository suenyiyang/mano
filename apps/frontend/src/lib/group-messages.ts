import type { Message, ToolCallData } from "../types/api.js";
import type { ContentBlock, MessageTurn } from "../types/message-turn.js";

export const groupMessages = (messages: Message[]): MessageTurn[] => {
  const turns: MessageTurn[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];
    if (!msg) break;

    if (msg.role === "user") {
      turns.push({ type: "user", message: msg });
      i++;
      continue;
    }

    // Group assistant + tool messages by responseId
    if (msg.role === "assistant") {
      const responseId = msg.responseId ?? msg.id;
      const blocks: ContentBlock[] = [];

      // Process the assistant message content
      const content = typeof msg.content === "string" ? msg.content : "";
      if (content) {
        blocks.push({ type: "text", content });
      }

      // Process tool calls from the assistant message
      const toolCalls = (msg.toolCalls ?? []) as ToolCallData[];
      for (const tc of toolCalls) {
        blocks.push({
          type: "tool_call",
          toolCallId: tc.id,
          name: tc.name,
          label: tc.arguments,
          status: "done",
        });
      }

      i++;

      // Collect following tool result messages with the same responseId
      while (i < messages.length) {
        const next = messages[i];
        if (!next) break;
        if (next.role === "tool" && next.responseId === responseId) {
          // Update the matching tool call status
          const toolCallId = next.toolCallId;
          if (toolCallId) {
            for (let j = 0; j < blocks.length; j++) {
              const block = blocks[j];
              if (block && block.type === "tool_call" && block.toolCallId === toolCallId) {
                blocks[j] = { ...block, status: "done" };
              }
            }
          }
          i++;
        } else if (next.role === "assistant" && next.responseId === responseId) {
          // Continuation assistant message (after tool results)
          const nextContent = typeof next.content === "string" ? next.content : "";
          if (nextContent) {
            blocks.push({ type: "text", content: nextContent });
          }
          const nextToolCalls = (next.toolCalls ?? []) as ToolCallData[];
          for (const tc of nextToolCalls) {
            blocks.push({
              type: "tool_call",
              toolCallId: tc.id,
              name: tc.name,
              label: tc.arguments,
              status: "done",
            });
          }
          i++;
        } else {
          break;
        }
      }

      turns.push({
        type: "agent",
        responseId,
        timestamp: msg.createdAt,
        blocks,
      });
      continue;
    }

    // Skip orphaned tool messages
    i++;
  }

  return turns;
};
