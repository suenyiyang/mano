import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { apiClient } from "../services/api-client.js";
import type { Session } from "../types/api.js";
import { useAutoScroll } from "./use-auto-scroll.js";
import { useChatInputLogic } from "./use-chat-input-logic.js";
import { useChatSendLogic } from "./use-chat-send-logic.js";
import { useMessageListLogic } from "./use-message-list-logic.js";
import { useStreamingReducer } from "./use-streaming-reducer.js";

interface UseSessionPageLogicProps {
  sessionId: string;
}

export const useSessionPageLogic = (props: UseSessionPageLogicProps) => {
  const location = useLocation();
  const initialMessageSent = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Session detail
  const sessionQuery = useQuery({
    queryKey: ["session", props.sessionId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ session: Session }>(
        `/sessions/${props.sessionId}/detail`,
      );
      return data.session;
    },
    enabled: !!props.sessionId,
  });

  // Messages
  const messageList = useMessageListLogic({ sessionId: props.sessionId });

  // Streaming
  const [streamingState, dispatch] = useStreamingReducer();
  const chatSend = useChatSendLogic({ sessionId: props.sessionId, dispatch });

  // Auto-scroll
  const autoScroll = useAutoScroll(scrollRef, [messageList.turns, streamingState.contentBlocks]);

  // Send handler
  const handleSend = useCallback(
    (content: string) => {
      chatSend.send(content);
    },
    [chatSend],
  );

  const chatInputProps = useChatInputLogic(handleSend);

  // Handle initial message from new chat navigation
  useEffect(() => {
    const state = location.state as { initialMessage?: string } | null;
    if (state?.initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true;
      chatSend.send(state.initialMessage);
      // Clear the navigation state
      window.history.replaceState({}, "");
    }
  }, [location.state, chatSend]);

  return {
    session: sessionQuery.data ?? null,
    messageListProps: {
      turns: messageList.turns,
      streamingBlocks: streamingState.contentBlocks,
      isStreaming: streamingState.isStreaming,
      scrollRef,
      onScroll: autoScroll.onScroll,
    },
    chatInputProps: {
      ...chatInputProps,
      isStreaming: streamingState.isStreaming,
      onTerminate: chatSend.terminate,
      placeholder: "Send a follow-up...",
      maxWidth: "720px",
    },
    streamingError: streamingState.error,
    askUser: streamingState.askUser,
  };
};
