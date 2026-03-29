import type { FC } from "react";
import { Navigate, Outlet } from "react-router";
import { useCurrentUser } from "../hooks/use-current-user.js";
import { authToken } from "../services/auth-token.js";

export const AuthGuard: FC = () => {
  const { data: user, isLoading } = useCurrentUser();

  // No token at all — skip the API call and redirect immediately
  if (!authToken.get()) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
