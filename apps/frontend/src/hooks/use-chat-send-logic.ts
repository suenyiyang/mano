import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { createSseClient } from "../services/sse-client.js";
import type { SseEvent } from "../types/sse-events.js";
import type { StreamingAction } from "./use-streaming-reducer.js";

interface UseChatSendLogicProps {
  sessionId: string;
  dispatch: (action: StreamingAction) => void;
}

export const useChatSendLogic = (props: UseChatSendLogicProps) => {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (content: string) => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await createSseClient({
          url: `/api/sessions/${props.sessionId}/chat/send`,
          method: "POST",
          body: { content },
          signal: controller.signal,
          onEvent: (_eventType, data) => {
            try {
              const parsed = JSON.parse(data) as SseEvent;
              dispatchSseEvent(parsed, props.dispatch);
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
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        props.dispatch({
          type: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
    [props.sessionId, props.dispatch, queryClient],
  );

  const terminate = useCallback(async () => {
    abortRef.current?.abort();
    try {
      const { apiClient } = await import("../services/api-client.js");
      await apiClient.post(`/sessions/${props.sessionId}/chat/terminate`, {
        responseId: "", // Will be set properly when we have the responseId
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
