import { type InfiniteData, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { createSseClient } from "../services/sse-client.js";
import type { Message, PaginatedMessages, PaginatedSessions } from "../types/api.js";
import type { SseEvent } from "../types/sse-events.js";
import type { StreamingAction } from "./use-streaming-reducer.js";

interface UseChatSendLogicProps {
  sessionId: string;
  dispatch: (action: StreamingAction) => void;
}

export const useChatSendLogic = (props: UseChatSendLogicProps) => {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const responseIdRef = useRef<string | null>(null);

  const send = useCallback(
    async (content: string, externalSignal?: AbortSignal) => {
      // Prevent double-sends while a send is in progress.
      // Allow retry when the previous send was aborted (e.g. StrictMode cleanup).
      if (abortRef.current && !abortRef.current.signal.aborted) return;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Link external signal (e.g. from useEffect cleanup) to internal controller
        if (externalSignal) {
          if (externalSignal.aborted) {
            controller.abort();
            return;
          }
          externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
        }

        // Cancel in-flight queries so they don't overwrite the optimistic data
        await queryClient.cancelQueries({ queryKey: ["messages", props.sessionId] });

        // If the signal was aborted during the await (e.g. StrictMode cleanup), bail out
        if (controller.signal.aborted) return;

        // Optimistically add the user message to the cache.
        // Remove any existing optimistic messages first to prevent duplicates
        // (e.g. React 19 StrictMode double-firing effects).
        queryClient.setQueryData<InfiniteData<PaginatedMessages>>(
          ["messages", props.sessionId],
          (old) => {
            const optimisticMessage: Message = {
              id: `optimistic-${Date.now()}`,
              sessionId: props.sessionId,
              role: "user",
              content,
              toolCalls: null,
              toolCallId: null,
              toolName: null,
              ordinal: Number.MAX_SAFE_INTEGER,
              modelId: null,
              responseId: null,
              tokenUsage: null,
              isCompacted: false,
              createdAt: new Date().toISOString(),
            };
            if (!old) {
              return {
                pages: [{ messages: [optimisticMessage], nextCursor: null }],
                pageParams: [undefined],
              };
            }
            const pages = old.pages.map((page) => ({
              ...page,
              messages: page.messages.filter((m) => !m.id.startsWith("optimistic-")),
            }));
            const lastPageIndex = pages.length - 1;
            const lastPage = pages[lastPageIndex];
            if (lastPage) {
              pages[lastPageIndex] = {
                ...lastPage,
                messages: [...lastPage.messages, optimisticMessage],
              };
            }
            return { ...old, pages };
          },
        );

        await createSseClient({
          url: `/api/sessions/${props.sessionId}/chat/send`,
          method: "POST",
          body: { content },
          signal: controller.signal,
          onEvent: (eventType, data) => {
            try {
              const parsed = JSON.parse(data);
              const event = { ...parsed, type: eventType } as SseEvent;

              // Capture responseId for terminate
              if (event.type === "response_start") {
                responseIdRef.current = event.responseId;
              }

              // Handle session updates via query cache, not streaming reducer
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

              dispatchSseEvent(event, props.dispatch);
            } catch {
              // Ignore malformed events
            }
          },
          onError: (error) => {
            props.dispatch({ type: "ERROR", error: error.message });
          },
        });

        // Stream ended — refetch messages to get the persisted versions
        queryClient.invalidateQueries({ queryKey: ["messages", props.sessionId] });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        props.dispatch({
          type: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        abortRef.current = null;
        responseIdRef.current = null;
      }
    },
    [props.sessionId, props.dispatch, queryClient],
  );

  const terminate = useCallback(async () => {
    abortRef.current?.abort();
    const responseId = responseIdRef.current;
    if (!responseId) return;
    try {
      const { apiClient } = await import("../services/api-client.js");
      await apiClient.post(`/sessions/${props.sessionId}/chat/terminate`, {
        responseId,
      });
    } catch {
      // Best-effort terminate
    }
  }, [props.sessionId]);

  return { send, terminate };
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
