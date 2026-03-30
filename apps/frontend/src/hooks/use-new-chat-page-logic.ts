import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { apiClient } from "../services/api-client.js";
import type { PaginatedSessions, Session } from "../types/api.js";
import { useChatInputLogic } from "./use-chat-input-logic.js";

export const useNewChatPageLogic = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createSession = useMutation({
    mutationFn: async (input: { title?: string }) => {
      const { data } = await apiClient.post<{ session: Session }>("/sessions/create", input);
      return data.session;
    },
  });

  const handleSend = useCallback(
    async (content: string) => {
      const session = await createSession.mutateAsync({});

      // Optimistically add the new session to the sidebar
      queryClient.setQueryData<InfiniteData<PaginatedSessions>>(["sessions"], (old) => {
        if (!old) return old;
        const pages = [...old.pages];
        const firstPage = pages[0];
        if (firstPage) {
          pages[0] = {
            ...firstPage,
            sessions: [session, ...firstPage.sessions],
          };
        }
        return { ...old, pages };
      });

      navigate(`/app/${session.id}`, { state: { initialMessage: content } });
    },
    [createSession, navigate, queryClient],
  );

  const chatInputProps = useChatInputLogic({ onSend: handleSend });

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
