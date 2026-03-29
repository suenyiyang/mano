import { isAxiosError } from "axios";
import type { FC } from "react";
import { Navigate, Outlet } from "react-router";
import { useCurrentUser } from "../hooks/use-current-user.js";
import { authToken } from "../services/auth-token.js";

export const AuthGuard: FC = () => {
  const { data: user, isLoading, error } = useCurrentUser();

  // No token at all — skip the API call and redirect immediately
  if (!authToken.get()) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return null;
  }

  if (!user) {
    // Network/server errors: keep tokens and stay on blank screen while retrying
    // so the user auto-recovers when the API comes back
    if (error && !(isAxiosError(error) && error.response?.status === 401)) {
      return null;
    }
    // Auth failure (401) or no error: clear tokens and redirect to login
    authToken.clear();
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
