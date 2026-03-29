import { createBrowserRouter, Navigate } from "react-router";
import { AuthGuard } from "./components/auth-guard.js";
import { GuestGuard } from "./components/guest-guard.js";
import { AppLayout } from "./components/layout/app-layout.js";
import { LoginPage } from "./pages/login-page.js";
import { NewChatPage } from "./pages/new-chat-page.js";
import { OAuthCallbackPage } from "./pages/oauth-callback-page.js";
import { RegisterPage } from "./pages/register-page.js";
import { SessionPage } from "./pages/session-page.js";
import { SettingsPage } from "./pages/settings-page.js";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/app" replace />,
  },
  {
    Component: GuestGuard,
    children: [
      {
        path: "/login",
        Component: LoginPage,
      },
      {
        path: "/register",
        Component: RegisterPage,
      },
    ],
  },
  {
    path: "/auth/callback",
    Component: OAuthCallbackPage,
  },
  {
    Component: AuthGuard,
    children: [
      {
        path: "/app",
        Component: AppLayout,
        children: [
          {
            index: true,
            Component: NewChatPage,
          },
          {
            path: ":sessionId",
            Component: SessionPage,
          },
          {
            path: "settings",
            Component: SettingsPage,
          },
        ],
      },
    ],
  },
]);
