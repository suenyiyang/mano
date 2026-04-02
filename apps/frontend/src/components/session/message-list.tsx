import type { FC } from "react";
import type { ContentBlock, MessageTurn } from "../../types/message-turn.js";
import { AgentMessage } from "./agent-message.js";
import { UserMessage } from "./user-message.js";

interface MessageListProps {
  turns: MessageTurn[];
  pendingUserMessage: string | null;
  streamingBlocks: ContentBlock[];
  isStreaming: boolean;
  onRetry?: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  feedbackMap: Record<string, string>;
  onFeedback: (responseId: string, feedback: "like" | "dislike" | null) => void;
}

export const MessageList: FC<MessageListProps> = (props) => {
  return (
    <div ref={props.scrollRef} onScroll={props.onScroll} className="flex-1 overflow-y-auto py-2">
      <div className="mx-auto max-w-[720px] px-6">
        {props.turns.map((turn) => {
          if (turn.type === "user") {
            return <UserMessage key={turn.message.id} message={turn.message} />;
          }
          return (
            <AgentMessage
              key={turn.responseId}
              timestamp={turn.timestamp}
              blocks={turn.blocks}
              feedback={(props.feedbackMap[turn.responseId] as "like" | "dislike") ?? null}
              onFeedback={(fb) => props.onFeedback(turn.responseId, fb)}
            />
          );
        })}

        {/* Pending user message (optimistic, before cache data arrives) */}
        {props.pendingUserMessage &&
          !props.turns.some((t) => t.type === "user" && t.message.id.startsWith("optimistic-")) && (
            <UserMessage
              message={{
                id: "pending",
                sessionId: "",
                role: "user",
                content: props.pendingUserMessage,
                toolCalls: null,
                toolCallId: null,
                toolName: null,
                ordinal: 0,
                modelId: null,
                responseId: null,
                tokenUsage: null,
                isCompacted: false,
                createdAt: new Date().toISOString(),
              }}
            />
          )}

        {/* Live streaming content (kept visible after streaming ends until turns refresh) */}
        {(props.isStreaming || props.streamingBlocks.length > 0) && (
          <AgentMessage
            timestamp={new Date().toISOString()}
            blocks={props.streamingBlocks}
            isStreaming={props.isStreaming}
            onRetry={props.onRetry}
          />
        )}
      </div>
    </div>
  );
};
