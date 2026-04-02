import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { apiClient } from "../services/api-client.js";
import type { PaginatedSessions, Session } from "../types/api.js";

export const useSessionListLogic = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const query = useInfiniteQuery({
    queryKey: ["sessions"],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams({ limit: "20" });
      if (pageParam) {
        params.set("cursor", pageParam);
      }
      const { data } = await apiClient.get<PaginatedSessions>(
        `/sessions/list?${params.toString()}`,
      );
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const sessions = query.data?.pages.flatMap((page) => page.sessions) ?? [];

  const filteredSessions = search
    ? sessions.filter((s) => s.title?.toLowerCase().includes(search.toLowerCase()))
    : sessions;

  const createSessionMutation = useMutation({
    mutationFn: async (input: { title?: string; systemPrompt?: string }) => {
      const { data } = await apiClient.post<{ session: Session }>("/sessions/create", input);
      return data.session;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate(`/app/${session.id}`);
    },
  });

  const renameSessionMutation = useMutation({
    mutationFn: async (input: { sessionId: string; title: string }) => {
      const { data } = await apiClient.post<{ session: Session }>(
        `/sessions/${input.sessionId}/update`,
        { title: input.title },
      );
      return data.session;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["session", variables.sessionId] });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.post(`/sessions/${sessionId}/delete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  const handleNewChat = useCallback(() => {
    navigate("/app");
  }, [navigate]);

  const handleOpenSettings = useCallback(() => {
    navigate("/app/settings");
  }, [navigate]);

  return {
    sessions: filteredSessions,
    search,
    setSearch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    createSessionMutation,
    renameSessionMutation,
    deleteSessionMutation,
    handleNewChat,
    handleOpenSettings,
  };
};
