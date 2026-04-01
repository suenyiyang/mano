import { type InfiniteData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { apiClient } from "../services/api-client.js";
import { createSseClient } from "../services/sse-client.js";
import type { ActiveGeneration, PaginatedSessions, Session } from "../types/api.js";
import type { SseEvent } from "../types/sse-events.js";
import { useAutoScroll } from "./use-auto-scroll.js";
import { useChatInputLogic } from "./use-chat-input-logic.js";
import { useChatSendLogic } from "./use-chat-send-logic.js";
import { useMessageListLogic } from "./use-message-list-logic.js";
import { type StreamingAction, useStreamingReducer } from "./use-streaming-reducer.js";

interface UseSessionPageLogicProps {
  sessionId: string;
}

export const useSessionPageLogic = (props: UseSessionPageLogicProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const wasStreaming = useRef(false);
  const prevSessionIdRef = useRef(props.sessionId);

  // Auto-scroll
  const autoScroll = useAutoScroll(scrollRef, [messageList.turns, streamingState.contentBlocks]);

  // When streaming transitions true → false: refetch messages, then clear streaming blocks.
  // Skip when the transition is caused by a session switch (the RESET effect handles that).
  useEffect(() => {
    const sessionChanged = prevSessionIdRef.current !== props.sessionId;
    prevSessionIdRef.current = props.sessionId;

    if (sessionChanged) {
      wasStreaming.current = false;
      return;
    }

    if (wasStreaming.current && !streamingState.isStreaming) {
      setPendingUserMessage(null);
      // Refetch persisted messages, then clear streaming blocks so turns take over
      queryClient
        .invalidateQueries({ queryKey: ["messages", props.sessionId] })
        .then(() => dispatch({ type: "RESET" }));
    }
    wasStreaming.current = streamingState.isStreaming;
  }, [streamingState.isStreaming, props.sessionId, queryClient, dispatch]);

  // Send handler
  const handleSend = useCallback(
    (content: string) => {
      setPendingUserMessage(content);
      chatSend.send(content);
    },
    [chatSend],
  );

  const chatInputProps = useChatInputLogic({
    onSend: handleSend,
    isStreaming: streamingState.isStreaming,
  });

  // ─── Topbar actions ───────────────────────────────────────────────────

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      const { data } = await apiClient.post<{ session: Session }>(
        `/sessions/${props.sessionId}/update`,
        { title },
      );
      return data.session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", props.sessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  const forkMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ session: Session }>(
        `/sessions/${props.sessionId}/fork`,
      );
      return data.session;
    },
    onSuccess: (forked) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate(`/app/${forked.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/sessions/${props.sessionId}/delete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate("/app");
    },
  });

  // ─── Ask user / HITL respond ──────────────────────────────────────────

  const handleAskUserAnswer = useCallback(
    async (answer: string) => {
      if (!streamingState.askUser || !streamingState.responseId) return;
      try {
        await apiClient.post(`/sessions/${props.sessionId}/chat/respond`, {
          responseId: streamingState.responseId,
          toolCallId: streamingState.askUser.toolCallId,
          type: "ask_user_answer",
          payload: { answer },
        });
        dispatch({ type: "CLEAR_ASK_USER" });
      } catch {
        // Best-effort
      }
    },
    [props.sessionId, streamingState.askUser, streamingState.responseId, dispatch],
  );

  const handleAskUserClose = useCallback(async () => {
    if (streamingState.askUser && streamingState.responseId) {
      try {
        await apiClient.post(`/sessions/${props.sessionId}/chat/respond`, {
          responseId: streamingState.responseId,
          toolCallId: streamingState.askUser.toolCallId,
          type: "ask_user_answer",
          payload: { answer: "user_reject_to_answer" },
        });
      } catch {
        // Best-effort
      }
    }
    dispatch({ type: "CLEAR_ASK_USER" });
  }, [props.sessionId, streamingState.askUser, streamingState.responseId, dispatch]);

  // Reset streaming state when switching sessions
  useEffect(() => {
    dispatch({ type: "RESET" });
    setPendingUserMessage(null);
  }, [props.sessionId, dispatch]);

  // Handle initial message from new chat navigation
  useEffect(() => {
    const state = location.state as { initialMessage?: string } | null;
    if (!state?.initialMessage) return;

    const controller = new AbortController();
    setPendingUserMessage(state.initialMessage);
    chatSend.send(state.initialMessage, controller.signal);
    // Clear navigation state via React Router (window.history.replaceState doesn't update useLocation)
    navigate(location.pathname, { replace: true, state: {} });

    return () => {
      controller.abort();
    };
  }, [props.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume active generation on reconnect (e.g. page refresh mid-generation).
  // Only depends on sessionId — NOT on streamingState.isStreaming, because
  // dispatching RESPONSE_START would re-trigger cleanup and abort the resume SSE.
  useEffect(() => {
    // Skip resume when an initial message will be sent by the effect above
    const navState = location.state as { initialMessage?: string } | null;
    if (navState?.initialMessage) return;

    const controller = new AbortController();

    const resume = async () => {
      try {
        const { data } = await apiClient.get<ActiveGeneration>(
          `/sessions/${props.sessionId}/chat/active`,
        );
        if (controller.signal.aborted || !data.active || !data.responseId) return;

        const responseId = data.responseId;
        dispatch({ type: "RESPONSE_START", responseId });

        let receivedDone = false;
        let receivedAskUser = false;

        await createSseClient({
          url: `/api/sessions/${props.sessionId}/chat/${responseId}/resume`,
          method: "GET",
          signal: controller.signal,
          onEvent: (eventType, eventData) => {
            try {
              const parsed = JSON.parse(eventData);
              const event = { ...parsed, type: eventType } as SseEvent;

              if (event.type === "done") receivedDone = true;
              if (event.type === "ask_user") receivedAskUser = true;

              if (event.type === "session_update") {
                queryClient.setQueryData(["session", props.sessionId], event.session);
                queryClient.setQueryData<InfiniteData<PaginatedSessions>>(["sessions"], (old) => {
                  if (!old) return old;
                  return {
                    ...old,
                    pages: old.pages.map((page) => ({
                      ...page,
                      sessions: page.sessions.map((s) =>
                        s.id === event.session.id ? event.session : s,
                      ),
                    })),
                  };
                });
                return;
              }

              dispatchSseEvent(event, dispatch);
            } catch {
              // Ignore malformed events
            }
          },
          onError: (error) => {
            dispatch({ type: "ERROR", error: error.message });
          },
        });

        // Stream closed — if done was received the reducer already transitioned.
        // If the stream dropped without done (network error, server restart),
        // keep streaming state as-is (consistent with the send flow) so the
        // user can see the indicator and refresh if needed.
      } catch {
        // No active generation or network error — ignore
      }
    };

    resume();

    return () => {
      controller.abort();
    };
  }, [props.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const session = sessionQuery.data ?? null;

  return {
    session,
    topbarProps: {
      title: session?.title ?? t("common.untitled"),
      onRename: (title: string) => renameMutation.mutate(title),
      onFork: () => forkMutation.mutate(),
      onDelete: () => deleteMutation.mutate(),
    },
    messageListProps: {
      turns: streamingState.responseId
        ? messageList.turns.filter(
            (t) => t.type === "user" || t.responseId !== streamingState.responseId,
          )
        : messageList.turns,
      pendingUserMessage,
      streamingBlocks: streamingState.contentBlocks,
      isStreaming: streamingState.isStreaming,
      scrollRef,
      onScroll: autoScroll.onScroll,
    },
    chatInputProps: {
      ...chatInputProps,
      isStreaming: streamingState.isStreaming,
      onTerminate: chatSend.terminate,
      placeholder: t("chatInput.followUpPlaceholder"),
      maxWidth: "720px",
    },
    streamingError: streamingState.error,
    askUserDialogProps: {
      open: streamingState.askUser !== null,
      question: streamingState.askUser?.question ?? "",
      options: streamingState.askUser?.options,
      onAnswer: handleAskUserAnswer,
      onClose: handleAskUserClose,
    },
  };
};

const dispatchSseEvent = (event: SseEvent, dispatch: (action: StreamingAction) => void) => {
  switch (event.type) {
    case "response_start":
      dispatch({ type: "RESPONSE_START", responseId: event.responseId });
      break;
    case "text_delta":
      dispatch({ type: "TEXT_DELTA", text: event.text });
      break;
    case "tool_call_start":
      dispatch({ type: "TOOL_CALL_START", toolCallId: event.toolCallId, name: event.name });
      break;
    case "tool_call_delta":
      dispatch({
        type: "TOOL_CALL_DELTA",
        toolCallId: event.toolCallId,
        argumentsDelta: event.argumentsDelta,
      });
      break;
    case "tool_call_end":
      dispatch({ type: "TOOL_CALL_END", toolCallId: event.toolCallId });
      break;
    case "tool_result":
      dispatch({
        type: "TOOL_RESULT",
        toolCallId: event.toolCallId,
        content: event.content,
        isError: event.isError,
      });
      break;
    case "ask_user":
      dispatch({
        type: "ASK_USER",
        toolCallId: event.toolCallId,
        question: event.question,
        options: event.options,
      });
      break;
    case "message_complete":
      dispatch({ type: "MESSAGE_COMPLETE", message: event.message });
      break;
    case "done":
      dispatch({ type: "DONE", usage: event.usage });
      break;
    case "error":
      dispatch({ type: "ERROR", error: event.error });
      break;
  }
};
