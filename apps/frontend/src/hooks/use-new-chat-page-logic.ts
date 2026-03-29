import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { apiClient } from "../services/api-client.js";
import type { Session } from "../types/api.js";
import { useChatInputLogic } from "./use-chat-input-logic.js";

export const useNewChatPageLogic = () => {
  const navigate = useNavigate();

  const createSession = useMutation({
    mutationFn: async (input: { title?: string }) => {
      const { data } = await apiClient.post<{ session: Session }>("/sessions/create", input);
      return data.session;
    },
  });

  const handleSend = useCallback(
    async (content: string) => {
      const session = await createSession.mutateAsync({});
      navigate(`/app/${session.id}`, { state: { initialMessage: content } });
    },
    [createSession, navigate],
  );

  const chatInputProps = useChatInputLogic(handleSend);

  const handleQuickAction = useCallback(
    (text: string) => {
      chatInputProps.onChange(text);
      // Focus the textarea
      requestAnimationFrame(() => {
        chatInputProps.textareaRef.current?.focus();
      });
    },
    [chatInputProps],
  );

  return {
    chatInputProps,
    handleQuickAction,
    isCreating: createSession.isPending,
  };
};
