import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { apiClient } from "../services/api-client.js";
import { authSession } from "../services/auth-token.js";
import type { User } from "../types/api.js";

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ user: User }>("/auth/me");
      return data.user;
    },
    enabled: authSession.hasSession(),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (isAxiosError(error) && error.response?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
  });
};
