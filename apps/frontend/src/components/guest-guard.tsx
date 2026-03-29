import type { FC } from "react";
import { Navigate, Outlet } from "react-router";
import { authToken } from "../services/auth-token.js";

export const GuestGuard: FC = () => {
  if (authToken.get()) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
};
