import type { FC } from "react";
import { Outlet } from "react-router";
import { AuthProvider } from "../../contexts/auth-context.js";
import { ThemeProvider } from "../../contexts/theme-context.js";
import { Sidebar } from "./sidebar.js";

export const AppLayout: FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col bg-[var(--bg)]">
            <Outlet />
          </main>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
};
