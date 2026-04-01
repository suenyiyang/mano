import type { FC } from "react";
import { Navigate, Outlet } from "react-router";
import { authSession } from "../services/auth-token.js";

export const GuestGuard: FC = () => {
  if (authSession.hasSession()) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
};
