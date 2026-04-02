import type { Message } from "./api.js";

export type ContentBlock =
  | { type: "text"; content: string }
  | {
      type: "tool_call";
      toolCallId: string;
      name: string;
      label: string | Record<string, unknown>;
      status: "running" | "done" | "error";
      resultContent?: string;
    }
  | { type: "step"; label: string; status: "running" | "done" }
  | { type: "error"; message: string };

export type MessageTurn =
  | { type: "user"; message: Message }
  | { type: "agent"; responseId: string; timestamp: string; blocks: ContentBlock[] };
