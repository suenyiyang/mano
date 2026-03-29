import type { Message, Session, TokenUsage } from "./api.js";

export type SseEvent =
  | { type: "response_start"; responseId: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; toolCallId: string; name: string; description?: string }
  | { type: "tool_call_delta"; toolCallId: string; argumentsDelta: string }
  | { type: "tool_call_end"; toolCallId: string }
  | { type: "tool_result"; toolCallId: string; content: string; isError: boolean }
  | { type: "ask_user"; toolCallId: string; question: string; options?: string[] }
  | { type: "compaction_start"; upToOrdinal: number }
  | { type: "compaction_done"; summary: string }
  | { type: "message_complete"; message: Message }
  | { type: "session_update"; session: Session }
  | { type: "done"; usage: TokenUsage }
  | { type: "error"; error: string; code: string };
