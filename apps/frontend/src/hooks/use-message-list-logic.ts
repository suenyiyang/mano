import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { groupMessages } from "../lib/group-messages.js";
import { apiClient } from "../services/api-client.js";
import type { PaginatedMessages } from "../types/api.js";

interface UseMessageListLogicProps {
  sessionId: string;
}

export const useMessageListLogic = (props: UseMessageListLogicProps) => {
  const query = useInfiniteQuery({
    queryKey: ["messages", props.sessionId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (pageParam) {
        params.set("cursor", pageParam);
      }
      const { data } = await apiClient.get<PaginatedMessages>(
        `/sessions/${props.sessionId}/messages/list?${params.toString()}`,
      );
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!props.sessionId,
  });

  const messages = useMemo(
    () => query.data?.pages.flatMap((page) => page.messages) ?? [],
    [query.data],
  );

  const turns = useMemo(() => groupMessages(messages), [messages]);

  return {
    messages,
    turns,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};
