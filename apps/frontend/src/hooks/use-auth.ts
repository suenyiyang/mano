import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { apiClient } from "../services/api-client.js";
import { authSession } from "../services/auth-token.js";
import type { AuthResponse } from "../types/api.js";
import { useCurrentUser } from "./use-current-user.js";

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export const useAuthLogic = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: user, isLoading } = useCurrentUser();

  const loginMutation = useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await apiClient.post<AuthResponse>("/auth/login", input);
      return data;
    },
    onSuccess: (data) => {
      authSession.markLoggedIn();
      queryClient.setQueryData(["currentUser"], data.user);
      navigate("/app");
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (input: RegisterInput) => {
      const { data } = await apiClient.post<AuthResponse>("/auth/register", input);
      return data;
    },
    onSuccess: (data) => {
      authSession.markLoggedIn();
      queryClient.setQueryData(["currentUser"], data.user);
      navigate("/app");
    },
  });

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore — server session may already be gone
    }
    authSession.markLoggedOut();
    queryClient.clear();
    navigate("/login");
  }, [queryClient, navigate]);

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    loginMutation,
    registerMutation,
    logout,
  };
};
