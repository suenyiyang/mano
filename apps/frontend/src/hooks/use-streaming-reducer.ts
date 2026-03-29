import { useReducer } from "react";
import type { Message, TokenUsage } from "../types/api.js";
import type { ContentBlock } from "../types/message-turn.js";

// ─── State ─────────────────────────────────────────────────────────────────

export interface StreamingState {
  isStreaming: boolean;
  responseId: string | null;
  contentBlocks: ContentBlock[];
  error: string | null;
  askUser: AskUserState | null;
  usage: TokenUsage | null;
}

interface AskUserState {
  toolCallId: string;
  question: string;
  options?: string[];
}

export const initialState: StreamingState = {
  isStreaming: false,
  responseId: null,
  contentBlocks: [],
  error: null,
  askUser: null,
  usage: null,
};

// ─── Actions ───────────────────────────────────────────────────────────────

export type StreamingAction =
  | { type: "RESPONSE_START"; responseId: string }
  | { type: "TEXT_DELTA"; text: string }
  | { type: "TOOL_CALL_START"; toolCallId: string; name: string }
  | { type: "TOOL_CALL_DELTA"; toolCallId: string; argumentsDelta: string }
  | { type: "TOOL_CALL_END"; toolCallId: string }
  | { type: "TOOL_RESULT"; toolCallId: string; content: string; isError: boolean }
  | { type: "ASK_USER"; toolCallId: string; question: string; options?: string[] }
  | { type: "MESSAGE_COMPLETE"; message: Message }
  | { type: "DONE"; usage: TokenUsage }
  | { type: "ERROR"; error: string }
  | { type: "RESET" }
  | { type: "CLEAR_ASK_USER" };

// ─── Reducer ───────────────────────────────────────────────────────────────

export const streamingReducer = (
  state: StreamingState,
  action: StreamingAction,
): StreamingState => {
  switch (action.type) {
    case "RESPONSE_START":
      return {
        ...initialState,
        isStreaming: true,
        responseId: action.responseId,
      };

    case "TEXT_DELTA": {
      const blocks = [...state.contentBlocks];
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.type === "text") {
        blocks[blocks.length - 1] = {
          ...lastBlock,
          content: lastBlock.content + action.text,
        };
      } else {
        blocks.push({ type: "text", content: action.text });
      }
      return { ...state, contentBlocks: blocks };
    }

    case "TOOL_CALL_START": {
      const blocks = [...state.contentBlocks];
      blocks.push({
        type: "tool_call",
        toolCallId: action.toolCallId,
        name: action.name,
        label: "",
        status: "running",
      });
      return { ...state, contentBlocks: blocks };
    }

    case "TOOL_CALL_DELTA": {
      const blocks = state.contentBlocks.map((block) => {
        if (block.type === "tool_call" && block.toolCallId === action.toolCallId) {
          return { ...block, label: block.label + action.argumentsDelta };
        }
        return block;
      });
      return { ...state, contentBlocks: blocks };
    }

    case "TOOL_CALL_END": {
      // Tool call waiting for result — keep as running
      return state;
    }

    case "TOOL_RESULT": {
      const blocks = state.contentBlocks.map((block) => {
        if (block.type === "tool_call" && block.toolCallId === action.toolCallId) {
          return {
            ...block,
            status: action.isError ? ("error" as const) : ("done" as const),
          };
        }
        return block;
      });
      return { ...state, contentBlocks: blocks };
    }

    case "ASK_USER":
      return {
        ...state,
        askUser: {
          toolCallId: action.toolCallId,
          question: action.question,
          options: action.options,
        },
      };

    case "MESSAGE_COMPLETE":
      return state;

    case "DONE":
      return {
        ...state,
        isStreaming: false,
        usage: action.usage,
      };

    case "ERROR":
      return {
        ...state,
        isStreaming: false,
        error: action.error,
      };

    case "CLEAR_ASK_USER":
      return { ...state, askUser: null };

    case "RESET":
      return initialState;

    default:
      return state;
  }
};

export const useStreamingReducer = () => {
  return useReducer(streamingReducer, initialState);
};
