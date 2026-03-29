import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../services/api-client.js";
import { authToken } from "../services/auth-token.js";
import type { User } from "../types/api.js";

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ user: User }>("/auth/me");
      return data.user;
    },
    enabled: !!authToken.get(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
};
