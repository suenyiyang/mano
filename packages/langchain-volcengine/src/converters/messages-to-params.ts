import type { BaseMessage } from "@langchain/core/messages";
import type {
  VolcengineContentPart,
  VolcengineMessage,
  VolcengineToolCallFunction,
} from "../types.js";

/**
 * Convert a LangChain BaseMessage array to Volcengine API message format.
 */
export const convertMessagesToVolcengineParams = (messages: BaseMessage[]): VolcengineMessage[] => {
  return messages.map(convertSingleMessage);
};

const convertSingleMessage = (message: BaseMessage): VolcengineMessage => {
  const type = message._getType();

  switch (type) {
    case "system":
      return {
        role: "system",
        content: getStringContent(message),
      };

    case "human":
      return {
        role: "user",
        content: convertHumanContent(message),
      };

    case "ai":
      return convertAIMessage(message);

    case "tool":
      return {
        role: "tool",
        content: getStringContent(message),
        tool_call_id: (message as { tool_call_id?: string }).tool_call_id ?? "",
      };

    default:
      throw new Error(`Unsupported message type: ${type}`);
  }
};

const getStringContent = (message: BaseMessage): string => {
  if (typeof message.content === "string") {
    return message.content;
  }
  // Join text parts for non-user messages
  return message.content
    .filter(
      (block): block is { type: "text"; text: string } =>
        typeof block === "object" && "type" in block && block.type === "text",
    )
    .map((block) => block.text)
    .join("");
};

const convertHumanContent = (message: BaseMessage): string | VolcengineContentPart[] => {
  if (typeof message.content === "string") {
    return message.content;
  }

  const parts: VolcengineContentPart[] = [];
  for (const block of message.content) {
    if (typeof block === "string") {
      parts.push({ type: "text", text: block });
    } else if (typeof block === "object" && "type" in block) {
      if (block.type === "text") {
        parts.push({
          type: "text",
          text: (block as { text: string }).text,
        });
      } else if (block.type === "image_url") {
        const imageBlock = block as unknown as {
          image_url: { url: string; detail?: string };
        };
        parts.push({
          type: "image_url",
          image_url: imageBlock.image_url,
        });
      }
    }
  }
  return parts;
};

const convertAIMessage = (message: BaseMessage): VolcengineMessage => {
  const result: VolcengineMessage = {
    role: "assistant" as const,
    content: null,
  };

  const assistantResult = result as {
    role: "assistant";
    content?: string | null;
    reasoning_content?: string;
    tool_calls?: VolcengineToolCallFunction[];
  };

  // Extract text content
  if (typeof message.content === "string") {
    assistantResult.content = message.content || null;
  } else if (Array.isArray(message.content)) {
    const textParts: string[] = [];
    let reasoningContent: string | undefined;

    for (const block of message.content) {
      if (typeof block === "string") {
        textParts.push(block);
      } else if (typeof block === "object" && "type" in block) {
        if (block.type === "text") {
          textParts.push((block as { text: string }).text);
        } else if (block.type === "reasoning") {
          reasoningContent = (block as unknown as { reasoning: string }).reasoning;
        }
      }
    }

    assistantResult.content = textParts.join("") || null;
    if (reasoningContent) {
      assistantResult.reasoning_content = reasoningContent;
    }
  }

  // Extract reasoning_content from additional_kwargs if not already set
  if (!assistantResult.reasoning_content && message.additional_kwargs?.reasoning_content) {
    assistantResult.reasoning_content = message.additional_kwargs.reasoning_content as string;
  }

  // Extract tool_calls
  const toolCalls = (
    message as {
      tool_calls?: Array<{
        id?: string;
        name: string;
        args: Record<string, unknown>;
      }>;
    }
  ).tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    assistantResult.tool_calls = toolCalls.map((tc) => ({
      id: tc.id ?? "",
      type: "function" as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.args),
      },
    }));
  }

  return assistantResult;
};
